'use client'

import React, { useState, useEffect, useRef, useMemo } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot, doc, updateDoc, addDoc } from 'firebase/firestore'
import { PatientLiveTurn } from '@/components/clinic/PatientLiveTurn'
import { BookingModal } from '@/components/clinic/BookingModal'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { InvoiceView, InvoiceData } from '@/components/clinic/InvoiceView'
import { PatientAvatarModal } from '@/components/clinic/PatientAvatarModal'
import { VisitDetailsModal } from '@/components/clinic/VisitDetailsModal'
import { downloadElementAsPdf } from '@/lib/pdfGenerator'
import { uploadPatientAvatarToStorage, deleteAvatarFromStorage, validateImageFile } from '@/lib/avatarUpload'
import { toast } from 'sonner'
import { motion, AnimatePresence } from 'framer-motion'
import { ClinicLocationMap } from '@/components/clinic/ClinicLocationMap'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { NotificationCenter } from '@/components/clinic/NotificationCenter'
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
  ChevronLeft,
  Camera,
  Trash2,
  Clock,
  Activity,
  CreditCard,
  LayoutDashboard,
  Search,
  Filter,
  User,
  ArrowRight,
  TrendingUp,
  Sparkles,
  Heart
} from 'lucide-react'

type TabType = 'overview' | 'appointments' | 'visits' | 'prescriptions' | 'invoices' | 'medical' | 'location'

