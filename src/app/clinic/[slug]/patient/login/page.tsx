'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  User, Phone, Lock, HeartPulse, ArrowRight,
  ShieldCheck, Eye, EyeOff, Calendar, AlertCircle
} from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { useLanguage } from '@/context/LanguageContext'

export default function PatientLogin({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const router = useRouter()
  const { t, dir } = useLanguage()

  const [isRegistering, setIsRegistering] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // 1. Get clinic ID
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (cSnap.empty) {
        toast.error('العيادة غير موجودة')
        setIsLoading(false)
        return
      }
      const clinicId = cSnap.docs[0].id
      const cleanPhone = phone.trim()

      if (isRegistering) {
        // Validation for registration
        if (!name.trim()) {
          toast.error('يرجى إدخال الاسم بالكامل')
          setIsLoading(false)
          return
        }

        if (!cleanPhone) {
          toast.error('يرجى إدخال رقم الهاتف المحمول')
          setIsLoading(false)
          return
        }

        // Mandatory age validation
        if (!age.trim()) {
          toast.error('السن إجباري لإنشاء الملف الطبي والروشتة')
          setIsLoading(false)
          return
        }

        const ageNum = parseInt(age.trim(), 10)
        if (isNaN(ageNum) || ageNum <= 0 || ageNum > 125) {
          toast.error('يرجى إدخال سن صحيح (بين 1 و 120 سنة)')
          setIsLoading(false)
          return
        }

        // Mandatory password validation
        if (!password || password.length < 4) {
          toast.error('يرجى إدخال كلمة مرور مكونة من 4 خانات على الأقل')
          setIsLoading(false)
          return
        }

        if (password !== confirmPassword) {
          toast.error('كلمة المرور وتأكيد كلمة المرور غير متطابقتين')
          setIsLoading(false)
          return
        }

        // Check if phone already registered in this clinic
        const checkQ = query(
          collection(db, 'patient_accounts'),
          where('clinic_id', '==', clinicId),
          where('phone', '==', cleanPhone)
        )
        const checkSnap = await getDocs(checkQ)
        if (!checkSnap.empty) {
          toast.error('رقم الهاتف مسجل بالفعل. يرجى تسجيل الدخول باستخدام كلمة المرور.')
          setIsRegistering(false)
          setIsLoading(false)
          return
        }

        // Create new account
        await addDoc(collection(db, 'patient_accounts'), {
          clinic_id: clinicId,
          name: name.trim(),
          phone: cleanPhone,
          age: age.trim(),
          password: password,
          createdAt: new Date().toISOString()
        })
        toast.success('تم إنشاء حسابك الطبي بنجاح!')

        // Auto login
        localStorage.setItem(
          'patient_auth',
          JSON.stringify({
            phone: cleanPhone,
            name: name.trim(),
            age: age.trim(),
            clinic_id: clinicId
          })
        )
        router.push(`/clinic/${slug}/patient`)
      } else {
        // Login mode
        if (!cleanPhone) {
          toast.error('يرجى إدخال رقم الهاتف المحمول')
          setIsLoading(false)
          return
        }

        if (!password) {
          toast.error('يرجى إدخال كلمة المرور')
          setIsLoading(false)
          return
        }

        const loginQ = query(
          collection(db, 'patient_accounts'),
          where('clinic_id', '==', clinicId),
          where('phone', '==', cleanPhone)
        )
        const loginSnap = await getDocs(loginQ)

        if (loginSnap.empty) {
          // Check if patient exists in appointments collection (first-time web portal login)
          const apptQ = query(
            collection(db, 'appointments'),
            where('clinic_id', '==', clinicId),
            where('phone', '==', cleanPhone)
          )
          const apptSnap = await getDocs(apptQ)

          if (!apptSnap.empty) {
            // Found existing appointments -> activate patient account with this password
            const firstAppt = apptSnap.docs[0].data()
            await addDoc(collection(db, 'patient_accounts'), {
              clinic_id: clinicId,
              name: firstAppt.patientName || 'المريض',
              phone: cleanPhone,
              age: firstAppt.age || '',
              password: password,
              createdAt: new Date().toISOString()
            })

            toast.success('تم تفعيل حسابك الطبي وتعيين كلمة المرور بنجاح')
            localStorage.setItem(
              'patient_auth',
              JSON.stringify({
                phone: cleanPhone,
                name: firstAppt.patientName || 'المريض',
                age: firstAppt.age || '',
                clinic_id: clinicId
              })
            )
            router.push(`/clinic/${slug}/patient`)
            return
          }

          toast.error('رقم الهاتف غير مسجل في هذه العيادة. يرجى إنشاء حساب جديد.')
          setIsLoading(false)
          return
        }

        const userDoc = loginSnap.docs[0]
        const userData = userDoc.data()

        // Verify password
        if (userData.password) {
          if (userData.password !== password) {
            toast.error('كلمة المرور غير صحيحة')
            setIsLoading(false)
            return
          }
        } else {
          // Account registered previously without password, update with newly entered password
          await updateDoc(doc(db, 'patient_accounts', userDoc.id), {
            password: password
          })
        }

        toast.success('تم تسجيل الدخول بنجاح')
        localStorage.setItem(
          'patient_auth',
          JSON.stringify({
            phone: userData.phone,
            name: userData.name,
            age: userData.age || '',
            clinic_id: clinicId
          })
        )
        router.push(`/clinic/${slug}/patient`)
      }
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ في الاتصال بالخادم')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background font-sans relative p-4 text-foreground" dir={dir}>
      {/* Floating Back Button */}
      <Link href={`/clinic/${slug}`} className="absolute top-6 right-6 z-50">
        <Button variant="outline" className="rounded-xl shadow-xs bg-card text-xs font-bold text-foreground hover:text-primary hover:bg-muted/40 border-border h-9 px-4">
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          العودة للعيادة
        </Button>
      </Link>

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md relative z-10"
      >
        <div className="text-center mb-6 space-y-2">
          <Link href={`/clinic/${slug}`} className="inline-block">
            <ClinicLogo size="md" variant="light" />
          </Link>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 mt-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>بوابة المريض المعتمدة</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            تابع تاريخك الطبي وكشوفاتك وروشتاتك السابقة برقم هاتفك وكلمة المرور
          </p>
        </div>

        {/* Auth Card */}
        <div className="yalla-card p-6 sm:p-8 shadow-xl rounded-3xl space-y-6 border border-border">
          
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-muted/60 rounded-xl">
            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                !isRegistering ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                isRegistering ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              مريض جديد (حساب جديد)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <>
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    الاسم بالكامل <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      required 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      placeholder="اكتب اسمك الثلاثي" 
                      className="pr-10 h-11 text-xs bg-background rounded-xl border-border"
                    />
                  </div>
                </div>

                {/* Age - MANDATORY */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-muted-foreground">
                      السن (بالسنوات) <span className="text-rose-500">*</span>
                    </Label>
                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                      إجباري للروشتة
                    </span>
                  </div>
                  <div className="relative">
                    <Calendar className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      required 
                      type="number"
                      min={1}
                      max={120}
                      value={age} 
                      onChange={e => setAge(e.target.value)} 
                      placeholder="مثال: 28" 
                      className="pr-10 h-11 text-xs bg-background rounded-xl border-border text-right font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Phone Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                رقم التليفون المحمول <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  required 
                  type="tel"
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="01xxxxxxxxx" 
                  className="pr-10 h-11 text-xs bg-background rounded-xl border-border text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                كلمة المرور <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  required 
                  type={showPassword ? 'text' : 'password'}
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder={isRegistering ? 'اكتب كلمة مرور قوية (4 خانات فأكثر)' : 'أدخل كلمة المرور'} 
                  className="pr-10 pl-10 h-11 text-xs bg-background rounded-xl border-border text-left font-mono"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Registration Only) */}
            {isRegistering && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">
                  تأكيد كلمة المرور <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    required 
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    placeholder="أعد كتابة كلمة المرور للتأكيد" 
                    className="pr-10 pl-10 h-11 text-xs bg-background rounded-xl border-border text-left font-mono"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                  >
                    {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
            )}

            <Button
              type="submit"
              className="w-full h-11 text-xs font-black yalla-gradient-btn text-white rounded-xl shadow-xs cursor-pointer"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>جاري التحقق...</span>
                </div>
              ) : (
                isRegistering ? 'إنشاء حساب والدخول' : 'تسجيل الدخول للملف الطبي'
              )}
            </Button>
          </form>
          
          <div className="pt-2 border-t border-border text-center">
            <button 
              type="button" 
              onClick={() => {
                setIsRegistering(!isRegistering)
                setPassword('')
                setConfirmPassword('')
              }}
              className="text-xs text-primary font-bold hover:underline cursor-pointer"
            >
              {isRegistering ? 'لديك ملف مسجل بالفعل؟ سجل دخولك الآن' : 'أول زيارة للعيادة؟ أنشئ حسابك الطبي في ثوانٍ'}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          جميع الحقوق محفوظة YallaCodeX 2026
        </div>
      </motion.div>
    </div>
  )
}

