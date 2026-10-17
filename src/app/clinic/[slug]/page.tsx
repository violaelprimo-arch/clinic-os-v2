'use client'

import { use, useState, useEffect } from 'react'
import { PremiumLanding } from '@/components/clinic/PremiumLanding'
import { DynamicTheme } from '@/components/DynamicTheme'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import { ShieldAlert } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'

export default function ClinicPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { isRtl, dir, t } = useLanguage()
  
  const [clinic, setClinic] = useState<any>(null)
  const [liveServices, setLiveServices] = useState<any[] | null>(null)
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
              clinicName: isRtl ? 'العيادة التخصصية' : 'Specialized Clinic',
              doctorName: isRtl ? 'الطبيب' : 'Physician',
              specialty: isRtl ? 'استشاري الطب المتخصص وعلاج الحالات المتقدمة' : 'Consultant Physician & Specialist',
              heroImage: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop',
              clinicPhone: '01012345678',
              clinicAddress: isRtl ? 'شارع التسعين الشمالي، التجمع الخامس، القاهرة' : '90th North St, 5th Settlement, New Cairo',
              primaryColor: '#087CF4',
              isActive: true,
              aiEnabled: true,
              services: [
                { id: '1', name: isRtl ? 'كشف عادي' : 'Standard Examination', price: 250, desc: isRtl ? 'كشف طبي شامل مع تشخيص دقيق' : 'Comprehensive exam with accurate diagnosis', duration: isRtl ? 'حوالي 15 دقيقة' : 'Approx. 15 mins' },
                { id: '2', name: isRtl ? 'استشارة' : 'Consultation', price: 150, desc: isRtl ? 'استشارة ومراجعة تحاليل' : 'Consultation and lab review', duration: isRtl ? 'حوالي 10 دقائق' : 'Approx. 10 mins' },
                { id: '3', name: isRtl ? 'كشف مستعجل' : 'Urgent Examination', price: 400, desc: isRtl ? 'أولوية فورية في الدور والدخول' : 'Immediate queue priority and fast entry', duration: isRtl ? 'كشف فوري مباشر' : 'Immediate entry' },
                { id: '4', name: isRtl ? 'متابعة' : 'Follow-up', price: 100, desc: isRtl ? 'متابعة لحالة سابقة وتعديل الجرعات' : 'Follow-up for previous condition', duration: isRtl ? 'حوالي 10 دقائق' : 'Approx. 10 mins' },
              ]
            })
            setError('')
            setLoading(false)
            return
          }
          setError(isRtl ? 'العيادة غير موجودة' : 'Clinic Not Found')
          setClinic(null)
          setLoading(false)
          return
        }
        
        const clinicData = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as any
        
        // Subscription Check
        if (clinicData.isActive === false) {
          setError(isRtl ? 'العيادة غير موجودة' : 'Clinic Not Found')
          setClinic(null)
          setLoading(false)
          return
        }
        
        if (clinicData.expirationDate && new Date(clinicData.expirationDate) < new Date()) {
          setError(isRtl ? 'العيادة غير موجودة' : 'Clinic Not Found')
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
        setError(isRtl ? 'حدث خطأ أثناء تحميل بيانات العيادة.' : 'Error loading clinic information.')
        setLoading(false)
      }
    )

    return () => unsubscribe()
  }, [slug, isRtl])

  // Real-time synchronization for settings live preview (iframe)
  useEffect(() => {
    if (typeof window === 'undefined') return
    const isEmbedded = window.self !== window.top || new URLSearchParams(window.location.search).get('preview') === '1'
    if (!isEmbedded) return

    // 1. Initial hydration from localStorage
    try {
      const stored = localStorage.getItem(`clinic_live_preview_${slug}`)
      if (stored) {
        const parsed = JSON.parse(stored)
        setClinic((prev: any) => ({ ...(prev || {}), ...parsed }))
        if (parsed.services && Array.isArray(parsed.services)) {
          setLiveServices(parsed.services)
        }
      }
    } catch (e) {}

    // 2. Real-time postMessage listener
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type === 'CLINIC_PREVIEW_UPDATE' && event.data?.data) {
        const update = event.data.data
        setClinic((prev: any) => ({ ...(prev || {}), ...update }))
        if (update.services && Array.isArray(update.services)) {
          setLiveServices(update.services)
        }
      }
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [slug])

  if (loading) {
    return <ClinicLoading fullScreen size="lg" label={isRtl ? 'جاري تجهيز العيادة...' : 'Loading clinic...'} />
  }

  if (error || !clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background font-sans p-4" dir={dir}>
        <div className="text-center space-y-4 p-8 bg-card text-card-foreground rounded-3xl shadow-xl max-w-md w-full border border-border border-t-4 border-t-destructive">
          <ShieldAlert className="w-16 h-16 text-destructive mx-auto" />
          <h1 className="text-2xl font-bold text-foreground">
            {isRtl ? 'عذراً، لا يمكن الوصول' : 'Access Restricted'}
          </h1>
          <p className="text-muted-foreground text-sm">{error}</p>
        </div>
      </div>
    )
  }

  // Define fallback services if the clinic didn't set any yet
  const services = liveServices || clinic.services || [
    { id: '1', name: isRtl ? 'كشف عام' : 'General Exam', price: 250 },
    { id: '2', name: isRtl ? 'استشارة' : 'Consultation', price: 100 },
    { id: '3', name: isRtl ? 'كشف مستعجل' : 'Urgent Exam', price: 400 }
  ]

  return (
    <>
      <DynamicTheme color={clinic.primaryColor} />
      <PremiumLanding clinic={clinic} services={services} />
    </>
  )
}
