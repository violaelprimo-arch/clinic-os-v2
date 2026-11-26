'use client'

import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import {
  ShieldCheck,
  Sliders,
  RefreshCw,
  RotateCcw,
  Save,
  Eye,
  EyeOff,
  Play,
  AlertTriangle,
  Wifi,
  WifiOff,
  Building2,
} from 'lucide-react'
import {
  ALL_WHATSAPP_SUB_FEATURES,
  DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
  WHATSAPP_SUB_FEATURE_LABELS,
  type PlatformWhatsAppDefaults,
  type WhatsAppSubFeatureKey,
  type WhatsAppSubFeatureMode,
  type DocumentEditResendPolicy,
  type OwnerWhatsAppPolicyInput,
} from '@/lib/whatsapp-policy'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { WhatsAppDeliveryBadge } from '@/components/clinic/WhatsAppDeliveryBadge'

interface ClinicPolicyRow {
  clinicId: string
  slug: string
  clinicName: string
  rawPolicy: OwnerWhatsAppPolicyInput | null
  effectivePolicy: PlatformWhatsAppDefaults
  sessionStatus: string
  wpSender?: {
    configured: boolean
    mode: string
    senderNumber: string
    livePlatformEnabled: boolean
  }
}

export function OwnerWhatsAppGovernancePanel() {
  const [subTab, setSubTab] = useState<'platform' | 'clinics' | 'queue'>('platform')
  const [loading, setLoading] = useState(true)
  const [savingPlatform, setSavingPlatform] = useState(false)
  const [savingClinicId, setSavingClinicId] = useState<string | null>(null)

  const [platformDefaults, setPlatformDefaults] = useState<PlatformWhatsAppDefaults>(
    DEFAULT_PLATFORM_WHATSAPP_DEFAULTS,
  )
  const [clinicRows, setClinicRows] = useState<ClinicPolicyRow[]>([])
  const [selectedClinicId, setSelectedClinicId] = useState<string>('')
  const [clinicDraft, setClinicDraft] = useState<OwnerWhatsAppPolicyInput>({})

  const [logsLoading, setLogsLoading] = useState(false)
  const [jobs, setJobs] = useState<any[]>([])
  const [queueStats, setQueueStats] = useState<Record<string, number>>({})
  const [logStatusFilter, setLogStatusFilter] = useState<string>('')
  const [logClinicFilter, setLogClinicFilter] = useState<string>('')
  const [retryingJobId, setRetryingJobId] = useState<string | null>(null)
  const [draining, setDraining] = useState(false)

  const fetchGovernance = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/owner/whatsapp/policy', {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.platformDefaults) setPlatformDefaults(data.platformDefaults)
      if (Array.isArray(data.clinics)) {
        setClinicRows(data.clinics)
        if (!selectedClinicId && data.clinics.length > 0) {
          const first = data.clinics[0]
          setSelectedClinicId(first.clinicId)
          setClinicDraft(first.rawPolicy || {})
        }
      }
    } catch {
      toast.error('تعذر تحميل سياسات واتساب من الخادم')
    } finally {
      setLoading(false)
    }
  }

  const fetchLogs = async () => {
    setLogsLoading(true)
    try {
      const params = new URLSearchParams()
      if (logClinicFilter) params.set('clinicId', logClinicFilter)
      if (logStatusFilter) params.set('status', logStatusFilter)
      const res = await fetch(`/api/owner/whatsapp/logs?${params.toString()}`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (!res.ok) return
      const data = await res.json()
      if (data.stats) setQueueStats(data.stats)
      if (Array.isArray(data.jobs)) setJobs(data.jobs)
    } catch {
      toast.error('تعذر تحميل سجل طابور الرسائل')
    } finally {
      setLogsLoading(false)
    }
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void fetchGovernance()
  }, [])

  useEffect(() => {
    if (subTab === 'queue') {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      void fetchLogs()
    }
  }, [subTab, logClinicFilter, logStatusFilter])

  const selectedClinicRow = clinicRows.find((c) => c.clinicId === selectedClinicId) || null

  const handleSelectClinic = (cid: string) => {
    setSelectedClinicId(cid)
    const row = clinicRows.find((c) => c.clinicId === cid)
    setClinicDraft(row?.rawPolicy ? structuredClone(row.rawPolicy) : {})
  }

  const handleSavePlatformDefaults = async () => {
    setSavingPlatform(true)
    try {
      const res = await fetch('/api/owner/whatsapp/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ scope: 'platform', platformDefaults }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'تعذر حفظ سياسة المنصة')
        return
      }
      toast.success('تم تحديث السياسة الافتراضية للمنصة بنجاح')
      void fetchGovernance()
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setSavingPlatform(false)
    }
  }

  const handleSaveClinicPolicy = async () => {
    if (!selectedClinicId) return
    setSavingClinicId(selectedClinicId)
    try {
      const res = await fetch('/api/owner/whatsapp/policy', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ scope: 'clinic', clinicId: selectedClinicId, policy: clinicDraft }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        toast.error(data.error || 'تعذر حفظ صلاحيات العيادة')
        return
      }
      toast.success('تم حفظ صلاحيات وميزات واتساب لهذه العيادة')
      void fetchGovernance()
    } catch {
      toast.error('خطأ في الاتصال بالخادم')
    } finally {
      setSavingClinicId(null)
    }
  }

  const handleRetryJob = async (job: any) => {
    const isUncertain = job.status === 'uncertain' || job.uncertainOutcome === true
    if (isUncertain) {
      const confirmed = window.confirm(
        'هذه الرسالة انتهت بحالة غير مؤكدة من مزود الخدمة (احتمال وصولها وارد). هل أنت متأكد أنك تريد إعادة إرسالها؟',
      )
      if (!confirmed) return
    }
    setRetryingJobId(job.id)
    try {
      const res = await fetch('/api/owner/whatsapp/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({
          action: 'retry_job',
          jobId: job.id,
          allowUncertainRetry: isUncertain,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success('تمت إعادة إرسال الرسالة بنجاح')
      } else {
        toast.warning(`حالة التنفيذ: ${data.result?.reason || data.result?.outcome || 'لم تُرسل'}`)
      }
      void fetchLogs()
    } catch {
      toast.error('تعذر تنفيذ إعادة المحاولة')
    } finally {
      setRetryingJobId(null)
    }
  }

  const handleDrainQueue = async () => {
    setDraining(true)
    try {
      const res = await fetch('/api/owner/whatsapp/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'drain_due' }),
      })
      const data = await res.json().catch(() => ({}))
      toast.success(
        `تم فحص ${data.result?.processed || 0} رسالة (أُرسل: ${data.result?.sent || 0} • منتظر اتصال: ${data.result?.waiting || 0})`,
      )
      void fetchLogs()
    } catch {
      toast.error('تعذر تشغيل المعالج السحابي')
    } finally {
      setDraining(false)
    }
  }

  const handleRecheckClinicSession = async (clinicId: string) => {
    try {
      const res = await fetch('/api/owner/whatsapp/logs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ action: 'recheck_clinic', clinicId }),
      })
      const data = await res.json().catch(() => ({}))
      if (data.success) {
        toast.success(
          data.resumed?.requeued > 0
            ? `الجلسة متصلة وتم استئناف ${data.resumed.requeued} رسالة`
            : 'جلسة WP Sender متصلة',
        )
      } else {
        toast.warning('الجلسة غير متصلة حاليًا')
      }
      void fetchGovernance()
    } catch {
      toast.error('تعذر فحص حالة الجلسة')
    }
  }

  const setPlatformFeature = (
    key: WhatsAppSubFeatureKey,
    patch: Partial<{ visible: boolean; enabled: boolean; mode: WhatsAppSubFeatureMode }>,
  ) => {
    setPlatformDefaults((prev) => {
      const cur = prev.features[key]
      const next = { ...cur, ...patch }
      if (!next.visible) {
        next.enabled = false
        next.mode = 'disabled'
      } else if (!next.enabled) {
        next.mode = 'disabled'
      } else if (next.mode === 'disabled') {
        next.mode = 'auto'
      }
      return { ...prev, features: { ...prev.features, [key]: next } }
    })
  }

  const setClinicFeature = (
    key: WhatsAppSubFeatureKey,
    patch: Partial<{ visible: boolean; enabled: boolean; mode: WhatsAppSubFeatureMode }>,
  ) => {
    setClinicDraft((prev) => {
      const base = platformDefaults.features[key]
      const cur = prev.features?.[key] || base
      const next = {
        visible: cur.visible ?? base.visible,
        enabled: cur.enabled ?? base.enabled,
        mode: cur.mode ?? base.mode,
        ...patch,
      }
      if (!next.visible) {
        next.enabled = false
        next.mode = 'disabled'
      } else if (!next.enabled) {
        next.mode = 'disabled'
      } else if (next.mode === 'disabled') {
        next.mode = key === 'prescription' || key === 'invoice' ? 'manual' : 'auto'
      }
      return {
        ...prev,
        features: {
          ...(prev.features || {}),
          [key]: next,
        },
      }
    })
  }

  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-5 text-slate-100">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-black text-white">حوكمة وصلاحيات واتساب + مراقب الطابور السحابي</h3>
            <p className="text-xs text-slate-400">
              تحكم مركزي على مستوى المنصة ولكل عيادة دون حذف نصوص القوالب، مع متابعة الطابور وإعادة المحاولة.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setSubTab('platform')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'platform'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Sliders className="w-3.5 h-3.5 inline ml-1" />
            سياسة المنصة
          </button>
          <button
            type="button"
            onClick={() => setSubTab('clinics')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'clinics'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <Building2 className="w-3.5 h-3.5 inline ml-1" />
            تحكم كل عيادة
          </button>
          <button
            type="button"
            onClick={() => setSubTab('queue')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              subTab === 'queue'
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
            }`}
          >
            <RefreshCw className="w-3.5 h-3.5 inline ml-1" />
            الطابور السحابي وسجل الإرسال
          </button>
        </div>
      </div>

      {/* SubTab 1: Platform Defaults */}
      {subTab === 'platform' && (
        <div className="space-y-4">
          <div className="grid sm:grid-cols-2 gap-3">
            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <p className="text-xs font-black text-white">إظهار قسم واتساب افتراضيًا في العيادات</p>
                <p className="text-[11px] text-slate-400">عند الإخفاء يختفي القسم والأزرار للدكتور والسكرتيرة ويُرفض الوصول API</p>
              </div>
              <Switch
                checked={platformDefaults.sectionVisible}
                onCheckedChange={(checked) => setPlatformDefaults((p) => ({ ...p, sectionVisible: checked }))}
              />
            </div>

            <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
              <div>
                <p className="text-xs font-black text-white">تشغيل خدمة الإرسال على مستوى المنصة</p>
                <p className="text-[11px] text-slate-400">إيقاف مؤقت آمن بدون حذف أي قوالب أو إعدادات للعيادات</p>
              </div>
              <Switch
                checked={platformDefaults.serviceEnabled}
                onCheckedChange={(checked) => setPlatformDefaults((p) => ({ ...p, serviceEnabled: checked }))}
              />
            </div>
          </div>

          <div className="grid md:grid-cols-2 gap-3">
            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <p className="text-xs font-black text-white">سياسة إعادة الإرسال عند تعديل الروشتة</p>
              <select
                value={platformDefaults.prescriptionResendOnEdit}
                onChange={(e) =>
                  setPlatformDefaults((p) => ({
                    ...p,
                    prescriptionResendOnEdit: e.target.value as DocumentEditResendPolicy,
                  }))
                }
                className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
              >
                <option value="none">إرسال أول نسخة معتمدة فقط (منع التكرار عند التعديل)</option>
                <option value="new_version">إرسال نسخة جديدة عند تغيّر محتوى الروشتة فعليًا</option>
              </select>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-950/60 border border-slate-800 space-y-2">
              <p className="text-xs font-black text-white">سياسة إعادة الإرسال عند تعديل الفاتورة</p>
              <select
                value={platformDefaults.invoiceResendOnEdit}
                onChange={(e) =>
                  setPlatformDefaults((p) => ({
                    ...p,
                    invoiceResendOnEdit: e.target.value as DocumentEditResendPolicy,
                  }))
                }
                className="w-full h-9 px-3 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
              >
                <option value="none">إرسال عند إصدار الفاتورة أول مرة فقط</option>
                <option value="new_version">إرسال نسخة محدثة عند تعديل بيانات الفاتورة</option>
              </select>
            </div>
          </div>

          <div className="space-y-2.5">
            {ALL_WHATSAPP_SUB_FEATURES.map((key) => {
              const feat = platformDefaults.features[key]
              const info = WHATSAPP_SUB_FEATURE_LABELS[key]
              return (
                <div
                  key={key}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3.5 rounded-xl bg-slate-950/60 border border-slate-800"
                >
                  <div>
                    <p className="text-xs font-black text-white">{info.titleAr}</p>
                    <p className="text-[11px] text-slate-400">{info.descAr}</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <label className="flex items-center gap-1.5 text-[11px] text-slate-300 cursor-pointer">
                      <Switch
                        checked={feat.visible}
                        onCheckedChange={(v) => setPlatformFeature(key, { visible: v })}
                      />
                      <span>{feat.visible ? 'ظاهرة' : 'مخفية'}</span>
                    </label>
                    <select
                      value={feat.mode}
                      disabled={!feat.visible}
                      onChange={(e) => {
                        const m = e.target.value as WhatsAppSubFeatureMode
                        setPlatformFeature(key, { enabled: m !== 'disabled', mode: m })
                      }}
                      className="h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 disabled:opacity-40"
                    >
                      <option value="auto">إرسال تلقائي</option>
                      <option value="manual">إرسال يدوي فقط</option>
                      <option value="disabled">معطّلة</option>
                    </select>
                  </div>
                </div>
              )
            })}
          </div>

          <div className="flex justify-end">
            <Button
              type="button"
              onClick={handleSavePlatformDefaults}
              disabled={savingPlatform || loading}
              className="rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              <Save className="w-3.5 h-3.5 ml-1.5" />
              {savingPlatform ? 'جاري الحفظ...' : 'حفظ سياسة المنصة الافتراضية'}
            </Button>
          </div>
        </div>
      )}

      {/* SubTab 2: Per-Clinic Feature Controls */}
      {subTab === 'clinics' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <select
              value={selectedClinicId}
              onChange={(e) => handleSelectClinic(e.target.value)}
              className="h-10 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs font-bold text-slate-100 max-w-sm"
            >
              {clinicRows.map((c) => (
                <option key={c.clinicId} value={c.clinicId}>
                  {c.clinicName} ({c.slug})
                </option>
              ))}
            </select>

            {selectedClinicRow && (
              <div className="flex flex-wrap items-center gap-2">
                <Badge className="bg-slate-800 text-slate-200 border-slate-700 text-[11px]">
                  وضع WP Sender: {selectedClinicRow.wpSender?.mode || 'off'}
                </Badge>
                {selectedClinicRow.sessionStatus === 'disconnected' ? (
                  <Badge className="bg-amber-500/15 text-amber-300 border-amber-500/30 text-[11px]">
                    <WifiOff className="w-3 h-3 ml-1" /> غير متصل
                  </Badge>
                ) : (
                  <Badge className="bg-emerald-500/15 text-emerald-300 border-emerald-500/30 text-[11px]">
                    <Wifi className="w-3 h-3 ml-1" /> {selectedClinicRow.sessionStatus || 'جاهز'}
                  </Badge>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => handleRecheckClinicSession(selectedClinicRow.clinicId)}
                  className="h-8 text-[11px] rounded-lg"
                >
                  <RefreshCw className="w-3 h-3 ml-1" />
                  فحص واستئناف
                </Button>
              </div>
            )}
          </div>

          {selectedClinicRow && (
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div>
                    <p className="text-xs font-black text-white">إظهار قسم واتساب لهذه العيادة</p>
                    <p className="text-[11px] text-slate-400">يخفي التبويب والأزرار ويحظر الـ API فورًا للدكتور والسكرتيرة</p>
                  </div>
                  <Switch
                    checked={clinicDraft.sectionVisible ?? platformDefaults.sectionVisible}
                    onCheckedChange={(v) => setClinicDraft((d) => ({ ...d, sectionVisible: v }))}
                  />
                </div>
                <div className="flex items-center justify-between p-3.5 rounded-xl bg-slate-950/60 border border-slate-800">
                  <div>
                    <p className="text-xs font-black text-white">تفعيل خدمة الإرسال للعيادة</p>
                    <p className="text-[11px] text-slate-400">يمكن التعطيل بدون مسح أي نصوص أو إعدادات</p>
                  </div>
                  <Switch
                    checked={clinicDraft.serviceEnabled ?? platformDefaults.serviceEnabled}
                    onCheckedChange={(v) => setClinicDraft((d) => ({ ...d, serviceEnabled: v }))}
                  />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <p className="text-xs font-bold text-slate-200">سياسة تعديل الروشتة</p>
                  <select
                    value={clinicDraft.prescriptionResendOnEdit || platformDefaults.prescriptionResendOnEdit}
                    onChange={(e) =>
                      setClinicDraft((d) => ({
                        ...d,
                        prescriptionResendOnEdit: e.target.value as DocumentEditResendPolicy,
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                  >
                    <option value="none">إرسال النسخة الأولى فقط</option>
                    <option value="new_version">إرسال نسخة جديدة عند التعديل</option>
                  </select>
                </div>
                <div className="p-3 rounded-xl bg-slate-950/60 border border-slate-800 space-y-1.5">
                  <p className="text-xs font-bold text-slate-200">سياسة تعديل الفاتورة</p>
                  <select
                    value={clinicDraft.invoiceResendOnEdit || platformDefaults.invoiceResendOnEdit}
                    onChange={(e) =>
                      setClinicDraft((d) => ({
                        ...d,
                        invoiceResendOnEdit: e.target.value as DocumentEditResendPolicy,
                      }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100"
                  >
                    <option value="none">إرسال عند الإنشاء فقط</option>
                    <option value="new_version">إرسال نسخة جديدة عند التعديل</option>
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                {ALL_WHATSAPP_SUB_FEATURES.map((key) => {
                  const base = platformDefaults.features[key]
                  const ov = clinicDraft.features?.[key]
                  const vis = ov?.visible ?? base.visible
                  const mod = (ov?.mode ?? base.mode) as WhatsAppSubFeatureMode
                  const info = WHATSAPP_SUB_FEATURE_LABELS[key]
                  return (
                    <div
                      key={key}
                      className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 rounded-xl bg-slate-950/60 border border-slate-800"
                    >
                      <span className="text-xs font-bold text-white">{info.titleAr}</span>
                      <div className="flex items-center gap-3">
                        <button
                          type="button"
                          onClick={() => setClinicFeature(key, { visible: !vis })}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                            vis ? 'bg-slate-800 text-slate-200' : 'bg-rose-500/15 text-rose-300'
                          }`}
                        >
                          {vis ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                          {vis ? 'ظاهرة' : 'مخفية'}
                        </button>
                        <select
                          value={vis ? mod : 'disabled'}
                          disabled={!vis}
                          onChange={(e) => {
                            const nextMode = e.target.value as WhatsAppSubFeatureMode
                            setClinicFeature(key, { enabled: nextMode !== 'disabled', mode: nextMode })
                          }}
                          className="h-8 px-2.5 rounded-lg bg-slate-900 border border-slate-700 text-xs text-slate-100 disabled:opacity-40"
                        >
                          <option value="auto">تلقائي</option>
                          <option value="manual">يدوي</option>
                          <option value="disabled">معطّلة</option>
                        </select>
                      </div>
                    </div>
                  )
                })}
              </div>

              <div className="flex justify-end gap-2">
                <Button
                  type="button"
                  onClick={handleSaveClinicPolicy}
                  disabled={savingClinicId === selectedClinicId}
                  className="rounded-xl text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white"
                >
                  <Save className="w-3.5 h-3.5 ml-1.5" />
                  {savingClinicId === selectedClinicId ? 'جاري الحفظ...' : 'اعتماد صلاحيات العيادة'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SubTab 3: Cloud Queue & Retry Monitor */}
      {subTab === 'queue' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={logClinicFilter}
                onChange={(e) => setLogClinicFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                <option value="">كل العيادات</option>
                {clinicRows.map((c) => (
                  <option key={c.clinicId} value={c.clinicId}>
                    {c.clinicName}
                  </option>
                ))}
              </select>

              <select
                value={logStatusFilter}
                onChange={(e) => setLogStatusFilter(e.target.value)}
                className="h-9 px-3 rounded-xl bg-slate-950 border border-slate-700 text-xs text-slate-100"
              >
                <option value="">كل الحالات ({queueStats.total || 0})</option>
                <option value="queued">في الانتظار ({queueStats.queued || 0})</option>
                <option value="waiting_for_connection">بانتظار الاتصال ({queueStats.waiting_for_connection || 0})</option>
                <option value="sent">مُرسل للمزود ({queueStats.sent || 0})</option>
                <option value="delivered">تم التسليم المؤكد ({queueStats.delivered || 0})</option>
                <option value="failed">فشل ({queueStats.failed || 0})</option>
                <option value="uncertain">غير مؤكد ({queueStats.uncertain || 0})</option>
                <option value="cancelled">ملغي ({queueStats.cancelled || 0})</option>
                <option value="expired">منتهي ({queueStats.expired || 0})</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={fetchLogs}
                disabled={logsLoading}
                className="h-9 text-xs rounded-xl"
              >
                <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${logsLoading ? 'animate-spin' : ''}`} />
                تحديث السجل
              </Button>
              <Button
                type="button"
                size="sm"
                onClick={handleDrainQueue}
                disabled={draining}
                className="h-9 text-xs font-black rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <Play className="w-3.5 h-3.5 ml-1.5" />
                {draining ? 'جاري التشغيل...' : 'تشغيل الطابور الآن'}
              </Button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950/60">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 text-right">
                  <th className="py-2.5 px-3 font-bold">العيادة</th>
                  <th className="py-2.5 px-3 font-bold">المريض</th>
                  <th className="py-2.5 px-3 font-bold">النوع</th>
                  <th className="py-2.5 px-3 font-bold">الحالة</th>
                  <th className="py-2.5 px-3 font-bold">السبب / المعرف</th>
                  <th className="py-2.5 px-3 font-bold">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {jobs.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-400">
                      لا توجد سجلات مطابقة في الطابور السحابي
                    </td>
                  </tr>
                ) : (
                  jobs.map((j) => {
                    const retryable = ['failed', 'waiting_for_connection', 'queued', 'pending', 'uncertain'].includes(
                      j.status,
                    )
                    return (
                      <tr key={j.id} className="border-b border-slate-800/70 last:border-0">
                        <td className="py-2.5 px-3 font-bold text-slate-200">{j.clinicName || j.clinicId}</td>
                        <td className="py-2.5 px-3 text-slate-300">
                          {j.patientName} <span className="text-[10px] text-slate-400 font-mono" dir="ltr">{j.patientPhone}</span>
                        </td>
                        <td className="py-2.5 px-3 text-slate-300">{j.jobType}</td>
                        <td className="py-2.5 px-3">
                          <WhatsAppDeliveryBadge
                            status={j.status}
                            lastError={j.lastError}
                            sentAt={j.sentAt}
                            deliveredAt={j.deliveredAt}
                            compact
                          />
                        </td>
                        <td className="py-2.5 px-3 text-[11px] text-slate-400 font-mono">
                          {j.lastError || j.cancelledReason || j.providerMessageId || '—'}
                        </td>
                        <td className="py-2.5 px-3">
                          {retryable ? (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={retryingJobId === j.id}
                              onClick={() => handleRetryJob(j)}
                              className="h-7 px-2.5 text-[11px] rounded-lg"
                            >
                              {j.status === 'uncertain' && <AlertTriangle className="w-3 h-3 ml-1 text-amber-400" />}
                              <RotateCcw className="w-3 h-3 ml-1" />
                              إعادة
                            </Button>
                          ) : (
                            <span className="text-[11px] text-slate-500">—</span>
                          )}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
