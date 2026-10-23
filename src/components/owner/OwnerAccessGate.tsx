'use client'
import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  signInWithCustomToken,
  signOut,
  setPersistence,
  inMemoryPersistence,
} from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { OWNER_EMAIL } from '@/lib/owner-session'
import { ShieldCheck, LoaderCircle, LogOut } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/LanguageContext'
export function OwnerAccessGate({ children }: { children: ReactNode }) {
  const { isRtl } = useLanguage()
  const [state, setState] = useState<'loading' | 'login' | 'ready'>('loading')
  const [email, setEmail] = useState(OWNER_EMAIL),
    [password, setPassword] = useState(''),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false)
  useEffect(() => {
    let cancelled = false
    fetch('/api/auth/owner-session', {
      cache: 'no-store',
      credentials: 'same-origin',
    })
      .then(async (response) => {
        if (!response.ok) {
          if (response.status !== 401) {
            const data = await response.json()
            throw Error(data.error)
          }
          return false
        }
        const data = await response.json()
        await setPersistence(auth, inMemoryPersistence)
        await signInWithCustomToken(auth, data.firebaseToken)
        return true
      })
      .then((ok) => {
        if (!cancelled) setState(ok ? 'ready' : 'login')
      })
      .catch((e) => {
        if (!cancelled) {
          setError(e.message || 'تعذر التحقق من الجلسة.')
          setState('login')
        }
      })
    return () => {
      cancelled = true
    }
  }, [])
  async function login(event: FormEvent) {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      const response = await fetch('/api/auth/owner-login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()
      if (!response.ok)
        throw Error(data.error + (data.code ? ` [${data.code}]` : ''))
      await setPersistence(auth, inMemoryPersistence)
      await signInWithCustomToken(auth, data.firebaseToken)
      setPassword('')
      setState('ready')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تسجيل الدخول.')
    } finally {
      setBusy(false)
    }
  }
  async function logout() {
    setBusy(true)
    try {
      const response = await fetch('/api/auth/owner-session', {
        method: 'DELETE',
        credentials: 'same-origin',
      })
      if (!response.ok) throw Error('تعذر إنهاء الجلسة. حاول مرة أخرى.')
      await signOut(auth)
      setState('login')
      setPassword('')
      setError('')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'تعذر تسجيل الخروج.')
    } finally {
      setBusy(false)
    }
  }
  if (state === 'loading')
    return (
      <div className="min-h-96 grid place-items-center" role="status">
        <LoaderCircle className="animate-spin text-primary" />
        <span>
          {isRtl ? 'جارٍ التحقق من حساب المالك…' : 'Checking owner session…'}
        </span>
      </div>
    )
  if (state === 'ready')
    return (
      <>
        <div className="flex justify-end mb-5">
          <Button variant="outline" disabled={busy} onClick={logout}>
            <LogOut />
            {isRtl ? 'تسجيل الخروج' : 'Sign out'}
          </Button>
        </div>
        {error && (
          <p role="alert" className="text-destructive">
            {error}
          </p>
        )}
        {children}
      </>
    )
  return (
    <div className="max-w-md mx-auto my-12 rounded-3xl border border-border bg-card p-8 shadow-xl">
      <ShieldCheck className="size-10 text-primary mb-5" />
      <h1 className="text-2xl font-black">
        {isRtl ? 'دخول مالك المنصة' : 'Platform owner login'}
      </h1>
      <p className="text-muted-foreground text-sm mt-2 mb-7">
        {isRtl
          ? 'استخدم حساب المالك لإدارة العيادات والواجهة الرئيسية.'
          : 'Use the owner account to manage clinics and the landing page.'}
      </p>
      <form onSubmit={login} className="space-y-5">
        <label className="grid gap-2 text-sm font-bold">
          {isRtl ? 'البريد الإلكتروني' : 'Email'} *
          <input
            name="email"
            type="email"
            dir="ltr"
            autoComplete="username"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="h-12 rounded-xl border border-border bg-background px-4"
          />
        </label>
        <label className="grid gap-2 text-sm font-bold">
          {isRtl ? 'كلمة المرور' : 'Password'} *
          <input
            name="password"
            type="password"
            dir="ltr"
            autoComplete="current-password"
            required
            maxLength={256}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="h-12 rounded-xl border border-border bg-background px-4"
          />
        </label>
        {error && (
          <p role="alert" className="text-sm text-destructive leading-7">
            {error}
          </p>
        )}
        <Button type="submit" disabled={busy} className="w-full h-12">
          {busy ? <LoaderCircle className="animate-spin" /> : <ShieldCheck />}
          {isRtl ? 'تسجيل الدخول' : 'Sign in'}
        </Button>
      </form>
    </div>
  )
}
