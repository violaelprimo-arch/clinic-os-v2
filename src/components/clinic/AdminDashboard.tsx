'use client'

import { useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import {
  Calendar, Users, Clock, CheckCircle2, DollarSign,
  Play, MessageCircle, ArrowLeft, ArrowRight, UserCheck,
  UserX, SkipForward, FileSignature, Phone, Filter,
  Sparkles, AlertCircle, ChevronDown, ChevronUp, RefreshCw, ArrowUpDown, X,
  Printer, Download, Tag, Check, Eye, Building2, Percent, FileSpreadsheet,
  ExternalLink, Copy
} from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { sortQueue } from '@/lib/queueCalculations'
import { ThermalReceiptModal } from '@/components/clinic/ThermalReceiptModal'
import { ThermalReceiptData } from '@/lib/printService'
import { openManualWhatsAppChat, formatQueueAlertWhatsAppMessage, formatPaymentConfirmationWhatsAppMessage } from '@/lib/whatsappShare'
import { exportAppointmentsToExcel } from '@/lib/excelExport'
import { createClinicNotification } from '@/lib/notificationService'

export function AdminDashboard({ clinic }: { clinic: any }) {
  const [rawAppointments, setRawAppointments] = useState<any[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isProcessing, setIsProcessing] = useState(false)
  const [serviceFilter, setServiceFilter] = useState('ALL')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  // Edit Turn State
  const [editingPatient, setEditingPatient] = useState<any | null>(null)
  const [editQueueNumber, setEditQueueNumber] = useState<string>('')
  const [editServiceName, setEditServiceName] = useState<string>('')
  const [isUpdatingQueue, setIsUpdatingQueue] = useState(false)

  // Discount Modal State
  const [discountModalAppt, setDiscountModalAppt] = useState<any | null>(null)
  const [discountType, setDiscountType] = useState<'fixed' | 'percentage'>('fixed')
  const [discountValue, setDiscountValue] = useState<string>('')
  const [isSavingDiscount, setIsSavingDiscount] = useState(false)

  // Thermal Receipt Modal State
  const [selectedReceiptAppt, setSelectedReceiptAppt] = useState<any | null>(null)

  // Image Preview Modal for Receipt Proof
  const [previewProofUrl, setPreviewProofUrl] = useState<string | null>(null)

  // Mobile expandable card
  const [expandedCardId, setExpandedCardId] = useState<string | null>(null)

  // Listen to Branch Switcher events and read initial localStorage
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBranch = localStorage.getItem('clinic_selected_branch') || 'all'
      setSelectedBranchId(savedBranch)

      const handleBranchChanged = (e: any) => {
        const bId = e.detail?.branchId || 'all'
        setSelectedBranchId(bId)
      }

      window.addEventListener('clinic_branch_changed', handleBranchChanged)
      return () => {
        window.removeEventListener('clinic_branch_changed', handleBranchChanged)
      }
    }
  }, [])

  // Subscribe to real-time appointments for today
  useEffect(() => {
    if (!clinic?.id) return
    const today = new Date().toISOString().split('T')[0]
    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinic.id),
      where('date', '==', today)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      setRawAppointments(data)
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [clinic?.id])

  // Filter by selected branch
  const branchFilteredAppointments = useMemo(() => {
    if (!selectedBranchId || selectedBranchId === 'all') {
      return rawAppointments
    }
    return rawAppointments.filter(appt => {
      if (appt.branch_id) {
        return appt.branch_id === selectedBranchId
      }
      return selectedBranchId === 'main'
    })
  }, [rawAppointments, selectedBranchId])

  // Intelligent Queue Sorting adhering to clinic settings
  const bookings = useMemo(() => {
    const data = branchFilteredAppointments
    const completed = data
      .filter((d: any) => d.status === 'completed' || d.status === 'cancelled')
      .sort((a: any, b: any) => (a.queue_number || 0) - (b.queue_number || 0))
    const inProgress = data.filter((d: any) => d.status === 'in_progress')
    const orderedWaiting = sortQueue(data, clinic)
    return [...inProgress, ...orderedWaiting, ...completed]
  }, [branchFilteredAppointments, clinic])

  // Categorize bookings
  const currentPatient = useMemo(() => {
    return bookings.find(b => b.status === 'in_progress') || null
  }, [bookings])

  const waitingPatients = useMemo(() => {
    return bookings.filter(b => b.status === 'waiting' || !b.status)
  }, [bookings])

  const nextPatient = useMemo(() => {
    return waitingPatients.length > 0 ? waitingPatients[0] : null
  }, [waitingPatients])

  const completedPatients = useMemo(() => {
    return bookings.filter(b => b.status === 'completed')
  }, [bookings])

  // Pending verification transfers (InstaPay / Wallet)
  const pendingPayments = useMemo(() => {
    return bookings.filter(b => 
      b.paymentStatus === 'pending_verification' || 
      (b.paymentMethod && b.paymentMethod !== 'cash' && b.paymentStatus !== 'paid')
    )
  }, [bookings])

  // Check 5-patient threshold and trigger notification
  useEffect(() => {
    if (!clinic?.id || waitingPatients.length < 5) return

    const today = new Date().toISOString().split('T')[0]
    const hourKey = new Date().getHours()
    const eventId = `wait_5_${clinic.id}_${today}_${hourKey}`

    createClinicNotification({
      clinicId: clinic.id,
      recipientType: 'staff',
      recipientTarget: clinic.id,
      title: 'تنبيه طابور الانتظار ⚠️',
      body: `يوجد ${waitingPatients.length} مرضى في الانتظار حالياً. يرجى متابعة الدور لتسريع الدخول.`,
      type: 'system',
      eventId
    })
  }, [clinic?.id, waitingPatients.length])

  // Calculate totals
  const totalRevenue = useMemo(() => {
    return bookings.reduce((sum, b) => sum + (Number(b.servicePrice) || 0), 0)
  }, [bookings])

  // Filtered queue for table
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesService = serviceFilter === 'ALL' || b.serviceId === serviceFilter || b.serviceName === serviceFilter
      const matchesSearch = !searchQuery ||
        (b.patientName && b.patientName.includes(searchQuery)) ||
        (b.phone && b.phone.includes(searchQuery))
      return matchesService && matchesSearch
    })
  }, [bookings, serviceFilter, searchQuery])

  // Actions
  const handleOpenEditTurn = (patient: any) => {
    setEditingPatient(patient)
    setEditQueueNumber(String(patient.queue_number || ''))
    setEditServiceName(patient.serviceName || 'كشف عادي')
  }

  const handleSaveEditTurn = async () => {
    if (!editingPatient || isUpdatingQueue) return
    setIsUpdatingQueue(true)
    try {
      const isUrgent = editServiceName.includes('مستعجل') || editServiceName.includes('طوارئ')
      await updateDoc(doc(db, 'appointments', editingPatient.id), {
        queue_number: Number(editQueueNumber) || editingPatient.queue_number,
        serviceName: editServiceName || editingPatient.serviceName,
        isUrgent: isUrgent,
      })
      toast.success(`تم تعديل دور المريض ${editingPatient.patientName} بنجاح`)
      setEditingPatient(null)
    } catch (err) {
      toast.error('حدث خطأ أثناء تعديل دور المريض.')
    } finally {
      setIsUpdatingQueue(false)
    }
  }

  // Payment Confirmation Handler (No queue impact!)
  const handleConfirmPayment = async (patient: any) => {
    if (!patient || isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patient.id), {
        paymentStatus: 'paid',
        paymentConfirmedAt: new Date().toISOString(),
        paymentConfirmedBy: 'staff'
      })
      if (patient.phone) {
        await createClinicNotification({
          clinicId: clinic?.id || patient.clinic_id,
          branchId: patient.branch_id,
          recipientType: 'patient',
          recipientTarget: patient.phone,
          title: 'تم تأكيد استلام الدفع بنجاح',
          body: `مرحباً ${patient.patientName}، تم تأكيد دفع رسوم كشف "${patient.serviceName}". نتمنى لك الشفاء العاجل.`,
          type: 'payment_confirmed',
          eventId: `pay_conf_${patient.id}`,
          appointmentId: patient.id
        })
      }
      toast.success(`تم تأكيد استلام الدفع للمريض ${patient.patientName} بنجاح`)
    } catch (err) {
      toast.error('حدث خطأ أثناء تأكيد الدفع.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Payment Rejection Handler
  const handleRejectPayment = async (patient: any) => {
    if (!patient || isProcessing) return
    const confirmed = window.confirm(`هل أنت متأكد من رفض التحويل للمريض ${patient.patientName}؟`)
    if (!confirmed) return

    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patient.id), {
        paymentStatus: 'unpaid',
        paymentRejectedAt: new Date().toISOString(),
        paymentRejectedBy: 'staff'
      })
      toast.warning(`تم تسجيل رفض الدفع للمريض ${patient.patientName}`)
    } catch (err) {
      toast.error('حدث خطأ أثناء رفض الدفع.')
    } finally {
      setIsProcessing(false)
    }
  }

  // Discount Handlers
  const handleOpenDiscountModal = (appt: any) => {
    setDiscountModalAppt(appt)
    if (appt.discount?.type) {
      setDiscountType(appt.discount.type)
      setDiscountValue(String(appt.discount.value || ''))
    } else {
      setDiscountType('fixed')
      setDiscountValue('')
    }
  }

  const handleSaveDiscount = async () => {
    if (!discountModalAppt || isSavingDiscount) return
    setIsSavingDiscount(true)
    try {
      const origPrice = Number(discountModalAppt.originalPrice || discountModalAppt.servicePrice) || 0
      const val = Number(discountValue) || 0
      let discountAmount = 0
      let newPrice = origPrice

      if (val > 0) {
        if (discountType === 'percentage') {
          discountAmount = (origPrice * val) / 100
          newPrice = Math.max(0, origPrice - discountAmount)
        } else {
          discountAmount = val
          newPrice = Math.max(0, origPrice - val)
        }
      }

      await updateDoc(doc(db, 'appointments', discountModalAppt.id), {
        originalPrice: origPrice,
        servicePrice: newPrice,
        discount: val > 0 ? {
          type: discountType,
          value: val,
          amount: discountAmount,
          appliedAt: new Date().toISOString()
        } : null
      })

      toast.success(`تم تطبيق الخصم بنجاح! السعر الجديد: ${newPrice} ج.م`)
      setDiscountModalAppt(null)
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ الخصم.')
    } finally {
      setIsSavingDiscount(false)
    }
  }

  const handleStartExam = async (patient: any) => {
    if (!patient || isProcessing) return

    if (patient.paymentStatus !== 'paid' && patient.status !== 'completed') {
      const confirmPayment = window.confirm(
        `⚠️ المريض لم يقم بتأكيد الدفع (المبلغ المطلوب: ${patient.servicePrice || 0} ج.م).\n\nهل استلمت المبلغ وتريد تأكيد الدفع وإدخال المريض؟`
      )
      if (!confirmPayment) {
        toast.info('تم إلغاء دخول المريض بانتظار الدفع.')
        return
      }
    }

    setIsProcessing(true)
    try {
      if (currentPatient && currentPatient.id !== patient.id) {
        await updateDoc(doc(db, 'appointments', currentPatient.id), {
          status: 'completed',
          completedAt: new Date().toISOString()
        })
      }

      await updateDoc(doc(db, 'appointments', patient.id), {
        status: 'in_progress',
        paymentStatus: 'paid',
        startedAt: new Date().toISOString()
      })
      if (patient.phone) {
        await createClinicNotification({
          clinicId: clinic?.id || patient.clinic_id,
          branchId: patient.branch_id,
          recipientType: 'patient',
          recipientTarget: patient.phone,
          title: 'دورك الآن للدخول!',
          body: `مرحباً ${patient.patientName}، حان دورك الآن للدخول لغرفة الكشف (تذكرة #${patient.queue_number || ''}). يرجى الدخول مباشرة.`,
          type: 'turn_ready',
          eventId: `turn_ready_${patient.id}`,
          appointmentId: patient.id
        })
      }

      // Notify all other waiting patients about the entry & remaining turn count
      const otherWaiting = bookings.filter(b => b.status === 'waiting' && b.id !== patient.id)
      for (const wp of otherWaiting) {
        if (!wp.phone) continue
        const aheadCount = otherWaiting.filter(o => (Number(o.queue_number) || 0) < (Number(wp.queue_number) || 0)).length
        const eventId = `enter_${patient.queue_number || patient.id}_for_${wp.id}`
        
        let title = 'حركة الدور: دخول مريض للكشف'
        let body = `دخل الآن المريض رقم #${patient.queue_number || ''} لغرفة الكشف. دورك رقم #${wp.queue_number} (متبقي أمامك ${aheadCount} مرضى).`
        let type: any = 'system'

        if (aheadCount <= 5 && aheadCount > 0) {
          title = `تنبيه: اقترب دورك (متبقي ${aheadCount} أدوار)`
          body = `دخل الآن المريض رقم #${patient.queue_number || ''}. متبقي أمامك ${aheadCount} مرضى فقط. يرجى التواجد بقاعة الانتظار للاستعداد.`
          type = 'approaching_turn'
        }

        createClinicNotification({
          clinicId: clinic?.id || wp.clinic_id,
          branchId: wp.branch_id,
          recipientType: 'patient',
          recipientTarget: wp.phone,
          title,
          body,
          type,
          eventId,
          appointmentId: wp.id
        }).catch(() => {})
      }

      toast.success(`بدأ كشف المريض: ${patient.patientName}`)
    } catch (err) {
      toast.error('حدث خطأ أثناء بدء الكشف.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleCompleteExam = async (patientId: string, patientName: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patientId), {
        status: 'completed',
        completedAt: new Date().toISOString()
      })
      toast.success(`تم إنهاء كشف: ${patientName}`)
    } catch (err) {
      toast.error('حدث خطأ أثناء إنهاء الكشف.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSkipPatient = async (patientId: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patientId), {
        status: 'skipped'
      })
      toast.info('تم تخطي دور المريض مؤقتاً.')
    } catch (err) {
      toast.error('حدث خطأ أثناء تخطي المريض.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleNoShow = async (patientId: string) => {
    if (isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patientId), {
        status: 'no_show'
      })
      toast.warning('تم تسجيل المريض: لم يحضر')
    } catch (err) {
      toast.error('حدث خطأ أثناء تسجيل الغياب.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleManualWhatsApp = (patient: any) => {
    if (!patient?.phone) return toast.error('لا يوجد رقم هاتف للمريض')
    const msg = formatQueueAlertWhatsAppMessage({
      clinicName: clinic?.clinicName || 'عيادتنا',
      patientName: patient.patientName,
      queueNumber: patient.queue_number,
      peopleAhead: 1
    })
    openManualWhatsAppChat({
      phone: patient.phone,
      message: msg
    })
  }

  const handleManualWhatsAppPayment = (patient: any) => {
    if (!patient?.phone) return toast.error('لا يوجد رقم هاتف للمريض')
    const msg = formatPaymentConfirmationWhatsAppMessage({
      clinicName: clinic?.clinicName || 'عيادتنا',
      patientName: patient.patientName,
      amount: patient.servicePrice || 0,
      receiptNumber: patient.queue_number || patient.id.slice(-5)
    })
    openManualWhatsAppChat({
      phone: patient.phone,
      message: msg
    })
  }

  const handleExportExcel = async () => {
    if (filteredBookings.length === 0) {
      return toast.info('لا توجد حجوزات لتصديرها')
    }
    await exportAppointmentsToExcel(filteredBookings, clinic?.clinicName || 'العيادة')
    toast.success('تم تصدير ملف الإكسيل بنجاح')
  }

  // Build ThermalReceiptData for preview and printing
  const thermalReceiptData: ThermalReceiptData | null = useMemo(() => {
    if (!selectedReceiptAppt) return null
    const origPrice = Number(selectedReceiptAppt.originalPrice || selectedReceiptAppt.servicePrice) || 0
    const netPrice = Number(selectedReceiptAppt.servicePrice) || origPrice
    const discountAmt = selectedReceiptAppt.discount?.amount || (origPrice - netPrice) || 0

    return {
      clinicName: clinic?.clinicName || 'عيادتنا',
      branchName: selectedReceiptAppt.branchName || (clinic?.branches?.find((b: any) => b.id === selectedReceiptAppt.branch_id)?.name) || 'الفرع الرئيسي',
      clinicAddress: clinic?.address || '',
      clinicPhone: clinic?.clinicPhone || clinic?.doctorPhone || '',
      logoUrl: clinic?.logoUrl || '',
      invoiceNumber: `INV-${new Date().getFullYear()}-${String(selectedReceiptAppt.queue_number || selectedReceiptAppt.id.slice(-4)).padStart(4, '0')}`,
      queueNumber: selectedReceiptAppt.queue_number,
      date: selectedReceiptAppt.date || new Date().toISOString().split('T')[0],
      time: selectedReceiptAppt.createdAt ? new Date(selectedReceiptAppt.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '',
      patientName: selectedReceiptAppt.patientName,
      patientPhone: selectedReceiptAppt.phone,
      serviceName: selectedReceiptAppt.serviceName || 'كشف طبي',
      originalPrice: origPrice,
      discountAmount: discountAmt,
      netPrice: netPrice,
      paymentMethod: selectedReceiptAppt.paymentMethod || 'cash',
      paymentStatus: selectedReceiptAppt.paymentStatus || 'unpaid',
      transferNumber: selectedReceiptAppt.transferNumber,
      confirmedBy: selectedReceiptAppt.paymentConfirmedBy,
      confirmedAt: selectedReceiptAppt.paymentConfirmedAt
    }
  }, [selectedReceiptAppt, clinic])

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'in_progress':
        return <Badge className="bg-[#15B8A6] text-white hover:bg-[#15B8A6] border-none font-bold px-3 py-1">بالداخل</Badge>
      case 'waiting':
        return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100 border-amber-200 font-bold px-3 py-1">في الانتظار</Badge>
      case 'completed':
        return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100 border-emerald-200 font-bold px-3 py-1">تم الكشف</Badge>
      case 'skipped':
        return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100 border-slate-200 font-bold px-3 py-1">تخطي</Badge>
      case 'no_show':
        return <Badge className="bg-rose-100 text-rose-700 hover:bg-rose-100 border-rose-200 font-bold px-3 py-1">لم يحضر</Badge>
      default:
        return <Badge variant="outline">{status}</Badge>
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* Direct Subdomain Banner */}
      <div className="p-4 bg-teal-50/80 border border-teal-200/80 rounded-2xl flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 shadow-2xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-black text-slate-800">رابط صفحة الحجز لمرضاك (Subdomain):</span>
          </div>
          <div className="font-mono text-sm font-black text-teal-800 bg-white px-3 py-1 rounded-xl border border-teal-200 inline-block select-all" dir="ltr">
            https://{clinic?.slug || 'clinic'}.yalla-clinic.com
          </div>
          <p className="text-[11px] text-slate-500 font-medium">
            رابط مباشر خاص بدكتور/عيادة {clinic?.doctorName || clinic?.clinicName || ''} لمشاركته مع المرضى للحجز والمتابعة.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
          <Button
            type="button"
            size="sm"
            onClick={() => {
              const url = `https://${clinic?.slug || 'clinic'}.yalla-clinic.com`
              navigator.clipboard.writeText(url)
              toast.success('تم نسخ رابط العيادة المباشر!')
            }}
            className="flex-1 sm:flex-none h-9 px-3.5 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold text-xs rounded-xl shadow-xs"
          >
            <Copy className="w-3.5 h-3.5 ml-1.5" />
            نسخ الرابط
          </Button>
          <a
            href={`https://${clinic?.slug || 'clinic'}.yalla-clinic.com`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 sm:flex-none h-9 px-3.5 inline-flex items-center justify-center gap-1.5 border border-slate-200 hover:bg-white text-slate-700 font-bold text-xs rounded-xl transition-colors bg-white/70"
          >
            <ExternalLink className="w-3.5 h-3.5 ml-1" />
            فتح الرابط
          </a>
        </div>
      </div>

      {/* Clinic Status Toggle & Active Branch Pill */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-5 bg-white border border-[#E5EAF0] rounded-2xl shadow-sm mb-6 gap-4">
        <div className="flex items-center gap-3">
          <div className={`w-3.5 h-3.5 rounded-full ${clinic?.isClinicOpen !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-black text-sm text-[#182230]">
                {clinic?.isClinicOpen !== false ? 'العيادة مفتوحة حالياً (أونلاين)' : 'العيادة مغلقة حالياً (أوفلاين)'}
              </h3>
              {selectedBranchId && selectedBranchId !== 'all' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-700 border border-teal-200 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  فرع مفلتر
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5">
              {clinic?.isClinicOpen !== false ? 'يمكن للمرضى الحجز والدخول في الدور الآن' : 'تم إيقاف الحجز من الموقع ولا يمكن استقبال حجوزات جديدة'}
            </p>
          </div>
        </div>
        <Button
          onClick={async () => {
            if (isProcessing) return
            setIsProcessing(true)
            try {
              await updateDoc(doc(db, 'clinics', clinic.id), {
                isClinicOpen: clinic?.isClinicOpen === false ? true : false,
                updatedAt: new Date().toISOString()
              })
              toast.success(clinic?.isClinicOpen === false ? 'تم فتح العيادة وتفعيل الحجوزات' : 'تم إغلاق العيادة وإيقاف الحجوزات')
            } catch (err) {
              toast.error('حدث خطأ')
            } finally {
              setIsProcessing(false)
            }
          }}
          variant={clinic?.isClinicOpen !== false ? 'destructive' : 'default'}
          className={`font-bold text-xs h-10 px-5 rounded-xl w-full sm:w-auto ${clinic?.isClinicOpen !== false ? '' : 'bg-[#15B8A6] hover:bg-[#0D9488] text-white'}`}
          disabled={isProcessing}
        >
          {clinic?.isClinicOpen !== false ? 'إغلاق العيادة (إيقاف الحجز)' : 'فتح العيادة (بدء الحجز)'}
        </Button>
      </div>

      {/* TOP STATS CARDS */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Bookings */}
        <div className="medical-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الحجوزات</p>
            <h3 className="text-3xl font-black text-[#182230]">{bookings.length}</h3>
            <span className="text-[11px] font-semibold text-slate-400 mt-1 inline-block">حجز مسجل اليوم</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 flex items-center justify-center text-[#15B8A6]">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Waiting */}
        <div className="medical-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">في الانتظار</p>
            <h3 className="text-3xl font-black text-amber-600">{waitingPatients.length}</h3>
            <span className="text-[11px] font-semibold text-amber-600/80 mt-1 inline-block">بانتظار الدخول</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-500">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="medical-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">تم الكشف</p>
            <h3 className="text-3xl font-black text-[#2F80ED]">{completedPatients.length}</h3>
            <span className="text-[11px] font-semibold text-[#2F80ED]/80 mt-1 inline-block">زيارات مكتملة</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-blue-50 border border-blue-100 flex items-center justify-center text-[#2F80ED]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Total Revenue */}
        <div className="medical-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-slate-400 mb-1">إجمالي الإيرادات</p>
            <h3 className="text-3xl font-black text-emerald-600">
              {totalRevenue.toLocaleString()} <span className="text-base font-bold text-slate-500">ج.م</span>
            </h3>
            <span className="text-[11px] font-semibold text-emerald-600/80 mt-1 inline-block">تحصيل اليوم</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-500">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* PENDING PAYMENTS SECTION: مدفوعات في انتظار التأكيد */}
      {pendingPayments.length > 0 && (
        <div className="medical-card p-5 bg-gradient-to-r from-amber-50/70 via-orange-50/50 to-white border-2 border-amber-300 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-amber-200">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-black text-base text-[#182230]">
                    مدفوعات في انتظار التأكيد (انستاباي / محفظة)
                  </h3>
                  <Badge className="bg-amber-500 text-white font-black text-xs">
                    {pendingPayments.length} تحويل
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mt-0.5">
                  يرجى مراجعة إشعار التحويل وصورة الإيصال وتأكيد الاستلام. التأكيد لا يغير ترتيب دور المريض.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-3">
            {pendingPayments.map((p) => {
              const proofUrl = p.receiptProofUrl || p.receiptUrl
              return (
                <div
                  key={p.id}
                  className="p-4 bg-white border border-amber-200 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs hover:border-amber-400 transition-colors"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center font-black shrink-0 text-sm">
                      #{p.queue_number || '--'}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-[#182230]">{p.patientName}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {p.serviceName}
                        </span>
                        <span className="text-xs font-black text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                          {p.servicePrice} ج.م
                        </span>
                        {p.discount && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200">
                            خصم: {p.discount.amount || p.discount.value} {p.discount.type === 'percentage' ? '%' : 'ج.م'}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-slate-500 flex-wrap">
                        <span className="font-mono">{p.phone}</span>
                        <span className="font-semibold text-amber-800">
                          طريقة التحويل: {p.paymentMethod === 'instapay' ? 'InstaPay' : 'محفظة إلكترونية'}
                        </span>
                        {p.transferNumber && (
                          <span className="font-mono bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-amber-900 font-bold">
                            رقم المحول منه: {p.transferNumber}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap self-end md:self-center">
                    {/* View Proof Image Button */}
                    {proofUrl && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setPreviewProofUrl(proofUrl)}
                        className="h-8 px-2.5 text-xs font-bold text-blue-600 border-blue-200 hover:bg-blue-50 rounded-xl"
                      >
                        <Eye className="w-3.5 h-3.5 ml-1" />
                        صورة الإشعار
                      </Button>
                    )}

                    {/* Confirm Payment Button */}
                    <Button
                      size="sm"
                      onClick={() => handleConfirmPayment(p)}
                      disabled={isProcessing}
                      className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 ml-1" />
                      تأكيد الاستلام
                    </Button>

                    {/* Reject Payment Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectPayment(p)}
                      disabled={isProcessing}
                      className="h-8 px-2.5 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
                    >
                      <X className="w-3.5 h-3.5 ml-1" />
                      رفض
                    </Button>

                    {/* Print Thermal Receipt */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedReceiptAppt(p)}
                      className="h-8 px-2 text-xs font-bold text-slate-700 border-slate-200 hover:bg-slate-100 rounded-xl"
                      title="طباعة إيصال حراري 80mm"
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </Button>

                    {/* WhatsApp confirmation */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManualWhatsAppPayment(p)}
                      className="h-8 px-2 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-xl"
                      title="إرسال تأكيد الاستلام عبر واتساب"
                    >
                      <MessageCircle className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* MAIN WORKSPACE (Queue Table & Live Patient Control Panels) */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT COLUMN: Today Queue Table (8 cols on lg) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="medical-card overflow-hidden">
            {/* Header with Title and Filter Dropdown */}
            <div className="p-5 border-b border-[#E5EAF0] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-slate-50/50">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-teal-500/10 text-[#15B8A6] flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-[#182230]">دور اليوم</h2>
                  <p className="text-xs text-slate-400">قائمة المرضى والمواعيد المسجلة لتاريخ اليوم</p>
                </div>
              </div>

              {/* Toolbar: Service Filter + Excel Export Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportExcel}
                  className="h-9 px-3 text-xs font-bold border-teal-200 text-teal-700 hover:bg-teal-50 rounded-xl flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  تصدير Excel
                </Button>

                <div className="relative">
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    className="h-9 pr-8 pl-3 rounded-xl bg-white border border-[#E5EAF0] text-xs font-bold text-slate-700 focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20 focus:border-[#15B8A6] cursor-pointer appearance-none"
                  >
                    <option value="ALL">كل الخدمات</option>
                    {clinic?.services?.map((s: any) => (
                      <option key={s.id} value={s.id}>{s.name}</option>
                    ))}
                    {!clinic?.services?.length && (
                      <>
                        <option value="كشف عادي">كشف عادي</option>
                        <option value="استشارة">استشارة</option>
                        <option value="كشف مستعجل">كشف مستعجل</option>
                      </>
                    )}
                  </select>
                  <Filter className="w-3.5 h-3.5 absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Patients List Table */}
            <div className="p-0">
              {isLoading ? (
                <div className="py-16 text-center text-slate-400">
                  <div className="w-8 h-8 border-2 border-[#15B8A6] border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  جاري تحميل الدور...
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="py-16 text-center text-slate-400 space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-base text-slate-700">لا توجد حجوزات مسجلة اليوم</h4>
                  <p className="text-xs text-slate-400 max-w-sm mx-auto">
                    يمكن للمرضى حجز المواعيد عبر رابط العيادة المباشر، أو يمكنك إضافة موعد يدوي.
                  </p>
                  <Link href={`/clinic/${clinic.slug}`} target="_blank">
                    <Button variant="outline" size="sm" className="mt-2 text-xs font-bold border-[#15B8A6] text-[#15B8A6]">
                      فتح صفحة الحجز
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-[#E5EAF0]">
                  {filteredBookings.map((b) => {
                    const isCurrent = b.status === 'in_progress'
                    const isExpanded = expandedCardId === b.id

                    return (
                      <div
                        key={b.id}
                        className={`transition-colors ${
                          isCurrent
                            ? 'bg-[#E6FFFA]/50 border-r-4 border-r-[#15B8A6]'
                            : b.status === 'completed'
                            ? 'bg-slate-50/60 opacity-80'
                            : 'hover:bg-slate-50/80 bg-white'
                        }`}
                      >
                        {/* ================= MOBILE PATIENT CARD (Screen < 640px) ================= */}
                        <div className="block sm:hidden p-4 space-y-3">
                          {/* Card Top: Queue # + Name + Status */}
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div
                                className={`w-10 h-10 rounded-xl flex flex-col items-center justify-center shrink-0 font-black shadow-xs ${
                                  isCurrent
                                    ? 'bg-[#15B8A6] text-white ring-2 ring-[#15B8A6]/20'
                                    : b.status === 'completed'
                                    ? 'bg-slate-100 text-slate-500'
                                    : 'bg-[#0B1F33] text-white'
                                }`}
                              >
                                <span className="text-[9px] font-bold opacity-80 leading-none">#</span>
                                <span className="text-sm leading-tight font-black">{b.queue_number || '--'}</span>
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm text-[#182230] truncate">{b.patientName}</h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#2F80ED] border border-blue-100">
                                    {b.serviceName || 'كشف'}
                                  </span>
                                  {b.servicePrice !== undefined && (
                                    <span className="text-[10px] font-bold text-slate-600">
                                      {b.servicePrice} ج.م
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0">{getStatusBadge(b.status)}</div>
                          </div>

                          {/* Card Info Row: Phone + Time + Payment Badge */}
                          <div className="flex items-center justify-between text-xs text-slate-500 pt-1 border-t border-slate-100 flex-wrap gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-slate-600">{b.phone}</span>
                              {b.createdAt && (
                                <span className="text-[10px] text-slate-400">
                                  {new Date(b.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {b.paymentStatus === 'paid' ? (
                                <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                                  مدفوع ✓
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                                  غير مدفوع
                                </span>
                              )}
                              {b.discount && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                  خصم {b.discount.amount || b.discount.value} {b.discount.type === 'percentage' ? '%' : 'ج.م'}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Card Primary Actions Bar */}
                          <div className="flex items-center gap-2 pt-1">
                            {/* Primary Button */}
                            {b.status === 'waiting' && (
                              <Button
                                size="sm"
                                className="flex-1 h-9 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs"
                                onClick={() => handleStartExam(b)}
                                disabled={isProcessing}
                              >
                                <Play className="w-3.5 h-3.5 ml-1.5" />
                                دخول المريض
                              </Button>
                            )}

                            {isCurrent && (
                              <Button
                                size="sm"
                                className="flex-1 h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                                onClick={() => handleCompleteExam(b.id, b.patientName)}
                                disabled={isProcessing}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 ml-1.5" />
                                إنهاء الكشف
                              </Button>
                            )}

                            {/* Quick Confirm Payment */}
                            {b.paymentStatus !== 'paid' && b.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirmPayment(b)}
                                className="h-9 px-3 text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50 rounded-xl"
                                disabled={isProcessing}
                              >
                                <DollarSign className="w-3.5 h-3.5 ml-1" />
                                تأكيد الدفع
                              </Button>
                            )}

                            {/* Expand / Collapse Secondary Details */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedCardId(isExpanded ? null : b.id)}
                              className={`h-9 px-2.5 rounded-xl border-slate-200 text-slate-600 transition-colors ${
                                isExpanded ? 'bg-slate-100 text-[#15B8A6]' : 'hover:bg-slate-50'
                              }`}
                              title="المزيد من الخيارات"
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>

                          {/* Expandable Section for Secondary Actions */}
                          {isExpanded && (
                            <div className="p-3 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                              <p className="text-[10px] font-bold text-slate-400">إجراءات إضافية:</p>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-bold text-slate-700 border-slate-200 hover:bg-white rounded-lg justify-start"
                                  onClick={() => handleOpenDiscountModal(b)}
                                >
                                  <Percent className="w-3.5 h-3.5 ml-1.5 text-indigo-500" />
                                  تطبيق خصم
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-bold text-slate-700 border-slate-200 hover:bg-white rounded-lg justify-start"
                                  onClick={() => setSelectedReceiptAppt(b)}
                                >
                                  <Printer className="w-3.5 h-3.5 ml-1.5 text-teal-600" />
                                  إيصال حراري
                                </Button>

                                {b.phone && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs font-bold text-emerald-700 border-emerald-200 hover:bg-white rounded-lg justify-start"
                                    onClick={() => handleManualWhatsApp(b)}
                                  >
                                    <MessageCircle className="w-3.5 h-3.5 ml-1.5 text-emerald-500" />
                                    تنبيه واتساب
                                  </Button>
                                )}

                                {b.status === 'waiting' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs font-bold text-indigo-700 border-indigo-200 hover:bg-white rounded-lg justify-start"
                                    onClick={() => handleOpenEditTurn(b)}
                                  >
                                    <ArrowUpDown className="w-3.5 h-3.5 ml-1.5 text-indigo-500" />
                                    تعديل الدور
                                  </Button>
                                )}

                                <Link
                                  href={`/clinic/${clinic.slug}/admin/prescriptions?appointmentId=${b.id}&patientName=${encodeURIComponent(b.patientName)}&patientPhone=${encodeURIComponent(b.phone)}&age=${encodeURIComponent(b.age || b.dob || '')}`}
                                  className="col-span-2"
                                >
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="w-full h-8 text-xs font-bold text-[#15B8A6] border-teal-200 hover:bg-white rounded-lg justify-center"
                                  >
                                    <FileSignature className="w-3.5 h-3.5 ml-1.5" />
                                    كتابة روشتة طبية
                                  </Button>
                                </Link>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ================= DESKTOP PATIENT ROW (Screen >= 640px) ================= */}
                        <div className="hidden sm:flex p-4 items-center justify-between gap-4">
                          {/* Right Part: Queue Number & Patient Details */}
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            {/* Queue Number Badge */}
                            <div
                              className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 font-black shadow-xs ${
                                isCurrent
                                  ? 'bg-[#15B8A6] text-white ring-2 ring-[#15B8A6]/20'
                                  : b.status === 'completed'
                                  ? 'bg-slate-100 text-slate-500'
                                  : 'bg-[#0B1F33] text-white'
                              }`}
                            >
                              <span className="text-[9px] font-bold opacity-80 leading-none">#</span>
                              <span className="text-base leading-tight font-black">{b.queue_number || '--'}</span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm text-[#182230] truncate">{b.patientName}</h3>
                                {/* Service Pill */}
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#2F80ED] border border-blue-100">
                                  {b.serviceName || 'كشف'}
                                </span>
                                {b.servicePrice !== undefined && (
                                  <span className="text-[11px] font-bold text-slate-600">
                                    {b.servicePrice} ج.م
                                  </span>
                                )}
                                {b.discount && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
                                    خصم: {b.discount.amount || b.discount.value} {b.discount.type === 'percentage' ? '%' : 'ج.م'}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-slate-400 mt-0.5 flex-wrap">
                                <span className="font-mono text-slate-500">{b.phone}</span>
                                {b.createdAt && (
                                  <span>{new Date(b.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                                {b.paymentMethod && b.paymentMethod !== 'cash' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-teal-50 text-teal-800 border border-teal-200 inline-flex items-center gap-1 font-mono">
                                    <span>{b.paymentMethod === 'instapay' ? 'انستاباي' : 'محفظة'}:</span>
                                    <span>{b.transferNumber || 'بانتظار التأكيد'}</span>
                                  </span>
                                )}
                                {b.paymentStatus === 'paid' && (
                                  <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                    مدفوع ✓
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Left Part: Status & Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {getStatusBadge(b.status)}

                            {/* Quick Confirm Payment */}
                            {b.paymentStatus !== 'paid' && b.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirmPayment(b)}
                                className="h-8 px-2.5 text-xs font-bold text-amber-600 border-amber-200 hover:bg-amber-50 rounded-xl"
                                title="تأكيد الدفع"
                                disabled={isProcessing}
                              >
                                <DollarSign className="w-3.5 h-3.5 ml-1" />
                                تأكيد الدفع
                              </Button>
                            )}

                            {/* Discount button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs font-bold text-slate-600 border-slate-200 hover:bg-slate-50 rounded-xl"
                              onClick={() => handleOpenDiscountModal(b)}
                              title="تطبيق خصم أو تعديل السعر"
                            >
                              <Percent className="w-3.5 h-3.5 ml-1" />
                              خصم
                            </Button>

                            {/* 80mm Thermal Receipt Print */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-slate-600 hover:text-teal-700 hover:bg-teal-50 border-slate-200 rounded-xl"
                              onClick={() => setSelectedReceiptAppt(b)}
                              title="طباعة إيصال حراري (80mm)"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>

                            {/* WhatsApp alert button (MANUAL click-to-chat) */}
                            {b.status === 'waiting' && b.phone && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs font-bold text-emerald-600 border-emerald-200 hover:bg-emerald-50 rounded-xl"
                                onClick={() => handleManualWhatsApp(b)}
                                title="إرسال تنبيه عبر واتساب"
                              >
                                <MessageCircle className="w-3.5 h-3.5 ml-1" />
                                تنبيه
                              </Button>
                            )}

                            {/* Edit Turn button */}
                            {b.status === 'waiting' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs font-bold text-indigo-600 border-indigo-200 hover:bg-indigo-50 rounded-xl"
                                onClick={() => handleOpenEditTurn(b)}
                                title="تعديل الدور وترتيب المريض"
                              >
                                <ArrowUpDown className="w-3.5 h-3.5 ml-1" />
                                تعديل
                              </Button>
                            )}

                            {/* Start exam button if waiting */}
                            {b.status === 'waiting' && (
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs"
                                onClick={() => handleStartExam(b)}
                                disabled={isProcessing}
                              >
                                دخول
                              </Button>
                            )}

                            {/* Rx Shortcut */}
                            <Link href={`/clinic/${clinic.slug}/admin/prescriptions?appointmentId=${b.id}&patientName=${encodeURIComponent(b.patientName)}&patientPhone=${encodeURIComponent(b.phone)}&age=${encodeURIComponent(b.age || b.dob || '')}`}>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-8 px-2 text-slate-400 hover:text-[#15B8A6] hover:bg-teal-50 rounded-xl"
                                title="كتابة روشتة"
                              >
                                <FileSignature className="w-4 h-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* LEFT COLUMN: Live Turn Control Panels (4 cols on lg) */}
        <div className="lg:col-span-4 space-y-4">
          
          {/* Panel 1: Current Patient (المريض الحالي) */}
          <div className="medical-card border-t-4 border-t-[#15B8A6] p-5 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-[#15B8A6] animate-ping"></span>
                <h3 className="font-bold text-sm text-[#182230]">المريض الحالي</h3>
              </div>
              <Badge className="bg-[#E6FFFA] text-[#0D9488] border-none font-bold text-xs">بالداخل الآن</Badge>
            </div>

            {currentPatient ? (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-teal-50 border-2 border-teal-200 text-[#15B8A6] flex items-center justify-center mx-auto text-2xl font-black shadow-xs">
                  #{currentPatient.queue_number}
                </div>

                <div>
                  <h4 className="text-xl font-black text-[#182230]">{currentPatient.patientName}</h4>
                  <p className="text-xs text-slate-400 font-mono mt-0.5">{currentPatient.phone}</p>
                  <div className="inline-block mt-2 px-3 py-1 rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {currentPatient.serviceName} • {currentPatient.servicePrice} ج.م
                  </div>
                </div>

                {currentPatient.startedAt && (
                  <p className="text-xs font-semibold text-[#15B8A6] bg-teal-50 py-1.5 px-3 rounded-lg">
                    بدأ الكشف: {new Date(currentPatient.startedAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}

                {/* Actions Grid */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  <Button
                    className="w-full h-11 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-xl shadow-md shadow-[#15B8A6]/20 transition-all text-sm"
                    onClick={() => handleCompleteExam(currentPatient.id, currentPatient.patientName)}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 className="w-4 h-4 ml-1.5" />
                    إنهاء الكشف
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs font-bold text-slate-600 rounded-xl"
                      onClick={() => handleSkipPatient(currentPatient.id)}
                      disabled={isProcessing}
                    >
                      <SkipForward className="w-3.5 h-3.5 ml-1" />
                      تخطي
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs font-bold text-rose-600 border-rose-200 hover:bg-rose-50 rounded-xl"
                      onClick={() => handleNoShow(currentPatient.id)}
                      disabled={isProcessing}
                    >
                      <UserX className="w-3.5 h-3.5 ml-1" />
                      لم يحضر
                    </Button>
                  </div>

                  <Link href={`/clinic/${clinic.slug}/admin/prescriptions?appointmentId=${currentPatient.id}&patientName=${encodeURIComponent(currentPatient.patientName)}&patientPhone=${encodeURIComponent(currentPatient.phone)}&age=${encodeURIComponent(currentPatient.age || currentPatient.dob || '')}`}>
                    <Button
                      variant="ghost"
                      className="w-full h-9 text-xs font-bold text-[#15B8A6] hover:bg-teal-50 rounded-xl mt-1"
                    >
                      <FileSignature className="w-4 h-4 ml-1.5" />
                      إصدار روشتة للمريض الآن
                    </Button>
                  </Link>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-slate-100 flex items-center justify-center mx-auto text-slate-400">
                  <UserCheck className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-slate-500">لا يوجد مريض داخل غرفة الكشف حالياً</p>
                {nextPatient && (
                  <Button
                    size="sm"
                    className="bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-xl"
                    onClick={() => handleStartExam(nextPatient)}
                    disabled={isProcessing}
                  >
                    إدخال المريض التالي #{nextPatient.queue_number}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Panel 2: Next Patient (المريض التالي) */}
          <div className="medical-card border-t-4 border-t-blue-500 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-500" />
                <h3 className="font-bold text-sm text-[#182230]">المريض التالي في الدور</h3>
              </div>
              <Badge className="bg-blue-50 text-blue-700 border-none font-bold text-xs">في الانتظار</Badge>
            </div>

            {nextPatient ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center text-xl font-black">
                    #{nextPatient.queue_number}
                  </div>
                  <div className="text-right">
                    <h4 className="font-black text-base text-[#182230]">{nextPatient.patientName}</h4>
                    <p className="text-xs text-slate-400 font-mono">{nextPatient.phone}</p>
                    <span className="text-[11px] font-semibold text-blue-600">{nextPatient.serviceName}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 text-base"
                  onClick={() => handleStartExam(nextPatient)}
                  disabled={isProcessing}
                >
                  دخول المريض
                  <ArrowLeft className="w-5 h-5 mr-2" />
                </Button>

                {nextPatient.phone && (
                  <button
                    onClick={() => handleManualWhatsApp(nextPatient)}
                    className="text-xs font-bold text-emerald-600 hover:text-emerald-700 flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    إرسال إشعار استدعاء عبر واتساب
                  </button>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-slate-400 text-xs">
                لا يوجد مرضى آخرين في الانتظار.
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Edit Turn Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md p-6 space-y-5" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
                  <ArrowUpDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#182230]">تعديل دور المريض</h3>
                  <p className="text-xs text-slate-500 font-medium">{editingPatient.patientName} (دور #{editingPatient.queue_number})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPatient(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-gradient-to-r from-rose-50 to-orange-50 border border-rose-200 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-900">أولوية عاجلة فورية</p>
                  <p className="text-[11px] text-rose-600">تحويل الحالة لمستعجل ليدخل المريض التالي فوراً</p>
                </div>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => setEditServiceName('كشف مستعجل')}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg h-8 px-3"
                >
                  تقديم كمستعجل
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">رقم الدور (Queue Number)</label>
                <input
                  type="number"
                  value={editQueueNumber}
                  onChange={(e) => setEditQueueNumber(e.target.value)}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono font-black text-base focus:outline-none focus:ring-2 focus:ring-indigo-500 text-right"
                  dir="ltr"
                />
                <p className="text-[11px] text-slate-400">يمكنك تعديل رقم الدور ليأخذ المريض الترتيب المطلوب يدوياً.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">نوع الكشف والخدمة</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'normal', name: 'كشف عادي' },
                    { id: 'urgent', name: 'كشف مستعجل' },
                    { id: 'consult', name: 'استشارة' },
                  ].map(svc => {
                    const isSelected = editServiceName.includes(svc.name)
                    return (
                      <button
                        key={svc.id}
                        type="button"
                        onClick={() => setEditServiceName(svc.name)}
                        className={`py-2 px-2 text-xs font-bold rounded-xl border transition-all ${
                          isSelected
                            ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm'
                            : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                        }`}
                      >
                        {svc.name}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                onClick={handleSaveEditTurn}
                disabled={isUpdatingQueue}
                className="flex-1 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold h-11 rounded-xl"
              >
                {isUpdatingQueue ? 'جاري الحفظ...' : 'حفظ تعديل الدور'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPatient(null)}
                disabled={isUpdatingQueue}
                className="h-11 rounded-xl text-slate-600 font-bold"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {discountModalAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-sm p-6 space-y-5" dir="rtl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-[#182230]">تطبيق خصم مالي</h3>
                  <p className="text-xs text-slate-500">{discountModalAppt.patientName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscountModalAppt(null)}
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-xl flex justify-between items-center text-xs">
                <span className="font-semibold text-slate-500">السعر الأصلي:</span>
                <span className="font-black text-slate-800 text-sm">
                  {discountModalAppt.originalPrice || discountModalAppt.servicePrice} ج.م
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">نوع الخصم</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      discountType === 'fixed'
                        ? 'bg-[#15B8A6] text-white border-[#15B8A6]'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    مبلغ ثابت (ج.م)
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      discountType === 'percentage'
                        ? 'bg-[#15B8A6] text-white border-[#15B8A6]'
                        : 'bg-white text-slate-700 border-slate-200'
                    }`}
                  >
                    نسبة مئوية (%)
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-slate-700">
                  قيمة الخصم {discountType === 'percentage' ? '(%)' : '(ج.م)'}
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? 'مثال: 15' : 'مثال: 50'}
                  className="w-full h-11 px-3.5 rounded-xl border border-slate-200 font-mono font-black text-base focus:outline-none focus:ring-2 focus:ring-[#15B8A6] text-right"
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
              <Button
                type="button"
                onClick={handleSaveDiscount}
                disabled={isSavingDiscount}
                className="flex-1 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold h-11 rounded-xl"
              >
                {isSavingDiscount ? 'جاري الحفظ...' : 'تأكيد الخصم'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDiscountModalAppt(null)}
                className="h-11 rounded-xl text-slate-600 font-bold"
              >
                إلغاء
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Image Preview Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-sm animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden" dir="rtl">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#182230]">إشعار التحويل المرفق</h3>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="p-1 rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-slate-50 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewProofUrl}
                alt="Receipt proof"
                className="max-h-[60vh] max-w-full rounded-xl object-contain border border-slate-200"
              />
            </div>
            <div className="p-3 bg-white border-t border-slate-100 text-left">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewProofUrl(null)}
                className="text-xs font-bold rounded-xl"
              >
                إغلاق
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* 80mm Thermal Receipt Modal */}
      {selectedReceiptAppt && thermalReceiptData && (
        <ThermalReceiptModal
          data={thermalReceiptData}
          isOpen={true}
          onClose={() => setSelectedReceiptAppt(null)}
        />
      )}

    </div>
  )
}
