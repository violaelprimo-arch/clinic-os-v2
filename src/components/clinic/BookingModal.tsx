'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import { useRouter } from 'next/navigation'
import {
  X, CheckCircle2, Building2, Calendar, User, Users, Phone,
  Clock, CreditCard, Wallet, Banknote, AlertCircle,
  ArrowRight, ArrowLeft, ExternalLink, Copy, Check,
  Loader2, Sparkles, Upload, MapPin, ChevronRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, getDocs, query, where } from 'firebase/firestore'
import { Branch } from '@/types/clinic'
import { getClinicBranches, ensureClinicHasMainBranch } from '@/lib/branchService'
import { createClinicNotification } from '@/lib/notificationService'
import { getClinicUrl } from '@/lib/clinic-url'
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'
import { useLanguage } from '@/context/LanguageContext'

interface BookingModalProps {
  isOpen: boolean
  onClose: () => void
  clinic: any
  services?: any[]
  initialServiceId?: string | null
  initialBranchId?: string | null
}

export function BookingModal({
  isOpen,
  onClose,
  clinic,
  services = [],
  initialServiceId = null,
  initialBranchId = null
}: BookingModalProps) {
  const router = useRouter()
  const { dir, t, isRtl } = useLanguage()
  const primaryColor = clinic?.primaryColor || '#087CF4'
  const showPrices = clinic?.showPrices !== false && clinic?.hidePrices !== true

  // Step state: 1: Branch & Date, 2: Patient Info, 3: Service, 4: Payment, 5: Review & Submit
  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1)

  // Step 1: Branch & Date
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>(initialBranchId || '')
  const [dailyBookingCounts, setDailyBookingCounts] = useState<Record<string, number>>({})
  const [selectedDate, setSelectedDate] = useState<string>('')

  // Step 2: Patient Info
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [age, setAge] = useState('')
  const [errors, setErrors] = useState<{ name?: string; phone?: string; age?: string; branch?: string; date?: string; payment?: string }>({})

  // Step 3: Service
  const [selectedServiceId, setSelectedServiceId] = useState<string>(initialServiceId || '')

  // Step 4: Payment
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'wallet'>('cash')
  const [transferNumber, setTransferNumber] = useState('')
  const [transferReference, setTransferReference] = useState('')
  const [transferProofUrl, setTransferProofUrl] = useState('')

  // Submission & Success
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isCopied, setIsCopied] = useState(false)
  const [successData, setSuccessData] = useState<{
    appointmentId: string
    queueNumber: number
    aheadCount: number
    branchName: string
    date: string
  } | null>(null)

  // Input refs for auto-focus on validation failure
  const nameInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const ageInputRef = useRef<HTMLInputElement>(null)
  const transferNumberRef = useRef<HTMLInputElement>(null)

  // Load branches
  useEffect(() => {
    if (!isOpen || (!clinic?.id && !clinic?.slug)) return
    const clinicId = clinic.id || clinic.slug

    const fetchBranches = async () => {
      try {
        await ensureClinicHasMainBranch(clinic)
        const list = await getClinicBranches(clinicId)
        const active = list.filter((b) => !b.isArchived)
        setBranches(active)
        if (active.length > 0 && !selectedBranchId) {
          setSelectedBranchId(initialBranchId || active[0].id)
        }
      } catch (err) {
        console.error('Error fetching branches in modal:', err)
      }
    }
    fetchBranches()
  }, [isOpen, clinic, initialBranchId, selectedBranchId])

  // Selected Branch
  const selectedBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0] || null
  }, [branches, selectedBranchId])

  // Fetch daily booking counts for selected branch
  useEffect(() => {
    if (!isOpen || (!clinic?.id && !clinic?.slug)) return
    const clinicId = clinic.id || clinic.slug

    const fetchCounts = async () => {
      try {
        const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId))
        const snap = await getDocs(q)
        const counts: Record<string, number> = {}
        snap.docs.forEach((docSnap) => {
          const d = docSnap.data()
          if (!selectedBranch?.id || d.branch_id === selectedBranch.id) {
            counts[d.date] = (counts[d.date] || 0) + 1
          }
        })
        setDailyBookingCounts(counts)
      } catch (err) {
        console.error('Error fetching counts:', err)
      }
    }
    fetchCounts()
  }, [isOpen, clinic, selectedBranch?.id])

  // Compute available dates
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

      if (branchSchedule && branchSchedule.length > 0) {
        const sched = branchSchedule.find((s: any) => s.id === dayKey)
        if (sched && sched.isOpen === false) continue
      }

      const bookedCount = dailyBookingCounts[iso] || 0
      if (maxLimit > 0 && bookedCount >= maxLimit) continue

      let label = dayName
      if (i === 0) label = isRtl ? 'اليوم' : 'Today'
      else if (i === 1) label = isRtl ? 'غداً' : 'Tomorrow'

      const monthName = isRtl ? monthNamesAr[d.getMonth()] : monthNamesEn[d.getMonth()]
      const formattedDate = isRtl ? `${d.getDate()} ${monthName}` : `${monthName} ${d.getDate()}`
      list.push({ iso, label, formattedDate })
      if (list.length >= 7) break
    }

    return list
  }, [selectedBranch, clinic?.weeklySchedule, clinic?.maxDailyBookings, dailyBookingCounts, isRtl])

  // Set default date
  useEffect(() => {
    if (availableDays.length > 0 && (!selectedDate || !availableDays.some((d) => d.iso === selectedDate))) {
      setSelectedDate(availableDays[0].iso)
    }
  }, [availableDays, selectedDate])

  // Services list
  const availableServices = useMemo(() => {
    if (services.length > 0) return services
    if (clinic?.services?.length > 0) return clinic.services
    return [
      { id: '1', name: isRtl ? 'كشف عادي' : 'Standard Consultation', price: 250, desc: isRtl ? 'كشف شامل مع تشخيص دقيق' : 'Comprehensive diagnostic consultation', duration: isRtl ? '15 دقيقة' : '15 mins' },
      { id: '2', name: isRtl ? 'استشارة' : 'Follow-up Consultation', price: 150, desc: isRtl ? 'استشارة طبية ومراجعة التحاليل' : 'Follow-up review of lab results', duration: isRtl ? '10 دقائق' : '10 mins' },
      { id: '3', name: isRtl ? 'كشف مستعجل' : 'Urgent Consultation', price: 400, desc: isRtl ? 'أولوية فورية في الدخول' : 'Immediate queue priority entry', duration: isRtl ? 'فوري مباشر' : 'Immediate' }
    ]
  }, [services, clinic?.services, isRtl])

  // Set default service
  useEffect(() => {
    if (availableServices.length > 0 && (!selectedServiceId || !availableServices.some((s: any) => s.id === selectedServiceId))) {
      setSelectedServiceId(initialServiceId || availableServices[0].id)
    }
  }, [availableServices, initialServiceId, selectedServiceId])

  const selectedService = availableServices.find((s: any) => s.id === selectedServiceId) || availableServices[0]

  // Reset or close
  const handleClose = () => {
    if (isSubmitting) return
    onClose()
    // Reset state after transition
    setTimeout(() => {
      setStep(1)
      setErrors({})
      setSuccessData(null)
      setName('')
      setPhone('')
      setAge('')
      setPaymentMethod('cash')
      setTransferNumber('')
      setTransferProofUrl('')
    }, 200)
  }

  // Handle Receipt Screenshot
  const handleReceiptProofUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      if (file.size > 4 * 1024 * 1024) {
        return toast.error(isRtl ? 'حجم الصورة كبير، يرجى اختيار صورة أقل من 4 ميجابايت' : 'Image is too large, maximum size is 4MB')
      }
      const reader = new FileReader()
      reader.onload = () => {
        setTransferProofUrl(reader.result as string)
        toast.success(isRtl ? 'تم إرفاق إيصال التحويل بنجاح' : 'Receipt uploaded successfully')
      }
      reader.readAsDataURL(file)
    }
  }

  // Strict Validation: Egyptian phone (11 digits starting with 010, 011, 012, 015)
  const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/

  // Step 1 Validation
  const validateStep1 = () => {
    const errs: typeof errors = {}
    if (!selectedBranch) errs.branch = isRtl ? 'يرجى اختيار فرع العيادة' : 'Please select a clinic branch'
    if (!selectedDate) errs.date = isRtl ? 'يرجى اختيار تاريخ الموعد' : 'Please choose an appointment date'

    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error(isRtl ? 'يرجى تصحيح الأخطاء للمتابعة' : 'Please resolve the highlighted errors')
      return false
    }
    return true
  }

  // Step 2 Validation (Patient info: Name, Phone, Age required)
  const validateStep2 = () => {
    const errs: typeof errors = {}
    const trimmedName = name.trim()
    const cleanPhone = phone.trim().replace(/\s+/g, '')
    const numAge = Number(age.trim())

    if (!trimmedName) {
      errs.name = isRtl ? 'اسم المريض مطلوب' : 'Patient full name is required'
    } else if (trimmedName.split(/\s+/).length < 2) {
      errs.name = isRtl ? 'يرجى كتابة الاسم ثنائياً على الأقل' : 'Please provide at least first and last name'
    }

    if (!cleanPhone) {
      errs.phone = isRtl ? 'رقم الهاتف مطلوب للتواصل وتتبع الدور' : 'Phone number is required for notifications'
    } else if (!egyptianPhoneRegex.test(cleanPhone)) {
      errs.phone = isRtl ? 'رقم هاتف غير صحيح (يجب أن يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015)' : 'Invalid phone number (must be 11 digits starting with 010, 011, 012, or 015)'
    }

    if (!age.trim()) {
      errs.age = isRtl ? 'العمر مطلوب لكتابة الجرعات الطبية بدقة' : 'Age is required for accurate prescriptions'
    } else if (isNaN(numAge) || numAge < 1 || numAge > 120) {
      errs.age = isRtl ? 'يرجى كتابة عمر صحيح بين 1 و 120' : 'Please enter a valid age between 1 and 120'
    }

    setErrors(errs)

    // Auto-focus first error field
    if (errs.name && nameInputRef.current) {
      nameInputRef.current.focus()
      toast.error(errs.name)
      return false
    }
    if (errs.phone && phoneInputRef.current) {
      phoneInputRef.current.focus()
      toast.error(errs.phone)
      return false
    }
    if (errs.age && ageInputRef.current) {
      ageInputRef.current.focus()
      toast.error(errs.age)
      return false
    }

    return true
  }

  // Step 4 Validation (Payment)
  const validateStep4 = () => {
    const errs: typeof errors = {}
    if (paymentMethod !== 'cash' && !transferNumber.trim()) {
      errs.payment = isRtl ? 'يرجى كتابة رقم الهاتف أو الحساب المحول منه لتأكيد الحجز' : 'Please provide the sender account/phone to verify transfer'
      setErrors(errs)
      if (transferNumberRef.current) transferNumberRef.current.focus()
      toast.error(errs.payment)
      return false
    }
    setErrors({})
    return true
  }

  // Step Transitions
  const handleNext = () => {
    if (step === 1) {
      if (validateStep1()) setStep(2)
    } else if (step === 2) {
      if (validateStep2()) setStep(3)
    } else if (step === 3) {
      setStep(4)
    } else if (step === 4) {
      if (validateStep4()) setStep(5)
    }
  }

  const handlePrev = () => {
    setErrors({})
    if (step > 1) setStep((prev) => (prev - 1) as any)
  }

  // Final Submit
  const handleFinalSubmit = async () => {
    setIsSubmitting(true)
    const clinicId = clinic.id || clinic.slug

    try {
      // Isolated queue calculation for date & branch
      const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId))
      const querySnapshot = await getDocs(q)
      const branchDateAppts = querySnapshot.docs.filter((d) => {
        const data = d.data()
        const matchesDate = data.date === selectedDate
        const matchesBranch = selectedBranch?.id ? data.branch_id === selectedBranch.id : true
        return matchesDate && matchesBranch
      })

      const myQueueNumber = branchDateAppts.length + 1

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
        patientName: name.trim(),
        phone: phone.trim().replace(/\s+/g, ''),
        age: age.trim(),
        serviceId: selectedService.id,
        serviceName: selectedService.name,
        servicePrice: selectedService.price || 0,
        isUrgent: selectedService.name.includes('مستعجل') || selectedService.name.includes('طوارئ'),
        date: selectedDate,
        queue_number: myQueueNumber,
        status: 'waiting',
        paymentMethod,
        paymentStatus,
        transferNumber: isOnlinePay ? transferNumber.trim() : '',
        transferReference: transferReference.trim() || '',
        transferProofUrl: transferProofUrl || '',
        createdAt: new Date().toISOString()
      }

      const docRef = await addDoc(collection(db, 'appointments'), newAppt)

      // Send In-Site Notification to Patient
      await createClinicNotification({
        clinicId,
        branchId: selectedBranch?.id,
        recipientType: 'patient',
        recipientTarget: phone.trim(),
        title: 'تم تأكيد حجزك بنجاح',
        body: `مرحباً ${name}، تم تسجيل حجزك في فرع "${selectedBranch?.name || 'الرئيسي'}" بدور رقم #${myQueueNumber} لتاريخ ${selectedDate}.`,
        type: 'booking_confirmed',
        appointmentId: docRef.id
      })

      // Send Staff Notification for Reception
      await createClinicNotification({
        clinicId,
        branchId: selectedBranch?.id,
        recipientType: 'staff',
        recipientTarget: clinicId,
        title: isOnlinePay ? 'حجز جديد مع تحويل إلكتروني' : 'حجز جديد مسجل',
        body: `حجز جديد للمريض ${name} (${selectedService.name} - دور #${myQueueNumber}).`,
        type: isOnlinePay ? 'payment_pending' : 'new_booking',
        appointmentId: docRef.id
      })

      setSuccessData({
        appointmentId: docRef.id,
        queueNumber: myQueueNumber,
        aheadCount: waitingCount,
        branchName: selectedBranch?.name || 'الفرع الرئيسي',
        date: selectedDate
      })

      toast.success(isRtl ? `تم تأكيد الحجز بنجاح! دورك رقم #${myQueueNumber}` : `Booking confirmed! Your queue ticket is #${myQueueNumber}`)
    } catch (err) {
      console.error('Error submitting appointment:', err)
      toast.error(isRtl ? 'حدث خطأ أثناء تأكيد الحجز، يرجى المحاولة ثانيةً' : 'An error occurred while confirming booking, please try again')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Copy tracking link
  const handleCopyTrackingLink = () => {
    if (!successData) return
    const url = getClinicUrl(clinic?.slug, `/track/${successData.appointmentId}`)
    navigator.clipboard.writeText(url)
    setIsCopied(true)
    toast.success(isRtl ? 'تم نسخ رابط تتبع الدور' : 'Tracking link copied!')
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Go to tracking page
  const handleGoToTracking = () => {
    if (!successData) return
    onClose()
    router.push(`/clinic/${clinic?.slug}/track/${successData.appointmentId}`)
  }

  if (!isOpen) return null

  const isBookingAllowed = isClinicFeatureEnabled(clinic, 'onlineBooking') && clinic?.allowOnlineBooking !== false

  if (!isBookingAllowed) {
    return (
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        dir={dir}
        onClick={handleClose}
      >
        <div
          className="w-full max-w-md bg-card text-card-foreground rounded-3xl shadow-2xl p-6 sm:p-8 text-center space-y-5 border border-border"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="w-8 h-8" />
          </div>
          <div className="space-y-2">
            <h3 className="text-lg font-black text-foreground">{isRtl ? 'الحجز الإلكتروني غير متاح' : 'Online Booking Unavailable'}</h3>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {isRtl ? 'الحجز الذاتي عبر الموقع غير مفعل لهذه العيادة حالياً. يرجى التواصل مع العيادة هاتفياً لتسجيل موعدك.' : 'Online self-booking is currently disabled for this clinic. Please contact the clinic by phone to book your appointment.'}
            </p>
          </div>
          {(clinic?.clinicPhone || clinic?.doctorPhone) && (
            <div className="p-3 bg-secondary rounded-2xl border border-border text-xs font-bold text-foreground font-mono" dir="ltr">
              {clinic?.clinicPhone || clinic?.doctorPhone}
            </div>
          )}
          <Button onClick={handleClose} className="w-full h-11 yalla-gradient-btn text-white rounded-xl text-xs font-bold">
            {t('close', 'إغلاق')}
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-background/80 backdrop-blur-md animate-in fade-in duration-200"
      dir={dir}
      onClick={handleClose}
    >
      <div
        className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-card text-card-foreground sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-border animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 bg-card text-foreground flex items-center justify-between shrink-0 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary border border-primary/20 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-foreground">
                {successData ? t('booking_success', 'تم تسجيل الحجز بنجاح') : t('new_medical_appt', 'حجز موعد طبي جديد')}
              </h2>
              <p className="text-[11px] text-muted-foreground">
                {clinic?.clinicName || clinic?.doctorName ? `${isRtl ? 'عيادة' : 'Clinic'} ${clinic.doctorName || clinic.clinicName}` : t('clinic', 'العيادة الطبية')}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-xl bg-secondary hover:bg-secondary/80 text-foreground flex items-center justify-center transition-colors cursor-pointer border border-border"
            title={t('close', 'إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP PROGRESS BAR */}
        {!successData && (
          <div className="px-4 sm:px-6 pt-4 pb-2 bg-secondary/40 border-b border-border shrink-0">
            <div className="flex items-center justify-between text-xs font-bold text-muted-foreground mb-2">
              <span className={step >= 1 ? 'text-primary font-black' : ''}>1. {t('branch_and_day', 'الفرع واليوم')}</span>
              <span className={step >= 2 ? 'text-primary font-black' : ''}>2. {t('patient_data', 'البيانات')}</span>
              <span className={step >= 3 ? 'text-primary font-black' : ''}>3. {t('service', 'الخدمة')}</span>
              <span className={step >= 4 ? 'text-primary font-black' : ''}>4. {t('payment', 'الدفع')}</span>
              <span className={step >= 5 ? 'text-primary font-black' : ''}>5. {t('confirmation', 'التأكيد')}</span>
            </div>
            <div className="w-full h-1.5 bg-secondary rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300 rounded-full"
                style={{ width: `${(step / 5) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* MODAL BODY (Scrollable) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5">
          {/* ==================== SUCCESS SCREEN ==================== */}
          {successData ? (
            <div className="py-4 text-center space-y-6">
              <div className="w-20 h-20 bg-primary/10 border-4 border-primary/20 text-primary rounded-full flex items-center justify-center mx-auto shadow-md animate-in zoom-in-75 duration-300">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-foreground">
                  {isRtl ? `مرحباً ${name}، تم تأكيد حجزك!` : `Welcome ${name}, your booking is confirmed!`}
                </h3>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  {t('added_to_today_list', 'تم إدراجك في قائمة الانتظار لدى:')} <strong className="text-foreground">{successData.branchName}</strong>
                </p>
              </div>

              {/* Big Queue Number Card */}
              <div className="p-6 bg-gradient-to-br from-primary/10 to-primary/5 border-2 border-primary/20 rounded-3xl max-w-sm mx-auto shadow-xs space-y-2">
                <p className="text-xs font-bold text-muted-foreground">{t('your_branch_queue_num', 'رقمك في دور اليوم')}</p>
                <div className="text-6xl font-black text-primary tracking-tight">
                  #{successData.queueNumber}
                </div>
                <div className="pt-2 border-t border-primary/20 flex items-center justify-center gap-2 text-xs font-bold text-muted-foreground">
                  <Users className="w-4 h-4 text-primary" />
                  <span>{t('waiting_ahead', 'المرضى في الانتظار قبلك')}: {successData.aheadCount}</span>
                </div>
              </div>

              {/* Patient Alert Message */}
              <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl text-start flex items-start gap-3 max-w-md mx-auto">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 dark:text-amber-400 space-y-1">
                  <p className="font-bold">{isRtl ? 'تنبيه هام لمتابعة دورك:' : 'Important Queue Alert:'}</p>
                  <p className="leading-relaxed">
                    {t('notification_notice', 'يرجى فتح صفحة التتبع اللحظي ومتابعة نداء الطبيب لمعرفة متى يحين دورك مباشرة دون الحاجة للانتظار الطويل في العيادة.')}
                  </p>
                </div>
              </div>

              {/* Direct Tracking Actions */}
              <div className="space-y-2 max-w-md mx-auto pt-2">
                <Button
                  onClick={handleGoToTracking}
                  className="w-full h-12 bg-primary hover:bg-primary-hover text-white font-black text-sm rounded-xl shadow-lg shadow-primary/25 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 mx-2" />
                  {t('track_booking_live_btn', 'تتبع دورك لحظياً الآن')}
                </Button>

                <Button
                  variant="outline"
                  onClick={handleCopyTrackingLink}
                  className="w-full h-11 border-border hover:bg-secondary text-foreground font-bold text-xs rounded-xl"
                >
                  {isCopied ? <Check className="w-4 h-4 mx-2 text-emerald-600" /> : <Copy className="w-4 h-4 mx-2" />}
                  {isCopied ? (isRtl ? 'تم نسخ الرابط بنجاح!' : 'Link copied!') : (isRtl ? 'نسخ رابط تتبع الدور' : 'Copy Tracking Link')}
                </Button>
              </div>
            </div>
          ) : (
            <>
              {/* ==================== STEP 1: BRANCH & DATE ==================== */}
              {step === 1 && (
                <div className="space-y-5">
                  {/* Branch Selection */}
                  <div className="space-y-2">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-primary" />
                      {t('available_branches_nearest', 'اختيار فرع العيادة')} <span className="text-rose-500">*</span>
                    </Label>

                    {branches.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-border text-center text-xs text-muted-foreground">
                        {isRtl ? 'جاري تحميل الفروع...' : 'Loading branches...'}
                      </div>
                    ) : (
                      <div className="grid sm:grid-cols-2 gap-2.5">
                        {branches.map((b) => {
                          const isSelected = selectedBranchId === b.id
                          return (
                            <button
                              type="button"
                              key={b.id}
                              onClick={() => setSelectedBranchId(b.id)}
                              className={`p-3.5 rounded-2xl border text-start transition-all flex items-start justify-between cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                                  : 'border-border bg-card text-card-foreground hover:border-primary/40'
                              } ${b.isOpen === false ? 'opacity-60' : ''}`}
                            >
                              <div className="space-y-1">
                                <p className="font-black text-sm text-foreground">{b.name}</p>
                                <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-muted-foreground" />
                                  {b.address || (isRtl ? 'العنوان الرئيسي للعيادة' : 'Main Clinic Address')}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  b.isOpen !== false
                                    ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                    : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                }`}
                              >
                                {b.isOpen !== false ? t('branch_available', 'متاح') : t('branch_closed', 'مغلق')}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {errors.branch && (
                      <p className="text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.branch}
                      </p>
                    )}
                  </div>

                  {/* Date Selection */}
                  <div className="space-y-2 pt-2 border-t border-border">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-primary" />
                      {t('booking_day', 'اختيار يوم الحجز')} <span className="text-rose-500">*</span>
                    </Label>

                    {availableDays.length === 0 ? (
                      <div className="p-4 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-800 dark:text-amber-400 text-xs font-bold">
                        {t('no_available_times', 'لا توجد مواعيد متاحة في هذا الفرع حالياً، يرجى اختيار فرع آخر أو التواصل مع العيادة.')}
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {availableDays.map((d) => {
                          const isSelected = selectedDate === d.iso
                          return (
                            <button
                              type="button"
                              key={d.iso}
                              onClick={() => setSelectedDate(d.iso)}
                              className={`p-3 rounded-2xl border text-center transition-all cursor-pointer ${
                                isSelected
                                  ? 'border-primary bg-primary text-white shadow-md shadow-primary/20 font-bold'
                                  : 'border-border bg-card hover:border-primary/40 text-foreground font-medium'
                              }`}
                            >
                              <span className="block text-xs font-bold">{d.label}</span>
                              <span className={`block text-[11px] mt-0.5 ${isSelected ? 'text-primary-foreground/90' : 'text-muted-foreground'}`}>
                                {d.formattedDate}
                              </span>
                            </button>
                          )
                        })}
                      </div>
                    )}
                    {errors.date && (
                      <p className="text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5" /> {errors.date}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== STEP 2: PATIENT INFO ==================== */}
              {step === 2 && (
                <div className="space-y-4">
                  {/* Name field */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                      {t('patient_full_name', 'اسم المريض بالكامل')} <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className={`w-4 h-4 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
                      <Input
                        ref={nameInputRef}
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
                        }}
                        placeholder={isRtl ? 'مثال: أحمد محمد علي' : 'e.g. Ahmed Mohamed Ali'}
                        className={`h-11 ${isRtl ? 'pr-10' : 'pl-10'} rounded-xl text-sm bg-background border-input text-foreground ${
                          errors.name ? 'border-rose-500 ring-1 ring-rose-500/20 bg-rose-500/10' : ''
                        }`}
                      />
                    </div>
                    {errors.name && (
                      <p className="text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.name}
                      </p>
                    )}
                  </div>

                  {/* Egyptian Phone field */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                      {t('phone_whatsapp_label', 'رقم هاتف المريض (واتساب)')} <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className={`w-4 h-4 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
                      <Input
                        ref={phoneInputRef}
                        type="tel"
                        dir="ltr"
                        value={phone}
                        onChange={(e) => {
                          setPhone(e.target.value)
                          if (errors.phone) setErrors((prev) => ({ ...prev, phone: undefined }))
                        }}
                        placeholder="01012345678"
                        className={`h-11 ${isRtl ? 'pr-10' : 'pl-10'} rounded-xl text-sm font-mono text-start bg-background border-input text-foreground ${
                          errors.phone ? 'border-rose-500 ring-1 ring-rose-500/20 bg-rose-500/10' : ''
                        }`}
                      />
                    </div>
                    {errors.phone ? (
                      <p className="text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.phone}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {isRtl ? '11 رقم مصري (يبدأ بـ 010 أو 011 أو 012 أو 015) لاستلام إشعار الدور وتتبعه.' : '11-digit mobile number to receive queue notifications.'}
                      </p>
                    )}
                  </div>

                  {/* Age field (Required) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                      {t('patient_age_label', 'السن (إجباري للروشتة)')} <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Clock className={`w-4 h-4 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
                      <Input
                        ref={ageInputRef}
                        type="number"
                        min="1"
                        max="120"
                        value={age}
                        onChange={(e) => {
                          setAge(e.target.value)
                          if (errors.age) setErrors((prev) => ({ ...prev, age: undefined }))
                        }}
                        placeholder="28"
                        className={`h-11 ${isRtl ? 'pr-10' : 'pl-10'} rounded-xl text-sm bg-background border-input text-foreground ${
                          errors.age ? 'border-rose-500 ring-1 ring-rose-500/20 bg-rose-500/10' : ''
                        }`}
                      />
                    </div>
                    {errors.age ? (
                      <p className="text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.age}
                      </p>
                    ) : (
                      <p className="text-[11px] text-muted-foreground">
                        {isRtl ? 'السن مطلوب حتى يتمكن الطبيب من تحديد الجرعات المناسبة بالروشتة.' : 'Age is required for accurate prescriptions.'}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== STEP 3: SERVICE ==================== */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground">
                      {t('choose_exam_type', 'اختر الخدمة الطبية المطلوبة')} <span className="text-rose-500">*</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {isRtl ? 'حدد نوع الكشف أو الخدمة للاطلاع على السعر ووقت الزيارة.' : 'Select consultation type to view fee and estimated time.'}
                    </p>
                  </div>

                  <div className="space-y-2.5">
                    {availableServices.map((service: any) => {
                      const isSelected = selectedServiceId === service.id
                      return (
                        <button
                          type="button"
                          key={service.id}
                          onClick={() => setSelectedServiceId(service.id)}
                          className={`w-full p-4 rounded-2xl border text-start transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border bg-card text-card-foreground hover:border-primary/40'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-sm text-foreground">{service.name}</h4>
                              {service.duration && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-secondary text-secondary-foreground">
                                  {service.duration}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground">{service.desc || (isRtl ? 'كشف طبي شامل' : 'Comprehensive consultation')}</p>
                          </div>

                          {showPrices && (
                            <div className="text-end shrink-0">
                              <span className="text-lg font-black text-primary">
                                {Number(service.price).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} <span className="text-xs font-bold text-muted-foreground">{t('egp', 'ج.م')}</span>
                              </span>
                            </div>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* ==================== STEP 4: PAYMENT ==================== */}
              {step === 4 && (
                <div className="space-y-4">
                  {/* Service & Price Summary Card */}
                  <div className="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-primary">{t('service', 'الخدمة المختارة:')}</p>
                      <p className="text-sm font-black text-foreground">{selectedService?.name || (isRtl ? 'كشف طبي' : 'Consultation')}</p>
                    </div>
                    <div className="text-end">
                      <p className="text-[11px] font-bold text-muted-foreground">{t('required_amount', 'المبلغ المطلوب سداده:')}</p>
                      <p className="text-xl font-black text-primary">
                        {Number(selectedService?.price || 0).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} <span className="text-xs font-bold text-muted-foreground">{t('egp', 'ج.م')}</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-foreground">
                      {t('payment_method_label', 'طريقة الدفع وتأكيد الحجز')} <span className="text-rose-500">*</span>
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {isRtl ? 'اختر طريقة الدفع المناسبة، يمكنك الدفع كاش في مقر العيادة أو إلكترونياً.' : 'Select payment method: pay cash on arrival or transfer online.'}
                    </p>
                  </div>

                  {/* Payment Methods */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20 text-primary font-black'
                          : 'border-border bg-card text-foreground font-bold hover:border-primary/40'
                      }`}
                    >
                      <Banknote className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                      <span className="text-xs block">{t('cash_at_clinic', 'كاش بالعيادة')}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('instapay')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'instapay'
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20 text-primary font-black'
                          : 'border-border bg-card text-foreground font-bold hover:border-primary/40'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                      <span className="text-xs block">InstaPay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'wallet'
                          ? 'border-primary bg-primary/10 ring-2 ring-primary/20 text-primary font-black'
                          : 'border-border bg-card text-foreground font-bold hover:border-primary/40'
                      }`}
                    >
                      <Wallet className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                      <span className="text-xs block">{t('e_wallet', 'محفظة إلكترونية')}</span>
                    </button>
                  </div>

                  {/* Transfer Details for InstaPay or Wallet */}
                  {paymentMethod !== 'cash' && (
                    <div className="p-4 rounded-2xl bg-secondary/40 border border-border space-y-3 animate-in fade-in duration-200">
                      {/* Price to transfer badge */}
                      <div className="p-3 bg-card rounded-xl border border-primary/20 flex items-center justify-between">
                        <span className="text-xs font-bold text-foreground">{t('required_amount', 'المبلغ المطلوب تحويله:')}</span>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-primary font-mono" dir="ltr">
                            {Number(selectedService?.price || 0).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {t('egp', 'ج.م')}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(String(selectedService?.price || 0))
                              toast.success(isRtl ? 'تم نسخ المبلغ المطلوب!' : 'Amount copied!')
                            }}
                            className="h-7 px-2 text-[10px] font-bold text-primary bg-primary/10 hover:bg-primary/20 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Copy className="w-3 h-3" /> {isRtl ? 'نسخ المبلغ' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-foreground space-y-1">
                        <p>{t('instapay_details_for_branch', 'بيانات التحويل الخاصة بالعيادة:')}</p>
                        <div className="p-3 rounded-xl bg-card border border-border flex justify-between items-center text-xs">
                          <span className="text-muted-foreground font-medium">
                            {paymentMethod === 'instapay' ? (isRtl ? 'عنوان انستاباي IPA:' : 'InstaPay IPA Address:') : (isRtl ? 'رقم المحفظة (فودافون/أورنج كاش):' : 'Mobile Wallet Number:')}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-primary text-sm select-all" dir="ltr">
                              {paymentMethod === 'instapay'
                                ? (clinic?.instapayHandle || clinic?.instapayUsername || clinic?.clinicPhone || 'clinic@instapay')
                                : (clinic?.walletNumber || clinic?.walletPhone || clinic?.clinicPhone || '01012345678')}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                const target = paymentMethod === 'instapay'
                                  ? (clinic?.instapayHandle || clinic?.instapayUsername || clinic?.clinicPhone || 'clinic@instapay')
                                  : (clinic?.walletNumber || clinic?.walletPhone || clinic?.clinicPhone || '01012345678')
                                navigator.clipboard.writeText(target)
                                toast.success(isRtl ? 'تم نسخ رقم/عنوان التحويل!' : 'Account handle copied!')
                              }}
                              className="h-7 px-2 text-[10px] font-bold text-foreground bg-secondary hover:bg-secondary/80 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Copy className="w-3 h-3" /> {isRtl ? 'نسخ' : 'Copy'}
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Transfer Phone / Account */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground flex items-center gap-1">
                          {t('transfer_from_phone_or_account', 'رقم الهاتف أو الحساب المحول منه')} <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          ref={transferNumberRef}
                          type="text"
                          value={transferNumber}
                          onChange={(e) => {
                            setTransferNumber(e.target.value)
                            if (errors.payment) setErrors((prev) => ({ ...prev, payment: undefined }))
                          }}
                          placeholder={isRtl ? 'مثال: 01012345678 أو username@instapay' : '01012345678 or username@instapay'}
                          className={`h-10 text-xs font-mono bg-background border-input text-foreground ${errors.payment ? 'border-rose-500 bg-rose-500/10' : ''}`}
                          dir="ltr"
                        />
                        {errors.payment && (
                          <p className="text-xs text-rose-600 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {errors.payment}
                          </p>
                        )}
                      </div>

                      {/* Optional Receipt Screenshot */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-foreground">
                          {t('upload_proof_optional', 'صورة إيصال التحويل (اختياري)')}
                        </Label>
                        <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-border hover:border-primary bg-card cursor-pointer transition-colors text-xs text-muted-foreground">
                          <Upload className="w-4 h-4 text-muted-foreground" />
                          <span>{transferProofUrl ? (isRtl ? 'تم إرفاق الإيصال بنجاح ✓ (تغيير)' : 'Receipt attached ✓ (change)') : (isRtl ? 'انقر لرفع لقطة شاشة التحويل' : 'Click to upload payment screenshot')}</span>
                          <input type="file" accept="image/*" onChange={handleReceiptProofUpload} className="hidden" />
                        </label>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ==================== STEP 5: REVIEW & SUBMIT ==================== */}
              {step === 5 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-black text-foreground">
                      {isRtl ? 'مراجعة وتأكيد بيانات الحجز' : 'Review & Confirm Booking'}
                    </Label>
                    <p className="text-[11px] text-muted-foreground">
                      {isRtl ? 'يرجى التأكد من صحة بياناتك قبل تأكيد الحجز وإصدار رقم الدور.' : 'Please verify your details before confirming booking and issuing your ticket.'}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-secondary/40 border border-border space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-border">
                      <span className="text-muted-foreground font-medium">{t('branch', 'الفرع')}:</span>
                      <span className="font-bold text-foreground">{selectedBranch?.name || (isRtl ? 'الفرع الرئيسي' : 'Main Branch')}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-border">
                      <span className="text-muted-foreground font-medium">{t('exam_date', 'تاريخ الموعد')}:</span>
                      <span className="font-bold font-mono text-foreground">{selectedDate}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-border">
                      <span className="text-muted-foreground font-medium">{t('patient', 'اسم المريض')}:</span>
                      <span className="font-bold text-foreground">{name}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-border">
                      <span className="text-muted-foreground font-medium">{t('phone_col', 'رقم الهاتف')}:</span>
                      <span className="font-mono font-bold text-foreground" dir="ltr">{phone}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-border">
                      <span className="text-muted-foreground font-medium">{t('patient_age', 'السن')}:</span>
                      <span className="font-bold text-foreground">{age} {isRtl ? 'سنة' : 'years'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-border">
                      <span className="text-muted-foreground font-medium">{t('service', 'الخدمة الطبية')}:</span>
                      <span className="font-bold text-foreground">{selectedService.name}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-border">
                      <span className="text-muted-foreground font-medium">{t('payment_method_label', 'طريقة الدفع')}:</span>
                      <span className="font-bold text-foreground">
                        {paymentMethod === 'cash' ? t('cash_at_clinic', 'كاش بالعيادة') : paymentMethod === 'instapay' ? 'InstaPay' : t('e_wallet', 'محفظة إلكترونية')}
                      </span>
                    </div>

                    {showPrices && (
                      <div className="flex justify-between items-center pt-1 text-sm">
                        <span className="text-foreground font-black">{t('total_due', 'إجمالي التكلفة:')}</span>
                        <span className="text-base font-black text-primary font-mono" dir="ltr">
                          {Number(selectedService.price).toLocaleString(isRtl ? 'ar-EG' : 'en-US')} {t('egp', 'ج.م')}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        {/* MODAL FOOTER BUTTONS (Only before success) */}
        {!successData && (
          <div className="p-4 sm:p-5 bg-card border-t border-border flex items-center justify-between gap-3 shrink-0">
            {step > 1 ? (
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={isSubmitting}
                className="h-10 px-4 text-xs font-bold rounded-xl border-border hover:bg-secondary text-foreground"
              >
                {isRtl ? <ArrowRight className="w-3.5 h-3.5 ml-1.5" /> : <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />}
                {t('back', 'السابق')}
              </Button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <Button
                onClick={handleNext}
                className="h-10 px-6 text-xs font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md shadow-primary/20 cursor-pointer"
              >
                {t('next', 'التالي')}
                {isRtl ? <ArrowLeft className="w-3.5 h-3.5 mr-1.5" /> : <ArrowRight className="w-3.5 h-3.5 ml-1.5" />}
              </Button>
            ) : (
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="h-11 px-8 text-xs font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-lg shadow-primary/25 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 mx-2 animate-spin" />
                    {t('confirming_booking', 'جاري تأكيد الحجز...')}
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 mx-2" />
                    {t('final_confirm_booking', 'تأكيد وإتمام الحجز الآن')}
                  </>
                )}
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
