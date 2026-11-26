'use client'

import { use, useEffect, useMemo, useRef, useState } from 'react'
import { toast } from 'sonner'
import {
  MessageSquare,
  CheckCheck,
  RotateCcw,
  Save,
  Eye,
  QrCode,
  Wifi,
  WifiOff,
  Lock,
  Sparkles,
  CalendarCheck2,
  BellRing,
  CalendarClock,
  CalendarX2,
  FileText,
  Receipt,
  RefreshCw,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Plus,
} from 'lucide-react'
import {
  messageDefaults,
  TEMPLATE_CATALOG,
  TEMPLATE_VARIABLE_DEFS,
  TEMPLATE_ALLOWED_TOKENS_PER_KEY,
  WHATSAPP_TEMPLATE_KEYS,
  renderClinicMessage,
  resolveSampleContextForKey,
  parseWhatsAppPreviewLine,
  validateTemplateText,
  MAX_TEMPLATE_LENGTH,
  type WhatsAppTemplateKey,
  type WhatsAppTemplateAuditEntry,
} from '@/lib/clinic-message-templates'
import type { EffectiveWhatsAppPolicy, WhatsAppSubFeatureKey } from '@/lib/whatsapp-policy'
import { WhatsAppDeliveryBadge } from '@/components/clinic/WhatsAppDeliveryBadge'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { ClinicLoading } from '@/components/clinic/ClinicLoading'

type SettingsState = {
  sendBookingConfirmation: boolean
  sendAppointmentReminder: boolean
  sendRescheduledNotification: boolean
  sendCancelledNotification: boolean
  sendPrescription: boolean
  sendInvoice: boolean
}

const TEMPLATE_ICONS: Record<WhatsAppTemplateKey, any> = {
  booking_confirmation: CalendarCheck2,
  appointment_reminder: BellRing,
  appointment_rescheduled: CalendarClock,
  appointment_cancelled: CalendarX2,
  queue_alert: BellRing,
  prescription: FileText,
  invoice: Receipt,
  prescription_ready: FileText,
  invoice_ready: Receipt,
}

function templateKeyToPolicyKey(key: WhatsAppTemplateKey): WhatsAppSubFeatureKey {
  if (key === 'appointment_rescheduled' || key === 'appointment_cancelled') return 'reschedule_cancel'
  return key
}

