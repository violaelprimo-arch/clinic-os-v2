'use client'

import React, { useState, useEffect } from 'react'
import {
  Bell,
  BellRing,
  BellOff,
  CheckCircle2,
  AlertTriangle,
  Send,
  Loader2,
  Share2,
  PlusSquare,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'
import {
  getPushCapabilityStatus,
  subscribeToPush,
  unsubscribeFromPush,
  sendDeviceTestPush,
  isIosDevice,
  isRunningStandalone,
} from '@/lib/pwaService'

interface PatientPushNotificationManagerProps {
  clinicId?: string
  clinicSlug?: string
  appointmentId?: string
  patientPhone?: string
  className?: string
  compact?: boolean
}

export function PatientPushNotificationManager({
  clinicId,
  clinicSlug,
  appointmentId,
  patientPhone,
  className = '',
  compact = false,
}: PatientPushNotificationManagerProps) {
  const [capability, setCapability] = useState<ReturnType<typeof getPushCapabilityStatus> | null>(null)
  const [isSubscribed, setIsSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [testing, setTesting] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)

  // Check initial capability and subscription state
  useEffect(() => {
    if (typeof window === 'undefined') return

    const cap = getPushCapabilityStatus()
    setCapability(cap)

    if (cap.hasServiceWorker && cap.hasPushManager && cap.permission === 'granted') {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then((sub) => {
          if (sub) {
            setIsSubscribed(true)
          }
        })
        .catch(() => {})
    }
  }, [])

  const handleSubscribe = async () => {
    const cap = getPushCapabilityStatus()
    setCapability(cap)

    // iOS Safari requires Add to Home Screen first
    if (isIosDevice() && !isRunningStandalone()) {
      setShowIosGuide(true)
      return
    }

    if (!cap.supported) {
      if (!cap.isHttps) {
        toast.error('خدمة الإشعارات تتطلب اتصالاً آمناً (HTTPS)')
      } else {
        toast.error('متصفحك الحالي لا يدعم إشعارات الويب المباشرة')
      }
      return
    }

    if (cap.permission === 'denied') {
      toast.error('الإشعارات محظورة في إعدادات متصفحك. يرجى تفعيلها من إعدادات الموقع.')
      return
    }

    setLoading(true)
    try {
      const res = await subscribeToPush({
        clinicId,
        phone: patientPhone,
        appointmentId,
        role: 'patient',
      })

      if (res.success) {
        setIsSubscribed(true)
        toast.success('تم تفعيل تنبيهات حجزك بنجاح! ستصلك إشعارات الدور والروشتة فوراً.')
      } else {
        if (res.error === 'permission_denied') {
          toast.error('تم رفض إذن الإشعارات من المتصفح.')
          setCapability(getPushCapabilityStatus())
        } else if (res.error === 'ios_requires_home_screen') {
          setShowIosGuide(true)
        } else {
          toast.error(`تعذر حفظ التنبيهات: ${res.error || 'يرجى المحاولة لاحقاً'}`)
        }
      }
    } catch (err: any) {
      toast.error(err?.message || 'حدث خطأ أثناء تفعيل الإشعارات')
    } finally {
      setLoading(false)
    }
  }

  const handleUnsubscribe = async () => {
    if (!confirm('هل تريد بالتأكيد إلغاء تنبيهات هذا الحجز على هذا الجهاز؟')) return

    setLoading(true)
    try {
      const res = await unsubscribeFromPush({ appointmentId })
      if (res.success) {
        setIsSubscribed(false)
        toast.info('تم إلغاء تنبيهات هذا الحجز بنجاح.')
      } else {
        toast.error(res.error || 'فشل إلغاء التنبيهات')
      }
    } catch {
      toast.error('حدث خطأ أثناء إلغاء التنبيهات')
    } finally {
      setLoading(false)
    }
  }

  const handleTestPush = async () => {
    setTesting(true)
    try {
      const res = await sendDeviceTestPush({
        appointmentId,
        clinicSlug,
      })
      if (res.success) {
        toast.success(res.message || 'تم إرسال إشعار تجريبي بنجاح! راجع شريط الإشعارات.')
      } else {
        toast.error(res.error || 'تعذر إرسال الإشعار التجريبي')
      }
    } catch (err: any) {
      toast.error(err?.message || 'فشل الاتصال بخدمة الإشعارات')
    } finally {
      setTesting(false)
    }
  }

  if (!capability) {
    return null
  }

  // 1. STATE: Active / Subscribed
  if (isSubscribed) {
    return (
      <div
        className={`rounded-2xl border border-emerald-200/80 bg-emerald-50/70 dark:bg-emerald-950/30 dark:border-emerald-800/60 p-4 transition-all ${className}`}
        dir="rtl"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-emerald-500 text-white flex items-center justify-center shadow-md shadow-emerald-500/20 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <div className="font-extrabold text-sm text-emerald-900 dark:text-emerald-200 flex items-center gap-1.5">
                <span>تنبيهات الموبايل مفعّلة على هذا الجهاز</span>
                <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              </div>
              <p className="text-[11px] text-emerald-700 dark:text-emerald-300/80 mt-0.5">
                ستصلك إشعارات حقيقية على شاشة القفل وشريط الإشعارات باقتراب دورك وحلوله وجاهزية الروشتة حتى أثناء إغلاق الصفحة.
              </p>
            </div>
          </div>
        </div>

        <div className="mt-3.5 flex flex-wrap items-center gap-2 pt-2.5 border-t border-emerald-200/50 dark:border-emerald-800/40">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleTestPush}
            disabled={testing || loading}
            className="h-8 text-xs font-bold gap-1.5 rounded-xl border-emerald-300 dark:border-emerald-700 text-emerald-800 dark:text-emerald-200 hover:bg-emerald-100/60 dark:hover:bg-emerald-900/40"
          >
            {testing ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
            <span>إرسال إشعار تجريبي لموبايلك الآن</span>
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleUnsubscribe}
            disabled={loading}
            className="h-8 text-xs text-slate-500 dark:text-slate-400 hover:text-destructive dark:hover:text-destructive rounded-xl"
          >
            <BellOff className="w-3.5 h-3.5" />
            <span>إلغاء تنبيهات هذا الحجز</span>
          </Button>
        </div>
      </div>
    )
  }

  // 2. STATE: Blocked / Denied
  if (capability.permission === 'denied') {
    return (
      <div
        className={`rounded-2xl border border-amber-200 bg-amber-50/80 dark:bg-amber-950/30 dark:border-amber-800/60 p-4 ${className}`}
        dir="rtl"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shrink-0">
            <BellOff className="w-5 h-5" />
          </div>
          <div>
            <h5 className="font-extrabold text-sm text-amber-900 dark:text-amber-200">
              الإشعارات محظورة في متصفحك
            </h5>
            <p className="text-xs text-amber-800/90 dark:text-amber-300/80 mt-1 leading-relaxed">
              لتلقي إشعارات دورك والروشتة فوراً، يرجى الضغط على أيقونة القفل أو إعدادات الموقع بجوار شريط العنوان في المتصفح، ثم السماح بالإشعارات (Allow Notifications) وتحديث الصفحة.
            </p>
          </div>
        </div>
      </div>
    )
  }

  // 3. STATE: iOS Safari Not Installed Notice
  if (showIosGuide || (capability.isIos && !capability.isStandalone)) {
    return (
      <div
        className={`rounded-2xl border border-sky-200 bg-sky-50/80 dark:bg-sky-950/30 dark:border-sky-800/60 p-4 ${className}`}
        dir="rtl"
      >
        <div className="flex items-start gap-3">
          <div className="w-9 h-9 rounded-xl bg-sky-500 text-white flex items-center justify-center shrink-0">
            <Share2 className="w-5 h-5" />
          </div>
          <div className="space-y-2">
            <h5 className="font-extrabold text-sm text-sky-950 dark:text-sky-100">
              تفعيل التنبيهات على أجهزة iPhone / iPad
            </h5>
            <p className="text-xs text-sky-800 dark:text-sky-200 leading-relaxed">
              يتطلب نظام Apple (iOS) إضافة الصفحة للشاشة الرئيسية أولاً لتشغيل إشعارات الخلفية وشاشة القفل:
            </p>
            <ol className="text-xs text-slate-700 dark:text-slate-300 space-y-1 list-decimal list-inside pr-1">
              <li>
                اضغط على زر المشاركة <Share2 className="w-3.5 h-3.5 inline mx-1 text-sky-600" /> في أسفل متصفح Safari.
              </li>
              <li>
                مرر لأسفل واختر <strong>«إضافة إلى الصفحة الرئيسية»</strong> (Add to Home Screen) <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-sky-600" />.
              </li>
              <li>افتح الأيقونة من شاشة هاتفك واضغط زر <strong>«فعّل التنبيهات على موبايلك»</strong>.</li>
            </ol>
            {capability.isStandalone && (
              <Button
                type="button"
                size="sm"
                onClick={handleSubscribe}
                disabled={loading}
                className="mt-2 text-xs font-bold rounded-xl"
              >
                {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <BellRing className="w-3.5 h-3.5" />}
                <span>فعّل التنبيهات على موبايلك الآن</span>
              </Button>
            )}
          </div>
        </div>
      </div>
    )
  }

  // 4. STATE: Unsupported Browser
  if (!capability.supported) {
    return null // Gracefully hide without breaking UI
  }

  // 5. STATE: Default Actionable Button
  return (
    <div
      className={`rounded-2xl border border-sky-100 dark:border-slate-800 bg-gradient-to-br from-sky-50/90 to-blue-50/50 dark:from-slate-900 dark:to-slate-900/60 p-4 shadow-sm ${className}`}
      dir="rtl"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-sky-600 to-blue-500 text-white flex items-center justify-center shadow-md shadow-sky-500/20 shrink-0">
            <Bell className="w-5 h-5 animate-bounce" />
          </div>
          <div>
            <h5 className="font-extrabold text-sm text-slate-900 dark:text-white">
              تنبيهات الموبايل وشاشة القفل
            </h5>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5 leading-snug">
              لتصلك إشعارات حقيقية على شاشة القفل وشريط إشعارات هاتفك باقتراب دورك والروشتة حتى لو كانت الصفحة مغلقة.
            </p>
          </div>
        </div>

        <Button
          type="button"
          onClick={handleSubscribe}
          disabled={loading}
          size={compact ? 'sm' : 'default'}
          className="h-10 px-4 bg-gradient-to-r from-sky-600 to-blue-600 hover:from-sky-700 hover:to-blue-700 text-white font-black text-xs rounded-xl shadow-md shadow-sky-600/20 gap-2 shrink-0 cursor-pointer"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              <span>جاري التفعيل...</span>
            </>
          ) : (
            <>
              <BellRing className="w-4 h-4" />
              <span>فعّل التنبيهات على موبايلك</span>
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
