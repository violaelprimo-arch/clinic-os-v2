'use client'

import { use, useEffect, useState, useMemo } from 'react'
import { db } from '@/lib/firebase'
import {
  calculatePatientLivePosition,
  PatientQueueStatusResult,
  formatEstimatedTime
} from '@/lib/queueCalculations'
import { checkAndTriggerQueuePositionAlert } from '@/lib/notificationService'
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity, Clock, CheckCircle2, Zap, MapPin, Phone,
  Users, Calendar, Sparkles, Navigation, MessageCircle, AlertCircle, Receipt,
  UserCheck, ShieldCheck
} from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { formatCairo12Hour } from '@/lib/queue-calculator'
import { InvoiceView } from '@/components/clinic/InvoiceView'
import { TechnicalSupportButton } from '@/components/clinic/TechnicalSupportButton'

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
        setClinic(snapshot.docs[0].data())
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
        if (apptData.branch_id) {
          constraints.push(where('branch_id', '==', apptData.branch_id))
        }

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

  // Fire sound/push notifications when patient's turn arrives or is next
  useEffect(() => {
    if (appointment && liveQueue.status === 'waiting' && appointment.clinic_id) {
      checkAndTriggerQueuePositionAlert({
        appointment: { id: appointmentId, ...appointment },
        waitingAheadCount: liveQueue.aheadCount,
        clinicId: appointment.clinic_id,
        branchName: appointment.branchName
      })
    }
  }, [appointment, liveQueue.aheadCount, liveQueue.status, appointmentId])

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
          <div className="pt-2">
            <TechnicalSupportButton variant="block" />
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
            {appointment.branchName && (
              <span className="inline-block mt-1 text-[11px] font-bold text-[#15B8A6] bg-teal-50 px-2.5 py-0.5 rounded-full border border-teal-100">
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
          <div className="p-6 rounded-3xl bg-teal-50 border-2 border-[#15B8A6] text-center space-y-3 animate-pulse">
            <div className="w-14 h-14 rounded-full bg-[#15B8A6] text-white flex items-center justify-center mx-auto text-2xl font-black shadow-lg shadow-[#15B8A6]/30">
              #{appointment.queue_number}
            </div>
            <h3 className="text-xl font-black text-[#15B8A6]">دورك الآن!</h3>
            <p className="text-xs text-teal-800 font-bold">
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
            <div className="bg-[#F8FAFC] border border-[#E5EAF0] rounded-3xl p-6 text-center space-y-2">
              <span className="text-xs font-bold text-slate-400">رقم تذكرة الحجز</span>
              <div className="text-6xl font-black text-[#15B8A6] tracking-tight">
                #{appointment.queue_number}
              </div>
              
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-teal-50 text-[#0D9488] text-xs font-bold border border-teal-100">
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
              <div className="p-3 rounded-2xl bg-teal-50/70 border border-teal-100 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-teal-800 font-bold">
                  <Activity className="w-4 h-4 text-[#15B8A6] animate-pulse" />
                  <span>الطبيب مع مريض رقم:</span>
                </div>
                <Badge className="bg-[#15B8A6] text-white font-mono font-bold text-xs">
                  #{liveQueue.currentPatientExamining.queueNumber}
                </Badge>
              </div>
            )}

            {/* Waiting Estimation Metrics */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] text-right space-y-1">
                <span className="text-[11px] font-bold text-slate-400">وقت الانتظار المتوقع</span>
                <p className="text-lg font-black text-[#15B8A6]">
                  {liveQueue.formattedWaitTime}
                </p>
              </div>

              <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] text-right space-y-1">
                <span className="text-[11px] font-bold text-slate-400">المرضى قبلك</span>
                <p className="text-lg font-black text-slate-700">
                  {liveQueue.aheadCount} {liveQueue.aheadCount === 1 ? 'مريض' : 'مرضى'}
                </p>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-blue-800 text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600 shrink-0" />
              <span>يتم تحديث هذه الشاشة تلقائياً وبشكل فوري مع حركة الدور.</span>
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
          <Button
            variant="outline"
            onClick={() => setShowInvoiceModal(true)}
            className="w-full h-11 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-50 rounded-xl flex items-center justify-center gap-2"
          >
            <Receipt className="w-4 h-4 text-[#15B8A6]" />
            عرض وتحميل الفاتورة الإلكترونية PDF
          </Button>

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
          
          <a href={`/clinic/${slug}`} className="block w-full">
            <Button variant="ghost" className="w-full h-11 text-xs font-bold text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl">
              خروج والعودة للرئيسية
            </Button>
          </a>

          {/* TASK 11: Technical Support Button */}
          <div className="pt-2 flex justify-center">
            <TechnicalSupportButton variant="pill" />
          </div>
        </div>

        {/* TASK 12: Standardized Copyright Footer */}
        <div className="text-center text-[11px] text-slate-400 border-t border-[#E5EAF0] pt-4">
          جميع الحقوق محفوظة © {new Date().getFullYear()} Clinic OS
        </div>

      </div>
    </div>
  )
}
