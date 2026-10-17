'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { toast } from 'sonner'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import {
  CountryInfo,
  DEFAULT_COUNTRY,
  validatePhoneNumber,
  getPhoneSearchVariants
} from '@/lib/countryPhoneHelper'

export default function PatientLoginPage() {
  const router = useRouter()
  const params = useParams()
  const slug = (params?.slug as string) || 'zizo'
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [phone, setPhone] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(DEFAULT_COUNTRY)
  const [phoneError, setPhoneError] = useState(false)
  const [phoneErrorMsg, setPhoneErrorMsg] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // 1. Resolve clinic by slug
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (cSnap.empty && slug !== 'demo') {
        toast.error('العيادة غير موجودة أو غير متاحة حالياً')
        setLoading(false)
        return
      }

      const clinicDoc = cSnap.empty ? null : cSnap.docs[0]
      const clinicId = clinicDoc ? clinicDoc.id : 'demo'
      const cleanPhone = phone.trim().replace(/\s+/g, '')

      const isValidPhone = validatePhoneNumber(cleanPhone, selectedCountry)
      if (!isValidPhone) {
        setPhoneError(true)
        setPhoneErrorMsg(`يرجى إدخال رقم هاتف محمول صحيح لـ ${selectedCountry.nameAr} (${selectedCountry.placeholder})`)
        toast.error(`يرجى إدخال رقم هاتف محمول صحيح لـ ${selectedCountry.nameAr}`)
        setLoading(false)
        return
      }
      setPhoneError(false)
      setPhoneErrorMsg('')

      const phoneVariants = getPhoneSearchVariants(cleanPhone)

      if (mode === 'register') {
        if (!name.trim() || name.trim().length < 3) {
          toast.error('يرجى إدخال اسم المريض ثلاثي على الأقل')
          setLoading(false)
          return
        }

        const ageNum = parseInt(age.trim(), 10)
        if (!age.trim() || isNaN(ageNum) || ageNum <= 0 || ageNum > 120) {
          toast.error('يرجى إدخال سن صحيح بالسنوات (بين 1 و 120) لإنشاء الملف الطبي')
          setLoading(false)
          return
        }

        if (!password || password.length < 4) {
          toast.error('كلمة المرور يجب أن تكون 4 أحرف أو أرقام على الأقل')
          setLoading(false)
          return
        }

        if (confirmPassword && password !== confirmPassword) {
          toast.error('كلمة المرور وتأكيد كلمة المرور غير متطابقتين')
          setLoading(false)
          return
        }

        // Check if phone already registered in this clinic (matching any format)
        const checkQ = query(
          collection(db, 'patient_accounts'),
          where('clinic_id', '==', clinicId),
          where('phone', 'in', phoneVariants.slice(0, 10))
        )
        const checkSnap = await getDocs(checkQ)

        if (!checkSnap.empty) {
          toast.error('رقم الهاتف مسجل بالفعل في هذه العيادة. يرجى تسجيل الدخول.')
          setMode('login')
          setLoading(false)
          return
        }

        // Create new account with standardized international phone
        await addDoc(collection(db, 'patient_accounts'), {
          clinic_id: clinicId,
          name: name.trim(),
          phone: cleanPhone,
          age: age.trim(),
          password: password,
          createdAt: new Date().toISOString()
        })

        toast.success('تم إنشاء حسابك الطبي بنجاح!')

        localStorage.setItem(
          'patient_auth',
          JSON.stringify({
            phone: cleanPhone,
            name: name.trim(),
            age: age.trim(),
            clinic_id: clinicId,
            clinicSlug: slug
          })
        )

        router.push(`/clinic/${slug}/patient`)
      } else {
        // Mode: Login
        if (!password) {
          toast.error('يرجى كتابة كلمة المرور للدخول')
          setLoading(false)
          return
        }

        const loginQ = query(
          collection(db, 'patient_accounts'),
          where('clinic_id', '==', clinicId),
          where('phone', 'in', phoneVariants.slice(0, 10))
        )
        const loginSnap = await getDocs(loginQ)

        if (loginSnap.empty) {
          // Check if patient booked before in appointments collection
          const apptQ = query(
            collection(db, 'appointments'),
            where('clinic_id', '==', clinicId),
            where('phone', 'in', phoneVariants.slice(0, 10))
          )
          const apptSnap = await getDocs(apptQ)

          if (!apptSnap.empty) {
            const firstAppt = apptSnap.docs[0].data()
            const patientResolvedName = firstAppt.patientName || 'المريض'
            const patientResolvedAge = firstAppt.age || ''

            // Auto-activate account with this new password
            await addDoc(collection(db, 'patient_accounts'), {
              clinic_id: clinicId,
              name: patientResolvedName,
              phone: cleanPhone,
              age: patientResolvedAge,
              password: password,
              createdAt: new Date().toISOString()
            })

            toast.success('تم تفعيل حسابك الطبي وربطه بحجوزاتك السابقة بنجاح')
            localStorage.setItem(
              'patient_auth',
              JSON.stringify({
                phone: cleanPhone,
                name: patientResolvedName,
                age: patientResolvedAge,
                clinic_id: clinicId,
                clinicSlug: slug
              })
            )
            router.push(`/clinic/${slug}/patient`)
            return
          }

          toast.error('رقم الهاتف غير مسجل في هذه العيادة. يرجى إنشاء حساب جديد.')
          setMode('register')
          setLoading(false)
          return
        }

        const userDoc = loginSnap.docs[0]
        const userData = userDoc.data()

        if (userData.password && userData.password !== password) {
          toast.error('كلمة المرور غير صحيحة. يرجى المحاولة مرة أخرى.')
          setLoading(false)
          return
        }

        toast.success(`مرحباً بك ${userData.name || ''}`)
        localStorage.setItem(
          'patient_auth',
          JSON.stringify({
            phone: cleanPhone,
            name: userData.name || 'المريض',
            age: userData.age || '',
            clinic_id: clinicId,
            clinicSlug: slug
          })
        )
        router.push(`/clinic/${slug}/patient`)
      }
    } catch (err: any) {
      console.error('Patient login error:', err)
      toast.error('حدث خطأ أثناء تسجيل الدخول، يرجى التحقق من الاتصال والمحاولة ثانيةً')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#f4f9ff] dark:bg-[#050d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#081526] rounded-[32px] p-6 shadow-xl border border-sky-100 dark:border-slate-800 space-y-5">
        <div className="text-center space-y-1">
          <Link href={`/clinic/${slug}`} className="inline-block mb-2" dir="ltr">
            <ClinicLogo size="md" variant="auto" />
          </Link>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">بوابة المريض المعتمدة</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            الاطلاع على الكشوفات والروشتات السابقة وتتبع الدور المباشر
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2.5 rounded-xl transition-all ${
              mode === 'login' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-white shadow-sm font-extrabold' : 'text-slate-500'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2.5 rounded-xl transition-all ${
              mode === 'register' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-white shadow-sm font-extrabold' : 'text-slate-500'
            }`}
          >
            حساب مريض جديد
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">الاسم بالكامل *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">السن (بالسنوات - إجباري للروشتة) *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max="120"
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="28"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">رقم التليفون المحمول (واتساب) *</label>
            <PhoneInputWithCountry
              value={phone}
              onChange={(fullNumber, country, localNum) => {
                setPhone(fullNumber)
                setSelectedCountry(country)
                const valid = validatePhoneNumber(localNum, country)
                setPhoneError(!valid)
                if (!valid) {
                  setPhoneErrorMsg(`يرجى إدخال رقم هاتف محمول صحيح لـ ${country.nameAr} (${country.placeholder})`)
                } else {
                  setPhoneErrorMsg('')
                }
              }}
              hasError={phoneError}
              errorMessage={phoneErrorMsg}
              size="md"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">كلمة المرور *</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500 pl-11"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          {mode === 'register' && (
            <div>
              <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">تأكيد كلمة المرور *</label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                dir="ltr"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
              />
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-sm shadow-lg hover:shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-70"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>جاري التحقق والمزامنة...</span>
              </>
            ) : mode === 'login' ? (
              'تسجيل الدخول للملف الطبي'
            ) : (
              'إنشاء حساب والدخول'
            )}
          </button>

          <div className="pt-2 text-center">
            <Link
              href={`/clinic/${slug}`}
              className="text-xs font-bold text-slate-500 hover:text-sky-600 transition-colors inline-flex items-center gap-1"
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>العودة لصفحة العيادة الرئيسية</span>
            </Link>
          </div>

          <div className="pt-3 text-center text-[11px] text-slate-400 dark:text-slate-500 font-bold border-t border-slate-100 dark:border-slate-800">
            <span>جميع الحقوق محفوظة 2026 YallaCodex</span>
          </div>
        </form>
      </div>
    </div>
  )
}
