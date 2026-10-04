'use client'

import { use, useState, useEffect } from 'react'
import { PremiumLanding } from '@/components/clinic/PremiumLanding'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { ShieldAlert } from 'lucide-react'

export default function ClinicPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        
        if (snapshot.empty) {
          setError('العيادة غير موجودة')
          setLoading(false)
          return
        }
        
        const clinicData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any
        
        // Subscription Check
        if (!clinicData.isActive) {
          setError('تم إيقاف هذه العيادة مؤقتاً من قبل الإدارة.')
          setLoading(false)
          return
        }
        
        if (clinicData.expirationDate && new Date(clinicData.expirationDate) < new Date()) {
          setError('انتهى اشتراك هذه العيادة. يرجى التواصل مع الإدارة.')
          setLoading(false)
          return
        }

        setClinic(clinicData)
      } catch (err) {
        console.error(err)
        setError('حدث خطأ أثناء تحميل بيانات العيادة.')
      } finally {
        setLoading(false)
      }
    }
    
    fetchClinic()
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    )
  }

  if (error || !clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 font-sans" dir="rtl">
        <div className="text-center space-y-4 p-8 bg-white rounded-2xl shadow-xl max-w-md w-full border-t-4 border-t-red-500">
          <ShieldAlert className="w-16 h-16 text-red-500 mx-auto" />
          <h1 className="text-2xl font-bold text-slate-900">عذراً، لا يمكن الوصول</h1>
          <p className="text-slate-500">{error}</p>
        </div>
      </div>
    )
  }

  // Define fallback services if the clinic didn't set any yet
  const services = clinic.services || [
    { id: '1', name: 'كشف عام', price: 250 },
    { id: '2', name: 'استشارة', price: 100 },
    { id: '3', name: 'كشف مستعجل', price: 400 }
  ]

  return <PremiumLanding clinic={clinic} services={services} />
}
