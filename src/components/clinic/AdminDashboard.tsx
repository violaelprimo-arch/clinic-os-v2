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
  Sparkles, AlertCircle, ChevronDown, ChevronUp, RefreshCw, ArrowUpDown, X, RotateCcw,
  Printer, Download, Tag, Check, Eye, Building2, Percent, FileSpreadsheet,
  ExternalLink, Copy, Search, Tv, Ticket, UserPlus
} from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, onSnapshot, updateDoc, doc } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { sortQueue } from '@/lib/queueCalculations'
import { ThermalReceiptModal } from '@/components/clinic/ThermalReceiptModal'
import { ShiftClosingModal } from '@/components/clinic/ShiftClosingModal'
import { ExaminationTicketModal } from '@/components/clinic/ExaminationTicketModal'
import { ThermalReceiptData, generateExaminationTicketHtml, printHtmlViaIframe } from '@/lib/printService'
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
  const isTvEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'tvScreen'), [clinic])

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
  const [selectedTicketAppt, setSelectedTicketAppt] = useState<any | null>(null)
  const [isShiftClosingOpen, setIsShiftClosingOpen] = useState(false)

  // Direct 1-Click Examination Ticket Thermal Print (80mm)
  const handleDirectPrintTicket = (appt: any) => {
    const ticketData = {
      clinicName: clinic?.clinicName || 'العيادة الطبية',
      branchName: appt.branchName || clinic?.branchName,
      logoUrl: clinic?.logoUrl,
      queueNumber: appt.queue_number || appt.turnNumber || '1',
      effectivePosition: appt.queue_number || '1',
      patientName: appt.patientName || 'المريض',
      patientPhone: appt.phone || '',
      serviceName: appt.serviceName || appt.service || 'كشف طبي',
      isUrgent: appt.isUrgent || false,
      date: appt.date || new Date().toISOString().split('T')[0],
      time: appt.time || '',
      paymentStatus: appt.paymentStatus || 'pending',
      appointmentId: appt.id
    }
    const html = generateExaminationTicketHtml(ticketData)
    printHtmlViaIframe(html, '80mm')
    toast.success(`تم إرسال تيكت الدور (#${ticketData.queueNumber} - ${ticketData.patientName}) للطابعة الحرارية 🖨️`)
  }

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

  const [branches, setBranches] = useState<any[]>([])

  // Subscribe to clinic branches
  useEffect(() => {
    if (!clinic?.id) return
    const qB = query(collection(db, 'branches'), where('clinicId', '==', clinic.id))
    const unsub = onSnapshot(qB, (snap) => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    })
    return () => unsub()
  }, [clinic?.id])

  // Filter by selected branch
  const branchFilteredAppointments = useMemo(() => {
    if (!selectedBranchId || selectedBranchId === 'all') {
      return rawAppointments
    }
    const currentBranchObj = branches.find(b => b.id === selectedBranchId)
    const isMainBranchSelected = selectedBranchId === 'main' || currentBranchObj?.isMain

    return rawAppointments.filter(appt => {
      const apptBranch = appt.branch_id || appt.branchId
      if (apptBranch) {
        return apptBranch === selectedBranchId
      }
      return isMainBranchSelected
    })
  }, [rawAppointments, selectedBranchId, branches])

  // Intelligent Queue Sorting adhering to clinic settings
  const bookings = useMemo(() => {
    const data = branchFilteredAppointments
    const completed = data
      .filter((d: any) => d.status === 'completed' || d.status === 'cancelled')
      .sort((a: any, b: any) => (a.queue_number || 0) - (b.queue_number || 0))
    const inProgress = data.filter((d: any) => d.status === 'in_progress')
    const skipped = data.filter((d: any) => d.status === 'skipped' || d.status === 'no_show')
    const orderedWaiting = sortQueue(data, clinic)
    return [...inProgress, ...orderedWaiting, ...skipped, ...completed]
  }, [branchFilteredAppointments, clinic])

  const skippedPatients = useMemo(() => {
    return branchFilteredAppointments.filter((b: any) => b.status === 'skipped' || b.status === 'no_show')
  }, [branchFilteredAppointments])

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

  // Active daily bookings count (excluding cancelled)
  const activeBookingsCount = useMemo(() => {
    return branchFilteredAppointments.filter((d: any) => d.status !== 'cancelled').length
  }, [branchFilteredAppointments])

  // Resolve daily limit based on selected branch or clinic settings
  const effectiveMaxDailyBookings = useMemo(() => {
    if (selectedBranchId && selectedBranchId !== 'all') {
      const bObj = branches.find(b => b.id === selectedBranchId)
      if (bObj && bObj.maxDailyBookings) return Number(bObj.maxDailyBookings) || 0
    }
    return Number(clinic?.maxDailyBookings) || 0
  }, [selectedBranchId, branches, clinic?.maxDailyBookings])

  const isCapacityFull = effectiveMaxDailyBookings > 0 && activeBookingsCount >= effectiveMaxDailyBookings

  // Dynamic Average Visit Duration: strictly isolated per branch
  const dynamicAverageVisitTime = useMemo(() => {
    const completedWithDuration = branchFilteredAppointments.filter(
      (a: any) => a.status === 'completed' && a.durationMinutes && a.durationMinutes > 0
    )
    if (completedWithDuration.length > 0) {
      const sum = completedWithDuration.reduce((acc: number, curr: any) => acc + Number(curr.durationMinutes), 0)
      return Math.round(sum / completedWithDuration.length)
    }

    const currentBranchObj = branches.find(b => b.id === selectedBranchId)
    if (currentBranchObj) {
      return Number(currentBranchObj.slotDuration || currentBranchObj.averageVisitTime) || 15
    }

    return Number(clinic?.averageVisitTime) || 15
  }, [branchFilteredAppointments, selectedBranchId, branches, clinic?.averageVisitTime])

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

  // Table status filter tabs
  const [statusTabFilter, setStatusTabFilter] = useState<'all' | 'waiting' | 'completed' | 'skipped' | 'cancelled'>('all')

  // Filtered queue for table
  const filteredBookings = useMemo(() => {
    return bookings.filter(b => {
      const matchesService = serviceFilter === 'ALL' || b.serviceId === serviceFilter || b.serviceName === serviceFilter
      const qNumStr = String(b.queue_number || '')
      const matchesSearch = !searchQuery ||
        (b.patientName && b.patientName.includes(searchQuery)) ||
        (b.phone && b.phone.includes(searchQuery)) ||
        qNumStr.includes(searchQuery)

      const matchesStatus =
        statusTabFilter === 'all'
          ? true
          : statusTabFilter === 'waiting'
          ? (b.status === 'waiting' || !b.status)
          : statusTabFilter === 'completed'
          ? b.status === 'completed'
          : statusTabFilter === 'skipped'
          ? (b.status === 'skipped' || b.status === 'no_show')
          : statusTabFilter === 'cancelled'
          ? b.status === 'cancelled'
          : true

      return matchesService && matchesSearch && matchesStatus
    })
  }, [bookings, serviceFilter, searchQuery, statusTabFilter])

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

        // Real Web Push dispatch
        import('@/lib/patientNotificationHelper').then(({ triggerPatientEventPush }) => {
          triggerPatientEventPush({
            type: 'payment_confirmed',
            appointmentId: patient.id,
            clinicId: clinic?.id || patient.clinic_id,
            clinicSlug: clinic?.slug,
            clinicName: clinic?.clinicName || 'العيادة',
            patientPhone: patient.phone,
            queueNumber: patient.queue_number,
            eventId: `push_pay_conf_${patient.id}`,
          }).catch(() => {})
        });
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
        startedAt: new Date().toISOString(),
        calledAt: new Date().toISOString(),
        ...(!patient.arrivedAt ? { arrivedAt: patient.createdAt || new Date().toISOString() } : {})
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

        // Real Web Push dispatch to the called patient
        import('@/lib/patientNotificationHelper').then(({ triggerPatientEventPush }) => {
          triggerPatientEventPush({
            type: 'turn_ready',
            appointmentId: patient.id,
            clinicId: clinic?.id || patient.clinic_id,
            clinicSlug: clinic?.slug,
            clinicName: clinic?.clinicName || 'العيادة',
            patientPhone: patient.phone,
            queueNumber: patient.queue_number,
            eventId: `push_turn_ready_${patient.id}`,
          }).catch(() => {})
        });
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
        if (aheadCount <= 5 && aheadCount > 0) {
          import('@/lib/patientNotificationHelper').then(({ triggerPatientEventPush }) => {
            triggerPatientEventPush({
              type: 'approaching_turn',
              appointmentId: wp.id,
              clinicId: clinic?.id || wp.clinic_id,
              clinicSlug: clinic?.slug,
              clinicName: clinic?.clinicName || 'العيادة',
              patientPhone: wp.phone,
              aheadCount,
              eventId: `push_approaching_${aheadCount}_${wp.id}`,
            }).catch(() => {})
          });
        }
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
      // Dynamically recalculate average visit time for this branch only
      if (durationMinutes && clinic?.id) {
        const targetAppt = rawAppointments.find(a => a.id === patientId)
        const targetBranchId = targetAppt?.branch_id || targetAppt?.branchId || selectedBranchId

        if (targetBranchId && targetBranchId !== 'all') {
          const branchCompleted = rawAppointments
            .filter(a => ((a.branch_id === targetBranchId || a.branchId === targetBranchId) || (!a.branch_id && !a.branchId && targetBranchId === 'main')) && a.id !== patientId && a.status === 'completed' && a.durationMinutes)
            .map(a => Number(a.durationMinutes))
          branchCompleted.push(durationMinutes)
          const newAvg = Math.round(branchCompleted.reduce((a, b) => a + b, 0) / branchCompleted.length)
          if (newAvg > 0) {
            updateDoc(doc(db, 'branches', targetBranchId), {
              slotDuration: newAvg,
              averageVisitTime: newAvg
            }).catch(() => {})
          }
        }
      }

      toast.success(`تم إنهاء كشف: ${patientName}${durationMinutes ? ` (استغرق ${durationMinutes} دقيقة)` : ''}`)
    } catch (err) {
      toast.error('حدث خطأ أثناء إنهاء الكشف.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRecallPatient = async (patient: any) => {
    if (!patient || isProcessing) return
    setIsProcessing(true)
    try {
      const now = new Date().toISOString()
      await updateDoc(doc(db, 'appointments', patient.id), {
        calledAt: now,
      })

      if (patient.phone) {
        createClinicNotification({
          clinicId: clinic?.id || patient.clinic_id,
          branchId: patient.branch_id,
          recipientType: 'patient',
          recipientTarget: patient.phone,
          title: 'تذكير: دورك الآن للدخول!',
          body: `مرحباً ${patient.patientName}، يرجى التوجه لغرفة الكشف فوراً (تذكرة #${patient.queue_number || ''}). الطبيب بانتظارك.`,
          type: 'turn_ready',
          eventId: `turn_recall_${patient.id}_${Date.now()}`,
          appointmentId: patient.id
        }).catch(() => {})

        import('@/lib/patientNotificationHelper').then(({ triggerPatientEventPush }) => {
          triggerPatientEventPush({
            type: 'turn_ready',
            appointmentId: patient.id,
            clinicId: clinic?.id || patient.clinic_id,
            clinicSlug: clinic?.slug,
            clinicName: clinic?.clinicName || 'العيادة',
            patientPhone: patient.phone,
            queueNumber: patient.queue_number,
            eventId: `push_turn_recall_${patient.id}_${Date.now()}`,
          }).catch(() => {})
        })
      }

      toast.success(`تمت إعادة النداء على المريض #${patient.queue_number} (${patient.patientName}) بنجاح.`)
    } catch (err) {
      console.error('Error recalling patient:', err)
      toast.error('حدث خطأ أثناء إعادة النداء.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSkipPatient = async (patient: any) => {
    if (!patient || isProcessing) return
    setIsProcessing(true)
    try {
      // 1. Mark patient as skipped, strictly preserving their original queue_number
      await updateDoc(doc(db, 'appointments', patient.id), {
        status: 'skipped',
        skippedAt: new Date().toISOString(),
        priorityNext: false
      })

      // 2. Automatically admit the next waiting patient into the exam room
      const upcoming = waitingPatients.find((p: any) => p.id !== patient.id)
      if (upcoming) {
        let prevDuration: number | null = null
        if (patient.startedAt) {
          const startMs = new Date(patient.startedAt).getTime()
          prevDuration = Math.max(1, Math.round((new Date().getTime() - startMs) / 60000))
        }

        await updateDoc(doc(db, 'appointments', upcoming.id), {
          status: 'in_progress',
          paymentStatus: 'paid',
          startedAt: new Date().toISOString(),
          calledAt: new Date().toISOString(),
          ...(!patient.arrivedAt ? { arrivedAt: patient.createdAt || new Date().toISOString() } : {}),
          priorityNext: false
        })

        if (upcoming.phone) {
          createClinicNotification({
            clinicId: clinic?.id || upcoming.clinic_id,
            branchId: upcoming.branch_id,
            recipientType: 'patient',
            recipientTarget: upcoming.phone,
            title: 'دورك الآن للدخول!',
            body: `مرحباً ${upcoming.patientName}، حان دورك الآن للدخول لغرفة الكشف (تذكرة #${upcoming.queue_number || ''}). يرجى الدخول مباشرة.`,
            type: 'turn_ready',
            eventId: `turn_ready_${upcoming.id}`,
            appointmentId: upcoming.id
          }).catch(() => {})

          import('@/lib/patientNotificationHelper').then(({ triggerPatientEventPush }) => {
            triggerPatientEventPush({
              type: 'turn_ready',
              appointmentId: upcoming.id,
              clinicId: clinic?.id || upcoming.clinic_id,
              clinicSlug: clinic?.slug,
              clinicName: clinic?.clinicName || 'العيادة',
              patientPhone: upcoming.phone,
              queueNumber: upcoming.queue_number,
              eventId: `push_turn_ready_${upcoming.id}`,
            }).catch(() => {})
          })
        }

        toast.info(`تم تخطي دور المريض #${patient.queue_number} وإدخال الدور التالي #${upcoming.queue_number} (${upcoming.patientName}).`)
      } else {
        toast.info(`تم تخطي دور المريض #${patient.queue_number}. لا يوجد مرضى آخرون في الانتظار حالياً.`)
      }
    } catch (err) {
      console.error('Error skipping patient:', err)
      toast.error('حدث خطأ أثناء تخطي المريض.')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleRequeueSkippedPatient = async (patient: any) => {
    if (!patient || isProcessing) return
    setIsProcessing(true)
    try {
      await updateDoc(doc(db, 'appointments', patient.id), {
        status: 'waiting',
        priorityNext: true,
        requeuedAt: new Date().toISOString(),
        arrivedAt: new Date().toISOString()
      })
      if (statusTabFilter === 'skipped') {
        setStatusTabFilter('all')
      }
      toast.success(`تم إدخال المريض رقم #${patient.queue_number} (${patient.patientName}) في الدور القادم مباشرة بعد الحالة الحالية.`)
    } catch (err) {
      console.error('Error requeueing patient:', err)
      toast.error('حدث خطأ أثناء إعادة إدخال المريض.')
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
      case 'no_show':
        return <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 font-bold px-3 py-1">{t('skipped', 'متخطي / لم يحضر')}</Badge>
      default:
        return <Badge variant="outline">{tDynamic(status)}</Badge>
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* Clinic Status Toggle & Active Branch Pill */}
      <div className={`yalla-card p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 transition-all duration-300 ${
        clinic?.isClinicOpen !== false
          ? 'bg-gradient-to-r from-emerald-500/10 via-card to-card dark:from-emerald-950/25 border-emerald-500/30'
          : 'bg-gradient-to-r from-rose-500/10 via-card to-card dark:from-rose-950/25 border-rose-500/30'
      }`}>
        <div className="flex items-center gap-3.5">
          <div className="relative flex items-center justify-center shrink-0">
            <span className={`w-3.5 h-3.5 rounded-full ${clinic?.isClinicOpen !== false ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
            {clinic?.isClinicOpen !== false && (
              <span className="absolute w-6 h-6 rounded-full bg-emerald-500/30 animate-ping pointer-events-none" />
            )}
          </div>
          <div className="text-start">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-black text-sm text-foreground">
                {clinic?.isClinicOpen !== false ? t('clinic_online', 'العيادة مفتوحة حالياً (أونلاين)') : t('clinic_offline', 'العيادة مغلقة حالياً (أوفلاين)')}
              </h3>
              {selectedBranchId && selectedBranchId !== 'all' && (
                <span className="text-[11px] font-bold px-2.5 py-0.5 rounded-lg bg-primary/10 text-primary border border-primary/20 flex items-center gap-1 shadow-2xs">
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
              const nextIsOpen = clinic?.isClinicOpen === false ? true : false
              await updateDoc(doc(db, 'clinics', clinic.id), {
                isClinicOpen: nextIsOpen,
                updatedAt: new Date().toISOString()
              })

              import('@/lib/patientNotificationHelper').then(({ triggerPatientEventPush }) => {
                triggerPatientEventPush({
                  type: nextIsOpen ? 'clinic_intake_resumed' : 'clinic_intake_paused',
                  clinicId: clinic.id,
                  clinicSlug: clinic?.slug,
                  clinicName: clinic?.clinicName || 'العيادة',
                  eventId: `push_intake_${clinic.id}_${Date.now()}`,
                }).catch(() => {})
              })
              toast.success(clinic?.isClinicOpen === false ? t('open_clinic', 'تم فتح العيادة وتفعيل الحجوزات') : t('close_clinic', 'تم إغلاق العيادة وإيقاف الحجوزات'))
            } catch (err) {
              toast.error('حدث خطأ')
            } finally {
              setIsProcessing(false)
            }
          }}
          variant={clinic?.isClinicOpen !== false ? 'destructive' : 'default'}
          className={`font-bold text-xs h-10 px-5 rounded-xl w-full sm:w-auto shadow-sm transition-transform active:scale-95 ${clinic?.isClinicOpen !== false ? '' : 'yalla-gradient-btn text-white'}`}
          disabled={isProcessing}
        >
          {clinic?.isClinicOpen !== false ? t('close_clinic', 'إغلاق العيادة (إيقاف الحجز)') : t('open_clinic', 'فتح العيادة (بدء الحجز)')}
        </Button>
      </div>

      {/* Date Filter & Dynamic Consultation Average Duration Bar */}
      <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between p-3.5 sm:p-4 bg-secondary/40 border border-border rounded-2xl gap-3 shadow-2xs">
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

        {/* Dynamic Daily Booking Capacity Indicator */}
        {effectiveMaxDailyBookings > 0 && (
          <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-xl border shadow-2xs self-start md:self-auto ${
            isCapacityFull
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300'
              : 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800 text-emerald-700 dark:text-emerald-300'
          }`}>
            <Users className="w-4 h-4 shrink-0" />
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-bold">الحجوزات اليوم:</span>
              <span className="text-xs font-black font-mono px-2 py-0.5 rounded-md bg-white/70 dark:bg-black/40 border border-current/20">
                {activeBookingsCount} / {effectiveMaxDailyBookings}
              </span>
              <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${
                isCapacityFull ? 'bg-rose-600 text-white' : 'bg-emerald-600 text-white'
              }`}>
                الحالة: {isCapacityFull ? 'مكتمل' : 'متاح'}
              </span>
            </div>
          </div>
        )}

        {/* Dynamic Average Consultation Duration Banner */}
        <div className="flex items-center gap-2.5 px-3.5 py-1.5 bg-card border border-border rounded-xl shadow-2xs self-start md:self-auto">
          <Clock className="w-4 h-4 text-primary shrink-0" />
          <div className="text-start">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-muted-foreground">{t('average_exam_time', 'متوسط وقت الكشف التقديري')}:</span>
              <span className="text-xs font-black text-primary font-mono bg-primary/10 px-2 py-0.5 rounded-md border border-primary/20">
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
      <div className={`grid grid-cols-2 ${isFinanceEnabled ? 'lg:grid-cols-4' : 'lg:grid-cols-3'} gap-4 sm:gap-5`}>
        {/* Card 1: Total Bookings */}
        <div className="yalla-card p-5 sm:p-6 flex items-center justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-primary" />
              <p className="text-xs font-bold text-muted-foreground">{t('today_bookings', 'إجمالي الحجوزات')}</p>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">{bookings.length}</h3>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                {t('registered_today', 'حجز مسجل اليوم')}
              </span>
            </div>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/25 flex items-center justify-center text-primary shadow-sm shadow-primary/15 group-hover:scale-110 transition-transform duration-300 shrink-0">
            <Calendar className="w-6 h-6" />
          </div>
        </div>

        {/* Card 2: Waiting */}
        <div className="yalla-card p-5 sm:p-6 flex items-center justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
              <p className="text-xs font-bold text-muted-foreground">{t('waiting_patients', 'في الانتظار')}</p>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-amber-500 tracking-tight">{waitingPatients.length}</h3>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                {t('waiting_to_enter', 'بانتظار الدخول')}
              </span>
            </div>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-amber-500/20 to-amber-500/5 border border-amber-500/25 flex items-center justify-center text-amber-500 shadow-sm shadow-amber-500/15 group-hover:scale-110 transition-transform duration-300 shrink-0">
            <Clock className="w-6 h-6" />
          </div>
        </div>

        {/* Card 3: Completed */}
        <div className="yalla-card p-5 sm:p-6 flex items-center justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
          <div className="relative z-10">
            <div className="flex items-center gap-1.5 mb-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
              <p className="text-xs font-bold text-muted-foreground">{t('completed_patients', 'تم الكشف')}</p>
            </div>
            <h3 className="text-3xl sm:text-4xl font-black text-emerald-600 dark:text-emerald-400 tracking-tight">{completedPatients.length}</h3>
            <div className="flex items-center gap-1.5 mt-2">
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                {t('completed_visits', 'زيارات مكتملة')}
              </span>
            </div>
          </div>
          <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shadow-sm shadow-emerald-500/15 group-hover:scale-110 transition-transform duration-300 shrink-0">
            <CheckCircle2 className="w-6 h-6" />
          </div>
        </div>

        {/* Card 4: Total Revenue (Only when finance is enabled) */}
        {isFinanceEnabled && (
          <div className="yalla-card p-5 sm:p-6 flex items-center justify-between relative overflow-hidden group hover:-translate-y-1 hover:shadow-xl transition-all duration-300">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl pointer-events-none group-hover:scale-150 transition-transform duration-500" />
            <div className="relative z-10">
              <div className="flex items-center gap-1.5 mb-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500" />
                <p className="text-xs font-bold text-muted-foreground">{t('total_revenue', 'إجمالي الإيرادات')}</p>
              </div>
              <h3 className="text-3xl sm:text-4xl font-black text-foreground tracking-tight">
                {totalRevenue.toLocaleString()} <span className="text-sm font-bold text-cyan-600 dark:text-cyan-400">{t('currency_egp', 'ج.م')}</span>
              </h3>
              <div className="flex items-center gap-1.5 mt-2">
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                  {t('collected_today', 'تحصيل اليوم')}
                </span>
              </div>
            </div>
            <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 border border-cyan-500/25 flex items-center justify-center text-cyan-600 dark:text-cyan-400 shadow-sm shadow-cyan-500/15 group-hover:scale-110 transition-transform duration-300 shrink-0">
              <DollarSign className="w-6 h-6" />
            </div>
          </div>
        )}
      </div>

      {/* =========================================================================
          2. MIDDLE BENTO GRID (Current Patient, Next in Queue, Quick Stats Donut)
         ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        
        {/* BENTO CARD 1: Current Patient (المريض الحالي) */}
        <div className={`ios-glass-card p-5 sm:p-6 space-y-4 relative overflow-hidden border-2 ${
          currentPatient
            ? 'border-primary/60 pulse-breathing-patient shadow-xl shadow-primary/10'
            : 'border-border/80'
        } flex flex-col justify-between`}>
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-primary"></span>
              </span>
              <h3 className="font-black text-sm text-foreground">{t('current_patient', 'المريض الحالي')}</h3>
            </div>
            <Badge className="bg-primary/15 text-primary border-primary/25 font-bold text-xs px-2.5 py-0.5">
              {currentPatient ? t('inside_now', 'بالداخل الآن') : t('available_room', 'شاغرة')}
            </Badge>
          </div>

          {currentPatient ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/25 to-primary/5 border-2 border-primary/40 text-primary flex items-center justify-center text-2xl font-black font-mono shadow-md shadow-primary/20 shrink-0">
                  #{currentPatient.queue_number}
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <Link
                    href={`/clinic/${clinic.slug}/admin/patients/${encodeURIComponent(currentPatient.patientId || currentPatient.phone || currentPatient.id)}`}
                    className="text-lg font-black text-foreground hover:text-primary hover:underline transition-colors block truncate"
                    title="فتح ملف المريض المتكامل"
                  >
                    {currentPatient.patientName}
                  </Link>
                  <p className="text-xs text-muted-foreground font-mono font-bold">{currentPatient.phone}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-secondary text-foreground border border-border">
                      {tDynamic(currentPatient.serviceName)}
                    </span>
                    {currentPatient.age && (
                      <span className="text-[11px] text-muted-foreground font-semibold">
                        {currentPatient.age} {t('years_old', 'سنة')}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {currentPatient.startedAt && (
                <div className="text-[11px] font-bold text-primary bg-primary/10 py-1.5 px-3 rounded-xl border border-primary/20 flex items-center justify-between">
                  <span>{t('exam_started_at', 'بدأ الكشف:')}</span>
                  <span className="font-mono">
                    {new Date(currentPatient.startedAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              )}

              {/* Actions Grid */}
              <div className="space-y-2 pt-1">
                <Button
                  className="yalla-gradient-btn w-full h-10 text-white font-black rounded-xl shadow-lg shadow-primary/30 text-xs active:scale-95 cursor-pointer"
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
                    className="w-full h-8.5 text-xs font-bold text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/10 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    onClick={() => handleRecallPatient(currentPatient)}
                    disabled={isProcessing}
                    title="إعادة نداء المريض بالصوت وتنبيه الهاتف"
                  >
                    <RotateCcw className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                    <span>{t('recall', 'إعادة النداء')}</span>
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full h-8.5 text-xs font-bold text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/10 rounded-xl transition-all flex items-center justify-center gap-1.5"
                    onClick={() => handleSkipPatient(currentPatient)}
                    disabled={isProcessing}
                    title="تخطي دور المريض وإدخال الدور التالي فوراً"
                  >
                    <SkipForward className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                    <span>{t('skip', 'تخطي')}</span>
                  </Button>
                </div>

                {isPrescriptionsEnabled && (
                  <Link href={`/clinic/${clinic.slug}/admin/prescriptions?appointmentId=${currentPatient.id}&patientName=${encodeURIComponent(currentPatient.patientName)}&patientPhone=${encodeURIComponent(currentPatient.phone)}&age=${encodeURIComponent(currentPatient.age || currentPatient.dob || '')}`}>
                    <Button
                      variant="outline"
                      className="w-full h-8.5 text-xs font-bold text-primary border-primary/25 hover:bg-primary/10 rounded-xl transition-all"
                    >
                      <FileSignature className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                      {t('issue_rx_now', 'إصدار روشتة للمريض الآن')}
                    </Button>
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="py-6 text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-secondary/80 border border-border flex items-center justify-center mx-auto text-muted-foreground shadow-2xs">
                <UserCheck className="w-7 h-7 text-muted-foreground/60" />
              </div>
              <div>
                <p className="text-xs font-bold text-foreground">{t('no_patient_inside', 'لا يوجد مريض داخل غرفة الكشف حالياً')}</p>
                <p className="text-[11px] text-muted-foreground mt-0.5">{t('ready_to_admit', 'الغرفة شاغرة وجاهزة لاستقبال الحالة التالية')}</p>
              </div>
              {nextPatient && (
                <Button
                  size="sm"
                  className="yalla-gradient-btn text-white font-black rounded-xl h-9 px-5 shadow-sm text-xs cursor-pointer active:scale-95"
                  onClick={() => handleStartExam(nextPatient)}
                  disabled={isProcessing}
                >
                  {t('admit_next_patient', 'إدخال المريض التالي')} #{nextPatient.queue_number}
                </Button>
              )}
            </div>
          )}
        </div>

        {/* BENTO CARD 2: Next in Queue (التالي في الدور) */}
        <div className="ios-glass-card p-5 sm:p-6 space-y-4 relative overflow-hidden border border-border/80 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-amber-500" />
              <h3 className="font-black text-sm text-foreground">{t('next_patient', 'التالي في الدور')}</h3>
            </div>
            <Badge className="bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/25 font-bold text-xs px-2.5 py-0.5">
              {t('waiting', 'في الانتظار')}
            </Badge>
          </div>

          {nextPatient ? (
            <div className="space-y-4">
              <div className="flex items-center gap-3.5">
                <div className="w-16 h-16 rounded-2xl bg-amber-500/15 border-2 border-amber-500/30 text-amber-600 dark:text-amber-400 flex items-center justify-center text-2xl font-black font-mono shrink-0 shadow-xs">
                  #{nextPatient.queue_number}
                </div>
                <div className="min-w-0 flex-1 text-start">
                  <Link
                    href={`/clinic/${clinic.slug}/admin/patients/${encodeURIComponent(nextPatient.patientId || nextPatient.phone || nextPatient.id)}`}
                    className="font-black text-base text-foreground hover:text-primary hover:underline transition-colors block truncate"
                    title="فتح ملف المريض المتكامل"
                  >
                    {nextPatient.patientName}
                  </Link>
                  <p className="text-xs text-muted-foreground font-mono font-bold">{nextPatient.phone}</p>
                  <span className="text-[11px] font-bold text-amber-600 dark:text-amber-400 inline-block mt-1">
                    {tDynamic(nextPatient.serviceName)}
                  </span>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button
                  className="w-full h-10 bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded-xl shadow-md shadow-emerald-600/25 text-xs transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-1.5"
                  onClick={() => handleStartExam(nextPatient)}
                  disabled={isProcessing}
                >
                  <Play className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                  {t('patient_entry', 'دخول المريض للكشف')}
                </Button>

                {isPatientAlertsEnabled && nextPatient.phone && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleManualWhatsApp(nextPatient)}
                    className="w-full h-8.5 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
                  >
                    <MessageCircle className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'} text-emerald-500`} />
                    {t('whatsapp_call_notice', 'استدعاء عبر واتساب')}
                  </Button>
                )}
              </div>
            </div>
          ) : (
            <div className="py-8 text-center space-y-2">
              <div className="w-12 h-12 rounded-2xl bg-secondary/80 border border-border flex items-center justify-center mx-auto text-muted-foreground">
                <CheckCircle2 className="w-6 h-6 text-emerald-500" />
              </div>
              <p className="text-xs font-bold text-foreground">{t('queue_empty', 'قائمة الانتظار فارغة')}</p>
              <p className="text-[11px] text-muted-foreground">{t('queue_cleared', 'تم الانتهاء من جميع الحالات المجدولة حالياً')}</p>
            </div>
          )}
        </div>

        {/* BENTO CARD 3: Quick Stats with SVG Donut Chart (إحصائيات سريعة) */}
        <div className="ios-glass-card p-5 sm:p-6 space-y-4 relative overflow-hidden border border-border/80 rounded-3xl flex flex-col justify-between">
          <div className="flex items-center justify-between pb-3 border-b border-border/80">
            <div className="flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-black text-sm text-foreground">{t('quick_stats', 'إحصائيات سريعة')}</h3>
            </div>
            <Badge className="bg-primary/10 text-primary border-primary/20 font-bold text-xs px-2.5 py-0.5">
              {t('live', 'مباشر')}
            </Badge>
          </div>

          {/* SVG Donut Component */}
          {(() => {
            const total = bookings.length || 1
            const completed = completedPatients.length
            const waiting = waitingPatients.length
            const inProgress = currentPatient ? 1 : 0
            const other = Math.max(0, bookings.length - completed - waiting - inProgress)
            const c = 238.76

            const completedDash = (completed / total) * c
            const waitingDash = (waiting / total) * c
            const inProgressDash = (inProgress / total) * c
            const otherDash = (other / total) * c

            const completedOffset = 0
            const waitingOffset = -completedDash
            const inProgressOffset = -(completedDash + waitingDash)
            const otherOffset = -(completedDash + waitingDash + inProgressDash)

            return (
              <div className="flex items-center justify-between gap-4">
                <div className="relative w-28 h-28 shrink-0 flex items-center justify-center">
                  <svg viewBox="0 0 100 100" className="w-full h-full -rotate-90 transform">
                    <circle cx="50" cy="50" r="38" className="stroke-secondary" strokeWidth="11" fill="none" />
                    {completed > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#10B981"
                        strokeWidth="11"
                        fill="none"
                        strokeDasharray={`${completedDash} ${c}`}
                        strokeDashoffset={completedOffset}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    )}
                    {waiting > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#F59E0B"
                        strokeWidth="11"
                        fill="none"
                        strokeDasharray={`${waitingDash} ${c}`}
                        strokeDashoffset={waitingOffset}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    )}
                    {inProgress > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#087CF4"
                        strokeWidth="11"
                        fill="none"
                        strokeDasharray={`${inProgressDash} ${c}`}
                        strokeDashoffset={inProgressOffset}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    )}
                    {other > 0 && (
                      <circle
                        cx="50"
                        cy="50"
                        r="38"
                        stroke="#EF4444"
                        strokeWidth="11"
                        fill="none"
                        strokeDasharray={`${otherDash} ${c}`}
                        strokeDashoffset={otherOffset}
                        strokeLinecap="round"
                        className="transition-all duration-700"
                      />
                    )}
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                    <span className="text-2xl font-black font-mono text-foreground leading-none">{bookings.length}</span>
                    <span className="text-[10px] font-bold text-muted-foreground mt-0.5">{t('total_bookings', 'إجمالي')}</span>
                  </div>
                </div>

                <div className="flex-1 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-foreground">
                      <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                      {t('completed_patients', 'تم الكشف')}
                    </span>
                    <span className="font-mono font-black text-emerald-600 dark:text-emerald-400">{completed}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-foreground">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 shrink-0" />
                      {t('waiting_patients', 'في الانتظار')}
                    </span>
                    <span className="font-mono font-black text-amber-500">{waiting}</span>
                  </div>
                  {inProgress > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="flex items-center gap-1.5 font-bold text-foreground">
                        <span className="w-2.5 h-2.5 rounded-full bg-primary shrink-0" />
                        {t('inside_now', 'بالداخل')}
                      </span>
                      <span className="font-mono font-black text-primary">{inProgress}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="flex items-center gap-1.5 font-bold text-foreground">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500 shrink-0" />
                      {t('cancelled_skipped', 'ملغي / متخطي')}
                    </span>
                    <span className="font-mono font-black text-rose-500">{other}</span>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>

      </div>

      {/* =========================================================================
          3. BOTTOM DATA TABLE: Full Width Glass Container with Pill Filter Tabs
         ========================================================================= */}
      <div className="ios-glass-card overflow-hidden border border-border/80 rounded-3xl shadow-sm space-y-0">
        
        {/* Table Top Header Strip with Search & Pill Tabs */}
        <div className="p-4 sm:p-5 border-b border-border/80 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4 bg-secondary/25 backdrop-blur-sm">
          
          {/* Search Box on start */}
          <div className="relative w-full lg:w-72">
            <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3' : 'left-3'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t('search_in_queue', 'بحث برقم الدور، الاسم أو الهاتف...')}
              className={`w-full h-10 ${isRtl ? 'pr-9 pl-3' : 'pl-9 pr-3'} rounded-2xl bg-background/80 border border-border/80 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all`}
            />
          </div>

          {/* Pill-shaped Filter Tabs in middle */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar p-1 rounded-2xl bg-background/60 border border-border/60">
            {[
              { id: 'all', label: t('all_cases', 'جميع الحالات'), count: bookings.length },
              { id: 'waiting', label: t('waiting_tab', 'في الانتظار'), count: waitingPatients.length },
              { id: 'completed', label: t('completed_tab', 'تم الكشف'), count: completedPatients.length },
              { id: 'skipped', label: t('skipped_tab', 'متخطي / لم يحضر'), count: skippedPatients.length },
              { id: 'cancelled', label: t('cancelled_tab', 'ملغي'), count: bookings.filter((b: any) => b.status === 'cancelled').length },
            ].map(tab => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setStatusTabFilter(tab.id as any)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer whitespace-nowrap ${
                  statusTabFilter === tab.id
                    ? 'bg-[#0066FF] text-white shadow-sm shadow-blue-500/30'
                    : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                }`}
              >
                <span>{tab.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                  statusTabFilter === tab.id ? 'bg-white/20 text-white' : 'bg-secondary text-muted-foreground'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>

          {/* Toolbar on end: Service Filter + Excel Export */}
          <div className="flex items-center gap-2 self-end lg:self-auto flex-wrap">
            {/* In-Clinic Booking Button */}
            <Link
              href={`/clinic/${clinic.slug}/admin/booking`}
              className="h-10 px-3.5 text-xs font-black bg-primary text-primary-foreground hover:bg-primary/90 rounded-2xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95 shrink-0"
              title="تسجيل حجز لمريض حضر للعيادة وإدراجه فوراً في طابور اليوم"
            >
              <UserPlus className="w-4 h-4" />
              <span>الحجز داخل العيادة 🎟️</span>
            </Link>

            {/* Shift Closing Reconciliation Button */}
            {isFinanceEnabled && (
              <Button
                size="sm"
                onClick={() => setIsShiftClosingOpen(true)}
                className="h-10 px-3.5 text-xs font-black bg-amber-500/15 hover:bg-amber-500/25 text-amber-700 dark:text-amber-300 border border-amber-500/35 rounded-2xl flex items-center gap-1.5 cursor-pointer shadow-xs transition-all active:scale-95"
                title="تقفيل خزينة اليوم وجرد الوردية للسكرتارية"
              >
                <DollarSign className="w-4 h-4 text-amber-600 dark:text-amber-400" />
                <span>تقفيل الخزينة والوردية 💰</span>
              </Button>
            )}

            {/* TV Screen View Link */}
            {isTvEnabled ? (
              <Link
                href={`/clinic/${clinic.slug}/tv`}
                target="_blank"
                className="h-10 px-3.5 text-xs font-black bg-primary/10 hover:bg-primary/20 text-primary border border-primary/30 rounded-2xl flex items-center gap-1.5 transition-all shadow-xs cursor-pointer active:scale-95"
                title="فتح شاشة صالة الانتظار للتلفزيون والشاشات الكبيرة"
              >
                <Tv className="w-4 h-4 text-primary" />
                <span>شاشة الانتظار (TV) 📺</span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={() => toast.info('خدمة شاشة التلفزيون غير مفعلة في باقة العيادة الحالية أو مغلقة من قبل الإدارة.')}
                className="h-10 px-3.5 text-xs font-bold bg-secondary text-muted-foreground border border-border rounded-2xl flex items-center gap-1.5 opacity-60 cursor-not-allowed"
                title="خدمة شاشة التلفزيون غير مفعلة لهذه العيادة"
              >
                <Tv className="w-4 h-4 text-muted-foreground" />
                <span>شاشة الانتظار 🔒</span>
              </button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={handleExportExcel}
              className="h-10 px-3 text-xs font-bold border-emerald-500/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-2xl flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <span>{t('export_excel', 'تصدير Excel')}</span>
            </Button>

            <div className="relative">
              <select
                value={serviceFilter}
                onChange={(e) => setServiceFilter(e.target.value)}
                className={`h-10 ${isRtl ? 'pr-8 pl-3' : 'pl-8 pr-3'} rounded-2xl bg-background/80 border border-border/80 text-xs font-bold text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary cursor-pointer appearance-none`}
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
                <div className="py-20 px-4 text-center space-y-4">
                  <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/15 to-primary/5 border border-primary/25 text-primary flex items-center justify-center mx-auto shadow-md shadow-primary/10">
                    <Calendar className="w-9 h-9 text-primary" />
                  </div>
                  <div className="space-y-1">
                    <h4 className="font-black text-lg text-foreground tracking-tight">{t('no_bookings_today', 'لا توجد حجوزات مسجلة اليوم')}</h4>
                    <p className="text-xs text-muted-foreground max-w-md mx-auto leading-relaxed">
                      {t('no_bookings_desc', 'يمكن للمرضى حجز المواعيد عبر رابط العيادة المباشر، أو يمكنك إضافة موعد يدوي.')}
                    </p>
                  </div>
                  <Link href={`/clinic/${clinic.slug}`} target="_blank">
                    <Button className="yalla-gradient-btn text-white h-10 px-6 font-black text-xs rounded-xl shadow-md cursor-pointer active:scale-95 transition-all mt-2">
                      <ExternalLink className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
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
                                <Link
                                  href={`/clinic/${clinic.slug}/admin/patients/${encodeURIComponent(b.patientId || b.phone || b.id)}`}
                                  className="font-bold text-sm text-foreground hover:text-primary hover:underline transition-colors block truncate"
                                  title="فتح ملف المريض المتكامل"
                                >
                                  {b.patientName}
                                </Link>
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
                            {/* Requeue Skipped Patient Button */}
                            {(b.status === 'skipped' || b.status === 'no_show') && (
                              <Button
                                size="sm"
                                className="flex-1 h-9 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs flex items-center justify-center gap-1.5"
                                onClick={() => handleRequeueSkippedPatient(b)}
                                disabled={isProcessing}
                                title="عند حضور المريض، اضغط هنا ليكون دوره هو القادم مباشرة بعد المريض الحالي"
                              >
                                <RotateCcw className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                <span>لم يحضر (إدخال الدور التالي)</span>
                              </Button>
                            )}

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
                              <div className="flex items-center gap-1.5 flex-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-9 px-2.5 text-xs font-bold text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/10 rounded-xl"
                                  onClick={() => handleRecallPatient(b)}
                                  disabled={isProcessing}
                                  title="إعادة نداء المريض"
                                >
                                  <RotateCcw className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
                                  <span>{t('recall', 'إعادة النداء')}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  className="flex-1 h-9 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs"
                                  onClick={() => handleCompleteExam(b.id, b.patientName)}
                                  disabled={isProcessing}
                                >
                                  <CheckCircle2 className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
                                  {t('end_exam', 'إنهاء الكشف')}
                                </Button>
                              </div>
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

                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-8 text-xs font-bold text-foreground border-border hover:bg-card rounded-lg justify-start"
                                  onClick={() => setSelectedTicketAppt(b)}
                                >
                                  <Ticket className={`w-3.5 h-3.5 ${isRtl ? 'ml-1.5' : 'mr-1.5'} text-blue-500`} />
                                  <span>تيكت الدور 🎫</span>
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
                                <Link
                                  href={`/clinic/${clinic.slug}/admin/patients/${encodeURIComponent(b.patientId || b.phone || b.id)}`}
                                  className="font-bold text-sm text-foreground hover:text-primary hover:underline transition-colors block truncate"
                                  title="فتح ملف المريض المتكامل"
                                >
                                  {b.patientName}
                                </Link>
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

                            {/* 80mm Turn Ticket Print */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2 text-blue-600 dark:text-blue-400 hover:text-blue-700 hover:bg-blue-500/10 border-blue-500/30 rounded-xl cursor-pointer"
                              onClick={() => handleDirectPrintTicket(b)}
                              title="طباعة تيكت الدور الحراري (80mm)"
                            >
                              <Ticket className="w-3.5 h-3.5" />
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

                            {/* Late Arrival Requeue Button */}
                            {(b.status === 'skipped' || b.status === 'no_show') && (
                              <Button
                                size="sm"
                                className="h-8 px-3 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white rounded-xl shadow-xs flex items-center gap-1.5 transition-all"
                                onClick={() => handleRequeueSkippedPatient(b)}
                                disabled={isProcessing}
                                title="عند حضور المريض، اضغط هنا ليكون دوره هو القادم مباشرة بعد المريض الحالي"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                                <span>لم يحضر (إدخال الدور التالي)</span>
                              </Button>
                            )}

                            {/* Priority Indicator */}
                            {b.status === 'waiting' && b.priorityNext && (
                              <span className="text-[11px] font-black px-2.5 py-1 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 text-white shadow-xs inline-flex items-center gap-1 animate-pulse">
                                <span>الدور القادم ⚡</span>
                              </span>
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

                            {/* Recall button if current */}
                            {b.status === 'in_progress' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="h-8 px-2 text-xs font-bold text-sky-600 dark:text-sky-400 border-sky-500/30 hover:bg-sky-500/10 rounded-xl"
                                onClick={() => handleRecallPatient(b)}
                                disabled={isProcessing}
                                title="إعادة نداء المريض"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
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

      {/* 80mm Turn Ticket Modal */}
      {selectedTicketAppt && (
        <ExaminationTicketModal
          isOpen={true}
          onClose={() => setSelectedTicketAppt(null)}
          appointment={selectedTicketAppt}
          clinic={clinic}
        />
      )}

      {/* Daily Shift Closing & Cash Reconciliation Modal */}
      {isShiftClosingOpen && (
        <ShiftClosingModal
          isOpen={true}
          onClose={() => setIsShiftClosingOpen(false)}
          clinic={clinic}
          appointments={branchFilteredAppointments.length > 0 ? branchFilteredAppointments : rawAppointments}
          selectedBranchId={selectedBranchId}
          branches={branches}
          selectedDate={selectedDashboardDate}
        />
      )}

    </div>
  )
}
