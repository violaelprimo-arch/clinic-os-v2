'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Stethoscope, Sparkles, ShieldCheck, ArrowLeft, Lock } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import Link from 'next/link'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useLanguage } from '@/context/LanguageContext'

export default function DoctorLogin({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, dir, isRtl } = useLanguage()
  const [email, setEmail] = useState('')
  
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('error') === 'subscription_ended') {
      setError(isRtl ? 'تم انتهاء الاشتراك. يرجى التواصل مع الإدارة.' : 'Subscription has expired. Please contact administration.');
    }
  }, [isRtl])
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isResetMode, setIsResetMode] = useState(false)
  const [resetOtpSent, setResetOtpSent] = useState(false)
  const [resetOtp, setResetOtp] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [newPasswordConfirm, setNewPasswordConfirm] = useState('')
  const [clinicHero, setClinicHero] = useState('https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop')
  const router = useRouter()

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const cDoc = snapshot.docs[0].data()
          if (cDoc.heroImage) setClinicHero(cDoc.heroImage)
        }
      } catch (err) {}
    }
    fetchClinic()
  }, [slug])


  const handleForgotPassword = async () => {
    if (!email.trim()) {
      return setError(isRtl ? 'يرجى إدخال البريد الإلكتروني أولاً' : 'Please enter your email first');
    }
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const cDoc = snapshot.docs[0];
        const data = cDoc.data();
        if ((data.doctorEmail || '').trim().toLowerCase() === email.trim().toLowerCase()) {
          const otp = Math.floor(100000 + Math.random() * 900000).toString();
          await updateDoc(doc(db, 'clinics', cDoc.id), {
            resetPasswordOtp: otp,
            resetPasswordRequestedAt: new Date().toISOString()
          });

          // Send OTP directly to doctor's email
          try {
            await fetch('/api/send-otp', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                email: email.trim(),
                otp,
                doctorName: data.doctorName,
                clinicName: data.clinicName
              })
            });
          } catch (sendErr) {
            console.warn('send-otp error:', sendErr);
          }

          setResetOtpSent(true);
          toast.success(isRtl ? 'تم إرسال رمز التحقق (OTP) إلى بريدك الإلكتروني بنجاح.' : 'OTP verification code sent to your email successfully.');
        } else {
          setError(isRtl ? 'البريد الإلكتروني غير مسجل.' : 'Email is not registered.');
        }
      }
    } catch (err) {
      setError(isRtl ? 'حدث خطأ أثناء طلب استعادة كلمة المرور.' : 'An error occurred while requesting password reset.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetOtp.trim() || !newPassword.trim()) {
      return setError(isRtl ? 'يرجى إدخال الكود وكلمة المرور الجديدة' : 'Please enter OTP and new password');
    }
    if (newPassword.length < 6) {
      return setError(isRtl ? 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات' : 'New password must be at least 6 characters');
    }
    if (newPassword !== newPasswordConfirm) {
      return setError(isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match');
    }
    setIsLoading(true);
    setError(null);
    try {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug));
      const snapshot = await getDocs(q);
      if (!snapshot.empty) {
        const cDoc = snapshot.docs[0];
        const data = cDoc.data();
        if (data.resetPasswordOtp === resetOtp.trim()) {
          await updateDoc(doc(db, 'clinics', cDoc.id), {
            doctorPassword: newPassword,
            resetPasswordOtp: null,
            resetPasswordRequestedAt: null
          });
          toast.success(isRtl ? 'تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.' : 'Password reset successfully. You can now log in.');
          setIsResetMode(false);
          setResetOtpSent(false);
          setPassword(newPassword);
        } else {
          setError(isRtl ? 'رمز التحقق (OTP) غير صحيح أو منتهي الصلاحية.' : 'Invalid or expired OTP code.');
        }
      }
    } catch (err) {
      setError(isRtl ? 'حدث خطأ أثناء تغيير كلمة المرور.' : 'An error occurred while resetting password.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const inputEmail = email.trim()

    try {
      // 1. Authenticate via secure cryptographic server API
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: inputEmail, password, slug })
      })
      const data = await res.json()

      if (res.ok && data.success) {
        localStorage.setItem('clinic_session_token', data.token)
        localStorage.setItem('clinic_role', data.user.role)
        toast.success(isRtl ? `مرحباً ${data.user.name}، تم تسجيل الدخول بنجاح` : `Welcome ${data.user.name}, logged in successfully`)
        router.push(`/clinic/${slug}/admin`)
        return
      }

      // 2. Fallback: Firebase Auth directly
      try {
        await signInWithEmailAndPassword(auth, inputEmail, password)
        toast.success(isRtl ? 'تم تسجيل الدخول بنجاح' : 'Logged in successfully')
        router.push(`/clinic/${slug}/admin`)
        return
      } catch (fbErr) {
        // Fallback error
      }

      setError(data.error || (isRtl ? 'البريد الإلكتروني أو كلمة المرور غير صحيحة.' : 'Incorrect email or password.'))
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
          href={`/clinic/${slug}`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          <span>{t('back_to_clinic', isRtl ? 'العودة للعيادة' : 'Back to Clinic')}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      {/* Outer Card Shell with Split-Screen layout matching Mockup */}
      <div className="w-full max-w-5xl yalla-card rounded-3xl border border-border shadow-2xl overflow-hidden grid lg:grid-cols-12 min-h-[640px]">
        
        {/* Visual Hero Side (Doctor Visual) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#061A38] via-[#0E2342] to-[#07162D] relative p-8 flex flex-col justify-between text-white overflow-hidden hidden lg:flex">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-primary/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#02CFF3]/20 rounded-full blur-3xl pointer-events-none"></div>

          {/* Top Logo */}
          <div className="relative z-10">
            <ClinicLogo size="md" variant="dark" />
          </div>

          {/* Center Doctor Image with Modern Overlay */}
          <div className="relative z-10 my-auto text-center space-y-5">
            <div className="relative w-56 h-64 mx-auto rounded-3xl overflow-hidden shadow-2xl border-2 border-white/20">
              <img
                src={clinicHero}
                alt="Doctor Medical Team"
                className="w-full h-full object-cover object-top"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#061A38] via-transparent to-transparent opacity-80"></div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white tracking-wide">
                {isRtl ? 'أدر عيادتك بذكاء' : 'Manage Clinic Smartly'}
              </h2>
              <p className="text-xs text-[#77E7FF] font-semibold tracking-wide">
                {isRtl ? 'Yalla Clinic — شريكك الذكي في تطوير العيادة' : 'Yalla Clinic — Your intelligent clinic partner'}
              </p>
            </div>
          </div>

          {/* Bottom Security Badge */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-primary" />
              {isRtl ? 'نظام تشفير وحماية معتمد' : 'Enterprise grade security'}
            </span>
            <span className="font-mono text-[11px] text-slate-400">/clinic/{slug}</span>
          </div>
        </div>

        {/* Form Side: Clean Medical SaaS Login Form */}
        <div className="lg:col-span-7 p-6 sm:p-12 flex flex-col justify-between space-y-8 bg-card text-card-foreground">
          
          {/* Top Header */}
          <div className="space-y-4">
            <div className="flex lg:hidden justify-center pb-2">
              <ClinicLogo size="md" variant="light" />
            </div>

            <div className={`space-y-1.5 ${isRtl ? 'text-right' : 'text-left'}`}>
              <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                {t('login', isRtl ? 'تسجيل الدخول' : 'Sign In')}
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground font-medium">
                {isRtl ? 'ادخل إلى حسابك لإدارة العيادة والمواعيد والروشتات' : 'Sign in to manage appointments, patients, and prescriptions'}
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {isResetMode ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">
                  {isRtl ? 'البريد الإلكتروني (للتأكيد)' : 'Email (Verification)'}
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-sm bg-background border-border"
                  dir="ltr"
                  disabled={resetOtpSent}
                />
              </div>
              
              {!resetOtpSent ? (
                <Button onClick={handleForgotPassword} disabled={isLoading} className="w-full h-12 yalla-gradient-btn text-white font-bold rounded-xl shadow-xs">
                  {isLoading ? (isRtl ? 'جاري الإرسال...' : 'Sending...') : (isRtl ? 'طلب رمز التحقق عبر البريد الإلكتروني (Gmail)' : 'Request OTP Verification Code via Email')}
                </Button>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {isRtl ? 'رمز التحقق (OTP) من البريد الإلكتروني' : 'OTP Code from Email'}
                    </Label>
                    <Input
                      type="text"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                      className="h-12 text-sm text-center tracking-widest font-mono bg-background border-border"
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
                      className="h-12 text-sm bg-background border-border"
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
                      className="h-12 text-sm bg-background border-border"
                      dir="ltr"
                      placeholder="••••••••"
                    />
                    {newPassword && newPasswordConfirm && newPassword !== newPasswordConfirm && (
                      <p className="text-[11px] font-bold text-rose-500">
                        {isRtl ? 'كلمتا المرور غير متطابقتين' : 'Passwords do not match'}
                      </p>
                    )}
                  </div>
                  <Button onClick={handleResetPassword} disabled={isLoading} className="w-full h-12 yalla-gradient-btn text-white font-bold rounded-xl shadow-xs">
                    {isLoading ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'تأكيد وتغيير كلمة المرور' : 'Confirm and Change Password')}
                  </Button>
                </>
              )}
              
              <div className="text-center">
                <button type="button" onClick={() => setIsResetMode(false)} className="text-xs font-bold text-muted-foreground hover:text-foreground">
                  {isRtl ? 'العودة لتسجيل الدخول' : 'Back to Sign In'}
                </button>
              </div>
            </div>
            ) : (
            <>
              {error && (
              <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl text-xs">
                <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
                <AlertTitle className="font-bold">{isRtl ? 'خطأ في الدخول' : 'Sign In Error'}</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                {isRtl ? 'رقم الهاتف أو البريد الإلكتروني' : 'Phone Number or Email'}
              </Label>
              <Input
                type="text"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                dir="ltr"
                className={`h-12 text-sm ${isRtl ? 'text-right' : 'text-left'} rounded-xl bg-background border-border focus:bg-background`}
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground">
                  {t('password', isRtl ? 'كلمة المرور' : 'Password')}
                </Label>
                <Link
                  href={`/clinic/${slug}/login/update-password`}
                  className="text-xs font-bold text-primary hover:underline"
                >
                  {isRtl ? 'نسيت كلمة المرور؟' : 'Forgot Password?'}
                </Link>
              </div>
              <PasswordInput
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                dir="ltr"
                placeholder="••••••••"
                className={`h-12 text-sm ${isRtl ? 'text-right' : 'text-left'} rounded-xl bg-background border-border focus:bg-background`}
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs font-semibold text-muted-foreground cursor-pointer">
                {isRtl ? 'تذكر تسجيل الدخول على هذا الجهاز' : 'Remember me on this device'}
              </label>
            </div>

            {/* Primary Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-black yalla-gradient-btn text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              {isLoading ? (isRtl ? 'جاري التحقق من البيانات...' : 'Signing in...') : t('login', isRtl ? 'تسجيل الدخول' : 'Sign In')}
            </Button>

            {/* Divider */}
            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border"></div>
              </div>
              <span className="relative bg-card px-3 text-xs text-muted-foreground font-bold">
                {isRtl ? 'أو' : 'or'}
              </span>
            </div>

            {/* Mock Google Login Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => toast.info(isRtl ? 'تسجيل الدخول عبر Google متاح لحسابات المؤسسات الطبية' : 'Google sign-in is available for healthcare organization accounts')}
              className="w-full h-11 text-xs font-bold text-foreground border-border hover:bg-muted/40 rounded-xl flex items-center justify-center gap-2"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24">
                <path
                  fill="#4285F4"
                  d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                />
                <path
                  fill="#34A853"
                  d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                />
                <path
                  fill="#FBBC05"
                  d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                />
                <path
                  fill="#EA4335"
                  d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                />
              </svg>
              {isRtl ? 'تسجيل الدخول عبر Google' : 'Sign in with Google'}
            </Button>
                    </>
            )}
          </form>

          {/* Footer Contact */}
          <div className="pt-4 border-t border-border flex flex-col items-center gap-1.5 text-center text-xs text-muted-foreground">
            <div>
              {isRtl ? 'ليس لديك حساب بعد؟ ' : "Don't have an account yet? "}
              <a
                href="https://wa.me/201012345678"
                target="_blank"
                rel="noreferrer"
                className="text-primary font-bold hover:underline"
              >
                {isRtl ? 'تواصل مع إدارة المنصة' : 'Contact Support'}
              </a>
            </div>
            <div className="text-[11px] text-muted-foreground/80">
              {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}
            </div>
          </div>

        </div>

      </div>
    </div>
  )
}
