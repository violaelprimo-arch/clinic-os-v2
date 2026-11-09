import { NextRequest, NextResponse } from 'next/server'
import { readDocument, writeDocument, deleteDocument, queryDocuments, createDocument } from '@/lib/server/firebase-rest'
import { hashPassword } from '@/lib/auth-crypto'
import { authenticateOwnerRequest } from '@/lib/server/owner-access'

function generateSecureRandomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  return Array.from(bytes, b => b.toString(36).padStart(2, '0')).join('').slice(0, 16) + '!Aa1'
}

export async function POST(req: NextRequest) {
  try {
    // Authenticate Platform Owner only
    const owner = await authenticateOwnerRequest(req)

    const body = await req.json().catch(() => ({}))
    const doctorPass = body.doctorPassword || process.env.ROTATED_DOCTOR_PASSWORD || generateSecureRandomPassword()
    const secretaryPass = body.secretaryPassword || process.env.ROTATED_SECRETARY_PASSWORD || generateSecureRandomPassword()
    const patientPass = body.patientPassword || process.env.ROTATED_PATIENT_PASSWORD || generateSecureRandomPassword()

    const doctorHash = await hashPassword(doctorPass)
    const assistantHash = await hashPassword(secretaryPass)
    const patientHash = await hashPassword(patientPass)

    const now = new Date().toISOString()

    const CLINIC_IDS = [
      'b2LvVyPnssx736ENZ7XI', // karim
      'XVU00NYtNTsXw4twxwyz', // zizo
      'LGAqk0w1DKIqCgKI9CE5', // dr-tarek-internal
      'WRwl0gsIabDyRwVtLE61', // dr-sara-eyes
      'zIJH78sXOiRFtq0mscb1', // dr-nada-pediatrics
      'b5f0e950-6e44-42f7-939b-0b12d8728696', // yalla-demo
    ]

    const clinicsUpdated: string[] = []

    for (const id of CLINIC_IDS) {
      const doc = await readDocument(`clinics/${id}`)
      if (!doc) continue

      const updatedAssistants = Array.isArray(doc.assistants)
        ? doc.assistants.map((a: any) => {
            const { password, ...clean } = a
            return {
              ...clean,
              passwordHash: assistantHash
            }
          })
        : []

      await writeDocument(`clinics/${id}`, {
        doctorPassword: null,
        assistantPassword: null,
        doctorPasswordHash: doctorHash,
        assistantPasswordHash: assistantHash,
        assistants: updatedAssistants,
        passwordLastChangedAt: now,
        mustChangePassword: false,
        updatedAt: now
      }, true)

      clinicsUpdated.push(id)
    }

    // 2. Rotate Patient Test Accounts across all matching documents
    const allPatientAccs = await queryDocuments('patient_accounts')
    for (const acc of allPatientAccs) {
      if (
        acc.phone === '01011122233' ||
        acc.phone === '+201011122233' ||
        acc.name === 'أحمد محمود القاضي' ||
        acc.id === '01011122233' ||
        acc.id === 'patient-acc-1'
      ) {
        await writeDocument(`patient_accounts/${acc.id}`, {
          password: null,
          passwordHash: patientHash,
          updatedAt: now
        }, true).catch(() => {})
      }
    }
    // Also ensure direct phone keyed document has rotated hash
    await writeDocument('patient_accounts/01011122233', {
      name: 'أحمد محمود القاضي',
      phone: '01011122233',
      password: null,
      passwordHash: patientHash,
      updatedAt: now
    }, true).catch(() => {})
    await writeDocument('patient_accounts/patient-acc-1', {
      name: 'أحمد محمود القاضي',
      phone: '01011122233',
      password: null,
      passwordHash: patientHash,
      updatedAt: now
    }, true).catch(() => {})

    // 3. Clean up only confirmed disposable test appointments and prescriptions
    const appts = (await queryDocuments('appointments')) as any[]
    const deletedAppointments: string[] = []
    const TEST_PHONES = new Set(['01099887766', '01099998888', '01099999999', '01019998877'])

    for (const a of appts) {
      // PRESERVE real patients like 'عمرو خالد مصطفى'
      if (a.patientName && typeof a.patientName === 'string' && a.patientName.includes('عمرو خالد مصطفى')) continue
      if (a.phone && typeof a.phone === 'string' && TEST_PHONES.has(a.phone)) {
        await deleteDocument(`appointments/${a.id}`).catch(() => {})
        await deleteDocument(`prescriptions/rx-${a.id}`).catch(() => {})
        await deleteDocument(`prescriptions/${a.id}`).catch(() => {})
        deletedAppointments.push(a.id)
      }
    }

    // Record credential rotation in audit_logs
    await createDocument('audit_logs', {
      action: 'rotate_credentials',
      performedBy: owner.email || 'platform_owner',
      ownerUid: owner.uid,
      clinicsUpdatedCount: clinicsUpdated.length,
      timestamp: now
    }).catch(() => {})

    return NextResponse.json({
      success: true,
      timestamp: now,
      clinicsUpdated,
      deletedAppointmentsCount: deletedAppointments.length,
      note: 'Credentials rotated to secure hashes. Plaintext passwords removed.'
    })
  } catch (error: any) {
    return NextResponse.json({
      error: error.message || 'Unauthorized or failed to rotate credentials'
    }, { status: error.status || 401 })
  }
}
