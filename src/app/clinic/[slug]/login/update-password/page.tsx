'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { updatePassword } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, LockKeyhole } from 'lucide-react'
import { motion } from 'framer-motion'

export default function UpdatePassword({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (password !== confirmPassword) {
      setError('كلمتا المرور غير متطابقتين. يرجى التأكد.')
      return
    }
    if (password.length < 8) {
      setError('يجب أن تتكون كلمة المرور من 8 أحرف على الأقل.')
      return
    }

    setIsLoading(true)
    setError(null)

    try {
      if (auth.currentUser) {
        await updatePassword(auth.currentUser, password)
        router.push(`/clinic/${slug}/admin`)
      } else {
        throw new Error("لم يتم العثور على مستخدم مسجل الدخول")
      }
    } catch (err: any) {
      setError(err.message || 'تعذر إتمام الطلب.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50 p-4" dir="rtl">
      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex justify-center mb-6">
          <div className="bg-primary/10 p-4 rounded-full">
            <LockKeyhole className="w-12 h-12 text-primary" />
          </div>
        </div>

        <Card className="w-full shadow-2xl border-t-4 border-t-primary">
          <CardHeader className="text-center">
            <CardTitle className="text-3xl font-bold">إعداد كلمة المرور</CardTitle>
            <CardDescription className="text-lg">يرجى اختيار كلمة مرور قوية وجديدة لحسابك</CardDescription>
          </CardHeader>
          <form onSubmit={handleUpdate}>
            <CardContent className="space-y-5">
              {error && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>عذراً</AlertTitle>
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}
              <div className="space-y-2">
                <Label htmlFor="password">كلمة المرور الجديدة</Label>
                <PasswordInput
                  id="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-12 text-lg"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm">تأكيد كلمة المرور</Label>
                <PasswordInput
                  id="confirm"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={isLoading}
                  className="h-12 text-lg border-primary/20 focus-visible:ring-primary"
                />
              </div>
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full h-14 text-xl font-bold rounded-xl" disabled={isLoading}>
                {isLoading ? 'جاري الحفظ...' : 'حفظ كلمة المرور والدخول'}
              </Button>
            </CardFooter>
          </form>
        </Card>
      </motion.div>
    </div>
  )
}
