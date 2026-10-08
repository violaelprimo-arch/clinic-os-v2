'use client'

import { use, useEffect, useState } from 'react'
import { db } from '@/lib/firebase'
import { calculateWaitTime, formatEstimatedTime, formatWaitDuration } from '@/lib/queueCalculations'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity, Clock, CheckCircle2, Zap, MapPin, Phone,
  Users, Calendar, Sparkles, Navigation, MessageCircle, AlertCircle
} from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'

export default function TrackPatientPage({ params }: { params: Promise<{ slug: string, appointmentId: string }> }) {
  const resolvedParams = use(params)
  const { slug, appointmentId } = resolvedParams
  const [appointment, setAppointment] = useState<any>(null)
  const [peopleAhead, setPeopleAhead] = useState<number>(3)
  const [averageTime, setAverageTime] = useState<number>(15)
  const [loading, setLoading] = useState(true)
  const [clinic, setClinic] = useState<any>(null)

  useEffect(() => {
    // 1. Fetch clinic data
    const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubClinic = onSnapshot(qClinic, (snapshot) => {
      if (!snapshot.empty) setClinic(snapshot.docs[0].data())
    })

    // 2. Listen to this appointment
    const unsubscribeAppt = onSnapshot(doc(db, 'appointments', appointmentId), (docSnap) => {
      if (docSnap.exists()) {
        const apptData = docSnap.data()
        setAppointment(apptData)

        // 3. Listen to today's queue
        if (apptData.status === 'waiting') {
          const qQueue = query(
            collection(db, 'appointments'),
            where('clinic_id', '==', apptData.clinic_id),
            where('date', '==', apptData.date)
          )
          onSnapshot(qQueue, (queueSnap) => {
            let aheadCount = 0
            queueSnap.docs.forEach(d => {
              const item = d.data()
              if (item.status === 'waiting' && item.queue_number < apptData.queue_number) {
                aheadCount++
              }
            })
            setPeopleAhead(aheadCount)
            setLoading(false)
          })
        } else {
          setPeopleAhead(0)
          setLoading(false)
        }
      } else {
        setLoading(false)
      }
    })

    return () => {
      unsubClinic()
      unsubscribeAppt()
    }
  }, [slug, appointmentId])

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center p-4" dir="rtl">
        <ClinicLogo size="md" variant="light" />
        <p className="text-xs text-slate-400 font-bold mt-3">جاري مزامنة الدور المباشر...</p>
      </div>
    )
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-[#F6F8FB] flex items-center justify-center p-4" dir="rtl">
        <div className="medical-card p-8 text-center max-w-sm w-full space-y-4">
          <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
          <h2 className="text-lg font-bold text-[#182230]">لم يتم العثور على تذكرة الحجز</h2>
          <p className="text-xs text-slate-400">تأكد من صحة الرابط أو تواصل مع العيادة للاستعلام.</p>
        </div>
      </div>
    )
  }

  const isCompleted = appointment.status === 'completed'
  const isInProgress = appointment.status === 'in_progress'
  const estimatedMins = isCompleted ? 0 : isInProgress ? 0 : calculateWaitTime(peopleAhead, averageTime)

  return (
    <div className="min-h-screen bg-[#F6F8FB] flex flex-col items-center justify-center p-4 font-sans" dir="rtl">
      
      {/* Container Card */}
      <div className="w-full max-w-md bg-white border border-[#E5EAF0] shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6">
        
        {/* Brand Top Header */}
        <div className="text-center space-y-2 border-b border-[#E5EAF0] pb-5">
          <ClinicLogo size="md" variant="light" />
          <div className="pt-2">
            <h1 className="text-lg font-black text-[#182230]">
              {clinic?.clinicName || 'العيادة'}
            </h1>
            <p className="text-xs text-slate-400">
              مرحباً {appointment.patientName} • شاشة متابعة الدور المباشرة
            </p>
          </div>
        </div>

        {/* Live Status Content */}
        {isCompleted ? (
          <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h3 className="text-xl font-black text-emerald-800">تم الكشف بنجاح!</h3>
            <p className="text-xs text-emerald-700 font-medium">
              نتمنى لك دوام الصحة والعافية ونتشرف دائماً بخدمتك.
            </p>
          </div>
        ) : isInProgress ? (
          <div className="p-6 rounded-3xl bg-teal-50 border-2 border-[#15B8A6] text-center space-y-3 animate-pulse">
            <div className="w-12 h-12 rounded-full bg-[#15B8A6] text-white flex items-center justify-center mx-auto text-xl font-black">
              #{appointment.queue_number}
            </div>
            <h3 className="text-xl font-black text-[#15B8A6]">دورك الآن!</h3>
            <p className="text-xs text-teal-800 font-bold">
              يرجى التوجه إلى غرفة الكشف مباشرة لمقابلة الطبيب.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Big Queue Card */}
            <div className="bg-[#F8FAFC] border border-[#E5EAF0] rounded-3xl p-6 text-center space-y-1">
              <span className="text-xs font-bold text-slate-400">رقم دورك في الدور</span>
              <div className="text-6xl font-black text-[#15B8A6] tracking-tight">
                {appointment.queue_number}
              </div>
              <div className="inline-block mt-2 px-3 py-1 rounded-full bg-teal-50 text-[#0D9488] text-xs font-bold">
                في الانتظار
              </div>
            </div>

            {/* Waiting Estimation Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] text-right space-y-1">
                <span className="text-[11px] font-bold text-slate-400">وقت الانتظار المتوقع</span>
                <p className="text-lg font-black text-[#15B8A6]">
                  {formatWaitDuration(estimatedMins)}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] text-right space-y-1">
                <span className="text-[11px] font-bold text-slate-400">المرضى قبلك</span>
                <p className="text-lg font-black text-slate-700">
                  {peopleAhead} {peopleAhead === 1 ? 'مريض' : 'مرضى'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>يتم تحديث هذه الشاشة تلقائياً وبشكل فوري مع حركة الدور.</span>
            </div>
          </div>
        )}

        {/* Action CTAs (Matching Mockup) */}
        <div className="space-y-2.5 pt-2 border-t border-[#E5EAF0]">
          {clinic?.mapsLink && (
            <a href={clinic.mapsLink} target="_blank" rel="noreferrer" className="block w-full">
              <Button className="w-full h-12 text-xs font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20">
                <Navigation className="w-4 h-4 ml-1.5" />
                فتح موقع العيادة عبر خرائط جوجل
              </Button>
            </a>
          )}

          {clinic?.clinicPhone && (
            <a
              href={`https://wa.me/${clinic.clinicPhone.replace(/[^0-9]/g, '').replace(/^0/, '20')}`}
              target="_blank"
              rel="noreferrer"
              className="block w-full"
            >
              <Button variant="outline" className="w-full h-11 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-50 rounded-xl">
                <MessageCircle className="w-4 h-4 ml-1.5 text-emerald-600" />
                التواصل مع العيادة عبر واتساب
              </Button>
            </a>
          )}
        </div>

      </div>
    </div>
  )
}
