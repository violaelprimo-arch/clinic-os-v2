import 'server-only'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'
import { isCurrentClinicDoctor } from '@/lib/clinic-credential-policy'
import { readDocument } from '@/lib/server/firebase-rest'

type DoctorAccount = {
  ok: true
  clinicId: string
  clinic: Record<string, unknown>
}
type Denied = { ok: false; status: number; error: string }

/**
 * Doctor login is presently a clinic_session cookie, not Firebase Client Auth.
 * Authenticate and bind the session to this exact clinic before using the
 * privileged Firestore service-account REST helper.
 */
export async function getClinicDoctorAccount(
  req: NextRequest,
  slug: string,
): Promise<DoctorAccount | Denied> {
  const origin = req.headers.get('origin')
  if (origin && origin !== req.nextUrl.origin) {
    return { ok: false, status: 403, error: 'طلب غير مصرح به' }
  }

  const token = req.cookies.get('clinic_session')?.value
  if (!token) {
    return { ok: false, status: 401, error: 'يرجى تسجيل الدخول إلى حساب الطبيب' }
  }
  const session = await verifySessionToken(token)
  if (!session.valid || !session.payload) {
    if (session.error === 'CLINIC_SESSION_SECRET_REQUIRED') {
      return { ok: false, status: 503, error: 'خدمة دخول العيادة غير مهيأة بأمان، تواصل مع الدعم' }
    }
    return { ok: false, status: 401, error: 'انتهت جلسة الدخول، يرجى تسجيل الدخول مجددًا' }
  }
  const clinicId = session.payload.clinicId
  if (
    session.payload.role !== 'doctor' ||
    session.payload.slug !== slug ||
    typeof clinicId !== 'string' ||
    !clinicId || clinicId.includes('/')
  ) {
    return { ok: false, status: 403, error: 'لا تملك صلاحية تعديل حساب هذه العيادة' }
  }

  const clinic = await readDocument(`clinics/${clinicId}`)
  if (!clinic) {
    return { ok: false, status: 404, error: 'العيادة غير موجودة' }
  }
  if (!isCurrentClinicDoctor(session.payload, clinic, clinicId, slug)) {
    return { ok: false, status: 401, error: 'تغيرت بيانات الدخول، يرجى تسجيل الدخول مجددًا' }
  }
  return { ok: true, clinicId, clinic }
}
