'use client'

import { use, useEffect, useState, useMemo, useRef } from 'react'
import { watchPublicClinicProfile } from '@/lib/clinic-profile-client'
import {
  calculatePatientLivePosition,
  PatientQueueStatusResult,
  formatEstimatedTime
} from '@/lib/queueCalculations'
import { playNotificationSound } from '@/lib/notificationService'
import {
  mergeQueueWatermark,
  shouldAcceptQueueSnapshot,
  subscribeClinicQueueSignal,
  type QueueWatermark,
} from '@/lib/queueSync'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Activity, Clock, CheckCircle2, Zap, MapPin, Phone,
  Users, Calendar, Sparkles, Navigation, MessageCircle, AlertCircle, Receipt,
  UserCheck, ShieldCheck, FileText, Stethoscope
} from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'
import { formatCairo12Hour } from '@/lib/queue-calculator'
import { InvoiceView } from '@/components/clinic/InvoiceView'
import { NotificationCenter } from '@/components/clinic/NotificationCenter'
import { PatientPushNotificationManager } from '@/components/clinic/PatientPushNotificationManager'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { useLanguage } from '@/context/LanguageContext'
import { toast } from 'sonner'

export default function TrackPatientPage({ params }: { params: Promise<{ slug: string; appointmentId: string }> }) {
  const resolvedParams = use(params)
  const { slug, appointmentId } = resolvedParams
  const { dir, t, isRtl } = useLanguage()

  const [appointment, setAppointment] = useState<any>(null)
  const [serverQueueInfo, setServerQueueInfo] = useState<PatientQueueStatusResult | null>(null)
  const [loading, setLoading] = useState(true)
  const [clinic, setClinic] = useState<any>(null)
  const [branchData, setBranchData] = useState<any>(null)
  const [showInvoiceModal, setShowInvoiceModal] = useState(false)

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    let pendingRefresh = false
    let scheduledTimer: number | null = null
    let currentController: AbortController | null = null
    let trackWatermark: QueueWatermark | null = null
    let pollSeq = 0
    let lastAcceptedSeq = 0

    const clearScheduled = () => {
      if (scheduledTimer !== null) {
        window.clearTimeout(scheduledTimer)
        scheduledTimer = null
      }
    }

    const scheduleNext = () => {
      clearScheduled()
      if (cancelled) return
      const delayMs = document.visibilityState === 'visible' ? 1200 : 6000
      scheduledTimer = window.setTimeout(() => void refreshQueue(false), delayMs)
    }

    // Firestore rules intentionally deny public appointment reads. Rely on
    // the trusted, appointment-scoped queue response for consistent live state
    // with instant push / tab-signal wakeup and monotonic staleness checks.
    const refreshQueue = async (immediate = false) => {
      if (cancelled) return
      if (immediate) clearScheduled()
      if (inFlight) {
        pendingRefresh = true
        return
      }
      inFlight = true
      const reqSeq = ++pollSeq
      const controller = new AbortController()
      currentController = controller
      try {
        const response = await fetch(
          `/api/clinic/${encodeURIComponent(slug)}/queue?appointmentId=${encodeURIComponent(appointmentId)}`,
          { cache: 'no-store', credentials: 'same-origin', signal: controller.signal },
        )
        const data = await response.json().catch(() => ({}))
        if (cancelled) return
        if (!response.ok || !data.success) throw new Error('QUEUE_API_UNAVAILABLE')

        const incomingWatermark: QueueWatermark | null = data.queueWatermark || null
        if (
          !shouldAcceptQueueSnapshot(trackWatermark, incomingWatermark, {
            reqSeq,
            lastAcceptedSeq,
          })
        ) {
          return
        }
        lastAcceptedSeq = Math.max(lastAcceptedSeq, reqSeq)
        trackWatermark = mergeQueueWatermark(trackWatermark, incomingWatermark)

        if (data.clinic) setClinic((prev: any) => ({ ...prev, ...data.clinic }))
        const match = Array.isArray(data.matchingAppointments)
          ? data.matchingAppointments.find((a: any) => a.id === appointmentId)
          : null
        if (match) {
          setAppointment((prev: any) => ({ ...prev, ...match }))
          setServerQueueInfo(data.patientQueueInfo || null)
        } else {
          setAppointment(null)
          setServerQueueInfo(null)
        }
        setLoading(false)
      } catch (error) {
        // Keep last-known valid patient turn on intermittent network errors.
        if (!cancelled && !(error instanceof Error && error.name === 'AbortError')) {
          console.warn('[patient-track] Queue refresh failed:', error)
          setLoading(false)
        }
      } finally {
        if (currentController === controller) currentController = null
        inFlight = false
        if (pendingRefresh && !cancelled) {
          pendingRefresh = false
          void refreshQueue(true)
        } else {
          scheduleNext()
        }
      }
    }

    const onSignal = () => { void refreshQueue(true) }
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') void refreshQueue(true)
    }
    const unsubscribeSignal = subscribeClinicQueueSignal(slug, onSignal)
    window.addEventListener('focus', onSignal)
    document.addEventListener('visibilitychange', onVisibilityChange)

    void refreshQueue(true)
    const stopClinic = watchPublicClinicProfile(slug, data => setClinic(data))
    return () => {
      cancelled = true
      clearScheduled()
      currentController?.abort()
      unsubscribeSignal()
      window.removeEventListener('focus', onSignal)
      document.removeEventListener('visibilitychange', onVisibilityChange)
      stopClinic()
    }
  }, [slug, appointmentId])

  useEffect(() => {
    if (!appointment?.branch_id) return
    let cancelled = false
    const loadBranch = async () => {
      try {
        const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/branches`, {
          cache: 'no-store',
        })
        const data = await res.json().catch(() => ({}))
        if (cancelled || !res.ok || !Array.isArray(data.branches)) return
        const branch = data.branches.find((b: any) => b.id === appointment.branch_id)
        if (branch) setBranchData(branch)
      } catch (error) {
        if (!cancelled) console.warn('[patient-track] Branch lookup failed:', error)
      }
    }
    void loadBranch()
    return () => { cancelled = true }
  }, [slug, appointment?.branch_id])

  // Compute live queue position using unified clinical schedule & queue engine
  const liveQueue: PatientQueueStatusResult = useMemo(() => {
    if (serverQueueInfo) return serverQueueInfo
    return calculatePatientLivePosition({
      targetAppointmentId: appointmentId,
      targetAppointment: appointment,
      allTodayAppointments: [],
      clinic,
      branch: branchData,
      isRtl
    })
  }, [appointmentId, appointment, serverQueueInfo, clinic, branchData, isRtl])

  const previousExaminingRef = useRef<string | null>(null)
  const lastReadyAlertRef = useRef<string | null>(null)

  // Visual and audio alerts are derived from real queue transitions, not every
  // API refresh. Persistent notifications are reconciled by the authenticated
  // /api/notifications endpoint when the account owner is signed in.
  useEffect(() => {
    if (!appointment || !appointment.clinic_id) return
    const examiningNumber = liveQueue.currentPatientExamining?.queueNumber
    const examiningKey = examiningNumber == null ? null : String(examiningNumber)
    if (previousExaminingRef.current !== null && examiningKey !== null &&
        previousExaminingRef.current !== examiningKey &&
        appointment.status === 'waiting') {
      playNotificationSound('chime')
      toast.info(isRtl
        ? `🔔 دخل الآن المريض رقم #${examiningKey} لغرفة الكشف. متبقي أمامك ${liveQueue.aheadCount} مرضى.`
        : `🔔 Patient #${examiningKey} entered the examination room. ${liveQueue.aheadCount} ahead.`)
    }
    previousExaminingRef.current = examiningKey

    const ready = liveQueue.isCurrentTurn ||
      appointment.status === 'in_progress' || appointment.status === 'examining'
    const readyKey = `${appointmentId}:${appointment.calledAt || appointment.startedAt || 'ready'}`
    if (ready && lastReadyAlertRef.current !== readyKey) {
      lastReadyAlertRef.current = readyKey
      playNotificationSound('turn_ready')
      toast.success(isRtl ? 'حان دورك الآن! تفضل بالدخول إلى غرفة الكشف.' : 'It is your turn. Please enter the examination room.')
    }
  }, [appointmentId, appointment?.status, appointment?.calledAt,
      appointment?.startedAt, liveQueue.aheadCount, liveQueue.isCurrentTurn,
      liveQueue.currentPatientExamining?.queueNumber, isRtl])

  if (loading) {
    return <ClinicLoading fullScreen size="lg" label={t('syncing_queue', 'جاري مزامنة الدور المباشر...')} />
  }

  if (!appointment) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4 text-foreground" dir={dir}>
        <div className="yalla-card p-8 text-center max-w-sm w-full space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <h2 className="text-lg font-bold text-foreground">{t('booking_not_found', 'لم يتم العثور على تذكرة الحجز')}</h2>
          <div className="pt-2">
            <a href={`/clinic/${slug}`} className="block w-full">
              <Button variant="outline" className="w-full text-xs font-bold rounded-xl border-border">
                {t('back_to_clinic', 'العودة لرئيسية العيادة')}
              </Button>
            </a>
          </div>
        </div>
      </div>
    )
  }

  const nowCairo = new Date()
  const todayCairoStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowCairo)
  const apptDateStr = appointment.date || todayCairoStr
  const isFuture = apptDateStr > todayCairoStr
  const isPast = apptDateStr < todayCairoStr

  const isCompleted = liveQueue.status === 'completed' || appointment.status === 'completed'
  const isExaminingNow =
    !isFuture && !isPast && !isCompleted &&
    (appointment.status === 'in_progress' ||
      (liveQueue.currentPatientExamining?.queueNumber &&
        Number(liveQueue.currentPatientExamining.queueNumber) === Number(appointment.queue_number)))
  const isCurrentTurn = !isFuture && !isPast && !isExaminingNow && !isCompleted && liveQueue.isCurrentTurn
  const isNextInLine = !isFuture && !isPast && !isExaminingNow && !isCompleted && liveQueue.isNextInLine
  const isSkippedOrNoShow = liveQueue.status === 'skipped' || liveQueue.status === 'no_show'
  const isCancelled = liveQueue.status === 'cancelled'

  const avgVisitMins = liveQueue.averageVisitMins || branchData?.slotDuration || branchData?.averageVisitTime || Number(clinic?.averageVisitTime) || 15
  const estimatedDurationText = liveQueue.formattedWaitTime
  const expectedClockTime = liveQueue.estimatedEntranceTime12H

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4 font-sans text-foreground transition-colors" dir={dir}>
      
      {/* Top Floating Controls */}
      <div className="w-full max-w-md flex justify-end gap-2 mb-3">
        <LanguageToggle />
        <ThemeToggle />
      </div>

      {/* Container Card */}
      <div className="w-full max-w-md bg-card border border-border shadow-2xl rounded-3xl p-6 sm:p-8 space-y-6 text-card-foreground">
        
        {/* Brand Top Header */}
        <div className="relative text-center space-y-2 border-b border-border pb-5">
          {appointment.phone && (
            <div className={`absolute ${isRtl ? 'left-0' : 'right-0'} top-0`}>
              <NotificationCenter
                recipientTarget={appointment.phone}
                clinicId={appointment.clinic_id}
                slug={slug}
                appointmentId={appointmentId}
                patientAheadCount={liveQueue.aheadCount}
                patientTurnReady={liveQueue.isCurrentTurn || appointment.status === 'in_progress' || appointment.status === 'examining'}
                patientStatus={appointment.status}
                recipientLabel={appointment.patientName}
                recipientType="patient"
              />
            </div>
          )}
          <ClinicLogo size="md" variant="auto" />
          <div className="pt-2">
            <h1 className="text-lg font-black text-foreground">
              {clinic?.clinicName || t('clinic', 'العيادة')}
            </h1>
            <p className="text-xs text-muted-foreground">
              {t('welcome', 'مرحباً')} {appointment.patientName} • {t('live_queue_screen', 'شاشة متابعة الدور المباشرة')}
            </p>
            {appointment.branchName && (
              <span className="inline-block mt-1 text-[11px] font-bold text-primary bg-primary/10 px-2.5 py-0.5 rounded-full border border-primary/20">
                {t('branch', 'فرع')} {appointment.branchName}
              </span>
            )}
          </div>
        </div>

        {/* Real Web Push Notification Activation */}
        <PatientPushNotificationManager
          clinicId={appointment.clinic_id}
          clinicSlug={slug}
          appointmentId={appointmentId}
          patientPhone={appointment.phone}
        />

        {/* Live Status Content Rendering */}
        {isCompleted ? (
          <div className="p-6 rounded-3xl bg-emerald-500/10 border-2 border-emerald-500/30 text-center space-y-3">
            <CheckCircle2 className="w-16 h-16 text-emerald-600 dark:text-emerald-400 mx-auto" />
            <h3 className="text-2xl font-black text-emerald-700 dark:text-emerald-400">{t('exam_completed_success', 'تم الكشف الطبي بنجاح!')}</h3>
            <p className="text-xs text-muted-foreground font-medium">
              {t('wishing_good_health', 'نتمنى لك دوام الصحة والعافية ونتشرف دائماً بخدمتك.')}
            </p>
            <div className="pt-1">
              <span className="px-3.5 py-1.5 rounded-full bg-emerald-600 text-white text-xs font-black font-mono">
                تذكرة رقم #{appointment.queue_number}
              </span>
            </div>
          </div>
        ) : isFuture ? (
          <div className="p-6 rounded-3xl bg-blue-500/10 border-2 border-blue-500/30 text-center space-y-4">
            <Calendar className="w-14 h-14 text-blue-600 dark:text-blue-400 mx-auto" />
            <div className="space-y-1">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {isRtl ? 'حجز مستقبلي مؤكد' : 'Upcoming Confirmed Booking'}
              </span>
              <h3 className="text-xl font-black text-foreground">
                {appointment.date}
              </h3>
              <p className="text-xs text-muted-foreground font-medium">
                {appointment.branchName || 'الفرع الرئيسي'} • {appointment.serviceName || 'كشف'}
              </p>
            </div>

            {/* Static Ticket Number */}
            <div className="p-4 rounded-2xl bg-card border border-border shadow-xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground block">
                {t('ticket_number', 'رقم تذكرة الحجز')}
              </span>
              <div className="text-4xl font-black text-primary font-mono">
                #{appointment.queue_number}
              </div>
            </div>

            {/* Schedule-anchored estimate */}
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[11px] text-muted-foreground block font-bold">
                  {t('effective_position', 'ترتيب الدخول لذلك اليوم')}
                </span>
                <span className="text-base font-black text-foreground font-mono">
                  #{liveQueue.effectivePosition}
                </span>
              </div>
              <div className="p-3 rounded-xl bg-card border border-border">
                <span className="text-[11px] text-muted-foreground block font-bold">
                  {t('patients_ahead_count', 'المرضى أمامك')}
                </span>
                <span className="text-base font-black text-primary font-mono">
                  {liveQueue.aheadCount}
                </span>
              </div>
            </div>

            <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 space-y-1 text-center">
              <span className="text-[11px] text-muted-foreground font-bold block">
                {t('expected_clock_time', 'الساعة المتوقعة للدخول (تقديري):')}
              </span>
              <span className="text-lg font-black text-primary font-mono block">
                {liveQueue.estimatedEntranceTime12H}
              </span>
              <span className="text-[11px] text-muted-foreground block">
                {liveQueue.formattedWaitTime}
              </span>
            </div>

            <p className="text-[11px] text-muted-foreground leading-relaxed">
              {isRtl
                ? 'حجزك مسجل ومعتمد بالعيادة. يبدأ استقبال المرضى وفق جدول عمل العيادة في تاريخ الموعد.'
                : 'Your appointment is confirmed. Reception starts according to clinic schedule on the appointment date.'}
            </p>
          </div>
        ) : isPast ? (
          <div className="p-6 rounded-3xl bg-muted/40 border border-border text-center space-y-3">
            <Clock className="w-12 h-12 text-muted-foreground mx-auto" />
            <h3 className="text-lg font-black text-foreground">
              {isRtl ? `حجز سابق منتهي (${appointment.date})` : `Past Appointment (${appointment.date})`}
            </h3>
            <p className="text-xs text-muted-foreground">
              {isRtl ? 'هذا الحجز مسجل بتاريخ سابق في العيادة.' : 'This appointment was scheduled for a past date.'}
            </p>
          </div>
        ) : isExaminingNow ? (
          <div className="p-6 rounded-3xl bg-sky-500/15 border-2 border-sky-500 text-center space-y-3 animate-pulse shadow-xl shadow-sky-500/20">
            <div className="w-16 h-16 rounded-full bg-sky-600 text-white flex items-center justify-center mx-auto shadow-lg">
              <Stethoscope className="w-8 h-8 animate-bounce" />
            </div>
            <h3 className="text-2xl font-black text-sky-600 dark:text-sky-400">جاري الكشف الطبي الآن...</h3>
            <p className="text-xs text-foreground font-bold">
              أنت الآن داخل غرفة الكشف الطبي لمقابلة الطبيب. نتمنى لك الشفاء العاجل.
            </p>
            <div className="pt-2">
              <span className="px-4 py-1.5 rounded-full bg-sky-600/20 text-sky-700 dark:text-sky-300 text-xs font-black font-mono">
                تذكرة رقم #{appointment.queue_number} • مع الطبيب حالياً
              </span>
            </div>
          </div>
        ) : isCancelled ? (
          <div className="p-6 rounded-3xl bg-rose-500/10 border border-rose-500/20 text-center space-y-2">
            <AlertCircle className="w-12 h-12 text-rose-600 dark:text-rose-400 mx-auto" />
            <h3 className="text-lg font-black text-rose-700 dark:text-rose-400">{t('booking_cancelled', 'تم إلغاء هذا الحجز')}</h3>
            <p className="text-xs text-muted-foreground">{t('booking_cancelled_desc', 'يرجى التواصل مع العيادة إذا كنت بحاجة لإعادة الحجز.')}</p>
          </div>
        ) : isSkippedOrNoShow ? (
          <div className="p-6 rounded-3xl bg-amber-500/10 border border-amber-500/20 text-center space-y-2">
            <Clock className="w-12 h-12 text-amber-600 dark:text-amber-400 mx-auto" />
            <h3 className="text-lg font-black text-amber-700 dark:text-amber-400">{t('turn_skipped', 'تم تخطي الموعد')}</h3>
            <p className="text-xs text-muted-foreground font-medium">
              {t('skipped_desc', 'نظراً لعدم الحضور عند استدعاء الدور، يرجى مراجعة موظف الاستقبال لإعادة ترتيب دخولك.')}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* If it's your turn right now, show high-visibility calling banner at top */}
            {isCurrentTurn && (
              <div className="p-5 rounded-3xl bg-primary/10 border-2 border-primary text-center space-y-2 animate-pulse shadow-lg shadow-primary/20">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary text-white text-xs font-black">
                  <span>🔔</span>
                  <span>{t('your_turn_now', 'دورك الآن!')}</span>
                </div>
                <h3 className="text-lg font-black text-primary">
                  {t('proceed_to_room', 'يرجى التوجه إلى غرفة الكشف مباشرة لمقابلة الطبيب')}
                </h3>
              </div>
            )}

            {/* Big Queue Ticket Card */}
            <div className="bg-secondary/40 border border-border rounded-3xl p-6 text-center space-y-2">
              <span className="text-xs font-bold text-muted-foreground">{t('ticket_number', 'رقم تذكرة الحجز')}</span>
              <div className="text-6xl font-black text-primary tracking-tight font-mono">
                #{appointment.queue_number}
              </div>
              
              <div className="pt-1 flex flex-wrap items-center justify-center gap-2">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-bold border border-primary/20">
                  {t('effective_position', 'ترتيب الدخول الفعلي:')} #{liveQueue.effectivePosition}
                </span>

                {isNextInLine && (
                  <span className="px-3 py-1 rounded-full bg-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-black animate-bounce border border-amber-500/30">
                    ⚡ {t('you_are_next', 'أنت المريض التالي للدخول')}
                  </span>
                )}
              </div>
            </div>

            {/* In-Progress Doctor Indicator */}
            {liveQueue.currentPatientExamining ? (
              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2 text-primary font-bold">
                  <Activity className="w-4 h-4 text-primary animate-pulse" />
                  <span>{t('doctor_with_patient', 'الطبيب مع مريض رقم:')}</span>
                </div>
                <Badge className="bg-primary text-white font-mono font-bold text-xs px-2.5 py-1">
                  #{liveQueue.currentPatientExamining.queueNumber}
                </Badge>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border flex items-center justify-between text-xs text-muted-foreground">
                <div className="flex items-center gap-2 font-bold">
                  <Activity className="w-4 h-4 text-muted-foreground" />
                  <span>{t('doctor_status', 'المريض الحالي بغرفة الكشف:')}</span>
                </div>
                <span className="font-bold text-foreground bg-card px-2.5 py-1 rounded-lg border border-border text-[11px]">
                  {t('waiting_first_patient', 'في انتظار استدعاء الحالة')}
                </span>
              </div>
            )}

            {/* Queue Intelligence Card: Ahead Count, Average Consultation Time & Estimated Entry Time */}
            <div className="p-5 rounded-3xl bg-secondary/30 border border-border shadow-xs space-y-4">
              
              {/* Row 1: How many patients ahead */}
              <div className="flex items-center justify-between pb-3 border-b border-border">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <span className="text-xs font-bold text-foreground block">{t('patients_ahead_count', 'فاضل كام مريض قدامك')}</span>
                    <span className="text-[11px] text-muted-foreground">{t('in_current_queue', 'في قائمة الانتظار الحالية')}</span>
                  </div>
                </div>
                <div className={isRtl ? 'text-left' : 'text-right'}>
                  <span className="text-3xl font-black text-primary font-mono">
                    {liveQueue.aheadCount}
                  </span>
                  <span className={`text-xs font-bold text-muted-foreground ${isRtl ? 'mr-1.5' : 'ml-1.5'}`}>
                    {isRtl
                      ? (liveQueue.aheadCount === 1 ? 'مريض فقط' : liveQueue.aheadCount === 2 ? 'مريضان' : 'مرضى')
                      : (liveQueue.aheadCount === 1 ? 'patient' : 'patients')}
                  </span>
                </div>
              </div>

              {/* Row 2: Average Consultation Time */}
              <div className="flex items-center justify-between pb-3 border-b border-border text-xs">
                <div className="flex items-center gap-2 text-foreground font-bold">
                  <Activity className="w-4 h-4 text-primary" />
                  <span>{t('avg_exam_time', 'متوسط وقت الكشف:')}</span>
                </div>
                <span className="font-bold text-foreground bg-card px-2.5 py-1 rounded-lg border border-border shadow-xs font-mono">
                  {avgVisitMins} {t('minutes_per_exam', 'دقيقة / كشف')}
                </span>
              </div>

              {/* Row 3: Estimated Entry Time & Duration (Ahead Count * Average Time) */}
              <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/20 space-y-1.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-foreground">
                    <Clock className="w-4 h-4 text-primary animate-pulse" />
                    <span>{t('estimated_entry_time', 'الوقت المتوقع لدخولك:')}</span>
                  </div>
                  <span className="text-base font-black text-primary font-mono">
                    {estimatedDurationText}
                  </span>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground pt-1">
                  <span className="font-medium">{t('expected_clock_time', 'الساعة المتوقعة للدخول:')}</span>
                  <span className="font-black font-mono bg-card text-foreground px-2 py-0.5 rounded-md border border-border">
                    {expectedClockTime} {t('approx', 'تقريباً')}
                  </span>
                </div>

                <div className="text-[10.5px] text-muted-foreground pt-1.5 border-t border-border text-center font-mono">
                  ({t('schedule_anchored_label', 'تقدير دقيق محسوب وفق جدول مواعيد العيادة والأدوار السابقة')})
                </div>

                {!liveQueue.isEstimateConfirmed && (
                  <div className="text-[11px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 p-2 rounded-xl text-center">
                    ⚠️ {t('estimate_unconfirmed', 'موعد غير مؤكد — العيادة متوقفة مؤقتاً أو جلسة الكشف لم تبدأ بعد')}
                  </div>
                )}
              </div>

            </div>

            {/* 5-Turns or less prominent alert banner */}
            {liveQueue.aheadCount <= 5 && liveQueue.aheadCount > 0 && (
              <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs font-bold flex items-center gap-3 shadow-xs animate-in fade-in">
                <Clock className="w-5 h-5 text-amber-600 dark:text-amber-400 shrink-0 animate-pulse" />
                <div className={`space-y-0.5 ${isRtl ? 'text-right' : 'text-left'}`}>
                  <span className="block font-black text-sm">
                    {t('turn_approaching_alert', 'تنبيه: اقترب موعد دخولك للكشف')} ({t('remaining', 'متبقي')} {liveQueue.aheadCount} {liveQueue.aheadCount === 1 ? t('turn_single', 'دور فقط') : t('turns_plural', 'أدوار')})
                  </span>
                  <span className="text-[11px] font-medium block opacity-90">
                    {t('please_wait_in_hall', 'يرجى التواجد الآن في قاعة انتظار العيادة والاستعداد للدخول مباشرة.')}
                  </span>
                </div>
              </div>
            )}

            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 text-primary text-xs font-semibold flex items-center gap-2">
              <Clock className="w-4 h-4 text-primary shrink-0" />
              <span>{t('live_update_notice', 'يتم تحديث هذه الشاشة وإرسال إشعار فوري مع كل دخول مريض لغرفة الكشف.')}</span>
            </div>
          </div>
        )}

        {/* Modal for Electronic PDF Invoice */}
        {showInvoiceModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-card text-card-foreground rounded-3xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-border">
              <InvoiceView
                slug={slug}
                invoice={{
                  invoiceNumber: appointment.invoiceNumber || `INV-${appointmentId.slice(0, 8)}`,
                  queueNumber: appointment.queue_number,
                  clinicName: clinic?.clinicName || (isRtl ? 'العيادة' : 'Clinic'),
                  doctorName: clinic?.doctorName,
                  branchName: appointment.branchName,
                  clinicAddress: clinic?.clinicAddress,
                  clinicPhone: clinic?.clinicPhone,
                  patientName: appointment.patientName,
                  patientPhone: appointment.phone,
                  date: appointment.date,
                  cairoTime: formatCairo12Hour(new Date(appointment.createdAt || Date.now())),
                  serviceName: appointment.serviceName || t('consultation_type_exam', 'كشف'),
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
        <div className="space-y-2.5 pt-2 border-t border-border">
          {(isCompleted || (appointment.drugs && appointment.drugs.length > 0)) && (
            <a href={`/clinic/${slug}/prescription/${appointmentId}`} className="block w-full">
              <Button
                className="w-full h-11 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-xs flex items-center justify-center gap-2"
              >
                <FileText className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                {t('view_rx_pdf', 'عرض وتحميل الروشتة الطبية الرسمية PDF')}
              </Button>
            </a>
          )}

          <Button
            variant="outline"
            onClick={() => setShowInvoiceModal(true)}
            className="w-full h-11 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl flex items-center justify-center gap-2"
          >
            <Receipt className="w-4 h-4 text-primary" />
            {t('view_invoice_pdf', 'عرض وتحميل الفاتورة الإلكترونية PDF')}
          </Button>

          {clinic?.mapsLink && (
            <a href={clinic.mapsLink} target="_blank" rel="noreferrer" className="block w-full">
              <Button className="w-full h-12 text-xs font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md">
                <Navigation className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                {t('open_clinic_maps', 'فتح موقع العيادة عبر خرائط جوجل')}
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
              <Button variant="outline" className="w-full h-11 text-xs font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl">
                <MessageCircle className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-emerald-500`} />
                {t('contact_clinic_whatsapp', 'التواصل مع العيادة عبر واتساب')}
              </Button>
            </a>
          )}
          
          <a href={`/clinic/${slug}/patient`} className="block w-full">
            <Button variant="outline" className="w-full h-11 text-xs font-bold border-sky-400/40 text-sky-600 dark:text-sky-400 hover:bg-sky-50 dark:hover:bg-sky-950/40 rounded-xl flex items-center justify-center gap-1.5">
              <UserCheck className="w-4 h-4" />
              <span>{t('patient_portal_my_records', 'بوابة المريض (مواعيدي وروشتاتي)')}</span>
            </Button>
          </a>

          <a href={`/clinic/${slug}`} className="block w-full">
            <Button variant="ghost" className="w-full h-11 text-xs font-bold text-muted-foreground hover:text-foreground hover:bg-secondary rounded-xl">
              {t('exit_back_to_home', 'خروج والعودة للرئيسية')}
            </Button>
          </a>
        </div>

        {/* Standardized Copyright Footer */}
        <div className="text-center text-[11px] text-muted-foreground border-t border-border pt-4">
          {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}
        </div>

      </div>
    </div>
  )
}
