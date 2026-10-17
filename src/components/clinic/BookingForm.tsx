'use client'

import { useState, useEffect, useMemo } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  CheckCircle2, Clock, Users, ArrowRight, ArrowLeft,
  Calendar, Phone, User, ShieldCheck, MapPin, Sparkles,
  Zap, CreditCard, Wallet, Banknote, Building2, Navigation,
  ExternalLink, Upload, AlertCircle, Bell
} from 'lucide-react'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import Link from 'next/link'
import { Branch } from '@/types/clinic'
import {
  getClinicBranches,
  ensureClinicHasMainBranch,
  calculateHaversineDistanceKm
} from '@/lib/branchService'
import { createClinicNotification } from '@/lib/notificationService'
import { useLanguage } from '@/context/LanguageContext'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import {
  CountryInfo,
  DEFAULT_COUNTRY,
  validatePhoneNumber,
  parsePhoneAndCountry
} from '@/lib/countryPhoneHelper'

export function BookingForm({
  clinic,
  services = [],
  defaultName = '',
  defaultPhone = '',
  defaultAge = '',
  preselectedServiceId = null
}: {
  clinic: any
  services?: any[]
  defaultName?: string
  defaultPhone?: string
  defaultAge?: string
  preselectedServiceId?: string | null
}) {
  const { dir, t, isRtl } = useLanguage()
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState(defaultPhone)
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(() => {
    if (defaultPhone) {
      const p = parsePhoneAndCountry(defaultPhone)
      if (p.country) return p.country
    }
    return DEFAULT_COUNTRY
  })
  const [phoneError, setPhoneError] = useState(false)
  const [phoneErrorMsg, setPhoneErrorMsg] = useState('')
  const [age, setAge] = useState(defaultAge)
  const [dob, setDob] = useState('')
  const showPrices = clinic?.showPrices !== false && clinic?.hidePrices !== true

  // Multi-Branch State
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [branchDistances, setBranchDistances] = useState<Record<string, number>>({})
  const [isLocating, setIsLocating] = useState(false)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null)
  const [locationError, setLocationError] = useState<string | null>(null)
  const [areaFilter, setAreaFilter] = useState<string>('ALL')

  // Fetch branches on mount
  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const clinicId = clinic.id || clinic.slug

    const loadBranches = async () => {
      try {
        const main = await ensureClinicHasMainBranch(clinic)
        const list = await getClinicBranches(clinicId)
        const activeList = list.filter((b) => !b.isArchived)
        setBranches(activeList)
        if (activeList.length > 0) {
          setSelectedBranchId((prev) => prev || activeList[0].id)
        }
      } catch (err) {
        console.error('Error fetching branches for booking:', err)
      }
    }
    loadBranches()
  }, [clinic])

  const selectedBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0] || null
  }, [branches, selectedBranchId])

  // Geolocate nearest branch
  const handleFindNearestBranch = () => {
    if (!navigator.geolocation) {
      toast.error('خدمة تحديد الموقع الجغرافي غير مدعومة في متصفحك')
      return
    }

    setIsLocating(true)
    setLocationError(null)

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLat = pos.coords.latitude
        const userLng = pos.coords.longitude
        setUserCoords({ lat: userLat, lng: userLng })

        const distMap: Record<string, number> = {}
        branches.forEach((b) => {
          if (b.latitude && b.longitude) {
            const dist = calculateHaversineDistanceKm(userLat, userLng, b.latitude, b.longitude)
            distMap[b.id] = dist
          } else {
            distMap[b.id] = 999 // Unknown distance
          }
        })
        setBranchDistances(distMap)

        // Select the closest branch
        const sorted = [...branches].sort((a, b) => (distMap[a.id] || 999) - (distMap[b.id] || 999))
        if (sorted.length > 0 && distMap[sorted[0].id] < 999) {
          setSelectedBranchId(sorted[0].id)
          toast.success(`تم العثور على أقرب فرع لك: ${sorted[0].name} (يبعد حوالي ${distMap[sorted[0].id]} كم تقريباً)`)
        } else {
          toast.info('تم تحديد موقعك، يمكنك اختيار الفرع الأنسب لك بالأسفل')
        }
        setIsLocating(false)
      },
      (err) => {
        setIsLocating(false)
        setLocationError('تم رفض إذن تحديد الموقع. يمكنك اختيار الفرع والمنطقة يدوياً.')
        toast.info('يمكنك اختيار الفرع والمنطقة يدوياً من القائمة')
      },
      { timeout: 10000, enableHighAccuracy: false }
    )
  }

  // Sorted/filtered branches
  const sortedBranches = useMemo(() => {
    let list = [...branches]
    if (areaFilter !== 'ALL') {
      list = list.filter((b) => (b.governorate || b.city || b.area) === areaFilter)
    }
    if (Object.keys(branchDistances).length > 0) {
      list.sort((a, b) => (branchDistances[a.id] || 999) - (branchDistances[b.id] || 999))
    }
    return list
  }, [branches, branchDistances, areaFilter])

  // Unique areas for manual filter
  const uniqueAreas = useMemo(() => {
    const set = new Set<string>()
    branches.forEach((b) => {
      const loc = b.governorate || b.city || b.area
      if (loc) set.add(loc)
    })
    return Array.from(set)
  }, [branches])

  // Available services: use branch services if defined, otherwise clinic/fallback services
  const availableServices = useMemo(() => {
    if (selectedBranch?.services && selectedBranch.services.length > 0) {
      return selectedBranch.services
    }
    if (services.length > 0) return services
    return [
      { id: '1', name: 'كشف عادي', price: 250, desc: 'كشف طبي عام شامل', duration: 'حوالي 15 دقيقة' },
      { id: '2', name: 'استشارة', price: 150, desc: 'استشارة ومتابعة سريعة', duration: 'حوالي 10 دقائق' },
      { id: '3', name: 'كشف مستعجل', price: 400, desc: 'أولوية فورية في الدور', duration: 'كشف فوري مباشر' },
      { id: '4', name: 'متابعة', price: 100, desc: 'متابعة لحالة كشف سابقة', duration: 'حوالي 10 دقائق' }
    ]
  }, [selectedBranch, services])

  const [selectedServiceId, setSelectedServiceId] = useState<string>(
    preselectedServiceId || availableServices[0]?.id || '1'
  )

  useEffect(() => {
    if (preselectedServiceId) {
      setSelectedServiceId(preselectedServiceId)
    } else if (availableServices[0]) {
      setSelectedServiceId(availableServices[0].id)
    }
  }, [preselectedServiceId, availableServices])

  const [dailyBookingCounts, setDailyBookingCounts] = useState<{ [date: string]: number }>({})

  // Fetch existing appointments count for this branch
  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const clinicId = clinic.id || clinic.slug

    const fetchCounts = async () => {
      try {
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', clinicId)
        )
        const snap = await getDocs(q)
        const counts: { [date: string]: number } = {}
        snap.docs.forEach((docSnap) => {
          const d = docSnap.data()
          // Count only for this branch if branch_id is present
          if (selectedBranch?.id && d.branch_id && d.branch_id !== selectedBranch.id) {
            return
          }
          if (d.date && d.status !== 'cancelled') {
            counts[d.date] = (counts[d.date] || 0) + 1
          }
        })
        setDailyBookingCounts(counts)
      } catch (err) {
        console.error('Error fetching booking counts:', err)
      }
    }
    fetchCounts()
  }, [clinic?.id, clinic?.slug, selectedBranch?.id])

  // Compute available days: check selected branch weekly schedule & max daily bookings
  const availableDays = useMemo(() => {
    const list: { iso: string; label: string; formattedDate: string }[] = []
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayNamesEn = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]
    const monthNamesEn = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ]

    const branchSchedule = selectedBranch?.weeklySchedule || clinic?.weeklySchedule || []
    const maxLimit = Number(selectedBranch?.maxDailyBookings || clinic?.maxDailyBookings) || 0

    // Scan up to 14 days ahead
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)

      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const dayNum = String(d.getDate()).padStart(2, '0')
      const iso = `${year}-${month}-${dayNum}`

      const dayIndex = d.getDay()
      const dayKey = dayKeys[dayIndex]
      const dayName = isRtl ? dayNamesAr[dayIndex] : dayNamesEn[dayIndex]

      // Check weeklySchedule: if branch is closed on this day, SKIP
      if (branchSchedule && branchSchedule.length > 0) {
        const sched = branchSchedule.find((s: any) => s.id === dayKey)
        if (sched && sched.isOpen === false) {
          continue
        }
      }

      // Check max daily bookings: if day is full, SKIP
      const bookedCount = dailyBookingCounts[iso] || 0
      if (maxLimit > 0 && bookedCount >= maxLimit) {
        continue
      }

      let label = dayName
      if (i === 0) label = isRtl ? 'اليوم' : 'Today'
      else if (i === 1) label = isRtl ? 'غداً' : 'Tomorrow'

      const monthName = isRtl ? monthNamesAr[d.getMonth()] : monthNamesEn[d.getMonth()]
      const formattedDate = isRtl ? `${d.getDate()} ${monthName}` : `${monthName} ${d.getDate()}`

      list.push({ iso, label, formattedDate })

      // Show up to 6 active available days
      if (list.length >= 6) break
    }

    return list
  }, [selectedBranch, clinic?.weeklySchedule, clinic?.maxDailyBookings, dailyBookingCounts, isRtl])

  const [selectedDate, setSelectedDate] = useState<string>('')

  useEffect(() => {
    if (availableDays.length > 0) {
      const isSelectedAvailable = availableDays.some((d) => d.iso === selectedDate)
      if (!isSelectedAvailable) {
        setSelectedDate(availableDays[0].iso)
      }
    }
  }, [availableDays, selectedDate])

  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'wallet'>('cash')
  const [transferNumber, setTransferNumber] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [transferProofUrl, setTransferProofUrl] = useState('')
  const [isBooking, setIsBooking] = useState(false)
  const [successInfo, setSuccessInfo] = useState<{
    queueNumber: number
    trackingId: string
    aheadCount: number
    branchName: string
  } | null>(null)

  const selectedService = availableServices.find((s) => s.id === selectedServiceId) || availableServices[0]

  // Receipt image upload
  const handleReceiptProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        return toast.error(isRtl ? 'حجم الصورة كبير، يرجى اختيار صورة أقل من 4 ميجابايت' : 'Image is too large, maximum size is 4MB')
      }
      const reader = new FileReader()
      reader.onload = () => {
        setTransferProofUrl(reader.result as string)
        toast.success(isRtl ? 'تم إرفاق إيصال التحويل بنجاح!' : 'Receipt attached successfully!')
      }
      reader.readAsDataURL(file)
    }
  }

  // Step 1 Validation
  const handleNextStep1 = () => {
    if (!selectedBranch) return toast.error(isRtl ? 'يرجى اختيار فرع العيادة أولاً' : 'Please select a branch first')
    if (!name.trim()) return toast.error(isRtl ? 'يرجى إدخال اسم المريض' : 'Please enter patient full name')
    if (!phone.trim() || !validatePhoneNumber(phone, selectedCountry)) {
      setPhoneError(true)
      setPhoneErrorMsg(isRtl ? `يرجى إدخال رقم هاتف صحيح لـ ${selectedCountry.nameAr} (${selectedCountry.placeholder})` : 'Please enter a valid phone number')
      return toast.error(isRtl ? `يرجى إدخال رقم هاتف صحيح لـ ${selectedCountry.nameAr}` : 'Please enter a valid phone number')
    }
    if (!age.trim()) return toast.error(isRtl ? 'يرجى إدخال السن' : 'Please enter patient age')
    if (!selectedDate) return toast.error(isRtl ? 'يرجى اختيار يوم الحجز' : 'Please select a booking date')

    setStep(2)
  }

  // Step 2 Validation
  const handleNextStep2 = () => {
    setStep(3)
  }

  // Final Booking Submit
  const handleBooking = async () => {
    if (paymentMethod !== 'cash' && !transferNumber.trim()) {
      return toast.error(isRtl ? 'يرجى كتابة رقم الهاتف أو المعاملة المحول منها لتأكيد الحجز' : 'Please provide sender phone number or transaction reference')
    }

    setIsBooking(true)
    const clinicId = clinic.id || clinic.slug

    try {
      // Branch-isolated queue counting for the chosen date:
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId)
      )

      const querySnapshot = await getDocs(q)
      const branchDateAppts = querySnapshot.docs.filter((d) => {
        const data = d.data()
        const matchesDate = data.date === selectedDate
        const matchesBranch = selectedBranch?.id
          ? data.branch_id === selectedBranch.id
          : true
        return matchesDate && matchesBranch
      })

      const myQueueNumber = branchDateAppts.length + 1

      // Count waiting ahead in this branch
      let waitingCount = 0
      branchDateAppts.forEach((docSnap) => {
        if (docSnap.data().status === 'waiting') waitingCount++
      })

      const isOnlinePay = paymentMethod === 'instapay' || paymentMethod === 'wallet'
      const paymentStatus = isOnlinePay ? 'pending_verification' : 'unpaid'

      const newAppt = {
        clinic_id: clinicId,
        branch_id: selectedBranch?.id || null,
        branchName: selectedBranch?.name || 'الفرع الرئيسي',
        patientName: name,
        phone,
        age: age || null,
        dob: dob || null,
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price || 0,
        isUrgent: selectedService.name.includes('مستعجل') || selectedService.name.includes('طوارئ'),
        date: selectedDate,
        queue_number: myQueueNumber,
        status: 'waiting',
        paymentMethod,
        paymentStatus,
        transferNumber: isOnlinePay ? transferNumber : '',
        transferReference: transferReference || '',
        transferProofUrl: transferProofUrl || '',
        createdAt: new Date().toISOString()
      }

      const docRef = await addDoc(collection(db, 'appointments'), newAppt)

      // Send In-Site Notification to Patient
      await createClinicNotification({
        clinicId,
        branchId: selectedBranch?.id,
        recipientType: 'patient',
        recipientTarget: phone,
        title: 'تم تسجيل حجزك بنجاح',
        body: `مرحباً ${name}، تم تأكيد حجزك في فرع "${selectedBranch?.name || 'الرئيسي'}" برقم دور #${myQueueNumber} لتاريخ ${selectedDate}.`,
        type: 'booking_confirmed',
        appointmentId: docRef.id
      })

      // Send Staff Notification for Reception
      await createClinicNotification({
        clinicId,
        branchId: selectedBranch?.id,
        recipientType: 'staff',
        recipientTarget: clinicId,
        title: isOnlinePay ? 'حجز جديد مع تحويل بانتظار التأكيد' : 'حجز جديد مسجل',
        body: `حجز جديد للمريض ${name} في فرع "${selectedBranch?.name}" (${selectedService.name} - ${paymentMethod}).`,
        type: isOnlinePay ? 'payment_pending' : 'new_booking',
        appointmentId: docRef.id
      })

      setSuccessInfo({
        queueNumber: myQueueNumber,
        trackingId: docRef.id,
        aheadCount: waitingCount,
        branchName: selectedBranch?.name || 'الفرع الرئيسي'
      })

      toast.success(
        isOnlinePay
          ? `تم تسجيل حجزك بنجاح! دورك: #${myQueueNumber} (سيتم مراجعة وتأكيد الدفع من إدارة الفرع)`
          : `تم تسجيل حجزك بنجاح! دورك: #${myQueueNumber}`
      )
    } catch (error) {
      console.error('Error creating appointment:', error)
      toast.error('حدث خطأ أثناء إتمام الحجز، يرجى المحاولة ثانيةً.')
    } finally {
      setIsBooking(false)
    }
  }

  // ─────────────────────────────────────────────
  // 1. SUCCESS SCREEN
  // ─────────────────────────────────────────────
  if (successInfo) {
    return (
      <div className="yalla-card p-6 sm:p-8 max-w-lg mx-auto text-center space-y-6 shadow-2xl bg-card border border-border rounded-3xl text-card-foreground" dir={dir}>
        <div className="w-20 h-20 bg-primary/10 border-4 border-primary/20 text-primary rounded-full flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-foreground">{t('booking_success', 'تم تسجيل حجزك بنجاح')}</h2>
          <p className="text-xs text-muted-foreground mt-1">
            {t('welcome', 'مرحباً')} {name}، {t('added_to_today_list', 'تم إدراجك في قائمة كشوفات اليوم لدى:')} <strong>{successInfo.branchName}</strong>
          </p>
        </div>

        {/* Big Queue Number Card */}
        <div className="bg-secondary/40 border border-border rounded-3xl p-6 space-y-2">
          <p className="text-xs font-bold text-muted-foreground">{t('your_branch_queue_num', 'رقمك في دور الفرع')}</p>
          <div className="text-6xl font-black text-primary tracking-tight">
            #{successInfo.queueNumber}
          </div>
          <p className="text-[11px] font-bold text-muted-foreground">{successInfo.branchName}</p>
        </div>

        {/* Booking Details Grid */}
        <div className={`grid grid-cols-2 gap-3 ${isRtl ? 'text-right' : 'text-left'}`}>
          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground">{t('payment_status', 'حالة الدفع')}</span>
            <p className="text-xs font-black text-foreground">
              {paymentMethod === 'cash' ? t('cash_on_arrival', 'نقداً عند الحضور') : t('pending_admin_confirm', 'بانتظار تأكيد الإدارة')}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border space-y-1">
            <span className="text-[11px] font-bold text-muted-foreground">{t('waiting_ahead', 'المرضى في الانتظار قبلك')}</span>
            <p className="text-sm font-black text-primary">
              {successInfo.aheadCount} {isRtl ? 'مرضى' : 'patients'}
            </p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-primary text-xs font-bold flex items-center justify-center gap-2">
          <Bell className="w-4 h-4 text-primary shrink-0" />
          <span>{t('notification_notice', 'ستصلك تنبيهات صوتية ومباشرة فور اقتراب دورك (من أول متبقي 5 أدوار) ومع كل دخول مريض')}</span>
        </div>

        {/* Action CTAs */}
        <div className="space-y-2.5 pt-2">
          <Link
            href={`/clinic/${clinic.slug}/track/${successInfo.trackingId}`}
            className="block w-full"
          >
            <Button className="w-full h-12 text-sm font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg shadow-primary/25">
              {t('track_booking_live_btn', 'تابع الحجز وإشعار اقتراب الدور مباشرة')}
            </Button>
          </Link>

          {selectedBranch?.mapsLink ? (
            <a href={selectedBranch.mapsLink} target="_blank" rel="noreferrer" className="block w-full">
              <Button variant="outline" className="w-full h-11 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl">
                <MapPin className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-primary`} />
                {t('branch_location_maps', 'موقع فرع')} ({successInfo.branchName}) {t('via_google_maps', 'عبر Google Maps')}
              </Button>
            </a>
          ) : (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full h-11 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
            >
              {t('book_new_appointment', 'حجز موعد جديد')}
            </Button>
          )}
        </div>
      </div>
    )
  }

  // ─────────────────────────────────────────────
  // 2. MULTI-STEP BOOKING FORM
  // ─────────────────────────────────────────────
  return (
    <div className="yalla-card p-6 sm:p-8 max-w-lg mx-auto bg-card border border-border shadow-xl rounded-3xl space-y-6 text-card-foreground" dir={dir}>
      
      {/* Stepper Header */}
      <div className="border-b border-border pb-5">
        <div className="flex items-center justify-between text-center relative px-2">
          <div className="absolute top-4 inset-x-8 h-0.5 bg-secondary -z-0">
            <div
              className="h-full bg-primary transition-all duration-300"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            />
          </div>

          {[
            { num: 1, label: t('step1_branch_info', 'الفرع والبيانات') },
            { num: 2, label: t('step2_service_type', 'نوع الكشف') },
            { num: 3, label: t('step3_confirm_pay', 'التأكيد والسداد') }
          ].map((s) => {
            const isCompleted = step > s.num
            const isCurrent = step === s.num
            return (
              <div key={s.num} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    isCurrent
                      ? 'bg-primary text-white ring-4 ring-primary/20 shadow-md'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-card border-2 border-border text-muted-foreground'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${isCurrent ? 'text-primary' : 'text-muted-foreground'}`}>
                  {s.label}
                </span>
              </div>
            )
          })}
        </div>
      </div>

      {/* STEP 1: Branch Selection + Basic Information */}
      {step === 1 && (
        <div className="space-y-5">
          {/* Section: Choose Nearest Branch (Phase 3) */}
          <div className="space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="font-bold text-base text-foreground flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-primary" />
                  {t('available_branches_nearest', 'اختار الفرع الأنسب ليك')}
                </h3>
                <p className="text-[11px] text-muted-foreground">{t('select_branch_desc', 'حدد فرع العيادة الأقرب لك لحجز دورك به')}</p>
              </div>

              {/* Geolocation Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFindNearestBranch}
                disabled={isLocating}
                className="h-8 text-[11px] font-bold text-primary border-primary/20 bg-primary/10 hover:bg-primary/20 rounded-xl shrink-0"
              >
                <Navigation className={`w-3.5 h-3.5 mx-1 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? t('locating_calculating', 'جاري الحساب...') : t('find_nearest_branch', 'اعرف أقرب فرع ليك')}
              </Button>
            </div>

            {locationError && (
              <p className="text-[11px] text-amber-700 bg-amber-500/10 p-2 rounded-lg">{locationError}</p>
            )}

            {/* Manual Area Filter if multiple areas exist */}
            {uniqueAreas.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAreaFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                    areaFilter === 'ALL' ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {t('all_filter', 'الكل')}
                </button>
                {uniqueAreas.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setAreaFilter(area)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      areaFilter === area ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                    }`}
                  >
                    {area}
                  </button>
                ))}
              </div>
            )}

            {/* Branch Cards */}
            <div className="space-y-2.5 max-h-60 overflow-y-auto pr-0.5">
              {sortedBranches.map((b) => {
                const isSelected = selectedBranchId === b.id
                const distance = branchDistances[b.id]
                return (
                  <div
                    key={b.id}
                    onClick={() => b.isOpen && setSelectedBranchId(b.id)}
                    className={`p-3.5 rounded-2xl border-2 transition-all cursor-pointer flex items-start justify-between gap-3 ${
                      isSelected
                        ? 'border-primary bg-primary/5 shadow-xs ring-2 ring-primary/20'
                        : b.isOpen
                        ? 'border-border hover:border-primary/40 bg-card text-card-foreground'
                        : 'border-border/60 bg-muted/40 opacity-60 cursor-not-allowed text-muted-foreground'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${b.isOpen ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                        <h4 className="font-black text-xs sm:text-sm text-foreground truncate">{b.name}</h4>
                        {distance && distance < 900 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-mono" dir="ltr">
                            ~ {distance} {t('distance_km', 'كم تقريباً')}
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-muted-foreground truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-muted-foreground shrink-0" />
                        <span>{b.area || b.city} • {b.address}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground">{t('phone_prefix', 'هاتف:')} <span dir="ltr">{b.phone}</span></p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        b.isOpen ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                      }`}>
                        {b.isOpen ? t('branch_available', 'متاح') : t('branch_closed', 'مغلق')}
                      </span>
                      {b.mapsLink && (
                        <a
                          href={b.mapsLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-primary hover:underline flex items-center gap-0.5"
                        >
                          <span>{t('view_map', 'الخريطة')}</span>
                          <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Section: Patient Fields */}
          <div className="space-y-3 pt-2 border-t border-border">
            <h4 className="text-xs font-black text-foreground">{t('patient_data_contact', 'بيانات المريض والتواصل')}</h4>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">{t('phone_whatsapp_label', 'رقم الهاتف (واتساب) *')}</Label>
              <PhoneInputWithCountry
                value={phone}
                onChange={(fullNumber, country, localNum) => {
                  setPhone(fullNumber)
                  setSelectedCountry(country)
                  const valid = validatePhoneNumber(localNum, country)
                  setPhoneError(!valid)
                  if (!valid) {
                    setPhoneErrorMsg(isRtl ? `يرجى إدخال رقم هاتف صحيح لـ ${country.nameAr} (${country.placeholder})` : 'Please enter a valid phone number')
                  } else {
                    setPhoneErrorMsg('')
                  }
                }}
                hasError={phoneError}
                errorMessage={phoneErrorMsg}
                size="md"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">{t('patient_full_name', 'اسم المريض ثلاثي *')}</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={isRtl ? 'مثال: محمد أحمد علي' : 'e.g. Mohamed Ahmed Ali'}
                className="h-11 text-sm rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-primary"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">{t('patient_age_label', 'السن (مطلوب للروشتة) *')}</Label>
              <Input
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="28"
                type="number"
                className={`h-11 text-sm rounded-xl bg-background border border-input text-foreground focus:ring-2 focus:ring-primary ${isRtl ? 'text-right' : 'text-left'}`}
                dir="ltr"
                required
              />
            </div>

            {/* Date Selection */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  {t('booking_day', 'يوم الحجز (مواعيد')} {selectedBranch?.name || t('branch', 'الفرع')})
                </Label>
                {selectedDate && (
                  <span className="text-[11px] font-bold text-primary">
                    {availableDays.find((d) => d.iso === selectedDate)?.label} ({availableDays.find((d) => d.iso === selectedDate)?.formattedDate})
                  </span>
                )}
              </div>

              {availableDays.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {availableDays.map((d) => {
                    const isSelected = selectedDate === d.iso
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => setSelectedDate(d.iso)}
                        className={`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 ${
                          isSelected
                            ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 ring-2 ring-primary/30'
                            : 'bg-card text-foreground border-border hover:border-primary hover:bg-primary/5'
                        }`}
                      >
                        <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-foreground'}`}>
                          {d.label}
                        </span>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-white/90' : 'text-muted-foreground font-mono'}`}>
                          {d.formattedDate}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-center text-xs text-amber-700 dark:text-amber-400 font-bold">
                  {t('no_available_times', 'لا توجد مواعيد متاحة للحجز بهذا الفرع حالياً. يرجى اختيار فرع آخر أو التواصل مع العيادة.')}
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handleNextStep1}
            className="w-full h-12 text-sm font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md mt-2"
          >
            {t('next_choose_service', 'التالي: اختيار الخدمة')}
            {isRtl ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
          </Button>
        </div>
      )}

      {/* STEP 2: Choose Service Type */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-foreground">{t('choose_exam_type', 'اختر نوع الكشف والخدمة')}</h3>
            <p className="text-xs text-muted-foreground">
              {t('services_of_branch', 'خدمات فرع:')} <strong>{selectedBranch?.name}</strong>
            </p>
          </div>

          <div className="space-y-3">
            {availableServices.map((service) => {
              const isSelected = selectedServiceId === service.id
              return (
                <div
                  key={service.id}
                  onClick={() => setSelectedServiceId(service.id)}
                  className={`p-4 rounded-2xl border-2 transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isSelected
                      ? 'border-primary bg-primary/5 shadow-xs'
                      : 'border-border hover:border-primary/50 bg-card'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-primary bg-primary' : 'border-border'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-foreground">{service.name}</h4>
                        {service.name.includes('مستعجل') && (
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/20 text-[10px] font-bold">
                            {t('urgent_priority_badge', 'أولوية في الدور')}
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {service.description || service.desc || 'كشف طبي شامل'} • {service.duration || 'حوالي 15 دقيقة'}
                      </p>
                    </div>
                  </div>

                  <span className="text-sm font-black text-primary shrink-0">
                    {Number(service.price || 250).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {t('egp', 'ج.م')}
                  </span>
                </div>
              )
            })}
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              onClick={handleNextStep2}
              className="flex-1 h-12 text-sm font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md"
            >
              {t('next_confirm_pay', 'التالي: التأكيد والدفع')}
              {isRtl ? <ArrowLeft className="w-4 h-4 mr-2" /> : <ArrowRight className="w-4 h-4 ml-2" />}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="h-12 px-5 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
            >
              {t('back', 'رجوع')}
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirmation & Payment */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-foreground">{t('booking_confirm_and_pay', 'تأكيد الحجز وطريقة الدفع')}</h3>
            <p className="text-xs text-muted-foreground">{t('review_details_hint', 'راجع تفاصيل الموعد وطريقة التحويل')}</p>
          </div>

          {/* Booking Summary Box */}
          <div className="p-4 rounded-2xl bg-secondary/40 border border-border space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground font-bold">{t('selected_branch', 'الفرع المختار:')}</span>
              <span className="font-bold text-foreground">{selectedBranch?.name} ({selectedBranch?.city || selectedBranch?.area})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground font-bold">{t('patient', 'المريض:')}</span>
              <span className="font-bold text-foreground">{name} ({phone})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground font-bold">{t('service', 'الخدمة:')}</span>
              <span className="font-bold text-foreground">{selectedService.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-border">
              <span className="text-muted-foreground font-bold">{t('exam_date', 'تاريخ الكشف:')}</span>
              <span className="font-bold font-mono text-foreground">{selectedDate}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-foreground font-bold">{t('total_due', 'الإجمالي المستحق:')}</span>
              <span className="font-black text-lg text-primary">
                {selectedService?.price !== undefined && selectedService?.price !== null && selectedService?.price !== ''
                  ? `${Number(selectedService.price).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} ${t('egp', 'ج.م')}`
                  : `250 ${t('egp', 'ج.م')}`}
              </span>
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-foreground">{t('payment_method_label', 'طريقة السداد')}</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'border-primary bg-primary/10 text-primary font-black'
                    : 'border-border bg-card text-foreground font-bold hover:bg-secondary'
                }`}
              >
                <Banknote className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">{t('cash_at_clinic', 'كاش بالعيادة')}</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('instapay')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMethod === 'instapay'
                    ? 'border-primary bg-primary/10 text-primary font-black'
                    : 'border-border bg-card text-foreground font-bold hover:bg-secondary'
                }`}
              >
                <CreditCard className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">InstaPay</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('wallet')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMethod === 'wallet'
                    ? 'border-primary bg-primary/10 text-primary font-black'
                    : 'border-border bg-card text-foreground font-bold hover:bg-secondary'
                }`}
              >
                <Wallet className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">{t('e_wallet', 'محفظة إلكترونية')}</span>
              </button>
            </div>
          </div>

          {/* InstaPay Transfer Info & Proof */}
          {paymentMethod === 'instapay' && (
            <div className="p-4 rounded-2xl bg-primary/5 border-2 border-primary/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-primary">
                  <CreditCard className="w-4 h-4 text-primary" />
                  <span>{t('instapay_details_for_branch', 'بيانات التحويل عبر InstaPay للفرع:')}</span>
                </div>
                <Badge className="bg-primary text-white border-none font-bold text-[10px]">
                  {t('pending_confirmation', 'في انتظار التأكيد')}
                </Badge>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold">{t('instapay_handle_label', 'عنوان / رقم InstaPay:')}</span>
                  <span className="font-mono font-black text-sm text-foreground select-all bg-secondary px-2.5 py-1 rounded-lg border border-border" dir="ltr">
                    {clinic.instapayHandle || selectedBranch?.phone || clinic.doctorPhone || 'يرجى التواصل مع الفرع'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-border">
                  <span className="text-muted-foreground font-bold">{t('required_amount', 'المبلغ المطلوب للتحويل:')}</span>
                  <span className="font-black text-base text-primary">
                    {Number(selectedService?.price || 250).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {t('egp', 'ج.م')}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">{t('transfer_from_phone_or_account', 'رقم الهاتف أو الحساب المحول منه (إجباري) *')}</Label>
                <Input
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  placeholder="010xxxxxxxx / username@instapay"
                  className="h-11 text-xs bg-background rounded-xl border-input text-foreground"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">{t('ref_number_optional', 'الرقم المرجعي للمعاملة (اختياري)')}</Label>
                <Input
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  placeholder={isRtl ? 'رقم المعاملة في تطبيق انستاباي' : 'Transaction Reference'}
                  className="h-10 text-xs bg-background rounded-xl border-input text-foreground"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">{t('upload_proof_optional', 'رفع صورة إيصال التحويل (اختياري)')}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptProofUpload}
                  className="h-10 text-xs bg-background rounded-xl border-input text-foreground file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-primary/10 file:text-primary"
                />
              </div>

              <div className="p-2.5 bg-primary/10 rounded-xl text-[11px] text-primary font-medium leading-relaxed">
                💡 {t('instapay_hint', 'سيتم إدراجك في دور اليوم فوراً، وستظهر حالة الدفع "في انتظار تأكيد الدفع" حتى يراجعها موظف الاستقبال.')}
              </div>
            </div>
          )}

          {/* Wallet Transfer Info & Proof */}
          {paymentMethod === 'wallet' && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border-2 border-amber-500/20 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-700 dark:text-amber-400">
                  <Wallet className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                  <span>{t('wallet_details_label', 'بيانات التحويل عبر المحفظة الإلكترونية (فودافون كاش / أورنج / إتصالات):')}</span>
                </div>
                <Badge className="bg-amber-600 text-white border-none font-bold text-[10px]">
                  {t('pending_confirmation', 'في انتظار التأكيد')}
                </Badge>
              </div>

              <div className="p-3 bg-card rounded-xl border border-border space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-muted-foreground font-bold">{t('wallet_number_label', 'رقم محفظة الفرع / العيادة:')}</span>
                  <span className="font-mono font-black text-sm text-foreground select-all bg-secondary px-2.5 py-1 rounded-lg border border-border" dir="ltr">
                    {clinic.walletNumber || selectedBranch?.phone || clinic.doctorPhone || 'يرجى التواصل مع الفرع'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-border">
                  <span className="text-muted-foreground font-bold">{t('required_amount', 'المبلغ المطلوب للتحويل:')}</span>
                  <span className="font-black text-base text-primary">
                    {Number(selectedService?.price || 250).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {t('egp', 'ج.م')}
                  </span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">{t('wallet_from_label', 'رقم المحفظة المحول منها (إجباري) *')}</Label>
                <PhoneInputWithCountry
                  value={transferNumber}
                  onChange={(fullNumber) => setTransferNumber(fullNumber)}
                  size="sm"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">{t('upload_proof_optional', 'رفع صورة إيصال أو رسالة التحويل (اختياري)')}</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptProofUpload}
                  className="h-10 text-xs bg-background rounded-xl border-input text-foreground file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-amber-500/10 file:text-amber-700 dark:file:text-amber-400"
                />
              </div>

              <div className="p-2.5 bg-amber-500/10 rounded-xl text-[11px] text-amber-700 dark:text-amber-400 font-medium leading-relaxed">
                💡 {t('wallet_hint', 'سيتم إدراجك في دور اليوم فوراً، وستظهر حالة الدفع "في انتظار تأكيد الدفع" حتى يراجعها موظف الاستقبال.')}
              </div>
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button
              onClick={handleBooking}
              disabled={isBooking}
              className="flex-1 h-12 text-sm font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg"
            >
              {isBooking ? t('confirming_booking', 'جاري تأكيد الحجز...') : t('final_confirm_booking', 'تأكيد الحجز النهائي')}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="h-12 px-5 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
            >
              {t('back', 'رجوع')}
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}
