import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, createSessionToken } from '@/lib/auth-crypto'
import { queryDocumentsByField, writeDocument } from '@/lib/server/firebase-rest'

function normalizePhone(p: string): string {
  return String(p || '').replace(/\D/g, '').replace(/^20/, '0')
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { slug = 'zizo', name, phone, age, password } = body

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: 'يرجى إكمال جميع الحقول الإلزامية: الاسم، الهاتف، وكلمة المرور' },
        { status: 400 }
      )
    }

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: 'يجب ألا تقل كلمة المرور عن 6 خانات' },
        { status: 400 }
      )
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '')
    const cleanName = String(name).trim()
    const cleanAge = String(age || '').trim()
    const normalizedInputPhone = normalizePhone(cleanPhone)

    // Resolve a real clinic on the trusted server. Never create patient
    // identities against an unverified slug or after a failed database query.
    const matchingClinics = await queryDocumentsByField('clinics', 'slug', String(slug))
    if (matchingClinics.length !== 1) {
      return NextResponse.json({ error: 'العيادة غير موجودة أو غير متاحة' }, { status: 404 })
    }
    const clinicId = String(matchingClinics[0].id)

    // Look up this exact phone using server-side indexed equality filters.
    // Scanning only the first 200 accounts could silently create duplicates.
    const variants = [...new Set([
      cleanPhone,
      normalizedInputPhone,
      normalizedInputPhone.startsWith('0') ? '20' + normalizedInputPhone.slice(1) : '',
      normalizedInputPhone.startsWith('0') ? '+20' + normalizedInputPhone.slice(1) : '',
    ].filter(Boolean))]
    const lookups = await Promise.all([
      queryDocumentsByField('patient_accounts', 'phoneNormalized', normalizedInputPhone),
      ...variants.map(p => queryDocumentsByField('patient_accounts', 'phone', p)),
    ])
    const existing = lookups.flat().find(acc => (
      (acc.clinic_id === clinicId || acc.clinicId === clinicId) &&
      normalizePhone(String(acc.phone || '')) === normalizedInputPhone
    ))

    if (existing) {
      return NextResponse.json(
        { error: 'رقم الهاتف مسجل بالفعل في هذه العيادة. يرجى تسجيل الدخول.' },
        { status: 409 }
      )
    }

    // Cryptographically hash password (A03 - P0 Hardening)
    const passwordHash = await hashPassword(String(password))
    const newDocId = crypto.randomUUID()

    await writeDocument(`patient_accounts/${newDocId}`, {
      clinic_id: clinicId,
      name: cleanName,
      phone: cleanPhone,
      phoneNormalized: normalizedInputPhone,
      age: cleanAge,
      passwordHash,
      createdAt: new Date().toISOString()
    }, true)

    const patientData = {
      id: newDocId,
      name: cleanName,
      phone: cleanPhone,
      age: cleanAge,
      clinic_id: clinicId,
      slug
    }

    const token = await createSessionToken({
      role: 'patient',
      name: cleanName,
      phone: cleanPhone,
      clinicId,
      slug,
      patientId: newDocId
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
  } catch (error: any) {
    console.error('Patient registration API error:', error)
    return NextResponse.json(
      { error: 'تعذر إنشاء الحساب حاليًا. حاول مرة أخرى.' },
      { status: 500 }
    )
  }
}
