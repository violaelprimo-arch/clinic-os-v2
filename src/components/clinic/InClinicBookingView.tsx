'use client'

import { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, onSnapshot, doc, getDoc } from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Calendar, Clock, User, Phone, CheckCircle2, AlertCircle,
  Copy, MessageCircle, ExternalLink, RefreshCw, Plus, Users,
  Sparkles, Stethoscope, Building2, CreditCard, Banknote, Wallet,
  ShieldCheck, Lock, UserPlus, FileText, Check, ArrowRight
} from 'lucide-react'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import {
  CountryInfo,
  DEFAULT_COUNTRY,
  parsePhoneAndCountry,
  validatePhoneNumber,
  normalizePhoneDigits
} from '@/lib/countryPhoneHelper'
import { ResidentialAreaSelector, ResidentialAreaValue } from '@/components/common/ResidentialAreaSelector'
import { openManualWhatsAppChat, formatInClinicBookingWhatsAppMessage } from '@/lib/whatsappShare'
import { Branch } from '@/types/clinic'
import { getClinicBranches, ensureClinicHasMainBranch } from '@/lib/branchService'
import Link from 'next/link'

interface PatientMatch {
  name: string
  phone: string
  age?: string | null
  gender?: string | null
  dob?: string | null
  residence?: any
  lastVisit?: string | null
  visitsCount?: number
  lastService?: string
}

