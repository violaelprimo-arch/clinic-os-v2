'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GoogleAuthProvider, signInWithPopup, signInWithCustomToken } from 'firebase/auth'
import { auth } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, ShieldCheck, ArrowLeft, ArrowRight, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import Link from 'next/link'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useLanguage } from '@/context/LanguageContext'

export default function UniversalClinicLogin() {
  const { t, dir, isRtl } = useLanguage()
  const router = useRouter()

  const [email, setEmail] = useState('') // email or username in sign-in mode
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetOtpSent, setResetOtpSent] = useState(false)
  const [resetOtp, setResetOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')

  const handleGoogleClinicLogin = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const result = await signInWithPopup(auth, provider)
      const idToken = await result.user.getIdToken(true)
      const requestedClinic = new URLSearchParams(window.location.search).get('clinic') || ''
      const res = await fetch('/api/auth/google-clinic-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ idToken, slug: requestedClinic })
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'تعذر تسجيل الدخول بحساب جوجل')
      }
      localStorage.setItem('clinic_session_token', data.token)
      localStorage.setItem('clinic_role', 'doctor')
      localStorage.removeItem('clinic_locked_branch')
      localStorage.removeItem('clinic_locked_branch_name')
      toast.success('تم تسجيل الدخول بجيميل الدكتور بنجاح')
      // Remain on the main domain so Firebase OAuth never needs arbitrary
      // doctor subdomains registered as authorized sign-in origins.
      router.push(data.redirectUrl)
    } catch (err: any) {
      const reason = String(err?.code || '')
      setError(reason.includes('popup-closed')
        ? 'تم إغلاق نافذة Google قبل اكتمال تسجيل الدخول.'
        : err?.message || 'تسجيل Google غير متاح؛ تحقق من إعدادات Firebase والدومين الأساسي.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleForgotPassword = async () => {
    if (!email.trim()) {
      return setError(isRtl ? 'يرجى إدخال البريد الإلكتروني أولاً' : 'Please enter your email first')
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'request',
          email: email.trim().toLowerCase()
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || (isRtl ? 'حدث خطأ أثناء طلب استعادة كلمة المرور.' : 'An error occurred while requesting password reset.'))
        return
      }
      setResetOtpSent(true)
      toast.success(data.message || (isRtl ? 'تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح.' : 'OTP verification code sent to your email.'))
    } catch (err: any) {
      setError(err.message || (isRtl ? 'فشل الاتصال بالخادم.' : 'Connection to server failed.'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleResetPassword = async () => {
    if (!resetOtp.trim() || !newPassword.trim()) {
      return setError(isRtl ? 'يرجى إدخال الكود وكلمة المرور الجديدة' : 'Please enter OTP and new password')
    }
    if (newPassword.length < 6) {
      return setError(isRtl ? 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات' : 'New password must be at least 6 characters')
    }
    if (newPassword !== newPasswordConfirm) {
      return setError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match')
    }
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'verify-and-reset',
          email: email.trim().toLowerCase(),
          otp: resetOtp.trim(),
          newPassword
        })
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || (isRtl ? 'رمز التحقق (OTP) غير صحيح أو منتهي الصلاحية.' : 'Invalid or expired OTP code.'))
        return
      }
      toast.success(data.message || (isRtl ? 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.' : 'Password reset successfully. You can now sign in.'))
      setIsResetMode(false)
      setResetOtpSent(false)
      setPassword(newPassword)
    } catch (err: any) {
      setError(err.message || (isRtl ? 'حدث خطأ أثناء تغيير كلمة المرور.' : 'An error occurred while resetting password.'))
    } finally {
      setIsLoading(false)
    }
  }

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const loginIdentifier = email.trim()

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier: loginIdentifier, password })
      })
      const data = await res.json()

      if (res.ok && data.success) {
        if (data.firebaseCustomToken) {
          try {
            await signInWithCustomToken(auth, data.firebaseCustomToken)
          } catch {
            throw new Error(isRtl
              ? 'تعذر إنشاء جلسة Firebase. يرجى إعادة المحاولة أو التواصل مع الدعم.'
              : 'Firebase authentication failed. Please retry or contact support.')
          }
        }
        localStorage.setItem('clinic_session_token', data.token)
        localStorage.setItem('clinic_role', data.user.role)
        if (data.user.role === 'assistant' && data.user.branchId) {
          localStorage.setItem('clinic_selected_branch', data.user.branchId)
          localStorage.setItem('clinic_locked_branch', data.user.branchId)
          if (data.user.branchName) {
            localStorage.setItem('clinic_locked_branch_name', data.user.branchName)
          }
        } else if (data.user.role === 'doctor') {
          localStorage.removeItem('clinic_locked_branch')
          localStorage.removeItem('clinic_locked_branch_name')
        }

        toast.success(isRtl ? `مرحباً ${data.user.name}، تم تسجيل الدخول بنجاح` : `Welcome ${data.user.name}, logged in successfully`)
        const destination = data.redirectUrl || `/clinic/${data.user.slug}/admin`
        router.push(destination)
        return
      }

      setError(data.error || (isRtl ? 'اسم المستخدم أو البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Incorrect username, email or password.'))
    } catch (err: any) {
      setError(err.message || (isRtl ? 'فشل الاتصال بالخادم.' : 'Connection to server failed.'))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center font-sans p-4 sm:p-6 transition-colors" dir={dir}>
      {/* Top Floating Controls */}
      <div className="w-full max-w-5xl flex justify-between items-center mb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors group"
        >
          {isRtl ? <ArrowRight className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" /> : <ArrowLeft className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" />}
          <span>{t('back_to_home', isRtl ? 'الرئيسية' : 'Home')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Main Split-Screen Shell */}
      <div className="w-full max-w-5xl yalla-card rounded-3xl border border-border shadow-2xl overflow-hidden grid lg:grid-cols-12 min-h-[600px]">
        {/* Visual Hero Side (Premium Medical SaaS Presentation) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#061A38] via-[#0E2342] to-[#07162D] relative p-8 flex flex-col justify-between text-white overflow-hidden hidden lg:flex">
          {/* Subtle Ambient Depth Glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-sky-500/15 rounded-full blur-3xl pointer-events-none" />

          {/* Top Brand Logo */}
          <div className="relative z-10">
            <ClinicLogo size="md" variant="dark" />
          </div>

          {/* Center Brand Statement */}
          <div className="relative z-10 my-auto text-center space-y-6">
            <div className="relative w-44 h-44 mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20 bg-slate-900/60 backdrop-blur-md flex items-center justify-center p-5">
              <div className="absolute inset-0 bg-gradient-to-tr from-[#087CF4]/20 via-transparent to-[#02CFF3]/20 pointer-events-none" />
              <img
                src="/brand/yalla-clinic/app-icon.png"
                alt="أيقونة Yalla Clinic"
                width={132}
                height={132}
                className="relative z-10 w-32 h-32 object-contain drop-shadow-2xl"
              />
            </div>

            <div className="space-y-2">
              <h2 className="text-2xl font-black text-white tracking-wide">
                {isRtl ? 'منظومة إدارة العيادات الطبية' : 'Medical Clinic Operating System'}
              </h2>
              <p className="text-xs text-slate-300 font-medium leading-relaxed max-w-xs mx-auto">
                {isRtl ? 'منصة متكاملة للأطباء والمراكز الطبية: تنظيم المواعيد، متابعة الدور، وسجلات المرضى.' : 'Unified workspace for clinics, live queue management, and electronic health records.'}
              </p>
            </div>

            <div className="pt-2 flex flex-wrap justify-center gap-2 text-[11px] text-slate-300">
              <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                <span>{isRtl ? 'تشفير كامل للبيانات' : 'End-to-end encrypted'}</span>
              </span>
              <span className="flex items-center gap-1 bg-white/10 px-2.5 py-1 rounded-full">
                <CheckCircle2 className="w-3.5 h-3.5 text-sky-400" />
                <span>{isRtl ? 'تحديث لحظي للدور' : 'Real-time queue sync'}</span>
              </span>
            </div>
          </div>

          {/* Bottom Security Badge */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {isRtl ? 'تسجيل دخول موحد وآمن' : 'Universal Secure Login'}
            </span>
            <span className="font-mono text-[11px] text-slate-400">yalla-clinic.com</span>
          </div>
        </div>

        {/* Form Side */}
        <div className="lg:col-span-7 p-6 sm:p-12 flex flex-col justify-between space-y-8 bg-card text-card-foreground">
          {/* Top Header */}
          <div className="space-y-4">
            <div className="flex lg:hidden justify-center pb-2">
              <ClinicLogo size="md" variant="auto" />
            </div>

            <div className={`space-y-1.5 ${isRtl ? 'text-right' : 'text-left'}`}>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                {isRtl ? 'تسجيل دخول العيادة' : 'Clinic Sign In'}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                {isRtl ? 'ادخل اسم المستخدم أو البريد الإلكتروني وكلمة المرور للوصول إلى لوحة عيادتك' : 'Enter your username or email and password to access your clinic workspace'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {isResetMode ? (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    {isRtl ? 'البريد الإلكتروني لحساب العيادة' : 'Clinic Account Email'}
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="h-11 text-xs bg-background border-border"
                    dir="ltr"
                    disabled={resetOtpSent}
                    placeholder="doctor@example.com"
                  />
                </div>

                {!resetOtpSent ? (
                  <Button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isLoading}
                    className="w-full h-11 yalla-gradient-btn text-white font-bold rounded-xl shadow-xs text-xs"
                  >
                    {isLoading ? (isRtl ? 'جاري الإرسال...' : 'Sending...') : (isRtl ? 'طلب رمز التحقق عبر البريد الإلكتروني' : 'Request OTP Verification Code')}
                  </Button>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">
                        {isRtl ? 'رمز التحقق (OTP) المستلم' : 'OTP Code from Email'}
                      </Label>
                      <Input
                        type="text"
                        value={resetOtp}
                        onChange={(e) => setResetOtp(e.target.value)}
                        className="h-11 text-xs text-center tracking-widest font-mono bg-background border-border"
                        dir="ltr"
                        placeholder="123456"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">
                        {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
                      </Label>
                      <PasswordInput
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        className="h-11 text-xs bg-background border-border"
                        dir="ltr"
                        placeholder="••••••••"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs font-bold text-muted-foreground">
                        {isRtl ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
                      </Label>
                      <PasswordInput
                        value={newPasswordConfirm}
                        onChange={(e) => setNewPasswordConfirm(e.target.value)}
                        className="h-11 text-xs bg-background border-border"
                        dir="ltr"
                        placeholder="••••••••"
                      />
                    </div>
                    <Button
                      type="button"
                      onClick={handleResetPassword}
                      disabled={isLoading}
                      className="w-full h-11 yalla-gradient-btn text-white font-bold rounded-xl shadow-xs text-xs"
                    >
                      {isLoading ? (isRtl ? 'جاري التحديث...' : 'Updating...') : (isRtl ? 'تأكيد وتغيير كلمة المرور' : 'Confirm & Reset Password')}
                    </Button>
                  </>
                )}

                <div className="text-center pt-2">
                  <button
                    type="button"
                    onClick={() => {
                      setIsResetMode(false)
                      setResetOtpSent(false)
                      setError(null)
                    }}
                    className="text-xs font-bold text-primary hover:underline cursor-pointer"
                  >
                    {isRtl ? 'العودة لتسجيل الدخول' : 'Back to sign in'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    {isRtl ? 'اسم المستخدم أو البريد الإلكتروني' : 'Username or Email'}
                  </Label>
                  <Input
                    type="text"
                    autoComplete="username"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="username / doctor@clinic.com"
                    className="h-11 text-xs bg-background border-border"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <div className="flex justify-between items-center">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {isRtl ? 'كلمة المرور' : 'Password'}
                    </Label>
                    <button
                      type="button"
                      onClick={() => {
                        setIsResetMode(true)
                        setError(null)
                      }}
                      className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                    >
                      {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot password?'}
                    </button>
                  </div>
                  <PasswordInput
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="h-11 text-xs bg-background border-border"
                    dir="ltr"
                  />
                </div>

                <Button
                  type="submit"
                  disabled={isLoading}
                  className="w-full h-11 yalla-gradient-btn text-white font-bold rounded-xl shadow-md text-xs cursor-pointer active:scale-[0.98] transition-transform"
                >
                  {isLoading ? (isRtl ? 'جاري التحقق...' : 'Signing in...') : (isRtl ? 'دخول لوحة التحكم' : 'Sign In')}
                </Button>
              </div>
            )}

            {error && (
              <Alert variant="destructive" className="py-2.5 px-3 rounded-xl border border-destructive/20 bg-destructive/10 text-destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertTitle className="text-xs font-bold">{isRtl ? 'خطأ في تسجيل الدخول' : 'Sign in error'}</AlertTitle>
                <AlertDescription className="text-xs mt-0.5">{error}</AlertDescription>
              </Alert>
            )}
          </form>
          {!isResetMode && (
            <div className="pt-4 border-t border-border space-y-2">
              <p className="text-center text-xs text-muted-foreground">أو سجل بجيميل الدكتور المسجل في العيادة</p>
              <Button type="button" variant="outline" className="w-full h-11 rounded-xl font-bold text-sm"
                onClick={handleGoogleClinicLogin} disabled={isLoading}>
                <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-white text-[#4285F4] font-black border border-slate-200">G</span>
                {isLoading ? 'جاري التحقق من Google...' : 'تسجيل الدخول باستخدام Google'}
              </Button>
            </div>
          )}

          {/* Footer note */}
          <div className="pt-4 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
            <span>{isRtl ? 'منصة Yalla Clinic الطبية' : 'Yalla Clinic Platform'}</span>
            <Link href="/" className="text-primary font-bold hover:underline">
              {isRtl ? 'زيارة الموقع الرئيسي' : 'Visit Homepage'}
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
