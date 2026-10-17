'use client'

import React, { useState, useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import {
  MapPin,
  Stethoscope,
  UserCheck,
  Calendar,
  ClipboardCheck,
  X,
  Check,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
  Clock,
  Loader2,
  ExternalLink,
  CreditCard,
  Banknote,
  Wallet,
  Copy
} from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { getClinicBranches, ensureClinicHasMainBranch } from '@/lib/branchService'
import { createClinicNotification } from '@/lib/notificationService'
import { toast } from 'sonner'
import Link from 'next/link'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import {
  CountryInfo,
  DEFAULT_COUNTRY,
  validatePhoneNumber,
  parsePhoneAndCountry
} from '@/lib/countryPhoneHelper'

export function BookingModal({
  clinic,
  services = [],
  branches: propBranches,
  initialService = null,
  initialBranch = null,
  onClose
}: {
  clinic: any
  services?: any[]
  branches?: any[]
  initialService?: any
  initialBranch?: any
  onClose: () => void
}) {
  const router = useRouter()
  const clinicId = clinic?.id || clinic?.slug || 'demo'
  const slug = clinic?.slug || 'zizo'

  // Price visibility setting
  const showPrices = clinic?.showPrices !== false && clinic?.hidePrices !== true

  // Step 1: Branch, 2: Service, 3: Date & Queue Estimate, 4: Patient Info, 5: Payment, 6: Review
  const [step, setStep] = useState<number>(1)

  // Default medical branch images (Hospital/Clinic building, NOT doctor photo)
  const defaultBranches = [
    {
      id: 'main',
      name: 'الفرع الرئيسي',
      sub: 'المقر الرئيسي',
      address: clinic?.clinicAddress || 'مقر العيادة الرئيسي',
      image: clinic?.branchImage || clinic?.clinicPhoto || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop',
      available: true
    },
    {
      id: 'tagamoa',
      name: 'التجمع الخامس',
      sub: 'التجمع الخامس',
      address: 'التجمع الخامس - القاهرة الجديدة',
      image: 'https://images.unsplash.com/photo-1586773860418-d37222d8fce3?q=80&w=600&auto=format&fit=crop',
      available: true
    },
    {
      id: 'zayed',
      name: 'الشيخ زايد',
      sub: 'الشيخ زايد',
      address: 'الشيخ زايد - الجيزة',
      image: 'https://images.unsplash.com/photo-1538108149393-fbbd81895907?q=80&w=600&auto=format&fit=crop',
      available: true
    }
  ]

  const fallbackMainImage =
    clinic?.branchImage ||
    clinic?.clinicPhoto ||
    'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop'

  // Pre-calculate initial branches synchronously for instant 0ms rendering
  const computeInitialBranches = () => {
    if (propBranches && propBranches.length > 0) {
      return propBranches.map((b: any) => ({
        ...b,
        image: b.image || b.imageUrl || fallbackMainImage
      }))
    }
    if (clinic?.branches && clinic.branches.length > 0) {
      return clinic.branches.map((b: any) => ({
        ...b,
        image: b.image || b.imageUrl || fallbackMainImage
      }))
    }
    return defaultBranches
  }

  const [branches, setBranches] = useState<any[]>(computeInitialBranches)
  const [selectedBranch, setSelectedBranch] = useState<any>(() => {
    if (initialBranch) return initialBranch
    const list = computeInitialBranches()
    return list[0]
  })

  // Synchronize or load in background without blocking modal interaction
  useEffect(() => {
    if (propBranches && propBranches.length > 0) {
      const mapped = propBranches.map((b: any) => ({
        ...b,
        image: b.image || b.imageUrl || fallbackMainImage
      }))
      setBranches(mapped)
      if (!selectedBranch || selectedBranch.id === 'main') {
        setSelectedBranch(initialBranch || mapped[0])
      }
      return
    }

    let isMounted = true
    const loadBranches = async () => {
      try {
        if (clinic?.id) {
          const dbBranches = await getClinicBranches(clinic.id).catch(() => [])
          const active = dbBranches.filter((b: any) => !b.isArchived)
          if (active.length > 0 && isMounted) {
            const mapped = active.map((b: any) => ({
              ...b,
              image: b.image || b.imageUrl || fallbackMainImage
            }))
            setBranches(mapped)
            if (!selectedBranch || selectedBranch.id === 'main') {
              setSelectedBranch(initialBranch || mapped[0])
            }
            return
          }
        }
        if (clinic?.branches && clinic.branches.length > 0 && isMounted) {
          const mapped = clinic.branches.map((b: any) => ({
            ...b,
            image: b.image || b.imageUrl || fallbackMainImage
          }))
          setBranches(mapped)
          if (!selectedBranch) {
            setSelectedBranch(initialBranch || mapped[0])
          }
        }
      } catch (e) {
        console.error('Error loading branches:', e)
      }
    }

    loadBranches()
    return () => {
      isMounted = false
    }
  }, [clinic?.id, initialBranch, propBranches])

  const defaultServices = services?.length
    ? services
    : clinic?.services?.length
    ? clinic.services
    : [
        { id: '1', name: 'كشف عادي', price: 250, duration: '15 دقيقة' },
        { id: '2', name: 'استشارة ومتابعة', price: 150, duration: '15 دقيقة' },
        { id: '3', name: 'كشف مستعجل / طوارئ', price: 400, duration: 'فوري مباشر', isUrgent: true }
      ]

  const [selectedService, setSelectedService] = useState<any>(initialService || defaultServices[0])

  // Max daily bookings quota
  const maxLimit = Number(selectedBranch?.maxDailyBookings || clinic?.maxDailyBookings) || 0
  const [dailyBookingCounts, setDailyBookingCounts] = useState<Record<string, number>>({})

  // Smart Date State (Today, Tomorrow, and Next 5 days or Today only based on clinic settings)
  const isTodayOnly = clinic?.bookingAvailability === 'today_only' || clinic?.allowFutureBookings === false

  const availableDays = useMemo(() => {
    const list: { iso: string; label: string; subLabel: string; isFull: boolean }[] = []
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]

    const branchSchedule = selectedBranch?.weeklySchedule || clinic?.weeklySchedule || []
    const maxDaysToScan = isTodayOnly ? 1 : 14
    const targetCount = isTodayOnly ? 1 : 6
    const now = new Date()

    for (let i = 0; i < maxDaysToScan; i++) {
      const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      d.setDate(d.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      const dayIndex = d.getDay()
      const dayKey = dayKeys[dayIndex]
      const dayName = dayNamesAr[dayIndex]
      const dayNum = d.getDate()
      const monthName = monthNamesAr[d.getMonth()]

      // Check weeklySchedule: if branch/clinic is closed on this day, SKIP
      if (branchSchedule && branchSchedule.length > 0) {
        const sched = branchSchedule.find((s: any) => (s.id || s.dayKey) === dayKey)
        if (sched && sched.isOpen === false) {
          continue
        }
      }

      let label = `${dayName}`
      if (i === 0) label = 'اليوم'
      else if (i === 1) label = 'غداً'

      const count = dailyBookingCounts[iso] || 0
      const isFull = maxLimit > 0 && count >= maxLimit

      list.push({
        iso,
        label,
        subLabel: `${dayNum} ${monthName}`,
        isFull
      })

      if (list.length >= targetCount) break
    }
    return list
  }, [dailyBookingCounts, maxLimit, isTodayOnly, selectedBranch?.weeklySchedule, clinic?.weeklySchedule])

  const [selectedDate, setSelectedDate] = useState<string>('')

  // Load daily counts for available days to enforce maxDailyBookings
  useEffect(() => {
    if (!clinicId) return
    let isCancelled = false

    const branchSchedule = selectedBranch?.weeklySchedule || clinic?.weeklySchedule || []
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const maxDaysToScan = isTodayOnly ? 1 : 14
    const targetCount = isTodayOnly ? 1 : 6
    const now = new Date()
    const daysToScan: string[] = []

    for (let i = 0; i < maxDaysToScan; i++) {
      const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      d.setDate(d.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      const dayIndex = d.getDay()
      const dayKey = dayKeys[dayIndex]

      if (branchSchedule && branchSchedule.length > 0) {
        const sched = branchSchedule.find((s: any) => (s.id || s.dayKey) === dayKey)
        if (sched && sched.isOpen === false) {
          continue
        }
      }

      daysToScan.push(iso)
      if (daysToScan.length >= targetCount) break
    }

    Promise.all(
      daysToScan.map(async (iso) => {
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', clinicId),
          where('date', '==', iso)
        )
        const snap = await getDocs(q)
        const active = snap.docs.filter((d) => d.data().status !== 'cancelled').length
        return { iso, count: active }
      })
    )
      .then((results) => {
        if (isCancelled) return
        const map: Record<string, number> = {}
        results.forEach((r) => {
          map[r.iso] = r.count
        })
        setDailyBookingCounts(map)

        // Select first available day if none selected or selected is full
        if (!selectedDate) {
          const firstAvail = results.find((r) => maxLimit === 0 || r.count < maxLimit) || results[0]
          if (firstAvail) setSelectedDate(firstAvail.iso)
        }
      })
      .catch((err) => console.warn('Error fetching daily booking counts:', err))

    return () => {
      isCancelled = true
    }
  }, [clinicId, maxLimit, isTodayOnly, selectedBranch?.weeklySchedule, clinic?.weeklySchedule])

  // Live estimated queue & wait time calculation
  const [estimatedQueueNumber, setEstimatedQueueNumber] = useState<number>(1)
  const [estimatedWaitMins, setEstimatedWaitMins] = useState<number>(0)
  const [isEstimating, setIsEstimating] = useState<boolean>(false)

  useEffect(() => {
    if (!selectedDate || !clinicId) return
    let isCancelled = false
    setIsEstimating(true)

    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', selectedDate)
    )

    getDocs(q)
      .then((snap) => {
        if (isCancelled) return
        const existingNums = snap.docs.map((d) => Number(d.data().queue_number) || 0)
        const maxQueue = existingNums.length > 0 ? Math.max(0, ...existingNums) : 0
        const nextQueue = maxQueue + 1

        const waitingAhead = snap.docs.filter(
          (d) => d.data().status === 'waiting' || !d.data().status
        ).length
        const avgMins = Number(clinic?.averageVisitTime) || 15

        setEstimatedQueueNumber(nextQueue)
        setEstimatedWaitMins(waitingAhead * avgMins)
      })
      .catch((e) => console.warn('Error fetching estimated queue:', e))
      .finally(() => {
        if (!isCancelled) setIsEstimating(false)
      })

    return () => {
      isCancelled = true
    }
  }, [clinicId, selectedDate, clinic?.averageVisitTime])

  // Patient Form State (No birthdate - only name, phone, age, gender)
  const [patientName, setPatientName] = useState<string>('')
  const [patientPhone, setPatientPhone] = useState<string>('')
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(DEFAULT_COUNTRY)
  const [age, setAge] = useState<string>('')
  const [gender, setGender] = useState<'ذكر' | 'أنثى'>('أنثى')
  const [phoneError, setPhoneError] = useState<boolean>(false)
  const [phoneErrorMsg, setPhoneErrorMsg] = useState<string>('')

  // Payment Method State
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'wallet'>('cash')
  const [transferAccount, setTransferAccount] = useState<string>('')
  const [isCopied, setIsCopied] = useState<boolean>(false)

  const [submitting, setSubmitting] = useState<boolean>(false)
  const [bookingSuccess, setBookingSuccess] = useState<{
    appointmentId: string
    queueNumber: number
    aheadCount: number
    branchName: string
    date: string
    paymentMethod: string
  } | null>(null)

  // Auto-fill from authenticated patient session if available
  useEffect(() => {
    try {
      const raw = localStorage.getItem('patient_auth')
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed.name && !patientName) setPatientName(parsed.name)
        if (parsed.phone && !patientPhone) {
          setPatientPhone(parsed.phone)
          const p = parsePhoneAndCountry(parsed.phone)
          if (p.country) setSelectedCountry(p.country)
        }
        if (parsed.age && !age) setAge(parsed.age)
      }
    } catch (e) {
      console.warn('Could not read existing patient session:', e)
    }
  }, [])

  const validatePhoneInput = (val: string, country: CountryInfo = selectedCountry, isFinalCheck = false) => {
    const valid = validatePhoneNumber(val, country)
    const digitsOnly = val.replace(/[^0-9]/g, '')
    if (valid) {
      setPhoneError(false)
      setPhoneErrorMsg('')
    } else if (isFinalCheck || digitsOnly.length >= (country.minLength || 9)) {
      setPhoneError(true)
      setPhoneErrorMsg(`يرجى إدخال رقم هاتف محمول صحيح لـ ${country.nameAr} (${country.placeholder})`)
    } else {
      setPhoneError(false)
      setPhoneErrorMsg('')
    }
    return valid
  }

  const handleCopyText = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    toast.success('تم النسخ إلى الحافظة بنجاح')
    setTimeout(() => setIsCopied(false), 2000)
  }

  const handleNext = async () => {
    if (step === 1) {
      if (!selectedBranch && branches.length > 0) {
        setSelectedBranch(branches[0])
      }
      setStep(2)
      return
    }

    if (step === 2) {
      if (!selectedService && defaultServices.length > 0) {
        setSelectedService(defaultServices[0])
      }
      setStep(3)
      return
    }

    if (step === 3) {
      if (!selectedDate) {
        toast.error('يرجى اختيار يوم الحجز')
        return
      }
      const dayCount = dailyBookingCounts[selectedDate] || 0
      if (maxLimit > 0 && dayCount >= maxLimit) {
        toast.error(`عذراً، اكتمل الحد الأقصى لحجوزات هذا اليوم (${maxLimit} كشف). يرجى اختيار يوم آخر.`)
        return
      }
      setStep(4)
      return
    }

    if (step === 4) {
      if (!patientName.trim()) {
        toast.error('يرجى إدخال اسم المريض بالكامل')
        return
      }
      if (!patientPhone.trim() || !validatePhoneInput(patientPhone, selectedCountry, true)) {
        toast.error(`يرجى إدخال رقم هاتف محمول صحيح لـ ${selectedCountry.nameAr}`)
        setPhoneError(true)
        return
      }
      setStep(5)
      return
    }

    if (step === 5) {
      if ((paymentMethod === 'instapay' || paymentMethod === 'wallet') && !transferAccount.trim()) {
        toast.error(paymentMethod === 'instapay' ? 'يرجى إدخال اسم الحساب أو رقم الهاتف المحول منه' : 'يرجى إدخال رقم المحفظة المحول منها')
        return
      }
      setStep(6)
      return
    }

    // STEP 6: Final Submission to Firestore
    setSubmitting(true)
    try {
      const cleanPhone = patientPhone.trim().replace(/\s+/g, '')
      const branchId = selectedBranch?.id || null
      const branchName = selectedBranch?.name || 'الفرع الرئيسي'

      // Check max daily bookings quota directly from DB
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId),
        where('date', '==', selectedDate)
      )
      const qSnap = await getDocs(q)
      const activeAppts = qSnap.docs.filter((d) => d.data().status !== 'cancelled')

      if (maxLimit > 0 && activeAppts.length >= maxLimit) {
        toast.error(`عذراً، اكتمل الحد الأقصى للحجوزات لهذا اليوم (${maxLimit} كشف). يرجى اختيار يوم آخر.`)
        setSubmitting(false)
        return
      }

      // Strictly sequential queue number: max + 1
      const existingQueueNums = qSnap.docs.map((d) => Number(d.data().queue_number) || 0)
      const maxQueue = existingQueueNums.length > 0 ? Math.max(0, ...existingQueueNums) : 0
      const myQueueNumber = maxQueue + 1

      let waitingCount = 0
      qSnap.docs.forEach((docSnap) => {
        const st = docSnap.data().status
        if (st === 'waiting' || !st) waitingCount++
      })

      const serviceName = selectedService?.name || 'كشف عادي'
      const isUrgent =
        selectedService?.isUrgent ||
        serviceName.includes('مستعجل') ||
        serviceName.includes('طوارئ') ||
        String(selectedService?.id) === '3'

      const isOnlinePay = paymentMethod === 'instapay' || paymentMethod === 'wallet'
      const paymentStatus = isOnlinePay ? 'pending_verification' : 'unpaid'

      const newAppt = {
        clinic_id: clinicId,
        branch_id: branchId,
        branchName: branchName,
        patientName: patientName.trim(),
        phone: cleanPhone,
        age: age.trim() || null,
        gender: gender || 'أنثى',
        serviceId: selectedService?.id || '1',
        serviceName: serviceName,
        servicePrice: selectedService?.price || 0,
        isUrgent,
        date: selectedDate,
        queue_number: myQueueNumber,
        status: 'waiting',
        paymentMethod,
        paymentStatus,
        paymentDetails: transferAccount.trim() ? { senderAccount: transferAccount.trim() } : null,
        createdAt: new Date().toISOString()
      }

      const docRef = await addDoc(collection(db, 'appointments'), newAppt)

      // Auto ensure patient account exists for frictionless patient portal access
      try {
        const accQ = query(
          collection(db, 'patient_accounts'),
          where('clinic_id', '==', clinicId),
          where('phone', '==', cleanPhone)
        )
        const accSnap = await getDocs(accQ)
        if (accSnap.empty) {
          await addDoc(collection(db, 'patient_accounts'), {
            clinic_id: clinicId,
            name: patientName.trim(),
            phone: cleanPhone,
            age: age.trim() || null,
            gender: gender || 'أنثى',
            createdAt: new Date().toISOString()
          })
        }
      } catch (e) {
        console.warn('Could not auto-provision patient account:', e)
      }

      // Auto-login patient session
      try {
        localStorage.setItem(
          'patient_auth',
          JSON.stringify({
            name: patientName.trim(),
            phone: cleanPhone,
            age: age.trim(),
            gender: gender || 'أنثى',
            clinicSlug: slug,
            clinicId
          })
        )
      } catch (e) {
        console.warn('Could not write patient session:', e)
      }

      createClinicNotification({
        clinicId,
        branchId: branchId,
        recipientType: 'patient',
        recipientTarget: cleanPhone,
        title: 'تم تسجيل حجزك بنجاح',
        body: `مرحباً ${patientName.trim()}، تم تأكيد حجزك في فرع "${branchName}" برقم دور #${myQueueNumber} لتاريخ ${selectedDate}.`,
        type: 'booking_confirmed',
        appointmentId: docRef.id
      }).catch(() => {})

      toast.success(`تم تأكيد الحجز بنجاح! رقم دورك: #${myQueueNumber}`)
      setBookingSuccess({
        appointmentId: docRef.id,
        queueNumber: myQueueNumber,
        aheadCount: waitingCount,
        branchName: branchName,
        date: selectedDate,
        paymentMethod: paymentMethod === 'cash' ? 'كاش بالعيادة' : paymentMethod === 'instapay' ? 'InstaPay' : 'محفظة إلكترونية'
      })
    } catch (err: any) {
      console.error('Booking submission error:', err)
      toast.error('حدث خطأ أثناء إتمام الحجز، يرجى المحاولة ثانيةً')
    } finally {
      setSubmitting(false)
    }
  }

  const stepsMeta = [
    { id: 1, label: 'الفرع', Icon: MapPin },
    { id: 2, label: 'الخدمة', Icon: Stethoscope },
    { id: 3, label: 'الموعد', Icon: Calendar },
    { id: 4, label: 'بيانات المريض', Icon: UserCheck },
    { id: 5, label: 'طريقة الدفع', Icon: CreditCard },
    { id: 6, label: 'تأكيد الحجز', Icon: ClipboardCheck }
  ]

  // Clinic payment credentials
  const clinicInstapayHandle = clinic?.instapayHandle || clinic?.instapayAccount || clinic?.clinicPhone || '01121320507'
  const clinicWalletNumber = clinic?.walletNumber || clinic?.vodafoneCashNumber || clinic?.clinicPhone || '01121320507'

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-md flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-[440px] bg-gradient-to-b from-white via-sky-50/30 to-sky-50/70 dark:from-[#081526] dark:to-[#050d1a] rounded-[36px] p-6 shadow-2xl border border-sky-100 dark:border-slate-800 space-y-5 my-auto">
        {/* Header */}
        <div className="flex items-center justify-between">
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
          <div dir="ltr" className="shrink-0">
            <ClinicLogo size="md" variant="auto" />
          </div>
          <div className="w-9" />
        </div>

        <div className="text-center">
          <h3 className="text-xl font-black text-slate-900 dark:text-white">حجز موعد جديد</h3>
          {clinic?.clinicName && (
            <p className="text-xs font-bold text-sky-600 dark:text-sky-400 mt-0.5">{clinic.clinicName}</p>
          )}
        </div>

        {/* 6-Step Stepper */}
        <div className="flex items-center justify-between relative px-1">
          <div className="absolute top-4 left-6 right-6 h-0.5 bg-slate-200 dark:bg-slate-700 -z-0" />
          {stepsMeta.map(({ id, label, Icon }) => {
            const active = step === id
            const done = step > id
            return (
              <button
                key={id}
                type="button"
                onClick={() => id < step && setStep(id)}
                className="relative z-10 flex flex-col items-center gap-1 cursor-pointer"
              >
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-xs transition-all ${
                    done
                      ? 'bg-emerald-500 text-white shadow'
                      : active
                      ? 'bg-sky-600 text-white shadow-lg ring-4 ring-sky-500/20'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {done ? <Check className="w-3.5 h-3.5" /> : <Icon className="w-3.5 h-3.5" />}
                </div>
                <span className={`text-[9px] font-bold ${active ? 'text-sky-600 dark:text-sky-400 font-extrabold' : 'text-slate-400'}`}>
                  {label}
                </span>
              </button>
            )
          })}
        </div>

        {/* Step Content */}
        {bookingSuccess ? (
          <div className="p-5 rounded-3xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-center space-y-4">
            <div className="w-14 h-14 rounded-full bg-emerald-500 text-white flex items-center justify-center mx-auto text-2xl shadow-lg shadow-emerald-500/20">
              <Check className="w-7 h-7" />
            </div>
            <div>
              <h4 className="text-lg font-black text-slate-900 dark:text-white">تم تأكيد حجزك بنجاح!</h4>
              <p className="text-xs text-slate-600 dark:text-slate-300 mt-1">
                فرع: <strong>{bookingSuccess.branchName}</strong> • {bookingSuccess.date}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white dark:bg-slate-900/80 border border-emerald-100 dark:border-emerald-800/60 space-y-2">
              <div className="text-xs font-bold text-slate-500">رقم دورك المعتمد</div>
              <div className="text-4xl font-black text-sky-600 dark:text-sky-400 font-mono">
                #{bookingSuccess.queueNumber}
              </div>
              <div className="text-[11px] text-slate-400">
                {bookingSuccess.aheadCount === 0
                  ? 'أنت الأول في قائمة الانتظار لهذا اليوم'
                  : `يوجد ${bookingSuccess.aheadCount} في قائمة الانتظار أمامك`}
              </div>
              <div className="text-[11px] font-bold text-sky-600 dark:text-sky-400 pt-1 border-t border-slate-100 dark:border-slate-800">
                طريقة الدفع: {bookingSuccess.paymentMethod}
              </div>
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href={`/clinic/${slug}/track/${bookingSuccess.appointmentId}`}
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-xs flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                <span>متابعة وتتبع الدور المباشر</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
              <Link
                href={`/clinic/${slug}/patient`}
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-sky-200 dark:border-slate-700 text-sky-700 dark:text-sky-300 font-bold text-xs hover:bg-sky-50 flex items-center justify-center gap-1.5 transition-colors"
              >
                <UserCheck className="w-4 h-4" />
                <span>الدخول إلى بوابتي الطبية</span>
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2 rounded-2xl bg-slate-100 dark:bg-slate-800/60 text-slate-500 font-bold text-xs hover:bg-slate-200 transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        ) : (
          <div className="min-h-[290px] flex flex-col justify-between">
            {/* STEP 1: BRANCH SELECTION (Using Facility Photo, never doctor portrait) */}
            {step === 1 && (
              <div className="space-y-4">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر الفرع المناسب</h4>
                <div className="grid grid-cols-3 gap-2.5">
                  {branches.map((b: any) => {
                    const isSelected = selectedBranch?.id === b.id || selectedBranch?.name === b.name
                    return (
                      <div
                        key={b.id || b.name}
                        onClick={() => setSelectedBranch(b)}
                        className={`cursor-pointer rounded-2xl p-2 bg-white dark:bg-slate-800 border-2 ${
                          isSelected ? 'border-sky-500 shadow-md ring-2 ring-sky-400/30' : 'border-slate-100 dark:border-slate-700'
                        } flex flex-col items-center text-center relative transition-all hover:-translate-y-1`}
                      >
                        <div className="w-full h-20 rounded-xl overflow-hidden mb-2 bg-sky-100 dark:bg-slate-700 relative">
                          {b.image ? (
                            <img
                              src={b.image}
                              alt={b.name}
                              loading="eager"
                              decoding="async"
                              className="w-full h-full object-cover transition-transform duration-300"
                            />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center text-sky-400">
                              <MapPin className="w-6 h-6 opacity-60" />
                            </div>
                          )}
                        </div>
                        <div className="font-black text-slate-900 dark:text-white text-[11px] leading-tight">{b.name}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{b.sub || b.address}</div>
                        <span className="mt-2 px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold border border-emerald-200 dark:border-emerald-800">
                          متاح اليوم
                        </span>
                        {isSelected && (
                          <span className="absolute -bottom-2 -right-2 w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] shadow">
                            <Check className="w-3 h-3" />
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: SERVICE SELECTION (Respecting clinic hidePrices setting) */}
            {step === 2 && (
              <div className="space-y-2.5">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر نوع الكشف أو الخدمة</h4>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {defaultServices.map((s: any) => {
                    const active = selectedService?.name === s.name || selectedService?.id === s.id
                    return (
                      <div
                        key={s.id || s.name}
                        onClick={() => setSelectedService(s)}
                        className={`cursor-pointer p-3.5 rounded-2xl border-2 ${
                          active
                            ? 'border-sky-500 bg-sky-50/70 dark:bg-sky-950/40'
                            : 'border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-800'
                        } flex items-center justify-between transition-all hover:border-sky-400`}
                      >
                        <div>
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white">
                            {s.name}
                            {s.isUrgent && <span className="text-rose-600 font-black mr-1">(أولوية قصوى)</span>}
                          </div>
                          {s.duration && <div className="text-[10px] text-slate-400">المدة: {s.duration}</div>}
                        </div>
                        {showPrices && (
                          <span className="font-extrabold text-xs text-sky-600 dark:text-sky-400">
                            {s.price} ج.م
                          </span>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: QUICK DATE SELECTION & MAX QUOTA CHECK */}
            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر يوم الكشف</h4>

                {/* Quick Days Grid */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200">
                      أيام الحجز المتاحة
                    </label>
                    {maxLimit > 0 && (
                      <span className="text-[10px] text-slate-400 font-bold">
                        الحد اليومي: {maxLimit} كشوفات
                      </span>
                    )}
                  </div>
                  <div className={`grid ${availableDays.length === 1 ? 'grid-cols-1 max-w-[220px] mx-auto' : 'grid-cols-3'} gap-2`}>
                    {availableDays.map((d) => {
                      const isSelected = selectedDate === d.iso
                      const isFull = d.isFull
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          disabled={isFull}
                          onClick={() => setSelectedDate(d.iso)}
                          className={`p-2.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center ${
                            isFull
                              ? 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 shadow-md ring-2 ring-sky-400/20 cursor-pointer'
                              : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300 cursor-pointer'
                          }`}
                        >
                          <span className={`text-xs font-black ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}`}>
                            {d.label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {d.subLabel}
                          </span>
                          {isFull && (
                            <span className="mt-1 text-[8.5px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded-full">
                              مكتمل العدد
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                  {isTodayOnly && (
                    <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center text-[10.5px] font-bold text-amber-700 dark:text-amber-400">
                      ⚡ تنبيه: الحجز متاح لليوم الحالي فقط بتعليمات العيادة
                    </div>
                  )}
                </div>

                {/* Live Queue & Estimated Wait Box */}
                <div className="p-3.5 rounded-2xl bg-gradient-to-r from-sky-50 to-blue-50 dark:from-[#091b34] dark:to-[#07162d] border border-sky-200 dark:border-sky-500/25 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/15 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                        <Clock className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">دورك المتوقع لهذا اليوم</div>
                        <div className="text-sm font-black text-slate-900 dark:text-white font-mono">
                          {isEstimating ? 'جاري الحساب...' : `دور رقم #${estimatedQueueNumber}`}
                        </div>
                      </div>
                    </div>
                    <div className="text-left">
                      <div className="text-[10px] font-bold text-slate-500 dark:text-slate-400">الوقت التقريبي للدخول</div>
                      <div className="text-xs font-black text-sky-600 dark:text-sky-400">
                        {estimatedWaitMins > 0 ? `~ ${estimatedWaitMins} دقيقة` : 'كشف فوري'}
                      </div>
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 border-t border-sky-100 dark:border-slate-800 pt-1.5">
                    * يتم حساب رقم الدور والوقت فورياً وبشكل تسلسلي وفقاً للحجوزات المسجلة.
                  </p>
                </div>
              </div>
            )}

            {/* STEP 4: PATIENT FORM (Without birth date) */}
            {step === 4 && (
              <div className="space-y-3">
                <div className="text-xs font-extrabold text-sky-600 dark:text-sky-400">+ بيانات المريض الأساسية</div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                    الاسم الكامل للمريض <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder="مثال: محمد أحمد علي"
                    className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 focus:bg-white outline-none text-sm font-bold text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                    رقم الهاتف المحمول (واتساب) <span className="text-rose-500">*</span>
                  </label>
                  <PhoneInputWithCountry
                    value={patientPhone}
                    onChange={(fullNumber, country, localNum) => {
                      setPatientPhone(fullNumber)
                      setSelectedCountry(country)
                      validatePhoneInput(fullNumber, country, false)
                    }}
                    hasError={phoneError}
                    errorMessage={phoneErrorMsg}
                    size="md"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                      السن (بالسنوات)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="مثال: 28"
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-sm font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                      النوع
                    </label>
                    <div className="grid grid-cols-2 gap-2">
                      <button
                        type="button"
                        onClick={() => setGender('ذكر')}
                        className={`py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                          gender === 'ذكر'
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        ذكر
                      </button>
                      <button
                        type="button"
                        onClick={() => setGender('أنثى')}
                        className={`py-2 rounded-xl font-extrabold text-xs transition-all cursor-pointer ${
                          gender === 'أنثى'
                            ? 'bg-sky-600 text-white shadow-md'
                            : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        أنثى
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: PAYMENT METHODS (With Transfer Amount, Clinic Transfer Target & Sender Input) */}
            {step === 5 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر طريقة الدفع</h4>
                  <p className="text-[11px] text-slate-400 mt-0.5">يمكنك الدفع كاش في العيادة أو إلكترونياً</p>
                </div>

                {/* 3 Payment Methods Cards */}
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('cash')}
                    className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      paymentMethod === 'cash'
                        ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-950/50 shadow-md ring-2 ring-emerald-400/20'
                        : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-emerald-300'
                    }`}
                  >
                    <Banknote className="w-5 h-5 text-emerald-600 mb-1" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">كاش بالعيادة</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">عند الحضور</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('instapay')}
                    className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      paymentMethod === 'instapay'
                        ? 'border-purple-500 bg-purple-50 dark:bg-purple-950/50 shadow-md ring-2 ring-purple-400/20'
                        : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-purple-300'
                    }`}
                  >
                    <CreditCard className="w-5 h-5 text-purple-600 mb-1" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">InstaPay</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">تحويل فوري</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setPaymentMethod('wallet')}
                    className={`p-3 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                      paymentMethod === 'wallet'
                        ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/50 shadow-md ring-2 ring-rose-400/20'
                        : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-rose-300'
                    }`}
                  >
                    <Wallet className="w-5 h-5 text-rose-600 mb-1" />
                    <span className="text-xs font-black text-slate-900 dark:text-white">محفظة ذكية</span>
                    <span className="text-[9px] text-slate-400 mt-0.5">كاش / محافظ</span>
                  </button>
                </div>

                {/* InstaPay Details Box */}
                {paymentMethod === 'instapay' && (
                  <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-3">
                    {/* 1. سعر التحويل */}
                    {showPrices && (
                      <div className="flex items-center justify-between pb-2 border-b border-purple-200/60 dark:border-purple-800">
                        <span className="text-xs font-bold text-purple-700 dark:text-purple-300">
                          المبلغ المطلوب تحويله (سعر الكشف):
                        </span>
                        <span className="text-base font-black text-purple-900 dark:text-white font-mono">
                          {selectedService?.price} ج.م
                        </span>
                      </div>
                    )}

                    {/* 2. رقم التحويل للعيادة */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-purple-600 dark:text-purple-300">رقم / عنوان InstaPay للعيادة:</div>
                        <div className="text-sm font-black font-mono text-slate-900 dark:text-white" dir="ltr">
                          {clinicInstapayHandle}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(clinicInstapayHandle)}
                        className="px-2.5 py-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{isCopied ? 'تم النسخ ✓' : 'نسخ'}</span>
                      </button>
                    </div>

                    {/* 3. الرقم المحول منه */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        اسم الحساب أو رقم الهاتف الذي تحول منه: <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="text"
                        value={transferAccount}
                        onChange={(e) => setTransferAccount(e.target.value)}
                        placeholder="مثال: أحمد محمد أو 01012345678"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-purple-200 dark:border-purple-700 text-xs font-bold outline-none"
                      />
                    </div>
                  </div>
                )}

                {/* Electronic Wallet Details Box */}
                {paymentMethod === 'wallet' && (
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-3">
                    {/* 1. سعر التحويل */}
                    {showPrices && (
                      <div className="flex items-center justify-between pb-2 border-b border-rose-200/60 dark:border-rose-800">
                        <span className="text-xs font-bold text-rose-700 dark:text-rose-300">
                          المبلغ المطلوب تحويله (سعر الكشف):
                        </span>
                        <span className="text-base font-black text-rose-900 dark:text-white font-mono">
                          {selectedService?.price} ج.م
                        </span>
                      </div>
                    )}

                    {/* 2. رقم التحويل للعيادة */}
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-rose-600 dark:text-rose-300">رقم محفظة العيادة (فودافون كاش / محافظ):</div>
                        <div className="text-sm font-black font-mono text-slate-900 dark:text-white" dir="ltr">
                          {clinicWalletNumber}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyText(clinicWalletNumber)}
                        className="px-2.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-[10px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
                      >
                        <Copy className="w-3 h-3" />
                        <span>{isCopied ? 'تم النسخ ✓' : 'نسخ'}</span>
                      </button>
                    </div>

                    {/* 3. الرقم المحول منه */}
                    <div>
                      <label className="block text-[11px] font-bold text-slate-700 dark:text-slate-300 mb-1">
                        رقم المحفظة التي قمت بالتحويل منها: <span className="text-rose-500">*</span>
                      </label>
                      <PhoneInputWithCountry
                        value={transferAccount}
                        onChange={(fullNumber) => setTransferAccount(fullNumber)}
                        size="sm"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 6: REVIEW & CONFIRM */}
            {step === 6 && (
              <div className="space-y-3">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">مراجعة وتأكيد الحجز</h4>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-sky-200 dark:border-slate-700 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">اسم المريض:</span>
                    <strong className="text-slate-900 dark:text-white">{patientName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">رقم الهاتف:</span>
                    <strong dir="ltr">{patientPhone}</strong>
                  </div>
                  {age && (
                    <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                      <span className="text-slate-400">السن:</span>
                      <strong>{age} سنة</strong>
                    </div>
                  )}
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">الفرع:</span>
                    <strong className="text-sky-600">{selectedBranch?.name || 'الفرع الرئيسي'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">الخدمة:</span>
                    <strong>{selectedService?.name} {showPrices ? `(${selectedService?.price} ج.م)` : ''}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">تاريخ ويوم الكشف:</span>
                    <strong>{selectedDate}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">طريقة الدفع:</span>
                    <strong className="text-emerald-600">
                      {paymentMethod === 'cash' ? 'كاش في العيادة' : paymentMethod === 'instapay' ? 'InstaPay' : 'محفظة إلكترونية'}
                    </strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">الدور المتوقع:</span>
                    <strong className="text-sky-600 font-mono">#{estimatedQueueNumber}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Footer Navigation Buttons */}
            <div className="pt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={submitting}
                onClick={handleNext}
                className="flex-1 py-3.5 px-5 rounded-full bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg hover:opacity-95 transition-all cursor-pointer disabled:opacity-70"
              >
                {submitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>جاري تأكيد الحجز...</span>
                  </>
                ) : (
                  <>
                    <span>{step === 6 ? 'تأكيد الحجز الآن' : 'التالي'}</span>
                    <ArrowLeft className="w-4 h-4" />
                  </>
                )}
              </button>
              <button
                type="button"
                onClick={() => (step > 1 ? setStep(step - 1) : onClose())}
                className="py-3.5 px-6 rounded-full bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-sm hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors cursor-pointer"
              >
                السابق
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
