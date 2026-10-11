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

export default function DoctorLogin({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [email, setEmail] = useState('')
  
  useEffect(() => {
    const searchParams = new URLSearchParams(window.location.search)
    if (searchParams.get('error') === 'subscription_ended') {
      setError('تم انتهاء الاشتراك. يرجى التواصل مع الإدارة.');
    }
  }, [])
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
      return setError('يرجى إدخال البريد الإلكتروني أولاً');
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
          toast.success('تم إرسال رمز التحقق (OTP) إلى بريدك الإلكتروني (Gmail) بنجاح.');
        } else {
          setError('البريد الإلكتروني غير مسجل.');
        }
      }
    } catch (err) {
      setError('حدث خطأ أثناء طلب استعادة كلمة المرور.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetOtp.trim() || !newPassword.trim()) {
      return setError('يرجى إدخال الكود وكلمة المرور الجديدة');
    }
    if (newPassword.length < 6) {
      return setError('يجب ألا تقل كلمة المرور الجديدة عن 6 خانات');
    }
    if (newPassword !== newPasswordConfirm) {
      return setError('كلمتا المرور غير متطابقتين، يرجى التأكد من تطابق كلمة المرور وتأكيدها');
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
          toast.success('تم تغيير كلمة المرور بنجاح. يمكنك الآن تسجيل الدخول.');
          setIsResetMode(false);
          setResetOtpSent(false);
          setPassword(newPassword);
        } else {
          setError('رمز التحقق (OTP) غير صحيح أو منتهي الصلاحية.');
        }
      }
    } catch (err) {
      setError('حدث خطأ أثناء تغيير كلمة المرور.');
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
      // 1. Try normal Firebase Auth login
      await signInWithEmailAndPassword(auth, inputEmail, password)
      toast.success('تم تسجيل الدخول بنجاح')
      router.push(`/clinic/${slug}/admin`)
    } catch (err: any) {
      if (
        err.code === 'auth/invalid-credential' ||
        err.code === 'auth/user-not-found' ||
        err.code === 'auth/wrong-password' ||
        err.code === 'auth/invalid-email'
      ) {
        // 2. Fallback: Check if owner created credentials in clinic document
        try {
          const q = query(collection(db, 'clinics'), where('slug', '==', slug))
          const snapshot = await getDocs(q)

          if (!snapshot.empty) {
              const clinicDoc = snapshot.docs[0].data()
              if (clinicDoc.isActive === false || (clinicDoc.expirationDate && new Date(clinicDoc.expirationDate) < new Date())) {
                setError('تم انتهاء الاشتراك. يرجى التواصل مع الإدارة.')
                setIsLoading(false)
                return
              }

            const isDoctor = clinicDoc.doctorEmail === inputEmail && clinicDoc.doctorPassword === password
            let isAssistant = clinicDoc.assistantEmail === inputEmail && clinicDoc.assistantPassword === password

            if (!isAssistant && clinicDoc.assistants) {
              const matchedAss = clinicDoc.assistants.find(
                (a: any) => a.email === inputEmail && a.password === password
              )
              if (matchedAss) isAssistant = true
            }

            if (isDoctor || isAssistant) {
              try {
                await createUserWithEmailAndPassword(auth, inputEmail, password)
              } catch (regErr) {
                // already created or handle
              }
              toast.success('تم تفعيل الحساب وتسجيل الدخول بنجاح!')
              localStorage.setItem('clinic_role', isDoctor ? 'doctor' : 'assistant')
              router.push(`/clinic/${slug}/admin`)
              return
            }
          }

          setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
        } catch (dbErr) {
          setError('حدث خطأ أثناء التحقق من البيانات.')
        }
      } else {
        setError(err.message || 'فشل الاتصال بالخادم.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center font-sans p-4 sm:p-6" dir="rtl">
      
      {/* Outer Card Shell with Split-Screen layout matching Mockup */}
      <div className="w-full max-w-5xl bg-white rounded-3xl border border-[#E5EAF0] shadow-2xl overflow-hidden grid lg:grid-cols-12 min-h-[640px]">
        
        {/* RIGHT SIDE: Branding Doctor Visual Hero (in RTL this appears first/right) */}
        <div className="lg:col-span-5 bg-gradient-to-br from-[#0B1F33] via-[#0F2840] to-[#0B1F33] relative p-8 flex flex-col justify-between text-white overflow-hidden hidden lg:flex">
          {/* Decorative background glow */}
          <div className="absolute top-0 right-0 w-80 h-80 bg-[#15B8A6]/20 rounded-full blur-3xl pointer-events-none"></div>
          <div className="absolute bottom-0 left-0 w-80 h-80 bg-[#2F80ED]/20 rounded-full blur-3xl pointer-events-none"></div>

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
              <div className="absolute inset-0 bg-gradient-to-t from-[#0B1F33] via-transparent to-transparent opacity-80"></div>
            </div>

            <div className="space-y-2">
              <h2 className="text-3xl font-black text-white tracking-wide">
                أدر عيادتك بذكاء
              </h2>
              <p className="text-xs text-teal-300 font-semibold tracking-wide">
                Clinic OS — شريكك الذكي في تطوير العيادة
              </p>
            </div>
          </div>

          {/* Bottom Security Badge */}
          <div className="relative z-10 flex items-center justify-between text-xs text-slate-400 border-t border-white/10 pt-4">
            <span className="flex items-center gap-1.5 text-slate-300">
              <ShieldCheck className="w-4 h-4 text-[#15B8A6]" />
              نظام تشفير وحماية معتمد
            </span>
            <span className="font-mono text-[11px] text-slate-400">/clinic/{slug}</span>
          </div>
        </div>

        {/* LEFT SIDE: Clean Medical SaaS Login Form */}
        <div className="lg:col-span-7 p-6 sm:p-12 flex flex-col justify-between space-y-8">
          
          {/* Top Header */}
          <div className="space-y-4">
            <div className="flex lg:hidden justify-center pb-2">
              <ClinicLogo size="md" variant="light" />
            </div>

            <div className="space-y-1.5 text-right">
              <h1 className="text-2xl sm:text-3xl font-black text-[#182230]">
                تسجيل الدخول
              </h1>
              <p className="text-xs sm:text-sm text-slate-400 font-medium">
                ادخل إلى حسابك لإدارة العيادة والمواعيد والروشتات
              </p>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-5">
            {isResetMode ? (
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">البريد الإلكتروني (للتأكيد)</Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="h-12 text-sm bg-slate-50 border-slate-200"
                  dir="ltr"
                  disabled={resetOtpSent}
                />
              </div>
              
              {!resetOtpSent ? (
                <Button onClick={handleForgotPassword} disabled={isLoading} className="w-full h-12 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-xl shadow-lg">
                  {isLoading ? 'جاري الإرسال...' : 'طلب رمز التحقق عبر البريد الإلكتروني (Gmail)'}
                </Button>
              ) : (
                <>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">رمز التحقق (OTP) من البريد الإلكتروني</Label>
                    <Input
                      type="text"
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value)}
                      className="h-12 text-sm text-center tracking-widest font-mono"
                      dir="ltr"
                      placeholder="123456"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">كلمة المرور الجديدة</Label>
                    <PasswordInput
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="h-12 text-sm"
                      dir="ltr"
                      placeholder="••••••••"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">تأكيد كلمة المرور الجديدة</Label>
                    <PasswordInput
                      value={newPasswordConfirm}
                      onChange={(e) => setNewPasswordConfirm(e.target.value)}
                      className="h-12 text-sm"
                      dir="ltr"
                      placeholder="••••••••"
                    />
                    {newPassword && newPasswordConfirm && newPassword !== newPasswordConfirm && (
                      <p className="text-[11px] font-bold text-rose-500">كلمتا المرور غير متطابقتين</p>
                    )}
                  </div>
                  <Button onClick={handleResetPassword} disabled={isLoading} className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl shadow-lg">
                    {isLoading ? 'جاري الحفظ...' : 'تأكيد وتغيير كلمة المرور'}
                  </Button>
                </>
              )}
              
              <div className="text-center">
                <button type="button" onClick={() => setIsResetMode(false)} className="text-xs font-bold text-slate-500 hover:text-slate-800">
                  العودة لتسجيل الدخول
                </button>
              </div>
            </div>
          ) : (
            <>
              {error && (
              <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-800 rounded-xl text-xs">
                <AlertCircle className="h-4 w-4 text-rose-600" />
                <AlertTitle className="font-bold">خطأ في الدخول</AlertTitle>
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">
                رقم الهاتف أو البريد الإلكتروني
              </Label>
              <Input
                type="text"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                dir="ltr"
                className="h-12 text-sm text-right rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-600">كلمة المرور</Label>
                <Link
                  href={`/clinic/${slug}/login/update-password`}
                  className="text-xs font-bold text-[#15B8A6] hover:underline"
                >
                  نسيت كلمة المرور؟
                </Link>
              </div>
              <PasswordInput
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                dir="ltr"
                placeholder="••••••••"
                className="h-12 text-sm text-right rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="remember"
                checked={rememberMe}
                onChange={e => setRememberMe(e.target.checked)}
                className="rounded text-[#15B8A6] focus:ring-[#15B8A6] w-4 h-4 cursor-pointer"
              />
              <label htmlFor="remember" className="text-xs font-semibold text-slate-600 cursor-pointer">
                تذكر تسجيل الدخول على هذا الجهاز
              </label>
            </div>

            {/* Primary Submit Button */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/25 transition-all cursor-pointer"
            >
              {isLoading ? 'جاري التحقق من البيانات...' : 'تسجيل الدخول'}
            </Button>

            {/* Divider */}
            <div className="relative my-4 text-center">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-[#E5EAF0]"></div>
              </div>
              <span className="relative bg-white px-3 text-xs text-slate-400 font-bold">أو</span>
            </div>

            {/* Mock Google Login Button */}
            <Button
              type="button"
              variant="outline"
              onClick={() => toast.info('تسجيل الدخول عبر Google متاح لحسابات المؤسسات الطبية')}
              className="w-full h-11 text-xs font-bold text-slate-700 border-[#E5EAF0] hover:bg-slate-50 rounded-xl flex items-center justify-center gap-2"
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
              تسجيل الدخول عبر Google
            </Button>
                    </>
            )}
          </form>

          {/* Footer Contact */}
          <div className="pt-4 border-t border-[#E5EAF0] text-center text-xs text-slate-400">
            ليس لديك حساب بعد؟{' '}
            <a
              href="https://wa.me/201012345678"
              target="_blank"
              rel="noreferrer"
              className="text-[#15B8A6] font-bold hover:underline"
            >
              تواصل مع إدارة المنصة
            </a>
          </div>

        </div>

      </div>
    </div>
  )
}
