'use client'

import { useEffect, useState } from 'react'
import { GoogleAuthProvider, signInWithPopup } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'

/**
 * Google authorization takes place ONLY on the platform origin, which is
 * registered with Firebase. No arbitrary clinic subdomains need to be
 * registered as Firebase authorized OAuth domains.
 *
 * The OAuth credential NEVER crosses the window.postMessage boundary.
 * The authenticated platform API writes the signed, httpOnly,
 * .yalla-clinic.com clinic_session cookie first. We send only completion
 * status to the already-open clinic login page.
 */
export default function ClinicGoogleBridge() {
  const [state, setState] = useState<'ready' | 'working' | 'success' | 'error'>('ready')
  const [message, setMessage] = useState('')

  useEffect(() => {
    if (!window.opener || window.opener.closed) {
      setState('error')
      setMessage('افتح تسجيل الدخول من صفحة العيادة أولاً.')
      return
    }
    const current = new URL(window.location.href)
    const slug = current.searchParams.get('clinic') || ''
    const rawOrigin = current.searchParams.get('origin') || ''
    const nonce = current.searchParams.get('state') || ''
    if (!/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug) ||
        !/^[0-9a-f-]{36}$/.test(nonce)) {
      setState('error')
      setMessage('طلب تسجيل دخول العيادة غير صالح.')
      return
    }
    try {
      const target = new URL(rawOrigin)
      const host = target.hostname.toLowerCase()
      const allowed = target.protocol === 'https:' &&
        (host === 'yalla-clinic.com' || host === `${slug}.yalla-clinic.com` ||
          host === 'yalaa-clinic.com' || host === `${slug}.yalaa-clinic.com`)
      const local = target.protocol === 'http:' &&
        (host === 'localhost' || host === `${slug}.localhost` || host === '127.0.0.1')
      if ((!allowed && !local) || target.pathname !== '/' ||
          target.search || target.hash) throw new Error('BAD_ORIGIN')
    } catch {
      setState('error')
      setMessage('مصدر طلب تسجيل الدخول غير معتمد.')
    }
  }, [])

  const start = async () => {
    if (state === 'working') return
    const params = new URL(window.location.href).searchParams
    const slug = params.get('clinic') || ''
    const origin = params.get('origin') || ''
    const nonce = params.get('state') || ''
    if (!window.opener || window.opener.closed ||
        !/^[a-z0-9][a-z0-9-]{0,62}$/.test(slug) ||
        !/^[0-9a-f-]{36}$/.test(nonce)) {
      setState('error')
      setMessage('افتح هذه النافذة من عيادتك مرة أخرى.')
      return
    }
    const originUrl = (() => { try { return new URL(origin) } catch { return null } })()
    const host = originUrl?.hostname.toLowerCase() || ''
    const authorized = originUrl &&
      ((originUrl.protocol === 'https:' &&
        (host === 'yalla-clinic.com' || host === `${slug}.yalla-clinic.com` ||
         host === 'yalaa-clinic.com' || host === `${slug}.yalaa-clinic.com`)) ||
       (originUrl.protocol === 'http:' && ['localhost', `${slug}.localhost`, '127.0.0.1'].includes(host))) &&
      originUrl.pathname === '/' && !originUrl.search && !originUrl.hash
    if (!authorized) {
      setState('error')
      setMessage('عنوان العيادة غير معتمد.')
      return
    }
    setState('working')
    setMessage('')
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken(true)
      const res = await fetch('/api/auth/google-clinic-login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idToken, slug }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success || data.user?.slug !== slug) {
        throw new Error(data.error || 'حساب Google لا يتبع هذه العيادة.')
      }
      window.opener.postMessage({
        type: 'YALLA_CLINIC_GOOGLE_COMPLETED',
        state: nonce, slug,
      }, origin)
      setState('success')
      setMessage('تم التحقق من الحساب. ارجع إلى نافذة العيادة.')
      window.setTimeout(() => window.close(), 500)
    } catch (err: unknown) {
      const reason = err instanceof Error ? err.message : 'GOOGLE_LOGIN_FAILED'
      setState('error')
      setMessage(reason.includes('popup-closed') || reason.includes('popup-blocked')
        ? 'تم إغلاق نافذة Google أو منعها. اسمح بالنوافذ المنبثقة وحاول مرة أخرى.'
        : reason)
      // Never send a Firebase token or personally identifying account data to another origin.
    }
  }

  return (
    <div dir="rtl" className="min-h-screen flex items-center justify-center p-6 bg-background text-foreground">
      <div className="w-full max-w-sm text-center border border-border rounded-3xl p-8 bg-card shadow-2xl space-y-6">
        <div className="flex justify-center"><ClinicLogo variant="auto" size="lg" /></div>
        <h1 className="text-xl font-black">تسجيل الدخول إلى عيادتك باستخدام Google</h1>
        <p className="text-sm text-muted-foreground">
          استخدم حساب Google المرتبط بالعيادة. صفحة العيادة الأصلية ستظل مفتوحة.
        </p>
        {message && <p className={`text-sm font-bold ${state === 'success' ? 'text-emerald-600' : 'text-rose-600'}`}
          role="status">{message}</p>}
        {state !== 'success' && (
          <button
            type="button" onClick={() => void start()}
            disabled={state === 'working'}
            className="w-full h-11 rounded-xl yalla-gradient-btn text-white font-bold disabled:opacity-60"
          >
            {state === 'working' ? 'جاري التحقق من حساب Google...' : 'المتابعة باستخدام Google'}
          </button>
        )}
        <button type="button" onClick={() => window.close()}
          className="text-xs text-muted-foreground hover:text-foreground underline">
          إغلاق النافذة والعودة إلى العيادة
        </button>
      </div>
    </div>
  )
}
