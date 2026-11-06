import { NextRequest, NextResponse } from 'next/server'
import { hashPassword, verifyPassword } from '@/lib/auth-crypto'
import { createDocument, findDocumentsByField, writeDocument } from '@/lib/server/firebase-rest'
import { otpMailProviderConfigured, sendPasswordResetOtp } from '@/lib/server/otp-mailer'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { action, email, slug, otp, newPassword } = body

    if (!slug) {
      return NextResponse.json({ error: 'معرف العيادة مطلوب' }, { status: 400 })
    }

    const clinics = await findDocumentsByField('clinics', 'slug', String(slug))
    if (clinics.length !== 1) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }
    const clinic = clinics[0]
    const clinicId = String(clinic.id)

    // ACTION 1: Request OTP
    if (action === 'request') {
      if (!email) {
        return NextResponse.json({ error: 'البريد الإلكتروني مطلوب' }, { status: 400 })
      }

      const cleanInputEmail = String(email).trim().toLowerCase()
      const registeredEmail = String(clinic.doctorEmail || '').trim().toLowerCase()

      // If email does not match registered email, do not disclose details
      if (!registeredEmail || cleanInputEmail !== registeredEmail) {
        return NextResponse.json({
          success: true,
          message: 'إذا كان البريد الإلكتروني مسجلاً في سجلات العيادة، فسيصلك رمز التحقق خلال لحظات.'
        })
      }

      if (!(await otpMailProviderConfigured())) {
        return NextResponse.json({
          error: 'خدمة إرسال رموز التحقق غير مُفعّلة. تواصل مع إدارة المنصة لتفعيل خدمة البريد.',
          code: 'EMAIL_PROVIDER_NOT_CONFIGURED',
        }, { status: 503 })
      }

      // 60-Second Cooldown between OTP requests
      const lastRequestedAt = clinic.resetPasswordRequestedAt ? new Date(String(clinic.resetPasswordRequestedAt)).getTime() : 0
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
      await writeDocument(`clinics/${clinicId}`, {
        resetPasswordOtpHashed: hashedOtp,
        resetPasswordOtp: null, // Clear legacy plaintext
        resetPasswordExpiresAt: expiresAt,
        resetPasswordAttempts: 0,
        resetPasswordRequestedAt: new Date().toISOString()
      }, true)

      // Send OTP via email delivery engine
      try {
        await sendPasswordResetOtp({
          email: cleanInputEmail,
          otp: generatedOtp,
          doctorName: String(clinic.doctorName || ''),
          clinicName: String(clinic.clinicName || ''),
        })
      } catch (err) {
        // A failed email must not leave a seemingly valid reset challenge.
        await writeDocument(`clinics/${clinicId}`, {
          resetPasswordOtpHashed: null,
          resetPasswordExpiresAt: null,
          resetPasswordRequestedAt: null,
          resetPasswordAttempts: null,
        }, true).catch(() => {})
        console.error('[reset-password] OTP email delivery failed:', err instanceof Error ? err.message : 'UNKNOWN')
        return NextResponse.json(
          { error: 'تعذر إرسال رمز التحقق. راجع إعدادات مزود البريد وصلاحية الدومين مع الدعم الفني.', code: 'EMAIL_DELIVERY_FAILED' },
          { status: 502 }
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
      const registeredEmail = String(clinic.doctorEmail || '').trim().toLowerCase()

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

      const isOtpValid = await verifyPassword(String(otp).trim(), String(storedOtpHash))

      // Increment failed attempts on mismatch
      if (!isOtpValid) {
        await writeDocument(`clinics/${clinicId}`, {
          resetPasswordAttempts: attempts + 1
        }, true)
        const remainingAttempts = Math.max(0, 4 - attempts)
        return NextResponse.json(
          { error: `رمز التحقق (OTP) غير صحيح. متبقي لديك ${remainingAttempts} محاولات.` },
          { status: 400 }
        )
      }

      // Update password securely and revoke OTP (Single-Use consumption)
      const newPasswordHash = await hashPassword(String(newPassword))

      await writeDocument(`clinics/${clinicId}`, {
        doctorPasswordHash: newPasswordHash,
        doctorPassword: null, // Wipe any plaintext password
        mustChangePassword: false, // Validated doctor is changing their own password
        resetPasswordOtpHashed: null,
        resetPasswordOtp: null,
        resetPasswordExpiresAt: null,
        resetPasswordAttempts: null,
        resetPasswordRequestedAt: null,
        passwordLastChangedAt: new Date().toISOString()
      }, true)

      await createDocument('audit_logs', {
        action: 'PASSWORD_RESET', actorName: String(clinic.doctorName || 'طبيب العيادة'),
        actorRole: 'doctor', clinicId, details: { email: cleanInputEmail, method: 'OTP_EMAIL' },
        createdAt: new Date().toISOString(),
      }).catch(() => {})

      return NextResponse.json({
        success: true,
        message: 'تم تعيين كلمة المرور الجديدة بنجاح! يمكنك الآن تسجيل الدخول بها.'
      })
    }

    return NextResponse.json({ error: 'إجراء غير معروف' }, { status: 400 })
  } catch (error: any) {
    console.error('Password reset API error:', error instanceof Error ? error.message : 'UNKNOWN')
    return NextResponse.json(
      { error: 'تعذر الاتصال بخدمة الحسابات. حاول مرة أخرى أو تواصل مع الدعم الفني.' },
      { status: 500 }
    )
  }
}
