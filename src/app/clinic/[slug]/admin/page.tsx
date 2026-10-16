'use client'

import { use, useEffect, useState } from 'react'
import { AdminDashboard } from '@/components/clinic/AdminDashboard'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { useLanguage } from '@/context/LanguageContext'

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
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-8 text-center text-muted-foreground font-bold text-sm" dir={dir}>
        <div className="flex items-center gap-2">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
          <span>{t('loading_dashboard', isRtl ? 'جاري تحميل لوحة التحكم...' : 'Loading dashboard...')}</span>
        </div>
      </div>
    )
  }

  return <AdminDashboard clinic={clinic} />
}