export function InClinicBookingView({
  clinic,
  slug,
  role,
  lockedBranchId: propLockedBranchId
}: {
  clinic: any
  slug: string
  role?: string | null
  lockedBranchId?: string | null
}) {
  const { dir, t, isRtl } = useLanguage()

  // 1. Assistant Branch Lock Enforcement
  const effectiveLockedBranchId = useMemo(() => {
    if (propLockedBranchId) return propLockedBranchId
    if (typeof window !== 'undefined' && role === 'assistant') {
      return localStorage.getItem('clinic_locked_branch') || null
    }
    return null
  }, [propLockedBranchId, role])

  // Branches
  const [branches, setBranches] = useState<Branch[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('')
  const [loadingBranches, setLoadingBranches] = useState(true)

  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const clinicId = clinic.id || clinic.slug

    const loadBranches = async () => {
      try {
        await ensureClinicHasMainBranch(clinic)
        const list = await getClinicBranches(clinicId)
        const activeList = list.filter((b) => !b.isArchived)
        setBranches(activeList)

        if (effectiveLockedBranchId) {
          setSelectedBranchId(effectiveLockedBranchId)
        } else if (activeList.length > 0) {
          setSelectedBranchId((prev) => prev || activeList[0].id)
        }
      } catch (err) {
        console.error('Error fetching branches:', err)
      } finally {
        setLoadingBranches(false)
      }
    }
    loadBranches()
  }, [clinic, effectiveLockedBranchId])

  // Services from Clinic Database
  const services = useMemo(() => {
    if (Array.isArray(clinic?.services) && clinic.services.length > 0) {
      return clinic.services
    }
    return [
      { id: '1', name: 'كشف عادي', price: 250, duration: 15 },
      { id: '2', name: 'استشارة', price: 150, duration: 10 },
      { id: '3', name: 'كشف مستعجل', price: 400, duration: 20, isUrgent: true },
      { id: '4', name: 'متابعة دورية', price: 100, duration: 10 }
    ]
  }, [clinic?.services])

  // Form State
  const [phone, setPhone] = useState('')
  const [selectedCountry, setSelectedCountry] = useState<CountryInfo>(DEFAULT_COUNTRY)
  const [patientName, setPatientName] = useState('')
  const [age, setAge] = useState('')
  const [dob, setDob] = useState('')
  const [gender, setGender] = useState<'ذكر' | 'أنثى'>('أنثى')
  const [residence, setResidence] = useState<ResidentialAreaValue | null>(null)
  const [selectedServiceId, setSelectedServiceId] = useState<string>('')
  const [bookingDate, setBookingDate] = useState(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
  })
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'wallet'>('cash')
  const [paymentStatus, setPaymentStatus] = useState<'unpaid' | 'paid'>('unpaid')
  const [internalNotes, setInternalNotes] = useState('')

  // Search State for Phone Autocomplete & Family Members
  const [isSearchingPhone, setIsSearchingPhone] = useState(false)
  const [matchedPatients, setMatchedPatients] = useState<PatientMatch[]>([])
  const [selectedFamilyMemberIndex, setSelectedFamilyMemberIndex] = useState<number | null>(null)
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Selected Service Details
  const selectedService = useMemo(() => {
    return services.find((s: any) => String(s.id) === String(selectedServiceId)) || services[0]
  }, [services, selectedServiceId])

  useEffect(() => {
    if (services.length > 0 && !selectedServiceId) {
      setSelectedServiceId(String(services[0].id))
    }
  }, [services, selectedServiceId])

  // Selected Branch Details
  const selectedBranch = useMemo(() => {
    return branches.find((b) => b.id === selectedBranchId) || branches[0]
  }, [branches, selectedBranchId])

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [bookingConfirmedResult, setBookingConfirmedResult] = useState<any | null>(null)

  // Age / DOB Bidirectional Linking
  const handleAgeChange = (val: string) => {
    setAge(val)
    if (val && !isNaN(Number(val))) {
      const year = new Date().getFullYear() - parseInt(val)
      setDob(`${year}-01-01`)
    } else {
      setDob('')
    }
  }

  const handleDobChange = (val: string) => {
    setDob(val)
    if (val) {
      const birthYear = new Date(val).getFullYear()
      const currentYear = new Date().getFullYear()
      if (birthYear > 1900 && birthYear <= currentYear) {
        setAge(String(currentYear - birthYear))
      }
    }
  }

  // 2. Debounced Search when phone changes
  const searchPhone = useCallback(
    async (phoneInput: string) => {
      const clean = phoneInput.trim().replace(/\s+/g, '')
      const digitsOnly = normalizePhoneDigits(clean).replace(/[^0-9]/g, '')

      if (digitsOnly.length < 7) {
        setMatchedPatients([])
        setSelectedFamilyMemberIndex(null)
        return
      }

      setIsSearchingPhone(true)
      try {
        const token = localStorage.getItem('clinic_session_token') || ''
        const res = await fetch(
          `/api/clinic/${encodeURIComponent(slug)}/patients/search?phone=${encodeURIComponent(clean)}`,
          {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
          }
        )
        const data = await res.json()

        if (data.success && Array.isArray(data.patients)) {
          setMatchedPatients(data.patients)
          // If only 1 match and name not yet typed, auto-fill it gently
          if (data.patients.length === 1 && !patientName) {
            const p = data.patients[0]
            setPatientName(p.name)
            if (p.age) handleAgeChange(p.age)
            if (p.gender === 'ذكر' || p.gender === 'أنثى') setGender(p.gender)
            if (p.residence) setResidence(p.residence)
            setSelectedFamilyMemberIndex(0)
          }
        } else {
          setMatchedPatients([])
        }
      } catch (err) {
        console.error('Patient phone search error:', err)
      } finally {
        setIsSearchingPhone(false)
      }
    },
    [slug, patientName]
  )

  const handlePhoneInputChange = (newPhoneVal: string) => {
    setPhone(newPhoneVal)
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current)
    searchTimeoutRef.current = setTimeout(() => {
      searchPhone(newPhoneVal)
    }, 450)
  }

  // Pick a specific family member from the multiple matches
  const handleSelectFamilyMember = (index: number) => {
    const member = matchedPatients[index]
    if (!member) return
    setSelectedFamilyMemberIndex(index)
    setPatientName(member.name)
    if (member.age) handleAgeChange(member.age)
    if (member.gender === 'ذكر' || member.gender === 'أنثى') setGender(member.gender)
    if (member.residence) setResidence(member.residence)
    toast.info(isRtl ? `تم اختيار بيانات: ${member.name}` : `Selected: ${member.name}`)
  }

  // Clear fields to add a new family member under same phone
  const handleAddNewFamilyMember = () => {
    setSelectedFamilyMemberIndex(null)
    setPatientName('')
    setAge('')
    setDob('')
    setResidence(null)
    toast.info(
      isRtl
        ? 'تم تجهيز النموذج لإضافة فرد جديد لنفس رقم الهاتف'
        : 'Form ready for new family member with same phone'
    )
  }

  // 3. Form Submit Handler
  const handleConfirmBooking = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!patientName.trim()) {
      return toast.error(isRtl ? 'يرجى إدخال اسم المريض' : 'Patient name is required')
    }

    if (!phone.trim()) {
      return toast.error(isRtl ? 'يرجى إدخال رقم هاتف المريض' : 'Patient phone is required')
    }

    if (!validatePhoneNumber(phone, selectedCountry)) {
      return toast.error(
        isRtl
          ? `يرجى إدخال رقم هاتف صحيح لـ ${selectedCountry.nameAr}`
          : 'Please enter a valid phone number'
      )
    }

    if (!selectedBranchId) {
      return toast.error(isRtl ? 'يرجى اختيار الفرع' : 'Please select branch')
    }

    setIsSubmitting(true)
    try {
      const token = localStorage.getItem('clinic_session_token') || ''
      const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/in-clinic-booking`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {})
        },
        body: JSON.stringify({
          patientName: patientName.trim(),
          phone: phone.trim(),
          age: age.trim() || undefined,
          birthDate: dob || undefined,
          gender,
          branchId: selectedBranchId,
          serviceId: selectedService?.id,
          date: bookingDate,
          paymentMethod,
          paymentStatus,
          notes: internalNotes.trim() || undefined,
          residence: residence?.governorateId ? residence : undefined
        })
      })

      const data = await res.json()

      if (!res.ok || !data.success) {
        throw new Error(data.error || (isRtl ? 'تعذر تأكيد الحجز' : 'Failed to confirm booking'))
      }

      toast.success(isRtl ? 'تم تسجيل الحجز بنجاح وتوليد رقم الدور!' : 'Booking confirmed successfully!')
      setBookingConfirmedResult(data.appointment)
    } catch (err: any) {
      console.error('Booking submission error:', err)
      toast.error(err.message || (isRtl ? 'حدث خطأ أثناء تأكيد الحجز' : 'Error submitting booking'))
    } finally {
      setIsSubmitting(false)
    }
  }

  // 4. WhatsApp & Copy Helpers
  const baseUrl = typeof window !== 'undefined' ? window.location.origin : ''
  const trackUrl = `${baseUrl}/clinic/${encodeURIComponent(slug)}/track`
  const patientPortalUrl = `${baseUrl}/clinic/${encodeURIComponent(slug)}/patient`

  const confirmationMessage = useMemo(() => {
    if (!bookingConfirmedResult) return ''
    return formatInClinicBookingWhatsAppMessage({
      clinicName: clinic?.clinicName || (isRtl ? 'يلا كلينيك' : 'Yalla Clinic'),
      serviceName: bookingConfirmedResult.serviceName,
      branchName: bookingConfirmedResult.branchName,
      bookingDate: bookingConfirmedResult.date,
      queueNumber: bookingConfirmedResult.queueNumber,
      trackUrl,
      patientPortalUrl
    })
  }, [bookingConfirmedResult, clinic?.clinicName, trackUrl, patientPortalUrl, isRtl])

  const handleOpenWhatsApp = () => {
    if (!bookingConfirmedResult?.phone) return

    openManualWhatsAppChat({
      phone: bookingConfirmedResult.phone,
      message: confirmationMessage
    })

    toast.success(
      isRtl
        ? 'تم فتح واتساب بنجاح، يمكنك الآن الضغط على زر الإرسال داخل التطبيق'
        : 'WhatsApp chat opened, you can now press Send in the app'
    )
  }

  const handleCopyMessage = () => {
    if (!confirmationMessage) return
    navigator.clipboard.writeText(confirmationMessage).then(
      () => {
        toast.success(isRtl ? 'تم نسخ رسالة المتابعة بنجاح!' : 'Message copied to clipboard!')
      },
      () => {
        toast.error(isRtl ? 'تعذر نسخ الرسالة' : 'Could not copy message')
      }
    )
  }

  const handleResetForNewBooking = () => {
    setBookingConfirmedResult(null)
    setPatientName('')
    setPhone('')
    setAge('')
    setDob('')
    setInternalNotes('')
    setPaymentStatus('unpaid')
    setMatchedPatients([])
    setSelectedFamilyMemberIndex(null)
    setResidence(null)
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir={dir}>
      {/* Page Title & Breadcrumb Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border shadow-xs">
        <div>
          <div className="inline-flex items-center gap-2 px-2.5 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-black mb-1">
            <UserPlus className="w-3.5 h-3.5" />
            <span>{isRtl ? 'الاستقبال والحجز الداخلي' : 'In-Clinic Walk-In Reception'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-foreground">
            {isRtl ? 'تسجيل حجز مريض داخل العيادة' : 'Register In-Clinic Walk-in Patient'}
          </h2>
          <p className="text-xs text-muted-foreground mt-0.5">
            {isRtl
              ? 'تسجيل حجز لمريض حضر للعيادة أو تواصل هاتفياً، وتخصيص رقم الدور، وتجهيز رسالة المتابعة عبر واتساب.'
              : 'Register in-person or phone bookings, allocate queue numbers, and prepare WhatsApp tracking.'}
          </p>
        </div>

        <Link
          href={`/clinic/${slug}/admin`}
          className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border border-border hover:bg-secondary transition-colors shrink-0"
        >
          <span>{isRtl ? 'العودة للوحة اليوم' : 'Return to Queue'}</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* Confirmation View (Rendered after successful booking) */}
      {bookingConfirmedResult ? (
        <Card className="border-2 border-emerald-500/40 bg-gradient-to-br from-emerald-500/[0.08] via-card to-background shadow-xl rounded-3xl overflow-hidden p-6 space-y-6 animate-in fade-in zoom-in-95 duration-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/80 pb-5">
            <div className="flex items-center gap-3.5">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <div>
                <span className="text-xs font-black text-emerald-600 dark:text-emerald-400">
                  {isRtl ? 'تم تأكيد الحجز وإدراجه في الطابور بنجاح' : 'Booking Successfully Confirmed & Queued'}
                </span>
                <h3 className="text-xl font-black text-foreground">
                  {bookingConfirmedResult.patientName}
                </h3>
                <p className="text-xs font-mono text-muted-foreground">{bookingConfirmedResult.phone}</p>
              </div>
            </div>

            {/* Ticket Badge */}
            <div className="text-start sm:text-end p-3 rounded-2xl bg-card border border-border shrink-0">
              <span className="text-[11px] font-bold text-muted-foreground block">
                {isRtl ? 'رقم تذكرة الدور المخصص' : 'Allocated Ticket #'}
              </span>
              <strong className="text-3xl font-black text-primary font-mono block">
                #{bookingConfirmedResult.queueNumber}
              </strong>
            </div>
          </div>

          {/* Details Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-0.5">
              <span className="text-muted-foreground block">{isRtl ? 'الخدمة' : 'Service'}</span>
              <strong className="font-bold text-foreground block truncate">
                {bookingConfirmedResult.serviceName}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-0.5">
              <span className="text-muted-foreground block">{isRtl ? 'الفرع' : 'Branch'}</span>
              <strong className="font-bold text-foreground block truncate">
                {bookingConfirmedResult.branchName}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-0.5">
              <span className="text-muted-foreground block">{isRtl ? 'تاريخ الحجز' : 'Date'}</span>
              <strong className="font-bold text-foreground block">
                {bookingConfirmedResult.date}
              </strong>
            </div>

            <div className="p-3 rounded-xl bg-secondary/50 border border-border space-y-0.5">
              <span className="text-muted-foreground block">{isRtl ? 'حالة السداد' : 'Payment Status'}</span>
              <Badge
                className={`text-[10px] font-black ${
                  bookingConfirmedResult.paymentStatus === 'paid'
                    ? 'bg-emerald-600 text-white'
                    : 'bg-amber-600 text-white'
                }`}
              >
                {bookingConfirmedResult.paymentStatus === 'paid'
                  ? (isRtl ? 'تم التحصيل (مدفوع)' : 'Paid')
                  : (isRtl ? 'غير مدفوع' : 'Unpaid')}
              </Badge>
            </div>
          </div>

          {/* Message Preview Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-foreground">
                {isRtl ? 'نص رسالة المتابعة الجاهزة للإرسال:' : 'Ready-to-Send WhatsApp Tracking Message:'}
              </span>
              <button
                type="button"
                onClick={handleCopyMessage}
                className="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>{isRtl ? 'نسخ النص' : 'Copy Text'}</span>
              </button>
            </div>
            <pre className="p-4 rounded-2xl bg-muted/60 border border-border text-xs leading-relaxed text-foreground whitespace-pre-wrap font-sans select-all">
              {confirmationMessage}
            </pre>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
            <Button
              type="button"
              onClick={handleOpenWhatsApp}
              className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-black text-sm flex-1 gap-2 shadow-md shadow-emerald-600/20 active:scale-95 transition-all"
            >
              <MessageCircle className="w-5 h-5" />
              <span>{isRtl ? 'إرسال روابط المتابعة عبر واتساب' : 'Send Tracking Links via WhatsApp'}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={handleCopyMessage}
              className="h-12 px-5 rounded-2xl font-bold text-xs gap-2"
            >
              <Copy className="w-4 h-4" />
              <span>{isRtl ? 'نسخ رسالة المتابعة' : 'Copy Message'}</span>
            </Button>

            <Button
              type="button"
              variant="secondary"
              onClick={handleResetForNewBooking}
              className="h-12 px-5 rounded-2xl font-bold text-xs gap-2"
            >
              <Plus className="w-4 h-4" />
              <span>{isRtl ? 'حجز مريض آخر' : 'Book Another Patient'}</span>
            </Button>
          </div>

          {/* Verification & Test Links */}
          <div className="border-t border-border/80 pt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
            <span>{isRtl ? 'روابط فحص التجربة للمريض:' : 'Test links for verification:'}</span>
            <div className="flex items-center gap-4">
              <a
                href={`${trackUrl}?phone=${encodeURIComponent(bookingConfirmedResult.phone)}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-bold flex items-center gap-1"
              >
                <span>{isRtl ? 'فتح رابط تتبع الدور' : 'Open Live Turn Link'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>

              <a
                href={patientPortalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline font-bold flex items-center gap-1"
              >
                <span>{isRtl ? 'فتح بوابة المريض' : 'Open Patient Portal'}</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            </div>
          </div>
        </Card>
      ) : (
        /* Booking Form Card */
        <Card className="border border-border bg-card shadow-sm rounded-3xl p-6 sm:p-8 space-y-6">
          <form onSubmit={handleConfirmBooking} className="space-y-6">
            {/* Step 1: Patient Identity & Phone Search */}
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-border pb-3">
                <div className="flex items-center gap-2 font-black text-sm text-foreground">
                  <User className="w-4 h-4 text-primary" />
                  <span>{isRtl ? '1. بيانات المريض ورقم الهاتف' : '1. Patient Details & Phone Search'}</span>
                </div>
                {isSearchingPhone && (
                  <span className="text-xs text-primary flex items-center gap-1.5 font-bold">
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>{isRtl ? 'جارٍ البحث عن ملف المريض...' : 'Searching patient records...'}</span>
                  </span>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Phone Input with Country */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'رقم موبايل المريض (للبحث والواتساب)' : 'Mobile Number (Search & WhatsApp)'} *
                  </Label>
                  <PhoneInputWithCountry
                    value={phone}
                    onChange={(val, country) => {
                      handlePhoneInputChange(val)
                      if (country) setSelectedCountry(country)
                    }}
                    defaultCountryCode={selectedCountry?.code || 'EG'}
                    className="h-11 rounded-2xl text-sm"
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {isRtl
                      ? 'عند كتابة رقم الهاتف، سيبحث النظام تلقائياً عما إذا كان المريض أو أحد أفراد أسرته مسجلاً مسبقاً.'
                      : 'System automatically checks if patient or family members are previously registered.'}
                  </p>
                </div>

                {/* Multiple Family Members Found Banner */}
                {matchedPatients.length > 0 && (
                  <div className="sm:col-span-2 p-4 rounded-2xl bg-primary/[0.07] border border-primary/20 space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-black text-primary flex items-center gap-1.5">
                        <Users className="w-4 h-4" />
                        <span>
                          {matchedPatients.length > 1
                            ? (isRtl ? 'أفراد مسجلون بنفس رقم الهاتف (اختر المريض الصحيح):' : 'Multiple individuals with this phone:')
                            : (isRtl ? 'تم العثور على ملف مريض مسجل سابقاً:' : 'Existing patient found:')}
                        </span>
                      </span>

                      {matchedPatients.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={handleAddNewFamilyMember}
                          className="text-[11px] font-bold text-primary hover:bg-primary/10 h-7 px-2"
                        >
                          <Plus className="w-3 h-3" />
                          <span>{isRtl ? 'إضافة فرد جديد لنفس الرقم' : 'New family member'}</span>
                        </Button>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {matchedPatients.map((member, idx) => {
                        const isChosen = selectedFamilyMemberIndex === idx
                        return (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleSelectFamilyMember(idx)}
                            className={`px-3 py-2 rounded-xl text-xs font-bold border transition-all text-start flex items-center gap-2 cursor-pointer ${
                              isChosen
                                ? 'bg-primary text-white border-primary shadow-xs'
                                : 'bg-card text-foreground border-border hover:border-primary/40'
                            }`}
                          >
                            <span>{member.name}</span>
                            {member.age && (
                              <span className={`text-[10px] opacity-80 ${isChosen ? 'text-white' : 'text-muted-foreground'}`}>
                                ({member.age} {isRtl ? 'سنة' : 'yrs'})
                              </span>
                            )}
                            {isChosen && <Check className="w-3.5 h-3.5" />}
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Patient Name */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'اسم المريض بالكامل' : 'Patient Full Name'} *
                  </Label>
                  <Input
                    type="text"
                    value={patientName}
                    onChange={(e) => setPatientName(e.target.value)}
                    placeholder={isRtl ? 'مثال: سارة أحمد محمود' : 'e.g. Sarah Ahmed'}
                    required
                    className="h-11 rounded-2xl text-xs"
                  />
                </div>

                {/* Gender Toggle */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'النوع' : 'Gender'}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 h-11">
                    <button
                      type="button"
                      onClick={() => setGender('أنثى')}
                      className={`rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        gender === 'أنثى'
                          ? 'border-pink-500 bg-pink-500/15 text-pink-700 dark:text-pink-300 font-black shadow-xs'
                          : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {isRtl ? 'أنثى 👩' : 'Female 👩'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender('ذكر')}
                      className={`rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        gender === 'ذكر'
                          ? 'border-blue-500 bg-blue-500/15 text-blue-700 dark:text-blue-300 font-black shadow-xs'
                          : 'border-border bg-secondary/40 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {isRtl ? 'ذكر 👨' : 'Male 👨'}
                    </button>
                  </div>
                </div>

                {/* Age Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'السن بالسنوات' : 'Age (Years)'}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max="125"
                    value={age}
                    onChange={(e) => handleAgeChange(e.target.value)}
                    placeholder={isRtl ? 'مثال: 28' : 'e.g. 28'}
                    className="h-11 rounded-2xl text-xs font-mono"
                  />
                </div>

                {/* DOB (Optional, linked) */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'تاريخ الميلاد (اختياري)' : 'Date of Birth (Optional)'}
                  </Label>
                  <Input
                    type="date"
                    value={dob}
                    onChange={(e) => handleDobChange(e.target.value)}
                    className="h-11 rounded-2xl text-xs font-mono"
                  />
                </div>

                {/* Residential Area (Optional) */}
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'المنطقة السكنية (اختياري)' : 'Residential Area (Optional)'}
                  </Label>
                  <div className="bg-card rounded-2xl">
                    <ResidentialAreaSelector
                      value={residence}
                      onChange={setResidence}
                      isRtl={isRtl}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Step 2: Clinic Branch, Service & Schedule */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-border pb-3 font-black text-sm text-foreground">
                <Building2 className="w-4 h-4 text-primary" />
                <span>{isRtl ? '2. فرع العيادة والخدمة والموعد' : '2. Branch, Service & Appointment Date'}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Branch Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      {isRtl ? 'فرع العيادة' : 'Clinic Branch'} *
                    </Label>
                    {effectiveLockedBranchId && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-bold flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>{isRtl ? 'مثبت لحسابك' : 'Locked to your branch'}</span>
                      </span>
                    )}
                  </div>

                  {effectiveLockedBranchId ? (
                    <div className="h-11 px-3.5 rounded-2xl bg-secondary/50 border border-primary/30 flex items-center justify-between text-xs font-bold text-foreground">
                      <span>{selectedBranch?.name || (isRtl ? 'الفرع الرئيسي' : 'Main Branch')}</span>
                      <Lock className="w-3.5 h-3.5 text-primary" />
                    </div>
                  ) : (
                    <select
                      value={selectedBranchId}
                      onChange={(e) => setSelectedBranchId(e.target.value)}
                      className="w-full h-11 px-3 rounded-2xl bg-card border border-border text-xs font-bold text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                    >
                      {branches.map((b) => (
                        <option key={b.id} value={b.id}>
                          {b.name} {b.isMain ? (isRtl ? '(الرئيسي)' : '(Main)') : ''}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                {/* Service Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      {isRtl ? 'نوع الخدمة / الكشف' : 'Service Type'} *
                    </Label>
                    <span className="text-xs font-black text-primary font-mono">
                      {selectedService?.price || 0} {isRtl ? 'ج.م' : 'EGP'}
                    </span>
                  </div>

                  <select
                    value={selectedServiceId}
                    onChange={(e) => setSelectedServiceId(e.target.value)}
                    className="w-full h-11 px-3 rounded-2xl bg-card border border-border text-xs font-bold text-foreground focus:ring-2 focus:ring-primary focus:outline-none"
                  >
                    {services.map((s: any) => (
                      <option key={s.id} value={s.id}>
                        {s.name} — ({s.price} {isRtl ? 'ج.م' : 'EGP'})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Date Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'تاريخ الحجز' : 'Booking Date'} *
                  </Label>
                  <Input
                    type="date"
                    value={bookingDate}
                    onChange={(e) => setBookingDate(e.target.value)}
                    className="h-11 rounded-2xl text-xs font-mono"
                    required
                  />
                  <p className="text-[11px] text-muted-foreground">
                    {isRtl ? 'الافتراضي هو اليوم للدخول المباشر في الطابور.' : 'Default is today for live queue.'}
                  </p>
                </div>

                {/* Service Highlights Card */}
                <div className="p-3 rounded-2xl bg-secondary/40 border border-border flex items-center justify-between text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">{isRtl ? 'مدة الكشف التقديرية' : 'Est. Duration'}</span>
                    <strong className="font-bold text-foreground">
                      {selectedService?.duration || 15} {isRtl ? 'دقيقة' : 'mins'}
                    </strong>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">{isRtl ? 'طبيعة الحجز' : 'Priority Type'}</span>
                    <Badge variant={selectedService?.isUrgent ? 'destructive' : 'outline'} className="text-[10px]">
                      {selectedService?.isUrgent ? (isRtl ? 'طوارئ / مستعجل' : 'Urgent') : (isRtl ? 'عادي بالدور' : 'Standard Queue')}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            {/* Step 3: Payment & Internal Notes */}
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-2 border-b border-border pb-3 font-black text-sm text-foreground">
                <CreditCard className="w-4 h-4 text-primary" />
                <span>{isRtl ? '3. الدفع والملاحظات الداخلية' : '3. Payment & Internal Notes'}</span>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                {/* Payment Method */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'طريقة الدفع' : 'Payment Method'}
                  </Label>
                  <div className="grid grid-cols-3 gap-2 h-11">
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('cash')}
                      className={`rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === 'cash'
                          ? 'border-primary bg-primary/10 text-primary font-black shadow-xs'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {isRtl ? 'نقدي 💵' : 'Cash 💵'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('instapay')}
                      className={`rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === 'instapay'
                          ? 'border-primary bg-primary/10 text-primary font-black shadow-xs'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {isRtl ? 'إنستاباي ⚡' : 'InstaPay ⚡'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentMethod('wallet')}
                      className={`rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentMethod === 'wallet'
                          ? 'border-primary bg-primary/10 text-primary font-black shadow-xs'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {isRtl ? 'محفظة 📱' : 'Wallet 📱'}
                    </button>
                  </div>
                </div>

                {/* Payment Status */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'حالة السداد في العيادة' : 'Collection Status'}
                  </Label>
                  <div className="grid grid-cols-2 gap-2 h-11">
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('unpaid')}
                      className={`rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentStatus === 'unpaid'
                          ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-300 font-black shadow-xs'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {isRtl ? 'غير مدفوع (مؤجل)' : 'Unpaid (Pending)'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPaymentStatus('paid')}
                      className={`rounded-2xl text-xs font-bold border transition-all cursor-pointer ${
                        paymentStatus === 'paid'
                          ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-black shadow-xs'
                          : 'border-border bg-secondary/30 text-muted-foreground hover:bg-secondary'
                      }`}
                    >
                      {isRtl ? 'تم التحصيل بالكامل ✓' : 'Collected / Paid ✓'}
                    </button>
                  </div>
                </div>

                {/* Internal Notes */}
                <div className="space-y-1.5 sm:col-span-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      {isRtl ? 'ملاحظات داخلية للاستقبال والطبيب (اختيارية)' : 'Internal Reception Notes (Optional)'}
                    </Label>
                    <span className="text-[10px] text-muted-foreground">
                      {isRtl ? 'لا تظهر في رسالة واتساب ولا يراها المريض' : 'Hidden from patient & WhatsApp'}
                    </span>
                  </div>
                  <Textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    placeholder={
                      isRtl
                        ? 'مثال: مريض قادم من طرف د. حسام، أو حالة تعاني من صعوبة في الحركة...'
                        : 'e.g. Referred by Dr. Hossam, mobility assistance needed...'
                    }
                    rows={2}
                    className="rounded-2xl text-xs"
                  />
                </div>
              </div>
            </div>

            {/* Submit Button */}
            <div className="pt-4 border-t border-border flex items-center justify-end gap-3">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 px-8 rounded-2xl bg-primary hover:bg-primary/90 text-primary-foreground font-black text-sm gap-2 shadow-lg shadow-primary/25 cursor-pointer active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{isRtl ? 'جارٍ تسجيل الحجز وتخصيص الدور...' : 'Assigning queue ticket...'}</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isRtl ? 'تأكيد الحجز وتخصيص الدور' : 'Confirm In-Clinic Booking'}</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}
