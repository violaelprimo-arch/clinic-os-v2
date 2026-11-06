import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken } from '@/lib/auth-crypto'
import { verifyClinicGoogleIdToken } from '@/lib/server/firebase-clinic-google-auth'
import { findDocumentsByField, createDocument } from '@/lib/server/firebase-rest'

export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin')
  if (origin && origin !== req.nextUrl.origin)
    return NextResponse.json({ error: 'طلب غير مصرح به' }, { status: 403 })

  try {
    const { idToken, slug } = await req.json().catch(() => ({}))
    if (typeof slug !== 'string' || !/^[\w-]{1,100}$/.test(slug))
      return NextResponse.json({ error: 'رابط العيادة غير صحيح' }, { status: 400 })

    // Never trust an email from the browser. Verify a Firebase Google ID token
    // with Google's servers, then scope the identity to this precise clinic.
    const identity = await verifyClinicGoogleIdToken(idToken)
    const clinics = await findDocumentsByField('clinics', 'slug', slug)
    if (clinics.length !== 1 ||
      String(clinics[0].doctorEmail || '').trim().toLowerCase() !== identity.email) {
      return NextResponse.json({ error: 'حساب Google ده مش مسجل كطبيب للعيادة دي' }, { status: 403 })
    }

    const clinic = clinics[0]
    const clinicId = String(clinic.id)
    const name = String(clinic.doctorName || 'طبيب العيادة')
    const token = await createSessionToken({
      role: 'doctor', email: identity.email, name, clinicId, slug,
      mustChangePassword: clinic.mustChangePassword === true,
    })

    await createDocument('audit_logs', {
      action: 'AUTH_LOGIN', actorName: name, actorRole: 'doctor',
      clinicId, details: { email: identity.email, method: 'GOOGLE' },
      createdAt: new Date().toISOString(),
    }).catch(() => {})

    const response = NextResponse.json({
      success: true, token,
      user: { role: 'doctor', name, email: identity.email, clinicId, slug,
        mustChangePassword: clinic.mustChangePassword === true },
    })
    response.cookies.set('clinic_session', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60,
    })
    return response
  } catch (error) {
    const code = error instanceof Error ? error.message : 'UNKNOWN'
    console.error('[google-login] Failed:', code)
    return NextResponse.json({
      error: code === 'GOOGLE_AUTH_NOT_CONFIGURED'
        ? 'Google Login غير مُفعّل في إعدادات Firebase، تواصل مع الدعم الفني'
        : 'تعذر التحقق من حساب Google. تأكد أن الحساب مسجل للعيادة وحاول مرة أخرى',
    }, { status: code === 'GOOGLE_AUTH_NOT_CONFIGURED' ? 503 : 401 })
  }
}
