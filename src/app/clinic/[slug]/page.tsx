'use client'

import { use, useState, useEffect } from 'react'
import { PremiumLanding } from '@/components/clinic/PremiumLanding'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { ShieldAlert } from 'lucide-react'

export default function ClinicPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        if (snapshot.empty) {
          if (slug === 'demo') {
            setClinic({
              id: 'demo',
              slug: 'demo',
              clinicName: 'عيادة د. محمد علي التخصصية',
              doctorName: 'محمد علي',
              specialty: 'استشاري الطب المتخصص وعلاج الحالات المتقدمة',
              heroImage: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop',
              clinicPhone: '01012345678',
              clinicAddress: 'شارع التسعين الشمالي، التجمع الخامس، القاهرة',
              primaryColor: '#15B8A6',
              isActive: true,
              aiEnabled: true,
              services: [
                { id: '1', name: 'كشف عادي', price: 250, desc: 'كشف طبي شامل مع تشخيص دقيق', duration: 'حوالي 15 دقيقة' },
                { id: '2', name: 'استشارة', price: 150, desc: 'استشارة ومراجعة تحاليل', duration: 'حوالي 10 دقائق' },
                { id: '3', name: 'كشف مستعجل', price: 400, desc: 'أولوية فورية في الطابور والدخول', duration: 'كشف فوري مباشر' },
                { id: '4', name: 'متابعة', price: 100, desc: 'متابعة لحالة سابقة وتعديل الجرعات', duration: 'حوالي 10 دقائق' },
              ]
            })
            setError('')
            setLoading(false)
            return
          }
          setError('العيادة غير موجودة')
          setClinic(null)
          setLoading(false)
          return
        }
        
        const clinicData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any
        
        // Subscription Check
        if (clinicData.isActive === false) {
          setError('تم إيقاف هذه العيادة مؤقتاً من قبل الإدارة.')
          setClinic(null)
          setLoading(false)
          return
        }
        
        if (clinicData.expirationDate && new Date(clinicData.expirationDate) < new Date()) {
          setError('انتهى اشتراك هذه العيادة. يرجى التواصل مع الإدارة.')
          setClinic(null)
          setLoading(false)
          return
        }

        setError('')
        setClinic(clinicData)
        setLoading(false)
      },
      (err) => {
        console.error(err)
        setError('حدث خطأ أثناء تحميل بيانات العيادة.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
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
