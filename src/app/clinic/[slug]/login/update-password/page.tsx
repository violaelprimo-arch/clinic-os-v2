'use client'

import { use, useState } from 'react'
import { useRouter } from 'next/navigation'
import { auth } from '@/lib/firebase'
import { updatePassword } from 'firebase/auth'
import { Button } from '@/components/ui/button'
import { PasswordInput } from '@/components/ui/password-input'
import { Label } from '@/components/ui/label'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { AlertCircle, LockKeyhole, ArrowRight, ShieldCheck } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import Link from 'next/link'

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
        throw new Error('لم يتم العثور على مستخدم مسجل الدخول حالياً')
      }
    } catch (err: any) {
      setError(err.message || 'تعذر إتمام الطلب.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center font-sans p-4" dir="rtl">
      <div className="w-full max-w-md bg-white border border-[#E5EAF0] shadow-xl rounded-3xl p-6 sm:p-8 space-y-6">
        
        <div className="text-center space-y-3">
          <ClinicLogo size="md" variant="light" />
          <div>
            <h1 className="text-xl font-black text-[#182230]">إعادة تعيين كلمة المرور</h1>
            <p className="text-xs text-slate-400 mt-0.5">اختر كلمة مرور جديدة وقوية لحساب العيادة</p>
          </div>
        </div>

        <form onSubmit={handleUpdate} className="space-y-4">
          {error && (
            <Alert variant="destructive" className="bg-rose-50 border-rose-200 text-rose-800 rounded-xl text-xs">
              <AlertCircle className="h-4 w-4" />
              <AlertTitle className="font-bold">تنبيه</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

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
            className="w-full h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/20 transition-all mt-2"
          >
            {isLoading ? 'جاري الحفظ...' : 'حفظ كلمة المرور والدخول'}
          </Button>
        </form>

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
