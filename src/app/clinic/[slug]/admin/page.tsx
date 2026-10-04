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
      }
    }
    fetchClinic()
  }, [slug])

  if (!clinic) return <div className="p-8">جاري التحميل...</div>

  return <AdminDashboard clinic={clinic} />
}