export default function PatientDashboardPage() {
  const router = useRouter()
  const params = useParams()
  const slug = (params?.slug as string) || 'zizo'

  // Patient session state
  const [patient, setPatient] = useState<{
    phone: string
    name: string
    clinic_id: string
    age?: string
    avatarUrl?: string
  } | null>(null)

  const [clinic, setClinic] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [prescriptions, setPrescriptions] = useState<any[]>([])
  const [loading, setLoading] = useState<boolean>(true)

  // Avatar Management
  const [avatarUrl, setAvatarUrl] = useState<string>('')
  const [patientAccountDocId, setPatientAccountDocId] = useState<string | null>(null)
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false)

  // Active Tab
  const [activeTab, setActiveTab] = useState<TabType>('overview')
  const [selectedBranchForMap, setSelectedBranchForMap] = useState<string | undefined>(undefined)

  // Modals state
  const [liveTurnOpen, setLiveTurnOpen] = useState<boolean>(false)
  const [selectedApptForLive, setSelectedApptForLive] = useState<any | null>(null)
  const [bookingModalOpen, setBookingModalOpen] = useState<boolean>(false)
  const [selectedRx, setSelectedRx] = useState<any | null>(null)
  const [selectedInvoice, setSelectedInvoice] = useState<InvoiceData | null>(null)
  const [selectedVisitForDetails, setSelectedVisitForDetails] = useState<any | null>(null)
  const [cancellingId, setCancellingId] = useState<string | null>(null)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState<boolean>(false)

  // Filter state for visits
  const [visitDateFilter, setVisitDateFilter] = useState<string>('')
  const [visitSearchTerm, setVisitSearchTerm] = useState<string>('')

  const rxSheetRef = useRef<HTMLDivElement>(null)

  // 1. Authenticate Patient & Load Clinic
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
    if (authData.avatarUrl) {
      setAvatarUrl(authData.avatarUrl)
    }

    // Subscribe to Clinic document
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

  // 2. Load Patient Data (Appointments, Prescriptions, Account)
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

        // Patient Account query
        const accQ = query(
          collection(db, 'patient_accounts'),
          where('clinic_id', '==', clinicId),
          where('phone', 'in', searchPhones)
        )
        const accSnap = await getDocs(accQ)
        if (!accSnap.empty) {
          const accDoc = accSnap.docs[0]
          setPatientAccountDocId(accDoc.id)
          const accData = accDoc.data()
          if (accData.avatarUrl) {
            setAvatarUrl(accData.avatarUrl)
            try {
              const raw = localStorage.getItem('patient_auth')
              if (raw) {
                const parsed = JSON.parse(raw)
                parsed.avatarUrl = accData.avatarUrl
                localStorage.setItem('patient_auth', JSON.stringify(parsed))
              }
            } catch (e) {}
          }
        }
      } catch (err) {
        console.error('Error loading patient records:', err)
      } finally {
        setLoading(false)
      }
    }

    loadRecords()

    // Real-time listener on appointments
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

  // Logout Handler
  const handleLogout = () => {
    localStorage.removeItem('patient_auth')
    toast.success('تم تسجيل الخروج بنجاح')
    router.push(`/clinic/${slug}/patient/login`)
  }

  // Save Avatar Handler (Uploads Blob to Storage & Updates Firestore)
  const handleSaveAvatar = async (blob: Blob) => {
    const previousAvatar = avatarUrl
    const clinicId = patient?.clinic_id || clinic?.id || slug
    const cleanPhone = patient?.phone?.trim() || ''

    try {
      // 1. Upload to Firebase Storage
      const downloadUrl = await uploadPatientAvatarToStorage(clinicId, cleanPhone, blob)

      // 2. Optimistic UI update
      setAvatarUrl(downloadUrl)

      // 3. Update localStorage
      const rawAuth = localStorage.getItem('patient_auth')
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth)
        parsed.avatarUrl = downloadUrl
        localStorage.setItem('patient_auth', JSON.stringify(parsed))
      }

      // 4. Update Firestore via API route (and client SDK best-effort)
      try {
        await fetch('/api/patient/avatar', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            clinic_id: clinicId,
            phone: cleanPhone,
            avatarUrl: downloadUrl,
            name: patient?.name || 'المريض',
            age: patient?.age || ''
          })
        })
      } catch (apiErr) {
        console.warn('API avatar save notice, trying direct client Firestore:', apiErr)
        if (patientAccountDocId) {
          await updateDoc(doc(db, 'patient_accounts', patientAccountDocId), {
            avatarUrl: downloadUrl,
            updatedAt: new Date().toISOString()
          })
        }
      }

      toast.success('تم حفظ صورتك الشخصية بنجاح! 📸')
    } catch (err: any) {
      console.error('Error saving avatar:', err)
      // Rollback to previous avatar
      setAvatarUrl(previousAvatar)
      toast.error('تعذر رفع الصورة، تم التراجع عن التعديل')
      throw err
    }
  }

  // Delete Avatar Handler
  const handleDeleteAvatar = async () => {
    const previousAvatar = avatarUrl
    const clinicId = patient?.clinic_id || clinic?.id || slug
    const cleanPhone = patient?.phone?.trim() || ''

    try {
      setAvatarUrl('')

      // 1. Update localStorage
      const rawAuth = localStorage.getItem('patient_auth')
      if (rawAuth) {
        const parsed = JSON.parse(rawAuth)
        delete parsed.avatarUrl
        localStorage.setItem('patient_auth', JSON.stringify(parsed))
      }

      // 2. Call API & Firestore
      await fetch('/api/patient/avatar', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinic_id: clinicId,
          phone: cleanPhone
        })
      })

      if (patientAccountDocId) {
        try {
          await updateDoc(doc(db, 'patient_accounts', patientAccountDocId), {
            avatarUrl: '',
            updatedAt: new Date().toISOString()
          })
        } catch {}
      }

      // 3. Delete from Firebase Storage if URL belongs to storage
      if (previousAvatar) {
        await deleteAvatarFromStorage(previousAvatar)
      }

      toast.success('تمت إزالة صورتك الشخصية والرجوع للحرف الأول')
    } catch (err) {
      console.error('Error removing avatar:', err)
      setAvatarUrl(previousAvatar)
      toast.error('تعذر إزالة الصورة')
      throw err
    }
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

  // Download Prescription as PDF
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

  // Computed data
  const upcomingAppointments = useMemo(
    () => appointments.filter((a) => a.status !== 'completed' && a.status !== 'cancelled'),
    [appointments]
  )

  const completedVisits = useMemo(
    () => appointments.filter((a) => a.status === 'completed' || a.diagnosis || a.doctorInstructions),
    [appointments]
  )

  const invoiceAppointments = useMemo(
    () => appointments.filter((a) => a.status !== 'cancelled'),
    [appointments]
  )

  // Filtered visits
  const filteredVisits = useMemo(() => {
    return completedVisits.filter((v) => {
      const matchDate = !visitDateFilter || v.date?.includes(visitDateFilter)
      const term = visitSearchTerm.trim().toLowerCase()
      const matchSearch =
        !term ||
        v.serviceName?.toLowerCase().includes(term) ||
        v.doctorName?.toLowerCase().includes(term) ||
        v.branchName?.toLowerCase().includes(term) ||
        v.diagnosis?.toLowerCase().includes(term)
      return matchDate && matchSearch
    })
  }, [completedVisits, visitDateFilter, visitSearchTerm])

  // Invoices summary metrics
  const financialMetrics = useMemo(() => {
    let totalBilled = 0
    let totalPaid = 0
    let totalPending = 0

    invoiceAppointments.forEach((appt) => {
      const price = Number(appt.netTotal) || Number(appt.servicePrice) || 250
      totalBilled += price
      const isPaid = appt.paymentStatus === 'paid' || appt.status === 'completed'
      if (isPaid) {
        totalPaid += price
      } else {
        totalPending += price
      }
    })

    return { totalBilled, totalPaid, totalPending }
  }, [invoiceAppointments])

  // Helper to open invoice modal
  const handleOpenInvoiceModal = (appt: any) => {
    const isPaid = appt.paymentStatus === 'paid' || appt.status === 'completed'
    const invData: InvoiceData = {
      invoiceNumber: appt.invoiceNumber || `INV-${appt.id.slice(0, 8).toUpperCase()}`,
      clinicName: clinic?.clinicName || 'العيادة الطبية',
      doctorName: appt.doctorName || clinic?.doctorName,
      branchName: appt.branchName,
      clinicAddress: clinic?.clinicAddress,
      clinicPhone: clinic?.clinicPhone,
      patientName: appt.patientName || patient?.name || 'المريض',
      patientPhone: appt.phone || patient?.phone || '',
      date: appt.date || new Date().toISOString().split('T')[0],
      serviceName: appt.serviceName || 'كشف طبي',
      servicePrice: Number(appt.servicePrice) || 250,
      discount: Number(appt.discountApplied) || 0,
      netTotal: Number(appt.netTotal) || Number(appt.servicePrice) || 250,
      paymentMethod: appt.paymentMethod || 'cash',
      paymentStatus: (isPaid ? 'paid' : 'pending') as any,
      appointmentId: appt.id,
      queueNumber: appt.queue_number
    }
    setSelectedInvoice(invData)
  }

  if (loading) {
    return (
      <div dir="rtl" className="min-h-screen bg-slate-50 dark:bg-[#050d1a] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-9 h-9 animate-spin text-sky-600" />
          <span className="text-sm font-bold text-slate-600 dark:text-slate-300">
            جاري تحميل لوحة تحكم المريض...
          </span>
        </div>
      </div>
    )
  }

  const patientName = patient?.name || 'المريض'
  const patientPhone = patient?.phone || ''
  const patientAge = patient?.age || appointments[0]?.age || ''
  const nextAppt = upcomingAppointments[0]
  const lastVisit = completedVisits[0]
  const lastRx = prescriptions[0]

  // Nav Items config
  const navTabs = [
    { id: 'overview', label: 'لوحة التحكم', Icon: LayoutDashboard },
    { id: 'appointments', label: 'المواعيد', Icon: CalendarCheck, count: upcomingAppointments.length },
    { id: 'visits', label: 'سجل الزيارات', Icon: Stethoscope, count: completedVisits.length },
    { id: 'prescriptions', label: 'الروشتات', Icon: FileText, count: prescriptions.length },
    { id: 'invoices', label: 'الفواتير', Icon: Receipt, count: invoiceAppointments.length },
    { id: 'medical', label: 'الملف الطبي', Icon: ClipboardList },
    { id: 'location', label: 'الخريطة والفروع', Icon: MapPin }
  ]

  return (
    <div dir="rtl" className="min-h-screen bg-[#f8fbff] dark:bg-[#050d1a] text-slate-900 dark:text-white antialiased transition-colors">
      {/* Top Mobile & Desktop Navigation Header */}
      <header className="sticky top-0 z-30 bg-white/80 dark:bg-[#081526]/80 backdrop-blur-md border-b border-sky-100 dark:border-slate-800 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href={`/clinic/${slug}`} className="flex items-center shrink-0" dir="ltr">
              <ClinicLogo size="md" variant="auto" />
            </Link>
            <div className="hidden sm:block border-r border-slate-200 dark:border-slate-700 pr-3 mr-1">
              <h1 className="text-sm font-black text-slate-900 dark:text-white leading-tight">
                {clinic?.clinicName || 'بوابة المريض الذكية'}
              </h1>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium">
                {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'لوحة تحكم المريض الرسمية'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* WhatsApp Support button */}
            <a
              href={clinic?.clinicPhone ? `https://wa.me/20${clinic.clinicPhone.replace(/^0+/, '')}` : 'https://wa.me/201551007018'}
              target="_blank"
              rel="noreferrer"
              className="h-9 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800 text-xs font-bold flex items-center gap-1.5 hover:bg-emerald-100 transition-colors"
              title="تواصل واتساب مع العيادة"
            >
              <MessageCircle className="w-4 h-4" />
              <span className="hidden md:inline">محادثة العيادة</span>
            </a>

            {/* Notifications */}
            {patientPhone && (
              <NotificationCenter
                recipientTarget={patientPhone}
                recipientLabel={patientName}
                recipientType="patient"
              />
            )}

            {/* Logout button */}
            <button
              onClick={handleLogout}
              className="w-9 h-9 rounded-xl bg-rose-50 dark:bg-rose-950/40 text-rose-500 hover:bg-rose-100 dark:hover:bg-rose-900/50 border border-rose-200 dark:border-rose-800 flex items-center justify-center transition-colors cursor-pointer"
              title="تسجيل الخروج"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Responsive Dashboard Container (max-w-7xl) */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-28 lg:pb-12">
        <div className="lg:grid lg:grid-cols-12 lg:gap-8 lg:items-start">
          
          {/* ============================================================ */}
          {/* SIDEBAR COLUMN (lg:col-span-4 xl:col-span-3) */}
          {/* ============================================================ */}
          <aside className="lg:col-span-4 xl:col-span-3 space-y-5 mb-6 lg:mb-0">
            {/* Patient Profile Card with interactive Avatar */}
            <div className="bg-white dark:bg-[#081526] rounded-3xl p-5 shadow-sm border border-sky-100 dark:border-slate-800 space-y-4">
              <div className="flex items-center gap-4">
                {/* Avatar with Camera badge */}
                <div className="relative group shrink-0">
                  <div
                    onClick={() => setIsAvatarModalOpen(true)}
                    className="w-16 h-16 sm:w-18 sm:h-18 rounded-full bg-sky-100 dark:bg-sky-950/70 border-2 border-sky-500 overflow-hidden flex items-center justify-center font-black text-sky-600 text-xl shadow-sm cursor-pointer hover:opacity-90 transition-all select-none"
                    title="اضغط لتغيير صورتك الشخصية"
                  >
                    {avatarUrl ? (
                      <img
                        src={avatarUrl}
                        alt={patientName}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-2xl font-black text-sky-600 dark:text-sky-400">
                        {patientName.charAt(0) || 'م'}
                      </span>
                    )}
                  </div>

                  {/* Camera icon button */}
                  <button
                    type="button"
                    onClick={() => setIsAvatarModalOpen(true)}
                    title="رفع وتعديل الصورة الشخصية"
                    className="absolute -bottom-1 -left-1 w-7 h-7 rounded-lg bg-sky-600 hover:bg-sky-500 text-white flex items-center justify-center shadow-md border-2 border-white dark:border-slate-800 transition-all hover:scale-110 active:scale-95 cursor-pointer"
                  >
                    <Camera className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* Patient Name and Info */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <h2 className="font-black text-slate-900 dark:text-white text-base truncate">
                      {patientName}
                    </h2>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 dark:bg-emerald-950/60 text-emerald-600 dark:text-emerald-400 text-[10px] font-extrabold border border-emerald-200 dark:border-emerald-800 shrink-0 flex items-center gap-0.5">
                      <ShieldCheck className="w-3 h-3" />
                      <span>موثق</span>
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5 mt-1 font-mono" dir="ltr">
                    <Phone className="w-3 h-3 text-sky-500 shrink-0" />
                    <span>{patientPhone}</span>
                  </p>
                  {patientAge && (
                    <span className="inline-block mt-1 text-[11px] text-slate-600 dark:text-slate-300 font-bold bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md">
                      {patientAge} سنة
                    </span>
                  )}
                </div>
              </div>

              {/* Action buttons inside Profile Card */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-xs">
                <button
                  type="button"
                  onClick={() => setIsAvatarModalOpen(true)}
                  className="text-sky-600 dark:text-sky-400 font-bold hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <Camera className="w-3.5 h-3.5" />
                  <span>تعديل الصورة</span>
                </button>
                <button
                  type="button"
                  onClick={handleLogout}
                  className="text-slate-500 dark:text-slate-400 font-bold hover:text-rose-500 cursor-pointer"
                >
                  تبديل الحساب
                </button>
              </div>
            </div>

            {/* Desktop Navigation Menu (hidden on mobile, shown on lg+) */}
            <nav className="hidden lg:block bg-white dark:bg-[#081526] rounded-3xl p-3 shadow-sm border border-sky-100 dark:border-slate-800 space-y-1">
              {navTabs.map(({ id, label, Icon, count }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as TabType)}
                    className={`w-full py-3 px-4 rounded-2xl text-xs flex items-center justify-between transition-all cursor-pointer font-bold ${
                      active
                        ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-300 font-black shadow-xs border-r-4 border-sky-600'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Icon className={`w-4 h-4 ${active ? 'text-sky-600 dark:text-sky-400' : 'text-slate-400'}`} />
                      <span>{label}</span>
                    </div>
                    {typeof count === 'number' && count > 0 && (
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-black font-mono ${
                        active
                          ? 'bg-sky-600 text-white'
                          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </nav>

            {/* Quick Action Button in Sidebar */}
            <div className="space-y-2">
              <button
                type="button"
                onClick={() => setBookingModalOpen(true)}
                className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-black text-xs sm:text-sm shadow-md hover:opacity-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>حجز موعد أو كشف جديد</span>
              </button>

              {/* Clinic Fast Info Card */}
              <div className="bg-sky-50/60 dark:bg-sky-950/30 rounded-2xl p-4 border border-sky-100 dark:border-sky-800/50 space-y-2 text-xs">
                <div className="flex items-center gap-2 text-sky-700 dark:text-sky-300 font-extrabold">
                  <Building2 className="w-4 h-4" />
                  <span>معلومات العيادة</span>
                </div>
                <p className="text-[11px] text-slate-600 dark:text-slate-300 font-medium">
                  {clinic?.clinicAddress || 'العنوان متاح عبر صفحة الخريطة والفروع'}
                </p>
                <button
                  type="button"
                  onClick={() => setActiveTab('location')}
                  className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-1"
                >
                  <MapPin className="w-3 h-3" />
                  <span>عرض الفروع ومواعيد العمل</span>
                </button>
              </div>
            </div>
          </aside>

          {/* ============================================================ */}
          {/* MAIN CONTENT WORKSPACE (lg:col-span-8 xl:col-span-9) */}
          {/* ============================================================ */}
          <div className="lg:col-span-8 xl:col-span-9 space-y-6">
            
            {/* Mobile Navigation Tabs (Horizontal Scrollable Pills for <lg) */}
            <div className="lg:hidden bg-white dark:bg-[#081526] p-2 rounded-2xl shadow-sm border border-sky-100 dark:border-slate-800 overflow-x-auto no-scrollbar flex items-center gap-1.5">
              {navTabs.map(({ id, label, Icon, count }) => {
                const active = activeTab === id
                return (
                  <button
                    key={id}
                    onClick={() => setActiveTab(id as TabType)}
                    className={`shrink-0 py-2 px-3 rounded-xl text-xs flex items-center gap-1.5 transition-all cursor-pointer font-bold ${
                      active
                        ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-300 font-black shadow-xs'
                        : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50'
                    }`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    <span>{label}</span>
                    {typeof count === 'number' && count > 0 && (
                      <span className={`px-1.5 py-0.2 rounded-full text-[9px] font-mono ${
                        active ? 'bg-sky-600 text-white font-black' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                      }`}>
                        {count}
                      </span>
                    )}
                  </button>
                )
              })}
            </div>

            {/* Top Metric Cards / Summary Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
              <div className="bg-white dark:bg-[#081526] p-4 rounded-3xl border border-sky-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <CalendarCheck className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono block leading-none">
                    {upcomingAppointments.length}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    مواعيد قادمة
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#081526] p-4 rounded-3xl border border-sky-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-indigo-100 dark:bg-indigo-950/70 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono block leading-none">
                    {completedVisits.length}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    زيارات مسجلة
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#081526] p-4 rounded-3xl border border-sky-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                  <FileText className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white font-mono block leading-none">
                    {prescriptions.length}
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    روشتات معتمدة
                  </span>
                </div>
              </div>

              <div className="bg-white dark:bg-[#081526] p-4 rounded-3xl border border-sky-100 dark:border-slate-800 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-amber-100 dark:bg-amber-950/70 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                  <Receipt className="w-5 h-5" />
                </div>
                <div>
                  <span className="text-base sm:text-lg font-black text-slate-900 dark:text-white font-mono block leading-none truncate">
                    {financialMetrics.totalPaid} ج.م
                  </span>
                  <span className="text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 font-bold">
                    إجمالي المسدد
                  </span>
                </div>
              </div>
            </div>

            {/* Next Upcoming Appointment & Live Queue Banner */}
            {nextAppt ? (
              <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 text-white shadow-lg space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 backdrop-blur-sm text-white text-xs font-black">
                      <Hourglass className="w-3.5 h-3.5 animate-spin" />
                      <span>موعدك القادم بالعيادة</span>
                    </span>
                    <h3 className="text-base sm:text-lg font-black">
                      {nextAppt.serviceName || 'كشف طبي'} {nextAppt.isUrgent && '• مستعجل'}
                    </h3>
                    <p className="text-xs text-sky-100 flex items-center gap-2">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>{nextAppt.date} {nextAppt.time ? `• ${nextAppt.time}` : ''}</span>
                      <span>•</span>
                      <Building2 className="w-3.5 h-3.5" />
                      <span>{nextAppt.branchName || 'الفرع الرئيسي'}</span>
                    </p>
                  </div>

                  <div className="flex flex-col sm:items-end gap-1 shrink-0">
                    <div className="text-right sm:text-left">
                      <span className="text-[11px] text-sky-200 block">رقم الدور</span>
                      <span className="text-2xl font-black font-mono">
                        #{nextAppt.queue_number || '—'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="pt-2 border-t border-white/15 flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedApptForLive(nextAppt)
                      setLiveTurnOpen(true)
                    }}
                    className="flex-1 min-w-[200px] py-2.5 px-4 rounded-xl bg-white text-sky-800 hover:bg-sky-50 font-black text-xs shadow-sm flex items-center justify-center gap-2 cursor-pointer transition-all"
                  >
                    <Hourglass className="w-4 h-4 text-sky-600" />
                    <span>متابعة الدور وتتبع الانتظار اللحظي</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setSelectedBranchForMap(nextAppt.branchName || 'الفرع الرئيسي')
                      setActiveTab('location')
                    }}
                    className="py-2.5 px-4 rounded-xl bg-white/15 hover:bg-white/25 text-white font-bold text-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <MapPin className="w-3.5 h-3.5" />
                    <span>خريطة الفرع</span>
                  </button>

                  <button
                    type="button"
                    disabled={cancellingId === nextAppt.id}
                    onClick={() => handleCancelAppointment(nextAppt.id)}
                    className="py-2.5 px-3 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-100 font-bold text-xs transition-all cursor-pointer disabled:opacity-50"
                  >
                    {cancellingId === nextAppt.id ? 'جاري الإلغاء...' : 'إلغاء الحجز'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4">
                <div className="flex items-center gap-4 text-center sm:text-right">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                    <Calendar className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-sm sm:text-base">
                      ليس لديك مواعيد قادمة مسجلة حالياً
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                      يمكنك حجز كشف جديد أو استشارة طبية بنقرة واحدة
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setBookingModalOpen(true)}
                  className="w-full sm:w-auto px-5 py-3 rounded-2xl bg-sky-600 hover:bg-sky-500 text-white font-black text-xs shadow-md transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  <span>احجز موعدك الآن</span>
                </button>
              </div>
            )}

            {/* TAB CONTENTS */}
            <div className="space-y-6">

              {/* TAB: OVERVIEW */}
              {activeTab === 'overview' && (
                <div className="space-y-6">
                  {/* Two columns: Recent Visits & Recent Prescriptions */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Recent Visit Preview */}
                    <div className="bg-white dark:bg-[#081526] rounded-3xl p-5 border border-sky-100 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-sm">
                          <Stethoscope className="w-4 h-4 text-sky-600" />
                          <span>آخر زيارة للعيادة</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('visits')}
                          className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>كل الزيارات ({completedVisits.length})</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {lastVisit ? (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-black text-slate-900 dark:text-white block">
                                {lastVisit.serviceName || 'كشف طبي'}
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {lastVisit.date} • د. {lastVisit.doctorName || clinic?.doctorName || 'طبيب العيادة'}
                              </span>
                            </div>
                            <span className="px-2.5 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                              تم الكشف
                            </span>
                          </div>

                          {lastVisit.diagnosis && (
                            <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/40 text-xs">
                              <span className="text-[10px] text-slate-400 font-bold block">التشخيص:</span>
                              <span className="font-bold text-slate-800 dark:text-slate-200">{lastVisit.diagnosis}</span>
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedVisitForDetails(lastVisit)}
                            className="w-full py-2 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span>عرض تفاصيل الزيارة والتوصيات</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-slate-400 text-xs space-y-2">
                          <Stethoscope className="w-8 h-8 mx-auto opacity-30" />
                          <p>لا توجد زيارات سابقة مسجلة حتى الآن</p>
                        </div>
                      )}
                    </div>

                    {/* Recent Prescription Preview */}
                    <div className="bg-white dark:bg-[#081526] rounded-3xl p-5 border border-sky-100 dark:border-slate-800 shadow-sm space-y-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-sm">
                          <FileText className="w-4 h-4 text-emerald-600" />
                          <span>آخر روشتة معتمدة</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => setActiveTab('prescriptions')}
                          className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
                        >
                          <span>كل الروشتات ({prescriptions.length})</span>
                          <ChevronLeft className="w-3.5 h-3.5" />
                        </button>
                      </div>

                      {lastRx ? (
                        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-700/60 space-y-3">
                          <div className="flex items-start justify-between">
                            <div>
                              <span className="text-xs font-black text-slate-900 dark:text-white block">
                                روشتة علاجية ({lastRx.drugs?.length || 0} أدوية)
                              </span>
                              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                                {lastRx.date} • {lastRx.doctorName ? `د. ${lastRx.doctorName}` : clinic?.doctorName ? `د. ${clinic.doctorName}` : 'الطبيب المعالج'}
                              </span>
                            </div>
                            <div className="w-8 h-8 rounded-xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                              <Pill className="w-4 h-4" />
                            </div>
                          </div>

                          {lastRx.drugs && lastRx.drugs.length > 0 && (
                            <div className="flex flex-wrap gap-1">
                              {lastRx.drugs.slice(0, 3).map((d: any, idx: number) => (
                                <span
                                  key={idx}
                                  className="px-2 py-0.5 rounded-md bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-slate-700 dark:text-slate-300"
                                >
                                  {d.name || d}
                                </span>
                              ))}
                              {lastRx.drugs.length > 3 && (
                                <span className="text-[10px] text-slate-400 font-bold self-center">
                                  +{lastRx.drugs.length - 3} المزيد
                                </span>
                              )}
                            </div>
                          )}

                          <button
                            type="button"
                            onClick={() => setSelectedRx(lastRx)}
                            className="w-full py-2 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-bold text-xs shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>عرض وتحميل الروشتة PDF</span>
                          </button>
                        </div>
                      ) : (
                        <div className="p-6 text-center text-slate-400 text-xs space-y-2">
                          <FileText className="w-8 h-8 mx-auto opacity-30" />
                          <p>لا توجد روشتات صادرة حتى الآن</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Financial Overview Card */}
                  <div className="bg-white dark:bg-[#081526] rounded-3xl p-5 border border-sky-100 dark:border-slate-800 shadow-sm space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2 font-black text-slate-900 dark:text-white text-sm">
                        <Receipt className="w-4 h-4 text-sky-600" />
                        <span>الملخص المالي والفواتير</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setActiveTab('invoices')}
                        className="text-xs font-bold text-sky-600 dark:text-sky-400 hover:underline flex items-center gap-0.5"
                      >
                        <span>عرض جدول الفواتير</span>
                        <ChevronLeft className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block font-bold">إجمالي المطالبات</span>
                        <span className="text-lg font-black text-slate-900 dark:text-white font-mono mt-1 block">
                          {financialMetrics.totalBilled} ج.م
                        </span>
                      </div>
                      <div className="p-4 rounded-2xl bg-emerald-50/60 dark:bg-emerald-950/30 border border-emerald-100 dark:border-emerald-800/40">
                        <span className="text-[11px] text-emerald-600 dark:text-emerald-400 block font-bold">المبالغ المسددة</span>
                        <span className="text-lg font-black text-emerald-700 dark:text-emerald-300 font-mono mt-1 block">
                          {financialMetrics.totalPaid} ج.م
                        </span>
                      </div>
                      <div className="p-4 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-100 dark:border-amber-800/40">
                        <span className="text-[11px] text-amber-600 dark:text-amber-400 block font-bold">بانتظار التأكيد / متبقي</span>
                        <span className="text-lg font-black text-amber-700 dark:text-amber-300 font-mono mt-1 block">
                          {financialMetrics.totalPending} ج.م
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: APPOINTMENTS */}
              {activeTab === 'appointments' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        مواعيدي في العيادة
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        متابعة قائمة الانتظار، حجز كشف جديد، وإلغاء المواعيد
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setBookingModalOpen(true)}
                      className="px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-500 text-white font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                    >
                      <Plus className="w-4 h-4" />
                      <span>حجز جديد</span>
                    </button>
                  </div>

                  {appointments.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-[#081526] rounded-3xl border border-sky-100 dark:border-slate-800 space-y-3">
                      <Calendar className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                        لا توجد مواعيد مسجلة حتى الآن
                      </h4>
                      <p className="text-xs text-slate-400 max-w-sm mx-auto">
                        احجز كشفك الآن بسهولة للاستفادة من المتابعة اللحظية للدور بدون انتظار طويل
                      </p>
                      <button
                        type="button"
                        onClick={() => setBookingModalOpen(true)}
                        className="px-5 py-2.5 rounded-xl bg-sky-600 text-white font-black text-xs"
                      >
                        احجز كشفك الآن
                      </button>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {appointments.map((appt) => {
                        const isWaiting = appt.status === 'waiting' || !appt.status
                        const isInProgress = appt.status === 'in_progress'
                        const isCompleted = appt.status === 'completed'
                        const isCancelled = appt.status === 'cancelled'

                        return (
                          <div
                            key={appt.id}
                            className="bg-white dark:bg-[#081526] rounded-3xl p-5 border border-sky-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between"
                          >
                            <div className="space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div>
                                  <div className="font-black text-slate-900 dark:text-white text-sm">
                                    {appt.serviceName || 'كشف طبي'} {appt.isUrgent && <span className="text-rose-600 font-extrabold mr-1">(مستعجل)</span>}
                                  </div>
                                  <div className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                                    <Calendar className="w-3.5 h-3.5 text-sky-500" />
                                    <span>{appt.date} {appt.time ? `• ${appt.time}` : ''}</span>
                                  </div>
                                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 flex items-center gap-1.5">
                                    <Building2 className="w-3.5 h-3.5 text-slate-400" />
                                    <span>{appt.branchName || 'الفرع الرئيسي'}</span>
                                  </div>
                                </div>
                                <div className="text-left shrink-0">
                                  <span className="text-[10px] text-slate-400 block">رقم الدور</span>
                                  <span className="text-xl font-black text-sky-600 dark:text-sky-400 font-mono">
                                    #{appt.queue_number || '—'}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-slate-800">
                                <span
                                  className={`px-3 py-0.5 rounded-full text-xs font-black border ${
                                    isCompleted
                                      ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800'
                                      : isInProgress
                                      ? 'bg-emerald-500 text-white border-emerald-600 animate-pulse'
                                      : isCancelled
                                      ? 'bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800'
                                      : 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800'
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
                                <span className="text-xs font-mono font-bold text-slate-700 dark:text-slate-300">
                                  {appt.netTotal || appt.servicePrice || 250} ج.م
                                </span>
                              </div>
                            </div>

                            {/* Actions */}
                            <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                              {(isWaiting || isInProgress) && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setSelectedApptForLive(appt)
                                      setLiveTurnOpen(true)
                                    }}
                                    className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-xs shadow-xs hover:opacity-95 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                                  >
                                    <Hourglass className="w-3.5 h-3.5" />
                                    <span>متابعة الدور وتتبع الانتظار اللحظي</span>
                                  </button>

                                  <div className="grid grid-cols-2 gap-2">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedBranchForMap(appt.branchName || 'الفرع الرئيسي')
                                        setActiveTab('location')
                                      }}
                                      className="py-2 rounded-xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold text-xs transition-colors flex items-center justify-center gap-1 cursor-pointer"
                                    >
                                      <MapPin className="w-3.5 h-3.5" />
                                      <span>الخريطة</span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={cancellingId === appt.id}
                                      onClick={() => handleCancelAppointment(appt.id)}
                                      className="py-2 rounded-xl bg-rose-50 dark:bg-rose-950/40 hover:bg-rose-100 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800 font-bold text-xs transition-colors flex items-center justify-center cursor-pointer disabled:opacity-50"
                                    >
                                      {cancellingId === appt.id ? 'جاري الإلغاء...' : 'إلغاء الحجز'}
                                    </button>
                                  </div>
                                </>
                              )}

                              {isCompleted && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedVisitForDetails(appt)}
                                  className="w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 border border-slate-200 dark:border-slate-700 font-bold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>تفاصيل الزيارة والتوصيات</span>
                                </button>
                              )}
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: VISITS (سجل الزيارات والعيادات) */}
              {activeTab === 'visits' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        سجل الزيارات الطبية
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        تاريخ زياراتك للعيادة والتشخيصات والتوصيات الطبية المتاحة
                      </p>
                    </div>

                    {/* Filter and Search Bar */}
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          value={visitSearchTerm}
                          onChange={(e) => setVisitSearchTerm(e.target.value)}
                          placeholder="بحث بالطبيب أو الخدمة..."
                          className="w-44 sm:w-52 pr-8 pl-3 py-2 rounded-xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 text-xs text-slate-800 dark:text-slate-200 placeholder:text-slate-400"
                        />
                      </div>
                      <input
                        type="date"
                        value={visitDateFilter}
                        onChange={(e) => setVisitDateFilter(e.target.value)}
                        className="py-2 px-3 rounded-xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 text-xs text-slate-700 dark:text-slate-200"
                      />
                      {(visitDateFilter || visitSearchTerm) && (
                        <button
                          type="button"
                          onClick={() => {
                            setVisitDateFilter('')
                            setVisitSearchTerm('')
                          }}
                          className="p-2 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 text-xs font-bold hover:text-rose-500"
                          title="مسح الفلتر"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {filteredVisits.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-[#081526] rounded-3xl border border-sky-100 dark:border-slate-800 space-y-3">
                      <Stethoscope className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                        {completedVisits.length === 0
                          ? 'لا توجد زيارات سابقة مسجلة'
                          : 'لا توجد نتائج تطابق معايير البحث'}
                      </h4>
                      <p className="text-xs text-slate-400">
                        {completedVisits.length === 0
                          ? 'ستظهر هنا كافة تفاصيل زياراتك فور انتهاء الكشف وتسجيل التوصيات.'
                          : 'جرب تغيير التاريخ أو عبارة البحث.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {filteredVisits.map((visit) => {
                        const linkedRx = prescriptions.find(
                          (rx) => rx.appointmentId === visit.id || rx.date === visit.date
                        )
                        return (
                          <div
                            key={visit.id}
                            className="bg-white dark:bg-[#081526] rounded-3xl p-5 border border-sky-100 dark:border-slate-800 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4 hover:border-sky-300 transition-colors"
                          >
                            <div className="flex items-start gap-4">
                              <div className="w-11 h-11 rounded-2xl bg-sky-100 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                                <Stethoscope className="w-5 h-5" />
                              </div>
                              <div className="space-y-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h4 className="font-black text-slate-900 dark:text-white text-sm">
                                    {visit.serviceName || 'كشف طبي'}
                                  </h4>
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300">
                                    تم الكشف
                                  </span>
                                </div>
                                <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-2">
                                  <span>{visit.date} {visit.time ? `• ${visit.time}` : ''}</span>
                                  <span>•</span>
                                  <span>د. {visit.doctorName || clinic?.doctorName || 'طبيب العيادة'}</span>
                                  <span>•</span>
                                  <span>{visit.branchName || 'الفرع الرئيسي'}</span>
                                </p>
                                {visit.diagnosis && (
                                  <p className="text-xs text-slate-700 dark:text-slate-300 font-bold bg-sky-50 dark:bg-sky-950/40 px-2.5 py-1 rounded-lg inline-block">
                                    التشخيص: {visit.diagnosis}
                                  </p>
                                )}
                              </div>
                            </div>

                            <div className="flex items-center gap-2 sm:self-center shrink-0">
                              {linkedRx && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedRx(linkedRx)}
                                  className="py-2.5 px-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                                  title="عرض الروشتة المرتبطة"
                                >
                                  <FileText className="w-3.5 h-3.5" />
                                  <span>الروشتة</span>
                                </button>
                              )}

                              <button
                                type="button"
                                onClick={() => setSelectedVisitForDetails(visit)}
                                className="py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-xs shadow-xs hover:opacity-95 transition-all flex items-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>تفاصيل الزيارة</span>
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: PRESCRIPTIONS */}
              {activeTab === 'prescriptions' && (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        الروشتات الطبية المعتمدة
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        معاينة وطباعة الروشتات الرسمية بصيغة A4 معتمدة من الطبيب
                      </p>
                    </div>
                  </div>

                  {prescriptions.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-[#081526] rounded-3xl border border-sky-100 dark:border-slate-800 space-y-3">
                      <FileText className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                        لا توجد روشتات صادرة حتى الآن
                      </h4>
                      <p className="text-xs text-slate-400">
                        ستظهر روشتاتك المعتمدة هنا فور انتهاء الكشف الطبي مع الطبيب.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {prescriptions.map((rx) => (
                        <div
                          key={rx.id}
                          className="bg-white dark:bg-[#081526] rounded-3xl p-5 border border-sky-100 dark:border-slate-800 shadow-sm space-y-4 flex flex-col justify-between"
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between">
                              <div>
                                <span className="font-black text-slate-900 dark:text-white text-sm block">
                                  {rx.date || 'بتاريخ الكشف'}
                                </span>
                                <span className="text-xs text-slate-500 dark:text-slate-400">
                                  {rx.doctorName ? `د. ${rx.doctorName}` : clinic?.doctorName ? `د. ${clinic.doctorName}` : 'الطبيب المعالج'}
                                  {rx.branchName ? ` • ${rx.branchName}` : ''}
                                </span>
                              </div>
                              <div className="w-10 h-10 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                                <Pill className="w-5 h-5" />
                              </div>
                            </div>

                            {rx.diagnosis && (
                              <div className="bg-sky-50 dark:bg-sky-950/40 p-2.5 rounded-xl text-xs">
                                <span className="font-bold text-slate-500 dark:text-slate-400 block text-[10px]">التشخيص:</span>
                                <span className="font-bold text-slate-800 dark:text-slate-200">{rx.diagnosis}</span>
                              </div>
                            )}

                            {rx.drugs && rx.drugs.length > 0 && (
                              <div className="space-y-1 text-xs">
                                <span className="text-[10px] text-slate-400 font-bold block">
                                  الأدوية الموصوفة ({rx.drugs.length}):
                                </span>
                                <div className="flex flex-wrap gap-1">
                                  {rx.drugs.map((d: any, idx: number) => (
                                    <span
                                      key={idx}
                                      className="bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded-md text-[10px] font-bold text-slate-700 dark:text-slate-300"
                                    >
                                      {d.name || d}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>

                          <button
                            type="button"
                            onClick={() => setSelectedRx(rx)}
                            className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-slate-700 font-extrabold text-xs transition-all shadow-xs flex items-center justify-center gap-1.5 cursor-pointer pt-2"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            <span>عرض وتحميل الروشتة الرسمية PDF</span>
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* TAB: INVOICES (جدول للكمبيوتر وبطاقات للموبايل) */}
              {activeTab === 'invoices' && (
                <div className="space-y-4">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="font-black text-slate-900 dark:text-white text-base">
                        الفواتير وسندات الدفع
                      </h3>
                      <p className="text-xs text-slate-500 dark:text-slate-400">
                        سجل الفواتير وسندات السداد الإلكترونية المعتمدة
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-600 dark:text-slate-300 bg-white dark:bg-[#081526] px-3 py-1.5 rounded-xl border border-sky-100 dark:border-slate-800">
                        إجمالي الفواتير: <strong className="font-mono text-sky-600">{invoiceAppointments.length}</strong>
                      </span>
                    </div>
                  </div>

                  {invoiceAppointments.length === 0 ? (
                    <div className="p-12 text-center bg-white dark:bg-[#081526] rounded-3xl border border-sky-100 dark:border-slate-800 space-y-3">
                      <Receipt className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
                      <h4 className="font-bold text-slate-700 dark:text-slate-200 text-sm">
                        لا توجد فواتير أو حجوزات مسجلة حتى الآن
                      </h4>
                      <p className="text-xs text-slate-400">
                        تظهر الإيصالات الإلكترونية وفواتير الكشف هنا فور تأكيد أي حجز بالعيادة.
                      </p>
                    </div>
                  ) : (
                    <>
                      {/* DESKTOP TABLE VIEW (hidden on mobile, shown on md+) */}
                      <div className="hidden md:block bg-white dark:bg-[#081526] rounded-3xl border border-sky-100 dark:border-slate-800 shadow-sm overflow-hidden">
                        <table className="w-full text-right text-xs">
                          <thead className="bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 text-slate-500 dark:text-slate-400 font-bold">
                            <tr>
                              <th className="py-3 px-4">رقم الفاتورة</th>
                              <th className="py-3 px-4">التاريخ</th>
                              <th className="py-3 px-4">الخدمة والفرع</th>
                              <th className="py-3 px-4">المبلغ</th>
                              <th className="py-3 px-4">الخصم</th>
                              <th className="py-3 px-4">الصافي (ج.م)</th>
                              <th className="py-3 px-4">طريقة الدفع</th>
                              <th className="py-3 px-4">الحالة</th>
                              <th className="py-3 px-4 text-center">الإجراء</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100 dark:divide-slate-800 font-medium">
                            {invoiceAppointments.map((appt) => {
                              const isPaid = appt.paymentStatus === 'paid' || appt.status === 'completed'
                              const isPending = appt.paymentStatus === 'pending_verification'
                              const invNumber = appt.invoiceNumber || `INV-${appt.id.slice(0, 8).toUpperCase()}`
                              const price = Number(appt.servicePrice) || 250
                              const discount = Number(appt.discountApplied) || 0
                              const net = Number(appt.netTotal) || price

                              return (
                                <tr key={appt.id} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30 transition-colors">
                                  <td className="py-3.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                                    #{invNumber}
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300">
                                    {appt.date}
                                  </td>
                                  <td className="py-3.5 px-4 font-bold text-slate-800 dark:text-slate-200">
                                    {appt.serviceName || 'كشف'} {appt.branchName ? `(${appt.branchName})` : ''}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-slate-500">
                                    {price}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono text-rose-500">
                                    {discount > 0 ? `-${discount}` : '0'}
                                  </td>
                                  <td className="py-3.5 px-4 font-mono font-black text-slate-900 dark:text-white text-sm">
                                    {net} ج.م
                                  </td>
                                  <td className="py-3.5 px-4 text-slate-600 dark:text-slate-400">
                                    {appt.paymentMethod === 'instapay'
                                      ? 'انستاباي'
                                      : appt.paymentMethod === 'wallet'
                                      ? 'محفظة إلكترونية'
                                      : 'سداد نقدي'}
                                  </td>
                                  <td className="py-3.5 px-4">
                                    <span
                                      className={`px-2.5 py-0.5 rounded-full text-[10px] font-black inline-block ${
                                        isPaid
                                          ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                          : isPending
                                          ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                          : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                      }`}
                                    >
                                      {isPaid ? 'مدفوعة' : isPending ? 'بانتظار التأكيد' : 'غير مدفوعة'}
                                    </span>
                                  </td>
                                  <td className="py-3.5 px-4 text-center">
                                    <button
                                      type="button"
                                      onClick={() => handleOpenInvoiceModal(appt)}
                                      className="py-1.5 px-3 rounded-lg bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800 font-bold text-xs transition-colors cursor-pointer"
                                    >
                                      عرض
                                    </button>
                                  </td>
                                </tr>
                              )
                            })}
                          </tbody>
                        </table>
                      </div>

                      {/* MOBILE CARDS VIEW (md:hidden) */}
                      <div className="md:hidden space-y-3">
                        {invoiceAppointments.map((appt) => {
                          const isPaid = appt.paymentStatus === 'paid' || appt.status === 'completed'
                          const isPending = appt.paymentStatus === 'pending_verification'
                          const invNumber = appt.invoiceNumber || `INV-${appt.id.slice(0, 8).toUpperCase()}`
                          const net = Number(appt.netTotal) || Number(appt.servicePrice) || 250

                          return (
                            <div
                              key={appt.id}
                              className="bg-white dark:bg-[#081526] rounded-3xl p-5 border border-sky-100 dark:border-slate-800 shadow-sm space-y-3"
                            >
                              <div className="flex items-start justify-between">
                                <div>
                                  <span className="font-mono font-bold text-sky-600 dark:text-sky-400 text-xs block">
                                    فاتورة #{invNumber}
                                  </span>
                                  <h4 className="font-black text-slate-900 dark:text-white text-sm mt-0.5">
                                    {appt.serviceName || 'كشف طبي'}
                                  </h4>
                                  <p className="text-xs text-slate-500 dark:text-slate-400">
                                    {appt.date} {appt.branchName ? `• ${appt.branchName}` : ''}
                                  </p>
                                </div>
                                <div className="text-left">
                                  <span className="font-black text-base text-slate-900 dark:text-white font-mono block">
                                    {net} ج.م
                                  </span>
                                  <span
                                    className={`px-2 py-0.5 rounded-full text-[10px] font-black inline-block mt-1 ${
                                      isPaid
                                        ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                                        : isPending
                                        ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                                        : 'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-300'
                                    }`}
                                  >
                                    {isPaid ? 'مدفوعة' : isPending ? 'بانتظار التأكيد' : 'سداد نقدي'}
                                  </span>
                                </div>
                              </div>

                              <button
                                type="button"
                                onClick={() => handleOpenInvoiceModal(appt)}
                                className="w-full py-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 hover:bg-sky-50 dark:hover:bg-slate-700 text-sky-700 dark:text-sky-300 border border-slate-200 dark:border-slate-700 font-extrabold text-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <Receipt className="w-3.5 h-3.5" />
                                <span>عرض وطباعة الفاتورة PDF</span>
                              </button>
                            </div>
                          )
                        })}
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* TAB: MEDICAL PROFILE */}
              {activeTab === 'medical' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                      الملف الطبي والبيانات الشخصية
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      معلومات المريض الأساسية وسجل التعاملات الموثق
                    </p>
                  </div>

                  <div className="bg-white dark:bg-[#081526] rounded-3xl p-6 border border-sky-100 dark:border-slate-800 shadow-sm space-y-5">
                    {/* Patient identity overview */}
                    <div className="flex items-center gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                      <div
                        onClick={() => setIsAvatarModalOpen(true)}
                        className="w-16 h-16 rounded-full bg-sky-100 dark:bg-sky-950/70 border-2 border-sky-500 overflow-hidden flex items-center justify-center font-black text-sky-600 text-xl cursor-pointer"
                      >
                        {avatarUrl ? (
                          <img src={avatarUrl} alt={patientName} className="w-full h-full object-cover" />
                        ) : (
                          <span>{patientName.charAt(0) || 'م'}</span>
                        )}
                      </div>
                      <div>
                        <h4 className="font-black text-slate-900 dark:text-white text-base">
                          {patientName}
                        </h4>
                        <p className="text-xs text-slate-500 dark:text-slate-400 font-mono mt-0.5" dir="ltr">
                          {patientPhone}
                        </p>
                        <button
                          type="button"
                          onClick={() => setIsAvatarModalOpen(true)}
                          className="text-[11px] font-bold text-sky-600 dark:text-sky-400 hover:underline mt-1 block cursor-pointer"
                        >
                          تغيير الصورة الشخصية (بحد أقصى 2 ميجابايت)
                        </button>
                      </div>
                    </div>

                    {/* Detailed info grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block font-bold">الاسم المسجل</span>
                        <strong className="text-slate-900 dark:text-white mt-1 block">{patientName}</strong>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block font-bold">رقم الهاتف المعتمد</span>
                        <strong className="text-slate-900 dark:text-white font-mono mt-1 block" dir="ltr">{patientPhone}</strong>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block font-bold">العمر / السن</span>
                        <strong className="text-slate-900 dark:text-white mt-1 block">
                          {patientAge ? `${patientAge} سنة` : 'غير محدد'}
                        </strong>
                      </div>

                      <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60">
                        <span className="text-[11px] text-slate-400 block font-bold">العيادة التابع لها</span>
                        <strong className="text-sky-600 dark:text-sky-400 mt-1 block">
                          {clinic?.clinicName || 'العيادة التخصصية'}
                        </strong>
                      </div>

                      {/* Residential area if present in latest appointment */}
                      {appointments[0]?.residentialArea && (
                        <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-100 dark:border-slate-700/60 sm:col-span-2">
                          <span className="text-[11px] text-slate-400 block font-bold flex items-center gap-1">
                            <MapPin className="w-3.5 h-3.5 text-sky-500" />
                            <span>منطقة السكن المسجلة</span>
                          </span>
                          <strong className="text-slate-900 dark:text-white mt-1 block">
                            {[
                              appointments[0].residentialArea.governorateNameAr,
                              appointments[0].residentialArea.cityNameAr,
                              appointments[0].residentialArea.areaNameAr || appointments[0].residentialArea.customAreaName
                            ]
                              .filter(Boolean)
                              .join(' — ')}
                          </strong>
                        </div>
                      )}
                    </div>

                    {/* Historical counters */}
                    <div className="pt-3 border-t border-slate-100 dark:border-slate-800 grid grid-cols-3 gap-3 text-center">
                      <div className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40">
                        <span className="text-xl font-black text-sky-600 font-mono block">
                          {appointments.length}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">إجمالي الحجوزات</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40">
                        <span className="text-xl font-black text-emerald-600 font-mono block">
                          {prescriptions.length}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">الروشتات المصروفة</span>
                      </div>
                      <div className="p-3 rounded-2xl bg-indigo-50 dark:bg-indigo-950/40">
                        <span className="text-xl font-black text-indigo-600 font-mono block">
                          {completedVisits.length}
                        </span>
                        <span className="text-[10px] text-slate-500 font-bold">زيارات مكتملة</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB: LOCATION & MAP */}
              {activeTab === 'location' && (
                <div className="space-y-4">
                  <div>
                    <h3 className="font-black text-slate-900 dark:text-white text-base">
                      خريطة العيادة ومواقع الفروع
                    </h3>
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      تعرف على مواقع الفروع ومواعيد العمل وخط السير عبر نظام الملاحة (GPS)
                    </p>
                  </div>

                  <ClinicLocationMap
                    clinic={clinic}
                    activeBranchName={selectedBranchForMap}
                    patientUpcomingAppt={upcomingAppointments[0]}
                  />
                </div>
              )}

            </div>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-12 pt-6 border-t border-sky-100 dark:border-slate-800/80 text-center text-xs text-slate-400 dark:text-slate-500 font-bold">
          <p>© 2026 Yalla Clinic — تشغيل وتطوير Yalla CodeX. جميع الحقوق محفوظة.</p>
        </footer>
      </main>

      {/* ============================================================ */}
      {/* MODALS */}
      {/* ============================================================ */}

      {/* 1. Patient Avatar Upload / Crop Modal */}
      <PatientAvatarModal
        isOpen={isAvatarModalOpen}
        onClose={() => setIsAvatarModalOpen(false)}
        currentAvatarUrl={avatarUrl}
        patientName={patientName}
        onSaveAvatar={handleSaveAvatar}
        onDeleteAvatar={handleDeleteAvatar}
      />

      {/* 2. Visit Details Modal (Diagnosis, Recommendations, Vitals, Linked Rx/Invoice - NO private notes!) */}
      {selectedVisitForDetails && (
        <VisitDetailsModal
          visit={selectedVisitForDetails}
          clinic={clinic}
          linkedPrescription={prescriptions.find(
            (rx) => rx.appointmentId === selectedVisitForDetails.id || rx.date === selectedVisitForDetails.date
          )}
          onClose={() => setSelectedVisitForDetails(null)}
          onOpenPrescription={(rx) => setSelectedRx(rx)}
          onOpenInvoice={(v) => handleOpenInvoiceModal(v)}
        />
      )}

      {/* 3. Booking Modal */}
      {bookingModalOpen && (
        <BookingModal
          clinic={clinic}
          services={clinic?.services || []}
          onClose={() => setBookingModalOpen(false)}
        />
      )}

      {/* 4. Live Queue Turn Modal */}
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

      {/* 5. Prescription View Modal (A4 Print / PDF) */}
      {selectedRx && (
        <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950/80 backdrop-blur-md flex items-center justify-center p-3 overflow-y-auto">
          <div className="w-full max-w-2xl bg-white dark:bg-[#081526] rounded-3xl p-5 shadow-2xl border border-sky-100 dark:border-slate-800 space-y-4 my-auto">
            <div className="flex items-center justify-between pb-2 border-b border-slate-100 dark:border-slate-800">
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                الروشتة الطبية الرسمية
              </h3>
              <button
                type="button"
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

      {/* 6. Invoice View Modal */}
      {selectedInvoice && (
        <InvoiceView
          invoice={selectedInvoice}
          isPatientView={true}
          slug={slug}
          onClose={() => setSelectedInvoice(null)}
        />
      )}
    </div>
  )
}
