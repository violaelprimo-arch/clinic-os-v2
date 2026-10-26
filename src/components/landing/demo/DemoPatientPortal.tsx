'use client'

import React, { useState } from 'react'
import {
  UserCheck,
  Calendar,
  Clock,
  MapPin,
  Phone,
  Star,
  CheckCircle2,
  Ticket,
  Activity,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Stethoscope,
  Info,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { DemoAppointment } from './types'
import { DemoClinicHookReturn } from './useDemoClinic'
import { useLanguage } from '@/context/LanguageContext'

interface DemoPatientPortalProps {
  demo: DemoClinicHookReturn
  onSwitchToDoctor: () => void
}

export function DemoPatientPortal({
  demo,
  onSwitchToDoctor,
}: DemoPatientPortalProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    demo.services[0].id,
  )
  const [patientName, setPatientName] = useState('كريم عبد الفتاح')
  const [phone, setPhone] = useState('01099887766')
  const [age, setAge] = useState('31')
  const [notes, setNotes] = useState('أرغب في فحص نظر شامل ومراجعة مقاس النظارة')
  const [bookedAppt, setBookedAppt] = useState<DemoAppointment | null>(
    demo.lastBookedTicket,
  )

  const selectedService =
    demo.services.find((s) => s.id === selectedServiceId) || demo.services[0]

  const handleBook = (e: React.FormEvent) => {
    e.preventDefault()

    if (!patientName.trim()) {
      toast.error(copy('يرجى إدخال اسم المريض', 'Please enter patient name'))
      return
    }

    const newAppt = demo.bookAppointment({
      patientName,
      phone: phone.trim() || '01012345678',
      age: Number(age) || 30,
      serviceId: selectedService.id,
      notes,
    })

    setBookedAppt(newAppt)
    toast.success(
      copy(
        `تم تأكيد حجزك بنجاح! رقم دورك هو #${newAppt.queue_number} 🎫`,
        `Booking confirmed! Your ticket number is #${newAppt.queue_number} 🎫`,
      ),
    )
  }

  // Calculate live position in queue
  const currentInExamNumber = demo.currentInExam?.queue_number || 101
  const myQueueNumber = bookedAppt?.queue_number || 105
  const patientsAhead = Math.max(
    0,
    demo.waitingList.filter(
      (a) => bookedAppt && a.queue_number < bookedAppt.queue_number,
    ).length,
  )

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* 1. Clinic Public Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-border/80 bg-gradient-to-r from-primary/10 via-card to-background p-5 sm:p-8 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-4">
            <span className="grid size-16 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground font-black text-2xl shadow-md shadow-primary/20">
              <Stethoscope className="size-8" />
            </span>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-black text-foreground">
                  {demo.clinicInfo.clinicName}
                </h2>
                <span className="inline-flex items-center gap-1 rounded-md bg-emerald-500/10 px-2 py-0.5 text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  {copy('مفتوح الآن', 'Open Now')}
                </span>
              </div>
              <p className="mt-1 text-xs sm:text-sm text-muted-foreground font-medium">
                {demo.clinicInfo.specialty}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="size-3.5 text-primary" />
                  {demo.clinicInfo.address}
                </span>
                <span className="flex items-center gap-1">
                  <Star className="size-3.5 text-amber-500 fill-amber-500" />
                  <strong className="text-foreground">{demo.clinicInfo.rating}</strong>
                  <span>({demo.clinicInfo.reviewsCount} {copy('تقييم', 'reviews')})</span>
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-start gap-1 rounded-2xl border border-border/60 bg-background/60 p-3 text-xs md:items-end">
            <span className="text-muted-foreground">{copy('مواعيد العمل اليوم:', "Today's Hours:")}</span>
            <strong className="font-bold text-foreground">04:00 م — 10:00 م</strong>
            <span className="text-[10px] text-emerald-600 dark:text-emerald-400">
              {copy('استقبال الحجوزات مباشر', 'Direct booking available')}
            </span>
          </div>
        </div>
      </div>

      {/* 2. Main Booking Flow vs Confirmation Ticket */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left (or Right): Services Selector & Booking Form (7 cols) */}
        <div className="space-y-6 lg:col-span-7">
          {/* Services Selection */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-foreground">
                {copy('1. اختر نوع الخدمة الطبية', '1. Select Medical Service')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {copy('اختر الخدمة لمعرفة الرسوم والمدة التقديرية', 'Select a service for fees and estimated duration')}
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              {demo.services.map((srv) => {
                const isSelected = selectedServiceId === srv.id
                return (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all duration-200 ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-sm ring-2 ring-primary/20'
                        : 'border-border/80 bg-background/60 hover:border-primary/40'
                    }`}
                  >
                    <div className="flex items-start justify-between">
                      <strong className="text-xs sm:text-sm font-black text-foreground">
                        {srv.name}
                      </strong>
                      <span className="font-mono text-xs font-black text-primary">
                        {srv.price} ج.م
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">
                      {srv.desc}
                    </p>
                    <span className="mt-2 inline-flex items-center gap-1 text-[10px] font-bold text-muted-foreground">
                      <Clock className="size-3" />
                      {srv.duration}
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Booking Inputs Form */}
          <div className="rounded-3xl border border-border/80 bg-card p-5 shadow-sm space-y-4">
            <div>
              <h3 className="text-base font-black text-foreground">
                {copy('2. بيانات المريض وتأكيد الحجز', '2. Patient Details & Confirmation')}
              </h3>
              <p className="text-xs text-muted-foreground">
                {copy('تجربة حية وسريعة: بدون انتظار OTP أو رسائل تأكيد', 'Live demo: Instant confirmation with zero OTP delay')}
              </p>
            </div>

            <form onSubmit={handleBook} className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 text-xs">
                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">
                    {copy('اسم المريض رباعي:', 'Patient Full Name:')}
                  </label>
                  <Input
                    type="text"
                    required
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                    placeholder={copy('مثال: أحمد محمد علي', 'e.g. John Doe')}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">
                    {copy('رقم الهاتف للتواصل:', 'Phone Number:')}
                  </label>
                  <Input
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    className="h-9 rounded-xl text-xs font-mono"
                    placeholder="010XXXXXXXX"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">
                    {copy('العمر (بالسنوات):', 'Age (years):')}
                  </label>
                  <Input
                    type="number"
                    min="1"
                    max="120"
                    value={age}
                    onChange={(e) => setAge(e.target.value)}
                    className="h-9 rounded-xl text-xs font-mono"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-bold text-foreground">
                    {copy('الخدمة المختارة:', 'Selected Service:')}
                  </label>
                  <div className="flex h-9 items-center justify-between rounded-xl border border-border bg-muted/30 px-3 font-bold text-primary">
                    <span className="truncate">{selectedService.name}</span>
                    <span className="font-mono">{selectedService.price} ج.م</span>
                  </div>
                </div>

                <div className="col-span-2 space-y-1.5">
                  <label className="font-bold text-foreground">
                    {copy('سبب الزيارة أو الأعراض (اختياري):', 'Symptoms / Reason for visit:')}
                  </label>
                  <Input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-9 rounded-xl text-xs"
                    placeholder={copy('مثال: فحص دوري، زغللة بالعين...', 'Brief description...')}
                  />
                </div>
              </div>

              <Button
                type="submit"
                className="w-full gap-2 rounded-2xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/20"
              >
                <Ticket className="size-4" />
                <span>{copy('تأكيد الحجز واستلام رقم الدور', 'Confirm Booking & Get Ticket')}</span>
              </Button>
            </form>
          </div>
        </div>

        {/* Right (or Left): Live Ticket Confirmation & Queue Tracking (5 cols) */}
        <div className="space-y-4 lg:col-span-5">
          {bookedAppt ? (
            <div className="rounded-3xl border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/10 via-card to-background p-6 shadow-xl space-y-5">
              <div className="text-center space-y-1">
                <span className="inline-flex size-12 place-items-center rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="size-6" />
                </span>
                <h4 className="text-lg font-black text-foreground">
                  {copy('تم تأكيد حجزك بنجاح!', 'Booking Confirmed!')}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {copy('احتفظ برقم دورك لمتابعة التقدم المباشر', 'Keep your ticket to track live progress')}
                </p>
              </div>

              {/* Ticket Visual Card */}
              <div className="rounded-2xl border border-dashed border-emerald-500/50 bg-background/80 p-5 text-center shadow-inner font-mono">
                <span className="text-[10px] text-muted-foreground tracking-widest uppercase">
                  {copy('رقم الدور الخاص بك', 'YOUR QUEUE TICKET')}
                </span>
                <strong className="mt-1 block text-5xl font-black text-emerald-600 dark:text-emerald-400">
                  #{bookedAppt.queue_number}
                </strong>
                <span className="mt-2 inline-block rounded-lg bg-emerald-500/10 px-3 py-1 font-sans text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  {bookedAppt.patientName} • {bookedAppt.serviceName}
                </span>

                <div className="mt-4 grid grid-cols-2 gap-2 border-t border-border/80 pt-3 text-xs font-sans">
                  <div className="text-start">
                    <span className="block text-[10px] text-muted-foreground">
                      {copy('الرسوم المستحقة:', 'Total Fee:')}
                    </span>
                    <strong className="font-mono text-sm">{bookedAppt.servicePrice} ج.م</strong>
                  </div>
                  <div className="text-end">
                    <span className="block text-[10px] text-muted-foreground">
                      {copy('وقت الحجز:', 'Booking Time:')}
                    </span>
                    <strong className="font-mono text-sm">{bookedAppt.time}</strong>
                  </div>
                </div>
              </div>

              {/* Live Tracker Status */}
              <div className="rounded-2xl border border-border/80 bg-background/60 p-4 text-xs space-y-2">
                <div className="flex items-center justify-between font-bold">
                  <span className="flex items-center gap-1.5 text-primary">
                    <Activity className="size-4 animate-pulse" />
                    {copy('متابعة الدور الحية:', 'Live Queue Status:')}
                  </span>
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-600">
                    {copy('نشط الآن', 'Active')}
                  </Badge>
                </div>

                <div className="space-y-1.5 pt-1 text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{copy('الكشف الحالي لدى الطبيب:', 'Currently in room:')}</span>
                    <strong className="text-foreground font-mono">#{currentInExamNumber}</strong>
                  </div>
                  <div className="flex justify-between">
                    <span>{copy('عدد المرضى قبلك:', 'Patients ahead:')}</span>
                    <strong className="text-foreground font-mono">
                      {patientsAhead} {copy('مرضى', 'patients')}
                    </strong>
                  </div>
                  <div className="flex justify-between">
                    <span>{copy('الوقت التقديري للانتظار:', 'Estimated wait:')}</span>
                    <strong className="text-foreground font-mono">
                      ~ {patientsAhead * 12} {copy('دقيقة', 'mins')}
                    </strong>
                  </div>
                </div>
              </div>

              {/* Connected CTA Button */}
              <div className="space-y-2 pt-2">
                <Button
                  type="button"
                  onClick={onSwitchToDoctor}
                  className="w-full gap-2 rounded-2xl bg-primary py-3 font-bold text-white shadow-lg shadow-primary/25"
                >
                  <Stethoscope className="size-4" />
                  <span>{copy('انتقل لمنصة الطبيب لمشاهدة حجزك', 'View Your Booking in Doctor Queue')}</span>
                  {isRtl ? <ArrowLeft className="size-4" /> : <ArrowRight className="size-4" />}
                </Button>
                <p className="text-center text-[11px] text-muted-foreground">
                  {copy(
                    '💡 ستجد حجزك قد أُضيف فورًا إلى قائمة انتظار الطبيب برقمك هذا!',
                    '💡 Your ticket was automatically added to the doctor queue!',
                  )}
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center rounded-3xl border border-dashed border-border/80 bg-muted/20 p-8 text-center space-y-3">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Ticket className="size-7" />
              </span>
              <h4 className="text-sm font-black text-foreground">
                {copy('لم يتم تأكيد أي حجز بعد', 'No active booking yet')}
              </h4>
              <p className="max-w-xs text-xs text-muted-foreground">
                {copy(
                  'أكمل بياناتك بالجانب الآخر واضغط «تأكيد الحجز» لاستلام رقم الدور ومتابعة الانتظار مباشرة.',
                  'Fill in your details and click "Confirm Booking" to receive your ticket and live tracker.',
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
