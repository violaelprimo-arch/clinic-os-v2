'use client'

import React, { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc } from 'firebase/firestore'
import { PatientLiveTurn } from '@/components/clinic/PatientLiveTurn'
import { BookingModal } from '@/components/clinic/BookingModal'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { InvoiceView, InvoiceData } from '@/components/clinic/InvoiceView'
import { downloadElementAsPdf, downloadElementAsImage } from '@/lib/pdfGenerator'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { ClinicLocationMap } from '@/components/clinic/ClinicLocationMap'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { getPhoneSearchVariants } from '@/lib/countryPhoneHelper'
import {
  CalendarCheck,
  FileText,
  Receipt,
  ClipboardList,
  Phone,
  Hourglass,
  MessageCircle,
  LogOut,
  Pill,
  CheckCircle2,
  AlertCircle,
  X,
  Download,
  Calendar,
  Building2,
  Stethoscope,
  Plus,
  Loader2,
  Eye,
  ShieldCheck,
  ExternalLink,
  MapPin,
  Navigation,
  Compass,
  ChevronLeft
} from 'lucide-react'

export default function PatientPortalPage() {
  const router = useRouter()
  const params = useParams()
  const slug = (params?.slug as string) || 'zizo'

  const [patient, setPatient] = useState<{
    phone: string
    name: string
    clinic_id: string
    age?: string
  } | null>(null)

  const [clinic, setClinic] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  const [activeTab, setActiveTab] = useState<'appointments' | 'prescriptions' | 'invoices' | 'medical' | 'location'>('appointments')
  const [selectedBranchForMap, setSelectedBranchForMap] = useState<string | undefined>(undefined)
  const [liveTurnOpen, setLiveTurnOpen] = useState<boolean>(false)
  const [selectedApptForLive, setSelectedApptForLive] = useState<any | null>(null)
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false)

  // Selected modals
  const [selectedRx, setSelectedRx] = useState<any | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false)

  const rxSheetRef = useRef<HTMLDivElement>(null)

  // 1. Check Auth & Load Clinic
  useEffect(() => {
    let authData: any = null
    try {
      const raw = localStorage.getItem('patient_auth')
      if (raw) authData = JSON.parse(raw)
    } catch (e) {
      console.warn('Error reading patient_auth:', e)
    }

    if (!authData || !authData.phone) {
      router.push(`/clinic/${slug}/patient/login`)
      return
    }

    setPatient(authData)

    // Listen to Clinic info
    const qC = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubClinic = onSnapshot(qC, (snap) => {
      if (!snap.empty) {
        setClinic({ id: snap.docs[0].id, ...snap.docs[0].data() })
      } else if (slug === 'demo') {
        setClinic({
          id: 'demo',
          clinicName: 'العيادة التخصصية',
          doctorName: 'الطبيب المعالج',
          specialty: 'استشاري الطب المتخصص',
          primaryColor: '#0066dc'
        })
      }
    })

    return () => unsubClinic()
  }, [slug, router])

  // 2. Fetch Appointments & Prescriptions for this Patient
  useEffect(() => {
    if (!patient?.phone) return

    const cleanPhone = patient.phone.trim().replace(/\s+/g, '')
    const phoneVariants = getPhoneSearchVariants(cleanPhone)
    const searchPhones = phoneVariants.length > 0 ? phoneVariants.slice(0, 10) : [cleanPhone]
    const clinicId = patient.clinic_id || clinic?.id || slug

    const loadRecords = async () => {
      try {
        // Appointments query
        const apptQ = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', clinicId),
          where('phone', 'in', searchPhones)
        )
        const apptSnap = await getDocs(apptQ)
        const appts = apptSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
        setAppointments(appts)

        // Prescriptions query
        const rxQ = query(
          collection(db, 'prescriptions'),
          where('clinic_id', '==', clinicId),
          where('patientPhone', 'in', searchPhones)
        )
        const rxSnap = await getDocs(rxQ)
        const rxs = rxSnap.docs
          .map((d) => ({ id: d.id, ...d.data() } as any))
          .filter((rx) => rx.status === 'approved' || rx.status === 'finalized' || !rx.status)
          .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
        setPrescriptions(rxs)
      } catch (err) {
        console.error('Error loading patient records:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRecords()

    // Real-time listener on appointments so queue & status reflect live
    const apptRealtimeQ = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('phone', 'in', searchPhones)
    )
    const unsubAppts = onSnapshot(apptRealtimeQ, (snap) => {
      const liveList = snap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .sort((a, b) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
      setAppointments(liveList)
      setLoading(false)
    })

    return () => unsubAppts()
  }, [patient, clinic, slug])

  const handleLogout = () => {
    localStorage.removeItem('patient_auth')
    toast.success('تم تسجيل الخروج بنجاح')
    router.push(`/clinic/${slug}/patient/login`)
  }

  // Cancel Appointment Handler
  const handleCancelAppointment = async (apptId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء هذا الحجز؟')) return
    setCancellingId(apptId)
    try {
      await updateDoc(doc(db, 'appointments', apptId), {
        status: 'cancelled',
        cancelledAt: new Date().toISOString()
      })
      toast.success('تم إلغاء الموعد بنجاح')
      setAppointments((prev) =>
        prev.map((a) => (a.id === apptId ? { ...a, status: 'cancelled' } : a))
      )
    } catch (e) {
      console.error('Error cancelling appointment:', e)
      toast.error('تعذر إلغاء الحجز، يرجى التواصل مع إدارة العيادة')
    } finally {
      setCancellingId(null)
    }
  }

  const handleDownloadRx = async () => {
    if (!rxSheetRef.current || !selectedRx) return
    setIsDownloadingPdf(true)
    try {
      await downloadElementAsPdf(
        rxSheetRef.current,
        `Rx_${selectedRx.patientName || patient?.name || 'patient'}_${selectedRx.date || 'visit'}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success('تم تحميل الروشتة الطبية بصيغة PDF بنجاح')
    } catch (e) {
      console.error(e)
      toast.error('تعذر تحميل الروشتة بصيغة PDF')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  const upcomingAppointments = appointments.filter((a) => a.status !== 'completed' && a.status !== 'cancelled')
  const completedAppointments = appointments.filter((a) => a.status === 'completed')

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-[#f5f9ff] dark:bg-[#050d1a] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 animate-spin text-sky-600" />
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">جاري تحميل ملفك الطبي...</span>
        </div>
      </div>
    )
  }

  const patientName = patient?.name || 'المريض'
  const patientPhone = patient?.phone || ''
  const patientAge = patient?.age || appointments[0]?.age || ''

  return (
    <div dir="rtl" className="min-h-screen bg-[#f5f9ff] dark:bg-[#050d1a] text-slate-900 dark:text-white py-6 px-4">
      <motion.div
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: 'easeOut' }}
        className="max-w-md mx-auto bg-[#f5f9ff] dark:bg-[#081526] rounded-[36px] p-5 shadow-xl border border-sky-100 dark:border-slate-800 space-y-4"
      >
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <a
            href={clinic?.clinicPhone ? `https://wa.me/20${clinic.clinicPhone.replace(/^0+/, '')}` : 'https://wa.me/201551007018'}
            target="_blank"
            rel="noreferrer"
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm text-emerald-600 dark:text-emerald-400 flex items-center justify-center hover:bg-emerald-50 transition-colors"
            title="تواصل واتساب مع العيادة"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
          <Link href={`/clinic/${slug}`} className="flex items-center shrink-0" dir="ltr">
            <ClinicLogo size="md" variant="auto" />
          </Link>
          <button
            onClick={handleLogout}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm text-rose-500 hover:bg-rose-50 flex items-center justify-center transition-colors cursor-pointer"
            title="تسجيل الخروج"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>

        {/* Patient Profile Card with Motion */}
        <motion.div
          whileHover={{ y: -2 }}
          transition={{ duration: 0.2 }}
          className="bg-white dark:bg-slate-800/90 rounded-2xl p-3.5 shadow-sm border border-sky-100 dark:border-slate-700 flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/60 border-2 border-sky-500 flex items-center justify-center font-black text-sky-600 text-lg">
              {patientName.charAt(0)}
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm">{patientName}</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5" dir="ltr">
                <Phone className="w-3 h-3 text-sky-500" />
                <span>{patientPhone}</span>
                {patientAge && <span className="text-[10px] bg-slate-100 dark:bg-slate-700 px-1.5 py-0.5 rounded-md font-mono">{patientAge} سنة</span>}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5">
            <span className="px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-200 dark:border-emerald-800 flex items-center gap-1">
              <ShieldCheck className="w-3 h-3" />
              <span>ملف موثق</span>
            </span>
            <button
              onClick={handleLogout}
              className="text-[10px] font-bold text-sky-600 dark:text-sky-400 hover:underline cursor-pointer"
            >
              تبديل الحساب
            </button>
          </div>
        </motion.div>

        {/* 5 Navigation Tabs with Motion */}
        <div className="grid grid-cols-5 gap-1 bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          {[
            { id: 'appointments', label: 'مواعيدي', Icon: CalendarCheck, count: upcomingAppointments.length },
            { id: 'prescriptions', label: 'روشتاتي', Icon: FileText, count: prescriptions.length },
            { id: 'invoices', label: 'فواتيري', Icon: Receipt, count: completedAppointments.length },
            { id: 'medical', label: 'ملفي الطبي', Icon: ClipboardList },
            { id: 'location', label: 'الخريطة', Icon: MapPin }
          ].map(({ id, label, Icon, count }) => {
            const active = activeTab === id
            return (
              <motion.button
                key={id}
                whileTap={{ scale: 0.94 }}
                onClick={() => setActiveTab(id as any)}
                className={`py-2 px-0.5 rounded-xl text-[10px] sm:text-[11px] flex flex-col items-center gap-1 transition-all cursor-pointer relative ${
                  active
                    ? 'bg-sky-50 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300 font-extrabold shadow-xs'
                    : 'text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50 dark:hover:bg-slate-700/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${id === 'location' && !active ? 'text-sky-500' : ''}`} />
                <span className="leading-tight">{label}</span>
                {typeof count === 'number' && count > 0 && (
                  <span className="absolute top-1 left-1.5 w-3.5 h-3.5 bg-sky-600 text-white rounded-full text-[8px] flex items-center justify-center font-bold">
                    {count}
                  </span>
                )}
                {id === 'location' && !active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 absolute top-1 right-1.5 animate-pulse" />
                )}
              </motion.button>
            )
          })}
        </div>

        {/* TAB 1: APPOINTMENTS */}
        {activeTab === 'appointments' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 dark:text-white text-sm">مواعيدي في العيادة</h4>
              <button
                onClick={() => setBookingModalOpen(true)}
                className="text-[11px] font-bold text-sky-600 hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>حجز جديد</span>
              </button>
            </div>

            {appointments.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-800/90 rounded-[24px] border border-sky-100 dark:border-slate-700 space-y-3">
                <Calendar className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">لا توجد مواعيد مسجلة حتى الآن</p>
                <button
                  onClick={() => setBookingModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-sky-600 text-white font-bold text-xs"
                >
                  احجز كشفك الآن
                </button>
              </div>
            ) : (
              appointments.map((appt) => {
                const isWaiting = appt.status === 'waiting' || !appt.status
                const isInProgress = appt.status === 'in_progress'
                const isCompleted = appt.status === 'completed'
                const isCancelled = appt.status === 'cancelled'

                return (
                  <div
                    key={appt.id}
                    className="p-4 rounded-[24px] bg-white dark:bg-slate-800/90 border border-sky-100 dark:border-slate-700 space-y-3 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">
                          {appt.date} {appt.time ? `• ${appt.time}` : ''}
                        </div>
                        <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">
                          {appt.serviceName || 'كشف طبي'}
                          {appt.isUrgent && <span className="text-rose-600 font-extrabold mr-1.5">(مستعجل)</span>}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {appt.branchName || 'الفرع الرئيسي'}
                        </div>
                      </div>
                      <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                        <Hourglass className="w-5 h-5" />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1 border-t border-slate-100 dark:border-slate-700/60">
                      <span
                        className={`px-3 py-0.5 rounded-full text-[11px] font-extrabold border ${
                          isCompleted
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200'
                            : isInProgress
                            ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                            : isCancelled
                            ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200'
                            : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200'
                        }`}
                      >
                        {isCompleted
                          ? 'تم الكشف'
                          : isInProgress
                          ? 'دورك الآن!'
                          : isCancelled
                          ? 'ملغي'
                          : 'في قائمة الانتظار'}
                      </span>
                      <span className="text-[11px] font-bold text-sky-600 dark:text-sky-400 font-mono">
                        رقم الدور: #{appt.queue_number || '—'}
                      </span>
                    </div>

                    {/* Actions for upcoming bookings */}
                    {(isWaiting || isInProgress) && (
                      <div className="space-y-2 pt-1">
                        <button
                          onClick={() => {
                            setSelectedApptForLive(appt)
                            setLiveTurnOpen(true)
                          }}
                          className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-xs shadow hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Hourglass className="w-3.5 h-3.5" />
                          <span>متابعة الدور وتتبع الانتظار اللحظي</span>
                        </button>

                        <motion.button
                          whileTap={{ scale: 0.97 }}
                          type="button"
                          onClick={() => {
                            setSelectedBranchForMap(appt.branchName || 'الفرع الرئيسي')
                            setActiveTab('location')
                          }}
                          className="w-full py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800/60 font-bold text-xs transition-colors cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <MapPin className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                          <span>خريطة موقع الفرع والاتجاهات ({appt.branchName || 'الفرع الرئيسي'})</span>
                        </motion.button>

                        <button
                          disabled={cancellingId === appt.id}
                          onClick={() => handleCancelAppointment(appt.id)}
                          className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-bold text-xs transition-colors cursor-pointer disabled:opacity-50"
                        >
                          {cancellingId === appt.id ? 'جاري الإلغاء...' : 'إلغاء الحجز'}
                        </button>
                      </div>
                    )}
                  </div>
                )
              })
            )}

            {/* Quick Clinic Location & Route Shortcut Banner */}
            <motion.div
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (upcomingAppointments[0]?.branchName) {
                  setSelectedBranchForMap(upcomingAppointments[0].branchName)
                }
                setActiveTab('location')
              }}
              className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-cyan-500/10 border border-sky-400/30 flex items-center justify-between cursor-pointer shadow-xs transition-all"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-sky-600 text-white flex items-center justify-center shadow-md shrink-0">
                  <Navigation className="w-5 h-5 animate-pulse" />
                </div>
                <div>
                  <span className="text-xs font-black text-slate-900 dark:text-white block">
                    خريطة العيادة والملاحة الذكية (GPS)
                  </span>
                  <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold">
                    تعرف على الفروع، مواعيد العمل، وخط السير إلى العيادة
                  </span>
                </div>
              </div>
              <span className="text-[11px] font-extrabold text-sky-600 dark:text-sky-400 flex items-center gap-0.5 shrink-0">
                <span>الخريطة</span>
                <ChevronLeft className="w-3.5 h-3.5" />
              </span>
            </motion.div>
          </div>
        )}

        {/* TAB 2: PRESCRIPTIONS */}
        {activeTab === 'prescriptions' && (
          <div className="space-y-3">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">الروشتات الطبية المعتمدة</h4>

            {prescriptions.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-800/90 rounded-[24px] border border-sky-100 dark:border-slate-700 space-y-2">
                <FileText className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">لا توجد روشتات صادرة حتى الآن</p>
                <p className="text-[11px] text-slate-400">ستظهر روشتاتك المعتمدة هنا فور انتهاء الكشف مع الطبيب.</p>
              </div>
            ) : (
              prescriptions.map((rx) => (
                <div
                  key={rx.id}
                  className="p-4 rounded-[24px] bg-white dark:bg-slate-800/90 border border-sky-100 dark:border-slate-700 space-y-3 shadow-sm"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                        {rx.date || 'بتاريخ الكشف'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                        {rx.doctorName ? `د. ${rx.doctorName}` : clinic?.doctorName ? `د. ${clinic.doctorName}` : 'الطبيب المعالج'}
                        {rx.branchName ? ` • ${rx.branchName}` : ''}
                      </div>
                    </div>
                    <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                      <Pill className="w-5 h-5" />
                    </div>
                  </div>

                  {rx.diagnosis && (
                    <div className="bg-sky-50 dark:bg-slate-900 p-2.5 rounded-xl text-xs">
                      <span className="font-bold text-slate-500 block text-[10px]">التشخيص:</span>
                      <span className="font-bold text-slate-800 dark:text-slate-200">{rx.diagnosis}</span>
                    </div>
                  )}

                  {rx.drugs && rx.drugs.length > 0 && (
                    <div className="text-[11px] text-slate-600 dark:text-slate-300 space-y-1">
                      <span className="font-bold text-slate-400 block text-[10px]">الأدوية الموصوفة ({rx.drugs.length}):</span>
                      <div className="flex flex-wrap gap-1">
                        {rx.drugs.map((d: any, i: number) => (
                          <span
                            key={i}
                            className="bg-slate-100 dark:bg-slate-700/60 px-2 py-0.5 rounded-md text-[10px] font-bold"
                          >
                            {d.name || d}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setSelectedRx(rx)}
                    className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-slate-600 font-extrabold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>عرض وتحميل الروشتة الرسمية PDF</span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}

        {/* TAB 3: INVOICES */}
        {activeTab === 'invoices' && (
          <div className="space-y-3">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">الفواتير وسندات الدفع</h4>

            {completedAppointments.length === 0 ? (
              <div className="p-8 text-center bg-white dark:bg-slate-800/90 rounded-[24px] border border-sky-100 dark:border-slate-700 space-y-2">
                <Receipt className="w-10 h-10 text-slate-300 mx-auto" />
                <p className="text-xs font-bold text-slate-600 dark:text-slate-300">لا توجد فواتير صادرة حتى الآن</p>
                <p className="text-[11px] text-slate-400">تظهر الإيصالات الإلكترونية هنا بعد تأكيد دفع الكشف بالعيادة.</p>
              </div>
            ) : (
              completedAppointments.map((appt) => {
                const invData: InvoiceData = {
                  invoiceNumber: appt.invoiceNumber || `INV-${appt.id.slice(0, 8).toUpperCase()}`,
                  clinicName: clinic?.clinicName || 'العيادة الطبية',
                  doctorName: clinic?.doctorName,
                  branchName: appt.branchName,
                  clinicAddress: clinic?.clinicAddress,
                  clinicPhone: clinic?.clinicPhone,
                  patientName: appt.patientName || patientName,
                  patientPhone: appt.phone || patientPhone,
                  date: appt.date,
                  serviceName: appt.serviceName || 'كشف طبي',
                  servicePrice: Number(appt.servicePrice) || 250,
                  discount: Number(appt.discountApplied) || 0,
                  netTotal: Number(appt.netTotal) || Number(appt.servicePrice) || 250,
                  paymentMethod: appt.paymentMethod || 'cash',
                  paymentStatus: (appt.paymentStatus === 'paid' ? 'paid' : 'pending') as any,
                  appointmentId: appt.id,
                  queueNumber: appt.queue_number
                }

                return (
                  <div
                    key={appt.id}
                    className="p-4 rounded-[24px] bg-white dark:bg-slate-800/90 border border-sky-100 dark:border-slate-700 space-y-3 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="font-extrabold text-slate-900 dark:text-white text-xs">
                          فاتورة #{invData.invoiceNumber}
                        </div>
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                          {appt.date} • {appt.serviceName || 'كشف'}
                        </div>
                      </div>
                      <div className="text-left">
                        <span className="font-black text-sm text-sky-600 dark:text-sky-400 font-mono">
                          {invData.netTotal} ج.م
                        </span>
                        <span className="block text-[10px] text-emerald-600 font-bold">
                          {appt.paymentStatus === 'paid' ? 'تم السداد' : 'سداد نقدي بالعيادة'}
                        </span>
                      </div>
                    </div>

                    <button
                      onClick={() => setSelectedInvoice(invData)}
                      className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-slate-600 font-extrabold text-xs transition-all shadow-sm flex items-center justify-center gap-1.5 cursor-pointer"
                    >
                      <Receipt className="w-3.5 h-3.5" />
                      <span>عرض وطباعة الفاتورة PDF</span>
                    </button>
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* TAB 4: MEDICAL PROFILE */}
        {activeTab === 'medical' && (
          <div className="space-y-3">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">الملف الطبي الشخصي</h4>
            <div className="p-4 rounded-[24px] bg-white dark:bg-slate-800/90 border border-sky-100 dark:border-slate-700 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3 py-2 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">الاسم الكامل</span>
                  <strong className="text-slate-900 dark:text-white">{patientName}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">رقم الهاتف</span>
                  <strong dir="ltr">{patientPhone}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2 border-b border-slate-100 dark:border-slate-700">
                <div>
                  <span className="text-slate-400 block text-[10px]">السن المسجل</span>
                  <strong>{patientAge ? `${patientAge} سنة` : 'غير محدد'}</strong>
                </div>
                <div>
                  <span className="text-slate-400 block text-[10px]">العيادة التابع لها</span>
                  <strong className="text-sky-600">{clinic?.clinicName || 'العيادة التخصصية'}</strong>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 py-2">
                <div className="bg-sky-50 dark:bg-slate-900 p-2.5 rounded-xl text-center">
                  <span className="text-2xl font-black text-sky-600 font-mono block">{appointments.length}</span>
                  <span className="text-[10px] text-slate-500 font-bold">إجمالي الكشوفات</span>
                </div>
                <div className="bg-sky-50 dark:bg-slate-900 p-2.5 rounded-xl text-center">
                  <span className="text-2xl font-black text-sky-600 font-mono block">{prescriptions.length}</span>
                  <span className="text-[10px] text-slate-500 font-bold">الروشتات المصروفة</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* TAB 5: CLINIC LOCATION & INTERACTIVE MAP */}
        {activeTab === 'location' && (
          <ClinicLocationMap
            clinic={clinic}
            activeBranchName={selectedBranchForMap}
            patientUpcomingAppt={upcomingAppointments[0]}
          />
        )}

        {/* Footer */}
        <div className="pt-4 border-t border-sky-100 dark:border-slate-800 text-center text-xs text-slate-400 dark:text-slate-500 font-bold">
          <span>جميع الحقوق محفوظة 2026 YallaCodex</span>
        </div>
      </motion.div>

      {/* Booking Modal */}
      {bookingModalOpen && (
        <BookingModal
          clinic={clinic}
          services={clinic?.services || []}
          onClose={() => setBookingModalOpen(false)}
        />
      )}

      {/* Live Queue Turn Modal */}
      {liveTurnOpen && (
        <PatientLiveTurn
          clinic={clinic}
          patientPhone={selectedApptForLive?.phone || patientPhone}
          patientName={selectedApptForLive?.patientName || patientName}
          appointmentId={selectedApptForLive?.id}
          onClose={() => {
            setLiveTurnOpen(false)
            setSelectedApptForLive(null)
          }}
        />
      )}

      {/* Prescription View Modal */}
      {selectedRx && (
        <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-[#081526] rounded-[32px] p-5 shadow-2xl border border-sky-100 dark:border-slate-800 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-base">الروشتة الطبية الرسمية</h3>
              <button
                onClick={() => setSelectedRx(null)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Printable Rx Sheet */}
            <div ref={rxSheetRef} className="overflow-x-auto bg-white p-2 rounded-2xl">
              <A4Prescription
                clinic={clinic}
                patientName={selectedRx.patientName || patientName}
                age={selectedRx.patientAge || patientAge}
                date={selectedRx.date || new Date().toISOString().split('T')[0]}
                diagnosis={selectedRx.diagnosis}
                drugs={selectedRx.drugs || []}
                instructions={selectedRx.instructions}
                branchName={selectedRx.branchName}
                prescriptionNumber={selectedRx.id?.slice(0, 8)}
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                disabled={isDownloadingPdf}
                onClick={handleDownloadRx}
                className="flex-1 py-3 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow hover:opacity-95 transition-all cursor-pointer disabled:opacity-50"
              >
                {isDownloadingPdf ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري إعداد وتحميل الـ PDF...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>تحميل الروشتة PDF</span>
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => setSelectedRx(null)}
                className="py-3 px-5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invoice View Modal */}
      {selectedInvoice && (
        <InvoiceView
          invoice={selectedInvoice}
          isPatientView={true}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  )
}
