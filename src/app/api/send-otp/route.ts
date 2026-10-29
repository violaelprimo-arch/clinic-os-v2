import { NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc } from 'firebase/firestore'

export async function POST(request: Request) {
  try {
    const { email, otp, doctorName, clinicName } = await request.json().catch(() => ({}))

    if (!email || !otp) {
      return NextResponse.json(
        { success: false, error: 'البريد الإلكتروني ورمز التحقق مطلوبان' },
        { status: 400 }
      )
    }

    const cleanEmail = String(email).trim().toLowerCase()
    const cleanOtp = String(otp).trim()
    const dName = doctorName || 'دكتور'
    const cName = clinicName || 'يلا كلينيك'

    // 1. Resolve Provider Keys (Cloudflare Worker secrets take precedence, then Firestore system/config)
    let resendApiKey = process.env.RESEND_API_KEY || ''
    let brevoApiKey = process.env.BREVO_API_KEY || ''

    if (!resendApiKey || !brevoApiKey) {
      try {
        const configSnap = await getDoc(doc(db, 'system', 'config'))
        if (configSnap.exists()) {
          const configData = configSnap.data()
          if (!resendApiKey && configData.resendApiKey) resendApiKey = configData.resendApiKey
          if (!brevoApiKey && configData.brevoApiKey) brevoApiKey = configData.brevoApiKey
        }
      } catch (err) {
        console.warn('Could not read system config from Firestore:', err)
      }
    }

    const emailSubject = `رمز استعادة كلمة المرور: ${cleanOtp} - منصة يلا كلينيك`

    // Plain text alternative
    const textBody = `
مرحباً د. ${dName}،

تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابكم على منصة يلا كلينيك (${cName}).

رمز التحقق (OTP) الخاص بك هو:
${cleanOtp}

⚠️ هذا الرمز صالح لمدة 10 دقائق فقط للاستخدام لمرة واحدة.
يرجى عدم مشاركة هذا الرمز مع أي شخص حفاظاً على سرية وأمان بيانات عيادتك ومرضاك.

إذا لم تكن قد طلبت استعادة كلمة المرور، يمكنك تجاهل هذه الرسالة بأمان.

فريق يلا كلينيك - Yalla Clinic
https://yalla-clinic.com
    `.trim()

    // Exquisite, modern HTML template
    const htmlBody = `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${emailSubject}</title>
</head>
<body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f0f4f9; margin: 0; padding: 24px; direction: rtl; text-align: right;">
  <div style="max-width: 540px; margin: 0 auto; background: #ffffff; border-radius: 24px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 10px 25px -5px rgba(0, 102, 220, 0.08);">
    
    <!-- Header -->
    <div style="background: linear-gradient(135deg, #0066dc 0%, #00a8e8 100%); padding: 36px 28px; text-align: center; color: #ffffff;">
      <div style="display: inline-block; background: rgba(255, 255, 255, 0.18); padding: 8px 18px; border-radius: 50px; font-size: 13px; font-weight: 800; letter-spacing: 0.5px; margin-bottom: 12px; border: 1px solid rgba(255, 255, 255, 0.25);">
        منظومة يلا كلينيك الطبية
      </div>
      <h1 style="margin: 0; font-size: 24px; font-weight: 900; line-height: 1.3;">استعادة كلمة المرور</h1>
      <p style="margin: 8px 0 0 0; opacity: 0.92; font-size: 14px; font-weight: 500;">${cName}</p>
    </div>

    <!-- Content -->
    <div style="padding: 36px 28px; color: #1e293b;">
      <p style="font-size: 16px; font-weight: 800; margin: 0 0 12px 0; color: #0f172a;">
        مرحباً د. ${dName}،
      </p>
      <p style="font-size: 14px; color: #475569; line-height: 1.7; margin: 0 0 24px 0;">
        تلقينا طلباً لإعادة تعيين كلمة المرور الخاصة بحسابكم على منصة إدارة العيادات. استخدم رمز التحقق (OTP) أدناه لإتمام تعيين كلمة المرور الجديدة:
      </p>

      <!-- OTP Box -->
      <div style="background: #f8fbff; border: 2px dashed #0066dc; border-radius: 20px; padding: 24px; text-align: center; margin: 24px 0;">
        <span style="display: block; font-size: 12px; font-weight: 700; color: #0066dc; margin-bottom: 8px; text-transform: uppercase; letter-spacing: 1px;">
          رمز التحقق السريع
        </span>
        <div style="font-family: 'Courier New', Courier, monospace; font-size: 40px; font-weight: 900; letter-spacing: 10px; color: #0052b3; padding: 6px 0;">
          ${cleanOtp}
        </div>
        <span style="display: block; font-size: 12px; font-weight: 600; color: #64748b; margin-top: 6px;">
          ⏱️ الرمز صالح لمدة 10 دقائق فقط
        </span>
      </div>

      <!-- Security Notice -->
      <div style="background: #fffbeb; border: 1px solid #fef3c7; border-radius: 14px; padding: 14px 18px; margin: 24px 0; font-size: 12.5px; color: #92400e; line-height: 1.6;">
        🔒 <strong>تنبيه أمني هام:</strong> لا تشارك هذا الرمز مع أي شخص، بما في ذلك فريق الدعم الفني. الرمز صالح لمرة واحدة فقط لضمان سرية حسابك وسجلات مرضاك.
      </div>

      <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin: 0;">
        إذا لم تقم بطلب استعادة كلمة المرور بنفسك، يمكنك تجاهل هذا البريد الإلكتروني بأمان وستظل كلمة المرور الحالية دون تغيير.
      </p>
    </div>

    <!-- Footer -->
    <div style="padding: 20px 28px; background: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #64748b; line-height: 1.5;">
      منصة يلا كلينيك — المنظومة السحابية المعتمدة لإدارة العيادات والمراكز الطبية<br>
      <a href="https://yalla-clinic.com" style="color: #0066dc; text-decoration: none; font-weight: 700; margin-top: 4px; display: inline-block;">yalla-clinic.com</a>
    </div>

  </div>
</body>
</html>
    `.trim()

    let lastError = ''

    // 2. Attempt Delivery via Resend API
    if (resendApiKey) {
      const senders = [
        'Yalla Clinic <notifications@yalla-clinic.com>',
        'Yalla Clinic <auth@yalla-clinic.com>',
        'Yalla Clinic <onboarding@resend.dev>'
      ]

      for (const fromSender of senders) {
        try {
          const resendRes = await fetch('https://api.resend.com/emails', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${resendApiKey}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              from: fromSender,
              to: [cleanEmail],
              subject: emailSubject,
              html: htmlBody,
              text: textBody
            })
          })

          const data = await resendRes.json().catch(() => ({}))
          if (resendRes.ok && data?.id) {
            console.log(`[send-otp] Successfully delivered OTP email to ${cleanEmail} via Resend (${fromSender}, ID: ${data.id})`)
            return NextResponse.json({
              success: true,
              provider: 'resend',
              messageId: data.id,
              message: 'تم إرسال رمز التحقق (OTP) بنجاح إلى بريدك الإلكتروني على Gmail.'
            })
          }

          lastError = data?.message || resendRes.statusText || 'Resend delivery failed'
          console.warn(`[send-otp] Resend attempt with sender ${fromSender} failed:`, lastError)
          // If domain verification failed, continue loop to try fallback sender
        } catch (err: any) {
          lastError = err?.message || 'Network error invoking Resend API'
          console.error('[send-otp] Resend fetch exception:', err)
        }
      }
    }

    // 3. Attempt Delivery via Brevo API
    if (brevoApiKey) {
      try {
        const brevoRes = await fetch('https://api.brevo.com/v3/smtp/email', {
          method: 'POST',
          headers: {
            'api-key': brevoApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            sender: { name: 'Yalla Clinic', email: 'notifications@yalla-clinic.com' },
            to: [{ email: cleanEmail, name: dName }],
            subject: emailSubject,
            htmlContent: htmlBody,
            textContent: textBody
          })
        })

        const data = await brevoRes.json().catch(() => ({}))
        if (brevoRes.ok) {
          console.log(`[send-otp] Successfully delivered OTP email to ${cleanEmail} via Brevo`)
          return NextResponse.json({
            success: true,
            provider: 'brevo',
            message: 'تم إرسال رمز التحقق (OTP) بنجاح إلى بريدك الإلكتروني.'
          })
        }

        lastError = data?.message || brevoRes.statusText || 'Brevo delivery failed'
        console.warn('[send-otp] Brevo delivery failed:', lastError)
      } catch (err: any) {
        lastError = err?.message || 'Network error invoking Brevo API'
        console.error('[send-otp] Brevo fetch exception:', err)
      }
    }

    // 4. If neither provider was configured or both failed, RETURN TRUTHFUL ERROR (NO FALSE SUCCESS)
    const failureReason = !resendApiKey && !brevoApiKey
      ? 'لم يتم تهيئة مفتاح إرسال البريد (Resend API Key) في إعدادات المنصة. يرجى إدخال المفتاح في لوحة المالك أو مراجعة الدعم.'
      : `فشل مزود خدمة البريد في إرسال الرسالة إلى Gmail (${lastError || 'خطأ غير معروف'}). يرجى مراجعة صلاحية مفتاح الـ API والنطاق.`

    console.error('[send-otp] Failed to deliver OTP to:', cleanEmail, 'Reason:', failureReason)

    return NextResponse.json(
      {
        success: false,
        error: failureReason,
        code: 'EMAIL_DELIVERY_FAILED'
      },
      { status: 502 }
    )
  } catch (err: any) {
    console.error('[send-otp] Unhandled exception:', err)
    return NextResponse.json(
      { success: false, error: 'حدث خطأ في خادم إرسال البريد: ' + (err?.message || 'غير معروف') },
      { status: 500 }
    )
  }
}
