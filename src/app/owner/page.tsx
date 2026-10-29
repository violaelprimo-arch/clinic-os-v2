'use client'

import dynamic from 'next/dynamic'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'

// Client-only dynamic import ensures zero heavy SSR execution on Cloudflare Workers edge runtime.
// The 5,000+ line Owner Dashboard is loaded client-side after client authentication.
const OwnerDashboardClient = dynamic(() => import('./OwnerDashboardClient'), {
  ssr: false,
  loading: () => <ClinicLoading fullScreen size="lg" label="جاري تحميل لوحة إدارة المنصة..." />
})

export default function OwnerPage() {
  return <OwnerDashboardClient />
}
