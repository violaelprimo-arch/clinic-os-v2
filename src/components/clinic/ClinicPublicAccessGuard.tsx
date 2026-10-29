'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'

type GuardResult = {
  pathname: string
  error?: string
}

export function ClinicPublicAccessGuard({
  children,
  slug,
}: {
  children: React.ReactNode
  slug: string
}) {
  const pathname = usePathname()
  const router = useRouter()
  const [result, setResult] = useState<GuardResult | null>(null)
  const isBypassed =
    pathname.startsWith(`/clinic/${slug}/admin`) ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === `/clinic/${slug}/login` ||
    pathname === '/login' ||
    pathname.startsWith('/login/') ||
    pathname.includes('/tv') ||
    pathname.includes('/track') ||
    pathname.includes('/prescription')

  useEffect(() => {
    if (isBypassed) return

    let cancelled = false
    const token = localStorage.getItem('clinic_session_token')
    const headers = token ? { Authorization: `Bearer ${token}` } : undefined

    fetch('/api/auth/session', { headers, cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) return null
        if (!response.ok) throw new Error('تعذر التحقق من جلسة العيادة.')
        return response.json()
      })
      .then((session) => {
        if (cancelled) return
        if (session?.authenticated && session.user?.role === 'doctor') {
          router.replace(`/clinic/${slug}/admin`)
          return
        }
        setResult({ pathname })
      })
      .catch((cause: unknown) => {
        if (cancelled) return
        setResult({
          pathname,
          error:
            cause instanceof Error
              ? cause.message
              : 'تعذر التحقق من جلسة العيادة.',
        })
      })

    return () => {
      cancelled = true
    }
  }, [isBypassed, pathname, router, slug])

  if (isBypassed) return children
  if (result?.pathname === pathname && result.error) {
    return (
      <div
        role="alert"
        className="flex min-h-screen items-center justify-center bg-background p-6 text-center text-sm text-destructive"
      >
        {result.error}
      </div>
    )
  }
  if (result?.pathname !== pathname) {
    return <ClinicLoading fullScreen size="lg" label="جاري التحقق من صلاحية الوصول..." />
  }
  return children
}
