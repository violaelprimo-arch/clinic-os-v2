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
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'
import { useLanguage } from '@/context/LanguageContext'

export function AdminDashboard({ clinic }: { clinic: any }) {
  const { t, tDynamic, language, dir, isRtl } = useLanguage()
  const isFinanceEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'finance'), [clinic])
  const isPrescriptionsEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'prescriptions'), [clinic])
  const isPatientAlertsEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'patientAlerts'), [clinic])

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

  // Today in Cairo Timezone (Africa/Cairo)
  const getCairoTodayDate = () => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
    } catch (e) {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }

  const [selectedDashboardDate, setSelectedDashboardDate] = useState<string>(getCairoTodayDate())

  // Subscribe to real-time appointments for selected date
  useEffect(() => {
    if (!clinic?.id) return
    setIsLoading(true)
    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinic.id),
      where('date', '==', selectedDashboardDate)
    )

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
      setRawAppointments(data)
      setIsLoading(false)
    })
    return () => unsubscribe()
  }, [clinic?.id, selectedDashboardDate])

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

  // Dynamic Average Visit Duration calculation from completed exams today
  const dynamicAverageVisitTime = useMemo(() => {
    const completedWithDuration = rawAppointments.filter(
      (a: any) => a.status === 'completed' && a.durationMinutes && a.durationMinutes > 0
    )
    if (completedWithDuration.length > 0) {
      const sum = completedWithDuration.reduce((acc: number, curr: any) => acc + Number(curr.durationMinutes), 0)
      return Math.round(sum / completedWithDuration.length)
    }
    return Number(clinic?.averageVisitTime) || 15
  }, [rawAppointments, clinic?.averageVisitTime])

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
        let prevDuration: number | null = null
        if (currentPatient.startedAt) {
          const startMs = new Date(currentPatient.startedAt).getTime()
          prevDuration = Math.max(1, Math.round((new Date().getTime() - startMs) / 60000))
        }
        await updateDoc(doc(db, 'appointments', currentPatient.id), {
          status: 'completed',
          completedAt: new Date().toISOString(),
          ...(prevDuration ? { durationMinutes: prevDuration } : {})
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
      const appt = bookings.find(b => b.id === patientId)
      let durationMinutes: number | null = null
      if (appt?.startedAt) {
        const startMs = new Date(appt.startedAt).getTime()
        const nowMs = new Date().getTime()
        durationMinutes = Math.max(1, Math.round((nowMs - startMs) / 60000))
      }

      const updateData: any = {
        status: 'completed',
        completedAt: new Date().toISOString()
      }
      if (durationMinutes) {
        updateData.durationMinutes = durationMinutes
      }

      await updateDoc(doc(db, 'appointments', patientId), updateData)

      // Dynamically recalculate average visit time and update clinic document
      if (durationMinutes && clinic?.id) {
        const allCompleted = rawAppointments
          .filter(a => a.id !== patientId && a.status === 'completed' && a.durationMinutes)
          .map(a => Number(a.durationMinutes))
        allCompleted.push(durationMinutes)
        const newAvg = Math.round(allCompleted.reduce((a, b) => a + b, 0) / allCompleted.length)
        if (newAvg > 0) {
          updateDoc(doc(db, 'clinics', clinic.id), {
            averageVisitTime: newAvg
          }).catch(() => {})
        }
      }

      toast.success(`تم إنهاء كشف: ${patientName}${durationMinutes ? ` (استغرق ${durationMinutes} دقيقة)` : ''}`)
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
        return <Badge className="bg-primary text-primary-foreground font-bold px-3 py-1">{t('in_progress', 'بالداخل')}</Badge>
      case 'waiting':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold px-3 py-1">{t('waiting', 'في الانتظار')}</Badge>
      case 'completed':
        return <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold px-3 py-1">{t('completed', 'تم الكشف')}</Badge>
      case 'skipped':
        return <Badge className="bg-secondary text-muted-foreground border-border font-bold px-3 py-1">{t('skipped', 'تخطي')}</Badge>
      case 'no_show':
        return <Badge className="bg-rose-500/15 text-rose-600 dark:text-rose-400 border-rose-500/30 font-bold px-3 py-1">{t('no_show', 'لم يحضر')}</Badge>
      default:
        return <Badge variant="outline">{tDynamic(status)}</Badge>
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* Clinic Status Toggle & Active Branch Pill */}
      <div className="yalla-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className={`w-3.5 h-3.5 rounded-full shrink-0 ${clinic?.isClinicOpen !== false ? 'bg-emerald-500 shadow-xs shadow-emerald-500/50 animate-pulse' : 'bg-rose-500'}`} />
          <div className="text-start">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm text-foreground">
                {clinic?.isClinicOpen !== false ? t('clinic_online', 'العيادة مفتوحة حالياً (أونلاين)') : t('clinic_offline', 'العيادة مغلقة حالياً (أوفلاين)')}
              </h3>
              {selectedBranchId && selectedBranchId !== 'all' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center gap-1">
                  <Building2 className="w-3 h-3" />
                  {tDynamic(selectedBranchId)}
                </span>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {clinic?.isClinicOpen !== false ? t('clinic_online_desc', 'يمكن للمرضى الحجز والدخول في الدور الآن') : t('clinic_offline_desc', 'تم إيقاف الحجز من الموقع ولا يمكن استقبال حجوزات جديدة')}
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
              toast.success(clinic?.isClinicOpen === false ? t('open_clinic', 'تم فتح العيادة وتفعيل الحجوزات') : t('close_clinic', 'تم إغلاق العيادة وإيقاف الحجوزات'))
            } catch (err) {
              toast.error('حدث خطأ')
            } finally {
              setIsProcessing(false)
            }
          }}
          variant={clinic?.isClinicOpen !== false ? 'destructive' : 'default'}
          className={`font-bold text-xs h-9.5 px-5 rounded-xl w-full sm:w-auto ${clinic?.isClinicOpen !== false ? '' : 'yalla-gradient-btn text-white'}`}
          disabled={isProcessing}
        >
          {clinic?.isClinicOpen !== false ? t('close_clinic', 'إغلاق العيادة (إيقاف الحجز)') : t('open_clinic', 'فتح العيادة (بدء الحجز)')}
        </Button>
      </div>

      {/* Date Filter & Dynamic Consultation Average Duration Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-3.5 sm:p-4 bg-secondary/40 border border-border rounded-2xl gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-primary" />
            {t('date', 'حجوزات تاريخ')}:
          </span>
          <button
            type="button"
            onClick={() => setSelectedDashboardDate(getCairoTodayDate())}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              selectedDashboardDate === getCairoTodayDate()
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'bg-card text-foreground border border-border hover:bg-secondary'
            }`}
          >
            {t('today', 'اليوم (الحالي)')}
          </button>
          <input
            type="date"
            value={selectedDashboardDate}
            onChange={(e) => {
              if (e.target.value) setSelectedDashboardDate(e.target.value)
            }}
            className="h-8.5 px-3 text-xs font-bold font-mono rounded-xl bg-card border border-border text-foreground"
          />
          {selectedDashboardDate !== getCairoTodayDate() && (
            <span className="text-[11px] font-bold text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 px-2 py-0.5 rounded-md">
              {t('viewing_date', 'تستعرض تاريخ')}: {selectedDashboardDate}
            </span>
          )}
        </div>

        {/* Dynamic Average Consultation Duration Banner */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-card border border-border rounded-xl shadow-2xs self-start md:self-auto">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <div className="text-start">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground">{t('average_exam_time', 'متوسط وقت الكشف التقديري')}:</span>
              <span className="text-xs font-black text-primary font-mono bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                ~ {dynamicAverageVisitTime} {t('min', 'دقيقة')}
              </span>
            </div>
            <p className="text-[9.5px] text-muted-foreground font-medium">
              {t('avg_calculated_desc', 'محسوب تلقائياً وتراكمياً من الكشوفات المكتملة')}
            </p>
          </div>
        </div>
      </div>

      {/* TOP STATS CARDS */}
      <div className={`grid grid-cols-2 ${isFinanceEnabled ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4`}>
        {/* Card 1: Total Bookings */}
        <div className="yalla-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">{t('today_bookings', 'إجمالي الحجوزات')}</p>
            <h3 className="text-3xl font-black text-foreground">{bookings.length}</h3>
            <span className="text-[11px] font-medium text-muted-foreground mt-1 inline-block">{t('registered_today', 'حجز مسجل اليوم')}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Waiting */}
        <div className="yalla-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">{t('waiting_patients', 'في الانتظار')}</p>
            <h3 className="text-3xl font-black text-amber-500">{waitingPatients.length}</h3>
            <span className="text-[11px] font-medium text-amber-500/80 mt-1 inline-block">{t('waiting_to_enter', 'بانتظار الدخول')}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="yalla-card p-5 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold text-muted-foreground mb-1">{t('completed_patients', 'تم الكشف')}</p>
            <h3 className="text-3xl font-black text-primary dark:text-[#02CFF3]">{completedPatients.length}</h3>
            <span className="text-[11px] font-medium text-primary/80 dark:text-[#02CFF3]/80 mt-1 inline-block">{t('completed_visits', 'زيارات مكتملة')}</span>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-primary/10 dark:bg-[#02CFF3]/10 border border-primary/20 dark:border-[#02CFF3]/20 flex items-center justify-center text-primary dark:text-[#02CFF3]">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Total Revenue (Only when finance is enabled) */}
        {isFinanceEnabled && (
          <div className="yalla-card p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-muted-foreground mb-1">{t('total_revenue', 'إجمالي الإيرادات')}</p>
              <h3 className="text-3xl font-black text-emerald-500">
                {totalRevenue.toLocaleString()} <span className="text-sm font-bold text-muted-foreground">{t('currency_egp', 'ج.م')}</span>
              </h3>
              <span className="text-[11px] font-medium text-emerald-500/80 mt-1 inline-block">{t('collected_today', 'تحصيل اليوم')}</span>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>

      {/* PENDING PAYMENTS SECTION: مدفوعات في انتظار التأكيد */}
      {pendingPayments.length > 0 && (
        <div className="yalla-card p-5 bg-amber-500/5 border-2 border-amber-500/30 rounded-2xl shadow-sm space-y-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-amber-500/20">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-amber-500 text-white flex items-center justify-center font-black shadow-sm shrink-0">
                <AlertCircle className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="font-bold text-base text-foreground">
                    {t('pending_payment', 'مدفوعات في انتظار التأكيد (انستاباي / محفظة)')}
                  </h3>
                  <Badge className="bg-amber-500 text-white font-bold text-xs">
                    {pendingPayments.length} {t('transfer', 'تحويل')}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {t('pending_payment_desc', 'يرجى مراجعة إشعار التحويل وصورة الإيصال وتأكيد الاستلام. التأكيد لا يغير ترتيب دور المريض.')}
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
                  className="p-4 bg-card border border-amber-500/20 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-2xs hover:border-amber-500/40 transition-colors"
                >
                  <div className="flex items-center gap-3.5 flex-1 min-w-0">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-black shrink-0 text-sm">
                      #{p.queue_number || '--'}
                    </div>
                    <div className="min-w-0 space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-bold text-sm text-foreground">{p.patientName}</span>
                        <span className="text-xs font-semibold px-2 py-0.5 rounded-md bg-secondary text-foreground">
                          {tDynamic(p.serviceName)}
                        </span>
                        <span className="text-xs font-black text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                          {p.servicePrice} {t('currency_egp', 'ج.م')}
                        </span>
                        {p.discount && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                            {t('discount', 'خصم')}: {p.discount.amount || p.discount.value} {p.discount.type === 'percentage' ? '%' : t('currency_egp', 'ج.م')}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                        <span className="font-mono">{p.phone}</span>
                        <span className="font-semibold text-amber-600 dark:text-amber-400">
                          {t('transfer_method', 'طريقة التحويل')}: {p.paymentMethod === 'instapay' ? 'InstaPay' : tDynamic('محفظة إلكترونية')}
                        </span>
                        {p.transferNumber && (
                          <span className="font-mono bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20 text-amber-700 dark:text-amber-300 font-bold">
                            {t('sender_number', 'رقم المحول منه')}: {p.transferNumber}
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
                        className="h-8 px-2.5 text-xs font-bold text-primary border-primary/20 hover:bg-primary/10 rounded-xl"
                      >
                        <Eye className="w-3.5 h-3.5 ml-1 rtl:ml-1 ltr:mr-1" />
                        {t('receipt_proof_img', 'صورة الإشعار')}
                      </Button>
                    )}

                    {/* Confirm Payment Button */}
                    <Button
                      size="sm"
                      onClick={() => handleConfirmPayment(p)}
                      disabled={isProcessing}
                      className="h-8 px-3 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                    >
                      <Check className="w-3.5 h-3.5 ml-1 rtl:ml-1 ltr:mr-1" />
                      {t('confirm_receipt', 'تأكيد الاستلام')}
                    </Button>

                    {/* Reject Payment Button */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleRejectPayment(p)}
                      disabled={isProcessing}
                      className="h-8 px-2.5 text-xs font-bold text-rose-600 border-rose-500/20 hover:bg-rose-500/10 rounded-xl"
                    >
                      <X className="w-3.5 h-3.5 ml-1 rtl:ml-1 ltr:mr-1" />
                      {t('reject', 'رفض')}
                    </Button>

                    {/* Print Thermal Receipt */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedReceiptAppt(p)}
                      className="h-8 px-2 text-xs font-bold text-foreground border-border hover:bg-secondary rounded-xl"
                      title={t('print_receipt', 'طباعة إيصال حراري 80mm')}
                    >
                      <Printer className="w-3.5 h-3.5" />
                    </Button>

                    {/* WhatsApp confirmation */}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleManualWhatsAppPayment(p)}
                      className="h-8 px-2 text-xs font-bold text-emerald-600 border-emerald-500/20 hover:bg-emerald-500/10 rounded-xl"
                      title={t('send_receipt_whatsapp', 'إرسال تأكيد الاستلام عبر واتساب')}
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
          <div className="yalla-card overflow-hidden">
            {/* Header with Title and Filter Dropdown */}
            <div className="p-5 border-b border-border flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-secondary/30">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <Users className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">{t('today_queue', 'دور اليوم')}</h2>
                  <p className="text-xs text-muted-foreground">{t('queue_desc', 'قائمة المرضى والمواعيد المسجلة لتاريخ اليوم')}</p>
                </div>
              </div>

              {/* Toolbar: Service Filter + Excel Export Button */}
              <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleExportExcel}
                  className="h-9 px-3 text-xs font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl flex items-center gap-1.5"
                >
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
                  {t('export_excel', 'تصدير Excel')}
                </Button>

                <div className="relative">
                  <select
                    value={serviceFilter}
                    onChange={(e) => setServiceFilter(e.target.value)}
                    className={`h-9 ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} rounded-xl bg-card border border-border text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer appearance-none`}
                  >
                    <option value="ALL">{t('all_services', 'كل الخدمات')}</option>
                    {clinic?.services?.map((s: any) => (
                      <option key={s.id} value={s.id}>{tDynamic(s.name)}</option>
                    ))}
                    {!clinic?.services?.length && (
                      <>
                        <option value="كشف عادي">{t('regular_exam', 'كشف عادي')}</option>
                        <option value="استشارة">{t('consultation', 'استشارة')}</option>
                        <option value="كشف مستعجل">{t('urgent_exam', 'كشف مستعجل')}</option>
                      </>
                    )}
                  </select>
                  <Filter className={`w-3.5 h-3.5 absolute ${isRtl ? 'right-2.5' : 'left-2.5'} top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none`} />
                </div>
              </div>
            </div>

            {/* Patients List Table */}
            <div className="p-0">
              {isLoading ? (
                <div className="py-16 text-center text-muted-foreground">
                  <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  {t('loading', 'جاري التحميل...')}
                </div>
              ) : filteredBookings.length === 0 ? (
                <div className="py-16 text-center text-muted-foreground space-y-3">
                  <div className="w-16 h-16 rounded-3xl bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                    <Calendar className="w-8 h-8" />
                  </div>
                  <h4 className="font-bold text-base text-foreground">{t('no_bookings_today', 'لا توجد حجوزات مسجلة اليوم')}</h4>
                  <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                    {t('no_bookings_desc', 'يمكن للمرضى حجز المواعيد عبر رابط العيادة المباشر، أو يمكنك إضافة موعد يدوي.')}
                  </p>
                  <Link href={`/clinic/${clinic.slug}`} target="_blank">
                    <Button variant="outline" size="sm" className="mt-2 text-xs font-bold border-primary text-primary hover:bg-primary/10 rounded-xl">
                      {t('open_booking_page', 'فتح صفحة الحجز')}
                    </Button>
                  </Link>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {filteredBookings.map((b) => {
                    const isCurrent = b.status === 'in_progress'
                    const isExpanded = expandedCardId === b.id

                    return (
                      <div
                        key={b.id}
                        className={`transition-colors duration-150 ${
                          isCurrent
                            ? 'bg-primary/5 dark:bg-primary/10 border-s-4 border-s-primary'
                            : b.status === 'completed'
                            ? 'bg-secondary/40 opacity-75'
                            : 'hover:bg-secondary/40 bg-card'
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
                                    ? 'bg-primary text-white ring-2 ring-primary/20'
                                    : b.status === 'completed'
                                    ? 'bg-muted text-muted-foreground'
                                    : 'bg-secondary text-foreground border border-border'
                                }`}
                              >
                                <span className="text-[9px] font-bold opacity-80 leading-none">#</span>
                                <span className="text-sm leading-tight font-black">{b.queue_number || '--'}</span>
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-bold text-sm text-foreground truncate">{b.patientName}</h3>
                                <div className="flex items-center gap-1.5 mt-0.5">
                                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                    {tDynamic(b.serviceName) || t('consultation', 'كشف')}
                                  </span>
                                  {b.servicePrice !== undefined && (
                                    <span className="text-[10px] font-bold text-muted-foreground">
                                      {b.servicePrice} {t('egp', 'ج.م')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <div className="shrink-0">{getStatusBadge(b.status)}</div>
                          </div>

                          {/* Card Info Row: Phone + Time + Payment Badge */}
                          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t border-border flex-wrap gap-1">
                            <div className="flex items-center gap-2">
                              <span className="font-mono text-foreground/80">{b.phone}</span>
                              {b.createdAt && (
                                <span className="text-[10px] text-muted-foreground">
                                  {new Date(b.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5">
                              {b.paymentStatus === 'paid' ? (
                                <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                                  {t('paid', 'مدفوع ✓')}
                                </span>
                              ) : (
                                <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                                  {t('unpaid', 'غير مدفوع')}
                                </span>
                              )}
                              {b.discount && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                  {t('discount_label', 'خصم')} {b.discount.amount || b.discount.value} {b.discount.type === 'percentage' ? '%' : t('egp', 'ج.م')}
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
                                className="flex-1 h-9 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-xs"
                                onClick={() => handleStartExam(b)}
                                disabled={isProcessing}
                              >
                                <Play className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                                {t('patient_entry', 'دخول المريض')}
                              </Button>
                            )}

                            {isCurrent && (
                              <Button
                                size="sm"
                                className="flex-1 h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                                onClick={() => handleCompleteExam(b.id, b.patientName)}
                                disabled={isProcessing}
                              >
                                <CheckCircle2 className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                                {t('end_exam', 'إنهاء الكشف')}
                              </Button>
                            )}

                            {/* Quick Confirm Payment */}
                            {b.paymentStatus !== 'paid' && b.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirmPayment(b)}
                                className="h-9 px-3 text-xs font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 rounded-xl"
                                disabled={isProcessing}
                              >
                                <DollarSign className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                {t('confirm_payment', 'تأكيد الدفع')}
                              </Button>
                            )}

                            {/* Expand / Collapse Secondary Details */}
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setExpandedCardId(isExpanded ? null : b.id)}
                              className={`h-9 px-2.5 rounded-xl border-border text-foreground transition-colors ${
                                isExpanded ? 'bg-secondary text-primary' : 'hover:bg-secondary'
                              }`}
                              title={t('more_options', 'المزيد من الخيارات')}
                            >
                              {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                            </Button>
                          </div>

                          {/* Expandable Section for Secondary Actions */}
                          {isExpanded && (
                            <div className="p-3 bg-secondary/60 rounded-xl border border-border space-y-2 animate-in fade-in slide-in-from-top-1 duration-150">
                              <p className="text-[10px] font-bold text-muted-foreground">{t('additional_actions', 'إجراءات إضافية:')}</p>
                              <div className="grid grid-cols-2 gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-bold text-foreground border-border hover:bg-card rounded-lg justify-start"
                                  onClick={() => handleOpenDiscountModal(b)}
                                >
                                  <Percent className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-primary`} />
                                  {t('apply_discount', 'تطبيق خصم')}
                                </Button>

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-bold text-foreground border-border hover:bg-card rounded-lg justify-start"
                                  onClick={() => setSelectedReceiptAppt(b)}
                                >
                                  <Printer className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-primary`} />
                                  {t('thermal_receipt', 'إيصال حراري')}
                                </Button>

                                {isPatientAlertsEnabled && b.phone && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 rounded-lg justify-start"
                                    onClick={() => handleManualWhatsApp(b)}
                                  >
                                    <MessageCircle className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-emerald-500`} />
                                    {t('whatsapp_alert', 'تنبيه واتساب')}
                                  </Button>
                                )}

                                {b.status === 'waiting' && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="h-8 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 rounded-lg justify-start"
                                    onClick={() => handleOpenEditTurn(b)}
                                  >
                                    <ArrowUpDown className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-primary`} />
                                    {t('edit_turn_action', 'تعديل الدور')}
                                  </Button>
                                )}

                                {isPrescriptionsEnabled && (
                                  <Link
                                    href={`/clinic/${clinic.slug}/admin/prescriptions?appointmentId=${b.id}&patientName=${encodeURIComponent(b.patientName)}&patientPhone=${encodeURIComponent(b.phone)}&age=${encodeURIComponent(b.age || b.dob || '')}`}
                                    className="col-span-2"
                                  >
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      className="w-full h-8 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 rounded-lg justify-center"
                                    >
                                      <FileSignature className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                                      {t('write_rx', 'كتابة روشتة طبية')}
                                    </Button>
                                  </Link>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* ================= DESKTOP PATIENT ROW (Screen >= 640px) ================= */}
                        <div className="hidden sm:flex p-4 items-center justify-between gap-4">
                          {/* Left/Right Part: Queue Number & Patient Details */}
                          <div className="flex items-center gap-3.5 flex-1 min-w-0">
                            {/* Queue Number Badge */}
                            <div
                              className={`w-11 h-11 rounded-xl flex flex-col items-center justify-center shrink-0 font-black shadow-xs ${
                                isCurrent
                                  ? 'bg-primary text-white ring-2 ring-primary/20'
                                  : b.status === 'completed'
                                  ? 'bg-muted text-muted-foreground'
                                  : 'bg-secondary text-foreground border border-border'
                              }`}
                            >
                              <span className="text-[9px] font-bold opacity-80 leading-none">#</span>
                              <span className="text-base leading-tight font-black">{b.queue_number || '--'}</span>
                            </div>

                            <div className="min-w-0">
                              <div className="flex items-center gap-2 flex-wrap">
                                <h3 className="font-bold text-sm text-foreground truncate">{b.patientName}</h3>
                                {/* Service Pill */}
                                <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                                  {tDynamic(b.serviceName) || t('consultation', 'كشف')}
                                </span>
                                {b.servicePrice !== undefined && (
                                  <span className="text-[11px] font-bold text-muted-foreground">
                                    {b.servicePrice} {t('egp', 'ج.م')}
                                  </span>
                                )}
                                {b.discount && (
                                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                    {t('discount_label', 'خصم:')} {b.discount.amount || b.discount.value} {b.discount.type === 'percentage' ? '%' : t('egp', 'ج.م')}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5 flex-wrap">
                                <span className="font-mono text-foreground/80">{b.phone}</span>
                                {b.createdAt && (
                                  <span>{new Date(b.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}</span>
                                )}
                                {b.paymentMethod && b.paymentMethod !== 'cash' && (
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20 inline-flex items-center gap-1 font-mono">
                                    <span>{b.paymentMethod === 'instapay' ? 'InstaPay' : tDynamic('محفظة')}:</span>
                                    <span>{b.transferNumber || t('waiting_confirmation', 'بانتظار التأكيد')}</span>
                                  </span>
                                )}
                                {b.paymentStatus === 'paid' && (
                                  <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded border border-emerald-500/20">
                                    {t('paid', 'مدفوع ✓')}
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {getStatusBadge(b.status)}

                            {/* Quick Confirm Payment */}
                            {b.paymentStatus !== 'paid' && b.status !== 'completed' && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleConfirmPayment(b)}
                                className="h-8 px-2.5 text-xs font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 rounded-xl"
                                title={t('confirm_payment', 'تأكيد الدفع')}
                                disabled={isProcessing}
                              >
                                <DollarSign className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                {t('confirm_payment', 'تأكيد الدفع')}
                              </Button>
                            )}

                            {/* Discount button */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-xs font-bold text-foreground border-border hover:bg-secondary rounded-xl"
                              onClick={() => handleOpenDiscountModal(b)}
                              title={t('apply_discount', 'تطبيق خصم أو تعديل السعر')}
                            >
                              <Percent className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'} text-primary`} />
                              {t('discount_label', 'خصم')}
                            </Button>

                            {/* 80mm Thermal Receipt Print */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-muted-foreground hover:text-foreground hover:bg-secondary border-border rounded-xl"
                              onClick={() => setSelectedReceiptAppt(b)}
                              title={t('print_thermal_receipt', 'طباعة إيصال حراري (80mm)')}
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </Button>

                            {/* WhatsApp alert button (MANUAL click-to-chat) */}
                            {isPatientAlertsEnabled && b.status === 'waiting' && b.phone && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                                onClick={() => handleManualWhatsApp(b)}
                                title={t('send_whatsapp_alert', 'إرسال تنبيه عبر واتساب')}
                              >
                                <MessageCircle className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                {t('alert_short', 'تنبيه')}
                              </Button>
                            )}

                            {/* Edit Turn button */}
                            {b.status === 'waiting' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2.5 text-xs font-bold text-primary border-primary/30 hover:bg-primary/10 rounded-xl"
                                onClick={() => handleOpenEditTurn(b)}
                                title={t('edit_turn_tooltip', 'تعديل الدور وترتيب المريض')}
                              >
                                <ArrowUpDown className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                {t('edit_short', 'تعديل')}
                              </Button>
                            )}

                            {/* Start exam button if waiting */}
                            {b.status === 'waiting' && (
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs font-bold bg-primary hover:bg-primary-hover text-white rounded-xl shadow-xs"
                                onClick={() => handleStartExam(b)}
                                disabled={isProcessing}
                              >
                                {t('entry', 'دخول')}
                              </Button>
                            )}

                            {/* Rx Shortcut */}
                            {isPrescriptionsEnabled && (
                              <Link href={`/clinic/${clinic.slug}/admin/prescriptions?appointmentId=${b.id}&patientName=${encodeURIComponent(b.patientName)}&patientPhone=${encodeURIComponent(b.phone)}&age=${encodeURIComponent(b.age || b.dob || '')}`}>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-8 px-2 text-muted-foreground hover:text-primary hover:bg-primary/10 rounded-xl"
                                  title={t('write_rx', 'كتابة روشتة')}
                                >
                                  <FileSignature className="w-4 h-4" />
                                </Button>
                              </Link>
                            )}
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
          <div className="yalla-card border-t-4 border-t-primary p-5 space-y-4 relative overflow-hidden">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <span className="w-2.5 h-2.5 rounded-full bg-primary animate-ping"></span>
                <h3 className="font-bold text-sm text-foreground">{t('current_patient', 'المريض الحالي')}</h3>
              </div>
              <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-xs">{t('inside_now', 'بالداخل الآن')}</Badge>
            </div>

            {currentPatient ? (
              <div className="space-y-4 text-center">
                <div className="w-16 h-16 rounded-2xl bg-primary/10 border-2 border-primary/30 text-primary flex items-center justify-center mx-auto text-2xl font-black shadow-xs">
                  #{currentPatient.queue_number}
                </div>

                <div>
                  <h4 className="text-xl font-black text-foreground">{currentPatient.patientName}</h4>
                  <p className="text-xs text-muted-foreground font-mono mt-0.5">{currentPatient.phone}</p>
                  <div className="inline-block mt-2 px-3 py-1 rounded-full bg-secondary border border-border text-xs font-bold text-foreground">
                    {tDynamic(currentPatient.serviceName)} • {currentPatient.servicePrice} {t('egp', 'ج.م')}
                  </div>
                </div>

                {currentPatient.startedAt && (
                  <p className="text-xs font-semibold text-primary bg-primary/10 py-1.5 px-3 rounded-xl">
                    {t('exam_started_at', 'بدأ الكشف:')} {new Date(currentPatient.startedAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </p>
                )}

                {/* Actions Grid */}
                <div className="grid grid-cols-1 gap-2 pt-2">
                  <Button
                    className="yalla-gradient-btn w-full h-11 text-white font-bold rounded-xl shadow-md transition-all text-sm"
                    onClick={() => handleCompleteExam(currentPatient.id, currentPatient.patientName)}
                    disabled={isProcessing}
                  >
                    <CheckCircle2 className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                    {t('end_exam', 'إنهاء الكشف')}
                  </Button>

                  <div className="grid grid-cols-2 gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs font-bold text-foreground border-border hover:bg-secondary rounded-xl"
                      onClick={() => handleSkipPatient(currentPatient.id)}
                      disabled={isProcessing}
                    >
                      <SkipForward className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                      {t('skip', 'تخطي')}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-9 text-xs font-bold text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/10 rounded-xl"
                      onClick={() => handleNoShow(currentPatient.id)}
                      disabled={isProcessing}
                    >
                      <UserX className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                      {t('no_show', 'لم يحضر')}
                    </Button>
                  </div>

                  {isPrescriptionsEnabled && (
                    <Link href={`/clinic/${clinic.slug}/admin/prescriptions?appointmentId=${currentPatient.id}&patientName=${encodeURIComponent(currentPatient.patientName)}&patientPhone=${encodeURIComponent(currentPatient.phone)}&age=${encodeURIComponent(currentPatient.age || currentPatient.dob || '')}`}>
                      <Button
                        variant="ghost"
                        className="w-full h-9 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl mt-1"
                      >
                        <FileSignature className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                        {t('issue_rx_now', 'إصدار روشتة للمريض الآن')}
                      </Button>
                    </Link>
                  )}
                </div>
              </div>
            ) : (
              <div className="py-8 text-center space-y-3">
                <div className="w-12 h-12 rounded-2xl bg-secondary flex items-center justify-center mx-auto text-muted-foreground">
                  <UserCheck className="w-6 h-6" />
                </div>
                <p className="text-xs font-bold text-muted-foreground">{t('no_patient_inside', 'لا يوجد مريض داخل غرفة الكشف حالياً')}</p>
                {nextPatient && (
                  <Button
                    size="sm"
                    className="bg-primary hover:bg-primary-hover text-white font-bold rounded-xl"
                    onClick={() => handleStartExam(nextPatient)}
                    disabled={isProcessing}
                  >
                    {t('admit_next_patient', 'إدخال المريض التالي')} #{nextPatient.queue_number}
                  </Button>
                )}
              </div>
            )}
          </div>

          {/* Panel 2: Next Patient (المريض التالي) */}
          <div className="yalla-card border-t-4 border-t-cyan-500 p-5 space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-cyan-500" />
                <h3 className="font-bold text-sm text-foreground">{t('next_patient', 'المريض التالي في الدور')}</h3>
              </div>
              <Badge className="bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20 font-bold text-xs">{t('waiting', 'في الانتظار')}</Badge>
            </div>

            {nextPatient ? (
              <div className="space-y-4 text-center">
                <div className="flex items-center justify-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-cyan-500/10 border border-cyan-500/30 text-cyan-600 dark:text-cyan-400 flex items-center justify-center text-xl font-black">
                    #{nextPatient.queue_number}
                  </div>
                  <div className={isRtl ? 'text-right' : 'text-left'}>
                    <h4 className="font-black text-base text-foreground">{nextPatient.patientName}</h4>
                    <p className="text-xs text-muted-foreground font-mono">{nextPatient.phone}</p>
                    <span className="text-[11px] font-semibold text-cyan-600 dark:text-cyan-400">{tDynamic(nextPatient.serviceName)}</span>
                  </div>
                </div>

                <Button
                  className="w-full h-12 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-600/20 text-base"
                  onClick={() => handleStartExam(nextPatient)}
                  disabled={isProcessing}
                >
                  {t('patient_entry', 'دخول المريض')}
                  {isRtl ? <ArrowLeft className="w-5 h-5 mr-2" /> : <ArrowRight className="w-5 h-5 ml-2" />}
                </Button>

                {isPatientAlertsEnabled && nextPatient.phone && (
                  <button
                    onClick={() => handleManualWhatsApp(nextPatient)}
                    className="text-xs font-bold text-emerald-600 dark:text-emerald-400 hover:opacity-80 flex items-center justify-center gap-1.5 mx-auto"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    {t('whatsapp_call_notice', 'إرسال إشعار استدعاء عبر واتساب')}
                  </button>
                )}
              </div>
            ) : (
              <div className="py-6 text-center text-muted-foreground text-xs">
                {t('no_more_waiting', 'لا يوجد مرضى آخرين في الانتظار.')}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Edit Turn Modal */}
      {editingPatient && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-md p-6 space-y-5 text-card-foreground" dir={dir}>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                  <ArrowUpDown className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">{t('edit_turn_title', 'تعديل دور المريض')}</h3>
                  <p className="text-xs text-muted-foreground font-medium">{editingPatient.patientName} ({t('turn_num', 'دور')} #{editingPatient.queue_number})</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingPatient(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-rose-500/10 border border-rose-500/20 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-xs font-bold text-rose-600 dark:text-rose-400">{t('urgent_priority', 'أولوية عاجلة فورية')}</p>
                  <p className="text-[11px] text-muted-foreground">{t('urgent_desc', 'تحويل الحالة لمستعجل ليدخل المريض التالي فوراً')}</p>
                </div>
                <Button
                  size="sm"
                  type="button"
                  onClick={() => setEditServiceName('كشف مستعجل')}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-lg h-8 px-3"
                >
                  {t('set_urgent', 'تقديم كمستعجل')}
                </Button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">{t('queue_num_label', 'رقم الدور (Queue Number)')}</label>
                <input
                  type="number"
                  value={editQueueNumber}
                  onChange={(e) => setEditQueueNumber(e.target.value)}
                  className={`w-full h-11 px-3.5 rounded-xl bg-background border border-input text-foreground font-mono font-black text-base focus:outline-none focus:ring-2 focus:ring-primary ${isRtl ? 'text-right' : 'text-left'}`}
                  dir="ltr"
                />
                <p className="text-[11px] text-muted-foreground">{t('edit_turn_hint', 'يمكنك تعديل رقم الدور ليأخذ المريض الترتيب المطلوب يدوياً.')}</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">{t('exam_type_label', 'نوع الكشف والخدمة')}</label>
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
                            ? 'bg-primary text-white border-primary shadow-sm'
                            : 'bg-secondary text-foreground border-border hover:bg-secondary/80'
                        }`}
                      >
                        {tDynamic(svc.name)}
                      </button>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                onClick={handleSaveEditTurn}
                disabled={isUpdatingQueue}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold h-11 rounded-xl"
              >
                {isUpdatingQueue ? t('saving', 'جاري الحفظ...') : t('save_edit_turn', 'حفظ تعديل الدور')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setEditingPatient(null)}
                disabled={isUpdatingQueue}
                className="h-11 rounded-xl text-foreground font-bold border-border hover:bg-secondary"
              >
                {t('cancel', 'إلغاء')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Discount Modal */}
      {discountModalAppt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-card rounded-2xl shadow-2xl border border-border w-full max-w-sm p-6 space-y-5 text-card-foreground" dir={dir}>
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
                  <Percent className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">{t('apply_discount', 'تطبيق خصم مالي')}</h3>
                  <p className="text-xs text-muted-foreground">{discountModalAppt.patientName}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setDiscountModalAppt(null)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-secondary"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="bg-secondary p-3 rounded-xl flex justify-between items-center text-xs">
                <span className="font-semibold text-muted-foreground">{t('original_price', 'السعر الأصلي:')}</span>
                <span className="font-black text-foreground text-sm">
                  {discountModalAppt.originalPrice || discountModalAppt.servicePrice} {t('egp', 'ج.م')}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">{t('discount_type', 'نوع الخصم')}</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setDiscountType('fixed')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      discountType === 'fixed'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card text-foreground border-border hover:bg-secondary'
                    }`}
                  >
                    {t('fixed_amount', 'مبلغ ثابت (ج.م)')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDiscountType('percentage')}
                    className={`py-2 text-xs font-bold rounded-xl border transition-all ${
                      discountType === 'percentage'
                        ? 'bg-primary text-white border-primary'
                        : 'bg-card text-foreground border-border hover:bg-secondary'
                    }`}
                  >
                    {t('percentage', 'نسبة مئوية (%)')}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-foreground">
                  {t('discount_val', 'قيمة الخصم')} {discountType === 'percentage' ? '(%)' : `(${t('egp', 'ج.م')})`}
                </label>
                <input
                  type="number"
                  value={discountValue}
                  onChange={(e) => setDiscountValue(e.target.value)}
                  placeholder={discountType === 'percentage' ? '15' : '50'}
                  className={`w-full h-11 px-3.5 rounded-xl bg-background border border-input text-foreground font-mono font-black text-base focus:outline-none focus:ring-2 focus:ring-primary ${isRtl ? 'text-right' : 'text-left'}`}
                  dir="ltr"
                />
              </div>
            </div>

            <div className="flex items-center gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                onClick={handleSaveDiscount}
                disabled={isSavingDiscount}
                className="flex-1 bg-primary hover:bg-primary-hover text-white font-bold h-11 rounded-xl"
              >
                {isSavingDiscount ? t('saving', 'جاري الحفظ...') : t('confirm_discount', 'تأكيد الخصم')}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDiscountModalAppt(null)}
                className="h-11 rounded-xl text-foreground font-bold border-border hover:bg-secondary"
              >
                {t('cancel', 'إلغاء')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Proof Image Preview Modal */}
      {previewProofUrl && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-md animate-in fade-in">
          <div className="bg-card rounded-2xl shadow-2xl border border-border max-w-lg w-full overflow-hidden text-card-foreground" dir={dir}>
            <div className="p-4 border-b border-border flex items-center justify-between">
              <h3 className="font-bold text-sm text-foreground">{t('receipt_proof', 'إشعار التحويل المرفق')}</h3>
              <button
                onClick={() => setPreviewProofUrl(null)}
                className="p-1 rounded-lg hover:bg-secondary text-muted-foreground"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 bg-secondary/50 flex items-center justify-center max-h-[70vh] overflow-auto">
              <img
                src={previewProofUrl}
                alt="Receipt proof"
                className="max-h-[60vh] max-w-full rounded-xl object-contain border border-border"
              />
            </div>
            <div className={`p-3 bg-card border-t border-border ${isRtl ? 'text-left' : 'text-right'}`}>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setPreviewProofUrl(null)}
                className="text-xs font-bold rounded-xl border-border"
              >
                {t('close', 'إغلاق')}
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
