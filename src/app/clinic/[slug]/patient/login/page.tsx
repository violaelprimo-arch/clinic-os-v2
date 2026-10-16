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
  const { t, dir, isRtl } = useLanguage()

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
        toast.error(isRtl ? 'العيادة غير موجودة' : 'Clinic not found')
        setIsLoading(false)
        return
      }
      const clinicId = cSnap.docs[0].id
      const cleanPhone = phone.trim()

      if (isRegistering) {
        // Validation for registration
        if (!name.trim()) {
          toast.error(isRtl ? 'يرجى إدخال الاسم بالكامل' : 'Please enter full name')
          setIsLoading(false)
          return
        }

        if (!cleanPhone) {
          toast.error(isRtl ? 'يرجى إدخال رقم الهاتف المحمول' : 'Please enter mobile phone number')
          setIsLoading(false)
          return
        }

        // Mandatory age validation
        if (!age.trim()) {
          toast.error(isRtl ? 'السن إجباري لإنشاء الملف الطبي والروشتة' : 'Age is required for medical file and Rx')
          setIsLoading(false)
          return
        }

        const ageNum = parseInt(age.trim(), 10)
        if (isNaN(ageNum) || ageNum <= 0 || ageNum > 125) {
          toast.error(isRtl ? 'يرجى إدخال سن صحيح (بين 1 و 120 سنة)' : 'Please enter a valid age (1-120)')
          setIsLoading(false)
          return
        }

        // Mandatory password validation
        if (!password || password.length < 4) {
          toast.error(isRtl ? 'يرجى إدخال كلمة مرور مكونة من 4 خانات على الأقل' : 'Please enter a password with at least 4 characters')
          setIsLoading(false)
          return
        }

        if (password !== confirmPassword) {
          toast.error(isRtl ? 'كلمة المرور وتأكيد كلمة المرور غير متطابقتين' : 'Passwords do not match')
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
          toast.error(isRtl ? 'رقم الهاتف مسجل بالفعل. يرجى تسجيل الدخول باستخدام كلمة المرور.' : 'Phone number is already registered. Please sign in.')
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
        toast.success(isRtl ? 'تم إنشاء حسابك الطبي بنجاح!' : 'Medical account created successfully!')

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
          toast.error(isRtl ? 'يرجى إدخال رقم الهاتف المحمول' : 'Please enter mobile phone number')
          setIsLoading(false)
          return
        }

        if (!password) {
          toast.error(isRtl ? 'يرجى إدخال كلمة المرور' : 'Please enter password')
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
              name: firstAppt.patientName || (isRtl ? 'المريض' : 'Patient'),
              phone: cleanPhone,
              age: firstAppt.age || '',
              password: password,
              createdAt: new Date().toISOString()
            })

            toast.success(isRtl ? 'تم تفعيل حسابك الطبي وتعيين كلمة المرور بنجاح' : 'Medical account activated successfully')
            localStorage.setItem(
              'patient_auth',
              JSON.stringify({
                phone: cleanPhone,
                name: firstAppt.patientName || (isRtl ? 'المريض' : 'Patient'),
                age: firstAppt.age || '',
                clinic_id: clinicId
              })
            )
            router.push(`/clinic/${slug}/patient`)
            return
          }

          toast.error(isRtl ? 'رقم الهاتف غير مسجل في هذه العيادة. يرجى إنشاء حساب جديد.' : 'Phone number is not registered. Please create a new account.')
          setIsLoading(false)
          return
        }

        const userDoc = loginSnap.docs[0]
        const userData = userDoc.data()

        // Verify password
        if (userData.password) {
          if (userData.password !== password) {
            toast.error(isRtl ? 'كلمة المرور غير صحيحة' : 'Incorrect password')
            setIsLoading(false)
            return
          }
        } else {
          // Account registered previously without password, update with newly entered password
          await updateDoc(doc(db, 'patient_accounts', userDoc.id), {
            password: password
          })
        }

        toast.success(isRtl ? 'تم تسجيل الدخول بنجاح' : 'Signed in successfully')
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
      toast.error(isRtl ? 'حدث خطأ في الاتصال بالخادم' : 'Server connection error')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background font-sans relative p-4 text-foreground" dir={dir}>
      {/* Floating Back Button */}
      <Link href={`/clinic/${slug}`} className="absolute top-6 rtl:right-6 ltr:left-6 z-50">
        <Button variant="outline" className="rounded-xl shadow-xs bg-card text-xs font-bold text-foreground hover:text-primary hover:bg-muted/40 border-border h-9 px-4">
          <ArrowRight className="w-3.5 h-3.5 rtl:ml-1.5 ltr:mr-1.5 rtl:rotate-0 ltr:rotate-180" />
          {t('return_to_clinic', 'العودة للعيادة')}
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
            <ClinicLogo size="md" variant="auto" />
          </Link>
          <div>
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20 mt-2">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>{t('patient_portal_verified', 'بوابة المريض المعتمدة')}</span>
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {t('patient_login_desc', 'تابع تاريخك الطبي وكشوفاتك وروشتاتك السابقة برقم هاتفك وكلمة المرور')}
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
              {t('sign_in', 'تسجيل الدخول')}
            </button>
            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                isRegistering ? 'bg-card text-primary shadow-xs' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {t('new_patient_account', 'مريض جديد (حساب جديد)')}
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <>
                {/* Full Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    {t('full_name_label', 'الاسم بالكامل')} <span className="text-rose-500">*</span>
                  </Label>
                  <div className="relative">
                    <User className="absolute rtl:right-3.5 ltr:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      required 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      placeholder={t('enter_triple_name', 'اكتب اسمك الثلاثي')} 
                      className="rtl:pr-10 ltr:pl-10 h-11 text-xs bg-background rounded-xl border-border"
                    />
                  </div>
                </div>

                {/* Age - MANDATORY */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {t('age_years_label', 'السن (بالسنوات)')} <span className="text-rose-500">*</span>
                    </Label>
                    <span className="text-[10px] font-black text-rose-600 dark:text-rose-400 bg-rose-500/10 px-2 py-0.5 rounded-md border border-rose-500/20">
                      {t('mandatory_for_rx', 'إجباري للروشتة')}
                    </span>
                  </div>
                  <div className="relative">
                    <Calendar className="absolute rtl:right-3.5 ltr:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input 
                      required 
                      type="number"
                      min={1}
                      max={120}
                      value={age} 
                      onChange={e => setAge(e.target.value)} 
                      placeholder="28" 
                      className="rtl:pr-10 ltr:pl-10 h-11 text-xs bg-background rounded-xl border-border text-start font-mono"
                    />
                  </div>
                </div>
              </>
            )}

            {/* Phone Number */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                {t('mobile_phone_label', 'رقم التليفون المحمول')} <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Phone className="absolute rtl:right-3.5 ltr:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  required 
                  type="tel"
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="01xxxxxxxxx" 
                  className="rtl:pr-10 ltr:pl-10 h-11 text-xs bg-background rounded-xl border-border text-start font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">
                {t('password_label', 'كلمة المرور')} <span className="text-rose-500">*</span>
              </Label>
              <div className="relative">
                <Lock className="absolute rtl:right-3.5 ltr:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input 
                  required 
                  type={showPassword ? 'text' : 'password'}
                  value={password} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder={isRegistering ? t('strong_password_hint', 'اكتب كلمة مرور قوية (4 خانات فأكثر)') : t('password_label', 'أدخل كلمة المرور')} 
                  className="rtl:pr-10 rtl:pl-10 ltr:pl-10 ltr:pr-10 h-11 text-xs bg-background rounded-xl border-border text-start font-mono"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute rtl:left-3.5 ltr:right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {/* Confirm Password (Registration Only) */}
            {isRegistering && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-muted-foreground">
                  {t('confirm_password_label', 'تأكيد كلمة المرور')} <span className="text-rose-500">*</span>
                </Label>
                <div className="relative">
                  <Lock className="absolute rtl:right-3.5 ltr:left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input 
                    required 
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword} 
                    onChange={e => setConfirmPassword(e.target.value)} 
                    placeholder={t('retype_password', 'أعد كتابة كلمة المرور للتأكيد')} 
                    className="rtl:pr-10 rtl:pl-10 ltr:pl-10 ltr:pr-10 h-11 text-xs bg-background rounded-xl border-border text-start font-mono"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute rtl:left-3.5 ltr:right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
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
                  <span>{isRtl ? 'جاري التحقق...' : 'Verifying...'}</span>
                </div>
              ) : (
                isRegistering ? t('create_account_and_enter', 'إنشاء حساب والدخول') : t('sign_in_medical_profile', 'تسجيل الدخول للملف الطبي')
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
              {isRegistering ? t('already_registered_prompt', 'لديك ملف مسجل بالفعل؟ سجل دخولك الآن') : t('first_visit_prompt', 'أول زيارة للعيادة؟ أنشئ حسابك الطبي في ثوانٍ')}
            </button>
          </div>
        </div>

        <div className="mt-6 text-center text-xs text-muted-foreground">
          {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}
        </div>
      </motion.div>
    </div>
  )
}

