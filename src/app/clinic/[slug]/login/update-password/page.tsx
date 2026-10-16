'use client'

import { use, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, doc, updateDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, KeyRound, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { useLanguage } from '@/context/LanguageContext'
import { toast } from 'sonner'
import Link from 'next/link'

export default function UpdatePassword({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const router = useRouter()
  const { t, isRtl, dir } = useLanguage()

  const [clinic, setClinic] = useState<any>(null)
  const [email, setEmail] = useState('')
  const [otp, setOtp] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [step, setStep] = useState<'request' | 'verify'>('request')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const data: any = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() }
          setClinic(data)
          // If there is already an active OTP pending for this clinic, let them jump to verify
          if (data.resetPasswordOtp) {
            setStep('verify')
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchClinic()
  }, [slug])

  // Step 1: Doctor requests OTP
  const handleRequestOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) {
      setError(isRtl ? 'يرجى إدخال البريد الإلكتروني للطبيب المسجل.' : 'Please enter registered physician email.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (snapshot.empty) {
        setError(isRtl ? 'لم يتم العثور على بيانات هذه العيادة.' : 'Clinic records not found.')
        return
      }

      const cDoc = snapshot.docs[0]
      const data = cDoc.data()
      const cleanInputEmail = email.trim().toLowerCase()
      const registeredEmail = (data.doctorEmail || '').trim().toLowerCase()

      if (registeredEmail && cleanInputEmail !== registeredEmail) {
        setError(isRtl ? 'البريد الإلكتروني المدخل لا يطابق البريد الإلكتروني المسجل لهذه العيادة.' : 'Email entered does not match registered clinic email.')
        return
      }

      // Generate 6-digit OTP
      const generatedOtp = Math.floor(100000 + Math.random() * 900000).toString()

      // Save OTP to Firestore
      await updateDoc(doc(db, 'clinics', cDoc.id), {
        resetPasswordOtp: generatedOtp,
        resetPasswordRequestedAt: new Date().toISOString()
      })

      // Send OTP to Doctor's Gmail via API
      try {
        await fetch('/api/send-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            email: cleanInputEmail,
            otp: generatedOtp,
            doctorName: data.doctorName,
            clinicName: data.clinicName
          })
        })
      } catch (sendErr) {
        console.warn('send-otp fetch warning:', sendErr)
      }

      setClinic((prev: any) => ({ ...prev, resetPasswordOtp: generatedOtp }))
      setStep('verify')
      toast.success(isRtl ? 'تم إرسال رمز التحقق (OTP) إلى بريدك الإلكتروني بنجاح!' : 'OTP code sent to your email successfully!')
    } catch (err: any) {
      setError((isRtl ? 'حدث خطأ أثناء إرسال الطلب: ' : 'Error sending request: ') + (err.message || ''))
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Doctor verifies OTP and sets new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!otp.trim()) {
      setError(isRtl ? 'يرجى إدخال رمز التحقق OTP المرسل إلى بريدك الإلكتروني.' : 'Please enter OTP verification code.')
      return
    }
    if (password.length < 6) {
      setError(isRtl ? 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات.' : 'Password must be at least 6 characters.')
      return
    }
    if (password !== confirmPassword) {
      setError(isRtl ? 'كلمتا المرور غير متطابقتين.' : 'Passwords do not match.')
      return
    }

    setIsLoading(true)

    try {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (snapshot.empty) {
        setError(isRtl ? 'لم يتم العثور على بيانات العيادة.' : 'Clinic data not found.')
        return
      }

      const cDoc = snapshot.docs[0]
      const data = cDoc.data()

      if (!data.resetPasswordOtp || data.resetPasswordOtp.trim() !== otp.trim()) {
        setError(isRtl ? 'رمز التحقق (OTP) غير صحيح أو منتهي الصلاحية.' : 'Invalid or expired OTP code.')
        return
      }

      // Update password & clear OTP
      await updateDoc(doc(db, 'clinics', cDoc.id), {
        doctorPassword: password,
        resetPasswordOtp: null,
        resetPasswordRequestedAt: null
      })

      toast.success(isRtl ? 'تم تحديث كلمة المرور بنجاح! يتم الآن توجيهك لصفحة تسجيل الدخول...' : 'Password updated successfully! Redirecting to sign in...')
      setTimeout(() => {
        router.push(`/clinic/${slug}/login`)
      }, 1500)
    } catch (err: any) {
      setError((isRtl ? 'حدث خطأ أثناء حفظ كلمة المرور: ' : 'Error saving password: ') + (err.message || ''))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center font-sans p-4 transition-colors" dir={dir}>
      
      {/* Top Floating Controls */}
      <div className="w-full max-w-md flex justify-between items-center mb-4">
        <Link
          href={`/clinic/${slug}/login`}
          className="inline-flex items-center gap-1.5 text-xs font-bold text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowRight className="w-4 h-4 rtl:rotate-0 ltr:rotate-180" />
          <span>{isRtl ? 'العودة لتسجيل الدخول' : 'Back to Login'}</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>

      <div className="w-full max-w-md bg-card border border-border shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <ClinicLogo size="md" variant="light" />
          <div>
            <h1 className="text-xl font-black text-foreground">
              {isRtl ? 'استعادة كلمة المرور (OTP)' : 'Reset Password (OTP)'}
            </h1>
            <p className="text-xs text-muted-foreground mt-1">
              {step === 'request'
                ? (isRtl ? 'أدخل بريدك الإلكتروني المسجل لاستلام رمز التحقق (OTP) على بريدك الإلكتروني' : 'Enter your registered email to receive an OTP verification code')
                : (isRtl ? 'أدخل رمز التحقق (OTP) المرسل إلى بريدك الإلكتروني مع كلمة المرور الجديدة' : 'Enter the OTP code sent to your email along with your new password')}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-rose-500/10 border-rose-500/20 text-rose-700 dark:text-rose-400 rounded-xl text-xs">
            <AlertCircle className="h-4 w-4 text-rose-600 dark:text-rose-400" />
            <AlertTitle className="font-bold">{isRtl ? 'تنبيه' : 'Alert'}</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* STEP 1: Request OTP */}
        {step === 'request' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                {isRtl ? 'البريد الإلكتروني للطبيب المسجل' : 'Registered Physician Email'}
              </Label>
              <Input
                type="email"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                dir="ltr"
                className="h-11 text-sm rounded-xl bg-background border-border"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-black yalla-gradient-btn text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <KeyRound className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
              {isLoading ? (isRtl ? 'جاري إرسال الرمز...' : 'Sending Code...') : (isRtl ? 'إرسال رمز التحقق (OTP) إلى بريدي الإلكتروني' : 'Send OTP Verification Code')}
            </Button>
          </form>
        )}

        {/* STEP 2: Verify OTP & Enter New Password */}
        {step === 'verify' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-3.5 bg-primary/10 border border-primary/20 rounded-xl flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-primary shrink-0 mt-0.5" />
              <p className="text-xs text-foreground font-medium leading-relaxed">
                {isRtl
                  ? 'تم إرسال كود التحقق OTP إلى بريدك الإلكتروني. يرجى تفقد صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam) وكتابة الرمز بالأسفل.'
                  : 'OTP verification code has been sent to your email. Please check your inbox or spam folder and enter the code below.'}
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                {isRtl ? 'رمز التحقق (OTP) من البريد الإلكتروني' : 'OTP Code from Email'}
              </Label>
              <Input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="123456"
                required
                maxLength={6}
                dir="ltr"
                className="h-12 text-base text-center font-mono tracking-widest font-black rounded-xl bg-background border-border focus:border-primary"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                {isRtl ? 'كلمة المرور الجديدة' : 'New Password'}
              </Label>
              <PasswordInput
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className={`h-11 text-sm ${isRtl ? 'text-right' : 'text-left'} rounded-xl bg-background border-border`}
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                {isRtl ? 'تأكيد كلمة المرور الجديدة' : 'Confirm New Password'}
              </Label>
              <PasswordInput
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className={`h-11 text-sm ${isRtl ? 'text-right' : 'text-left'} rounded-xl bg-background border-border`}
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-black yalla-gradient-btn text-white rounded-xl shadow-xs transition-all cursor-pointer"
            >
              <CheckCircle2 className={`w-4 h-4 ${isRtl ? 'ml-2' : 'mr-2'}`} />
              {isLoading ? (isRtl ? 'جاري الحفظ...' : 'Saving...') : (isRtl ? 'تأكيد وحفظ كلمة المرور الجديدة' : 'Confirm and Save New Password')}
            </Button>

            <button
              type="button"
              onClick={() => setStep('request')}
              className="w-full text-center text-xs font-bold text-muted-foreground hover:text-foreground pt-1"
            >
              {isRtl ? 'إعادة إرسال رمز OTP إلى البريد الإلكتروني' : 'Resend OTP to Email'}
            </button>
          </form>
        )}

        {/* Back Link */}
        <div className="text-center pt-2 border-t border-border">
          <Link
            href={`/clinic/${slug}/login`}
            className="text-xs font-bold text-muted-foreground hover:text-primary inline-flex items-center gap-1"
          >
            <ArrowRight className="w-3.5 h-3.5 rtl:rotate-0 ltr:rotate-180" />
            {isRtl ? 'العودة لصفحة تسجيل الدخول' : 'Back to Login Page'}
          </Link>
        </div>

      </div>
    </div>
  )
}
