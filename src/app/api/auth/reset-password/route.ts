import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, verifyPassword } from '@/lib/auth-crypto'
import { queryDocumentsByField, readDocument, writeDocument, acquireFirestoreLease, releaseFirestoreLease } from '@/lib/server/firebase-rest'
import { assertSameOrigin } from '@/lib/server/owner-access'
import { sendPasswordResetOtp } from '@/lib/server/reset-email'

const genericMessage = 'إذا كان الحساب له بريد مسجل، فسيصلك رمز التحقق خلال لحظات.'
export async function POST(req: NextRequest) {
  let lockedClinic = '', runId = ''
  try {
    assertSameOrigin(req)
    const body = await req.json().catch(() => ({}))
    const { action, otp, newPassword } = body
    const identifier = String(body.email || body.identifier || '').trim().toLowerCase()
    const slug = typeof body.slug === 'string' ? body.slug.trim().toLowerCase() : ''
    if (!['request', 'verify-and-reset'].includes(action) || !identifier || identifier.length > 254 ||
        (slug && !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug))) {
      return NextResponse.json({ error: 'بيانات الطلب غير صالحة' }, { status: 400 })
    }
    const clinics = await queryDocumentsByField('clinics',
      slug ? 'slug' : identifier.includes('@') ? 'doctorEmail' : 'doctorUsername', slug || identifier)
    const found = clinics.length === 1 ? clinics[0] : null
    if (!found || ![found.doctorEmail, found.doctorUsername].some(v => typeof v === 'string' && v.trim().toLowerCase() === identifier)) {
      return action === 'request' ? NextResponse.json({ success: true, message: genericMessage })
        : NextResponse.json({ error: 'بيانات التحقق غير صحيحة أو منتهية' }, { status: 400 })
    }
    const clinicId = String(found.id)
    runId = crypto.randomUUID()
    const lease = await acquireFirestoreLease(`auth_reset_locks/${clinicId}`, runId, 'password-reset', 60000)
    if (!lease.acquired) return NextResponse.json({ error: 'يوجد طلب قيد التنفيذ. انتظر قليلًا.' }, { status: 429 })
    lockedClinic = clinicId
    const clinic = (await readDocument(`clinics/${clinicId}`)) as Record<string, any>
    const email = typeof clinic.doctorEmail === 'string' ? clinic.doctorEmail.trim().toLowerCase() : ''
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'هذا الحساب ليس له بريد استرجاع. تواصل مع مالك المنصة.' }, { status: 400 })
    }
    if (action === 'request') {
      if (Date.now() - Date.parse(clinic.resetPasswordRequestedAt || '') < 60000) {
        return NextResponse.json({ error: 'انتظر دقيقة قبل طلب رمز جديد.' }, { status: 429 })
      }
      const random = crypto.getRandomValues(new Uint32Array(1))[0]
      const generated = String(100000 + random % 900000)
      await writeDocument(`clinics/${clinicId}`, {
        resetPasswordOtpHashed: await hashPassword(generated), resetPasswordOtp: null,
        resetPasswordExpiresAt: Date.now() + 10 * 60000, resetPasswordAttempts: 0,
        resetPasswordRequestedAt: new Date().toISOString(),
      }, true)
      await sendPasswordResetOtp(email, generated)
      return NextResponse.json({ success: true, message: genericMessage })
    }
    if (typeof otp !== 'string' || !/^\d{6}$/.test(otp) || typeof newPassword !== 'string' ||
        newPassword.length < 6 || newPassword.length > 1024) {
      return NextResponse.json({ error: 'أدخل رمزًا من 6 أرقام وكلمة مرور لا تقل عن 6 خانات.' }, { status: 400 })
    }
    const attempts = Number(clinic.resetPasswordAttempts || 0)
    if (attempts >= 5 || Date.now() > Number(clinic.resetPasswordExpiresAt || 0) || !clinic.resetPasswordOtpHashed) {
      return NextResponse.json({ error: 'انتهت صلاحية الرمز أو عدد المحاولات. اطلب رمزًا جديدًا.' }, { status: 400 })
    }
    if (!await verifyPassword(otp, String(clinic.resetPasswordOtpHashed))) {
      await writeDocument(`clinics/${clinicId}`, { resetPasswordAttempts: attempts + 1 }, true)
      return NextResponse.json({ error: 'رمز التحقق غير صحيح.' }, { status: 400 })
    }
    await writeDocument(`clinics/${clinicId}`, {
      doctorPasswordHash: await hashPassword(newPassword), doctorPassword: null,
      credentialsVersion: Date.now(), mustChangePassword: false,
      passwordLastChangedAt: new Date().toISOString(), resetPasswordOtpHashed: null,
      resetPasswordOtp: null, resetPasswordExpiresAt: null, resetPasswordAttempts: null,
    }, true)
    return NextResponse.json({ success: true, message: 'تم تغيير كلمة المرور. سجل الدخول من جديد.' })
  } catch {
    return NextResponse.json({ error: 'تعذر إتمام استعادة الحساب مؤقتًا. حاول لاحقًا.' }, { status: 503 })
  } finally {
    if (lockedClinic) await releaseFirestoreLease(`auth_reset_locks/${lockedClinic}`, runId).catch(() => {})
  }
}
