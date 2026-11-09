import { NextRequest, NextResponse } from 'next/server'
import { createSessionToken } from '@/lib/auth-crypto'
import { queryDocumentsByField } from '@/lib/server/firebase-rest'
import { verifyClinicGoogleIdToken } from '@/lib/server/firebase-clinic-auth'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const requestedSlug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (requestedSlug && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(requestedSlug)) {
      return NextResponse.json({ error: 'رابط العيادة غير صحيح' }, { status: 400 })
    }
    const { uid, email } = await verifyClinicGoogleIdToken(body.idToken)
    // A verified Google account is not enough: only the explicitly assigned
    // doctor email (and Firebase UID if pinned) may enter a tenant.
    const candidates = await queryDocumentsByField('clinics', 'doctorEmail', email)
    const matching = candidates.filter((item) =>
      String(item.doctorEmail || '').trim().toLowerCase() === email &&
      (!item.doctorFirebaseUid || item.doctorFirebaseUid === uid) &&
      (!requestedSlug || item.slug === requestedSlug)
    )
    if (matching.length > 1) {
      return NextResponse.json({
        error: 'هذا البريد مرتبط بأكثر من عيادة. افتح رابط العيادة المطلوبة وسجل الدخول منه.'
      }, { status: 409 })
    }
    const clinic = matching[0]
    if (!clinic) {
      return NextResponse.json({ error: 'حساب Google غير مرتبط بدكتور هذه العيادة' }, { status: 403 })
    }
    const slug = String(clinic.slug || requestedSlug)
    const token = await createSessionToken({
      role: 'doctor',
      email,
      name: String(clinic.doctorName || 'طبيب العيادة'),
      clinicId: clinic.id,
      slug,
      mustChangePassword: false,
      username: String(clinic.doctorUsername || ''),
      credentialsVersion: Number(clinic.credentialsVersion || 0),
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
      domain: process.env.NODE_ENV === 'production' ? '.yalla-clinic.com' : undefined,
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
