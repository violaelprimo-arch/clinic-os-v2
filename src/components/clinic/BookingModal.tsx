'use client'

import React, { useState, useEffect } from 'react'
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
  ExternalLink
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

  const [step, setStep] = useState<number>(1)
  const [branches, setBranches] = useState<any[]>([])
  const [loadingBranches, setLoadingBranches] = useState<boolean>(true)

  // Load real branches from Firestore or clinic props
  useEffect(() => {
    let isMounted = true
    const loadBranches = async () => {
      try {
        if (clinic?.id) {
          await ensureClinicHasMainBranch(clinic).catch(() => {})
          const dbBranches = await getClinicBranches(clinic.id).catch(() => [])
          const active = dbBranches.filter((b: any) => !b.isArchived)
          if (active.length > 0 && isMounted) {
            setBranches(active)
            if (!selectedBranch) {
              setSelectedBranch(initialBranch || active[0])
            }
            setLoadingBranches(false)
            return
          }
        }
        if (clinic?.branches && clinic.branches.length > 0 && isMounted) {
          setBranches(clinic.branches)
          if (!selectedBranch) {
            setSelectedBranch(initialBranch || clinic.branches[0])
          }
          setLoadingBranches(false)
          return
        }
      } catch (e) {
        console.error('Error loading branches:', e)
      }

      if (isMounted) {
        const fallbackBranch = {
          id: 'main',
          name: clinic?.clinicName ? `فرع ${clinic.clinicName}` : 'الفرع الرئيسي',
          address: clinic?.clinicAddress || 'العنوان الرئيسي للعيادة',
          image: clinic?.heroImage || 'https://images.unsplash.com/photo-1519494026892-80bbd2d6fd0d?q=80&w=600&auto=format&fit=crop',
          available: true
        }
        setBranches([fallbackBranch])
        if (!selectedBranch) setSelectedBranch(initialBranch || fallbackBranch)
        setLoadingBranches(false)
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
        { id: '3', name: 'كشف مستعجل / طوارئ', price: 400, duration: 'فوري مباشر' }
      ]

  const [selectedBranch, setSelectedBranch] = useState<any>(initialBranch || null)
  const [selectedService, setSelectedService] = useState<any>(initialService || defaultServices[0])
  const [selectedDate, setSelectedDate] = useState<string>(() => {
    const now = new Date()
    return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().split('T')[0]
  })
  const [selectedTime, setSelectedTime] = useState<string>('10:30 ص')

  // Patient Form State
  const [patientName, setPatientName] = useState<string>('')
  const [patientPhone, setPatientPhone] = useState<string>('')
  const [birthDate, setBirthDate] = useState<string>('')
  const [age, setAge] = useState<string>('')
  const [gender, setGender] = useState<'ذكر' | 'أنثى'>('أنثى')
  const [phoneError, setPhoneError] = useState<boolean>(false)
  const [submitting, setSubmitting] = useState<boolean>(false)
  const [bookingSuccess, setBookingSuccess] = useState<{
    appointmentId: string
    queueNumber: number
    aheadCount: number
    branchName: string
    date: string
    time: string
  } | null>(null)

  const validateEgyptianPhone = (val: string) => {
    const cleaned = val.replace(/\s+/g, '')
    const valid = /^01[0125][0-9]{8}$/.test(cleaned) || cleaned.length >= 10
    setPhoneError(!valid)
    return valid
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
        toast.error('يرجى اختيار تاريخ الحجز')
        return
      }
      setStep(4)
      return
    }

    if (step === 4) {
      if (!patientName.trim()) {
        toast.error('يرجى إدخال اسم المريض ثلاثي')
        return
      }
      if (!validateEgyptianPhone(patientPhone)) {
        toast.error('يرجى إدخال رقم هاتف محمول صحيح')
        setPhoneError(true)
        return
      }
      // Calculate age if birthDate is filled but age is not
      if (birthDate && !age) {
        const birthYear = new Date(birthDate).getFullYear()
        const currentYear = new Date().getFullYear()
        if (birthYear > 1900 && birthYear <= currentYear) {
          setAge(String(currentYear - birthYear))
        }
      }
      setStep(5)
      return
    }

    // STEP 5: Final Submission to Firestore
    setSubmitting(true)
    try {
      const cleanPhone = patientPhone.trim().replace(/\s+/g, '')
      const branchId = selectedBranch?.id || null
      const branchName = selectedBranch?.name || 'الفرع الرئيسي'

      // Isolated queue calculation for clinic and selected date
      const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId),
        where('date', '==', selectedDate)
      )
      const qSnap = await getDocs(q)
      const branchDateAppts = qSnap.docs.filter((d) => {
        const data = d.data()
        return !branchId || data.branch_id === branchId || data.branchName === branchName
      })

      const myQueueNumber = branchDateAppts.length + 1
      let waitingCount = 0
      branchDateAppts.forEach((docSnap) => {
        const st = docSnap.data().status
        if (st === 'waiting' || !st) waitingCount++
      })

      const serviceName = selectedService?.name || 'كشف عادي'
      const isUrgent =
        selectedService?.isUrgent ||
        serviceName.includes('مستعجل') ||
        serviceName.includes('طوارئ') ||
        String(selectedService?.id) === '3'

      let calculatedAge = age.trim()
      if (!calculatedAge && birthDate) {
        const bYear = new Date(birthDate).getFullYear()
        const curYear = new Date().getFullYear()
        if (bYear > 1900 && bYear <= curYear) {
          calculatedAge = String(curYear - bYear)
        }
      }

      const newAppt = {
        clinic_id: clinicId,
        branch_id: branchId,
        branchName: branchName,
        patientName: patientName.trim(),
        phone: cleanPhone,
        age: calculatedAge || null,
        birthDate: birthDate || null,
        gender: gender || 'أنثى',
        serviceId: selectedService?.id || '1',
        serviceName: serviceName,
        servicePrice: selectedService?.price || 0,
        isUrgent,
        date: selectedDate,
        time: selectedTime,
        queue_number: myQueueNumber,
        status: 'waiting',
        paymentMethod: 'cash',
        paymentStatus: 'unpaid',
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
            age: calculatedAge || '',
            createdAt: new Date().toISOString()
          })
        }
      } catch (accErr) {
        console.warn('Patient account auto-create warning:', accErr)
      }

      // Notifications
      createClinicNotification({
        clinicId,
        branchId: branchId,
        recipientType: 'staff',
        recipientTarget: clinicId,
        title: 'حجز جديد مسجل',
        body: `حجز جديد للمريض ${patientName.trim()} في فرع "${branchName}" برقم دور #${myQueueNumber}.`,
        type: 'new_booking',
        appointmentId: docRef.id
      }).catch(() => {})

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
        time: selectedTime
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
    { id: 5, label: 'مراجعة', Icon: ClipboardCheck }
  ]

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

        {/* 5-Step Stepper */}
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
                  className={`w-9 h-9 rounded-full flex items-center justify-center text-xs transition-all ${
                    done
                      ? 'bg-emerald-500 text-white shadow'
                      : active
                      ? 'bg-sky-600 text-white shadow-lg ring-4 ring-sky-500/20'
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-400'
                  }`}
                >
                  {done ? <Check className="w-4 h-4" /> : <Icon className="w-4 h-4" />}
                </div>
                <span className={`text-[10px] font-bold ${active ? 'text-sky-600 dark:text-sky-400 font-extrabold' : 'text-slate-400'}`}>
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
            </div>

            <div className="space-y-2 pt-2">
              <Link
                href={`/clinic/${slug}/track/${bookingSuccess.appointmentId}`}
                onClick={onClose}
                className="w-full py-3 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-sm flex items-center justify-center gap-2 shadow-lg hover:shadow-xl transition-all"
              >
                <span>متابعة وتتبع الدور المباشر</span>
                <ExternalLink className="w-4 h-4" />
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="w-full py-2.5 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 font-bold text-xs hover:bg-slate-50 transition-colors"
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
                {loadingBranches ? (
                  <div className="flex flex-col items-center justify-center py-10 gap-2 text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin text-sky-500" />
                    <span className="text-xs font-bold">جاري تحميل الفروع...</span>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-64 overflow-y-auto">
                    {branches.map((b: any) => {
                      const isSelected = selectedBranch?.id === b.id || selectedBranch?.name === b.name
                      return (
                        <div
                          key={b.id || b.name}
                          onClick={() => setSelectedBranch(b)}
                          className={`cursor-pointer rounded-2xl p-3 bg-white dark:bg-slate-800 border-2 ${
                            isSelected ? 'border-sky-500 shadow-md ring-2 ring-sky-400/30' : 'border-slate-100 dark:border-slate-700'
                          } flex flex-col text-right relative transition-all hover:-translate-y-0.5`}
                        >
                          <div className="flex items-center justify-between mb-1.5">
                            <span className="font-black text-slate-900 dark:text-white text-xs leading-tight">{b.name}</span>
                            <span className="px-2 py-0.5 rounded-full bg-emerald-50 dark:bg-emerald-950 text-emerald-600 dark:text-emerald-400 text-[9px] font-extrabold border border-emerald-200 dark:border-emerald-800">
                              متاح
                            </span>
                          </div>
                          <div className="text-[11px] text-slate-500 dark:text-slate-400 flex items-center gap-1">
                            <MapPin className="w-3 h-3 text-sky-500 shrink-0" />
                            <span className="truncate">{b.address || b.city || 'الفرع الرئيسي'}</span>
                          </div>
                          {isSelected && (
                            <span className="absolute -bottom-1 -left-1 w-5 h-5 rounded-full bg-sky-600 text-white flex items-center justify-center text-[10px] shadow">
                              <Check className="w-3 h-3" />
                            </span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
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
                          <div className="font-extrabold text-xs text-slate-900 dark:text-white">{s.name}</div>
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

            {/* STEP 3: DATE & TIME */}
            {step === 3 && (
              <div className="space-y-4">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">اختر التاريخ والموعد</h4>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">تاريخ الحجز</label>
                  <input
                    type="date"
                    value={selectedDate}
                    min={new Date().toISOString().split('T')[0]}
                    onChange={(e) => setSelectedDate(e.target.value)}
                    className="w-full px-4 py-3 rounded-2xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-sky-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1.5">المواعيد المتاحة</label>
                  <div className="grid grid-cols-3 gap-2">
                    {['10:00 ص', '10:30 ص', '11:30 ص', '01:00 م', '06:30 م', '08:00 م'].map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setSelectedTime(t)}
                        className={`py-2.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
                          selectedTime === t
                            ? 'bg-sky-600 text-white border-sky-600 shadow'
                            : 'bg-white dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 4: PATIENT FORM */}
            {step === 4 && (
              <div className="space-y-3">
                <div className="text-xs font-extrabold text-sky-600 dark:text-sky-400">+ بيانات المريض</div>
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
                    رقم الهاتف (واتساب) <span className="text-rose-500">*</span>
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

                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                      السن (إجباري للروشتة)
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="120"
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="28"
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-sm font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                      تاريخ الميلاد
                    </label>
                    <input
                      type="date"
                      value={birthDate}
                      onChange={(e) => {
                        setBirthDate(e.target.value)
                        if (e.target.value) {
                          const y = new Date(e.target.value).getFullYear()
                          const now = new Date().getFullYear()
                          if (y > 1900 && y <= now) setAge(String(now - y))
                        }
                      }}
                      className="w-full px-3 py-2.5 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 focus:border-sky-500 outline-none text-xs font-bold text-slate-900 dark:text-white"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-extrabold text-slate-700 dark:text-slate-200 mb-1">
                    النوع
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setGender('ذكر')}
                      className={`py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer ${
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
                      className={`py-2.5 rounded-2xl font-extrabold text-xs transition-all cursor-pointer ${
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
            )}

            {/* STEP 5: REVIEW & CONFIRM */}
            {step === 5 && (
              <div className="space-y-3">
                <h4 className="text-center font-extrabold text-slate-800 dark:text-slate-100 text-sm">مراجعة تفاصيل الحجز</h4>
                <div className="p-4 rounded-2xl bg-white dark:bg-slate-800 border border-sky-200 dark:border-slate-700 space-y-2.5 text-xs">
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">اسم المريض:</span>
                    <strong className="text-slate-900 dark:text-white">{patientName}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">رقم الهاتف:</span>
                    <strong dir="ltr">{patientPhone}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">الفرع:</span>
                    <strong className="text-sky-600">{selectedBranch?.name || 'الفرع الرئيسي'}</strong>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-100 dark:border-slate-700">
                    <span className="text-slate-400">الخدمة:</span>
                    <strong>{selectedService?.name} ({selectedService?.price} ج.م)</strong>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-400">الموعد والتاريخ:</span>
                    <strong>{selectedDate} • {selectedTime}</strong>
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
                    <span>{step === 5 ? 'تأكيد الحجز الآن' : 'التالي'}</span>
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
