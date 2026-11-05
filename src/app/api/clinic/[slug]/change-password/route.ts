import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, verifyPassword, createSessionToken } from '@/lib/auth-crypto'
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
    const { currentPassword, newPassword } = body && typeof body === 'object' ? body : {}
    if (
      typeof currentPassword !== 'string' || !currentPassword || currentPassword.length > 1024 ||
      typeof newPassword !== 'string' || newPassword.length < 6 || newPassword.length > 1024
    ) {
      return NextResponse.json(
        { error: 'أدخل كلمة المرور الحالية وكلمة مرور جديدة لا تقل عن 6 خانات' },
        { status: 400 },
      )
    }
    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'كلمة المرور الجديدة يجب أن تختلف عن الحالية' },
        { status: 400 },
      )
    }

    const { clinic, clinicId } = account
    const stored = clinic.doctorPasswordHash || clinic.doctorPassword
    if (typeof stored !== 'string' || !(await verifyPassword(currentPassword, stored))) {
      return NextResponse.json({ error: 'كلمة المرور الحالية غير صحيحة' }, { status: 401 })
    }

    const changedAt = new Date().toISOString()
    const updatedHash = await hashPassword(newPassword)
    await writeDocument(`clinics/${clinicId}`, {
      doctorPasswordHash: updatedHash,
      doctorPassword: null,
      mustChangePassword: false,
      passwordLastChangedAt: changedAt,
      updatedAt: changedAt,
    }, true)

    const updatedToken = await createSessionToken({
      role: 'doctor',
      email: String(clinic.doctorEmail),
      name: String(clinic.doctorName || 'طبيب العيادة'),
      clinicId,
      slug,
      mustChangePassword: false,
    })

    // Audit must not turn a completed password update into a failed response.
    try {
      await createDocument('audit_logs', {
        action: 'PASSWORD_RESET',
        actorName: String(clinic.doctorName || 'طبيب العيادة'),
        actorRole: 'doctor',
        clinicId,
        details: { email: String(clinic.doctorEmail) },
        createdAt: changedAt,
      })
    } catch {
      console.warn('Doctor password was changed, but its audit log failed')
    }

    const response = NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور بنجاح' })
    response.cookies.set('clinic_session', updatedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    })
    return response
  } catch (error) {
    console.error('Doctor password update failed:', error instanceof Error ? error.message : 'UNKNOWN')
    const unavailable = error instanceof Error && error.message === 'FIREBASE_SERVER_NOT_CONFIGURED'
    return NextResponse.json(
      { error: unavailable ? 'خدمة تحديث الحساب غير مهيأة، تواصل مع الدعم' : 'تعذر تحديث كلمة المرور، حاول مرة أخرى' },
      { status: unavailable ? 503 : 500 },
    )
  }
}
