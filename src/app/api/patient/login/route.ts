import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, hashPassword, createSessionToken } from '@/lib/auth-crypto'
import { queryDocumentsByField, writeDocument } from '@/lib/server/firebase-rest'

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

    // Resolve the actual clinic ID and fail closed on connection problems.
    const clinics = await queryDocumentsByField('clinics', 'slug', String(slug))
    if (clinics.length !== 1) {
      return NextResponse.json({ error: 'العيادة غير موجودة أو غير متاحة' }, { status: 404 })
    }
    const clinicId = String(clinics[0].id)

    const variants = [...new Set([
      cleanPhone,
      normalizedInputPhone,
      normalizedInputPhone.startsWith('0') ? '20' + normalizedInputPhone.slice(1) : '',
      normalizedInputPhone.startsWith('0') ? '+20' + normalizedInputPhone.slice(1) : '',
    ].filter(Boolean))]
    const matches = await Promise.all([
      queryDocumentsByField('patient_accounts', 'phoneNormalized', normalizedInputPhone),
      ...variants.map(p => queryDocumentsByField('patient_accounts', 'phone', p)),
    ])
    const userDoc = matches.flat().find(acc => (
      (acc.clinic_id === clinicId || acc.clinicId === clinicId) &&
      normalizePhone(String(acc.phone || '')) === normalizedInputPhone
    ))

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
        name: String(patientData.name || 'المريض'),
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

    // A booking record is NOT proof of phone ownership. Never create a
    // password-protected patient identity just from a previous booking name
    // and a caller-supplied phone number; that enables account hijacking.
    // Existing patients without credentials must use a verified registration
    // or recovery workflow.

    return NextResponse.json(
      { error: 'رقم الهاتف غير مسجل في هذه العيادة. يرجى إنشاء حساب جديد.' },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('Patient login API error:', error)
    return NextResponse.json(
      { error: 'تعذر تسجيل الدخول حاليًا، حاول مرة أخرى.' },
      { status: 500 }
    )
  }
}
