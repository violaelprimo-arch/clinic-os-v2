'use client'

import { useState, useEffect, useMemo, useRef } from 'react'
import {
  MessageSquare,
  Radio,
  Wifi,
  WifiOff,
  ShieldAlert,
  AlertTriangle,
  Play,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Clock,
  Search,
  Sliders,
  X,
  QrCode,
  RefreshCw,
  Unlink,
  Send,
  Eye,
  EyeOff,
  Sparkles,
  CheckCheck,
  Building2,
  Moon,
  Copy,
  History,
  FileText,
  CalendarCheck2,
  CalendarClock,
  CalendarX2,
  BellRing,
  Receipt,
  AlertOctagon,
  Trash2,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import {
  PRIMARY_WHATSAPP_SUB_FEATURES,
  DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
  WHATSAPP_SUB_FEATURE_LABELS,
  type PlatformWhatsAppDefaults,
  type WhatsAppSubFeatureKey,
  type WhatsAppSubFeatureMode,
  type WhatsAppEditPermission,
  type DocumentEditResendPolicy,
  type OwnerWhatsAppPolicyInput,
} from '@/lib/whatsapp-policy'
import {
  PRIMARY_TEMPLATE_KEYS,
  TEMPLATE_CATALOG,
  TEMPLATE_VARIABLE_DEFS,
  TEMPLATE_ALLOWED_TOKENS_PER_KEY,
  messageDefaults,
  renderClinicMessage,
  parseWhatsAppPreviewLine,
  validateTemplateText,
  type WhatsAppTemplateKey,
} from '@/lib/clinic-message-templates'

export interface ClinicPolicyItem {
  clinicId: string
  slug: string
  clinicName: string
  doctorName?: string
  phone?: string
  rawPolicy: OwnerWhatsAppPolicyInput | null
  effectivePolicy: PlatformWhatsAppDefaults
  sessionStatus: 'connected' | 'disconnected' | 'linking' | 'unknown' | string
  wpSender?: {
    configured: boolean
    mode: string
    senderNumber: string
    livePlatformEnabled: boolean
  }
  settings?: any
  templates?: Record<string, string>
  monthlyUsage?: number
}

const MESSAGE_ICONS: Record<string, any> = {
  booking_confirmation: CalendarCheck2,
  appointment_reminder: BellRing,
  appointment_rescheduled: CalendarClock,
  appointment_cancelled: CalendarX2,
  queue_alert: BellRing,
  prescription_ready: FileText,
  invoice_ready: Receipt,
  prescription: FileText,
  invoice: Receipt,
}

export function OwnerWhatsAppManager() {
  const [activeTab, setActiveTab] = useState<'overview' | 'clinics' | 'messages' | 'templates' | 'logs' | 'security'>('overview')
  const [loading, setLoading] = useState(true)

  // Platform governance state
  const [platformDefaults, setPlatformDefaults] = useState<PlatformWhatsAppDefaults>(DEFAULT_PLATFORM_WHATSAPP_DEFAULTS)
  const [clinics, setClinics] = useState<ClinicPolicyItem[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])

  // Template Studio state
  const [templates, setTemplates] = useState<Record<string, string>>(messageDefaults)
  const [activeTemplateKey, setActiveTemplateKey] = useState<WhatsAppTemplateKey>('booking_confirmation')
  const [customDrafts, setCustomDrafts] = useState<Record<string, string>>({})
  const [savingTemplates, setSavingTemplates] = useState(false)
  const editorRef = useRef<HTMLTextAreaElement | null>(null)

  const templateDraft = customDrafts[activeTemplateKey] ?? (templates[activeTemplateKey] || messageDefaults[activeTemplateKey] || '')
  const setTemplateDraft = (val: string | ((prev: string) => string)) => {
    setCustomDrafts((prev) => {
      const current = prev[activeTemplateKey] ?? (templates[activeTemplateKey] || messageDefaults[activeTemplateKey] || '')
      const next = typeof val === 'function' ? val(current) : val
      return { ...prev, [activeTemplateKey]: next }
    })
  }

  // Drawer (Side Panel) for individual clinic management
  const [drawerClinic, setDrawerClinic] = useState<ClinicPolicyItem | null>(null)
  const [drawerSubTab, setDrawerSubTab] = useState<'conn' | 'msgs' | 'reminders' | 'perms' | 'logs'>('conn')
  const [drawerPolicyDraft, setDrawerPolicyDraft] = useState<OwnerWhatsAppPolicyInput>({})
  const [drawerSettingsDraft, setDrawerSettingsDraft] = useState<any>({ reminders: [[24, 'hour'], [2, 'hour']] })
  const [savingDrawer, setSavingDrawer] = useState(false)
  const [qrCodeData, setQrCodeData] = useState<string | null>(null)
  const [loadingQr, setLoadingQr] = useState(false)

  // Queue Monitor & Logs state
  const [jobs, setJobs] = useState<any[]>([])
  const [queueStats, setQueueStats] = useState<Record<string, number>>({})
  const [logsLoading, setLogsLoading] = useState(false)
  const [logStatusFilter, setLogStatusFilter] = useState<string>('')
  const [logClinicFilter, setLogClinicFilter] = useState<string>('')
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  const [cancellingJobId, setCancellingJobId] = useState<string | null>(null)
  const [drainingQueue, setDrainingQueue] = useState(false)

  // Search & Filter for Clinics table
  const [clinicSearchQuery, setClinicSearchQuery] = useState('')
  const [clinicStatusFilter, setClinicStatusFilter] = useState<'all' | 'connected' | 'disconnected' | 'disabled'>('all')

  // Modals & Action Dialogs
  const [emergencyConfirmOpen, setEmergencyConfirmOpen] = useState(false)
  const [togglingEmergency, setTogglingEmergency] = useState(false)
  const [testPreviewOpen, setTestPreviewOpen] = useState(false)
  const [testPhone, setTestPhone] = useState('')
  const [sendingTest, setSendingTest] = useState(false)
  const [batchApplyConfirmOpen, setBatchApplyConfirmOpen] = useState(false)
  const [applyingBatch, setApplyingBatch] = useState(false)
  const [copySettingsOpen, setCopySettingsOpen] = useState(false)
  const [copySourceId, setCopySourceId] = useState('')
  const [copyTargetId, setCopyTargetId] = useState('')
  const [copyingSettings, setCopyingSettings] = useState(false)

  // 1. Fetch Platform Governance & Clinics Data
  const fetchData = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/owner/whatsapp/policy', {
        headers: { 'Cache-Control': 'no-store' },
        credentials: 'same-origin',
      })
      if (!res.ok) throw new Error('فشل تحميل سياسات واتساب من الخادم')
      const data = await res.json()
      if (data.platformDefaults) {
        setPlatformDefaults(data.platformDefaults)
      }
      if (data.templates) {
        setTemplates((prev) => ({ ...prev, ...data.templates }))
        setTemplateDraft(data.templates[activeTemplateKey] || messageDefaults[activeTemplateKey] || '')
      }
      if (Array.isArray(data.clinics)) {
        setClinics(data.clinics)
      }
      if (Array.isArray(data.auditLogs)) {
        setAuditLogs(data.auditLogs)
      }
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  // 2. Fetch Queue Logs
  const fetchLogs = async () => {
    try {
      setLogsLoading(true)
      const params = new URLSearchParams()
      if (logClinicFilter) params.set('clinicId', logClinicFilter)
      if (logStatusFilter) params.set('status', logStatusFilter)
      const res = await fetch(`/api/owner/whatsapp/logs?${params.toString()}`, {
        headers: { 'Cache-Control': 'no-store' },
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.stats) setQueueStats(data.stats)
      if (Array.isArray(data.jobs)) setJobs(data.jobs)
    } catch {
      toast.error('تعذر تحميل سجل الرسائل')
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchData()
  }, [])

  useEffect(() => {
    if (activeTab === 'logs' || activeTab === 'overview' || drawerSubTab === 'logs') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchLogs()
    }
  }, [activeTab, logClinicFilter, logStatusFilter, drawerSubTab])

  // Overview metrics derived calculations
  const overviewStats = useMemo(() => {
    const total = clinics.length
    const active = clinics.filter((c) => c.effectivePolicy?.serviceEnabled).length
    const connected = clinics.filter((c) => c.sessionStatus === 'connected').length
    const disconnected = clinics.filter((c) => c.sessionStatus === 'disconnected').length
    const sentToday = queueStats.sent || 0
    const deliveredToday = queueStats.delivered || 0
    const queuedToday = (queueStats.queued || 0) + (queueStats.waiting_for_connection || 0) + (queueStats.processing || 0)
    const failedToday = (queueStats.failed || 0) + (queueStats.uncertain || 0)
    const successRate = sentToday > 0 ? Math.round((deliveredToday / sentToday) * 100) : 100

    return {
      total,
      active,
      connected,
      disconnected,
      sentToday,
      deliveredToday,
      queuedToday,
      failedToday,
      successRate,
    }
  }, [clinics, queueStats])

  // Filtered clinics for Tab 2
  const filteredClinics = useMemo(() => {
    return clinics.filter((c) => {
      const q = clinicSearchQuery.trim().toLowerCase()
      const matchesSearch =
        !q ||
        c.clinicName.toLowerCase().includes(q) ||
        (c.doctorName && c.doctorName.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q)) ||
        (c.slug && c.slug.toLowerCase().includes(q))

      if (!matchesSearch) return false

      if (clinicStatusFilter === 'connected') return c.sessionStatus === 'connected'
      if (clinicStatusFilter === 'disconnected') return c.sessionStatus === 'disconnected'
      if (clinicStatusFilter === 'disabled') return !c.effectivePolicy?.serviceEnabled
      return true
    })
  }, [clinics, clinicSearchQuery, clinicStatusFilter])

  // Emergency Stop / Resume Handler
  const handleToggleEmergencyStop = async () => {
    const nextState = !platformDefaults.emergencyStop
    setTogglingEmergency(true)
    try {
      const res = await fetch('/api/owner/whatsapp/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: 'emergency_stop',
          emergencyStop: nextState,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'تعذر تعديل حالة الطوارئ')
      setPlatformDefaults((prev) => ({ ...prev, emergencyStop: nextState }))
      setEmergencyConfirmOpen(false)
      toast.success(nextState ? 'تم تفعيل إيقاف الطوارئ العام وإيقاف جميع الإرسال فورًا!' : 'تم استئناف إرسال واتساب للمنصة بنجاح.')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء تنفيذ الإجراء')
    } finally {
      setTogglingEmergency(false)
    }
  }

  // Open Drawer for Clinic Management
  const handleOpenDrawer = (clinic: ClinicPolicyItem) => {
    setDrawerClinic(clinic)
    setDrawerSubTab('conn')
    setDrawerPolicyDraft(clinic.rawPolicy ? structuredClone(clinic.rawPolicy) : {})
    setDrawerSettingsDraft(clinic.settings ? structuredClone(clinic.settings) : { reminders: [[24, 'hour'], [2, 'hour']] })
    setQrCodeData(null)
  }

  // Fetch QR Code for clinic in drawer
  const handleFetchQr = async (clinicId: string) => {
    setLoadingQr(true)
    try {
      const res = await fetch('/api/owner/whatsapp/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل توليد رمز QR')
      if (data.qrCode) {
        setQrCodeData(data.qrCode)
        toast.success('تم تحميل رمز QR لجلسة العيادة بنجاح')
      } else if (data.connected) {
        toast.success('الرقم متصل بالفعل بهذه الجلسة!')
      } else {
        toast.info('تم إنشاء الجلسة، بانتظار مسح الرمز من تطبيق واتساب.')
      }
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'تعذر جلب رمز QR')
    } finally {
      setLoadingQr(false)
    }
  }

  // Sync / Recheck Clinic Connection Health
  const handleCheckHealth = async (clinicId: string) => {
    try {
      const res = await fetch('/api/owner/whatsapp/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل فحص الاتصال')
      if (data.connected) {
        toast.success(`الجلسة متصلة بنجاح (${data.senderNumber || 'متصل'})`)
      } else {
        toast.warning('الجلسة غير متصلة حاليًا أو تتطلب إعادة الربط')
      }
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء فحص الاتصال')
    }
  }

  // Unlink Clinic Session
  const handleUnlinkClinic = async (clinicId: string) => {
    if (!confirm('هل أنت متأكد من رغبتك في فصل رقم واتساب لهذه العيادة وإلغاء الجلسة؟')) return
    try {
      const res = await fetch('/api/owner/whatsapp/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ clinicId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل فصل الرقم')
      toast.success('تم فصل رقم العيادة وإلغاء الجلسة بنجاح')
      setQrCodeData(null)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء فصل الرقم')
    }
  }

  // Save Clinic Draft Settings from Drawer
  const handleSaveDrawerPolicy = async () => {
    if (!drawerClinic) return
    setSavingDrawer(true)
    try {
      const res = await fetch('/api/owner/whatsapp/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: 'clinic',
          clinicId: drawerClinic.clinicId,
          policy: drawerPolicyDraft,
          settings: drawerSettingsDraft,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'تعذر حفظ إعدادات العيادة')
      toast.success(`تم حفظ إعدادات واتساب لعيادة «${drawerClinic.clinicName}» بنجاح`)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء الحفظ')
    } finally {
      setSavingDrawer(false)
    }
  }

  // Save Platform Governance Matrix (Tab 3)
  const handleSavePlatformDefaults = async () => {
    try {
      const res = await fetch('/api/owner/whatsapp/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: 'platform',
          platformDefaults,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'تعذر حفظ سياسة المنصة')
      toast.success('تم حفظ السياسة الافتراضية لمنصة Yalla Clinic بنجاح')
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء حفظ السياسة')
    }
  }

  // Save Platform Template Studio (Tab 4)
  const handleSaveTemplates = async () => {
    setSavingTemplates(true)
    try {
      const nextTemplates = {
        ...templates,
        [activeTemplateKey]: templateDraft,
      }
      const res = await fetch('/api/owner/whatsapp/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: 'templates',
          templates: nextTemplates,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'تعذر حفظ القوالب')
      setTemplates(nextTemplates)
      toast.success('تم حفظ قوالب رسائل المنصة الافتراضية بنجاح')
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء الحفظ')
    } finally {
      setSavingTemplates(false)
    }
  }

  // Insert Variable Token into Template Textarea at cursor
  const handleInsertToken = (token: string) => {
    const el = editorRef.current
    if (!el) {
      setTemplateDraft((prev) => prev + ' ' + token)
      return
    }
    const start = el.selectionStart || 0
    const end = el.selectionEnd || 0
    const before = templateDraft.slice(0, start)
    const after = templateDraft.slice(end)
    const next = before + token + after
    setTemplateDraft(next)
    setTimeout(() => {
      el.focus()
      el.setSelectionRange(start + token.length, start + token.length)
    }, 0)
  }

  // Send Test Preview Message (Tab 4)
  const handleSendTestPreview = async () => {
    if (!testPhone.trim()) {
      toast.error('يرجى إدخال رقم هاتف لاستلام رسالة المعاينة')
      return
    }
    setSendingTest(true)
    try {
      const renderedPreview = renderClinicMessage(templateDraft, {
        patientName: 'أحمد محمود',
        clinicName: 'عيادة النور التخصصية',
        doctorName: 'د. كريم عبد الله',
        branchName: 'فرع مدينة نصر',
        date: 'الأحد 3 مايو 2026',
        time: '07:30 م',
        queueNumber: 'A-14',
        link: 'https://yalla-clinic.com/track/preview-test',
        documentUrl: 'https://yalla-clinic.com/track/preview-test',
      })
      const res = await fetch('/api/owner/whatsapp/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'test_preview',
          phone: testPhone,
          message: renderedPreview,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل إرسال رسالة المعاينة')
      toast.success(`تم إرسال رسالة المعاينة بنجاح إلى ${testPhone}`)
      setTestPreviewOpen(false)
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إرسال المعاينة')
    } finally {
      setSendingTest(false)
    }
  }

  // Batch Apply Platform Defaults to Clinics (Tab 6)
  const handleBatchApply = async () => {
    setApplyingBatch(true)
    try {
      const res = await fetch('/api/owner/whatsapp/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: 'batch_apply',
          platformDefaults,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل التطبيق الجماعي')
      toast.success(`تم تطبيق السياسة الافتراضية بنجاح على ${data.updatedCount || 'جميع'} عيادة`)
      setBatchApplyConfirmOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء التطبيق')
    } finally {
      setApplyingBatch(false)
    }
  }

  // Copy Settings from Clinic A to B (Tab 6)
  const handleCopySettings = async () => {
    if (!copySourceId || !copyTargetId) {
      toast.error('يرجى تحديد العيادة المصدر والعيادة الهدف')
      return
    }
    if (copySourceId === copyTargetId) {
      toast.error('لا يمكن نسخ الإعدادات لنفس العيادة')
      return
    }
    setCopyingSettings(true)
    try {
      const res = await fetch('/api/owner/whatsapp/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          scope: 'copy_settings',
          sourceClinicId: copySourceId,
          targetClinicId: copyTargetId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل نسخ الإعدادات')
      toast.success('تم نسخ إعدادات وقوالب الرسائل إلى العيادة الهدف بنجاح دون المساس بالجلسة')
      setCopySettingsOpen(false)
      fetchData()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء النسخ')
    } finally {
      setCopyingSettings(false)
    }
  }

  // Retry Stuck or Failed Job (Tab 5)
  const handleRetryJob = async (jobId: string) => {
    setRetryingJobId(jobId)
    try {
      const res = await fetch('/api/owner/whatsapp/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'retry_job', jobId, allowUncertainRetry: true }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشلت إعادة محاولة الإرسال')
      toast.success('تمت إعادة إرسال الرسالة بنجاح')
      fetchLogs()
    } catch (err: any) {
      toast.error(err.message || 'تعذر إعادة الإرسال')
    } finally {
      setRetryingJobId(null)
    }
  }

  // Cancel Job (Tab 5)
  const handleCancelJob = async (jobId: string) => {
    if (!confirm('هل أنت متأكد من إلغاء هذه الرسالة المعلقة؟')) return
    setCancellingJobId(jobId)
    try {
      const res = await fetch('/api/owner/whatsapp/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'cancel_job', jobId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل إلغاء الرسالة')
      toast.success('تم إلغاء الرسالة المعلقة بنجاح')
      fetchLogs()
    } catch (err: any) {
      toast.error(err.message || 'تعذر إلغاء الرسالة')
    } finally {
      setCancellingJobId(null)
    }
  }

  // Drain Queue Now (Tab 5)
  const handleDrainQueue = async () => {
    setDrainingQueue(true)
    try {
      const res = await fetch('/api/owner/whatsapp/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'drain_due' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل تفريغ الطابور')
      toast.success(`تم فحص ومعالجة الرسائل المستحقة (تمت معالجة: ${data.result?.processed || 0})`)
      fetchLogs()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء المعالجة')
    } finally {
      setDrainingQueue(false)
    }
  }

  // Live WhatsApp Mockup Render Text
  const renderedMockupLines = useMemo(() => {
    const rendered = renderClinicMessage(templateDraft, {
      patientName: 'أحمد محمود',
      clinicName: 'عيادة النور التخصصية',
      doctorName: 'د. كريم عبد الله',
      branchName: 'فرع مدينة نصر',
      date: 'الأحد 3 مايو 2026',
      time: '07:30 م',
      queueNumber: 'A-14',
      link: 'https://yalla-clinic.com/track/rx-sample',
      documentUrl: 'https://yalla-clinic.com/track/rx-sample',
    })
    return rendered.split('\n')
  }, [templateDraft])

  return (
    <div className="space-y-6 text-right" dir="rtl">
      {/* 0. Top Header & Emergency Kill Switch Warning Banner */}
      {platformDefaults.emergencyStop ? (
        <div className="rounded-2xl border-2 border-rose-500 bg-rose-50 p-6 shadow-sm dark:bg-rose-950/40">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-rose-600 text-white">
                <AlertOctagon className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-rose-900 dark:text-rose-200">
                  خدمة واتساب موقوفة كليًا بواسطة زر إيقاف الطوارئ (Emergency Stop)
                </h2>
                <p className="text-sm text-rose-700 dark:text-rose-300">
                  جميع عمليات الإرسال التلقائي واليدوي متوقفة حاليًا عبر كامل المنصة لحماية الحسابات.
                </p>
              </div>
            </div>
            <Button
              onClick={() => setEmergencyConfirmOpen(true)}
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            >
              <Play className="ml-2 h-4 w-4" />
              استئناف خدمة واتساب للمنصة
            </Button>
          </div>
        </div>
      ) : null}

      {/* Main Title & Nav Tabs */}
      <div className="flex flex-col gap-4 border-b pb-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <MessageSquare className="h-7 w-7 text-emerald-600" />
            إدارة واتساب المركزية — منصة Yalla Clinic
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400">
            تحكم كامل في ربط الأرقام، السياسات، القوالب، التذكيرات، وسجل الرسائل لجميع العيادات عبر WP Sender.
          </p>
        </div>

        {/* Global Emergency Stop Toggle Button */}
        {!platformDefaults.emergencyStop && (
          <Button
            variant="destructive"
            onClick={() => setEmergencyConfirmOpen(true)}
            className="font-semibold shadow-sm"
          >
            <ShieldAlert className="ml-2 h-4 w-4" />
            إيقاف طوارئ عام (Kill Switch)
          </Button>
        )}
      </div>

      {/* Top 6 Navigation Tabs */}
      <div className="flex flex-wrap items-center gap-2 rounded-xl bg-slate-100 p-1.5 dark:bg-slate-900">
        {[
          { id: 'overview', label: 'نظرة عامة', icon: Radio },
          { id: 'clinics', label: 'واتساب العيادات', icon: Building2 },
          { id: 'messages', label: 'الرسائل والتذكيرات', icon: Sliders },
          { id: 'templates', label: 'قوالب الرسائل (Studio)', icon: Sparkles },
          { id: 'logs', label: 'سجل الرسائل والطابور', icon: Clock },
          { id: 'security', label: 'الأمان والتحكم الجماعي', icon: ShieldAlert },
        ].map((tab) => {
          const Icon = tab.icon
          const isActive = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-all ${
                isActive
                  ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-800 dark:text-emerald-400'
                  : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white'
              }`}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* ========================================================================= */}
      {/* TAB 1: نظرة عامة (Overview)                                              */}
      {/* ========================================================================= */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* Real-time Alert Banners */}
          {overviewStats.disconnected > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="font-semibold text-sm">
                  يوجد {overviewStats.disconnected} عيادة جلستها غير متصلة أو بحاجة لمسح رمز QR لإعادة الربط.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('clinics')}
                className="border-amber-300 bg-white text-amber-900 hover:bg-amber-100 dark:bg-slate-900 dark:text-amber-200"
              >
                مراجعة العيادات المنقطعة
              </Button>
            </div>
          )}

          {overviewStats.failedToday > 0 && (
            <div className="flex items-center justify-between rounded-xl border border-rose-200 bg-rose-50 p-4 text-rose-900 dark:border-rose-900/50 dark:bg-rose-950/30 dark:text-rose-200">
              <div className="flex items-center gap-3">
                <XCircle className="h-5 w-5 text-rose-600" />
                <span className="font-semibold text-sm">
                  يوجد {overviewStats.failedToday} رسالة فاشلة أو غير مؤكدة بحاجة لفحص سبب الفشل وإعادة المحاولة.
                </span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setActiveTab('logs')}
                className="border-rose-300 bg-white text-rose-900 hover:bg-rose-100 dark:bg-slate-900 dark:text-rose-200"
              >
                فتح سجل الرسائل
              </Button>
            </div>
          )}

          {/* KPI Metrics Cards Grid */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">العيادات المفعلة</span>
                <Building2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{overviewStats.active}</span>
                <span className="text-xs text-slate-400">من إجمالي {overviewStats.total}</span>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">الجلسات المتصلة</span>
                <Wifi className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-emerald-600">{overviewStats.connected}</span>
                <span className="text-xs text-slate-400">جلسة متصلة</span>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">الجلسات غير المتصلة</span>
                <WifiOff className="h-5 w-5 text-rose-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-600">{overviewStats.disconnected}</span>
                <span className="text-xs text-slate-400">تتطلب فحص QR</span>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">رسائل اليوم المقبولة</span>
                <MessageSquare className="h-5 w-5 text-blue-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-blue-600">{overviewStats.sentToday}</span>
                <span className="text-xs text-slate-400">رسالة مقبولة</span>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">المعلقة في الطابور</span>
                <Clock className="h-5 w-5 text-amber-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-amber-600">{overviewStats.queuedToday}</span>
                <span className="text-xs text-slate-400">بانتظار وقتها/الاتصال</span>
              </div>
            </div>

            <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">الرسائل الفاشلة</span>
                <XCircle className="h-5 w-5 text-rose-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-2">
                <span className="text-2xl font-bold text-rose-600">{overviewStats.failedToday}</span>
                <span className="text-xs text-slate-400">تحتاج مراجعة</span>
              </div>
            </div>

            <div className="col-span-2 rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">نسبة النجاح المؤكدة الحقيقية</span>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="mt-3 flex items-baseline gap-3">
                <span className="text-3xl font-extrabold text-emerald-600">{overviewStats.successRate}%</span>
                <span className="text-xs text-slate-500">
                  (بناءً على تأكيد التسليم الفعلي Delivered مقابل المقبول من المزود Sent)
                </span>
              </div>
            </div>
          </div>

          {/* Quick Actions Card */}
          <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900">
            <h3 className="text-base font-bold text-slate-900 dark:text-white mb-4">إجراءات سريعة لمالك المنصة</h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <Button
                variant="outline"
                onClick={() => setActiveTab('clinics')}
                className="justify-start gap-2 h-auto py-3 text-right"
              >
                <Building2 className="h-5 w-5 text-emerald-600" />
                <div>
                  <div className="font-semibold text-sm">إدارة واتساب العيادات</div>
                  <div className="text-xs text-slate-500">ربط وفصل الأرقام ومسح QR Code</div>
                </div>
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab('messages')}
                className="justify-start gap-2 h-auto py-3 text-right"
              >
                <Sliders className="h-5 w-5 text-blue-600" />
                <div>
                  <div className="font-semibold text-sm">حوكمة الرسائل والتذكيرات</div>
                  <div className="text-xs text-slate-500">تحديد التلقائي/اليدوي وصلاحيات التعديل</div>
                </div>
              </Button>
              <Button
                variant="outline"
                onClick={() => setActiveTab('templates')}
                className="justify-start gap-2 h-auto py-3 text-right"
              >
                <Sparkles className="h-5 w-5 text-purple-600" />
                <div>
                  <div className="font-semibold text-sm">محرر قوالب الرسائل (Studio)</div>
                  <div className="text-xs text-slate-500">تعديل القوالب وتجربة المعاينة الحية</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 2: واتساب العيادات (Clinic Accounts)                                 */}
      {/* ========================================================================= */}
      {activeTab === 'clinics' && (
        <div className="space-y-4">
          {/* Search & Status Filters */}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="بحث باسم العيادة، الدكتور، رقم الهاتف، أو Session ID..."
                value={clinicSearchQuery}
                onChange={(e) => setClinicSearchQuery(e.target.value)}
                className="pr-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <Label className="text-xs text-slate-500 shrink-0">تصفية:</Label>
              <select
                value={clinicStatusFilter}
                onChange={(e) => setClinicStatusFilter(e.target.value as any)}
                className="rounded-lg border bg-white px-3 py-2 text-sm shadow-sm dark:bg-slate-900"
              >
                <option value="all">جميع الحالات</option>
                <option value="connected">الجلسات المتصلة فقط</option>
                <option value="disconnected">الجلسات المنقطعة</option>
                <option value="disabled">الخدمة معطلة</option>
              </select>
            </div>
          </div>

          {/* Clinics Table */}
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-3 px-4 text-right font-semibold">العيادة والطبيب</th>
                  <th className="py-3 px-4 text-right font-semibold">رقم الهاتف</th>
                  <th className="py-3 px-4 text-right font-semibold">Session ID</th>
                  <th className="py-3 px-4 text-right font-semibold">حالة الاتصال</th>
                  <th className="py-3 px-4 text-right font-semibold">حالة الخدمة</th>
                  <th className="py-3 px-4 text-right font-semibold">الرسائل</th>
                  <th className="py-3 px-4 text-center font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {filteredClinics.map((clinic) => {
                  const isConnected = clinic.sessionStatus === 'connected'
                  const isServiceEnabled = clinic.effectivePolicy?.serviceEnabled
                  return (
                    <tr key={clinic.clinicId} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{clinic.clinicName}</div>
                        <div className="text-xs text-slate-500">{clinic.doctorName || clinic.slug}</div>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs">
                        {clinic.wpSender?.senderNumber || clinic.phone || '—'}
                      </td>
                      <td className="py-3 px-4">
                        <code className="rounded bg-slate-100 px-2 py-0.5 font-mono text-xs text-slate-700 dark:bg-slate-800 dark:text-slate-300">
                          {clinic.wpSender?.senderNumber ? `session_${clinic.clinicId.slice(0, 8)}` : clinic.clinicId.slice(0, 10)}
                        </code>
                      </td>
                      <td className="py-3 px-4">
                        {isConnected ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 gap-1">
                            <Wifi className="h-3 w-3" /> متصل
                          </Badge>
                        ) : clinic.sessionStatus === 'linking' ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 gap-1">
                            <QrCode className="h-3 w-3" /> جارٍ الربط
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <WifiOff className="h-3 w-3" /> غير متصل
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4">
                        {isServiceEnabled ? (
                          <Badge variant="outline" className="border-emerald-500 text-emerald-600 font-medium">
                            مفعلة
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="border-slate-300 text-slate-400">
                            معطلة
                          </Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 font-bold text-xs">
                        {clinic.monthlyUsage || 0}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenDrawer(clinic)}
                          className="gap-1.5 font-semibold text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 dark:text-emerald-400"
                        >
                          <Sliders className="h-3.5 w-3.5" />
                          إدارة العيادة
                        </Button>
                      </td>
                    </tr>
                  )
                })}
                {filteredClinics.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد عيادات مطابقة للبحث أو التصفية الحالية.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 3: الرسائل والتذكيرات (Messages & Reminders Governance)                */}
      {/* ========================================================================= */}
      {activeTab === 'messages' && (
        <div className="space-y-6">
          {/* Informative Guidance Banner */}
          <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-900 dark:border-blue-900 dark:bg-blue-950/40 dark:text-blue-200">
            <h4 className="font-bold text-sm flex items-center gap-2 mb-1">
              <Sliders className="h-4 w-4 text-blue-600" />
              محددات الحوكمة للمنصة:
            </h4>
            <p className="text-xs leading-relaxed">
              • إخفاء الميزة عن الدكتور لا يعني بالضرورة إيقاف الإرسال التلقائي: يمكنك تشغيل الإرسال التلقائي دون إظهار الإعدادات في لوحة العيادة.
              <br />
              • العيادات الجديدة: يتم افتراضيًا إخفاء وتعطيل كافة إعدادات واتساب حتى يقرر مالك المنصة تفعيلها.
              <br />
              • «قراءة فقط»: تظهر نصوص الرسائل للدكتور مع شارة محددة من الإدارة دون تمكينه من تعديل النص.
            </p>
          </div>

          {/* Master Platform Toggles */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900">
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold text-sm">إظهار قسم واتساب في لوحة الأطباء افتراضيًا</Label>
                <p className="text-xs text-slate-500">تمكين العيادات من رؤية تبويب رسائل واتساب</p>
              </div>
              <Switch
                checked={platformDefaults.sectionVisible}
                onCheckedChange={(val) => setPlatformDefaults((prev) => ({ ...prev, sectionVisible: val }))}
              />
            </div>
            <div className="flex items-center justify-between">
              <div>
                <Label className="font-bold text-sm">تفعيل خدمة واتساب للمنصة افتراضيًا</Label>
                <p className="text-xs text-slate-500">تشغيل معالجة وإرسال الرسائل عبر WP Sender</p>
              </div>
              <Switch
                checked={platformDefaults.serviceEnabled}
                onCheckedChange={(val) => setPlatformDefaults((prev) => ({ ...prev, serviceEnabled: val }))}
              />
            </div>
          </div>

          {/* 7 Message Types Governance Matrix Table */}
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-3 px-4 text-right font-semibold">نوع الرسالة</th>
                  <th className="py-3 px-4 text-right font-semibold">الظهور في لوحة العيادة</th>
                  <th className="py-3 px-4 text-right font-semibold">طريقة الإرسال (Execution Mode)</th>
                  <th className="py-3 px-4 text-right font-semibold">صلاحية التعديل للطبيب</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {PRIMARY_WHATSAPP_SUB_FEATURES.map((featureKey) => {
                  const label = WHATSAPP_SUB_FEATURE_LABELS[featureKey]
                  const feat = platformDefaults.features[featureKey] || {
                    visible: true,
                    enabled: true,
                    mode: 'auto',
                    editPermission: 'read_only',
                  }
                  const Icon = MESSAGE_ICONS[featureKey] || MessageSquare

                  return (
                    <tr key={featureKey} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 dark:bg-emerald-950/60 dark:text-emerald-400">
                            <Icon className="h-4 w-4" />
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white">{label.titleAr}</div>
                            <div className="text-xs text-slate-500">{label.descAr}</div>
                          </div>
                        </div>
                      </td>

                      {/* 1. Visibility Toggle */}
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={feat.visible}
                            onCheckedChange={(val) => {
                              setPlatformDefaults((prev) => ({
                                ...prev,
                                features: {
                                  ...prev.features,
                                  [featureKey]: { ...feat, visible: val },
                                },
                              }))
                            }}
                          />
                          <span className="text-xs font-medium text-slate-600 dark:text-slate-400">
                            {feat.visible ? (
                              <span className="flex items-center gap-1 text-emerald-600"><Eye className="h-3.5 w-3.5" /> ظاهر</span>
                            ) : (
                              <span className="flex items-center gap-1 text-slate-400"><EyeOff className="h-3.5 w-3.5" /> مخفي</span>
                            )}
                          </span>
                        </div>
                      </td>

                      {/* 2. Mode Selector: auto / manual / disabled */}
                      <td className="py-4 px-4">
                        <select
                          value={feat.mode}
                          onChange={(e) => {
                            const newMode = e.target.value as WhatsAppSubFeatureMode
                            setPlatformDefaults((prev) => ({
                              ...prev,
                              features: {
                                ...prev.features,
                                [featureKey]: {
                                  ...feat,
                                  mode: newMode,
                                  enabled: newMode !== 'disabled',
                                },
                              },
                            }))
                          }}
                          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold shadow-sm ${
                            feat.mode === 'auto'
                              ? 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300'
                              : feat.mode === 'manual'
                              ? 'border-blue-300 bg-blue-50 text-blue-800 dark:bg-blue-950 dark:text-blue-300'
                              : 'border-slate-300 bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400'
                          }`}
                        >
                          <option value="auto">تلقائي فور الحفظ (Auto)</option>
                          <option value="manual">يدوي بنقرة زر فقط (Manual)</option>
                          <option value="disabled">معطل نهائيًا (Disabled)</option>
                        </select>
                      </td>

                      {/* 3. Edit Permission: read_only / editable */}
                      <td className="py-4 px-4">
                        <select
                          value={feat.editPermission || 'read_only'}
                          onChange={(e) => {
                            const newPerm = e.target.value as WhatsAppEditPermission
                            setPlatformDefaults((prev) => ({
                              ...prev,
                              features: {
                                ...prev.features,
                                [featureKey]: { ...feat, editPermission: newPerm },
                              },
                            }))
                          }}
                          className="rounded-lg border bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-900"
                        >
                          <option value="read_only">🔒 قراءة فقط (محدد بواسطة المنصة)</option>
                          <option value="editable">✏️ قابل للتعديل بواسطة الدكتور</option>
                        </select>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <Button
              onClick={handleSavePlatformDefaults}
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            >
              <CheckCircle2 className="ml-2 h-4 w-4" />
              حفظ السياسة الافتراضية للمنصة
            </Button>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 4: قوالب الرسائل (Message Templates Studio)                            */}
      {/* ========================================================================= */}
      {activeTab === 'templates' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
            {/* Right List: Select Message Type */}
            <div className="lg:col-span-4 space-y-2">
              <Label className="text-xs font-bold text-slate-500">اختر نوع الرسالة لتحرير القالب:</Label>
              <div className="space-y-1.5 rounded-xl border bg-white p-2 shadow-sm dark:bg-slate-900">
                {PRIMARY_TEMPLATE_KEYS.map((key) => {
                  const cat = TEMPLATE_CATALOG[key]
                  const isCurrent = activeTemplateKey === key
                  const Icon = MESSAGE_ICONS[key] || MessageSquare
                  return (
                    <button
                      key={key}
                      onClick={() => setActiveTemplateKey(key)}
                      className={`flex w-full items-center gap-3 rounded-lg p-3 text-right transition-all ${
                        isCurrent
                          ? 'bg-emerald-50 text-emerald-800 font-bold dark:bg-emerald-950/70 dark:text-emerald-300'
                          : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800'
                      }`}
                    >
                      <Icon className="h-4 w-4 shrink-0 text-emerald-600" />
                      <div className="flex-1">
                        <div className="text-sm">{cat?.titleAr || key}</div>
                        <div className="text-xs text-slate-400 font-normal">{cat?.categoryAr}</div>
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Middle: Template Editor & Allowed Variable Pills */}
            <div className="lg:col-span-8 space-y-4">
              <div className="rounded-xl border bg-white p-5 shadow-sm dark:bg-slate-900 space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                      قالب: {TEMPLATE_CATALOG[activeTemplateKey]?.titleAr || activeTemplateKey}
                    </h3>
                    <p className="text-xs text-slate-500">
                      {TEMPLATE_CATALOG[activeTemplateKey]?.subtitleAr}
                    </p>
                  </div>
                  <span className="text-xs text-slate-400">
                    {templateDraft.length} / 1000 حرف
                  </span>
                </div>

                {/* Variable Pills Toolbar (Only supported variables for this message type!) */}
                <div>
                  <Label className="text-xs font-bold text-slate-500 mb-1.5 block">
                    المتغيرات المدعومة لهذا النوع (انقر للإدراج عند المؤشر):
                  </Label>
                  <div className="flex flex-wrap gap-1.5">
                    {(TEMPLATE_ALLOWED_TOKENS_PER_KEY[activeTemplateKey] || []).map((token) => (
                      <button
                        key={token}
                        type="button"
                        onClick={() => handleInsertToken(token)}
                        className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-semibold text-emerald-800 transition hover:bg-emerald-100 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
                      >
                        + {token}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Editor Textarea */}
                <div>
                  <textarea
                    ref={editorRef}
                    rows={6}
                    value={templateDraft}
                    onChange={(e) => setTemplateDraft(e.target.value)}
                    dir="rtl"
                    className="w-full rounded-xl border border-slate-300 p-3.5 font-sans text-sm leading-relaxed text-slate-900 shadow-sm focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTemplateDraft(messageDefaults[activeTemplateKey] || '')}
                    className="text-xs text-slate-600"
                  >
                    <RotateCcw className="ml-1.5 h-3.5 w-3.5" />
                    استعادة القالب الأصلي
                  </Button>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setTestPreviewOpen(true)}
                      className="text-xs text-emerald-700 border-emerald-200 hover:bg-emerald-50"
                    >
                      <Send className="ml-1.5 h-3.5 w-3.5" />
                      تجربة إرسال معاينة
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleSaveTemplates}
                      disabled={savingTemplates}
                      className="bg-emerald-600 text-xs font-bold text-white hover:bg-emerald-700"
                    >
                      <CheckCircle2 className="ml-1.5 h-3.5 w-3.5" />
                      حفظ كقالب افتراضي
                    </Button>
                  </div>
                </div>
              </div>

              {/* WhatsApp Live Mockup Chat Preview */}
              <div className="rounded-xl border bg-slate-100 p-5 shadow-sm dark:bg-slate-950">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-bold text-slate-500">معاينة حية لشكل الرسالة في واتساب:</span>
                  <Badge variant="outline" className="border-emerald-600 text-emerald-700 text-[10px]">
                    معاينة تلقائية
                  </Badge>
                </div>
                <div className="mx-auto max-w-sm rounded-2xl bg-[#efeae2] p-4 shadow-md dark:bg-slate-900 border border-slate-300 dark:border-slate-800">
                  <div className="rounded-xl bg-white p-3.5 text-slate-900 shadow-sm dark:bg-[#005c4b] dark:text-white text-xs leading-relaxed space-y-1">
                    {renderedMockupLines.map((line, idx) => {
                      const segments = parseWhatsAppPreviewLine(line)
                      return (
                        <p key={idx} className="min-h-[14px]">
                          {segments.map((seg, sIdx) => {
                            if (seg.type === 'bold') {
                              return <strong key={sIdx} className="font-bold">{seg.value}</strong>
                            }
                            if (seg.type === 'link') {
                              return (
                                <span key={sIdx} className="text-blue-600 underline font-mono text-[11px] break-all dark:text-blue-200">
                                  {seg.value}
                                </span>
                              )
                            }
                            return <span key={sIdx}>{seg.value}</span>
                          })}
                        </p>
                      )
                    })}
                    <div className="flex items-center justify-end gap-1 pt-1 text-[10px] text-slate-400 dark:text-slate-300">
                      <span>10:45 ص</span>
                      <CheckCheck className="h-3 w-3 text-blue-500" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 5: سجل الرسائل (Message Logs & Monitor)                               */}
      {/* ========================================================================= */}
      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Explanation Banner */}
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-xs text-slate-600 shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:text-slate-400 flex items-center justify-between">
            <div>
              <strong>توضيح لحالات الإرسال:</strong> «تم الإرسال (Sent)» تعني قبول المزود للرسالة بنجاح، بينما «تم التسليم (Delivered)» تؤكد استلام هاتف المريض للرسالة فعليًا.
            </div>
            <div className="flex items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={fetchLogs}
                disabled={logsLoading}
                className="gap-1.5 text-xs"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${logsLoading ? 'animate-spin' : ''}`} />
                تحديث السجل
              </Button>
              <Button
                size="sm"
                onClick={handleDrainQueue}
                disabled={drainingQueue}
                className="bg-emerald-600 text-xs text-white hover:bg-emerald-700 gap-1.5"
              >
                <Play className="h-3.5 w-3.5" />
                معالجة الرسائل المستحقة الآن
              </Button>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-3">
            <select
              value={logClinicFilter}
              onChange={(e) => setLogClinicFilter(e.target.value)}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-900"
            >
              <option value="">جميع العيادات</option>
              {clinics.map((c) => (
                <option key={c.clinicId} value={c.clinicId}>
                  {c.clinicName}
                </option>
              ))}
            </select>

            <select
              value={logStatusFilter}
              onChange={(e) => setLogStatusFilter(e.target.value)}
              className="rounded-lg border bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-900"
            >
              <option value="">جميع الحالات</option>
              <option value="queued">في الطابور (Queued)</option>
              <option value="waiting_for_connection">بانتظار الاتصال (Waiting)</option>
              <option value="sent">تم القبول (Sent)</option>
              <option value="delivered">تم التسليم للمريض (Delivered)</option>
              <option value="failed">فشلت (Failed)</option>
              <option value="uncertain">غير مؤكدة (Uncertain)</option>
              <option value="cancelled">ملغاة (Cancelled)</option>
            </select>
          </div>

          {/* Logs Table */}
          <div className="overflow-x-auto rounded-xl border bg-white shadow-sm dark:bg-slate-900">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                <tr>
                  <th className="py-3 px-4 text-right font-semibold">المريض</th>
                  <th className="py-3 px-4 text-right font-semibold">العيادة</th>
                  <th className="py-3 px-4 text-right font-semibold">نوع الرسالة</th>
                  <th className="py-3 px-4 text-right font-semibold">وقت الجدولة (القاهرة)</th>
                  <th className="py-3 px-4 text-right font-semibold">الحالة</th>
                  <th className="py-3 px-4 text-right font-semibold">المحاولات والسبب</th>
                  <th className="py-3 px-4 text-center font-semibold">إجراء</th>
                </tr>
              </thead>
              <tbody className="divide-y text-slate-800 dark:divide-slate-800 dark:text-slate-200">
                {jobs.map((job) => {
                  return (
                    <tr key={job.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-3 px-4">
                        <div className="font-bold text-slate-900 dark:text-white">{job.patientName}</div>
                        <div className="font-mono text-xs text-slate-500">{job.patientPhone}</div>
                      </td>
                      <td className="py-3 px-4 text-xs font-medium">
                        {job.clinicName || job.clinicId}
                      </td>
                      <td className="py-3 px-4">
                        <Badge variant="outline" className="text-xs">
                          {WHATSAPP_SUB_FEATURE_LABELS[job.jobType as WhatsAppSubFeatureKey]?.titleAr || job.jobType}
                        </Badge>
                      </td>
                      <td className="py-3 px-4 text-xs font-mono text-slate-500">
                        {job.scheduledAt ? new Date(job.scheduledAt).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) : '—'}
                      </td>
                      <td className="py-3 px-4">
                        {job.status === 'delivered' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                            تم التسليم للمريض
                          </Badge>
                        ) : job.status === 'sent' ? (
                          <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300">
                            تم الإرسال (مقبول)
                          </Badge>
                        ) : job.status === 'waiting_for_connection' ? (
                          <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                            بانتظار الاتصال
                          </Badge>
                        ) : job.status === 'queued' ? (
                          <Badge variant="outline" className="text-slate-600">
                            في الطابور
                          </Badge>
                        ) : job.status === 'failed' ? (
                          <Badge variant="destructive">فشلت</Badge>
                        ) : job.status === 'uncertain' ? (
                          <Badge className="bg-purple-100 text-purple-800 dark:bg-purple-950 dark:text-purple-300">
                            غير مؤكدة
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-slate-400">{job.status}</Badge>
                        )}
                      </td>
                      <td className="py-3 px-4 text-xs text-slate-500">
                        <div>محاولات: {job.attempts || 0}</div>
                        {job.lastError && (
                          <div className="text-rose-500 text-[11px] truncate max-w-[200px]" title={job.lastError}>
                            {job.lastError}
                          </div>
                        )}
                      </td>
                      <td className="py-3 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          {(job.status === 'failed' || job.status === 'uncertain') && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleRetryJob(job.id)}
                              disabled={retryingJobId === job.id}
                              className="h-7 px-2 text-xs"
                            >
                              إعادة المحاولة
                            </Button>
                          )}
                          {(job.status === 'queued' || job.status === 'waiting_for_connection') && (
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleCancelJob(job.id)}
                              disabled={cancellingJobId === job.id}
                              className="h-7 px-2 text-xs text-rose-600 hover:bg-rose-50"
                            >
                              إلغاء
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
                {jobs.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      لا توجد رسائل مطابقة للتصفية في الطابور.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TAB 6: الأمان والتحكم الجماعي (Security & Batch Controls)                   */}
      {/* ========================================================================= */}
      {activeTab === 'security' && (
        <div className="space-y-6">
          {/* 1. Global Kill Switch Card */}
          <div className="rounded-xl border border-rose-200 bg-white p-6 shadow-sm dark:border-rose-900/50 dark:bg-slate-900">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-bold text-rose-900 dark:text-rose-200 flex items-center gap-2">
                  <ShieldAlert className="h-5 w-5 text-rose-600" />
                  مفتاح إيقاف الطوارئ الشامل (Global Emergency Kill Switch)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  يقوم بتعطيل فوري لجميع عمليات الإرسال التلقائي واليدوي عبر جميع عيادات المنصة بزر واحد، ويمنع أي خروج للرسائل.
                </p>
              </div>
              <Button
                variant={platformDefaults.emergencyStop ? 'default' : 'destructive'}
                onClick={() => setEmergencyConfirmOpen(true)}
                className="font-bold shadow-sm"
              >
                {platformDefaults.emergencyStop ? 'استئناف الإرسال في المنصة' : 'إيقاف الطوارئ الفوري'}
              </Button>
            </div>
          </div>

          {/* 2. Quiet Hours (ساعات عدم الإزعاج) */}
          <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <Moon className="h-5 w-5 text-indigo-600" />
                  ساعات عدم الإزعاج (Quiet Hours)
                </h3>
                <p className="text-xs text-slate-500 mt-1">
                  منع إرسال أي تذكيرات أو رسائل تلقائية في ساعات الليل وتأجيلها للصباح (بتوقيت القاهرة).
                </p>
              </div>
              <Switch
                checked={platformDefaults.quietHours?.enabled}
                onCheckedChange={(val) => {
                  setPlatformDefaults((prev) => ({
                    ...prev,
                    quietHours: {
                      enabled: val,
                      startCairoHour: prev.quietHours?.startCairoHour || 23,
                      endCairoHour: prev.quietHours?.endCairoHour || 8,
                    },
                  }))
                }}
              />
            </div>

            {platformDefaults.quietHours?.enabled && (
              <div className="flex items-center gap-4 pt-3 border-t">
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500">من الساعة:</Label>
                  <select
                    value={platformDefaults.quietHours?.startCairoHour}
                    onChange={(e) => {
                      const h = Number(e.target.value)
                      setPlatformDefaults((prev) => ({
                        ...prev,
                        quietHours: { ...prev.quietHours!, startCairoHour: h },
                      }))
                    }}
                    className="rounded-lg border bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-800"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12:00 منتصف الليل' : i < 12 ? `${i}:00 صباحًا` : i === 12 ? '12:00 ظهرًا' : `${i - 12}:00 مساءً`}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <Label className="text-xs text-slate-500">إلى الساعة:</Label>
                  <select
                    value={platformDefaults.quietHours?.endCairoHour}
                    onChange={(e) => {
                      const h = Number(e.target.value)
                      setPlatformDefaults((prev) => ({
                        ...prev,
                        quietHours: { ...prev.quietHours!, endCairoHour: h },
                      }))
                    }}
                    className="rounded-lg border bg-white px-3 py-1.5 text-xs shadow-sm dark:bg-slate-800"
                  >
                    {Array.from({ length: 24 }).map((_, i) => (
                      <option key={i} value={i}>
                        {i === 0 ? '12:00 منتصف الليل' : i < 12 ? `${i}:00 صباحًا` : i === 12 ? '12:00 ظهرًا' : `${i - 12}:00 مساءً`}
                      </option>
                    ))}
                  </select>
                </div>
                <Button size="sm" onClick={handleSavePlatformDefaults} className="bg-indigo-600 text-xs text-white">
                  حفظ ساعات الهدوء
                </Button>
              </div>
            )}
          </div>

          {/* 3. Batch Controls: Apply Defaults & Copy Settings */}
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Sliders className="h-5 w-5 text-emerald-600" />
                تطبيق الإعدادات الافتراضية جماعيًا (Batch Apply)
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                تطبيق السياسة الافتراضية الحالية للمنصة على كافة العيادات بنقرة واحدة لتوحيد المعايير.
              </p>
              <Button
                variant="outline"
                onClick={() => setBatchApplyConfirmOpen(true)}
                className="w-full border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs font-bold"
              >
                تطبيق سياسة المنصة على جميع العيادات
              </Button>
            </div>

            <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-3">
              <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <Copy className="h-5 w-5 text-blue-600" />
                نسخ الإعدادات بين العيادات (Copy Settings)
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                نسخ حوكمة الرسائل ومواعيد التذكيرات من عيادة إلى أخرى بأمان تام دون المساس ببيانات الاتصال.
              </p>
              <Button
                variant="outline"
                onClick={() => setCopySettingsOpen(true)}
                className="w-full border-blue-300 text-blue-700 hover:bg-blue-50 text-xs font-bold"
              >
                نسخ إعدادات عيادة إلى عيادة أخرى
              </Button>
            </div>
          </div>

          {/* 4. Audit Trail Table */}
          <div className="rounded-xl border bg-white p-6 shadow-sm dark:bg-slate-900 space-y-3">
            <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <History className="h-5 w-5 text-slate-600" />
              سجل التدقيق والتغييرات (Owner Audit Trail)
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-slate-50 text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="py-2.5 px-3 text-right">الوقت (بتوقيت القاهرة)</th>
                    <th className="py-2.5 px-3 text-right">الإجراء</th>
                    <th className="py-2.5 px-3 text-right">المستخدم المسؤول</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-slate-700 dark:divide-slate-800 dark:text-slate-300">
                  {auditLogs.map((log: any, idx: number) => (
                    <tr key={idx} className="hover:bg-slate-50 dark:hover:bg-slate-800/50">
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {log.timestamp ? new Date(log.timestamp).toLocaleString('ar-EG', { timeZone: 'Africa/Cairo' }) : '—'}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900 dark:text-white">
                        {log.action}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-500">
                        {log.ownerEmail || log.ownerUid}
                      </td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={3} className="py-4 text-center text-slate-400">
                        لا توجد سجلات تدقيق سابقة.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* SLIDE-OVER DRAWER FOR CLINIC MANAGEMENT                                    */}
      {/* ========================================================================= */}
      {drawerClinic && (
        <div className="fixed inset-0 z-50 overflow-hidden">
          {/* Backdrop */}
          <div
            onClick={() => setDrawerClinic(null)}
            className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
          />

          {/* Slide Drawer Panel */}
          <div className="fixed inset-y-0 right-0 max-w-full flex">
            <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col dark:bg-slate-900 border-r">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b p-5">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 dark:text-white">
                    إدارة واتساب عيادة: {drawerClinic.clinicName}
                  </h2>
                  <p className="text-xs text-slate-500">
                    {drawerClinic.doctorName} • {drawerClinic.slug}
                  </p>
                </div>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => setDrawerClinic(null)}
                  className="rounded-full"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>

              {/* Drawer Sub-navigation */}
              <div className="flex items-center gap-1 border-b bg-slate-50 p-2 dark:bg-slate-800 text-xs font-semibold overflow-x-auto">
                {[
                  { id: 'conn', label: 'الاتصال و QR' },
                  { id: 'msgs', label: 'الرسائل المسموحة' },
                  { id: 'reminders', label: 'التذكيرات' },
                  { id: 'perms', label: 'صلاحيات الدكتور' },
                  { id: 'logs', label: 'سجل العيادة' },
                ].map((st) => (
                  <button
                    key={st.id}
                    onClick={() => setDrawerSubTab(st.id as any)}
                    className={`rounded-lg px-3 py-1.5 transition ${
                      drawerSubTab === st.id
                        ? 'bg-white text-emerald-700 shadow-sm dark:bg-slate-900 dark:text-emerald-400'
                        : 'text-slate-600 hover:text-slate-900 dark:text-slate-400'
                    }`}
                  >
                    {st.label}
                  </button>
                ))}
              </div>

              {/* Drawer Body */}
              <div className="flex-1 overflow-y-auto p-6 space-y-6">
                {/* 1. Connection & QR Code Sub-tab */}
                {drawerSubTab === 'conn' && (
                  <div className="space-y-5">
                    <div className="rounded-xl border bg-slate-50 p-4 dark:bg-slate-800 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-500">حالة الجلسة:</span>
                        {drawerClinic.sessionStatus === 'connected' ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 gap-1">
                            <Wifi className="h-3 w-3" /> متصل بنجاح
                          </Badge>
                        ) : (
                          <Badge variant="destructive" className="gap-1">
                            <WifiOff className="h-3 w-3" /> غير متصل
                          </Badge>
                        )}
                      </div>
                      <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                        Session ID: {`session_${drawerClinic.clinicId.slice(0, 8)}`}
                      </div>
                      <div className="text-xs font-mono text-slate-600 dark:text-slate-300">
                        رقم المرسل: {drawerClinic.wpSender?.senderNumber || drawerClinic.phone || 'غير محدد'}
                      </div>
                    </div>

                    {/* QR Code Container */}
                    <div className="rounded-xl border p-5 text-center space-y-3 bg-white dark:bg-slate-950">
                      <h4 className="font-bold text-sm text-slate-900 dark:text-white">رمز QR لربط واتساب بالهاتف</h4>
                      <p className="text-xs text-slate-500">
                        امسح الرمز من تطبيق WhatsApp Business في هاتف العيادة (الأجهزة المرتبطة).
                      </p>

                      <div className="flex justify-center p-3">
                        {qrCodeData ? (
                          qrCodeData.startsWith('data:image/svg') ? (
                            <div
                              dangerouslySetInnerHTML={{ __html: decodeURIComponent(qrCodeData.split(',')[1] || '') }}
                              className="rounded-xl border p-2 bg-white"
                            />
                          ) : (
                            <img src={qrCodeData} alt="QR Code" className="h-48 w-48 rounded-xl border p-2 bg-white" />
                          )
                        ) : (
                          <div className="flex h-48 w-48 items-center justify-center rounded-xl border-2 border-dashed text-slate-400">
                            {loadingQr ? (
                              <RefreshCw className="h-8 w-8 animate-spin text-emerald-600" />
                            ) : (
                              <QrCode className="h-12 w-12" />
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex justify-center gap-2">
                        <Button
                          size="sm"
                          onClick={() => handleFetchQr(drawerClinic.clinicId)}
                          disabled={loadingQr}
                          className="bg-emerald-600 text-xs font-semibold text-white"
                        >
                          <RefreshCw className={`ml-1.5 h-3.5 w-3.5 ${loadingQr ? 'animate-spin' : ''}`} />
                          توليد / تحديث رمز QR
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleCheckHealth(drawerClinic.clinicId)}
                          className="text-xs"
                        >
                          فحص الاتصال
                        </Button>
                      </div>
                    </div>

                    {/* Actions: Unlink */}
                    <div className="pt-4 border-t flex justify-end">
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => handleUnlinkClinic(drawerClinic.clinicId)}
                        className="text-xs"
                      >
                        <Unlink className="ml-1.5 h-3.5 w-3.5" />
                        فصل الرقم وإلغاء الجلسة
                      </Button>
                    </div>
                  </div>
                )}

                {/* 2. Messages Sub-tab */}
                {drawerSubTab === 'msgs' && (
                  <div className="space-y-4">
                    <p className="text-xs text-slate-500">
                      حدد الرسائل المسموح بإرسالها لهذه العيادة وطريقة الإرسال (تلقائي / يدوي / معطل):
                    </p>
                    <div className="space-y-3">
                      {PRIMARY_WHATSAPP_SUB_FEATURES.map((featKey) => {
                        const feat = drawerPolicyDraft.features?.[featKey] || drawerClinic.effectivePolicy.features[featKey] || {
                          visible: true,
                          enabled: true,
                          mode: 'auto',
                        }
                        const label = WHATSAPP_SUB_FEATURE_LABELS[featKey]
                        return (
                          <div key={featKey} className="flex items-center justify-between rounded-xl border p-3.5">
                            <div>
                              <div className="font-bold text-sm text-slate-900 dark:text-white">{label.titleAr}</div>
                              <div className="text-xs text-slate-500">{label.descAr}</div>
                            </div>
                            <select
                              value={feat.mode}
                              onChange={(e) => {
                                const m = e.target.value as WhatsAppSubFeatureMode
                                setDrawerPolicyDraft((prev) => ({
                                  ...prev,
                                  features: {
                                    ...prev.features,
                                    [featKey]: { ...feat, mode: m, enabled: m !== 'disabled' },
                                  },
                                }))
                              }}
                              className="rounded-lg border px-2.5 py-1 text-xs font-semibold"
                            >
                              <option value="auto">تلقائي (Auto)</option>
                              <option value="manual">يدوي (Manual)</option>
                              <option value="disabled">معطل (Disabled)</option>
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 3. Reminders Sub-tab */}
                {drawerSubTab === 'reminders' && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <Label className="text-sm font-bold text-slate-900 dark:text-white">قواعد التذكيرات المجدولة:</Label>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          const current = Array.isArray(drawerSettingsDraft.reminders) ? [...drawerSettingsDraft.reminders] : []
                          current.push([2, 'hour'])
                          setDrawerSettingsDraft((prev: any) => ({ ...prev, reminders: current }))
                        }}
                        className="text-xs gap-1"
                      >
                        <Plus className="h-3 w-3" /> إضافة موعد تذكير
                      </Button>
                    </div>

                    <div className="space-y-2">
                      {(drawerSettingsDraft.reminders || []).map((rule: any, rIdx: number) => {
                        const val = rule[0]
                        const unit = rule[1]
                        return (
                          <div key={rIdx} className="flex items-center justify-between rounded-xl border p-3">
                            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                              تذكير قبل الموعد بـ:
                            </span>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                min={1}
                                max={72}
                                value={val}
                                onChange={(e) => {
                                  const nextVal = Number(e.target.value) || 1
                                  const nextRules = [...drawerSettingsDraft.reminders]
                                  nextRules[rIdx] = [nextVal, unit]
                                  setDrawerSettingsDraft((prev: any) => ({ ...prev, reminders: nextRules }))
                                }}
                                className="w-16 h-8 text-xs text-center"
                              />
                              <select
                                value={unit}
                                onChange={(e) => {
                                  const nextUnit = e.target.value
                                  const nextRules = [...drawerSettingsDraft.reminders]
                                  nextRules[rIdx] = [val, nextUnit]
                                  setDrawerSettingsDraft((prev: any) => ({ ...prev, reminders: nextRules }))
                                }}
                                className="rounded-lg border px-2 py-1 text-xs"
                              >
                                <option value="minute">دقيقة</option>
                                <option value="hour">ساعة</option>
                                <option value="day">يوم</option>
                              </select>
                              <Button
                                size="icon"
                                variant="ghost"
                                onClick={() => {
                                  const nextRules = drawerSettingsDraft.reminders.filter((_: any, idx: number) => idx !== rIdx)
                                  setDrawerSettingsDraft((prev: any) => ({ ...prev, reminders: nextRules }))
                                }}
                                className="h-8 w-8 text-rose-500 hover:bg-rose-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 4. Doctor Permissions Sub-tab */}
                {drawerSubTab === 'perms' && (
                  <div className="space-y-5">
                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div>
                        <Label className="font-bold text-sm">إظهار قسم واتساب في لوحة تحكم الطبيب</Label>
                        <p className="text-xs text-slate-500">تمكين الطاقم الطبي من رؤية التبويب</p>
                      </div>
                      <Switch
                        checked={drawerPolicyDraft.sectionVisible ?? drawerClinic.effectivePolicy.sectionVisible}
                        onCheckedChange={(val) => setDrawerPolicyDraft((prev) => ({ ...prev, sectionVisible: val }))}
                      />
                    </div>

                    <div className="flex items-center justify-between rounded-xl border p-4">
                      <div>
                        <Label className="font-bold text-sm">تفعيل إرسال الرسائل الحية للعيادة</Label>
                        <p className="text-xs text-slate-500">إيقاف الخدمة يمنع الإرسال مع الاحتفاظ بالقوالب</p>
                      </div>
                      <Switch
                        checked={drawerPolicyDraft.serviceEnabled ?? drawerClinic.effectivePolicy.serviceEnabled}
                        onCheckedChange={(val) => setDrawerPolicyDraft((prev) => ({ ...prev, serviceEnabled: val }))}
                      />
                    </div>

                    <div className="space-y-3 pt-2">
                      <Label className="text-xs font-bold text-slate-500 block">إمكانية تعديل النصوص للطبيب:</Label>
                      {PRIMARY_WHATSAPP_SUB_FEATURES.map((fk) => {
                        const feat = drawerPolicyDraft.features?.[fk] || drawerClinic.effectivePolicy.features[fk]
                        const label = WHATSAPP_SUB_FEATURE_LABELS[fk]
                        return (
                          <div key={fk} className="flex items-center justify-between rounded-lg border p-3 text-xs">
                            <span className="font-semibold text-slate-800 dark:text-slate-200">{label.titleAr}</span>
                            <select
                              value={feat?.editPermission || 'read_only'}
                              onChange={(e) => {
                                const p = e.target.value as WhatsAppEditPermission
                                setDrawerPolicyDraft((prev) => ({
                                  ...prev,
                                  features: {
                                    ...prev.features,
                                    [fk]: { ...feat, editPermission: p },
                                  },
                                }))
                              }}
                              className="rounded border px-2 py-1 text-xs"
                            >
                              <option value="read_only">🔒 قراءة فقط</option>
                              <option value="editable">✏️ قابل للتعديل</option>
                            </select>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* 5. Clinic-specific Logs Sub-tab */}
                {drawerSubTab === 'logs' && (
                  <div className="space-y-3">
                    <p className="text-xs text-slate-500">رسائل الطابور الخاصة بهذه العيادة فقط:</p>
                    <div className="space-y-2">
                      {jobs
                        .filter((j) => j.clinicId === drawerClinic.clinicId)
                        .slice(0, 30)
                        .map((job) => (
                          <div key={job.id} className="rounded-xl border p-3 text-xs space-y-1">
                            <div className="flex items-center justify-between font-bold">
                              <span>{job.patientName} ({job.patientPhone})</span>
                              <Badge variant="outline">{job.status}</Badge>
                            </div>
                            <div className="text-slate-500">{job.jobType}</div>
                            {job.lastError && <div className="text-rose-500">{job.lastError}</div>}
                          </div>
                        ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Footer */}
              <div className="border-t p-4 flex items-center justify-end gap-2 bg-slate-50 dark:bg-slate-800">
                <Button variant="outline" size="sm" onClick={() => setDrawerClinic(null)}>
                  إلغاء
                </Button>
                <Button
                  size="sm"
                  onClick={handleSaveDrawerPolicy}
                  disabled={savingDrawer}
                  className="bg-emerald-600 text-white font-bold hover:bg-emerald-700"
                >
                  <CheckCircle2 className="ml-1.5 h-4 w-4" />
                  حفظ تغييرات العيادة
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* DIALOG 1: Emergency Stop Confirmation                                     */}
      {/* ========================================================================= */}
      <Dialog open={emergencyConfirmOpen} onOpenChange={setEmergencyConfirmOpen}>
        <DialogContent className="text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-rose-600">
              <AlertOctagon className="h-6 w-6" />
              {platformDefaults.emergencyStop ? 'استئناف إرسال واتساب للمنصة' : 'تأكيد إيقاف الطوارئ العام (Kill Switch)'}
            </DialogTitle>
            <DialogDescription className="text-right text-sm pt-2">
              {platformDefaults.emergencyStop
                ? 'هل تريد استئناف خدمة واتساب لجميع العيادات والسماح بخروج الرسائل المجدولة والجديدة؟'
                : 'سيؤدي هذا الإجراء إلى تجميد فوري لجميع عمليات الإرسال التلقائي واليدوي عبر كامل المنصة، ولن يتم إرسال أي رسالة لحين استئناف الخدمة.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setEmergencyConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              variant={platformDefaults.emergencyStop ? 'default' : 'destructive'}
              onClick={handleToggleEmergencyStop}
              disabled={togglingEmergency}
              className="font-bold"
            >
              {platformDefaults.emergencyStop ? 'تأكيد الاستئناف الآن' : 'تأكيد الإيقاف الفوري'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 2: Send Test Preview Message                                       */}
      {/* ========================================================================= */}
      <Dialog open={testPreviewOpen} onOpenChange={setTestPreviewOpen}>
        <DialogContent className="text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-emerald-600" />
              تجربة إرسال رسالة معاينة لرقمك
            </DialogTitle>
            <DialogDescription className="text-right text-xs pt-1">
              أدخل رقم الهاتف لتجربة استلام القالب الحالي كما سيظهر للمريض دون التأثير على الحجوزات أو قاعدة البيانات.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2">
            <Label className="text-xs font-bold text-slate-700">رقم الهاتف المستلم (مع كود الدولة):</Label>
            <Input
              placeholder="مثال: 01012345678 أو 201012345678"
              value={testPhone}
              onChange={(e) => setTestPhone(e.target.value)}
              className="font-mono text-left"
              dir="ltr"
            />
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setTestPreviewOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleSendTestPreview}
              disabled={sendingTest}
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            >
              {sendingTest ? 'جاري الإرسال...' : 'إرسال المعاينة الآن'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 3: Batch Apply Defaults Confirmation                               */}
      {/* ========================================================================= */}
      <Dialog open={batchApplyConfirmOpen} onOpenChange={setBatchApplyConfirmOpen}>
        <DialogContent className="text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Sliders className="h-5 w-5 text-emerald-600" />
              تطبيق السياسة الافتراضية على جميع العيادات
            </DialogTitle>
            <DialogDescription className="text-right text-xs pt-2 leading-relaxed">
              سيتم تعميم إعدادات المنصة الحالية لرسائل واتساب على جميع العيادات ({clinics.length} عيادة).
              لن يتم حذف أرقام الربط أو الجلسات الحالية.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setBatchApplyConfirmOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleBatchApply}
              disabled={applyingBatch}
              className="bg-emerald-600 font-bold text-white hover:bg-emerald-700"
            >
              {applyingBatch ? 'جاري التطبيق...' : 'تأكيد التطبيق على الجميع'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ========================================================================= */}
      {/* DIALOG 4: Copy Settings Modal                                             */}
      {/* ========================================================================= */}
      <Dialog open={copySettingsOpen} onOpenChange={setCopySettingsOpen}>
        <DialogContent className="text-right" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Copy className="h-5 w-5 text-blue-600" />
              نسخ إعدادات وقوالب الرسائل بين عيادتين
            </DialogTitle>
            <DialogDescription className="text-right text-xs pt-1">
              يتم نسخ السياسات ومواعيد التذكيرات والقوالب فقط، مع الحفاظ الكامل على جلسة ورقم العيادة الهدف.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-3">
            <div>
              <Label className="text-xs font-bold text-slate-700 block mb-1">العيادة المصدر (Source):</Label>
              <select
                value={copySourceId}
                onChange={(e) => setCopySourceId(e.target.value)}
                className="w-full rounded-lg border bg-white p-2.5 text-xs shadow-sm dark:bg-slate-900"
              >
                <option value="">اختر العيادة المصدر...</option>
                {clinics.map((c) => (
                  <option key={c.clinicId} value={c.clinicId}>
                    {c.clinicName} ({c.doctorName || c.slug})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <Label className="text-xs font-bold text-slate-700 block mb-1">العيادة الهدف (Target):</Label>
              <select
                value={copyTargetId}
                onChange={(e) => setCopyTargetId(e.target.value)}
                className="w-full rounded-lg border bg-white p-2.5 text-xs shadow-sm dark:bg-slate-900"
              >
                <option value="">اختر العيادة الهدف...</option>
                {clinics.map((c) => (
                  <option key={c.clinicId} value={c.clinicId}>
                    {c.clinicName} ({c.doctorName || c.slug})
                  </option>
                ))}
              </select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setCopySettingsOpen(false)}>
              إلغاء
            </Button>
            <Button
              onClick={handleCopySettings}
              disabled={copyingSettings}
              className="bg-blue-600 font-bold text-white hover:bg-blue-700"
            >
              {copyingSettings ? 'جاري النسخ...' : 'تأكيد النسخ الآن'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
