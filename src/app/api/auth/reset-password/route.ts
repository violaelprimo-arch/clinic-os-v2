import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { hashPassword, verifyPassword, createSessionToken } from '@/lib/auth-crypto'
import { recordAuditLog } from '@/lib/audit-logger'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, email, slug, otp, newPassword, resetToken } = body

    if (!slug) {
      return NextResponse.json({ error: 'معرف العيادة مطلوب' }, { status: 400 })
    }

    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const snap = await getDocs(q)
    if (snap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const cDoc = snap.docs[0]
    const clinic = cDoc.data()
    const clinicId = cDoc.id

    // ACTION 1: Request OTP
    if (action === 'request') {
      if (!email) {
        return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 })
      }

      const cleanInputEmail = String(email).trim().toLowerCase()
      const registeredEmail = (clinic.doctorEmail || '').trim().toLowerCase()

      // If email does not match registered email, do not disclose details
      if (!registeredEmail || cleanInputEmail !== registeredEmail) {
        return NextResponse.json({
          success: true,
          message: 'إذا كان البريد الإلكتروني مسجلاً في سجلات العيادة، فسيصلك رمز التحقق خلال لحظات.'
        })
      }

      // 60-Second Cooldown between OTP requests
      const lastRequestedAt = clinic.resetPasswordRequestedAt ? new Date(clinic.resetPasswordRequestedAt).getTime() : 0
      const cooldownRemaining = Math.ceil((lastRequestedAt + 60000 - Date.now()) / 1000)
      if (cooldownRemaining > 0) {
        return NextResponse.json(
          { error: `يرجى الانتظار ${cooldownRemaining} ثانية قبل طلب رمز جديد.` },
          { status: 429 }
        )
      }

      // Generate cryptographically secure 6-digit numeric OTP (no Math.random)
      const randomValues = new Uint32Array(1)
      crypto.getRandomValues(randomValues)
      const generatedOtp = (100000 + (randomValues[0] % 900000)).toString()

      // Hash OTP before storage in Firestore (HMAC/SHA-256)
      const hashedOtp = await hashPassword(generatedOtp)
      const expiresAt = Date.now() + 10 * 60 * 1000 // 10 minutes validity

      // Update Firestore document with new hashed OTP, resetting attempts
      await updateDoc(doc(db, 'clinics', clinicId), {
        resetPasswordOtpHashed: hashedOtp,
        resetPasswordOtp: null, // Clear legacy plaintext
        resetPasswordExpiresAt: expiresAt,
        resetPasswordAttempts: 0,
        resetPasswordRequestedAt: new Date().toISOString()
      })

      // Send OTP via email delivery engine
      try {
        const url = new URL('/api/send-otp', req.url)
        const sendOtpRes = await fetch(url.toString(), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanInputEmail,
            otp: generatedOtp,
            doctorName: clinic.doctorName,
            clinicName: clinic.clinicName
          })
        })

        const sendData = await sendOtpRes.json().catch(() => ({}))
        if (!sendOtpRes.ok || sendData.success === false) {
          console.error('[reset-password] send-otp returned error:', sendData)
          return NextResponse.json(
            {
              success: false,
              error: sendData.error || 'تعذر إرسال رمز التحقق إلى بريدك الإلكتروني عبر مزود الخدمة.',
              code: sendData.code || 'DELIVERY_FAILED'
            },
            { status: 502 }
          )
        }
      } catch (err: any) {
        console.error('[reset-password] Error invoking send-otp:', err)
        return NextResponse.json(
          { error: 'تعذر الاتصال بخدمة إرسال البريد: ' + (err?.message || 'خطأ غير معروف') },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        message: 'تم إرسال رمز التحقق (OTP) المكون من 6 أرقام إلى بريدك الإلكتروني على Gmail بنجاح.'
      })
    }

    // ACTION 2: Verify OTP and Reset Password
    if (action === 'verify-and-reset') {
      if (!email || !otp || !newPassword) {
        return NextResponse.json(
          { error: 'يرجى إدخال البريد الإلكتروني ورمز التحقق وكلمة المرور الجديدة' },
          { status: 400 }
        )
      }

      if (String(newPassword).length < 6) {
        return NextResponse.json(
          { error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 أحرف أو أرقام' },
          { status: 400 }
        )
      }

      const cleanInputEmail = String(email).trim().toLowerCase()
      const registeredEmail = (clinic.doctorEmail || '').trim().toLowerCase()

      if (cleanInputEmail !== registeredEmail) {
        return NextResponse.json(
          { error: 'البريد الإلكتروني غير مطابق لسجلات العيادة' },
          { status: 400 }
        )
      }

      const attempts = Number(clinic.resetPasswordAttempts) || 0
      if (attempts >= 5) {
        return NextResponse.json(
          { error: 'تم استنفاذ عدد المحاولات المسموح بها (5 محاولات). يرجى طلب رمز جديد.' },
          { status: 429 }
        )
      }

      const expiresAt = Number(clinic.resetPasswordExpiresAt) || 0
      if (!expiresAt || Date.now() > expiresAt) {
        return NextResponse.json(
          { error: 'رمز التحقق (OTP) منتهي الصلاحية (صلاحيته 10 دقائق). يرجى طلب رمز جديد.' },
          { status: 400 }
        )
      }

      // Check OTP against stored hash (or legacy plaintext fallback)
      const storedOtpHash = clinic.resetPasswordOtpHashed || clinic.resetPasswordOtp
      if (!storedOtpHash) {
        return NextResponse.json(
          { error: 'لم يتم العثور على طلب استعادة نشط. يرجى طلب رمز جديد.' },
          { status: 400 }
        )
      }

      const isOtpValid = await verifyPassword(String(otp).trim(), storedOtpHash)

      // Increment failed attempts on mismatch
      if (!isOtpValid) {
        await updateDoc(doc(db, 'clinics', clinicId), {
          resetPasswordAttempts: attempts + 1
        })
        const remainingAttempts = Math.max(0, 4 - attempts)
        return NextResponse.json(
          { error: `رمز التحقق (OTP) غير صحيح. متبقي لديك ${remainingAttempts} محاولات.` },
          { status: 400 }
        )
      }

      // Update password securely and revoke OTP (Single-Use consumption)
      const newPasswordHash = await hashPassword(String(newPassword))

      await updateDoc(doc(db, 'clinics', clinicId), {
        doctorPasswordHash: newPasswordHash,
        doctorPassword: null, // Wipe any plaintext password
        mustChangePassword: false, // Validated doctor is changing their own password
        resetPasswordOtpHashed: null,
        resetPasswordOtp: null,
        resetPasswordExpiresAt: null,
        resetPasswordAttempts: null,
        resetPasswordRequestedAt: null,
        passwordLastChangedAt: new Date().toISOString()
      })

      await recordAuditLog({
        action: 'PASSWORD_RESET',
        actorName: clinic.doctorName || 'طبيب العيادة',
        actorRole: 'doctor',
        clinicId,
        details: { email: cleanInputEmail, method: 'OTP_GMAIL' }
      })

      return NextResponse.json({
        success: true,
        message: 'تم تعيين كلمة المرور الجديدة بنجاح! يمكنك الآن تسجيل الدخول بها.'
      })
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: any) {
    console.error('Password reset API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء معالجة الطلب' },
      { status: 500 }
    )
  }
}
