'use client'

import { use, useEffect, useState } from 'react'
import { AdminDashboard } from '@/components/clinic/AdminDashboard'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { useLanguage } from '@/context/LanguageContext'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'

export default function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, isRtl, dir } = useLanguage()
  const [clinic, setClinic] = useState<any>(null)
  
  useEffect(() => {
    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (!snapshot.empty) {
          setClinic({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
        } else if (slug === 'demo') {
          setClinic({
            id: 'demo',
            slug: 'demo',
            clinicName: isRtl ? 'العيادة التخصصية' : 'Specialized Clinic',
            doctorName: isRtl ? 'الطبيب' : 'Physician',
            specialty: isRtl ? 'استشاري الطب المتخصص' : 'Consultant Physician',
            primaryColor: '#087CF4'
          })
        }
      },
      (err) => {
        console.error(err)
      }
    )

    return () => unsubscribe()
  }, [slug, isRtl])

  if (!clinic) {
    return <ClinicLoading fullScreen size="lg" label={t('loading_dashboard', isRtl ? 'جاري تحميل لوحة التحكم...' : 'Loading dashboard...')} />
  }

  return <AdminDashboard clinic={clinic} />
}
