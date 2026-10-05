'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { User, Phone, Lock, HeartPulse } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

export default function PatientLogin({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [isRegistering, setIsRegistering] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
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
          password, // In a real prod app, hash this!
          createdAt: new Date().toISOString()
        })
        toast.success('تم إنشاء الحساب بنجاح!')
        
        // Auto login
        localStorage.setItem('patient_auth', JSON.stringify({ phone, name, clinic_id: clinicId }))
        router.push(`/clinic/${slug}/patient`)
      } else {
        // Login
        const loginQ = query(collection(db, 'patient_accounts'), where('clinic_id', '==', clinicId), where('phone', '==', phone), where('password', '==', password))
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans relative" dir="rtl">
      {/* Floating Back Button */}
      <Link href={`/clinic/${slug}`} className="absolute top-6 right-6 z-50">
        <Button variant="outline" className="rounded-full shadow-sm bg-white/80 backdrop-blur font-bold text-slate-700 hover:text-primary hover:bg-white border-slate-200">
          العودة للصفحة الرئيسية
        </Button>
      </Link>

      <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-primary/5 rounded-full blur-3xl mix-blend-multiply opacity-70 pointer-events-none -translate-y-1/2 translate-x-1/3"></div>
      
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }} className="w-full max-w-md p-4 relative z-10">
        <div className="text-center mb-8">
          <Link href={`/clinic/${slug}`}>
            <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-4 rotate-3 hover:rotate-0 transition-transform cursor-pointer">
              <HeartPulse className="w-8 h-8 text-white" />
            </div>
          </Link>
          <h1 className="text-3xl font-bold text-slate-900">بوابة المريض</h1>
          <p className="text-slate-500 mt-2">تابع تاريخك الطبي وروشتاتك بكل سهولة</p>
        </div>

        <Card className="shadow-2xl border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle className="text-xl text-center">
              {isRegistering ? 'إنشاء حساب جديد' : 'تسجيل الدخول'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {isRegistering && (
                <div className="space-y-2">
                  <Label>الاسم بالكامل</Label>
                  <div className="relative">
                    <User className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                    <Input 
                      required 
                      value={name} 
                      onChange={e => setName(e.target.value)} 
                      placeholder="اكتب اسمك الثلاثي" 
                      className="pr-10 h-12 bg-slate-50"
                    />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label>رقم التليفون</Label>
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
                  <Input 
                    required 
                    type="tel"
                    value={phone} 
                    onChange={e => setPhone(e.target.value)} 
                    placeholder="01xxxxxxxxx" 
                    className="pr-10 h-12 bg-slate-50 text-left"
                    dir="ltr"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>كلمة المرور</Label>
                <div className="relative">
                  <Lock className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 z-10" />
                  <PasswordInput 
                    required 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    placeholder="••••••••" 
                    className="pr-10 h-12 bg-slate-50"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full h-12 text-lg font-bold shadow-lg" disabled={isLoading}>
                {isLoading ? 'جاري التحميل...' : (isRegistering ? 'إنشاء حساب' : 'دخول')}
              </Button>
            </form>
            
            <div className="mt-6 text-center">
              <button 
                type="button" 
                onClick={() => setIsRegistering(!isRegistering)}
                className="text-primary font-bold hover:underline"
              >
                {isRegistering ? 'لديك حساب بالفعل؟ سجل دخولك' : 'مريض جديد؟ إنشاء حساب الآن'}
              </button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  )
}
