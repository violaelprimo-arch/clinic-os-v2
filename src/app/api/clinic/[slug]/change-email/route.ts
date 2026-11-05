import { NextRequest, NextResponse } from 'next/server'
import { verifyPassword, createSessionToken } from '@/lib/auth-crypto'
import { normalizeDoctorEmail } from '@/lib/clinic-credential-policy'
import { getClinicDoctorAccount } from '@/lib/server/clinic-credential-access'
import { createDocument, writeDocument } from '@/lib/server/firebase-rest'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params
    const account = await getClinicDoctorAccount(req, slug)
    if (!account.ok) {
      return NextResponse.json({ error: account.error }, { status: account.status })
    }

    const body = await req.json().catch(() => null)
    const { newEmail, currentPassword } = body && typeof body === 'object' ? body : {}
    const email = normalizeDoctorEmail(newEmail)
    if (!email) {
      return NextResponse.json({ error: 'يرجى كتابة بريد إلكتروني صحيح' }, { status: 400 })
    }
    if (typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024) {
      return NextResponse.json({ error: 'يرجى إدخال كلمة المرور الحالية لتأكيد التغيير' }, { status: 400 })
    }

    const { clinic, clinicId } = account
    if (email === normalizeDoctorEmail(clinic.doctorEmail)) {
      return NextResponse.json({ error: 'البريد الجديد مطابق للبريد الحالي' }, { status: 400 })
    }
    const assistants = Array.isArray(clinic.assistants) ? clinic.assistants : []
    if (
      email === normalizeDoctorEmail(clinic.assistantEmail) ||
      assistants.some((assistant) =>
        assistant && typeof assistant === 'object' &&
        email === normalizeDoctorEmail((assistant as Record<string, unknown>).email),
      )
    ) {
      return NextResponse.json({ error: 'هذا البريد مستخدم لحساب مساعد داخل العيادة' }, { status: 409 })
    }

    const stored = clinic.doctorPasswordHash || clinic.doctorPassword
    if (typeof stored !== 'string' || !(await verifyPassword(currentPassword, stored))) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 })
    }

    const changedAt = new Date().toISOString()
    await writeDocument(`clinics/${clinicId}`, {
      doctorEmail: email,
      emailLastChangedAt: changedAt,
      updatedAt: changedAt,
    }, true)

    const updatedToken = await createSessionToken({
      role: 'doctor',
      email,
      name: String(clinic.doctorName || 'طبيب العيادة'),
      clinicId,
      slug,
      mustChangePassword: clinic.mustChangePassword === true,
    })

    try {
      await createDocument('audit_logs', {
        action: 'SETTINGS_UPDATED',
        actorName: String(clinic.doctorName || 'طبيب العيادة'),
        actorRole: 'doctor',
        clinicId,
        details: { field: 'doctorEmail' },
        createdAt: changedAt,
      })
    } catch {
      console.warn('Doctor email was changed, but its audit log failed')
    }

    const response = NextResponse.json({ success: true, email, message: 'تم تحديث بريد الدخول بنجاح' })
    response.cookies.set('clinic_session', updatedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return response
  } catch (error) {
    console.error('Doctor email update failed:', error instanceof Error ? error.message : 'UNKNOWN')
    const unavailable = error instanceof Error && error.message === 'FIREBASE_SERVER_NOT_CONFIGURED'
    return NextResponse.json(
      { error: unavailable ? 'خدمة تحديث الحساب غير مهيأة، تواصل مع الدعم' : 'تعذر تحديث البريد الإلكتروني، حاول مرة أخرى' },
      { status: unavailable ? 503 : 500 },
    )
  }
}
