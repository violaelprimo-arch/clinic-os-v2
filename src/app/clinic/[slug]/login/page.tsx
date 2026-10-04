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
      await signInWithEmailAndPassword(auth, inputEmail, password)
      toast.success('تم تسجيل الدخول بنجاح')
      router.push(`/clinic/${slug}/admin`)
    } catch (err: any) {
      if (err.code === 'auth/invalid-credential' || err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password') {
        
        // 2. Fallback: Check if the owner just created this clinic and the user hasn't registered yet
        try {
          const q = query(collection(db, 'clinics'), where('slug', '==', slug))
          const snapshot = await getDocs(q)
          
          if (!snapshot.empty) {
            const clinicDoc = snapshot.docs[0].data()
            
            // Check if credentials match either doctor or assistant
            const isDoctor = clinicDoc.doctorEmail === inputEmail && clinicDoc.doctorPassword === password
            const isAssistant = clinicDoc.assistantEmail === inputEmail && clinicDoc.assistantPassword === password

            if (isDoctor || isAssistant) {
              // Auto-register them in Firebase Auth
              await createUserWithEmailAndPassword(auth, inputEmail, password)
              toast.success('تم تفعيل الحساب وتسجيل الدخول بنجاح!')
              // Store role in local storage for quick UI access
              localStorage.setItem('clinic_role', isDoctor ? 'doctor' : 'assistant')
              router.push(`/clinic/${slug}/admin`)
              return
            }
          }
          
          // If we reach here, no match in DB either
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
    <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans" dir="rtl">
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
