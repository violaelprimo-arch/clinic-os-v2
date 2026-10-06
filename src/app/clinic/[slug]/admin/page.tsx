'use client'

import { use, useEffect, useState } from 'react'
import { AdminDashboard } from '@/components/clinic/AdminDashboard'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'

export default function AdminPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [clinic, setClinic] = useState<any>(null)
  
  useEffect(() => {
    const fetchClinic = async () => {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snapshot = await getDocs(q)
      if (!snapshot.empty) {
        setClinic({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
      } else if (slug === 'demo') {
        setClinic({
          id: 'demo',
          slug: 'demo',
          clinicName: 'عيادة د. محمد علي التخصصية',
          doctorName: 'محمد علي',
          specialty: 'استشاري الطب المتخصص',
          primaryColor: '#15B8A6'
        })
      }
    }
    fetchClinic()
  }, [slug])

  if (!clinic) return <div className="p-8 text-center text-slate-400 font-bold">جاري تحميل لوحة التحكم...</div>

  return <AdminDashboard clinic={clinic} />
}
