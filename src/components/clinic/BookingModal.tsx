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
  const primaryColor = clinic?.primaryColor || '#15B8A6'
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
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
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
      const dayNameAr = dayNamesAr[dayIndex]

      if (branchSchedule && branchSchedule.length > 0) {
        const sched = branchSchedule.find((s: any) => s.id === dayKey)
        if (sched && sched.isOpen === false) continue
      }

      const bookedCount = dailyBookingCounts[iso] || 0
      if (maxLimit > 0 && bookedCount >= maxLimit) continue

      let label = dayNameAr
      if (i === 0) label = 'اليوم'
      else if (i === 1) label = 'غداً'

      const formattedDate = `${d.getDate()} ${monthNamesAr[d.getMonth()]}`
      list.push({ iso, label, formattedDate })
      if (list.length >= 7) break
    }

    return list
  }, [selectedBranch, clinic?.weeklySchedule, clinic?.maxDailyBookings, dailyBookingCounts])

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
      { id: '1', name: 'كشف عادي', price: 250, desc: 'كشف شامل مع تشخيص دقيق', duration: '15 دقيقة' },
      { id: '2', name: 'استشارة', price: 150, desc: 'استشارة طبية ومراجعة التحاليل', duration: '10 دقائق' },
      { id: '3', name: 'كشف مستعجل', price: 400, desc: 'أولوية فورية في الدخول', duration: 'فوري مباشر' }
    ]
  }, [services, clinic?.services])

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
        return toast.error('حجم الصورة كبير، يرجى اختيار صورة أقل من 4 ميجابايت')
      }
      const reader = new FileReader()
      reader.onload = () => {
        setTransferProofUrl(reader.result as string)
        toast.success('تم إرفاق إيصال التحويل بنجاح')
      }
      reader.readAsDataURL(file)
    }
  }

  // Strict Validation: Egyptian phone (11 digits starting with 010, 011, 012, 015)
  const egyptianPhoneRegex = /^(010|011|012|015)[0-9]{8}$/

  // Step 1 Validation
  const validateStep1 = () => {
    const errs: typeof errors = {}
    if (!selectedBranch) errs.branch = 'يرجى اختيار فرع العيادة'
    if (!selectedDate) errs.date = 'يرجى اختيار تاريخ الموعد'

    setErrors(errs)
    if (Object.keys(errs).length > 0) {
      toast.error('يرجى تصحيح الأخطاء للمتابعة')
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
      errs.name = 'اسم المريض مطلوب'
    } else if (trimmedName.split(/\s+/).length < 2) {
      errs.name = 'يرجى كتابة الاسم ثنائياً على الأقل'
    }

    if (!cleanPhone) {
      errs.phone = 'رقم الهاتف مطلوب للتواصل وتتبع الدور'
    } else if (!egyptianPhoneRegex.test(cleanPhone)) {
      errs.phone = 'رقم هاتف غير صحيح (يجب أن يكون 11 رقم ويبدأ بـ 010 أو 011 أو 012 أو 015)'
    }

    if (!age.trim()) {
      errs.age = 'العمر مطلوب لكتابة الجرعات الطبية بدقة'
    } else if (isNaN(numAge) || numAge < 1 || numAge > 120) {
      errs.age = 'يرجى كتابة عمر صحيح بين 1 و 120'
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
      errs.payment = 'يرجى كتابة رقم الهاتف أو الحساب المحول منه لتأكيد الحجز'
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

      toast.success(`تم تأكيد الحجز بنجاح! دورك رقم #${myQueueNumber}`)
    } catch (err) {
      console.error('Error submitting appointment:', err)
      toast.error('حدث خطأ أثناء تأكيد الحجز، يرجى المحاولة ثانيةً')
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
    toast.success('تم نسخ رابط تتبع الدور')
    setTimeout(() => setIsCopied(false), 2000)
  }

  // Go to tracking page
  const handleGoToTracking = () => {
    if (!successData) return
    onClose()
    router.push(`/clinic/${clinic?.slug}/track/${successData.appointmentId}`)
  }

  if (!isOpen) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      dir="rtl"
      onClick={handleClose}
    >
      <div
        className="w-full h-full sm:h-auto sm:max-h-[90vh] sm:max-w-2xl bg-white sm:rounded-3xl shadow-2xl flex flex-col overflow-hidden border border-[#E5EAF0] animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* MODAL HEADER */}
        <div className="p-4 sm:p-6 bg-gradient-to-r from-[#0B1F33] to-[#132B45] text-white flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#15B8A6]/20 text-[#15B8A6] border border-[#15B8A6]/30 flex items-center justify-center font-bold">
              <Calendar className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-black text-white">
                {successData ? 'تم تسجيل الحجز بنجاح' : 'حجز موعد طبي جديد'}
              </h2>
              <p className="text-[11px] text-slate-300">
                {clinic?.clinicName || clinic?.doctorName ? `عيادة ${clinic.doctorName || clinic.clinicName}` : 'العيادة الطبية'}
              </p>
            </div>
          </div>

          <button
            onClick={handleClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            title="إغلاق"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* STEP PROGRESS BAR (Shown only before success) */}
        {!successData && (
          <div className="px-4 sm:px-6 pt-4 pb-2 bg-slate-50 border-b border-[#E5EAF0] shrink-0">
            <div className="flex items-center justify-between text-xs font-bold text-slate-500 mb-2">
              <span className={step >= 1 ? 'text-[#15B8A6]' : ''}>1. الفرع واليوم</span>
              <span className={step >= 2 ? 'text-[#15B8A6]' : ''}>2. البيانات</span>
              <span className={step >= 3 ? 'text-[#15B8A6]' : ''}>3. الخدمة</span>
              <span className={step >= 4 ? 'text-[#15B8A6]' : ''}>4. الدفع</span>
              <span className={step >= 5 ? 'text-[#15B8A6]' : ''}>5. التأكيد</span>
            </div>
            <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-[#15B8A6] transition-all duration-300 rounded-full"
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
              <div className="w-20 h-20 bg-teal-50 border-4 border-teal-100 text-[#15B8A6] rounded-full flex items-center justify-center mx-auto shadow-md animate-in zoom-in-75 duration-300">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div className="space-y-1">
                <h3 className="text-2xl font-black text-[#182230]">مرحباً {name}، تم تأكيد حجزك!</h3>
                <p className="text-xs sm:text-sm text-slate-500">
                  تم إدراجك في قائمة الانتظار لدى: <strong className="text-slate-700">{successData.branchName}</strong>
                </p>
              </div>

              {/* Big Queue Number Card */}
              <div className="p-6 bg-gradient-to-br from-teal-50 to-emerald-50 border-2 border-teal-200 rounded-3xl max-w-sm mx-auto shadow-sm space-y-2">
                <p className="text-xs font-bold text-slate-500">رقمك في دور اليوم</p>
                <div className="text-6xl font-black text-[#15B8A6] tracking-tight">
                  #{successData.queueNumber}
                </div>
                <div className="pt-2 border-t border-teal-200/60 flex items-center justify-center gap-2 text-xs font-bold text-slate-600">
                  <Users className="w-4 h-4 text-teal-600" />
                  <span>عدد الحالات أمامك في الانتظار: {successData.aheadCount}</span>
                </div>
              </div>

              {/* Patient Alert Message */}
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-right flex items-start gap-3 max-w-md mx-auto">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-xs text-amber-800 space-y-1">
                  <p className="font-bold">تنبيه هام لمتابعة دورك:</p>
                  <p className="leading-relaxed">
                    يرجى فتح صفحة التتبع اللحظي ومتابعة نداء الطبيب لمعرفة متى يحين دورك مباشرة دون الحاجة للانتظار الطويل في العيادة.
                  </p>
                </div>
              </div>

              {/* Direct Tracking Actions */}
              <div className="space-y-2 max-w-md mx-auto pt-2">
                <Button
                  onClick={handleGoToTracking}
                  className="w-full h-12 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-black text-sm rounded-xl shadow-lg shadow-[#15B8A6]/25 cursor-pointer"
                >
                  <ExternalLink className="w-4 h-4 ml-2" />
                  تتبع دورك لحظياً الآن
                </Button>

                <Button
                  variant="outline"
                  onClick={handleCopyTrackingLink}
                  className="w-full h-11 border-slate-200 hover:bg-slate-50 text-slate-700 font-bold text-xs rounded-xl"
                >
                  {isCopied ? <Check className="w-4 h-4 ml-2 text-emerald-600" /> : <Copy className="w-4 h-4 ml-2" />}
                  {isCopied ? 'تم نسخ الرابط بنجاح!' : 'نسخ رابط تتبع الدور'}
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
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Building2 className="w-4 h-4 text-[#15B8A6]" />
                      اختيار فرع العيادة <span className="text-rose-500">*</span>
                    </Label>

                    {branches.length === 0 ? (
                      <div className="p-4 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400">
                        جاري تحميل الفروع...
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
                              className={`p-3.5 rounded-2xl border text-right transition-all flex items-start justify-between cursor-pointer ${
                                isSelected
                                  ? 'border-[#15B8A6] bg-teal-50/50 ring-2 ring-[#15B8A6]/20'
                                  : 'border-[#E5EAF0] bg-white hover:border-slate-300'
                              } ${b.isOpen === false ? 'opacity-60' : ''}`}
                            >
                              <div className="space-y-1">
                                <p className="font-black text-sm text-[#182230]">{b.name}</p>
                                <p className="text-[11px] text-slate-400 flex items-center gap-1">
                                  <MapPin className="w-3 h-3 text-slate-400" />
                                  {b.address || 'العنوان الرئيسي للعيادة'}
                                </p>
                              </div>
                              <span
                                className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                                  b.isOpen !== false
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {b.isOpen !== false ? 'متاح' : 'مغلق'}
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
                  <div className="space-y-2 pt-2 border-t border-slate-100">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                      <Calendar className="w-4 h-4 text-[#15B8A6]" />
                      اختيار يوم الحجز <span className="text-rose-500">*</span>
                    </Label>

                    {availableDays.length === 0 ? (
                      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50 text-amber-800 text-xs font-bold">
                        لا توجد مواعيد متاحة في هذا الفرع حالياً، يرجى اختيار فرع آخر أو التواصل مع العيادة.
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
                                  ? 'border-[#15B8A6] bg-[#15B8A6] text-white shadow-md shadow-[#15B8A6]/20 font-bold'
                                  : 'border-[#E5EAF0] bg-white hover:border-slate-300 text-slate-700 font-medium'
                              }`}
                            >
                              <span className="block text-xs font-bold">{d.label}</span>
                              <span className={`block text-[11px] mt-0.5 ${isSelected ? 'text-teal-100' : 'text-slate-400'}`}>
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
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      اسم المريض بالكامل <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <User className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
                      <Input
                        ref={nameInputRef}
                        type="text"
                        value={name}
                        onChange={(e) => {
                          setName(e.target.value)
                          if (errors.name) setErrors((prev) => ({ ...prev, name: undefined }))
                        }}
                        placeholder="مثال: أحمد محمد علي"
                        className={`h-11 pr-10 rounded-xl text-sm ${
                          errors.name ? 'border-rose-500 ring-1 ring-rose-500/20 bg-rose-50/20' : ''
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
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      رقم هاتف المريض (واتساب) <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Phone className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
                        className={`h-11 pr-10 rounded-xl text-sm font-mono text-right ${
                          errors.phone ? 'border-rose-500 ring-1 ring-rose-500/20 bg-rose-50/20' : ''
                        }`}
                      />
                    </div>
                    {errors.phone ? (
                      <p className="text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.phone}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        11 رقم مصري (يبدأ بـ 010 أو 011 أو 012 أو 015) لاستلام إشعار الدور وتتبعه.
                      </p>
                    )}
                  </div>

                  {/* Age field (Required) */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                      السن (إجباري للروشتة) <span className="text-rose-500">*</span>
                    </Label>
                    <div className="relative">
                      <Clock className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
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
                        placeholder="مثال: 32"
                        className={`h-11 pr-10 rounded-xl text-sm ${
                          errors.age ? 'border-rose-500 ring-1 ring-rose-500/20 bg-rose-50/20' : ''
                        }`}
                      />
                    </div>
                    {errors.age ? (
                      <p className="text-xs text-rose-600 flex items-center gap-1">
                        <AlertCircle className="w-3.5 h-3.5 shrink-0" /> {errors.age}
                      </p>
                    ) : (
                      <p className="text-[11px] text-slate-400">
                        السن مطلوب حتى يتمكن الطبيب من تحديد الجرعات المناسبة بالروشتة.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* ==================== STEP 3: SERVICE ==================== */}
              {step === 3 && (
                <div className="space-y-4">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      اختر الخدمة الطبية المطلوبة <span className="text-rose-500">*</span>
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      حدد نوع الكشف أو الخدمة للاطلاع على السعر ووقت الزيارة.
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
                          className={`w-full p-4 rounded-2xl border text-right transition-all flex items-center justify-between cursor-pointer ${
                            isSelected
                              ? 'border-[#15B8A6] bg-teal-50/50 ring-2 ring-[#15B8A6]/20'
                              : 'border-[#E5EAF0] bg-white hover:border-slate-300'
                          }`}
                        >
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <h4 className="font-black text-sm text-[#182230]">{service.name}</h4>
                              {service.duration && (
                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600">
                                  {service.duration}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-slate-400">{service.desc || 'كشف طبي شامل'}</p>
                          </div>

                          {showPrices && (
                            <div className="text-left shrink-0">
                              <span className="text-lg font-black text-[#15B8A6]">
                                {service.price} <span className="text-xs font-bold text-slate-500">ج.م</span>
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
                  <div className="p-4 rounded-2xl bg-teal-50/80 border border-teal-200 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-bold text-teal-800">الخدمة المختارة:</p>
                      <p className="text-sm font-black text-slate-900">{selectedService?.name || 'كشف طبي'}</p>
                    </div>
                    <div className="text-left">
                      <p className="text-[11px] font-bold text-teal-700">المبلغ المطلوب سداده:</p>
                      <p className="text-xl font-black text-teal-700">
                        {selectedService?.price || 0} <span className="text-xs font-bold text-slate-600">ج.م</span>
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-slate-700">
                      طريقة الدفع وتأكيد الحجز <span className="text-rose-500">*</span>
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      اختر طريقة الدفع المناسبة، يمكنك الدفع كاش في مقر العيادة أو إلكترونياً.
                    </p>
                  </div>

                  {/* Payment Methods */}
                  <div className="grid grid-cols-3 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-[#15B8A6] bg-teal-50/50 ring-2 ring-[#15B8A6]/20 text-[#15B8A6] font-black'
                          : 'border-[#E5EAF0] bg-white text-slate-700 font-bold hover:border-slate-300'
                      }`}
                    >
                      <Banknote className="w-5 h-5 mx-auto mb-1 text-emerald-600" />
                      <span className="text-xs block">كاش بالعيادة</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('instapay')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'instapay'
                          ? 'border-[#15B8A6] bg-teal-50/50 ring-2 ring-[#15B8A6]/20 text-[#15B8A6] font-black'
                          : 'border-[#E5EAF0] bg-white text-slate-700 font-bold hover:border-slate-300'
                      }`}
                    >
                      <CreditCard className="w-5 h-5 mx-auto mb-1 text-purple-600" />
                      <span className="text-xs block">انستاباي InstaPay</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`p-3.5 rounded-2xl border text-center transition-all cursor-pointer ${
                        paymentMethod === 'wallet'
                          ? 'border-[#15B8A6] bg-teal-50/50 ring-2 ring-[#15B8A6]/20 text-[#15B8A6] font-black'
                          : 'border-[#E5EAF0] bg-white text-slate-700 font-bold hover:border-slate-300'
                      }`}
                    >
                      <Wallet className="w-5 h-5 mx-auto mb-1 text-rose-600" />
                      <span className="text-xs block">محفظة إلكترونية</span>
                    </button>
                  </div>

                  {/* Transfer Details for InstaPay or Wallet */}
                  {paymentMethod !== 'cash' && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3 animate-in fade-in duration-200">
                      {/* Price to transfer badge */}
                      <div className="p-3 bg-white rounded-xl border border-teal-200 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-700">المبلغ المطلوب تحويله:</span>
                        <div className="flex items-center gap-2">
                          <span className="text-base font-black text-teal-700 font-mono">
                            {selectedService?.price || 0} ج.م
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(String(selectedService?.price || 0))
                              toast.success('تم نسخ المبلغ المطلوب!')
                            }}
                            className="h-7 px-2 text-[10px] font-bold text-teal-700 bg-teal-50 hover:bg-teal-100 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                          >
                            <Copy className="w-3 h-3" /> نسخ المبلغ
                          </button>
                        </div>
                      </div>

                      <div className="text-xs font-bold text-slate-700 space-y-1">
                        <p>بيانات التحويل الخاصة بالعيادة:</p>
                        <div className="p-3 rounded-xl bg-white border border-slate-200 flex justify-between items-center text-xs">
                          <span className="text-slate-500 font-medium">
                            {paymentMethod === 'instapay' ? 'عنوان انستاباي IPA:' : 'رقم المحفظة (فودافون/أورنج كاش):'}
                          </span>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-black text-[#15B8A6] text-sm select-all">
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
                                toast.success('تم نسخ رقم/عنوان التحويل!')
                              }}
                              className="h-7 px-2 text-[10px] font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors"
                            >
                              <Copy className="w-3 h-3" /> نسخ
                            </button>
                          </div>
                        </div>
                      </div>

                      {/* Transfer Phone / Account */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                          رقم الهاتف أو الحساب المحول منه <span className="text-rose-500">*</span>
                        </Label>
                        <Input
                          ref={transferNumberRef}
                          type="text"
                          value={transferNumber}
                          onChange={(e) => {
                            setTransferNumber(e.target.value)
                            if (errors.payment) setErrors((prev) => ({ ...prev, payment: undefined }))
                          }}
                          placeholder="مثال: 01012345678 أو username@instapay"
                          className={`h-10 text-xs font-mono ${errors.payment ? 'border-rose-500 bg-rose-50/20' : ''}`}
                        />
                        {errors.payment && (
                          <p className="text-xs text-rose-600 flex items-center gap-1">
                            <AlertCircle className="w-3.5 h-3.5" /> {errors.payment}
                          </p>
                        )}
                      </div>

                      {/* Optional Receipt Screenshot */}
                      <div className="space-y-1.5">
                        <Label className="text-xs font-bold text-slate-700">
                          صورة إيصال التحويل (اختياري)
                        </Label>
                        <label className="flex items-center justify-center gap-2 p-3 rounded-xl border border-dashed border-slate-300 hover:border-[#15B8A6] bg-white cursor-pointer transition-colors text-xs text-slate-600">
                          <Upload className="w-4 h-4 text-slate-400" />
                          <span>{transferProofUrl ? 'تم إرفاق الإيصال بنجاح ✓ (تغيير)' : 'انقر لرفع لقطة شاشة التحويل'}</span>
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
                    <Label className="text-xs font-black text-slate-800">
                      مراجعة وتأكيد بيانات الحجز
                    </Label>
                    <p className="text-[11px] text-slate-400">
                      يرجى التأكد من صحة بياناتك قبل تأكيد الحجز وإصدار رقم الدور.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-slate-50 border border-[#E5EAF0] space-y-3 text-xs">
                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">الفرع:</span>
                      <span className="font-bold text-[#182230]">{selectedBranch?.name || 'الفرع الرئيسي'}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">تاريخ الموعد:</span>
                      <span className="font-bold text-[#182230]">{selectedDate}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">اسم المريض:</span>
                      <span className="font-bold text-[#182230]">{name}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">رقم الهاتف:</span>
                      <span className="font-mono font-bold text-[#182230]">{phone}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">السن:</span>
                      <span className="font-bold text-[#182230]">{age} سنة</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">الخدمة الطبية:</span>
                      <span className="font-bold text-[#182230]">{selectedService.name}</span>
                    </div>

                    <div className="flex justify-between items-center py-1 border-b border-slate-200">
                      <span className="text-slate-500 font-medium">طريقة الدفع:</span>
                      <span className="font-bold text-slate-700">
                        {paymentMethod === 'cash' ? 'كاش بالعيادة' : paymentMethod === 'instapay' ? 'انستاباي InstaPay' : 'محفظة إلكترونية'}
                      </span>
                    </div>

                    {showPrices && (
                      <div className="flex justify-between items-center pt-1 text-sm">
                        <span className="text-slate-800 font-black">إجمالي التكلفة:</span>
                        <span className="text-base font-black text-[#15B8A6]">
                          {selectedService.price} ج.م
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
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-[#E5EAF0] flex items-center justify-between gap-3 shrink-0">
            {step > 1 ? (
              <Button
                variant="outline"
                onClick={handlePrev}
                disabled={isSubmitting}
                className="h-10 px-4 text-xs font-bold rounded-xl"
              >
                <ArrowRight className="w-3.5 h-3.5 ml-1.5" />
                السابق
              </Button>
            ) : (
              <div />
            )}

            {step < 5 ? (
              <Button
                onClick={handleNext}
                className="h-10 px-6 text-xs font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/20 cursor-pointer"
              >
                التالي
                <ArrowLeft className="w-3.5 h-3.5 mr-1.5" />
              </Button>
            ) : (
              <Button
                onClick={handleFinalSubmit}
                disabled={isSubmitting}
                className="h-11 px-8 text-xs font-black bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-lg shadow-[#15B8A6]/25 cursor-pointer"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري تأكيد الحجز...
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 ml-2" />
                    تأكيد وإتمام الحجز الآن
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
