'use client'

import { use, useEffect, useState } from 'react'
import { AdminDashboard } from '@/components/clinic/AdminDashboard'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'

export default function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
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
            clinicName: 'العيادة التخصصية',
            doctorName: 'الطبيب',
            specialty: 'استشاري الطب المتخصص',
            primaryColor: '#15B8A6'
          })
        }
      },
      (err) => {
        console.error(err)
      }
    )

    return () => unsubscribe()
  }, [slug])

  if (!clinic) return <div className="p-8 text-center text-slate-400 font-bold">جاري تحميل لوحة التحكم...</div>

  return <AdminDashboard clinic={clinic} />
}
