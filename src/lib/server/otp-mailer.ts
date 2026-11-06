import 'server-only'

import { readDocument } from '@/lib/server/firebase-rest'

type OtpMail = { email: string; otp: string; doctorName?: string; clinicName?: string }

function safeHtml(value: string) {
  return value.replace(/[&<>"']/g, char => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]!)
}

export async function otpMailProviderConfigured() {
  if (process.env.RESEND_API_KEY || process.env.BREVO_API_KEY) return true
  const config = await readDocument('system/config').catch(() => null)
  return !!(config?.resendApiKey || config?.brevoApiKey)
}

export async function sendPasswordResetOtp({ email, otp, doctorName, clinicName }: OtpMail) {
  const config = await readDocument('system/config').catch(() => null)
  const resendKey = process.env.RESEND_API_KEY || String(config?.resendApiKey || '')
  const brevoKey = process.env.BREVO_API_KEY || String(config?.brevoApiKey || '')

  if (!resendKey && !brevoKey) throw new Error('EMAIL_PROVIDER_NOT_CONFIGURED')

  const name = safeHtml(doctorName || 'دكتور')
  const clinic = safeHtml(clinicName || 'يلا كلينيك')
  const code = safeHtml(otp)
  const subject = 'رمز استعادة كلمة المرور - يلا كلينيك'
  const text = `مرحباً د. ${doctorName || 'دكتور'}،\n\nرمز استعادة كلمة المرور لحساب ${clinicName || 'العيادة'} هو: ${otp}\n\nصالح لمدة 10 دقائق ومتاح للاستخدام مرة واحدة فقط. لا تشاركه مع أي شخص.\n\nYalla Clinic`
  const html = `<!doctype html><html dir="rtl" lang="ar"><head><meta charset="utf-8"></head>
    <body style="margin:0;padding:32px;background:#f0f5fc;font-family:Arial,sans-serif;color:#123">
      <main style="max-width:500px;margin:auto;background:white;border-radius:22px;overflow:hidden;border:1px solid #d6e4f3">
        <header style="padding:28px;background:linear-gradient(120deg,#0066dc,#00b6e6);color:white;text-align:center">
          <h1 style="margin:0;font-size:25px">Yalla Clinic</h1><p style="margin:10px 0 0">استعادة كلمة المرور</p>
        </header><section style="padding:30px;text-align:right;line-height:1.9">
          <p>مرحباً د. ${name}،</p><p>رمز تأكيد استعادة كلمة المرور لحساب ${clinic}:</p>
          <div style="font-size:38px;font-weight:bold;letter-spacing:8px;text-align:center;border:2px dashed #0066dc;background:#f5faff;color:#0059bd;border-radius:15px;padding:16px">${code}</div>
          <p style="font-size:13px;color:#526477">الرمز صالح لمدة 10 دقائق ولمرة واحدة فقط. لا تشاركه مع أي شخص. إذا لم تطلبه، تجاهل هذه الرسالة.</p>
        </section></main></body></html>`

  let providerError = ''
  if (resendKey) {
    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: process.env.RESEND_FROM_EMAIL || 'Yalla Clinic <notifications@yalla-clinic.com>',
          to: [email], subject, html, text,
        }),
        signal: AbortSignal.timeout(12000),
      })
      if (response.ok) {
        const result = await response.json().catch(() => ({})) as { id?: string }
        if (result.id) return { provider: 'resend', messageId: result.id }
      }
      providerError = `Resend returned HTTP ${response.status}`
    } catch { providerError = 'Resend network failure' }
  }

  if (brevoKey) {
    try {
      const response = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sender: { name: 'Yalla Clinic', email: process.env.BREVO_FROM_EMAIL || 'notifications@yalla-clinic.com' },
          to: [{ email, name: doctorName || 'Doctor' }], subject,
          htmlContent: html, textContent: text,
        }),
        signal: AbortSignal.timeout(12000),
      })
      if (response.ok) return { provider: 'brevo' }
      providerError = `Brevo returned HTTP ${response.status}`
    } catch { providerError = 'Brevo network failure' }
  }

  console.error('[otp-mailer] Provider failure:', providerError)
  throw new Error('EMAIL_DELIVERY_FAILED')
}
