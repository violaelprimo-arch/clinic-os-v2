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

// Common Drug Allergies & Chronic Conditions presets
const COMMON_ALLERGIES = ['بنسلين (Penicillin)', 'سلفا (Sulfa)', 'أسبرين (Aspirin)', 'مضادات الالتهاب (NSAIDs)', 'صبغات الأشعة (Contrast Dye)']
const COMMON_CHRONIC = ['ارتفاع ضغط الدم (Hypertension)', 'السكري النوع الثاني (Type 2 Diabetes)', 'حساسية الصدر والربو (Asthma)', 'أمراض القلب (Heart Disease)', 'قصور الكلى (Renal Disease)', 'خمول الغدة الدرقية (Hypothyroidism)']

export default function PatientProfilePage({
  params
}: {
  params: Promise<{ slug: string; patientId: string }>
}) {
  const resolvedParams = use(params)
  const { slug, patientId } = resolvedParams

  return <PatientProfileClient slug={slug} patientId={patientId} />
}
