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
  ExternalLink, Upload, AlertCircle
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
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [name, setName] = useState(defaultName)
  const [phone, setPhone] = useState(defaultPhone)
  const [age, setAge] = useState(defaultAge)
  const [dob, setDob] = useState('')

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
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
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
      const dayNameAr = dayNamesAr[dayIndex]

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

      let label = dayNameAr
      if (i === 0) label = 'اليوم'
      else if (i === 1) label = 'غداً'

      const formattedDate = `${d.getDate()} ${monthNamesAr[d.getMonth()]}`

      list.push({ iso, label, formattedDate })

      // Show up to 6 active available days
      if (list.length >= 6) break
    }

    return list
  }, [selectedBranch, clinic?.weeklySchedule, clinic?.maxDailyBookings, dailyBookingCounts])

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
        return toast.error('حجم الصورة كبير، يرجى اختيار صورة أقل من 4 ميجابايت')
      }
      const reader = new FileReader()
      reader.onload = () => {
        setTransferProofUrl(reader.result as string)
        toast.success('تم إرفاق إيصال التحويل بنجاح!')
      }
      reader.readAsDataURL(file)
    }
  }

  // Step 1 Validation
  const handleNextStep1 = () => {
    if (!selectedBranch) return toast.error('يرجى اختيار فرع العيادة أولاً')
    if (selectedBranch.isOpen === false) return toast.error('هذا الفرع مغلق حالياً، يرجى اختيار فرع آخر')
    if (!name.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!phone.trim() || phone.length < 10) return toast.error('يرجى إدخال رقم هاتف صحيح')
    if (!age.trim()) return toast.error('يرجى إدخال السن')
    if (!selectedDate) return toast.error('يرجى اختيار يوم الحجز')

    setStep(2)
  }

  // Step 2 Validation
  const handleNextStep2 = () => {
    setStep(3)
  }

  // Final Booking Submit
  const handleBooking = async () => {
    if (paymentMethod !== 'cash' && !transferNumber.trim()) {
      return toast.error('يرجى كتابة رقم الهاتف أو المعاملة المحول منها لتأكيد الحجز')
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
      <div className="medical-card p-6 sm:p-8 max-w-lg mx-auto text-center space-y-6 shadow-2xl bg-white border border-[#E5EAF0] rounded-3xl" dir="rtl">
        <div className="w-20 h-20 bg-teal-50 border-4 border-teal-100 text-[#15B8A6] rounded-full flex items-center justify-center mx-auto shadow-md">
          <CheckCircle2 className="w-10 h-10" />
        </div>

        <div>
          <h2 className="text-2xl font-black text-[#182230]">تم تسجيل حجزك بنجاح</h2>
          <p className="text-xs text-slate-400 mt-1">
            مرحباً {name}، تم إدراجك في قائمة كشوفات اليوم لدى: <strong>{successInfo.branchName}</strong>
          </p>
        </div>

        {/* Big Queue Number Card */}
        <div className="bg-[#F8FAFC] border border-[#E5EAF0] rounded-3xl p-6 space-y-2">
          <p className="text-xs font-bold text-slate-400">رقمك في دور الفرع</p>
          <div className="text-6xl font-black text-[#15B8A6] tracking-tight">
            #{successInfo.queueNumber}
          </div>
          <p className="text-[11px] font-bold text-slate-500">{successInfo.branchName}</p>
        </div>

        {/* Estimation Details Grid */}
        <div className="grid grid-cols-2 gap-3 text-right">
          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">حالة الدفع</span>
            <p className="text-xs font-black text-[#182230]">
              {paymentMethod === 'cash' ? 'نقداً عند الحضور' : 'بانتظار تأكيد الإدارة'}
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-1">
            <span className="text-[11px] font-bold text-slate-400">وقت الانتظار المتوقع</span>
            <p className="text-sm font-black text-[#15B8A6]">حوالي {successInfo.aheadCount * 15} دقيقة</p>
          </div>
        </div>

        <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs font-bold flex items-center justify-center gap-2">
          <Users className="w-4 h-4 text-amber-600" />
          <span>يوجد {successInfo.aheadCount} مرضى قبلك في انتظار الدخول بالفرع</span>
        </div>

        {/* Action CTAs */}
        <div className="space-y-2.5 pt-2">
          <Link
            href={`/clinic/${clinic.slug}/track/${successInfo.trackingId}`}
            className="block w-full"
          >
            <Button className="w-full h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/25">
              تابع الحجز وإشعار اقتراب الدور مباشرة
            </Button>
          </Link>

          {selectedBranch?.mapsLink ? (
            <a href={selectedBranch.mapsLink} target="_blank" rel="noreferrer" className="block w-full">
              <Button variant="outline" className="w-full h-11 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:bg-slate-50 rounded-xl">
                <MapPin className="w-4 h-4 ml-1.5 text-[#15B8A6]" />
                موقع فرع ({successInfo.branchName}) عبر Google Maps
              </Button>
            </a>
          ) : (
            <Button
              variant="outline"
              onClick={() => window.location.reload()}
              className="w-full h-11 text-xs font-bold border-[#E5EAF0] text-slate-700 rounded-xl"
            >
              حجز موعد جديد
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
    <div className="medical-card p-6 sm:p-8 max-w-lg mx-auto bg-white border border-[#E5EAF0] shadow-xl rounded-3xl space-y-6" dir="rtl">
      
      {/* Stepper Header (1: الفرع والبيانات -> 2: نوع الكشف -> 3: التأكيد والدفع) */}
      <div className="border-b border-[#E5EAF0] pb-5">
        <div className="flex items-center justify-between text-center relative px-2">
          <div className="absolute top-4 inset-x-8 h-0.5 bg-slate-200 -z-0">
            <div
              className="h-full bg-[#15B8A6] transition-all duration-300"
              style={{ width: step === 1 ? '0%' : step === 2 ? '50%' : '100%' }}
            />
          </div>

          {[
            { num: 1, label: 'الفرع والبيانات' },
            { num: 2, label: 'نوع الكشف' },
            { num: 3, label: 'التأكيد والسداد' }
          ].map((s) => {
            const isCompleted = step > s.num
            const isCurrent = step === s.num
            return (
              <div key={s.num} className="flex flex-col items-center relative z-10">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-black transition-all ${
                    isCurrent
                      ? 'bg-[#15B8A6] text-white ring-4 ring-teal-100 shadow-md'
                      : isCompleted
                      ? 'bg-emerald-600 text-white'
                      : 'bg-white border-2 border-slate-300 text-slate-400'
                  }`}
                >
                  {isCompleted ? <CheckCircle2 className="w-4 h-4" /> : s.num}
                </div>
                <span className={`text-[11px] font-bold mt-1.5 ${isCurrent ? 'text-[#15B8A6]' : 'text-slate-400'}`}>
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
                <h3 className="font-bold text-base text-[#182230] flex items-center gap-1.5">
                  <Building2 className="w-4 h-4 text-[#15B8A6]" />
                  اختار الفرع الأنسب ليك
                </h3>
                <p className="text-[11px] text-slate-400">حدد فرع العيادة الأقرب لك لحجز دورك به</p>
              </div>

              {/* Geolocation Button */}
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFindNearestBranch}
                disabled={isLocating}
                className="h-8 text-[11px] font-bold text-teal-700 border-teal-200 bg-teal-50 hover:bg-teal-100 rounded-xl shrink-0"
              >
                <Navigation className={`w-3.5 h-3.5 ml-1 ${isLocating ? 'animate-spin' : ''}`} />
                {isLocating ? 'جاري الحساب...' : 'اعرف أقرب فرع ليك'}
              </Button>
            </div>

            {locationError && (
              <p className="text-[11px] text-amber-700 bg-amber-50 p-2 rounded-lg">{locationError}</p>
            )}

            {/* Manual Area Filter if multiple areas exist */}
            {uniqueAreas.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 text-xs">
                <button
                  type="button"
                  onClick={() => setAreaFilter('ALL')}
                  className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                    areaFilter === 'ALL' ? 'bg-[#0B1F33] text-white' : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  الكل
                </button>
                {uniqueAreas.map((area) => (
                  <button
                    key={area}
                    type="button"
                    onClick={() => setAreaFilter(area)}
                    className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition-all ${
                      areaFilter === area ? 'bg-[#15B8A6] text-white' : 'bg-slate-100 text-slate-600'
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
                        ? 'border-[#15B8A6] bg-teal-50/40 shadow-xs ring-2 ring-[#15B8A6]/20'
                        : b.isOpen
                        ? 'border-[#E5EAF0] hover:border-slate-300 bg-white'
                        : 'border-slate-200 bg-slate-50 opacity-60 cursor-not-allowed'
                    }`}
                  >
                    <div className="space-y-1 flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className={`w-2.5 h-2.5 rounded-full ${b.isOpen ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                        <h4 className="font-black text-xs sm:text-sm text-[#182230] truncate">{b.name}</h4>
                        {distance && distance < 900 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                            ~ {distance} كم
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500 truncate flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                        <span>{b.area || b.city} • {b.address}</span>
                      </p>
                      <p className="text-[10px] text-slate-400">هاتف: {b.phone}</p>
                    </div>

                    <div className="flex flex-col items-end gap-1.5 shrink-0">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                        b.isOpen ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                      }`}>
                        {b.isOpen ? 'متاح' : 'مغلق'}
                      </span>
                      {b.mapsLink && (
                        <a
                          href={b.mapsLink}
                          target="_blank"
                          rel="noreferrer"
                          onClick={(e) => e.stopPropagation()}
                          className="text-[10px] font-bold text-[#15B8A6] hover:underline flex items-center gap-0.5"
                        >
                          <span>الخريطة</span>
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
          <div className="space-y-3 pt-2 border-t border-slate-100">
            <h4 className="text-xs font-black text-slate-700">بيانات المريض والتواصل</h4>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">رقم الهاتف (واتساب) *</Label>
              <Input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="01012345678"
                type="tel"
                className="h-11 text-sm font-mono text-right rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
                dir="ltr"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">اسم المريض ثلاثي *</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="مثال: محمد أحمد علي"
                className="h-11 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">السن (مطلوب للروشتة) *</Label>
              <Input
                value={age}
                onChange={(e) => setAge(e.target.value)}
                placeholder="28"
                type="number"
                className="h-11 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
                required
              />
            </div>

            {/* Date Selection */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-[#15B8A6]" />
                  يوم الحجز (مواعيد {selectedBranch?.name || 'الفرع'})
                </Label>
                {selectedDate && (
                  <span className="text-[11px] font-bold text-[#15B8A6]">
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
                            ? 'bg-[#15B8A6] text-white border-[#15B8A6] shadow-md shadow-[#15B8A6]/20 ring-2 ring-[#15B8A6]/30'
                            : 'bg-white text-slate-700 border-[#E5EAF0] hover:border-[#15B8A6] hover:bg-teal-50/20'
                        }`}
                      >
                        <span className={`text-xs font-black ${isSelected ? 'text-white' : 'text-[#182230]'}`}>
                          {d.label}
                        </span>
                        <span className={`text-[10px] font-bold ${isSelected ? 'text-white/90' : 'text-slate-400 font-mono'}`}>
                          {d.formattedDate}
                        </span>
                      </button>
                    )
                  })}
                </div>
              ) : (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-800 font-bold">
                  لا توجد مواعيد متاحة للحجز بهذا الفرع حالياً. يرجى اختيار فرع آخر أو التواصل مع العيادة.
                </div>
              )}
            </div>
          </div>

          <Button
            onClick={handleNextStep1}
            className="w-full h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20 mt-2"
          >
            التالي: اختيار الخدمة
            <ArrowLeft className="w-4 h-4 mr-2" />
          </Button>
        </div>
      )}

      {/* STEP 2: Choose Service Type */}
      {step === 2 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-[#182230]">اختر نوع الكشف والخدمة</h3>
            <p className="text-xs text-slate-400">
              خدمات فرع: <strong>{selectedBranch?.name}</strong>
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
                      ? 'border-[#15B8A6] bg-teal-50/40 shadow-sm'
                      : 'border-[#E5EAF0] hover:border-slate-300 bg-white'
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                        isSelected ? 'border-[#15B8A6] bg-[#15B8A6]' : 'border-slate-300'
                      }`}
                    >
                      {isSelected && <div className="w-2 h-2 rounded-full bg-white" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h4 className="font-black text-sm text-[#182230]">{service.name}</h4>
                        {service.name.includes('مستعجل') && (
                          <Badge className="bg-amber-100 text-amber-800 border-none text-[10px] font-bold">
                            أولوية في الدور
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-slate-400 mt-0.5">
                        {service.description || service.desc || 'كشف طبي شامل'} • {service.duration || 'حوالي 15 دقيقة'}
                      </p>
                    </div>
                  </div>

                  {clinic.showPrices !== false && (
                    <span className="text-sm font-black text-[#15B8A6] shrink-0">
                      {service.price} ج.م
                    </span>
                  )}
                </div>
              )
            })}
          </div>

          <div className="flex gap-2.5 pt-2">
            <Button
              onClick={handleNextStep2}
              className="flex-1 h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20"
            >
              التالي: التأكيد والدفع
              <ArrowLeft className="w-4 h-4 mr-2" />
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(1)}
              className="h-12 px-5 text-xs font-bold border-[#E5EAF0] text-slate-700 rounded-xl"
            >
              رجوع
            </Button>
          </div>
        </div>
      )}

      {/* STEP 3: Confirmation & Payment (Phase 6) */}
      {step === 3 && (
        <div className="space-y-4">
          <div className="space-y-1">
            <h3 className="font-bold text-base text-[#182230]">تأكيد الحجز وطريقة الدفع</h3>
            <p className="text-xs text-slate-400">راجع تفاصيل الموعد وطريقة التحويل</p>
          </div>

          {/* Booking Summary Box */}
          <div className="p-4 rounded-2xl bg-[#F8FAFC] border border-[#E5EAF0] space-y-2 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400 font-bold">الفرع المختار:</span>
              <span className="font-bold text-teal-800">{selectedBranch?.name} ({selectedBranch?.city || selectedBranch?.area})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400 font-bold">المريض:</span>
              <span className="font-bold text-[#182230]">{name} ({phone})</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400 font-bold">الخدمة:</span>
              <span className="font-bold text-[#182230]">{selectedService.name}</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-400 font-bold">تاريخ الكشف:</span>
              <span className="font-bold font-mono text-[#182230]">{selectedDate}</span>
            </div>
            <div className="flex justify-between pt-1">
              <span className="text-slate-600 font-bold">الإجمالي المستحق:</span>
              {clinic.showPrices !== false ? (
                <span className="font-black text-base text-[#15B8A6]">{selectedService.price} ج.م</span>
              ) : (
                <span className="font-black text-base text-[#15B8A6]">يحدد بالعيادة</span>
              )}
            </div>
          </div>

          {/* Payment Method Selector */}
          <div className="space-y-2">
            <Label className="text-xs font-bold text-slate-600">طريقة السداد</Label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setPaymentMethod('cash')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMethod === 'cash'
                    ? 'border-[#15B8A6] bg-teal-50 text-[#15B8A6] font-black'
                    : 'border-[#E5EAF0] bg-white text-slate-600 font-bold'
                }`}
              >
                <Banknote className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">كاش بالعيادة</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('instapay')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMethod === 'instapay'
                    ? 'border-[#15B8A6] bg-teal-50 text-[#15B8A6] font-black'
                    : 'border-[#E5EAF0] bg-white text-slate-600 font-bold'
                }`}
              >
                <CreditCard className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">انستاباي</span>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('wallet')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  paymentMethod === 'wallet'
                    ? 'border-[#15B8A6] bg-teal-50 text-[#15B8A6] font-black'
                    : 'border-[#E5EAF0] bg-white text-slate-600 font-bold'
                }`}
              >
                <Wallet className="w-5 h-5 mx-auto mb-1" />
                <span className="text-xs">محفظة إلكترونية</span>
              </button>
            </div>
          </div>

          {/* InstaPay Transfer Info & Proof */}
          {paymentMethod === 'instapay' && (
            <div className="p-4 rounded-2xl bg-teal-50/70 border-2 border-teal-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-teal-800">
                  <CreditCard className="w-4 h-4 text-[#15B8A6]" />
                  <span>بيانات التحويل عبر InstaPay للفرع:</span>
                </div>
                <Badge className="bg-[#15B8A6] text-white border-none font-bold text-[10px]">
                  في انتظار التأكيد
                </Badge>
              </div>

              <div className="p-3 bg-white rounded-xl border border-teal-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">عنوان / رقم InstaPay:</span>
                  <span className="font-mono font-black text-sm text-[#182230] select-all bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200" dir="ltr">
                    {clinic.instapayHandle || selectedBranch?.phone || clinic.doctorPhone || 'يرجى التواصل مع الفرع'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 font-bold">المبلغ المطلوب:</span>
                  <span className="font-black text-base text-[#15B8A6]">{selectedService.price} ج.م</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">رقم الهاتف أو الحساب المحول منه (إجباري) *</Label>
                <Input
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  placeholder="مثال: 010xxxxxxxx أو username@instapay"
                  className="h-11 text-xs bg-white rounded-xl border-teal-200"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">الرقم المرجعي للمعاملة (اختياري)</Label>
                <Input
                  value={transferReference}
                  onChange={(e) => setTransferReference(e.target.value)}
                  placeholder="رقم المعاملة في تطبيق انستاباي"
                  className="h-10 text-xs bg-white rounded-xl border-teal-200"
                  dir="ltr"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">رفع صورة إيصال التحويل (اختياري)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptProofUpload}
                  className="h-10 text-xs bg-white rounded-xl file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-teal-50 file:text-[#0D9488]"
                />
              </div>

              <div className="p-2.5 bg-teal-100/60 rounded-xl text-[11px] text-teal-800 font-medium leading-relaxed">
                💡 سيتم إدراجك في دور اليوم فوراً، وستظهر حالة الدفع "في انتظار تأكيد الدفع" حتى يراجعها موظف الاستقبال.
              </div>
            </div>
          )}

          {/* Wallet Transfer Info & Proof */}
          {paymentMethod === 'wallet' && (
            <div className="p-4 rounded-2xl bg-amber-50/70 border-2 border-amber-200 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                  <Wallet className="w-4 h-4 text-amber-600" />
                  <span>بيانات التحويل عبر المحفظة الإلكترونية (فودافون كاش / أورنج / إتصالات):</span>
                </div>
                <Badge className="bg-amber-600 text-white border-none font-bold text-[10px]">
                  في انتظار التأكيد
                </Badge>
              </div>

              <div className="p-3 bg-white rounded-xl border border-amber-100 space-y-2">
                <div className="flex justify-between items-center text-xs">
                  <span className="text-slate-500 font-bold">رقم محفظة الفرع / العيادة:</span>
                  <span className="font-mono font-black text-sm text-[#182230] select-all bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200" dir="ltr">
                    {clinic.walletNumber || selectedBranch?.phone || clinic.doctorPhone || 'يرجى التواصل مع الفرع'}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs pt-1.5 border-t border-slate-100">
                  <span className="text-slate-500 font-bold">المبلغ المطلوب:</span>
                  <span className="font-black text-base text-[#15B8A6]">{selectedService.price} ج.م</span>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">رقم المحفظة المحول منها (إجباري) *</Label>
                <Input
                  value={transferNumber}
                  onChange={(e) => setTransferNumber(e.target.value)}
                  placeholder="010xxxxxxxx"
                  className="h-11 text-xs bg-white rounded-xl border-amber-200"
                  dir="ltr"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">رفع صورة إيصال أو رسالة التحويل (اختياري)</Label>
                <Input
                  type="file"
                  accept="image/*"
                  onChange={handleReceiptProofUpload}
                  className="h-10 text-xs bg-white rounded-xl file:mr-2 file:py-1 file:px-2 file:rounded-md file:border-0 file:text-xs file:bg-amber-50 file:text-amber-800"
                />
              </div>

              <div className="p-2.5 bg-amber-100/60 rounded-xl text-[11px] text-amber-900 font-medium leading-relaxed">
                💡 سيتم إدراجك في دور اليوم فوراً، وستظهر حالة الدفع "في انتظار تأكيد الدفع" حتى يراجعها موظف الاستقبال.
              </div>
            </div>
          )}

          <div className="flex gap-2.5 pt-2">
            <Button
              onClick={handleBooking}
              disabled={isBooking}
              className="flex-1 h-12 text-sm font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/25"
            >
              {isBooking ? 'جاري تأكيد الحجز...' : 'تأكيد الحجز النهائي'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setStep(2)}
              className="h-12 px-5 text-xs font-bold border-[#E5EAF0] text-slate-700 rounded-xl"
            >
              رجوع
            </Button>
          </div>
        </div>
      )}

    </div>
  )
}
