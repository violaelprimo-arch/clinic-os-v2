import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifyPassword, hashPassword, createSessionToken } from '@/lib/auth-crypto'
import { queryDocuments, writeDocument, createDocument } from '@/lib/server/firebase-rest'

function normalizePhone(p: string): string {
  return String(p || '').replace(/\D/g, '').replace(/^20/, '0')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { slug = 'zizo', phone, password } = body

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'يرجى إدخال رقم الهاتف وكلمة المرور' },
        { status: 400 }
      )
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '')
    const normalizedInputPhone = normalizePhone(cleanPhone)

    // Resolve clinic
    let clinicId = slug
    try {
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (!cSnap.empty) {
        clinicId = cSnap.docs[0].id
      }
    } catch (e) {
      console.warn('Clinic lookup error, using slug as clinicId:', e)
    }

    // Check patient_accounts via secure server REST (bypasses unauthenticated Firestore rule restrictions)
    let allAccounts: any[] = []
    try {
      allAccounts = await queryDocuments('patient_accounts')
    } catch (e) {
      console.warn('queryDocuments for patient_accounts failed:', e)
    }

    const userDoc = allAccounts.find((acc: any) => {
      const pNorm = normalizePhone(acc.phone)
      return pNorm === normalizedInputPhone || acc.phone === cleanPhone
    })

    if (userDoc) {
      const storedPassword = userDoc.passwordHash || userDoc.password

      if (!storedPassword || String(storedPassword).trim() === '') {
        return NextResponse.json(
          {
            error:
              'لم يتم تعيين كلمة مرور لهذا الحساب بعد. يرجى إنشاء حساب جديد بكلمة مرور أو مراجعة إدارة العيادة.'
          },
          { status: 403 }
        )
      }

      const isMatch = await verifyPassword(String(password), String(storedPassword))
      if (!isMatch) {
        return NextResponse.json(
          { error: 'كلمة المرور غير صحيحة' },
          { status: 401 }
        )
      }

      // Automatically upgrade legacy plaintext password to secure cryptographic hash
      if (!userDoc.passwordHash) {
        const newHash = await hashPassword(String(password))
        writeDocument(`patient_accounts/${userDoc.id}`, {
          passwordHash: newHash,
          password: ''
        }, true).catch(() => {})
      }

      const patientData = {
        id: userDoc.id,
        name: userDoc.name || 'المريض',
        phone: cleanPhone,
        age: userDoc.age || '',
        clinic_id: clinicId,
        slug
      }

      const token = await createSessionToken({
        role: 'patient',
        name: patientData.name,
        phone: cleanPhone,
        clinicId,
        slug,
        patientId: userDoc.id
      })

      const response = NextResponse.json({
        success: true,
        token,
        patient: patientData
      })

      response.cookies.set('patient_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      })

      return response
    }

    // Check past appointments
    let pastAppointments: any[] = []
    try {
      const apptQ = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId)
      )
      const apptSnap = await getDocs(apptQ)
      pastAppointments = apptSnap.docs
        .map(d => ({ id: d.id, ...d.data() as any }))
        .filter(a => normalizePhone(a.phone) === normalizedInputPhone || a.phone === cleanPhone)
    } catch (e) {
      console.warn('Appointments lookup failed:', e)
    }

    if (pastAppointments.length > 0) {
      const firstAppt = pastAppointments[0]
      const patientName = firstAppt.patientName || 'المريض'
      const patientAge = firstAppt.age || ''
      const passwordHash = await hashPassword(String(password))

      const newId = crypto.randomUUID()
      await writeDocument(`patient_accounts/${newId}`, {
        clinic_id: clinicId,
        name: patientName,
        phone: cleanPhone,
        age: patientAge,
        passwordHash,
        createdAt: new Date().toISOString()
      }, true)

      const patientData = {
        id: newId,
        name: patientName,
        phone: cleanPhone,
        age: patientAge,
        clinic_id: clinicId,
        slug
      }

      const token = await createSessionToken({
        role: 'patient',
        name: patientName,
        phone: cleanPhone,
        clinicId,
        slug,
        patientId: newId
      })

      const response = NextResponse.json({
        success: true,
        token,
        patient: patientData
      })

      response.cookies.set('patient_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60
      })

      return response
    }

    return NextResponse.json(
      { error: 'رقم الهاتف غير مسجل في هذه العيادة. يرجى إنشاء حساب جديد.' },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('Patient login API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء تسجيل الدخول: ' + (error.message || '') },
      { status: 500 }
    )
  }
}
