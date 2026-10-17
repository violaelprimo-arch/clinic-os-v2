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

export function BookingModal({
  clinic,
  services = [],
  initialService = null,
  initialBranch = null,
  onClose
}: {
  clinic: any
  services?: any[]
  initialService?: any
  initialBranch?: any
  onClose: () => void
}) {
  const router = useRouter()
  const clinicId = clinic?.id || clinic?.slug || 'demo'
  const slug = clinic?.slug || 'zizo'

  // Step 1: Branch, 2: Service, 3: Date & Queue Estimate, 4: Patient Info, 5: Payment, 6: Review
  const [step, setStep] = useState<number>(1)

  // Fallback branches matching design
  const defaultBranches = [
    {
      id: 'main',
      name: 'الفرع الرئيسي',
      sub: 'مدينة نصر',
      address: clinic?.clinicAddress || 'مدينة نصر - القاهرة',
      image: clinic?.branchImage || clinic?.heroImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop',
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

  const [branches, setBranches] = useState<any[]>(defaultBranches)
  const [selectedBranch, setSelectedBranch] = useState<any>(initialBranch || defaultBranches[0])

  // Load real branches from Firestore so user-uploaded branch images appear immediately
  useEffect(() => {
    let isMounted = true
    const loadBranches = async () => {
      try {
        if (clinic?.id) {
          await ensureClinicHasMainBranch(clinic).catch(() => {})
          const dbBranches = await getClinicBranches(clinic.id).catch(() => [])
          const active = dbBranches.filter((b: any) => !b.isArchived)
          if (active.length > 0 && isMounted) {
            const mapped = active.map((b: any) => ({
              ...b,
              image: b.image || clinic?.branchImage || clinic?.heroImage || defaultBranches[0].image
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
            image: b.image || clinic?.branchImage || clinic?.heroImage || defaultBranches[0].image
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
  }, [clinic, initialBranch])

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

  // Smart Date State (Today, Tomorrow, and Next 5 days)
  const availableDays = useMemo(() => {
    const list: { iso: string; label: string; subLabel: string }[] = []
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]

    const now = new Date()
    for (let i = 0; i < 6; i++) {
      const d = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
      d.setDate(d.getDate() + i)
      const iso = d.toISOString().split('T')[0]
      const dayIndex = d.getDay()
      const dayName = dayNamesAr[dayIndex]
      const dayNum = d.getDate()
      const monthName = monthNamesAr[d.getMonth()]

      let label = `${dayName}`
      if (i === 0) label = 'اليوم'
      else if (i === 1) label = 'غداً'

      list.push({
        iso,
        label,
        subLabel: `${dayNum} ${monthName}`
      })
    }
    return list
  }, [])

  const [selectedDate, setSelectedDate] = useState<string>(availableDays[0]?.iso || '')

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
  const [age, setAge] = useState<string>('')
  const [gender, setGender] = useState<'ذكر' | 'أنثى'>('أنثى')
  const [phoneError, setPhoneError] = useState<boolean>(false)

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
        if (parsed.phone && !patientPhone) setPatientPhone(parsed.phone)
        if (parsed.age && !age) setAge(parsed.age)
      }
    } catch (e) {
      console.warn('Could not read existing patient session:', e)
    }
  }, [])

  const validateEgyptianPhone = (val: string) => {
    const cleaned = val.replace(/\s+/g, '')
    const valid = /^01[0125][0-9]{8}$/.test(cleaned) || cleaned.length >= 10
    setPhoneError(!valid)
    return valid
  }

  const handleCopyText = (text: string) => {
    if (!text) return
    navigator.clipboard.writeText(text)
    setIsCopied(true)
    toast.success('تم النسخ إلى الحافظة')
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
      setStep(4)
      return
    }

    if (step === 4) {
      if (!patientName.trim()) {
        toast.error('يرجى إدخال اسم المريض بالكامل')
        return
      }
      if (!validateEgyptianPhone(patientPhone)) {
        toast.error('يرجى إدخال رقم هاتف محمول صحيح')
        setPhoneError(true)
        return
      }
      setStep(5)
      return
    }

    if (step === 5) {
      setStep(6)
      return
    }

    // STEP 6: Final Submission to Firestore
    setSubmitting(true)
    try {
      const cleanPhone = patientPhone.trim().replace(/\s+/g, '')
      const branchId = selectedBranch?.id || null
      const branchName = selectedBranch?.name || 'الفرع الرئيسي'

      // Strictly sequential queue number directly from DB: max + 1
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId),
        where('date', '==', selectedDate)
      )
      const qSnap = await getDocs(q)
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
  const clinicInstapayHandle = clinic?.instapayHandle || clinic?.instapayAccount || clinic?.clinicPhone || 'zizo@instapay'
  const clinicWalletNumber = clinic?.walletNumber || clinic?.vodafoneCashNumber || clinic?.clinicPhone || '01012345678'

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
          <div className="text-xl font-extrabold tracking-tight" dir="ltr">
            <span className="text-sky-600">yalla</span>
            <span className="text-slate-400 font-semibold">clinic</span>
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
                يوجد {bookingSuccess.aheadCount} في قائمة الانتظار أمامك
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
            {/* STEP 1: BRANCH SELECTION */}
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
                        <div className="w-full h-20 rounded-xl overflow-hidden mb-2 bg-sky-100 dark:bg-slate-700">
                          {b.image && <img src={b.image} alt={b.name} className="w-full h-full object-cover" />}
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

            {/* STEP 2: SERVICE SELECTION */}
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
                        <span className="font-extrabold text-xs text-sky-600 dark:text-sky-400">
                          {s.price} ج.م
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* STEP 3: QUICK DATE SELECTION & LIVE ESTIMATE (No time slots, no calendar picker) */}
            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر يوم الكشف</h4>

                {/* Quick Days Grid */}
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-2">
                    أيام الحجز المتاحة
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {availableDays.map((d) => {
                      const isSelected = selectedDate === d.iso
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => setSelectedDate(d.iso)}
                          className={`p-2.5 rounded-2xl border-2 text-center transition-all cursor-pointer flex flex-col items-center justify-center ${
                            isSelected
                              ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 shadow-md ring-2 ring-sky-400/20'
                              : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300'
                          }`}
                        >
                          <span className={`text-xs font-black ${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}`}>
                            {d.label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {d.subLabel}
                          </span>
                        </button>
                      )
                    })}
                  </div>
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
                  <div
                    dir="ltr"
                    className={`flex items-center rounded-2xl bg-slate-50 dark:bg-slate-800 border-2 overflow-hidden transition-all ${
                      phoneError ? 'border-rose-400 dark:border-rose-500' : 'border-slate-200 dark:border-slate-700 focus-within:border-sky-500'
                    }`}
                  >
                    <div className="px-3 py-3 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-700 flex items-center gap-1.5 text-xs font-bold shrink-0 text-slate-700 dark:text-slate-300">
                      <span>🇪🇬</span>
                      <span>+20</span>
                    </div>
                    <input
                      type="tel"
                      value={patientPhone}
                      onChange={(e) => {
                        setPatientPhone(e.target.value)
                        validateEgyptianPhone(e.target.value)
                      }}
                      placeholder="01012345678"
                      className="w-full px-3 py-3 bg-transparent outline-none text-sm font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  {phoneError && (
                    <div className="mt-1 flex items-center gap-1.5 text-[11px] font-bold text-rose-500">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>يرجى إدخال رقم محمول مصري صحيح</span>
                    </div>
                  )}
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

            {/* STEP 5: PAYMENT METHODS */}
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

                {/* InstaPay Account Details Box */}
                {paymentMethod === 'instapay' && (
                  <div className="p-3.5 rounded-2xl bg-purple-50 dark:bg-purple-950/40 border border-purple-200 dark:border-purple-800 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-bold text-purple-600 dark:text-purple-300">عنوان InstaPay للعيادة:</div>
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
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        اسم الحساب أو رقم الهاتف المحول منه (اختياري للتحقق):
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
                  <div className="p-3.5 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 space-y-2.5">
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
                    <div>
                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                        رقم المحفظة التي قمت بالتحويل منها:
                      </label>
                      <input
                        type="tel"
                        dir="ltr"
                        value={transferAccount}
                        onChange={(e) => setTransferAccount(e.target.value)}
                        placeholder="01012345678"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-slate-800 border border-rose-200 dark:border-rose-700 text-xs font-bold outline-none text-left"
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
                    <strong>{selectedService?.name} ({selectedService?.price} ج.م)</strong>
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
