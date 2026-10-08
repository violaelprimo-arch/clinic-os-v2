'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/phone-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Phone, Lock, HeartPulse } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

import { ArrowRight, ShieldCheck } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'

export default function PatientLogin({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [isRegistering, setIsRegistering] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      // Get clinic ID
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (cSnap.empty) {
        toast.error('العيادة غير موجودة')
        setIsLoading(false)
        return
      }
      const clinicId = cSnap.docs[0].id

      if (isRegistering) {
        // Check if phone already registered in this clinic
        const checkQ = query(collection(db, 'patient_accounts'), where('clinic_id', '==', clinicId), where('phone', '==', phone))
        const checkSnap = await getDocs(checkQ)
        if (!checkSnap.empty) {
          toast.error('رقم الهاتف مسجل بالفعل. يرجى تسجيل الدخول.')
          setIsLoading(false)
          return
        }

        // Create new account
        await addDoc(collection(db, 'patient_accounts'), {
          clinic_id: clinicId,
          name,
          phone,
          phone,
          createdAt: new Date().toISOString()
        })
        toast.success('تم إنشاء الحساب بنجاح!')
        
        // Auto login
        localStorage.setItem('patient_auth', JSON.stringify({ phone, name, clinic_id: clinicId }))
        router.push(`/clinic/${slug}/patient`)
      } else {
        // Login
        const loginQ = query(collection(db, 'patient_accounts'), where('clinic_id', '==', clinicId), where('phone', '==', phone), where('phone', '==', phone))
        const loginSnap = await getDocs(loginQ)
        if (loginSnap.empty) {
          toast.error('رقم الهاتف أو كلمة المرور غير صحيحة')
        } else {
          const userData = loginSnap.docs[0].data()
          toast.success('تم تسجيل الدخول بنجاح')
          localStorage.setItem('patient_auth', JSON.stringify({ phone: userData.phone, name: userData.name, clinic_id: clinicId }))
          router.push(`/clinic/${slug}/patient`)
        }
      }
    } catch (err) {
      toast.error('حدث خطأ في الاتصال')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F6F8FB] font-sans relative p-4 text-[#182230]" dir="rtl">
      {/* Floating Back Button */}
      <Link href={`/clinic/${slug}`} className="absolute top-6 right-6 z-50">
        <Button variant="outline" className="rounded-xl shadow-xs bg-white text-xs font-bold text-slate-700 hover:text-[#15B8A6] hover:bg-slate-50 border-[#E5EAF0] h-9 px-4">
          <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
          العودة للعيادة
        </Button>
      </Link>

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#15B8A6]/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      
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
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-50 text-[#15B8A6] text-xs font-bold border border-teal-100 mt-2">
            <ShieldCheck className="w-3.5 h-3.5" />
            <span>بوابة المريض المعتمدة</span>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            تابع تاريخك الطبي وكشوفاتك وروشتاتك السابقة برقم هاتفك
          </p>
        </div>

        {/* Auth Card */}
        <div className="medical-card p-6 sm:p-8 bg-white border border-[#E5EAF0] shadow-xl rounded-3xl space-y-6">
          
          {/* Mode Switcher Tabs */}
          <div className="grid grid-cols-2 p-1 bg-slate-100 rounded-xl">
            <button
              type="button"
              onClick={() => setIsRegistering(false)}
              className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                !isRegistering ? 'bg-white text-[#15B8A6] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              تسجيل الدخول
            </button>
            <button
              type="button"
              onClick={() => setIsRegistering(true)}
              className={`py-2 text-xs font-black rounded-lg transition-all cursor-pointer ${
                isRegistering ? 'bg-white text-[#15B8A6] shadow-xs' : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              مريض جديد (حساب جديد)
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {isRegistering && (
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">الاسم بالكامل</Label>
                <div className="relative">
                  <User className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <Input 
                    required 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder="اكتب اسمك الثلاثي" 
                    className="pr-10 h-11 text-xs bg-slate-50 rounded-xl border-[#E5EAF0] focus:bg-white"
                  />
                </div>
              </div>
            )}

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">رقم التليفون المحمول</Label>
              <div className="relative">
                <Phone className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <Input 
                  required 
                  type="tel"
                  value={phone} 
                  onChange={e => setPhone(e.target.value)} 
                  placeholder="01xxxxxxxxx" 
                  className="pr-10 h-11 text-xs bg-slate-50 rounded-xl border-[#E5EAF0] focus:bg-white text-left font-mono"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <PasswordInput 
                  required 
                  value={phone} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="pr-10 h-11 text-xs bg-slate-50 rounded-xl border-[#E5EAF0] focus:bg-white"
                />
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-11 text-xs font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/25 transition-all cursor-pointer"
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
          
          <div className="pt-2 border-t border-[#E5EAF0] text-center">
            <button 
              type="button" 
              onClick={() => setIsRegistering(!isRegistering)}
              className="text-xs text-[#15B8A6] font-bold hover:underline cursor-pointer"
            >
              {isRegistering ? 'لديك ملف مسجل بالفعل؟ سجل دخولك الآن' : 'أول زيارة للعيادة؟ أنشئ حسابك الطبي في ثوانٍ'}
            </button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