export default function ClinicWhatsAppSettingsPage({
  params,
}: {
  params: Promise<{ slug: string }>
}) {
  const { slug } = use(params)

  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState(false)
  const [saving, setSaving] = useState(false)
  const [rechecking, setRechecking] = useState(false)

  const [activeKey, setActiveKey] = useState<WhatsAppTemplateKey>('booking_confirmation')
  const [templates, setTemplates] = useState<Record<WhatsAppTemplateKey, string>>(messageDefaults)
  const [savedTemplates, setSavedTemplates] = useState<Record<WhatsAppTemplateKey, string>>(messageDefaults)
  const [templateAudit, setTemplateAudit] = useState<Partial<Record<WhatsAppTemplateKey, WhatsAppTemplateAuditEntry>>>({})
  const [settings, setSettings] = useState<SettingsState>({
    sendBookingConfirmation: true,
    sendAppointmentReminder: true,
    sendRescheduledNotification: true,
    sendCancelledNotification: true,
    sendPrescription: false,
    sendInvoice: false,
  })
  const [policy, setPolicy] = useState<EffectiveWhatsAppPolicy | null>(null)
  const [mode, setMode] = useState<string>('off')
  const [sessionStatus, setSessionStatus] = useState<string>('unknown')
  const [senderNumber, setSenderNumber] = useState<string>('')
  const [qrReady, setQrReady] = useState(false)
  const [qrUrl, setQrUrl] = useState('')
  const [qrConnectedMsg, setQrConnectedMsg] = useState('')
  const [deliverySummary, setDeliverySummary] = useState<Record<string, number>>({})
  const [recentJobs, setRecentJobs] = useState<any[]>([])
  const [previewSampleFlash, setPreviewSampleFlash] = useState(false)

  const editorRef = useRef<HTMLTextAreaElement | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/whatsapp`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (res.status === 403) {
        setForbidden(true)
        setLoading(false)
        return
      }
      if (!res.ok) {
        toast.error('تعذر تحميل إعدادات رسائل واتساب')
        setLoading(false)
        return
      }
      const data = await res.json()
      setForbidden(false)
      if (data.templates) {
        const merged = { ...messageDefaults, ...data.templates }
        setTemplates(merged)
        setSavedTemplates(merged)
      }
      if (data.templateAudit) setTemplateAudit(data.templateAudit)
      if (data.settings) setSettings(data.settings)
      if (data.policy) setPolicy(data.policy)
      if (data.mode) setMode(data.mode)
      if (data.sessionStatus) setSessionStatus(data.sessionStatus)
      if (data.wpSender?.senderNumber) setSenderNumber(data.wpSender.senderNumber)
      setQrReady(Boolean(data.qrReady))
      if (data.deliverySummary) setDeliverySummary(data.deliverySummary)
      if (Array.isArray(data.recentJobs)) setRecentJobs(data.recentJobs)
    } catch {
      toast.error('تعذر الاتصال بالخادم لتحميل إعدادات الواتساب')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void loadData()
  }, [slug])

  const visibleTemplateKeys = useMemo(() => {
    if (!policy) return WHATSAPP_TEMPLATE_KEYS
    return WHATSAPP_TEMPLATE_KEYS.filter((k) => {
      const pk = templateKeyToPolicyKey(k)
      return policy.features[pk]?.visible !== false
    })
  }, [policy])

  const currentKey = visibleTemplateKeys.includes(activeKey)
    ? activeKey
    : (visibleTemplateKeys[0] || 'booking_confirmation')

  const activeMeta = TEMPLATE_CATALOG[currentKey]
  const activePolicyKey = templateKeyToPolicyKey(currentKey)
  const activeSubPolicy = policy?.features[activePolicyKey]
  const activeText = templates[currentKey] ?? messageDefaults[currentKey]
  const validation = useMemo(() => validateTemplateText(activeText), [activeText])
  const hasUnsavedChanges = useMemo(
    () => WHATSAPP_TEMPLATE_KEYS.some((k) => templates[k] !== savedTemplates[k]),
    [templates, savedTemplates],
  )

  const sampleContext = useMemo(() => resolveSampleContextForKey(activeKey), [activeKey])
  const previewRendered = useMemo(
    () => renderClinicMessage(activeText || messageDefaults[activeKey], sampleContext),
    [activeText, activeKey, sampleContext],
  )
  const previewLines = useMemo(() => previewRendered.split('\n'), [previewRendered])

  const getSettingChecked = (key: WhatsAppTemplateKey): boolean => {
    switch (key) {
      case 'booking_confirmation':
        return settings.sendBookingConfirmation
      case 'appointment_reminder':
        return settings.sendAppointmentReminder
      case 'appointment_rescheduled':
        return settings.sendRescheduledNotification
      case 'appointment_cancelled':
        return settings.sendCancelledNotification
      case 'prescription':
      case 'prescription_ready':
        return settings.sendPrescription
      case 'invoice':
      case 'invoice_ready':
        return settings.sendInvoice
      default:
        return true
    }
  }

  const setSettingChecked = (key: WhatsAppTemplateKey, checked: boolean) => {
    setSettings((prev) => {
      switch (key) {
        case 'booking_confirmation':
          return { ...prev, sendBookingConfirmation: checked }
        case 'appointment_reminder':
          return { ...prev, sendAppointmentReminder: checked }
        case 'appointment_rescheduled':
          return { ...prev, sendRescheduledNotification: checked }
        case 'appointment_cancelled':
          return { ...prev, sendCancelledNotification: checked }
        case 'prescription':
        case 'prescription_ready':
          return { ...prev, sendPrescription: checked }
        case 'invoice':
        case 'invoice_ready':
          return { ...prev, sendInvoice: checked }
        default:
          return prev
      }
    })
  }

  const handleInsertToken = (token: string) => {
    const el = editorRef.current
    const current = activeText || ''
    if (el && typeof el.selectionStart === 'number') {
      const start = el.selectionStart
      const end = el.selectionEnd ?? start
      const next = current.slice(0, start) + token + current.slice(end)
      setTemplates((prev) => ({ ...prev, [activeKey]: next }))
      requestAnimationFrame(() => {
        el.focus()
        const pos = start + token.length
        el.setSelectionRange(pos, pos)
      })
    } else {
      const separator = current && !current.endsWith(' ') && !current.endsWith('\n') ? ' ' : ''
      setTemplates((prev) => ({ ...prev, [activeKey]: `${current}${separator}${token}` }))
    }
    toast.success(`تم إدراج المتغير ${token}`)
  }

  const handleRestoreCurrentDefault = () => {
    setTemplates((prev) => ({ ...prev, [activeKey]: messageDefaults[activeKey] }))
    toast.info(`تم استعادة النص الافتراضي لقالب «${activeMeta.titleAr}». اضغط حفظ للاعتماد.`)
  }

  const handleSave = async (restoreAll = false) => {
    if (!restoreAll && !validation.valid) {
      toast.error(
        validation.lengthError ||
          `توجد متغيرات غير صالحة: ${validation.unknownTokens.join('، ')}`,
      )
      return
    }
    setSaving(true)
    try {
      const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify(
          restoreAll
            ? { restoreAllDefaults: true, ...settings }
            : { templates, ...settings },
        ),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'تعذر حفظ التغييرات')
        return
      }
      if (data.templates) {
        const merged = { ...messageDefaults, ...data.templates }
        setTemplates(merged)
        setSavedTemplates(merged)
      }
      if (data.templateAudit) setTemplateAudit(data.templateAudit)
      if (data.settings) setSettings(data.settings)
      toast.success(restoreAll ? 'تمت استعادة كافة القوالب الافتراضية وحفظها' : 'تم حفظ قوالب وإعدادات رسائل واتساب بنجاح')
    } catch {
      toast.error('تعذر الاتصال بالخادم أثناء الحفظ')
    } finally {
      setSaving(false)
    }
  }

  const handleRecheckSession = async () => {
    setRechecking(true)
    try {
      const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/whatsapp`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'recheck_session' }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success(
          data.drained?.requeued > 0
            ? `الجلسة متصلة وتم استئناف ${data.drained.requeued} رسالة منتظرة`
            : 'جلسة الواتساب متصلة وتعمل بشكل طبيعي',
        )
        void loadData()
      } else {
        toast.warning('الجلسة غير متصلة حاليًا — تأكد من مسح رمز QR من هاتف العيادة')
        setSessionStatus('disconnected')
      }
    } catch {
      toast.error('تعذر فحص حالة الاتصال')
    } finally {
      setRechecking(false)
    }
  }

  const handleLoadQr = async () => {
    setQrConnectedMsg('')
    setQrUrl('')
    try {
      const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/whatsapp?qr=1&t=${Date.now()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      const cType = res.headers.get('content-type') || ''
      if (res.ok && cType.startsWith('image/')) {
        const blob = await res.blob()
        setQrUrl(URL.createObjectURL(blob))
        toast.info('امسح رمز QR من تطبيق واتساب على هاتف العيادة')
        return
      }
      const data = await res.json().catch(() => ({}))
      if (data.connected) {
        setQrConnectedMsg(data.message || 'الجلسة متصلة بالفعل ولا تحتاج إلى مسح QR')
        setSessionStatus('connected')
        toast.success('الجلسة متصلة بالفعل')
      } else {
        toast.error(data.error || 'تعذر عرض رمز QR حاليًا')
      }
    } catch {
      toast.error('تعذر جلب رمز QR')
    }
  }

  if (loading) return <ClinicLoading />

  if (forbidden || (policy && !policy.sectionVisible)) {
    return (
      <div className="p-6 md:p-10 max-w-3xl mx-auto" dir="rtl">
        <div className="yalla-card p-8 border border-border text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-muted flex items-center justify-center text-muted-foreground">
            <Lock className="w-7 h-7" />
          </div>
          <h1 className="text-xl font-black text-foreground">قسم رسائل واتساب غير متاح</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            تم إخفاء أو تعطيل ميزة رسائل واتساب لهذه العيادة من قِبل إدارة المنصة. كافة القوالب والبيانات السابقة تبقى محفوظة بأمان.
          </p>
        </div>
      </div>
    )
  }

  const auditInfo = templateAudit[activeKey]
  const isOwnerServiceOff = policy && !policy.serviceEnabled

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      {/* 1. SaaS Header Banner */}
      <div className="yalla-card p-5 md:p-6 border border-border space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex flex-wrap items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
                <MessageSquare className="w-5 h-5" />
              </div>
              <div>
                <h1 className="text-xl md:text-2xl font-black text-foreground">
                  إعدادات وقوالب رسائل واتساب
                </h1>
                <p className="text-xs text-muted-foreground">
                  صمّم رسائل عيادتك الاحترافية عبر WP Sender مع معاينة فورية مطابقة لشكل الرسالة لدى المريض.
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Connection Status Pill */}
            {isOwnerServiceOff ? (
              <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/25 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5" />
                متوقف من إدارة المنصة
              </Badge>
            ) : sessionStatus === 'disconnected' ? (
              <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <WifiOff className="w-3.5 h-3.5" />
                الجلسة غير متصلة
              </Badge>
            ) : mode === 'mock' ? (
              <Badge className="bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/30 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />
                وضع تجريبي (Mock)
              </Badge>
            ) : mode === 'live' ? (
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25 px-3 py-1.5 rounded-xl font-bold flex items-center gap-1.5">
                <Wifi className="w-3.5 h-3.5" />
                متصل وجاهز {senderNumber ? `(${senderNumber})` : ''}
              </Badge>
            ) : (
              <Badge className="bg-muted text-muted-foreground border-border px-3 py-1.5 rounded-xl font-bold">
                الخدمة قيد التجهيز
              </Badge>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleRecheckSession}
              disabled={rechecking || Boolean(isOwnerServiceOff)}
              className="rounded-xl text-xs font-bold h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${rechecking ? 'animate-spin' : ''}`} />
              فحص الاتصال واستئناف الطابور
            </Button>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => handleSave(true)}
              disabled={saving}
              className="rounded-xl text-xs font-bold h-9 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
            >
              <RotateCcw className="w-3.5 h-3.5 ml-1.5" />
              استعادة الافتراضي للكل
            </Button>
          </div>
        </div>

        {/* Live Queue Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 pt-3 border-t border-border">
          <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground block">في الطابور</span>
            <span className="text-base font-black font-mono text-sky-600 dark:text-sky-400">
              {deliverySummary.queued || 0}
            </span>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground block">بانتظار الاتصال</span>
            <span className="text-base font-black font-mono text-amber-600 dark:text-amber-400">
              {deliverySummary.waiting_for_connection || 0}
            </span>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground block">مُرسلة للمزود</span>
            <span className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
              {deliverySummary.sent || 0}
            </span>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border px-3 py-2">
            <span className="text-[11px] text-muted-foreground block">تم التسليم المؤكد</span>
            <span className="text-base font-black font-mono text-emerald-700 dark:text-emerald-300">
              {deliverySummary.delivered || 0}
            </span>
          </div>
          <div className="rounded-xl bg-muted/40 border border-border px-3 py-2 col-span-2 sm:col-span-1">
            <span className="text-[11px] text-muted-foreground block">تعذّر / يحتاج مراجعة</span>
            <span className="text-base font-black font-mono text-rose-600 dark:text-rose-400">
              {deliverySummary.failed || 0}
            </span>
          </div>
        </div>

        {isOwnerServiceOff && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-bold text-amber-800 dark:text-amber-200 flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>تم إيقاف خدمة الإرسال التلقائي مؤقتًا من مالك المنصة. يمكنك مراجعة نصوص القوالب، ولن تُرسل رسائل حتى إعادة التفعيل.</span>
          </div>
        )}
      </div>

      {/* 2. Message Type Selector Tabs (Modern SaaS Pill Cards) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
        {visibleTemplateKeys.map((key) => {
          const item = TEMPLATE_CATALOG[key]
          const Icon = TEMPLATE_ICONS[key]
          const isSelected = activeKey === key
          const subPol = policy?.features[templateKeyToPolicyKey(key)]
          const isActive = subPol ? subPol.enabled : getSettingChecked(key)
          return (
            <button
              key={key}
              type="button"
              onClick={() => setActiveKey(key)}
              className={`text-right p-3.5 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                isSelected
                  ? 'border-primary bg-primary/8 shadow-xs ring-2 ring-primary/20'
                  : 'border-border bg-card hover:bg-muted/40'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <span
                  className={`w-8 h-8 rounded-xl flex items-center justify-center ${
                    isSelected ? 'bg-primary text-white' : 'bg-muted text-muted-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                </span>
                <span
                  className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
                      : 'bg-muted text-muted-foreground'
                  }`}
                >
                  {subPol?.autoSend ? 'تلقائي' : subPol?.allowManualSend ? 'يدوي' : isActive ? 'مفعل' : 'متوقف'}
                </span>
              </div>
              <div>
                <p className="text-xs font-black text-foreground leading-snug">{item.titleAr}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5">{item.categoryAr}</p>
              </div>
            </button>
          )
        })}
      </div>

      {/* 3. Main Split Workspace: Wide Editor + Live WhatsApp Preview */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Editor Column */}
        <div className="lg:col-span-7 yalla-card p-5 md:p-6 border border-border space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-border">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground">{activeMeta.titleAr}</h2>
                {auditInfo?.mode === 'custom' ? (
                  <Badge variant="outline" className="text-[10px] font-bold border-primary/30 text-primary">
                    مخصص
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] font-bold">
                    افتراضي
                  </Badge>
                )}
              </div>
              <p className="text-xs text-muted-foreground">{activeMeta.subtitleAr}</p>
            </div>

            {/* Active Toggle (respecting Owner Lock) */}
            <div className="flex items-center gap-2.5 bg-muted/40 border border-border px-3 py-2 rounded-xl shrink-0">
              {activeSubPolicy?.lockedByOwner ? (
                <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground">
                  <Lock className="w-3.5 h-3.5" />
                  <span>مضبوط من الإدارة ({activeSubPolicy.autoSend ? 'تلقائي' : activeSubPolicy.allowManualSend ? 'يدوي' : 'معطل'})</span>
                </div>
              ) : (
                <>
                  <span className="text-xs font-bold text-foreground">
                    {activeKey === 'prescription' || activeKey === 'invoice' ? 'الإرسال التلقائي' : 'تفعيل الرسالة'}
                  </span>
                  <Switch
                    checked={getSettingChecked(activeKey)}
                    onCheckedChange={(checked) => setSettingChecked(activeKey, checked)}
                  />
                </>
              )}
            </div>
          </div>

          {activeMeta.privacyNoteAr && (
            <div className="rounded-xl bg-emerald-500/8 border border-emerald-500/20 px-3.5 py-2.5 flex items-center gap-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">
              <ShieldCheck className="w-4 h-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span>{activeMeta.privacyNoteAr}</span>
            </div>
          )}

          {activeSubPolicy?.editPermission === 'read_only' && (
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 flex items-center gap-2 text-xs font-bold text-amber-800 dark:text-amber-200">
              <Lock className="w-4 h-4 shrink-0 text-amber-600 dark:text-amber-400" />
              <span>محدد بواسطة إدارة المنصة: هذا القالب للقراءة فقط ومضبوط مركزيًا لحماية الهوية، ولا يمكن تعديله من العيادة.</span>
            </div>
          )}

          {/* 1-Click Variable Insertion Bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-foreground">إدراج متغير ديناميكي بضغطة واحدة</span>
              <span className="text-[11px] text-muted-foreground">يُضاف مكان المؤشر</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {TEMPLATE_VARIABLE_DEFS.filter((v) => {
                const allowedTokens = TEMPLATE_ALLOWED_TOKENS_PER_KEY[activeKey]
                if (allowedTokens) {
                  return allowedTokens.includes(v.token)
                }
                if (v.docOnly) {
                  return activeKey === 'prescription' || activeKey === 'invoice'
                }
                return true
              }).map((v) => {
                const isRecommended = activeMeta.recommendedVars.includes(v.token)
                const isReadOnly = activeSubPolicy?.editPermission === 'read_only'
                return (
                  <button
                    key={v.token}
                    type="button"
                    title={v.descriptionAr}
                    disabled={isReadOnly}
                    onClick={() => handleInsertToken(v.token)}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all ${
                      isReadOnly
                        ? 'opacity-50 cursor-not-allowed bg-muted text-muted-foreground border-border'
                        : isRecommended
                        ? 'bg-primary/10 text-primary border-primary/30 hover:bg-primary/15 cursor-pointer'
                        : 'bg-muted/50 text-foreground border-border hover:bg-muted cursor-pointer'
                    }`}
                  >
                    <Plus className="w-3 h-3" />
                    <span>{v.labelAr}</span>
                    <code className="text-[10px] font-mono opacity-80" dir="ltr">
                      {v.token}
                    </code>
                  </button>
                )
              })}
            </div>
          </div>

          {/* Wide Editor Textarea */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-foreground">
                نص الرسالة {activeSubPolicy?.editPermission === 'read_only' ? '(🔒 للعرض فقط)' : '(يدعم *التنسيق العريض* والرموز التعبيرية والأسطر)'}
              </span>
              <span
                className={`font-mono font-bold ${
                  activeText.length > MAX_TEMPLATE_LENGTH ? 'text-rose-600' : 'text-muted-foreground'
                }`}
              >
                {activeText.length} / {MAX_TEMPLATE_LENGTH}
              </span>
            </div>
            <textarea
              ref={editorRef}
              value={activeText}
              readOnly={activeSubPolicy?.editPermission === 'read_only'}
              onChange={(e) => setTemplates((prev) => ({ ...prev, [activeKey]: e.target.value }))}
              rows={7}
              maxLength={MAX_TEMPLATE_LENGTH}
              className={`w-full rounded-2xl border p-4 text-sm leading-7 text-foreground focus:outline-none resize-y ${
                activeSubPolicy?.editPermission === 'read_only'
                  ? 'bg-muted/30 border-border text-muted-foreground cursor-not-allowed'
                  : 'border-input bg-background focus:ring-2 focus:ring-primary/40'
              }`}
              placeholder="اكتب نص رسالة الواتساب هنا..."
            />
            {!validation.valid && (
              <div className="rounded-xl bg-rose-500/10 border border-rose-500/25 px-3 py-2 text-xs font-bold text-rose-700 dark:text-rose-300">
                {validation.lengthError ||
                  `متغير غير مدعوم: ${validation.unknownTokens.join('، ')} — استخدم المتغيرات الجاهزة بالأعلى فقط.`}
              </div>
            )}
          </div>

          {/* Audit + Actions Footer */}
          <div className="pt-3 border-t border-border flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
              <Clock className="w-3.5 h-3.5 shrink-0" />
              {auditInfo?.updatedAt ? (
                <span>
                  آخر تعديل: {new Date(auditInfo.updatedAt).toLocaleString('ar-EG')}
                  {auditInfo.updatedBy ? ` • بواسطة ${auditInfo.updatedBy}` : ''}
                </span>
              ) : (
                <span>قالب افتراضي قياسي</span>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setPreviewSampleFlash(true)
                  setTimeout(() => setPreviewSampleFlash(false), 700)
                }}
                className="rounded-xl text-xs font-bold h-9"
              >
                <Eye className="w-3.5 h-3.5 ml-1.5" />
                معاينة ببيانات تجريبية
              </Button>
              {activeSubPolicy?.editPermission !== 'read_only' && (
                <>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleRestoreCurrentDefault}
                    className="rounded-xl text-xs font-bold h-9"
                  >
                    <RotateCcw className="w-3.5 h-3.5 ml-1.5" />
                    استعادة الافتراضي
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => handleSave(false)}
                    disabled={saving || !validation.valid}
                    className="rounded-xl text-xs font-black h-9 px-5 yalla-gradient-btn text-white shadow-sm"
                  >
                    <Save className="w-3.5 h-3.5 ml-1.5" />
                    {saving ? 'جاري الحفظ...' : hasUnsavedChanges ? 'حفظ التعديلات' : 'حفظ القالب'}
                  </Button>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Live WhatsApp Chat Bubble Preview Column */}
        <div className="lg:col-span-5 space-y-4">
          <div className="yalla-card border border-border overflow-hidden">
            <div className="px-4 py-3 border-b border-border flex items-center justify-between bg-muted/30">
              <div className="flex items-center gap-2">
                <Eye className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">معاينة حية كما تظهر للمريض</h3>
              </div>
              <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20 text-[10px]">
                WhatsApp Chat
              </Badge>
            </div>

            {/* Mock Phone Chat Frame */}
            <div className="bg-[#EFEAE2] dark:bg-[#0B141A] p-4 min-h-[340px] flex flex-col justify-between transition-all">
              {/* Top Chat Header */}
              <div className="rounded-xl bg-[#075E54] dark:bg-[#202C33] text-white px-3.5 py-2.5 flex items-center justify-between shadow-xs mb-4">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-400/25 flex items-center justify-center text-xs font-black">
                    {sampleContext.clinicName?.slice(0, 1) || 'ع'}
                  </div>
                  <div>
                    <p className="text-xs font-bold leading-tight">{sampleContext.clinicName || 'العيادة'}</p>
                    <p className="text-[10px] text-emerald-200 font-mono" dir="ltr">
                      {senderNumber || '+20 100 000 0000'}
                    </p>
                  </div>
                </div>
                <span className="text-[10px] bg-white/15 px-2 py-0.5 rounded-md font-bold">
                  {activeMeta.titleAr}
                </span>
              </div>

              {/* Chat Bubble */}
              <div className="flex justify-start">
                <div
                  className={`max-w-[92%] rounded-2xl rounded-tr-xs bg-[#D9FDD3] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] px-4 py-3 shadow-sm text-[13px] leading-6 transition-all ${
                    previewSampleFlash ? 'ring-2 ring-primary scale-[1.01]' : ''
                  }`}
                >
                  <div className="space-y-1 break-words">
                    {previewLines.map((line, i) =>
                      line.trim() === '' ? (
                        <div key={i} className="h-2" />
                      ) : (
                        <p key={i}>
                          {parseWhatsAppPreviewLine(line).map((seg, idx) =>
                            seg.type === 'bold' ? (
                              <strong key={idx} className="font-black">
                                {seg.value}
                              </strong>
                            ) : seg.type === 'link' ? (
                              <span key={idx} className="text-[#027EB5] dark:text-[#53BDEB] underline font-mono text-[11px] break-all" dir="ltr">
                                {seg.value}
                              </span>
                            ) : (
                              <span key={idx}>{seg.value}</span>
                            ),
                          )}
                        </p>
                      ),
                    )}
                  </div>
                  <div className="flex items-center justify-end gap-1 mt-1.5 text-[10px] text-[#667781] dark:text-[#8696A0]">
                    <span>07:32 م</span>
                    <CheckCheck className="w-3.5 h-3.5 text-[#53BDEB]" />
                  </div>
                </div>
              </div>

              <div className="mt-4 pt-2 text-[10px] text-[#667781] dark:text-[#8696A0] text-center">
                بيانات المعاينة: {sampleContext.patientName} • {sampleContext.branchName}
              </div>
            </div>
          </div>

          {/* QR Session Link Card */}
          <div className="yalla-card p-4 border border-border space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <QrCode className="w-4 h-4 text-primary" />
                <h3 className="text-xs font-black text-foreground">ربط جلسة واتساب الخاصة بالعيادة</h3>
              </div>
              {qrReady && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={handleLoadQr}
                  className="rounded-xl text-xs font-bold h-8"
                >
                  عرض رمز QR
                </Button>
              )}
            </div>
            {!qrReady && (
              <p className="text-xs text-muted-foreground">
                لم يتم تفعيل جلسة WP Sender مستقلة لهذه العيادة بعد. تواصل مع مدير المنصة لربط رقم العيادة.
              </p>
            )}
            {qrConnectedMsg && (
              <div className="rounded-xl bg-emerald-500/10 border border-emerald-500/25 px-3 py-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                {qrConnectedMsg}
              </div>
            )}
            {qrUrl && (
              <div className="flex flex-col items-center gap-2 p-3 rounded-xl bg-white border border-border">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={qrUrl} alt="WhatsApp Session QR" className="w-48 h-48 object-contain" />
                <span className="text-[11px] font-bold text-slate-600">افتح واتساب ← الأجهزة المرتبطة ← ربط جهاز</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 4. Recent Queue Jobs Table */}
      {recentJobs.length > 0 && (
        <div className="yalla-card p-5 border border-border space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground">أحدث حالات الإرسال لهذه العيادة</h3>
            <span className="text-[11px] text-muted-foreground">الحالات الفعلية من طابور الخادم</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border text-muted-foreground text-right">
                  <th className="py-2 px-2 font-bold">المريض</th>
                  <th className="py-2 px-2 font-bold">النوع</th>
                  <th className="py-2 px-2 font-bold">الحالة</th>
                  <th className="py-2 px-2 font-bold">ملاحظة</th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((j) => (
                  <tr key={j.id} className="border-b border-border/60 last:border-0">
                    <td className="py-2.5 px-2 font-bold text-foreground">{j.patientName || 'مريض'}</td>
                    <td className="py-2.5 px-2 text-muted-foreground">
                      {j.jobType === 'booking_confirmation'
                        ? 'تأكيد الحجز'
                        : j.jobType === 'appointment_reminder'
                        ? 'تذكير موعد'
                        : j.jobType === 'appointment_rescheduled'
                        ? 'تعديل موعد'
                        : j.jobType === 'appointment_cancelled'
                        ? 'إلغاء موعد'
                        : j.jobType === 'prescription_ready'
                        ? 'روشتة'
                        : 'فاتورة'}
                    </td>
                    <td className="py-2.5 px-2">
                      <WhatsAppDeliveryBadge
                        status={j.status}
                        lastError={j.lastError}
                        sentAt={j.sentAt}
                        deliveredAt={j.deliveredAt}
                        compact
                      />
                    </td>
                    <td className="py-2.5 px-2 text-[11px] text-muted-foreground">{j.lastError || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
