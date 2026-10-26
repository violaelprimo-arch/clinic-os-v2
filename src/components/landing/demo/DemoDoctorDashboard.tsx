'use client'

import React, { useState, useEffect } from 'react'
import {
  Users,
  Calendar,
  Clock,
  CheckCircle2,
  DollarSign,
  Play,
  SkipForward,
  RotateCcw,
  Printer,
  CreditCard,
  FileSignature,
  Search,
  AlertCircle,
  Eye,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Ticket,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { toast } from 'sonner'
import { DemoAppointment, DemoPaymentMethod } from './types'
import { DemoClinicHookReturn } from './useDemoClinic'
import { useLanguage } from '@/context/LanguageContext'

interface DemoDoctorDashboardProps {
  demo: DemoClinicHookReturn
  onOpenPrescription: (patientName: string) => void
}

export function DemoDoctorDashboard({
  demo,
  onOpenPrescription,
}: DemoDoctorDashboardProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  const [filter, setFilter] = useState<'all' | 'waiting' | 'completed' | 'skipped'>('all')
  const [search, setSearch] = useState('')
  const [ticketModalAppt, setTicketModalAppt] = useState<DemoAppointment | null>(null)
  const [paymentModalAppt, setPaymentModalAppt] = useState<DemoAppointment | null>(null)
  const [selectedMethod, setSelectedMethod] = useState<DemoPaymentMethod>('cash')

  // Live examination elapsed timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0)

  useEffect(() => {
    if (!demo.currentInExam) {
      setElapsedSeconds(0)
      return
    }

    const start = demo.currentInExam.examinationStartedAt || Date.now()
    const updateElapsed = () => {
      const now = Date.now()
      setElapsedSeconds(Math.max(0, Math.floor((now - start) / 1000)))
    }

    updateElapsed()
    const interval = setInterval(updateElapsed, 1000)
    return () => clearInterval(interval)
  }, [demo.currentInExam])

  const formatTimer = (totalSecs: number) => {
    const mins = Math.floor(totalSecs / 60)
    const secs = totalSecs % 60
    return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`
  }

  // Filtered appointments
  const filteredAppointments = demo.appointments.filter((a) => {
    if (filter === 'waiting' && a.status !== 'waiting') return false
    if (filter === 'completed' && a.status !== 'completed') return false
    if (filter === 'skipped' && a.status !== 'skipped') return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const matchName = a.patientName.toLowerCase().includes(q)
      const matchPhone = a.phone.includes(q)
      const matchQueue = String(a.queue_number).includes(q)
      if (!matchName && !matchPhone && !matchQueue) return false
    }
    return true
  })

  // Handlers
  const handleStartExam = (appt: DemoAppointment) => {
    demo.startExamination(appt.id)
    toast.success(
      copy(
        `تم استدعاء المريض رقم #${appt.queue_number} (${appt.patientName}) لغرفة الكشف 🩺`,
        `Patient #${appt.queue_number} (${appt.patientName}) called into examination room 🩺`,
      ),
    )
  }

  const handleCompleteExam = (appt: DemoAppointment) => {
    if (appt.paymentStatus === 'pending') {
      setPaymentModalAppt(appt)
    } else {
      demo.completeExamination(appt.id, appt.paymentMethod || 'cash')
      toast.success(
        copy(
          `تم إنهاء كشف المريض #${appt.queue_number} (${appt.patientName}) بنجاح ✅`,
          `Examination completed for patient #${appt.queue_number} (${appt.patientName}) ✅`,
        ),
      )
    }
  }

  const handleConfirmPaymentAndComplete = () => {
    if (!paymentModalAppt) return
    demo.completeExamination(paymentModalAppt.id, selectedMethod)
    toast.success(
      copy(
        `تم إنهاء الزيارة وسداد ${paymentModalAppt.servicePrice} ج.م بنجاح! 💵`,
        `Visit completed and ${paymentModalAppt.servicePrice} EGP collected successfully! 💵`,
      ),
    )
    setPaymentModalAppt(null)
  }

  const handleSkip = (appt: DemoAppointment) => {
    demo.skipAppointment(appt.id)
    toast.info(
      copy(
        `تم تخطي دور المريض #${appt.queue_number} مع الاحتفاظ برقمه في القائمة ⏭️`,
        `Patient #${appt.queue_number} skipped, position held in list ⏭️`,
      ),
    )
  }

  const handleReinstate = (appt: DemoAppointment) => {
    demo.reinstateAppointment(appt.id)
    toast.success(
      copy(
        `تم إعادة المريض #${appt.queue_number} إلى قائمة الانتظار الحالية 🔄`,
        `Patient #${appt.queue_number} returned to waiting queue 🔄`,
      ),
    )
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* 1. Daily KPI Stats Banner */}
      <div id="tour-kpi-stats" className="grid grid-cols-2 gap-3 sm:grid-cols-5">
        <div className="rounded-2xl border border-border/80 bg-background/60 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">{copy('حجوزات اليوم', "Today's Bookings")}</span>
            <Calendar className="size-4 text-primary" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-foreground">
            {demo.appointments.length}
          </strong>
          <span className="text-[10px] text-muted-foreground">
            {copy('إجمالي المسجلين', 'All registered')}
          </span>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-amber-600 dark:text-amber-400">
            <span className="text-xs font-bold">{copy('في الانتظار', 'In Waiting')}</span>
            <Clock className="size-4" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-amber-600 dark:text-amber-400">
            {demo.waitingList.length}
          </strong>
          <span className="text-[10px] text-muted-foreground">
            {copy('بانتظار دورهم', 'Awaiting their turn')}
          </span>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-emerald-600 dark:text-emerald-400">
            <span className="text-xs font-bold">{copy('داخل الكشف', 'In Exam')}</span>
            <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {demo.currentInExam ? 1 : 0}
          </strong>
          <span className="text-[10px] text-muted-foreground">
            {demo.currentInExam
              ? copy('الغرفة مشغولة حالياً', 'Room currently active')
              : copy('الغرفة شاغرة', 'Room available')}
          </span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-background/60 p-3.5 shadow-sm">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-bold">{copy('تم الكشف', 'Completed')}</span>
            <CheckCircle2 className="size-4 text-emerald-500" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-foreground">
            {demo.completedList.length}
          </strong>
          <span className="text-[10px] text-muted-foreground">
            {copy('زيارات منتهية', 'Completed visits')}
          </span>
        </div>

        <div className="col-span-2 rounded-2xl border border-primary/20 bg-primary/5 p-3.5 shadow-sm sm:col-span-1">
          <div className="flex items-center justify-between text-primary">
            <span className="text-xs font-bold">{copy('التحصيل اليومي', 'Collected Today')}</span>
            <DollarSign className="size-4" />
          </div>
          <strong className="mt-2 block text-2xl font-black text-primary">
            {demo.totalRevenue}{' '}
            <span className="text-xs font-normal text-muted-foreground">ج.م</span>
          </strong>
          <span className="text-[10px] text-muted-foreground">
            {demo.pendingRevenue > 0
              ? copy(`معلّق: ${demo.pendingRevenue} ج.م`, `Pending: ${demo.pendingRevenue} EGP`)
              : copy('تم تحصيل الكل', 'All settled')}
          </span>
        </div>
      </div>

      {/* 2. Active In-Exam Room & Next Patient Split Cards */}
      <div id="tour-active-exam" className="grid gap-4 lg:grid-cols-2">
        {/* Active Patient in Exam Room */}
        <div className="relative overflow-hidden rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-background p-5 shadow-lg">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Users className="size-4" />
              </span>
              <div>
                <h4 className="text-sm font-black text-foreground">
                  {copy('المريض في غرفة الكشف الآن', 'Patient In Examination Room')}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {demo.currentInExam
                    ? copy('جاري الفحص السريري المباشر', 'Clinical exam in progress')
                    : copy('لا يوجد مريض داخل غرفة الكشف', 'No patient currently inside')}
                </p>
              </div>
            </div>

            {demo.currentInExam && (
              <div className="flex items-center gap-1.5 rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 font-mono text-xs font-bold text-emerald-700 dark:text-emerald-300">
                <Clock className="size-3.5 animate-spin" />
                <span>{formatTimer(elapsedSeconds)}</span>
              </div>
            )}
          </div>

          {demo.currentInExam ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-emerald-600 px-2 py-0.5 font-mono text-xs font-black text-white">
                      #{demo.currentInExam.queue_number}
                    </span>
                    <strong className="text-base font-black">
                      {demo.currentInExam.patientName}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      ({demo.currentInExam.age} {copy('سنة', 'yrs')})
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {demo.currentInExam.serviceName} • {demo.currentInExam.servicePrice} ج.م
                  </p>
                </div>

                <Badge
                  variant="outline"
                  className={
                    demo.currentInExam.paymentStatus === 'paid'
                      ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-600'
                      : 'border-amber-500/40 bg-amber-500/10 text-amber-600'
                  }
                >
                  {demo.currentInExam.paymentStatus === 'paid'
                    ? copy('تم السداد', 'Paid')
                    : copy('السداد معلّق', 'Payment Pending')}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleCompleteExam(demo.currentInExam!)}
                  className="gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
                >
                  <CheckCircle2 className="size-4" />
                  {copy('إنهاء الكشف وسداد الرسوم', 'Complete & Settle')}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onOpenPrescription(demo.currentInExam!.patientName)}
                  className="gap-2 rounded-xl border-primary/30 bg-primary/5 font-bold text-primary hover:bg-primary/10"
                >
                  <FileSignature className="size-4" />
                  {copy('إعداد روشتة لهذا المريض', 'Write Prescription')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {copy(
                  'غرفة الكشف جاهزة، استدعِ المريض التالي لبدء الفحص',
                  'Examination room ready, call next patient to start',
                )}
              </p>
              {demo.nextWaiting && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleStartExam(demo.nextWaiting!)}
                  className="mt-3 gap-2 rounded-xl bg-primary font-bold text-white shadow-md shadow-primary/20"
                >
                  <Play className="size-3.5" />
                  {copy(
                    `بدء كشف #${demo.nextWaiting.queue_number} (${demo.nextWaiting.patientName})`,
                    `Start #${demo.nextWaiting.queue_number} (${demo.nextWaiting.patientName})`,
                  )}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* Next Patient Card */}
        <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-card p-5 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b border-border/60 pb-3">
            <div className="flex items-center gap-2">
              <span className="grid size-8 place-items-center rounded-xl bg-primary/10 text-primary">
                <Clock className="size-4" />
              </span>
              <div>
                <h4 className="text-sm font-black text-foreground">
                  {copy('المريض التالي في الدور', 'Next Patient in Queue')}
                </h4>
                <p className="text-[11px] text-muted-foreground">
                  {copy('الترتيب التلقائي حسب وصول الحجز', 'Automatic queue sequence')}
                </p>
              </div>
            </div>

            {demo.nextWaiting && (
              <span className="rounded-lg bg-primary/10 px-2 py-0.5 text-xs font-bold text-primary">
                {copy('الدور التالي', 'Next Turn')}
              </span>
            )}
          </div>

          {demo.nextWaiting ? (
            <div className="mt-4 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-lg bg-primary px-2 py-0.5 font-mono text-xs font-black text-primary-foreground">
                      #{demo.nextWaiting.queue_number}
                    </span>
                    <strong className="text-base font-black">
                      {demo.nextWaiting.patientName}
                    </strong>
                    <span className="text-xs text-muted-foreground">
                      ({demo.nextWaiting.age} {copy('سنة', 'yrs')})
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {demo.nextWaiting.serviceName} • {demo.nextWaiting.servicePrice} ج.م
                  </p>
                </div>

                <Badge variant="outline" className="border-border">
                  {copy('في الانتظار', 'Waiting')}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-2">
                <Button
                  type="button"
                  size="sm"
                  onClick={() => handleStartExam(demo.nextWaiting!)}
                  className="gap-2 rounded-xl bg-primary font-bold text-white shadow-md shadow-primary/20"
                >
                  <Play className="size-4" />
                  {copy('بدء الكشف الآن', 'Start Exam Now')}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleSkip(demo.nextWaiting!)}
                  className="gap-1.5 rounded-xl border-border text-muted-foreground hover:text-foreground"
                >
                  <SkipForward className="size-3.5" />
                  {copy('تخطي الدور', 'Skip')}
                </Button>

                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={() => setTicketModalAppt(demo.nextWaiting)}
                  className="gap-1.5 rounded-xl text-muted-foreground hover:text-foreground"
                  title={copy('عرض تيكت الدور الحراري', 'View thermal ticket')}
                >
                  <Ticket className="size-3.5 text-primary" />
                  {copy('التيكت', 'Ticket')}
                </Button>
              </div>
            </div>
          ) : (
            <div className="mt-6 flex flex-col items-center justify-center py-6 text-center">
              <p className="text-sm text-muted-foreground">
                {copy(
                  'لا توجد مرضى في قائمة الانتظار حالياً.',
                  'No patients currently waiting in queue.',
                )}
              </p>
              <p className="mt-1 text-xs text-primary font-medium">
                {copy(
                  '💡 جرّب الانتقال إلى «بوابة المريض» بالأعلى وحجز موعد تجريبي ليظهر هنا فوراً!',
                  '💡 Try switching to "Patient Portal" above and create a booking to see it here live!',
                )}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 3. Live Queue Table & Filter Controls */}
      <div className="rounded-3xl border border-border/80 bg-card p-4 sm:p-6 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h3 className="text-base font-black text-foreground">
              {copy('سجل الدور وقائمة الحجوزات', 'Live Queue & Appointments')}
            </h3>
            <p className="text-xs text-muted-foreground">
              {copy(
                'تحديث فوري لترتيب الأدوار وحالات السداد والكشف',
                'Real-time queue tracking, visit progress and payment states',
              )}
            </p>
          </div>

          {/* Filters & Search */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[160px] flex-1 sm:w-56">
              <Search className="absolute start-3 top-2.5 size-3.5 text-muted-foreground" />
              <Input
                type="text"
                placeholder={copy('بحث بالاسم أو الرقم...', 'Search by name or ticket...')}
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="h-8 rounded-xl ps-9 text-xs"
              />
            </div>

            <div className="inline-flex rounded-xl border border-border bg-muted/40 p-0.5 text-xs">
              <button
                type="button"
                onClick={() => setFilter('all')}
                className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                  filter === 'all'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {copy('الكل', 'All')} ({demo.appointments.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('waiting')}
                className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                  filter === 'waiting'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {copy('في الانتظار', 'Waiting')} ({demo.waitingList.length})
              </button>
              <button
                type="button"
                onClick={() => setFilter('completed')}
                className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                  filter === 'completed'
                    ? 'bg-background text-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {copy('مكتمل', 'Done')} ({demo.completedList.length})
              </button>
              {demo.skippedList.length > 0 && (
                <button
                  type="button"
                  onClick={() => setFilter('skipped')}
                  className={`rounded-lg px-2.5 py-1 font-bold transition-all ${
                    filter === 'skipped'
                      ? 'bg-background text-foreground shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {copy('المتخطي', 'Skipped')} ({demo.skippedList.length})
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Appointments List */}
        <div className="mt-4 divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/60">
          {filteredAppointments.length === 0 ? (
            <div className="py-10 text-center text-xs text-muted-foreground">
              {copy('لا توجد حجوزات مطابقة للفلتر المختار', 'No bookings matching the filter')}
            </div>
          ) : (
            filteredAppointments.map((appt) => {
              const isExamining = appt.status === 'in_progress'
              const isWaiting = appt.status === 'waiting'
              const isDone = appt.status === 'completed'
              const isSkipped = appt.status === 'skipped'

              return (
                <div
                  key={appt.id}
                  className={`flex flex-col gap-3 p-3.5 transition-colors sm:flex-row sm:items-center sm:justify-between ${
                    isExamining
                      ? 'bg-emerald-500/5'
                      : isSkipped
                        ? 'bg-muted/30 opacity-70'
                        : 'hover:bg-muted/20'
                  }`}
                >
                  {/* Left: Queue Number & Details */}
                  <div className="flex items-center gap-3">
                    <span
                      className={`grid size-9 shrink-0 place-items-center rounded-xl font-mono text-sm font-black ${
                        isExamining
                          ? 'bg-emerald-600 text-white'
                          : isDone
                            ? 'bg-muted text-muted-foreground'
                            : isSkipped
                              ? 'border border-dashed border-muted-foreground/40 text-muted-foreground'
                              : 'bg-primary text-primary-foreground'
                      }`}
                    >
                      #{appt.queue_number}
                    </span>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <strong className="truncate text-sm font-black text-foreground">
                          {appt.patientName}
                        </strong>
                        <span className="text-[11px] text-muted-foreground">
                          • {appt.age} {copy('سنة', 'yrs')}
                        </span>
                        <span className="hidden font-mono text-[11px] text-muted-foreground sm:inline">
                          • {appt.phone}
                        </span>
                      </div>

                      <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[11px] text-muted-foreground">
                        <span className="font-medium text-foreground/80">{appt.serviceName}</span>
                        <span>•</span>
                        <span>{appt.time}</span>
                        <span>•</span>
                        <span className="font-bold text-foreground">
                          {appt.servicePrice} ج.م
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Badges & Action Buttons */}
                  <div className="flex flex-wrap items-center gap-2 self-end sm:self-auto">
                    {/* Status Badge */}
                    {isExamining && (
                      <Badge className="bg-emerald-600 text-white gap-1 text-[11px]">
                        <span className="size-1.5 rounded-full bg-white animate-ping" />
                        {copy('في الكشف', 'In Exam')}
                      </Badge>
                    )}
                    {isWaiting && (
                      <Badge variant="outline" className="border-amber-500/40 text-amber-600">
                        {copy('في الانتظار', 'Waiting')}
                      </Badge>
                    )}
                    {isDone && (
                      <Badge variant="outline" className="border-border text-muted-foreground">
                        {copy('مكتمل', 'Done')}
                      </Badge>
                    )}
                    {isSkipped && (
                      <Badge variant="outline" className="border-rose-500/30 text-rose-500">
                        {copy('تم التخطي', 'Skipped')}
                      </Badge>
                    )}

                    {/* Payment Badge */}
                    <Badge
                      variant="outline"
                      className={`text-[10px] ${
                        appt.paymentStatus === 'paid'
                          ? 'border-emerald-500/30 bg-emerald-500/5 text-emerald-600'
                          : 'border-amber-500/30 bg-amber-500/5 text-amber-600'
                      }`}
                    >
                      {appt.paymentStatus === 'paid'
                        ? copy(
                            `مدفوع (${appt.paymentMethod === 'vodafone_cash' ? 'فودافون كاش' : 'نقدي'})`,
                            `Paid (${appt.paymentMethod || 'cash'})`,
                          )
                        : copy('سداد معلّق', 'Pending')}
                    </Badge>

                    {/* Action Buttons */}
                    {isWaiting && (
                      <>
                        <Button
                          type="button"
                          size="sm"
                          onClick={() => handleStartExam(appt)}
                          className="h-7 gap-1 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground shadow-xs"
                        >
                          <Play className="size-3" />
                          <span>{copy('بدء الكشف', 'Start')}</span>
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => handleSkip(appt)}
                          className="h-7 rounded-lg px-2 text-xs text-muted-foreground hover:text-foreground"
                          title={copy('تخطي الدور', 'Skip')}
                        >
                          <SkipForward className="size-3" />
                        </Button>
                      </>
                    )}

                    {isExamining && (
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => handleCompleteExam(appt)}
                        className="h-7 gap-1 rounded-lg bg-emerald-600 px-2.5 text-xs font-bold text-white shadow-xs hover:bg-emerald-500"
                      >
                        <CheckCircle2 className="size-3" />
                        <span>{copy('إنهاء الكشف', 'Finish')}</span>
                      </Button>
                    )}

                    {isSkipped && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => handleReinstate(appt)}
                        className="h-7 gap-1 rounded-lg border-primary/30 px-2 text-xs font-bold text-primary hover:bg-primary/10"
                      >
                        <RotateCcw className="size-3" />
                        <span>{copy('إعادة للدور', 'Reinstate')}</span>
                      </Button>
                    )}

                    {/* Thermal Ticket Icon */}
                    <button
                      type="button"
                      onClick={() => setTicketModalAppt(appt)}
                      className="grid size-7 place-items-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
                      title={copy('عرض التيكت الحراري', 'View Thermal Ticket')}
                    >
                      <Ticket className="size-3.5" />
                    </button>
                  </div>
                </div>
              )
            })
          )}
        </div>
      </div>

      {/* 4. Thermal Ticket Preview Dialog (80mm) */}
      <Dialog open={!!ticketModalAppt} onOpenChange={(open) => !open && setTicketModalAppt(null)}>
        <DialogContent className="max-w-sm rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="text-center font-black">
              {copy('تيكت الدور الحراري (80mm)', 'Thermal Queue Ticket (80mm)')}
            </DialogTitle>
          </DialogHeader>

          {ticketModalAppt && (
            <div className="space-y-4">
              {/* Receipt Preview Box */}
              <div className="mx-auto w-full max-w-[280px] rounded-xl border border-dashed border-border bg-muted/20 p-5 font-mono text-xs shadow-inner">
                <div className="text-center space-y-1 border-b border-border/80 pb-3">
                  <strong className="block text-sm font-black font-sans">
                    {demo.clinicInfo.clinicName}
                  </strong>
                  <p className="text-[10px] text-muted-foreground">{demo.clinicInfo.specialty}</p>
                  <p className="text-[9px] text-muted-foreground">{demo.clinicInfo.phone}</p>
                </div>

                <div className="my-4 text-center">
                  <span className="text-[10px] text-muted-foreground uppercase tracking-widest">
                    {copy('رقم الدور', 'TICKET NUMBER')}
                  </span>
                  <strong className="mt-1 block text-4xl font-black text-primary">
                    #{ticketModalAppt.queue_number}
                  </strong>
                  <span className="mt-1 inline-block rounded-md bg-primary/10 px-2 py-0.5 text-[10px] font-bold text-primary">
                    {ticketModalAppt.serviceName}
                  </span>
                </div>

                <div className="space-y-1.5 border-t border-border/80 pt-3 text-[11px]">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{copy('المريض:', 'Patient:')}</span>
                    <strong className="font-sans font-bold">{ticketModalAppt.patientName}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{copy('التاريخ:', 'Date:')}</span>
                    <span>{ticketModalAppt.date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{copy('الوقت:', 'Time:')}</span>
                    <span>{ticketModalAppt.time}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{copy('الرسوم:', 'Fee:')}</span>
                    <strong>{ticketModalAppt.servicePrice} ج.م</strong>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">{copy('حالة الدفع:', 'Payment:')}</span>
                    <span>
                      {ticketModalAppt.paymentStatus === 'paid'
                        ? copy('مدفوع بالكامل', 'Paid')
                        : copy('سداد معلّق', 'Pending')}
                    </span>
                  </div>
                </div>

                <div className="mt-4 border-t border-dashed border-border pt-3 text-center text-[9px] text-muted-foreground">
                  <p>{copy('شكرًا لزيارتكم • نتمنى لكم الشفاء العاجل', 'Thank you for visiting')}</p>
                  <p className="mt-1 font-mono text-[8px] opacity-70">Clinic OS Queue System</p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    toast.success(
                      copy(
                        `تم إرسال تيكت #${ticketModalAppt.queue_number} للطابعة الحرارية 🖨️`,
                        `Sent ticket #${ticketModalAppt.queue_number} to printer 🖨️`,
                      ),
                    )
                    setTicketModalAppt(null)
                  }}
                  className="flex-1 gap-2 rounded-xl font-bold"
                >
                  <Printer className="size-4" />
                  {copy('طباعة حرارية', 'Print Ticket')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTicketModalAppt(null)}
                  className="rounded-xl"
                >
                  {copy('إغلاق', 'Close')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 5. Complete Examination & Settle Payment Dialog */}
      <Dialog open={!!paymentModalAppt} onOpenChange={(open) => !open && setPaymentModalAppt(null)}>
        <DialogContent className="max-w-md rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="font-black">
              {copy('إنهاء الكشف وتحصيل الرسوم', 'Complete Visit & Collect Payment')}
            </DialogTitle>
          </DialogHeader>

          {paymentModalAppt && (
            <div className="space-y-4 pt-2">
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{copy('المريض:', 'Patient:')}</span>
                  <strong className="text-sm font-bold">{paymentModalAppt.patientName}</strong>
                </div>
                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{copy('الخدمة:', 'Service:')}</span>
                  <span className="text-xs font-semibold">{paymentModalAppt.serviceName}</span>
                </div>
                <div className="mt-2 flex items-center justify-between border-t border-border/80 pt-2">
                  <span className="text-xs font-bold text-foreground">{copy('المبلغ المطلوب:', 'Amount Due:')}</span>
                  <strong className="text-lg font-black text-primary">
                    {paymentModalAppt.servicePrice} ج.م
                  </strong>
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-foreground">
                  {copy('طريقة التحصيل:', 'Payment Method:')}
                </label>
                <div className="mt-2 grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('cash')}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-bold transition-all ${
                      selectedMethod === 'cash'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <DollarSign className="size-4" />
                    <span>{copy('نقدي', 'Cash')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('vodafone_cash')}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-bold transition-all ${
                      selectedMethod === 'vodafone_cash'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <CreditCard className="size-4" />
                    <span>{copy('فودافون كاش', 'VF Cash')}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedMethod('card')}
                    className={`flex flex-col items-center gap-1 rounded-xl border p-3 text-xs font-bold transition-all ${
                      selectedMethod === 'card'
                        ? 'border-primary bg-primary/10 text-primary shadow-xs'
                        : 'border-border text-muted-foreground hover:bg-muted'
                    }`}
                  >
                    <CreditCard className="size-4" />
                    <span>{copy('فيزا / بطاقة', 'Card')}</span>
                  </button>
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  onClick={handleConfirmPaymentAndComplete}
                  className="flex-1 gap-2 rounded-xl bg-emerald-600 font-bold text-white hover:bg-emerald-500 shadow-md shadow-emerald-600/20"
                >
                  <Check className="size-4" />
                  {copy('تأكيد التحصيل وإنهاء الزيارة', 'Confirm & Finish Visit')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setPaymentModalAppt(null)}
                  className="rounded-xl"
                >
                  {copy('إلغاء', 'Cancel')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
