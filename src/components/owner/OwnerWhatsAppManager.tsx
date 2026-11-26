'use client'

import { useState, useEffect, useMemo } from 'react'
import {
  MessageSquare,
  Link2,
  RefreshCw,
  Unlink,
  Settings,
  Send,
  CheckCircle2,
  AlertTriangle,
  Clock,
  XCircle,
  HelpCircle,
  Phone,
  Search,
  ExternalLink,
  Plus,
  Trash2,
  DollarSign,
  TrendingUp,
  Check,
  ShieldCheck,
  Radio
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
  DialogFooter
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { type ClinicWhatsAppSettings, type ClinicWhatsAppReminderRule } from '@/lib/server/whatsapp-scheduler'
import { OwnerWhatsAppGovernancePanel } from './OwnerWhatsAppGovernancePanel'

export interface ClinicWhatsAppItem {
  id: string
  name: string
  doctorName: string
  slug: string
  phone: string
  whatsapp: {
    wpSenderMode?: 'off' | 'mock' | 'live' | null
    status: 'not_linked' | 'linking' | 'connected' | 'disconnected' | 'error'
    phoneNumber: string | null
    phoneNumberId: string | null
    wabaId: string | null
    businessName: string | null
    linkedAt: string | null
    lastSyncAt: string | null
    lastError: string | null
    stats: {
      sentCount: number
      deliveredCount: number
      readCount: number
      failedCount: number
      totalCostEstimate: number
    }
    monthlyUsage: number
    settings: ClinicWhatsAppSettings
  }
}

export function OwnerWhatsAppManager() {
  const [activeTab, setActiveTab] = useState<'governance' | 'channels'>('governance')
  const [clinics, setClinics] = useState<ClinicWhatsAppItem[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'linking' | 'not_linked' | 'error'>('all')

  // Selected clinic for settings modal
  const [settingsClinic, setSettingsClinic] = useState<ClinicWhatsAppItem | null>(null)
  const [editSettings, setEditSettings] = useState<any | null>(null)
  const [savingSettings, setSavingSettings] = useState(false)

  // Selected clinic for test message modal
  const [testClinic, setTestClinic] = useState<ClinicWhatsAppItem | null>(null)
  const [testPhone, setTestPhone] = useState('')
  const [sendingTest, setSendingTest] = useState(false)

  // Selected clinic for unlink confirmation
  const [unlinkClinic, setUnlinkClinic] = useState<ClinicWhatsAppItem | null>(null)
  const [unlinking, setUnlinking] = useState(false)

  // Action loading states by clinic id
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  // Fetch clinics
  const fetchClinics = async () => {
    try {
      setLoading(true)
      const res = await fetch('/api/owner/whatsapp/clinics', {
        headers: { 'Cache-Control': 'no-store' }
      })
      if (!res.ok) throw new Error('فشل تحميل بيانات واتساب العيادات')
      const data = await res.json()
      setClinics(data.clinics || [])
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء تحميل البيانات')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchClinics()
  }, [])

  // Start Onboarding Link
  const handleLinkNumber = async (clinic: ClinicWhatsAppItem) => {
    setActionLoading((prev) => ({ ...prev, [clinic.id]: true }))
    try {
      const res = await fetch('/api/owner/whatsapp/link', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: clinic.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل توليد رابط الربط')

      toast.success('تم إنشاء رابط الربط بنجاح، جاري فتح نافذة Meta Onboarding...')
      if (data.url) {
        window.open(data.url, '_blank', 'noopener,noreferrer,width=800,height=700')
      }
      fetchClinics()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إنشاء الرابط')
    } finally {
      setActionLoading((prev) => ({ ...prev, [clinic.id]: false }))
    }
  }

  // Sync status
  const handleSyncStatus = async (clinic: ClinicWhatsAppItem) => {
    setActionLoading((prev) => ({ ...prev, [clinic.id]: true }))
    try {
      const res = await fetch('/api/owner/whatsapp/sync-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: clinic.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل فحص الحالة')

      if (data.status === 'connected') {
        toast.success(`تم تأكيد اتصال الرقم: ${data.phoneNumber || ''}`)
      } else {
        toast.info(data.message || `حالة الحساب الحالية: ${data.status}`)
      }
      fetchClinics()
    } catch (err: any) {
      toast.error(err.message || 'تعذر التحقق من الحالة')
    } finally {
      setActionLoading((prev) => ({ ...prev, [clinic.id]: false }))
    }
  }

  // Unlink clinic
  const handleConfirmUnlink = async () => {
    if (!unlinkClinic) return
    setUnlinking(true)
    try {
      const res = await fetch('/api/owner/whatsapp/unlink', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ clinicId: unlinkClinic.id })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل إلغاء الربط')

      toast.success('تم إلغاء ربط رقم واتساب للعيادة بنجاح')
      setUnlinkClinic(null)
      fetchClinics()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إلغاء الربط')
    } finally {
      setUnlinking(false)
    }
  }

  // Open settings modal
  const handleOpenSettings = (clinic: ClinicWhatsAppItem) => {
    setSettingsClinic(clinic)
    setEditSettings(JSON.parse(JSON.stringify(clinic.whatsapp.settings)))
  }

  // Save settings
  const handleSaveSettings = async () => {
    if (!settingsClinic || !editSettings) return
    setSavingSettings(true)
    try {
      const res = await fetch('/api/owner/whatsapp/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: settingsClinic.id,
          settings: editSettings
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل حفظ الإعدادات')

      toast.success('تم حفظ إعدادات تذكيرات العيادة بنجاح')
      setSettingsClinic(null)
      fetchClinics()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء حفظ الإعدادات')
    } finally {
      setSavingSettings(false)
    }
  }

  // Add reminder rule
  const handleAddReminderRule = () => {
    if (!editSettings) return
    if (editSettings.reminders.length >= 5) {
      toast.error('الحد الأقصى هو 5 تذكيرات لكل عيادة')
      return
    }
    const newRule: any = {
      id: `rem-${Date.now()}`,
      value: 1,
      unit: 'hour'
    }
    setEditSettings({
      ...editSettings,
      reminders: [...editSettings.reminders, newRule]
    })
  }

  // Remove reminder rule
  const handleRemoveReminderRule = (id: string) => {
    if (!editSettings) return
    setEditSettings({
      ...editSettings,
      reminders: editSettings.reminders.filter((r: any) => r.id !== id)
    })
  }

  // Update reminder rule
  const handleUpdateReminderRule = (id: string, field: 'value' | 'unit', val: any) => {
    if (!editSettings) return
    setEditSettings({
      ...editSettings,
      reminders: editSettings.reminders.map((r: any) => {
        if (r.id === id) {
          return { ...r, [field]: field === 'value' ? Math.max(1, Number(val) || 1) : val }
        }
        return r
      })
    })
  }

  // Send Test Message
  const handleSendTestMessage = async () => {
    if (!testClinic || !testPhone.trim()) return
    setSendingTest(true)
    try {
      const res = await fetch('/api/owner/whatsapp/test-message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          clinicId: testClinic.id,
          testPhone: testPhone.trim()
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'فشل إرسال رسالة الاختبار')

      toast.success(data.status === 'mock_sent' ? 'نجحت محاكاة الإرسال' : data.status === 'accepted'
        ? 'تم قبول رسالة الاختبار للإرسال' : `تم إرسال رسالة الاختبار إلى ${data.recipient || testPhone}`)
      setTestClinic(null)
      setTestPhone('')
      fetchClinics()
    } catch (err: any) {
      toast.error(err.message || 'حدث خطأ أثناء إرسال الرسالة التجريبية')
    } finally {
      setSendingTest(false)
    }
  }

  // Filtered clinics
  const filteredClinics = useMemo(() => {
    return clinics.filter((c) => {
      const q = searchQuery.toLowerCase().trim()
      const matchesSearch =
        !q ||
        c.name.toLowerCase().includes(q) ||
        c.doctorName.toLowerCase().includes(q) ||
        c.slug.toLowerCase().includes(q) ||
        c.phone.includes(q) ||
        (c.whatsapp.phoneNumber && c.whatsapp.phoneNumber.includes(q))

      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'connected' && c.whatsapp.status === 'connected') ||
        (statusFilter === 'linking' && c.whatsapp.status === 'linking') ||
        (statusFilter === 'not_linked' && c.whatsapp.status === 'not_linked') ||
        (statusFilter === 'error' && (c.whatsapp.status === 'error' || c.whatsapp.status === 'disconnected'))

      return matchesSearch && matchesStatus
    })
  }, [clinics, searchQuery, statusFilter])

  // Overview Statistics
  const stats = useMemo(() => {
    let connectedCount = 0
    let totalSent = 0
    let totalDelivered = 0
    let totalCost = 0

    for (const c of clinics) {
      if (c.whatsapp.status === 'connected') connectedCount++
      totalSent += c.whatsapp.stats.sentCount
      totalDelivered += c.whatsapp.stats.deliveredCount
      totalCost += c.whatsapp.stats.totalCostEstimate
    }

    const deliveryRate = totalSent > 0 ? Math.round((totalDelivered / totalSent) * 100) : 100

    return {
      connectedCount,
      totalSent,
      deliveryRate,
      totalCost: totalCost.toFixed(3)
    }
  }, [clinics])

  return (
    <div className="space-y-6 rounded-2xl bg-slate-950 p-4 text-slate-100 text-right [&_input]:text-slate-100! [&_input]:bg-slate-900! [&_input]:placeholder:text-slate-400 [&_button[data-variant=outline]]:bg-slate-800! [&_button[data-variant=outline]]:text-slate-100!" dir="rtl">
      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-emerald-500/20 bg-gradient-to-l from-emerald-950/20 via-slate-900/60 to-slate-950/80 p-6 backdrop-blur">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2.5">
              <div className="flex size-10 items-center justify-center rounded-xl bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                <MessageSquare className="size-5" />
              </div>
              <div>
                <h2 className="text-xl font-black text-slate-100 flex items-center gap-2">
                  إدارة واتساب العيادات
                  <Badge variant="outline" className="border-emerald-500/30 text-emerald-400 bg-emerald-500/10 text-xs">
                    WhatsApp
                  </Badge>
                </h2>
                <p className="text-xs text-slate-400">
                  ربط أرقام واتساب الخاصة بالدكاترة (WhatsApp Business Coexistence) وإرسال التذكيرات التلقائية
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={fetchClinics}
              disabled={loading}
              className="gap-2 border-slate-700 hover:bg-slate-800"
            >
              <RefreshCw className={`size-3.5 ${loading ? 'animate-spin' : ''}`} />
              تحديث القائمة
            </Button>
          </div>
        </div>

        {/* Quick Stats Grid */}
        <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>القنوات المرتبطة</span>
              <Radio className="size-4 text-emerald-400" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-2xl font-black text-slate-100">{stats.connectedCount}</span>
              <span className="text-xs text-slate-300">/ 20 قناة متاحة</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>الرسائل المرسلة</span>
              <Send className="size-4 text-blue-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-slate-100">{stats.totalSent}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>نسبة التسليم</span>
              <CheckCircle2 className="size-4 text-teal-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-teal-400">%{stats.deliveryRate}</span>
            </div>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-3.5">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <span>إجمالي التكلفة</span>
              <DollarSign className="size-4 text-amber-400" />
            </div>
            <div className="mt-2">
              <span className="text-2xl font-black text-amber-400">${stats.totalCost}</span>
            </div>
          </div>
        </div>
      </div>

      {/* View Switcher: Governance & Queue vs Channels */}
      <div className="flex flex-wrap items-center gap-2 border-b border-slate-800 pb-3">
        <Button
          type="button"
          variant={activeTab === 'governance' ? 'default' : 'outline'}
          onClick={() => setActiveTab('governance')}
          className={`gap-2 text-xs font-bold ${
            activeTab === 'governance'
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'border-slate-800 text-slate-300 hover:bg-slate-900'
          }`}
        >
          <ShieldCheck className="size-4 text-emerald-300" />
          حوكمة الميزات والسياسات وطابور السحابة
        </Button>
        <Button
          type="button"
          variant={activeTab === 'channels' ? 'default' : 'outline'}
          onClick={() => setActiveTab('channels')}
          className={`gap-2 text-xs font-bold ${
            activeTab === 'channels'
              ? 'bg-emerald-600 text-white hover:bg-emerald-500'
              : 'border-slate-800 text-slate-300 hover:bg-slate-900'
          }`}
        >
          <Radio className="size-4 text-teal-300" />
          قنوات العيادات وأرقام WP Sender ({clinics.length})
        </Button>
      </div>

      {activeTab === 'governance' && (
        <OwnerWhatsAppGovernancePanel />
      )}

      {activeTab === 'channels' && (
        <>
          {/* Filters and Search Bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            placeholder="بحث باسم العيادة، الدكتور، الرابط، أو الرقم..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-9 bg-slate-900/60 border-slate-800 text-sm"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
          <Button
            size="sm"
            variant={statusFilter === 'all' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('all')}
            className="text-xs h-8"
          >
            الكل ({clinics.length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'connected' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('connected')}
            className="text-xs h-8 text-emerald-400 border-emerald-500/30"
          >
            مرتبط ({clinics.filter((c) => c.whatsapp.status === 'connected').length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'linking' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('linking')}
            className="text-xs h-8 text-blue-400 border-blue-500/30"
          >
            جاري الربط ({clinics.filter((c) => c.whatsapp.status === 'linking').length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'not_linked' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('not_linked')}
            className="text-xs h-8 text-slate-400"
          >
            غير مرتبط ({clinics.filter((c) => c.whatsapp.status === 'not_linked').length})
          </Button>
          <Button
            size="sm"
            variant={statusFilter === 'error' ? 'default' : 'outline'}
            onClick={() => setStatusFilter('error')}
            className="text-xs h-8 text-rose-400 border-rose-500/30"
          >
            أخطاء ({clinics.filter((c) => c.whatsapp.status === 'error' || c.whatsapp.status === 'disconnected').length})
          </Button>
        </div>
      </div>

      {/* Clinics List */}
      {loading ? (
        <div className="flex flex-col items-center justify-center p-12 text-slate-400 space-y-3">
          <RefreshCw className="size-8 animate-spin text-emerald-400" />
          <p className="text-sm">جاري جلب بيانات قنوات واتساب العيادات...</p>
        </div>
      ) : filteredClinics.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-800 p-12 text-center">
          <MessageSquare className="size-10 text-slate-600 mb-3" />
          <p className="text-base font-bold text-slate-300">لم يتم العثور على أي عيادات تطابق البحث</p>
          <p className="text-xs text-slate-300 mt-1">جرب تغيير كلمات البحث أو تصفية الحالة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredClinics.map((clinic) => {
            const wpSenderMode = clinic.whatsapp.wpSenderMode
            const isConnected = clinic.whatsapp.status === 'connected'
            const isLinking = clinic.whatsapp.status === 'linking'
            const isError = clinic.whatsapp.status === 'error' || clinic.whatsapp.status === 'disconnected'
            const isNotLinked = clinic.whatsapp.status === 'not_linked'

            return (
              <div
                key={clinic.id}
                className="group relative flex flex-col justify-between gap-4 rounded-xl border border-slate-800 bg-slate-900/60 p-5 transition-all hover:border-slate-700 hover:bg-slate-900/80 md:flex-row md:items-center"
              >
                {/* Clinic Info & Status */}
                <div className="space-y-2 flex-1 min-w-0">
                  <div className="flex items-center gap-3">
                    <h3 className="text-base font-black text-slate-100 truncate">{clinic.name}</h3>
                    <Badge variant="secondary" className="text-xs font-normal">
                      د. {clinic.doctorName}
                    </Badge>
                    <span className="text-xs text-slate-300 font-mono">/{clinic.slug}</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    {/* Status Pill */}
                    {wpSenderMode && (
                      <Badge variant="secondary">WP Sender · {wpSenderMode === 'mock' ? 'محاكاة' : wpSenderMode === 'live' ? 'الإرسال مفعّل' : 'الإرسال متوقف'}</Badge>
                    )}
                    {isConnected && !wpSenderMode && (
                      <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 gap-1.5 py-0.5">
                        <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse" />
                        مرتبط بنجاح
                      </Badge>
                    )}
                    {isLinking && (
                      <Badge className="bg-blue-500/10 text-blue-400 border border-blue-500/30 gap-1.5 py-0.5">
                        <span className="size-1.5 rounded-full bg-blue-400 animate-pulse" />
                        جاري الربط (في انتظار الموافقة)
                      </Badge>
                    )}
                    {isError && (
                      <Badge className="bg-rose-500/10 text-rose-400 border border-rose-500/30 gap-1.5 py-0.5">
                        <AlertTriangle className="size-3" />
                        غير متصل / يحتاج إعادة ربط
                      </Badge>
                    )}
                    {isNotLinked && !wpSenderMode && (
                      <Badge className="bg-slate-800 text-slate-400 border border-slate-700 py-0.5">
                        غير مرتبط
                      </Badge>
                    )}

                    {/* Linked Phone Number */}
                    {clinic.whatsapp.phoneNumber ? (
                      <span className="flex items-center gap-1 font-mono text-emerald-400 bg-emerald-950/40 px-2.5 py-0.5 rounded-md border border-emerald-900/40">
                        <Phone className="size-3" />
                        {clinic.whatsapp.phoneNumber}
                      </span>
                    ) : (
                      <span className="text-slate-300">لا يوجد رقم مرتبط</span>
                    )}

                    {/* WABA ID */}
                    {clinic.whatsapp.wabaId && (
                      <span className="text-slate-300 font-mono text-[11px]">
                        WABA: {clinic.whatsapp.wabaId}
                      </span>
                    )}
                  </div>

                  {/* Stats Mini Row */}
                  <div className="flex flex-wrap items-center gap-4 text-xs text-slate-400 pt-1">
                    <span>إرسال: <strong className="text-slate-200">{clinic.whatsapp.stats.sentCount}</strong></span>
                    <span>تسليم: <strong className="text-teal-400">{clinic.whatsapp.stats.deliveredCount}</strong></span>
                    <span>فشل: <strong className="text-rose-400">{clinic.whatsapp.stats.failedCount}</strong></span>
                    <span>التكلفة التقديرية: <strong className="text-amber-400">${clinic.whatsapp.stats.totalCostEstimate.toFixed(3)}</strong></span>
                    <span>الاستهلاك الشهري: <strong className="text-slate-200">{clinic.whatsapp.monthlyUsage} / {clinic.whatsapp.settings.monthlyLimit}</strong></span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap items-center gap-2 pt-2 md:pt-0">
                  {/* Link / Onboard button */}
                  {isNotLinked && !wpSenderMode && (
                    <Button
                      size="sm"
                      onClick={() => handleLinkNumber(clinic)}
                      disabled={actionLoading[clinic.id]}
                      className="bg-emerald-600 hover:bg-emerald-500 text-white gap-1.5 font-bold text-xs"
                    >
                      <Link2 className="size-3.5" />
                      ربط رقم واتساب
                    </Button>
                  )}

                  {isLinking && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleLinkNumber(clinic)}
                        disabled={actionLoading[clinic.id]}
                        className="bg-blue-600 hover:bg-blue-500 text-white gap-1.5 font-bold text-xs"
                      >
                        <ExternalLink className="size-3.5" />
                        استكمال الربط
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncStatus(clinic)}
                        disabled={actionLoading[clinic.id]}
                        className="border-slate-700 hover:bg-slate-800 text-xs gap-1"
                      >
                        <RefreshCw className="size-3.5" />
                        تحديث
                      </Button>
                    </>
                  )}

                  {(isConnected || wpSenderMode === 'off') && (
                    <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleOpenSettings(clinic)}
                        className="border-slate-700 hover:bg-slate-800 text-xs gap-1.5"
                      >
                        <Settings className="size-3.5 text-slate-400" />
                        إعدادات التذكيرات
                      </Button>

                      {isConnected && <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTestClinic(clinic)
                          setTestPhone(clinic.phone || '')
                        }}
                        className="border-slate-700 hover:bg-slate-800 text-xs gap-1.5 text-blue-400 hover:text-blue-300"
                      >
                        <Send className="size-3.5" />
                        رسالة اختبار
                      </Button>}

                      {!wpSenderMode && <>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleSyncStatus(clinic)}
                        disabled={actionLoading[clinic.id]}
                        title="مزامنة وتحديث حالة الرقم مع YCloud"
                        className="border-slate-700 hover:bg-slate-800 text-xs px-2"
                      >
                        <RefreshCw className={`size-3.5 ${actionLoading[clinic.id] ? 'animate-spin' : ''}`} />
                      </Button>

                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setUnlinkClinic(clinic)}
                        className="text-rose-400 hover:bg-rose-950/30 hover:text-rose-300 text-xs px-2"
                        title="إلغاء ربط رقم واتساب"
                      >
                        <Unlink className="size-3.5" />
                      </Button>
                      </>}
                    </>
                  )}

                  {isError && (
                    <>
                      <Button
                        size="sm"
                        onClick={() => handleLinkNumber(clinic)}
                        disabled={actionLoading[clinic.id]}
                        className="bg-amber-600 hover:bg-amber-500 text-white gap-1.5 font-bold text-xs"
                      >
                        <RefreshCw className="size-3.5" />
                        إعادة الربط
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => setUnlinkClinic(clinic)}
                        className="text-rose-400 hover:bg-rose-950/30 text-xs"
                      >
                        إلغاء
                      </Button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
        </>
      )}

      {/* Reminder Settings Modal */}
      <Dialog open={Boolean(settingsClinic)} onOpenChange={(open) => !open && setSettingsClinic(null)}>
        <DialogContent className="max-w-xl bg-slate-900 border-slate-800 text-slate-100 text-right [&_input]:text-slate-100! [&_input]:bg-slate-900! [&_input]:placeholder:text-slate-400 [&_button[data-variant=outline]]:bg-slate-800! [&_button[data-variant=outline]]:text-slate-100!" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg font-black flex items-center gap-2">
              <Settings className="size-5 text-emerald-400" />
              إعدادات التذكيرات والرسائل — {settingsClinic?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              تحكم في مواعيد وقواعد إرسال إشعارات الواتساب التلقائية لمرضى هذه العيادة.
            </DialogDescription>
          </DialogHeader>

          {editSettings && (
            <div className="space-y-5 py-3">
              {/* Toggle 1: Booking Confirmation */}
              <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
                <div className="space-y-0.5">
                  <Label className="text-sm font-bold text-slate-200">إرسال تأكيد الحجز فورياً</Label>
                  <p className="text-xs text-slate-400">
                    إرسال رسالة فورية للمريض فور إتمام الحجز مع رابط التتبع ورقم الدور
                  </p>
                </div>
                <Switch
                  checked={editSettings.sendBookingConfirmation}
                  onCheckedChange={(checked) =>
                    setEditSettings({ ...editSettings, sendBookingConfirmation: checked })
                  }
                />
              </div>

              {/* Toggle 2: Appointment Reminders */}
              <div className="space-y-3 rounded-xl border border-slate-800 bg-slate-950/50 p-3.5">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold text-slate-200">تذكيرات المواعيد المسبقة</Label>
                    <p className="text-xs text-slate-400">إرسال تذكيرات قبل موعد الكشف بفترات مرنة قابلة للتعديل</p>
                  </div>
                  <Switch
                    checked={editSettings.sendReminders}
                    onCheckedChange={(checked) =>
                      setEditSettings({ ...editSettings, sendReminders: checked })
                    }
                  />
                </div>

                {/* Reminder Rules List */}
                {editSettings.sendReminders && (
                  <div className="space-y-2.5 pt-2 border-t border-slate-800/80">
                    <Label className="text-xs font-semibold text-slate-300">مواعيد التذكير:</Label>
                    {editSettings.reminders.map((rule: any, idx: number) => (
                      <div key={rule.id} className="flex items-center gap-2">
                        <span className="text-xs text-slate-400 w-16">التذكير #{idx + 1}:</span>
                        <span className="text-xs text-slate-300">قبل الموعد بـ</span>
                        <Input
                          type="number"
                          min="1"
                          max="999"
                          value={rule.value}
                          onChange={(e) => handleUpdateReminderRule(rule.id, 'value', e.target.value)}
                          className="w-20 h-8 text-center bg-slate-900! text-slate-100! border-slate-600 text-xs"
                        />
                        <select
                          value={rule.unit}
                          onChange={(e) => handleUpdateReminderRule(rule.id, 'unit', e.target.value)}
                          className="h-8 rounded-md bg-slate-900 border border-slate-700 text-xs px-2 text-slate-200 focus:outline-none"
                        >
                          <option value="minute">دقيقة</option>
                          <option value="hour">ساعة</option>
                          <option value="day">يوم</option>
                        </select>

                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveReminderRule(rule.id)}
                          className="h-8 w-8 p-0 text-slate-300 hover:text-rose-400"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      </div>
                    ))}

                    {editSettings.reminders.length < 5 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={handleAddReminderRule}
                        className="text-xs h-8 gap-1.5 border-dashed border-slate-700 text-emerald-400 hover:text-emerald-300 mt-1"
                      >
                        <Plus className="size-3" />
                        إضافة موعد تذكير إضافي
                      </Button>
                    )}
                  </div>
                )}
              </div>

              {/* Toggles 3 & 4: Rescheduled and Cancelled */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-200">إشعار تعديل الموعد</Label>
                    <p className="text-[11px] text-slate-400">عند تغيير يوم أو توقيت الحجز</p>
                  </div>
                  <Switch
                    checked={editSettings.sendRescheduledNotification}
                    onCheckedChange={(checked) =>
                      setEditSettings({ ...editSettings, sendRescheduledNotification: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-950/50 p-3">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-slate-200">إشعار إلغاء الحجز</Label>
                    <p className="text-[11px] text-slate-400">عند إلغاء الحجز من الطبيب أو المريض</p>
                  </div>
                  <Switch
                    checked={editSettings.sendCancellationNotification}
                    onCheckedChange={(checked) =>
                      setEditSettings({ ...editSettings, sendCancellationNotification: checked })
                    }
                  />
                </div>
              </div>

              {/* Monthly Quota */}
              <div className="rounded-xl border border-slate-800 bg-slate-950/50 p-3.5 space-y-1.5">
                <Label className="text-xs font-bold text-slate-200">الحد الأقصى للرسائل شهرياً (ميزانية العيادة):</Label>
                <div className="flex items-center gap-3">
                  <Input
                    type="number"
                    min="1"
                    max="10000"
                    value={editSettings.monthlyLimit}
                    onChange={(e) =>
                      setEditSettings({
                        ...editSettings,
                        monthlyLimit: Math.max(1, Number(e.target.value) || 1)
                      })
                    }
                    className="w-32 h-9 bg-slate-900! text-slate-100! border-slate-600 text-sm"
                  />
                  <span className="text-xs text-slate-400">رسالة / شهر (لحماية التكلفة ومنع الاستهلاك الزائد)</span>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="bg-slate-900! border-slate-700! gap-2 sm:justify-start">
            <Button
              onClick={handleSaveSettings}
              disabled={savingSettings}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs"
            >
              {savingSettings ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setSettingsClinic(null)}
              className="bg-slate-800! text-slate-100! border-slate-600 text-xs"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Message Modal */}
      <Dialog open={Boolean(testClinic)} onOpenChange={(open) => !open && setTestClinic(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 text-right [&_input]:text-slate-100! [&_input]:bg-slate-900! [&_input]:placeholder:text-slate-400 [&_button[data-variant=outline]]:bg-slate-800! [&_button[data-variant=outline]]:text-slate-100!" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Send className="size-4 text-blue-400" />
              إرسال رسالة اختبار — {testClinic?.name}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-400">
              {testClinic?.whatsapp.wpSenderMode === 'mock' ? 'محاكاة فقط. تُحسب التجربة من رصيد المحاكاة لهذا الشهر.' : 'إرسال رسالة للتحقق من جاهزية الرقم.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2">
            <div className="rounded-lg bg-slate-950 p-3 border border-slate-800 text-xs space-y-1 text-slate-300">
              <div>الرقم المرسل (العيادة): <strong className="text-emerald-400 font-mono">{testClinic?.whatsapp.phoneNumber}</strong></div>
              <div>نوع القالب: <strong className="text-slate-200">UTILITY (تأكيد حجز)</strong></div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-200">رقم هاتف المستقبل (المستلم):</Label>
              <Input
                placeholder="مثال: 01012345678 أو +201012345678"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="bg-slate-950 border-slate-700 text-left font-mono text-sm"
                dir="ltr"
              />
              <p className="text-[11px] text-slate-300">
                {testClinic?.whatsapp.wpSenderMode === 'mock' ? 'استخدم رقمًا تجريبيًا.' : 'أدخل رقم الموبايل المخصص للاختبار.'}
              </p>
            </div>
          </div>

          <DialogFooter className="bg-slate-900! border-slate-700! gap-2 sm:justify-start">
            <Button
              onClick={handleSendTestMessage}
              disabled={sendingTest || !testPhone.trim()}
              className="bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs"
            >
              {sendingTest ? 'جاري الإرسال...' : 'إرسال الرسالة الآن'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setTestClinic(null)}
              className="bg-slate-800! text-slate-100! border-slate-600 text-xs"
            >
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlink Confirmation Dialog */}
      <Dialog open={Boolean(unlinkClinic)} onOpenChange={(open) => !open && setUnlinkClinic(null)}>
        <DialogContent className="max-w-md bg-slate-900 border-slate-800 text-slate-100 text-right [&_input]:text-slate-100! [&_input]:bg-slate-900! [&_input]:placeholder:text-slate-400 [&_button[data-variant=outline]]:bg-slate-800! [&_button[data-variant=outline]]:text-slate-100!" dir="rtl">
          <DialogHeader className="text-right">
            <DialogTitle className="text-base font-black flex items-center gap-2 text-rose-400">
              <AlertTriangle className="size-5" />
              تأكيد إلغاء ربط رقم واتساب
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-300 pt-2 leading-relaxed">
              هل أنت متأكد من رغبتك في إلغاء ربط الرقم{' '}
              <strong className="text-rose-400 font-mono">{unlinkClinic?.whatsapp.phoneNumber}</strong>{' '}
              للعيادة <strong className="text-slate-100">{unlinkClinic?.name}</strong>؟
              <br />
              <span className="text-slate-400 block mt-2">
                سيؤدي هذا الإجراء إلى إيقاف إرسال جميع رسائل التأكيد وتذكيرات المواعيد المجدولة لمرضى هذه العيادة.
              </span>
            </DialogDescription>
          </DialogHeader>

          <DialogFooter className="bg-slate-900! border-slate-700! gap-2 sm:justify-start pt-3">
            <Button
              onClick={handleConfirmUnlink}
              disabled={unlinking}
              variant="destructive"
              className="bg-rose-600 hover:bg-rose-500 font-bold text-xs"
            >
              {unlinking ? 'جاري الإلغاء...' : 'نعم، قم بإلغاء الربط'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setUnlinkClinic(null)}
              className="bg-slate-800! text-slate-100! border-slate-600 text-xs"
            >
              تراجع
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
