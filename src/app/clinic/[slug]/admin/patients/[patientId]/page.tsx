'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'
import { safeDecodePatientId } from './PatientProfileClient'

// Client-only dynamic import ensures zero heavy SSR execution on Cloudflare Workers edge runtime.
const PatientProfileClient = dynamic(() => import('./PatientProfileClient'), {
  ssr: false,
  loading: () => <ClinicLoading fullScreen size="lg" label="جاري تحميل ملف المريض..." />
})

export { safeDecodePatientId }

export default function PatientProfilePage({
  params
}: {
  params: Promise<{ slug: string; patientId: string }>
}) {
  const resolvedParams = use(params)
  const { slug, patientId } = resolvedParams

  return <PatientProfileClient slug={slug} patientId={patientId} />
}
