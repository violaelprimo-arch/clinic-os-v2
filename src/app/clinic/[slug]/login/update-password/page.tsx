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
import { toast } from 'sonner'
import Link from 'next/link'

export default function UpdatePassword({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const router = useRouter()

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
      setError('يرجى إدخال البريد الإلكتروني للطبيب المسجل.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (snapshot.empty) {
        setError('لم يتم العثور على بيانات هذه العيادة.')
        return
      }

      const cDoc = snapshot.docs[0]
      const data = cDoc.data()
      const cleanInputEmail = email.trim().toLowerCase()
      const registeredEmail = (data.doctorEmail || '').trim().toLowerCase()

      if (registeredEmail && cleanInputEmail !== registeredEmail) {
        setError('البريد الإلكتروني المدخل لا يطابق البريد الإلكتروني المسجل لهذه العيادة.')
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
      toast.success('تم إرسال رمز التحقق (OTP) إلى بريدك الإلكتروني (Gmail) بنجاح!')
    } catch (err: any) {
      setError('حدث خطأ أثناء إرسال الطلب: ' + (err.message || ''))
    } finally {
      setIsLoading(false)
    }
  }

  // Step 2: Doctor verifies OTP and sets new password
  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)

    if (!otp.trim()) {
      setError('يرجى إدخال رمز التحقق OTP المرسل إلى بريدك الإلكتروني.')
      return
    }
    if (password.length < 6) {
      setError('يجب ألا تقل كلمة المرور الجديدة عن 6 خانات.')
      return
    }
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين.')
      return
    }

    setIsLoading(true)

    try {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (snapshot.empty) {
        setError('لم يتم العثور على بيانات العيادة.')
        return
      }

      const cDoc = snapshot.docs[0]
      const data = cDoc.data()

      if (!data.resetPasswordOtp || data.resetPasswordOtp.trim() !== otp.trim()) {
        setError('رمز التحقق (OTP) غير صحيح أو منتهي الصلاحية. يرجى التأكد من الرمز المستلم على بريدك الإلكتروني.')
        return
      }

      // Update password & clear OTP
      await updateDoc(doc(db, 'clinics', cDoc.id), {
        doctorPassword: password,
        resetPasswordOtp: null,
        resetPasswordRequestedAt: null
      })

      toast.success('تم تحديث كلمة المرور بنجاح! يتم الآن توجيهك لصفحة تسجيل الدخول...')
      setTimeout(() => {
        router.push(`/clinic/${slug}/login`)
      }, 1500)
    } catch (err: any) {
      setError('حدث خطأ أثناء حفظ كلمة المرور: ' + (err.message || ''))
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center font-sans p-4" dir="rtl">
      <div className="w-full max-w-md bg-white border border-[#E5EAF0] shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
        
        {/* Header */}
        <div className="text-center space-y-3">
          <ClinicLogo size="md" variant="light" />
          <div>
            <h1 className="text-xl font-black text-[#182230]">استعادة كلمة المرور (OTP)</h1>
            <p className="text-xs text-slate-500 mt-1">
              {step === 'request'
                ? 'أدخل بريدك الإلكتروني المسجل لاستلام رمز التحقق (OTP) على الجيميل'
                : 'أدخل رمز التحقق (OTP) المرسل إلى بريدك الإلكتروني مع كلمة المرور الجديدة'}
            </p>
          </div>
        </div>

        {error && (
          <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-800 rounded-xl text-xs">
            <AlertCircle className="h-4 w-4 text-rose-600" />
            <AlertTitle className="font-bold">تنبيه</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* STEP 1: Request OTP */}
        {step === 'request' && (
          <form onSubmit={handleRequestOtp} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">البريد الإلكتروني للطبيب المسجل</Label>
              <Input
                type="email"
                placeholder="doctor@clinic.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                dir="ltr"
                className="h-11 text-sm rounded-xl bg-[#F6F8FB]"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/20 transition-all cursor-pointer"
            >
              <KeyRound className="w-4 h-4 ml-2" />
              {isLoading ? 'جاري إرسال الرمز...' : 'إرسال رمز التحقق (OTP) إلى بريدي الإلكتروني'}
            </Button>
          </form>
        )}

        {/* STEP 2: Verify OTP & Enter New Password */}
        {step === 'verify' && (
          <form onSubmit={handleResetPassword} className="space-y-4">
            <div className="p-3.5 bg-teal-50 border border-teal-200 rounded-xl flex items-start gap-2.5">
              <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
              <p className="text-xs text-teal-900 font-medium leading-relaxed">
                تم إرسال كود التحقق <strong>OTP</strong> إلى بريدك الإلكتروني (Gmail). يرجى تفقد صندوق الوارد أو مجلد الرسائل غير المرغوب فيها (Spam) وكتابة الرمز بالأسفل.
              </p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">رمز التحقق (OTP) من البريد الإلكتروني</Label>
              <Input
                type="text"
                value={otp}
                onChange={e => setOtp(e.target.value)}
                placeholder="123456"
                required
                maxLength={6}
                dir="ltr"
                className="h-12 text-base text-center font-mono tracking-widest font-black rounded-xl bg-[#F6F8FB] border-amber-300 focus:border-[#15B8A6]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">كلمة المرور الجديدة</Label>
              <PasswordInput
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className="h-11 text-sm text-right rounded-xl bg-[#F6F8FB]"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">تأكيد كلمة المرور الجديدة</Label>
              <PasswordInput
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                dir="ltr"
                required
                className="h-11 text-sm text-right rounded-xl bg-[#F6F8FB]"
              />
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/20 transition-all cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4 ml-2" />
              {isLoading ? 'جاري الحفظ...' : 'تأكيد وحفظ كلمة المرور الجديدة'}
            </Button>

            <button
              type="button"
              onClick={() => setStep('request')}
              className="w-full text-center text-xs font-bold text-slate-400 hover:text-slate-600 pt-1"
            >
              إعادة إرسال رمز OTP إلى البريد الإلكتروني
            </button>
          </form>
        )}

        {/* Back Link */}
        <div className="text-center pt-2 border-t border-[#E5EAF0]">
          <Link
            href={`/clinic/${slug}/login`}
            className="text-xs font-bold text-slate-500 hover:text-[#15B8A6] inline-flex items-center gap-1"
          >
            <ArrowRight className="w-3.5 h-3.5" />
            العودة لصفحة تسجيل الدخول
          </Link>
        </div>

      </div>
    </div>
  )
}
