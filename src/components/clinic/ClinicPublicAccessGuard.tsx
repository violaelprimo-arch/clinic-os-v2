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
  const isPreview =
    typeof window !== 'undefined' &&
    (window.self !== window.top ||
      new URLSearchParams(window.location.search).get('preview') === '1')

  const isBypassed =
    isPreview ||
    pathname === `/clinic/${slug}` ||
    pathname === '/' ||
    pathname.startsWith(`/clinic/${slug}/admin`) ||
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === `/clinic/${slug}/login` ||
    pathname.startsWith(`/clinic/${slug}/login`) ||
    pathname === '/login' ||
    pathname.startsWith('/login') ||
    pathname.includes('/patient/login') ||
    pathname.includes('/tv') ||
    pathname.includes('/track') ||
    pathname.includes('/prescription')

  useEffect(() => {
    if (isBypassed) return

    let cancelled = false
    const token = typeof window !== 'undefined' ? localStorage.getItem('clinic_session_token') : null
    if (!token) {
      setResult({ pathname })
      return
    }

    const headers = { Authorization: `Bearer ${token}` }

    fetch('/api/auth/session', { headers, cache: 'no-store' })
      .then(async (response) => {
        if (response.status === 401) {
          localStorage.removeItem('clinic_session_token')
          localStorage.removeItem('clinic_role')
          return null
        }
        if (!response.ok) return null
        return response.json()
      })
      .then((session) => {
        if (cancelled) return
        if (
          session?.authenticated &&
          session.user?.role === 'doctor' &&
          !pathname.includes('/admin') &&
          !pathname.includes('/login')
        ) {
          router.replace(pathname.startsWith('/clinic/') ? `/clinic/${slug}/admin` : '/admin')
          return
        }
        setResult({ pathname })
      })
      .catch(() => {
        if (cancelled) return
        setResult({ pathname })
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
