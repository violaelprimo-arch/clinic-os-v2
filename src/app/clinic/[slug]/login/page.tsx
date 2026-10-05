'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth, db } from '@/lib/firebase'
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { PasswordInput } from '@/components/ui/password-input'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, Stethoscope } from 'lucide-react'
import { motion } from 'framer-motion'
import { toast } from 'sonner'
import Link from 'next/link'

export default function DoctorLogin({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const inputEmail = email.trim()

    try {
      // 1. Try normal Firebase Auth login
      let loginSuccess = false
      try {
        await signInWithEmailAndPassword(auth, inputEmail, password)
        loginSuccess = true
      } catch (err: any) {
        if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
          loginSuccess = false // We will try fallback below
        } else {
          throw err // Re-throw other errors
        }
      }

      // Check DB for role
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      
      if (!snapshot.empty) {
        const clinicDoc = snapshot.docs[0].data()
        const isDoctor = clinicDoc.doctorEmail === inputEmail && clinicDoc.doctorPassword === password
        let isAssistant = clinicDoc.assistantEmail === inputEmail && clinicDoc.assistantPassword === password

        if (!isAssistant && clinicDoc.assistants) {
          const matchedAss = clinicDoc.assistants.find((a: any) => a.email === inputEmail && a.password === password)
          if (matchedAss) isAssistant = true;
        }

        if (isDoctor || isAssistant) {
          if (!loginSuccess) {
            // Auto-register them in Firebase Auth if fallback
            await createUserWithEmailAndPassword(auth, inputEmail, password)
            toast.success('تم تفعيل الحساب وتسجيل الدخول بنجاح!')
          } else {
            toast.success('تم تسجيل الدخول بنجاح')
          }
          
          // ALWAYS Store role in local storage
          localStorage.setItem('clinic_role', isDoctor ? 'doctor' : 'assistant')
          router.push(`/clinic/${slug}/admin`)
          return
        } else if (loginSuccess) {
           // They logged in successfully to Firebase Auth but they don't belong to this clinic anymore (password changed or removed)
           setError('بيانات الاعتماد غير صالحة لهذه العيادة أو تم تغييرها.')
           return
        }
      }
      
      if (!loginSuccess) {
        setError('البريد الإلكتروني أو كلمة المرور غير صحيحة.')
      }
    } catch (err: any) {
      setError(err.message || 'فشل الاتصال بالخادم.')
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
          <div className="mx-auto w-16 h-16 bg-primary rounded-2xl flex items-center justify-center shadow-lg shadow-primary/30 mb-4 rotate-3 hover:rotate-0 transition-transform">
            <Stethoscope className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900">تسجيل الدخول</h1>
          <p className="text-slate-500 mt-2">مرحباً بك في نظام إدارة العيادة الذكية</p>
        </div>

        <Card className="shadow-2xl border-t-4 border-t-primary">
          <CardHeader>
            <CardTitle>بوابة الطاقم الطبي</CardTitle>
            <CardDescription>أدخل البريد الإلكتروني وكلمة المرور المحددة من الإدارة</CardDescription>
          </CardHeader>
          <form onSubmit={handleLogin}>
            <CardContent className="space-y-6">
              {error && (
                <Alert variant="destructive" className="bg-red-50 border-red-200">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>خطأ</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              
              <div className="space-y-2">
                <Label htmlFor="email">البريد الإلكتروني</Label>
                <Input 
                  id="email" 
                  type="email" 
                  placeholder="doctor@clinic.com" 
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  dir="ltr"
                  className="text-right h-12"
                />
              </div>
              <div className="space-y-2">
                <div className="flex justify-between items-center">
                  <Label htmlFor="password">كلمة المرور</Label>
                </div>
                <PasswordInput 
                  id="password" 
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  dir="ltr"
                  className="text-right h-12"
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-4">
              <Button type="submit" className="w-full h-12 text-lg font-bold rounded-full shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition-all" disabled={isLoading}>
                {isLoading ? 'جاري التحقق...' : 'دخول'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
