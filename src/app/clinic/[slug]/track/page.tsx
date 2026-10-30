'use client'

import { use, useEffect, useState, useMemo, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot } from 'firebase/firestore'
import {
  calculatePatientLivePosition,
  PatientQueueStatusResult,
  formatWaitDuration
} from '@/lib/queueCalculations'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Activity, Clock, CheckCircle2, Zap, MapPin, Phone,
  Users, Calendar, Sparkles, Navigation, MessageCircle, AlertCircle,
  Search, ShieldCheck, Stethoscope, ChevronLeft, RefreshCw, ExternalLink,
  Building2, User, ArrowRight
} from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'
import { ThemeToggle } from '@/components/common/ThemeToggle'
import { LanguageToggle } from '@/components/common/LanguageToggle'
import { useLanguage } from '@/context/LanguageContext'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import {
  CountryInfo,
  DEFAULT_COUNTRY,
  parsePhoneAndCountry,
  normalizePhoneDigits,
  getPhoneSearchVariants
} from '@/lib/countryPhoneHelper'
import Link from 'next/link'
import { toast } from 'sonner'

export default function TrackQueuePage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const searchParams = useSearchParams()
  const initialPhone = searchParams.get('phone') || ''

  const { dir, t, isRtl } = useLanguage()

  const [clinic, setClinic] = useState<any>(null)
  const [loadingClinic, setLoadingClinic] = useState(true)
  const [phoneNumber, setPhoneNumber] = useState(initialPhone)
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => {
    if (initialPhone) {
      const p = parsePhoneAndCountry(initialPhone)
      if (p.country) return p.country
    }
    return DEFAULT_COUNTRY
  })

  const [isSearching, setIsSearching] = useState(false)
  const [searchedOnce, setSearchedOnce] = useState(false)
  const [matchingAppointments, setMatchingAppointments] = useState<any[]>([])
  const [selectedAppointmentId, setSelectedAppointmentId] = useState<string | null>(null)
  const [allTodayBranchAppts, setAllTodayBranchAppts] = useState<any[]>([])

  // 1. Fetch clinic data by slug
  useEffect(() => {
    const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubClinic = onSnapshot(
      qClinic,
      (snapshot) => {
        if (!snapshot.empty) {
          setClinic({ id: snapshot.docs[0].id, ...snapshot.docs[0].data() })
        }
        setLoadingClinic(false)
      },
      (err) => {
        console.error('Clinic fetch error:', err)
        setLoadingClinic(false)
      }
    )
    return () => unsubClinic()
  }, [slug])

  // 2. Perform search by phone number
  const handleSearch = useCallback(
    async (phoneToSearch?: string) => {
      const targetPhone = (phoneToSearch !== undefined ? phoneToSearch : phoneNumber).trim()
      if (!targetPhone) {
        toast.error(isRtl ? 'يرجى إدخال رقم الهاتف أولاً' : 'Please enter your phone number first')
        return
      }

      setIsSearching(true)
      setSearchedOnce(true)

      try {
        const res = await fetch(
          `/api/clinic/${encodeURIComponent(slug)}/queue?phone=${encodeURIComponent(targetPhone)}`
        )
        const data = await res.json()

        if (data.success && Array.isArray(data.matchingAppointments)) {
          setMatchingAppointments(data.matchingAppointments)
          if (data.matchingAppointments.length > 0) {
            setSelectedAppointmentId(data.matchingAppointments[0].id)
          } else {
            setSelectedAppointmentId(null)
          }
        } else {
          setMatchingAppointments([])
          setSelectedAppointmentId(null)
        }
      } catch (err) {
        console.error('Queue search error:', err)
        toast.error(isRtl ? 'تعذر جلب بيانات الحجز' : 'Could not fetch appointment data')
      } finally {
        setIsSearching(false)
      }
    },
    [phoneNumber, slug, isRtl]
  )

  // Auto-search if initialPhone was passed in URL query
  useEffect(() => {
    if (initialPhone) {
      handleSearch(initialPhone)
    }
  }, [initialPhone, handleSearch])

  // Currently selected appointment
  const selectedAppointment = useMemo(() => {
    if (!selectedAppointmentId || !matchingAppointments.length) return null
    return matchingAppointments.find((a) => a.id === selectedAppointmentId) || matchingAppointments[0]
  }, [selectedAppointmentId, matchingAppointments])

  // 3. Live Subscription to Today's Branch Queue (when selected appointment is for today)
  useEffect(() => {
    if (!clinic?.id || !selectedAppointment || !selectedAppointment.isToday) {
      setAllTodayBranchAppts([])
      return
    }

    const todayDate = selectedAppointment.date
    const constraints: any[] = [
      where('clinic_id', '==', clinic.id),
      where('date', '==', todayDate)
    ]

    const q = query(collection(db, 'appointments'), ...constraints)
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        const list = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }))
        setAllTodayBranchAppts(list)
      },
      (err) => {
        console.error('Live queue subscription error:', err)
      }
    )

    return () => unsub()
  }, [clinic?.id, selectedAppointment])

  // 4. Calculate Live Position & State
  const liveQueueStatus = useMemo(() => {
    if (!selectedAppointment) return null

    const nowCairo = new Date()
    const todayCairo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowCairo)
    const apptDate = selectedAppointment.date || todayCairo

    // Future appointment
    if (apptDate > todayCairo) {
      const futureDate = new Date(`${apptDate}T09:00:00`)
      const diffMs = Math.max(0, futureDate.getTime() - nowCairo.getTime())
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

      return {
        status: 'upcoming',
        statusLabel: isRtl ? `موعد قادم يوم ${apptDate}` : `Upcoming appointment on ${apptDate}`,
        isCurrentTurn: false,
        isNextInLine: false,
        aheadCount: 0,
        effectivePosition: 0,
        formattedWaitTime: diffDays === 1 ? (isRtl ? 'غداً' : 'Tomorrow') : (isRtl ? `خلال ${diffDays} يوم` : `In ${diffDays} days`),
        isFuture: true,
        daysRemaining: diffDays,
        message: isRtl
          ? `حجزك مؤكد ليوم ${apptDate}. يبدأ تتبع الدور المباشر وحساب مدة الانتظار في يوم الكشف.`
          : `Your booking is confirmed for ${apptDate}. Live queue tracking begins on the day of your appointment.`
      }
    }

    // Past appointment
    if (apptDate < todayCairo) {
      return {
        status: selectedAppointment.status === 'completed' ? 'completed' : 'past',
        statusLabel: selectedAppointment.status === 'completed'
          ? (isRtl ? 'تم الكشف الطبي بنجاح' : 'Examination completed')
          : (isRtl ? 'حجز سابق منتهي' : 'Past appointment'),
        isCurrentTurn: false,
        isNextInLine: false,
        aheadCount: 0,
        effectivePosition: 0,
        formattedWaitTime: isRtl ? 'منتهي' : 'Completed',
        isPast: true,
        message: isRtl
          ? 'هذا الحجز مسجل بتاريخ سابق، يمكنك تسجيل حجز جديد عند الحاجة.'
          : 'This is a past appointment. You may schedule a new booking if needed.'
      }
    }

    // Today's appointment - calculate live using real-time Firestore queue
    if (allTodayBranchAppts.length > 0) {
      const liveAppt = allTodayBranchAppts.find((a) => a.id === selectedAppointment.id) || selectedAppointment
      return calculatePatientLivePosition({
        targetAppointmentId: liveAppt.id,
        targetAppointment: liveAppt,
        allTodayAppointments: allTodayBranchAppts,
        clinic
      })
    }

    // Fallback to queueInfo precomputed by API
    return selectedAppointment.queueInfo
  }, [selectedAppointment, allTodayBranchAppts, clinic, isRtl])

  if (loadingClinic) {
    return <ClinicLoading fullScreen size="lg" label={isRtl ? 'جاري تحميل بيانات العيادة...' : 'Loading clinic details...'} />
  }

  const primaryColor = clinic?.primaryColor || '#087CF4'

  return (
    <div
      className="min-h-screen bg-gradient-to-b from-background via-background to-secondary/20 text-foreground font-sans transition-colors duration-200"
      dir={dir}
    >
      <style dangerouslySetInnerHTML={{ __html: `:root { --primary: ${primaryColor}; }` }} />

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-card/85 backdrop-blur-xl border-b border-border shadow-xs">
        <div className="max-w-4xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <ClinicLogo size="sm" variant="auto" />
            <div>
              <h1 className="text-sm font-black text-foreground line-clamp-1">
                {clinic?.clinicName || (isRtl ? 'يلا كلينيك' : 'Yalla Clinic')}
              </h1>
              <p className="text-[11px] text-muted-foreground line-clamp-1">
                {clinic?.doctorName ? `د. ${clinic.doctorName}` : ''} {clinic?.specialty ? `• ${clinic.specialty}` : ''}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggle />
            <LanguageToggle />
            <Link
              href={`/clinic/${slug}/patient`}
              className="text-xs font-bold text-primary hover:underline px-2.5 py-1.5 rounded-xl hover:bg-primary/10 transition-colors flex items-center gap-1"
            >
              <span>{isRtl ? 'بوابة المريض' : 'Patient Portal'}</span>
              <ExternalLink className="w-3 h-3" />
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-3xl mx-auto px-4 py-8 space-y-6">
        {/* Title & Introduction Banner */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-black">
            <Activity className="w-3.5 h-3.5 animate-pulse" />
            <span>{isRtl ? 'متابعة الدور المباشر' : 'Live Queue Tracker'}</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black text-foreground">
            {isRtl ? 'أين دوري الآن في العيادة؟' : 'Track Your Turn in Real-Time'}
          </h2>
          <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto leading-relaxed">
            {isRtl
              ? 'اكتب رقم الموبايل المسجل عند الحجز لمتابعة ترتيبك ووقت انتظارك المتبقي لحظة بلحظة.'
              : 'Enter your phone number to track your turn position and remaining wait time live.'}
          </p>
        </div>

        {/* Search Card */}
        <Card className="border border-border bg-card/90 shadow-md rounded-3xl p-5 sm:p-6 backdrop-blur-md">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              handleSearch()
            }}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-foreground">
                {isRtl ? 'رقم موبايل المريض المسجل بالحجز' : 'Patient Registered Mobile Number'}
              </label>
              <div className="flex flex-col sm:flex-row gap-2">
                <div className="flex-1">
                  <PhoneInputWithCountry
                    value={phoneNumber}
                    onChange={(val, country) => {
                      setPhoneNumber(val)
                      if (country) setSelectedCountry(country)
                    }}
                    defaultCountryCode={selectedCountry?.code || 'EG'}
                    className="h-12 rounded-2xl text-sm"
                  />
                </div>
                <Button
                  type="submit"
                  disabled={isSearching}
                  className="h-12 px-6 rounded-2xl font-black text-sm gap-2 shrink-0 shadow-sm"
                >
                  {isSearching ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>{isRtl ? 'متابعة دوري' : 'Track My Turn'}</span>
                </Button>
              </div>
            </div>
          </form>
        </Card>

        {/* Multiple Bookings Selector (if more than one match exists) */}
        {matchingAppointments.length > 1 && (
          <div className="space-y-2">
            <p className="text-xs font-bold text-muted-foreground px-1">
              {isRtl
                ? `تم العثور على ${matchingAppointments.length} حجوزات مسجلة بهذا الرقم، اختر الحجز المراد متابعته:`
                : `Found ${matchingAppointments.length} bookings for this number, select one:`}
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {matchingAppointments.map((appt) => {
                const isSelected = appt.id === selectedAppointmentId
                return (
                  <button
                    key={appt.id}
                    type="button"
                    onClick={() => setSelectedAppointmentId(appt.id)}
                    className={`p-3.5 rounded-2xl border text-start transition-all cursor-pointer flex items-center justify-between gap-3 ${
                      isSelected
                        ? 'border-primary bg-primary/10 shadow-xs ring-2 ring-primary/20'
                        : 'border-border bg-card hover:border-primary/40'
                    }`}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-foreground truncate">
                          {appt.patientName}
                        </span>
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5 font-bold">
                          {appt.serviceName}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground flex items-center gap-2">
                        <span>{appt.branchName}</span>
                        <span>•</span>
                        <span>{appt.date}</span>
                      </p>
                    </div>

                    <div className="text-end shrink-0">
                      <span className="block text-xs font-mono font-black text-primary">
                        #{appt.queueNumber || '--'}
                      </span>
                      <span className="text-[10px] text-muted-foreground">
                        {appt.isToday ? (isRtl ? 'اليوم' : 'Today') : appt.isFuture ? (isRtl ? 'قادم' : 'Upcoming') : (isRtl ? 'سابق' : 'Past')}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        )}

        {/* Search Results Display */}
        {searchedOnce && !isSearching && matchingAppointments.length === 0 && (
          <Card className="border border-dashed border-border bg-card/60 p-8 text-center space-y-3 rounded-3xl">
            <div className="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mx-auto flex items-center justify-center">
              <AlertCircle className="w-6 h-6" />
            </div>
            <h3 className="text-base font-bold text-foreground">
              {isRtl ? 'لم يتم العثور على حجز مسجل' : 'No Booking Found'}
            </h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto leading-relaxed">
              {isRtl
                ? 'تأكد من إدخال رقم الموبايل المسجل عند الحجز، أو تواصل مع استقبال العيادة لتسجيل حجزك.'
                : 'Please check that the mobile number matches the one provided at booking, or contact clinic reception.'}
            </p>
            <div className="pt-2">
              <Link
                href={`/clinic/${slug}`}
                className="inline-flex items-center gap-1.5 text-xs font-bold text-primary hover:underline"
              >
                <span>{isRtl ? 'حجز موعد جديد في العيادة' : 'Book a New Appointment'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </Card>
        )}

        {/* Active Selected Appointment Live Card */}
        {selectedAppointment && liveQueueStatus && (
          <div className="space-y-4">
            {/* Status Hero Card */}
            <Card
              className={`border rounded-3xl overflow-hidden shadow-lg transition-all ${
                liveQueueStatus.isCurrentTurn
                  ? 'border-emerald-500 bg-gradient-to-br from-emerald-500/15 via-card to-background ring-4 ring-emerald-500/20'
                  : liveQueueStatus.isNextInLine
                  ? 'border-amber-500 bg-gradient-to-br from-amber-500/15 via-card to-background ring-4 ring-amber-500/20'
                  : 'border-border bg-card'
              }`}
            >
              <CardHeader className="p-6 pb-4 border-b border-border/60">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <span className="text-xs font-mono font-bold text-muted-foreground">
                      {isRtl ? 'تذكرة كشف رقم' : 'Queue Ticket'}
                    </span>
                    <h3 className="text-3xl sm:text-4xl font-black text-primary flex items-center gap-2">
                      <span>#{selectedAppointment.queueNumber || '--'}</span>
                    </h3>
                  </div>

                  <div className="sm:text-end space-y-1">
                    <Badge
                      className={`text-xs px-3 py-1 font-black ${
                        liveQueueStatus.isCurrentTurn
                          ? 'bg-emerald-600 text-white animate-pulse'
                          : liveQueueStatus.isNextInLine
                          ? 'bg-amber-600 text-white'
                          : liveQueueStatus.status === 'completed'
                          ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                          : liveQueueStatus.isFuture
                          ? 'bg-blue-500/20 text-blue-700 dark:text-blue-400'
                          : 'bg-primary/20 text-primary'
                      }`}
                    >
                      {liveQueueStatus.statusLabel}
                    </Badge>
                    <p className="text-xs text-muted-foreground">
                      {selectedAppointment.serviceName} • {selectedAppointment.branchName}
                    </p>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-6 space-y-6">
                {/* 3 Metric Stats */}
                <div className="grid grid-cols-3 gap-3 text-center">
                  {/* Position in Waiting Line */}
                  <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground block">
                      {isRtl ? 'موضعك بالدور' : 'Your Position'}
                    </span>
                    <strong className="text-xl sm:text-2xl font-black text-foreground block">
                      {liveQueueStatus.isCurrentTurn
                        ? (isRtl ? 'الآن' : 'Now')
                        : liveQueueStatus.isFuture
                        ? '—'
                        : liveQueueStatus.status === 'completed'
                        ? '✓'
                        : `#${liveQueueStatus.effectivePosition || 1}`}
                    </strong>
                  </div>

                  {/* Patients Ahead */}
                  <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground block">
                      {isRtl ? 'المرضى أمامك' : 'Ahead of You'}
                    </span>
                    <strong className="text-xl sm:text-2xl font-black text-foreground block">
                      {liveQueueStatus.isFuture
                        ? '—'
                        : liveQueueStatus.status === 'completed'
                        ? '0'
                        : liveQueueStatus.aheadCount ?? 0}
                    </strong>
                  </div>

                  {/* Estimated Wait Time */}
                  <div className="p-3.5 rounded-2xl bg-secondary/50 border border-border space-y-1">
                    <span className="text-[11px] font-bold text-muted-foreground block">
                      {isRtl ? 'الوقت التقديري' : 'Est. Wait'}
                    </span>
                    <strong className="text-sm sm:text-base font-black text-primary block truncate pt-1">
                      {liveQueueStatus.formattedWaitTime || '—'}
                    </strong>
                  </div>
                </div>

                {/* Status Message / Doctor Current Action (Privacy preserved: never leaks other names) */}
                <div className="p-4 rounded-2xl bg-muted/40 border border-border text-xs space-y-1.5">
                  <div className="flex items-center gap-2 font-bold text-foreground">
                    <Stethoscope className="w-4 h-4 text-primary shrink-0" />
                    <span>
                      {liveQueueStatus.isCurrentTurn
                        ? (isRtl ? 'الطبيب في انتظار دخولك للغرفة' : 'Doctor is waiting for you')
                        : liveQueueStatus.isNextInLine
                        ? (isRtl ? 'يرجى التواجد أمام باب العيادة — أنت الحالة التالية' : 'Please be near the door — you are next')
                        : liveQueueStatus.isFuture
                        ? (isRtl ? 'موعد مستقبلي مؤكد' : 'Confirmed upcoming appointment')
                        : liveQueueStatus.status === 'completed'
                        ? (isRtl ? 'تم إنهاء الكشف واستلام الروشتة' : 'Visit completed')
                        : (isRtl ? 'العيادة تعمل حاليًا وتتابع الحالات بالترتيب' : 'Clinic is actively attending patients')}
                    </span>
                  </div>
                  <p className="text-muted-foreground leading-relaxed">
                    {liveQueueStatus.message ||
                      (isRtl
                        ? 'يتم تحديث ترتيب الدخول ووقت الانتظار تلقائيًا بالتزامن المباشر مع لوحة الطبيب.'
                        : 'Queue position and wait time update in real-time with the doctor dashboard.')}
                  </p>
                </div>

                {/* Booking Information Details */}
                <div className="border-t border-border pt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block">{isRtl ? 'اسم المريض' : 'Patient Name'}</span>
                    <strong className="font-bold text-foreground">{selectedAppointment.patientName}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{isRtl ? 'تاريخ الحجز' : 'Date'}</span>
                    <strong className="font-bold text-foreground">{selectedAppointment.date}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{isRtl ? 'الفرع' : 'Branch'}</span>
                    <strong className="font-bold text-foreground">{selectedAppointment.branchName}</strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block">{isRtl ? 'حالة الدفع' : 'Payment'}</span>
                    <strong className="font-bold text-foreground">
                      {selectedAppointment.paymentStatus === 'paid'
                        ? (isRtl ? 'مدفوع' : 'Paid')
                        : (isRtl ? 'غير مدفوع' : 'Unpaid')}
                    </strong>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Quick Action Navigation Buttons */}
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleSearch()}
                className="gap-1.5 rounded-xl text-xs font-bold w-full sm:w-auto"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>{isRtl ? 'تحديث الدور الآن' : 'Refresh Queue'}</span>
              </Button>

              <Link
                href={`/clinic/${slug}/patient`}
                className="inline-flex items-center justify-center gap-1.5 text-xs font-bold text-primary hover:underline px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 transition-colors w-full sm:w-auto"
              >
                <span>{isRtl ? 'الدخول إلى بوابة المريض والملف الطبي' : 'Open Patient Portal & Medical Records'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-border mt-16 py-6 text-center text-xs text-muted-foreground">
        <p>
          {isRtl
            ? 'جميع الحقوق محفوظة 2026 YallaCodex • منصة يلا كلينيك'
            : 'All rights reserved 2026 YallaCodex • Yalla Clinic'}
        </p>
      </footer>
    </div>
  )
}
