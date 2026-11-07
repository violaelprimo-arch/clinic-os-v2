import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken } from '@/lib/auth-crypto'
import { queryDocuments } from '@/lib/server/firebase-rest'
import { verifyClinicGoogleIdToken } from '@/lib/server/firebase-clinic-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug)) {
      return NextResponse.json({ error: 'رابط العيادة غير صحيح' }, { status: 400 })
    }
    const { uid, email } = await verifyClinicGoogleIdToken(body.idToken)
    // Always bind a Google login to the exact clinic host the user signed in
    // from. Never infer privileges from a generic Google account alone.
    const candidates = await queryDocuments('clinics')
    const clinic = candidates.find((item) => item.slug === slug)
    if (!clinic ||
        String(clinic.doctorEmail || '').trim().toLowerCase() !== email ||
        (clinic.doctorFirebaseUid && clinic.doctorFirebaseUid !== uid)) {
      return NextResponse.json({ error: 'حساب Google غير مرتبط بدكتور هذه العيادة' }, { status: 403 })
    }
    const token = await createSessionToken({
      role: 'doctor',
      email,
      name: String(clinic.doctorName || 'طبيب العيادة'),
      clinicId: clinic.id,
      slug,
      mustChangePassword: false,
    })
    const response = NextResponse.json({
      success: true,
      token,
      redirectUrl: `/clinic/${slug}/admin`,
      user: { role: 'doctor', name: clinic.doctorName, email, clinicId: clinic.id, slug },
      readonly: clinic.isActive === false,
    })
    response.cookies.set('clinic_session', token, {
      httpOnly: true, secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax', path: '/', maxAge: 7 * 24 * 60 * 60,
    })
    return response
  } catch (err: unknown) {
    const code = err instanceof Error ? err.message : 'GOOGLE_LOGIN_FAILED'
    const setup = code === 'FIREBASE_SETUP_REQUIRED'
    return NextResponse.json({
      error: setup
        ? 'تسجيل Google غير مهيأ على الخادم بعد'
        : 'تعذر إثبات هوية حساب Google. تأكد من تسجيل الدخول بجيميل الطبيب المرتبط بالعيادة.',
    }, { status: setup ? 503 : 401 })
  }
}
