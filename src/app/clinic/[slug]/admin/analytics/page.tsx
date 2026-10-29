'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'

// Client-only dynamic import ensures zero heavy SSR execution on Cloudflare Workers edge runtime.
// Heavy analytics calculations (Leaflet maps, exceljs, charts, heatmaps) run client-side in the browser.
const AnalyticsClient = dynamic(() => import('./AnalyticsClient'), {
  ssr: false,
  loading: () => <ClinicLoading fullScreen size="lg" label="جاري تحميل نظام التحليلات والإحصائيات..." />
})

export default function AnalyticsPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  return <AnalyticsClient slug={slug} />
}
