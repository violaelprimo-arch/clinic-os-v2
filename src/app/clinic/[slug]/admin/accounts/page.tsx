'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'

// Client-only dynamic import ensures zero heavy SSR execution on Cloudflare Workers edge runtime.
const AccountsClient = dynamic(() => import('./AccountsClient'), {
  ssr: false,
  loading: () => <ClinicLoading fullScreen size="lg" label="جاري تحميل الحسابات والمالية..." />
})

export default function AccountsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  return <AccountsClient slug={slug} />
}
