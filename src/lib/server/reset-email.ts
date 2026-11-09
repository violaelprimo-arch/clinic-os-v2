import 'server-only'

export async function sendPasswordResetOtp(email: string, otp: string) {
  // Only called after the reset service resolved the clinic's registered email.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^\d{6}$/.test(otp)) throw new Error('INVALID_RESET_EMAIL')
  const text = `رمز استعادة كلمة المرور في Yalla Clinic: ${otp}\nصالح لمدة 10 دقائق ولمرة واحدة. لا تشاركه مع أي شخص.\nإذا لم تطلب التغيير فتجاهل الرسالة.\nhttps://yalla-clinic.com`
  const subject = 'Yalla Clinic — رمز استعادة كلمة المرور'
  const resend = process.env.RESEND_API_KEY
  const brevo = process.env.BREVO_API_KEY
  if (resend) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST', headers: { Authorization: `Bearer ${resend}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM_EMAIL || 'Yalla Clinic <notifications@yalla-clinic.com>', to: [email], subject, text }),
      signal: AbortSignal.timeout(12000),
    })
    if (response.ok) return
  }
  if (brevo) {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST', headers: { 'api-key': brevo, 'Content-Type': 'application/json' },
      body: JSON.stringify({ sender: { name: 'Yalla Clinic', email: 'notifications@yalla-clinic.com' },
        to: [{ email }], subject, textContent: text }), signal: AbortSignal.timeout(12000),
    })
    if (response.ok) return
  }
  throw new Error('RESET_EMAIL_DELIVERY_UNAVAILABLE')
}
