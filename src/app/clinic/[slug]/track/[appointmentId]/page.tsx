'use client'

import { use, useEffect, useState, useMemo, useRef } from 'react'
import { db } from '@/lib/firebase'
import {
  calculatePatientLivePosition,
  PatientQueueStatusResult,
  formatEstimatedTime
} from '@/lib/queueCalculations'
import { checkAndTriggerQueuePositionAlert, playNotificationSound } from '@/lib/notificationService'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity, Clock, CheckCircle2, Zap, MapPin, Phone,
  Users, Calendar, Sparkles, Navigation, MessageCircle, AlertCircle, Receipt,
  UserCheck, ShieldCheck, FileText
} from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { formatCairo12Hour } from '@/lib/queue-calculator'
import { InvoiceView } from '@/components/clinic/InvoiceView'
import { NotificationCenter } from '@/components/clinic/NotificationCenter'
import { toast } from 'sonner'

export default function TrackPatientPage({ params }: { params: Promise<{ slug: string; appointmentId: string }> }) {
  const resolvedParams = use(params)
  const { slug, appointmentId } = resolvedParams

  const [appointment, setAppointment] = useState<any>(null)
  const [allQueueAppts, setAllQueueAppts] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [clinic, setClinic] = useState<any>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  useEffect(() => {
    let unsubQueue: (() => void) | null = null

    // 1. Fetch clinic data
    const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubClinic = onSnapshot(qClinic, (snapshot) => {
      if (!snapshot.empty) {
        setClinic({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
      }
    })

    // 2. Listen to this appointment live
    const unsubscribeAppt = onSnapshot(doc(db, 'appointments', appointmentId), (docSnap) => {
      if (docSnap.exists()) {
        const apptData = { id: docSnap.id, ...docSnap.data() } as any
        setAppointment(apptData)

        // 3. Listen to today's branch queue live
        if (unsubQueue) {
          unsubQueue()
          unsubQueue = null
        }

        const todayDate = apptData.date || new Date().toISOString().split('T')[0]
        const constraints: any[] = [
          where('clinic_id', '==', apptData.clinic_id),
          where('date', '==', todayDate)
        ]

        const qQueue = query(collection(db, 'appointments'), ...constraints)
        unsubQueue = onSnapshot(qQueue, (queueSnap) => {
          const list = queueSnap.docs.map(d => ({ id: d.id, ...d.data() }))
          setAllQueueAppts(list)
          setLoading(false)
        }, (err) => {
          console.error('Queue subscription error:', err)
          setLoading(false)
        })
      } else {
        setAppointment(null)
        setLoading(false)
      }
    }, (err) => {
      console.error('Appointment subscription error:', err)
      setLoading(false)
    })

    return () => {
      unsubClinic()
      unsubscribeAppt()
      if (unsubQueue) unsubQueue()
    }
  }, [slug, appointmentId])

  // Compute live queue position using comprehensive multi-case logic
  const liveQueue: PatientQueueStatusResult = useMemo(() => {
    return calculatePatientLivePosition({
      targetAppointmentId: appointmentId,
      targetAppointment: appointment,
      allTodayAppointments: allQueueAppts,
      clinic
    })
  }, [appointmentId, appointment, allQueueAppts, clinic])

  const prevExaminingRef = useRef<any>(null)

  // Fire sound/push notifications when patient's turn arrives or is approaching, or on patient entry
  useEffect(() => {
    if (appointment && appointment.clinic_id) {
      const currentExaminingNum = liveQueue.currentPatientExamining?.queueNumber

      // Notify on each patient entry to the examination room
      if (
        prevExaminingRef.current !== null &&
        currentExaminingNum &&
        currentExaminingNum !== prevExaminingRef.current &&
        appointment.status === 'waiting'
      ) {
        playNotificationSound('chime')
        toast.info(
          `🔔 دخل الآن المريض رقم #${currentExaminingNum} لغرفة الكشف. دورك رقم #${appointment.queue_number} (متبقي أمامك ${liveQueue.aheadCount} مرضى).`
        )
      }
      prevExaminingRef.current = currentExaminingNum || null

      checkAndTriggerQueuePositionAlert({
        appointment: { id: appointmentId, ...appointment },
        waitingAheadCount: liveQueue.aheadCount,
        clinicId: appointment.clinic_id,
        branchName: appointment.branchName,
        currentExaminingQueueNumber: currentExaminingNum
      })

      if (liveQueue.isCurrentTurn || appointment.status === 'in_progress') {
        playNotificationSound('turn_ready')
      }
    }
  }, [appointment, liveQueue.aheadCount, liveQueue.status, liveQueue.isCurrentTurn, liveQueue.currentPatientExamining?.queueNumber, appointmentId])

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
          <div className="pt-2">
            <a href={`/clinic/${slug}`} className="block w-full">
              <Button variant="outline" className="w-full text-xs font-bold rounded-xl">
                العودة لرئيسية العيادة
              </Button>
            </a>
          </div>
        </div>
      </div>
    )
  }

  const isCompleted = liveQueue.status === 'completed'
  const isCurrentTurn = liveQueue.isCurrentTurn
  const isNextInLine = liveQueue.isNextInLine
  const isSkippedOrNoShow = liveQueue.status === 'skipped' || liveQueue.status === 'no_show'
  const isCancelled = liveQueue.status === 'cancelled'

  const avgVisitMins = liveQueue.averageVisitMins || Number(clinic?.averageVisitTime) || 15
  const totalWaitMins = Math.max(0, liveQueue.aheadCount * avgVisitMins)

  const formatWaitText = (mins: number) => {
    if (mins <= 0) return 'خلال دقائق معدودة'
    if (mins < 60) return `حوالي ${mins} دقيقة`
    const h = Math.floor(mins / 60)
    const m = mins % 60
    return m > 0 ? `حوالي ${h} ساعة و ${m} دقيقة` : `حوالي ${h} ساعة`
  }

  const estimatedDurationText = formatWaitText(totalWaitMins)
  const expectedClockTime = formatEstimatedTime(totalWaitMins)

  return (
    <div className="min-h-screen bg-[#F6F8FB] dark:bg-[#0A131F] flex flex-col items-center justify-center p-4 font-sans text-[#182230] dark:text-slate-100 transition-colors" dir="rtl">
      
      {/* Container Card */}
      <div className="w-full max-w-md bg-white border border-[#E5EAF0] shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6">
        
        {/* Brand Top Header */}
        <div className="relative text-center space-y-2 border-b border-[#E5EAF0] pb-5">
          {appointment.phone && (
            <div className="absolute left-0 top-0">
              <NotificationCenter
                recipientTarget={appointment.phone}
                recipientLabel={appointment.patientName}
                recipientType="patient"
              />
            </div>
          )}
          <ClinicLogo size="md" variant="light" />
          <div className="pt-2">
            <h1 className="text-lg font-black text-[#182230]">
              {clinic?.clinicName || 'العيادة'}
            </h1>
            <p className="text-xs text-slate-400">
              مرحباً {appointment.patientName} • شاشة متابعة الدور المباشرة
            </p>
            {appointment.branchName && (
              <span className="inline-block mt-1 text-[11px] font-bold text-[#087CF4] bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100">
                فرع {appointment.branchName}
              </span>
            )}
          </div>
        </div>

        {/* Live Status Content Rendering */}
        {isCompleted ? (
          <div className="p-6 rounded-3xl bg-emerald-50 border border-emerald-200 text-center space-y-3">
            <CheckCircle2 className="w-14 h-14 text-emerald-600 mx-auto" />
            <h3 className="text-xl font-black text-emerald-800">تم الكشف بنجاح!</h3>
            <p className="text-xs text-emerald-700 font-medium">
              نتمنى لك دوام الصحة والعافية ونتشرف دائماً بخدمتك.
            </p>
          </div>
        ) : isCurrentTurn ? (
          <div className="p-6 rounded-3xl bg-blue-50 border-2 border-[#087CF4] text-center space-y-3 animate-pulse">
            <div className="w-14 h-14 rounded-full bg-[#087CF4] text-white flex items-center justify-center mx-auto text-2xl font-black shadow-lg shadow-[#087CF4]/30">
              #{appointment.queue_number}
            </div>
            <h3 className="text-xl font-black text-[#087CF4]">دورك الآن!</h3>
            <p className="text-xs text-blue-800 font-bold">
              يرجى التوجه إلى غرفة الكشف مباشرة لمقابلة الطبيب.
            </p>
          </div>
        ) : isCancelled ? (
          <div className="p-6 rounded-3xl bg-rose-50 border border-rose-200 text-center space-y-2">
            <AlertCircle className="w-12 h-12 text-rose-500 mx-auto" />
            <h3 className="text-lg font-black text-rose-800">تم إلغاء هذا الحجز</h3>
            <p className="text-xs text-rose-600">يرجى التواصل مع العيادة إذا كنت بحاجة لإعادة الحجز.</p>
          </div>
        ) : isSkippedOrNoShow ? (
          <div className="p-6 rounded-3xl bg-amber-50 border border-amber-200 text-center space-y-2">
            <Clock className="w-12 h-12 text-amber-600 mx-auto" />
            <h3 className="text-lg font-black text-amber-800">تم تخطي الموعد</h3>
            <p className="text-xs text-amber-700 font-medium">
              نظراً لعدم الحضور عند استدعاء الدور، يرجى مراجعة موظف الاستقبال لإعادة ترتيب دخولك.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Big Queue Card */}
            <div className="bg-[#F8FAFC] dark:bg-[#0E2342] border border-[#E5EAF0] dark:border-[#254565] rounded-3xl p-6 text-center space-y-2">
              <span className="text-xs font-bold text-slate-400">رقم تذكرة الحجز</span>
              <div className="text-6xl font-black text-[#087CF4] tracking-tight">
                #{appointment.queue_number}
              </div>
              
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-blue-50 text-[#087CF4] text-xs font-bold border border-blue-100">
                  ترتيب الدخول الفعلي: #{liveQueue.effectivePosition}
                </span>

                {isNextInLine && (
                  <span className="px-3 py-1 rounded-full bg-amber-100 text-amber-900 text-xs font-black animate-bounce">
                    ⚡ أنت المريض التالي للدخول
                  </span>
                )}
              </div>
            </div>

            {/* In-Progress Doctor Indicator */}
            {liveQueue.currentPatientExamining && (
              <div className="p-3 rounded-2xl bg-blue-50/70 border border-blue-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-blue-800 font-bold">
                  <Activity className="w-4 h-4 text-[#087CF4] animate-pulse" />
                  <span>الطبيب مع مريض رقم:</span>
                </div>
                <Badge className="bg-[#087CF4] text-white font-mono font-bold text-xs">
                  #{liveQueue.currentPatientExamining.queueNumber}
                </Badge>
              </div>
            )}

            {/* Queue Intelligence Card: Ahead Count, Average Consultation Time & Estimated Entry Time */}
            <div className="p-5 rounded-3xl bg-gradient-to-br from-blue-50/90 via-white to-cyan-50/40 dark:from-[#07162D] dark:to-[#0E2342] border border-blue-100 dark:border-[#254565] shadow-xs space-y-4">
              
              {/* Row 1: How many patients ahead */}
              <div className="flex items-center justify-between pb-3 border-b border-blue-100/70 dark:border-[#254565]">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-[#087CF4]/10 text-[#087CF4] flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-600 dark:text-slate-300 block">فاضل كام مريض قدامك</span>
                    <span className="text-[11px] text-slate-400">في قائمة الانتظار الحالية</span>
                  </div>
                </div>
                <div className="text-left">
                  <span className="text-3xl font-black text-[#087CF4] font-mono">
                    {liveQueue.aheadCount}
                  </span>
                  <span className="text-xs font-bold text-slate-600 dark:text-slate-300 mr-1.5">
                    {liveQueue.aheadCount === 1 ? 'مريض فقط' : liveQueue.aheadCount === 2 ? 'مريضان' : 'مرضى'}
                  </span>
                </div>
              </div>

              {/* Row 2: Average Consultation Time */}
              <div className="flex items-center justify-between pb-3 border-b border-blue-100/70 dark:border-[#254565] text-xs">
                <div className="flex items-center gap-2 text-slate-600 dark:text-slate-300 font-bold">
                  <Activity className="w-4 h-4 text-[#087CF4]" />
                  <span>متوسط وقت الكشف:</span>
                </div>
                <span className="font-bold text-[#182230] dark:text-slate-100 bg-white dark:bg-[#142D50] px-2.5 py-1 rounded-lg border border-slate-200 dark:border-[#254565] shadow-xs font-mono">
                  {avgVisitMins} دقيقة / كشف
                </span>
              </div>

              {/* Row 3: Estimated Entry Time & Duration (Ahead Count * Average Time) */}
              <div className="p-3.5 rounded-2xl bg-blue-500/10 dark:bg-blue-500/20 border border-blue-500/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-blue-900 dark:text-blue-200">
                    <Clock className="w-4 h-4 text-[#087CF4] animate-pulse" />
                    <span>الوقت المتوقع لدخولك:</span>
                  </div>
                  <span className="text-base font-black text-[#087CF4] dark:text-[#02CFF3] font-mono">
                    {estimatedDurationText}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-teal-800/90 dark:text-teal-300/90 pt-1">
                  <span className="font-medium">الساعة المتوقعة للدخول:</span>
                  <span className="font-black font-mono bg-white dark:bg-[#101F31] px-2 py-0.5 rounded-md border border-teal-200 dark:border-teal-800/60">
                    {expectedClockTime} تقريباً
                  </span>
                </div>

                <div className="text-[10.5px] text-slate-400 dark:text-slate-400 pt-1.5 border-t border-teal-500/15 text-center font-mono">
                  (حساب تقديري: {liveQueue.aheadCount} مرضى × {avgVisitMins} دقيقة = {liveQueue.aheadCount * avgVisitMins} دقيقة)
                </div>
              </div>

            </div>

            {/* 5-Turns or less prominent alert banner */}
            {liveQueue.aheadCount <= 5 && liveQueue.aheadCount > 0 && (
              <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-bold flex items-center gap-3 shadow-xs animate-in fade-in">
                <Clock className="w-5 h-5 text-amber-600 shrink-0 animate-pulse" />
                <div className="space-y-0.5 text-right">
                  <span className="block font-black text-amber-900 text-sm">
                    تنبيه: اقترب موعد دخولك للكشف (متبقي {liveQueue.aheadCount} {liveQueue.aheadCount === 1 ? 'دور فقط' : 'أدوار'})
                  </span>
                  <span className="text-[11px] font-medium text-amber-700 block">
                    يرجى التواجد الآن في قاعة انتظار العيادة والاستعداد للدخول مباشرة.
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>يتم تحديث هذه الشاشة وإرسال إشعار فوري مع كل دخول مريض لغرفة الكشف.</span>
            </div>
          </div>
        )}

        {/* Modal for Electronic PDF Invoice (Restricted patient view: NO direct print button) */}
        {showInvoiceModal && (
          <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl">
              <InvoiceView
                invoice={{
                  invoiceNumber: appointment.invoiceNumber || `INV-${appointmentId.slice(0, 8)}`,
                  queueNumber: appointment.queue_number,
                  clinicName: clinic?.clinicName || 'العيادة',
                  doctorName: clinic?.doctorName,
                  branchName: appointment.branchName,
                  clinicAddress: clinic?.clinicAddress,
                  clinicPhone: clinic?.clinicPhone,
                  patientName: appointment.patientName,
                  patientPhone: appointment.phone,
                  date: appointment.date,
                  cairoTime: formatCairo12Hour(new Date(appointment.createdAt || Date.now())),
                  serviceName: appointment.serviceName || 'كشف',
                  servicePrice: appointment.servicePrice || 0,
                  discount: appointment.discountApplied || 0,
                  netTotal: appointment.servicePrice || 0,
                  paymentMethod: appointment.paymentMethod || 'cash',
                  paymentStatus: appointment.paymentStatus || 'pending',
                  transferNumber: appointment.transferNumber,
                  appointmentId
                }}
                isPatientView={true}
                onClose={() => setShowInvoiceModal(false)}
              />
            </div>
          </div>
        )}

        {/* Action CTAs */}
        <div className="space-y-2.5 pt-2 border-t border-[#E5EAF0]">
          {(isCompleted || (appointment.drugs && appointment.drugs.length > 0)) && (
            <a href={`/clinic/${slug}/prescription/${appointmentId}`} className="block w-full">
              <Button
                className="w-full h-11 text-xs font-bold bg-[#087CF4] hover:bg-[#0769D1] text-white rounded-xl shadow-xs flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4 ml-1.5" />
                عرض وتحميل الروشتة الطبية الرسمية PDF
              </Button>
            </a>
          )}

          <Button
            variant="outline"
            onClick={() => setShowInvoiceModal(true)}
            className="w-full h-11 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-50 rounded-xl flex items-center justify-center gap-2"
          >
            <Receipt className="w-4 h-4 text-[#087CF4]" />
            عرض وتحميل الفاتورة الإلكترونية PDF
          </Button>

          {clinic?.mapsLink && (
            <a href={clinic.mapsLink} target="_blank" rel="noreferrer" className="block w-full">
              <Button className="w-full h-12 text-xs font-black bg-[#087CF4] hover:bg-[#0769D1] text-white rounded-xl shadow-md shadow-[#087CF4]/20">
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
          
          <a href={`/clinic/${slug}`} className="block w-full">
            <Button variant="ghost" className="w-full h-11 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
              خروج والعودة للرئيسية
            </Button>
          </a>
        </div>

        {/* TASK 12: Standardized Copyright Footer */}
        <div className="text-center text-[11px] text-slate-400 border-t border-[#E5EAF0] dark:border-[#1E3A5F] pt-4">
          جميع الحقوق محفوظة YallaCodeX 2026
        </div>

      </div>
    </div>
  )
}
