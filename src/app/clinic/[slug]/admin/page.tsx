'use client'

import { use, useEffect, useState } from 'react'
import { AdminDashboard } from '@/components/clinic/AdminDashboard'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
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
    setLoading(true)
    setNotFound(false)
    setErrorMsg(null)

    // Fallback: fetch clinic settings via server endpoint if client Firestore is slow or denied
    const tryServerFallback = async () => {
      try {
        const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/private-settings`, {
          cache: 'no-store',
        })
        if (res.ok) {
          const data = await res.json()
          if (!cancelled && data.clinic) {
            setClinic(data.clinic)
            setLoading(false)
            return true
          }
        } else if (res.status === 404) {
          if (!cancelled) {
            setNotFound(true)
            setLoading(false)
          }
          return false
        }
      } catch (err) {
        console.warn('Server fallback fetch failed:', err)
      }
      return false
    }

    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (cancelled) return
        if (!snapshot.empty) {
          setClinic({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
          setLoading(false)
        } else if (slug === 'demo') {
          setClinic({
            id: 'demo',
            slug: 'demo',
            clinicName: isRtl ? 'العيادة التخصصية' : 'Specialized Clinic',
            doctorName: isRtl ? 'الطبيب' : 'Physician',
            specialty: isRtl ? 'استشاري الطب المتخصص' : 'Consultant Physician',
            primaryColor: '#087CF4'
          })
          setLoading(false)
        } else {
          // Empty snapshot: try server fallback before declaring not found
          tryServerFallback().then((found) => {
            if (!cancelled && !found) {
              setNotFound(true)
              setLoading(false)
            }
          })
        }
      },
      async (err) => {
        console.error('Clinic listener error:', err)
        if (cancelled) return
        const found = await tryServerFallback()
        if (!cancelled && !found) {
          setErrorMsg(err.message || (isRtl ? 'تعذر الاتصال بقاعدة البيانات' : 'Failed to connect to database'))
          setLoading(false)
        }
      }
    )

    // Safety timeout: loader must never spin longer than 4.5 seconds
    const timer = setTimeout(async () => {
      if (cancelled) return
      setClinic((cur: any) => {
        if (!cur) {
          tryServerFallback().then((found) => {
            if (!cancelled && !found) {
              setNotFound(true)
              setLoading(false)
            }
          })
        }
        return cur
      })
    }, 4500)

    return () => {
      cancelled = true
      clearTimeout(timer)
      unsubscribe()
    }
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
