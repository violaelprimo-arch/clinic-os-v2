'use client'

import { use, useEffect, useState } from 'react'
import { AdminDashboard } from '@/components/clinic/AdminDashboard'
import { useLanguage } from '@/context/LanguageContext'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'
import { Button } from '@/components/ui/button'
import { Building2, AlertCircle, RefreshCw, Home, LogIn } from 'lucide-react'
import Link from 'next/link'

export default function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, isRtl, dir } = useLanguage()
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [retryKey, setRetryKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    const controller = new AbortController()
    setLoading(true)
    setNotFound(false)
    setErrorMsg(null)
    // Only load a scope-limited profile. Firestore's raw /clinics documents
    // contain credential hashes and are deliberately blocked from client SDK.
    const load = async () => {
      try {
        const response = await fetch(`/api/clinic/${encodeURIComponent(slug)}/staff-profile`, {
          credentials: 'same-origin', cache: 'no-store', signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (response.status === 404) {
          setNotFound(true)
        } else if (response.ok && data.clinic) {
          setClinic(data.clinic)
        } else {
          setErrorMsg(data.error || (isRtl ? 'تعذر تحميل بيانات العيادة' : 'Unable to load clinic profile'))
        }
      } catch (err) {
        if (!cancelled) setErrorMsg(isRtl ? 'تعذر الاتصال بالخادم' : 'Server connection failed')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true; controller.abort() }
  }, [slug, isRtl, retryKey])

  if (loading) {
    return <ClinicLoading fullScreen size="lg" label={t('loading_dashboard', isRtl ? 'جاري تحميل لوحة التحكم...' : 'Loading dashboard...')} />
  }

  if (notFound) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6" dir={dir}>
        <div className="max-w-md w-full bg-card border border-border/80 rounded-3xl p-8 text-center shadow-lg space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 text-amber-500 mx-auto flex items-center justify-center">
            <Building2 className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              {isRtl ? 'العيادة غير موجودة أو تم نقلها' : 'Clinic Not Found'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {isRtl
                ? `لم يتم العثور على عيادة مطابقة للرابط (${slug}). يرجى التحقق من صحة الرابط أو تسجيل الدخول بحساب العيادة.`
                : `No clinic matching (${slug}) was found. Please verify the URL or log in to your clinic account.`}
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Link
              href="/login"
              className="flex-1 inline-flex items-center justify-center rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground h-10 px-4 text-sm font-medium transition-colors"
            >
              <LogIn className="w-4 h-4 ml-2 rtl:mr-2" />
              {isRtl ? 'تسجيل الدخول' : 'Clinic Login'}
            </Link>
            <Button
              variant="outline"
              onClick={() => setRetryKey(k => k + 1)}
              className="rounded-xl border-border hover:bg-muted"
            >
              <RefreshCw className="w-4 h-4 ml-2 rtl:mr-2" />
              {isRtl ? 'إعادة المحاولة' : 'Retry'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (errorMsg && !clinic) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center p-6" dir={dir}>
        <div className="max-w-md w-full bg-card border border-destructive/20 rounded-3xl p-8 text-center shadow-lg space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h2 className="text-xl font-bold text-foreground">
              {isRtl ? 'تعذر تحميل بيانات العيادة' : 'Failed to Load Clinic Data'}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">
              {errorMsg}
            </p>
          </div>
          <div className="flex justify-center gap-3 pt-2">
            <Button
              onClick={() => setRetryKey(k => k + 1)}
              className="rounded-xl bg-primary hover:bg-primary/90 text-primary-foreground"
            >
              <RefreshCw className="w-4 h-4 ml-2 rtl:mr-2" />
              {isRtl ? 'إعادة المحاولة' : 'Retry'}
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return <AdminDashboard clinic={clinic} />
}
