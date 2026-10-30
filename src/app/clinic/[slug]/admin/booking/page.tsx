'use client'

import { use, useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { InClinicBookingView } from '@/components/clinic/InClinicBookingView'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'
import { useLanguage } from '@/context/LanguageContext'
import { ShieldAlert } from 'lucide-react'
import Link from 'next/link'

export default function InClinicBookingPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { isRtl, dir } = useLanguage()

  const [clinic, setClinic] = useState<any>(null)
  const [role, setRole] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const storedRole = localStorage.getItem('clinic_role') || 'doctor'
    setRole(storedRole)

    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          setClinic({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
        }
        setLoading(false)
      },
      (err) => {
        console.error('Error fetching clinic for booking page:', err)
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [slug])

  if (loading) {
    return <ClinicLoading fullScreen size="lg" label={isRtl ? 'جاري تجهيز نموذج الحجز...' : 'Loading booking workspace...'} />
  }

  // Permission Guard
  const isDoctor = role === 'doctor'
  const assistantPermissions = clinic?.assistantPermissions || ['appointments']
  const isAuthorized = isDoctor || assistantPermissions.includes('appointments') || assistantPermissions.includes('in-clinic-booking')

  if (!isAuthorized) {
    return (
      <div className="max-w-md mx-auto p-8 my-12 rounded-3xl bg-card border border-destructive/20 text-center space-y-4 shadow-sm" dir={dir}>
        <div className="w-12 h-12 rounded-2xl bg-destructive/10 text-destructive mx-auto flex items-center justify-center">
          <ShieldAlert className="w-6 h-6" />
        </div>
        <h3 className="text-lg font-black text-foreground">
          {isRtl ? 'غير مصرح لك بالوصول' : 'Unauthorized Access'}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {isRtl
            ? 'حسابك لا يمتلك الصلاحية الكافية لتسجيل حجوزات المرضى داخل العيادة. يرجى مراجعة طبيب العيادة لتفعيل الصلاحية.'
            : 'Your account is not authorized to register in-clinic bookings. Contact the clinic doctor to request access.'}
        </p>
        <div className="pt-2">
          <Link
            href={`/clinic/${slug}/admin`}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white"
          >
            <span>{isRtl ? 'العودة للوحة الرئيسية' : 'Return to Dashboard'}</span>
          </Link>
        </div>
      </div>
    )
  }

  return <InClinicBookingView clinic={clinic} slug={slug} role={role} />
}
