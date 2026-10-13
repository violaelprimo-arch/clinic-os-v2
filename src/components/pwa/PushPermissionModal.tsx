'use client'

import { useState, useEffect } from 'react'
import { Bell, X, ShieldCheck, Share, PlusSquare, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { subscribeToPush, isIosSafari, isRunningStandalone } from '@/lib/pwaService'
import { playNotificationSound } from '@/lib/notificationService'
import { toast } from 'sonner'

export function PushPermissionModal({
  clinicId,
  phone,
  appointmentId
}: {
  clinicId?: string
  phone?: string
  appointmentId?: string
}) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSubscribing, setIsSubscribing] = useState(false)
  const [showIosGuide, setShowIosGuide] = useState(false)

  useEffect(() => {
    // Only check in browser
    if (typeof window === 'undefined') return

    // If dismissed recently, don't show
    const dismissedAt = localStorage.getItem('pwa_push_prompt_dismissed')
    if (dismissedAt) {
      const days = (Date.now() - Number(dismissedAt)) / (1000 * 3600 * 24)
      if (days < 3) return
    }

    // If already granted, don't show
    if ('Notification' in window && Notification.permission === 'granted') {
      return
    }

    // Delay slightly for smooth page load
    const timer = setTimeout(() => {
      setIsOpen(true)
    }, 2500)

    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    localStorage.setItem('pwa_push_prompt_dismissed', String(Date.now()))
    setIsOpen(false)
  }

  const handleEnable = async () => {
    // If iOS Safari and not standalone, guide to Add to Home Screen first
    if (isIosSafari() && !isRunningStandalone()) {
      setShowIosGuide(true)
      return
    }

    setIsSubscribing(true)
    try {
      const res = await subscribeToPush({ clinicId, phone, appointmentId })
      if (res.success) {
        playNotificationSound('chime')
        toast.success('تم تفعيل إشعارات دورك بنجاح! ستصلك التنبيهات المباشرة.')
        setIsOpen(false)
      } else {
        if (res.error === 'permission_denied') {
          toast.info('تم رفض إذن الإشعارات من إعدادات المتصفح.')
        } else {
          toast.info('تم تسجيل اهتمامك، يرجى التأكد من دعم متصفحك لإشعارات الويب.')
        }
        setIsOpen(false)
      }
    } catch (e) {
      toast.error('تعذر تفعيل الإشعارات حالياً.')
    } finally {
      setIsSubscribing(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-[#E5EAF0] w-full max-w-md p-5 sm:p-6 space-y-4 animate-in slide-in-from-bottom-4">
        
        {/* Header Icon & Close */}
        <div className="flex items-start justify-between">
          <div className="w-12 h-12 rounded-2xl bg-teal-50 border border-teal-100 text-[#15B8A6] flex items-center justify-center shadow-xs">
            <Bell className="w-6 h-6 animate-bounce" />
          </div>
          <button
            onClick={handleDismiss}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="space-y-1.5 text-right">
          <h3 className="text-lg font-black text-[#182230] flex items-center gap-1.5">
            <span>فعّل إشعارات دورك</span>
            <Sparkles className="w-4 h-4 text-amber-500" />
          </h3>
          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
            اسمح لنا بإرسال تنبيه فوري على موبايلك لما دورك يقرب (من أول 5 أدوار) أو يحصل أي حركة في موعدك، حتى لو مش فاتح صفحة العيادة على الأجهزة المدعومة.
          </p>
        </div>

        {/* iOS Safari Special Instructions if active */}
        {showIosGuide && (
          <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 text-xs space-y-2 text-right">
            <p className="font-bold text-[#182230]">لتفعيل الإشعارات على iPhone:</p>
            <ol className="space-y-1 text-slate-600 list-decimal list-inside">
              <li>اضغط على زر المشاركة <Share className="w-3.5 h-3.5 inline mx-1 text-blue-500" /> في متصفح Safari بالأسفل.</li>
              <li>اختر <span className="font-bold text-slate-800">"إضافة إلى الصفحة الرئيسية" <PlusSquare className="w-3.5 h-3.5 inline mx-1 text-[#15B8A6]" /></span>.</li>
              <li>افتح التطبيق من شاشتك الرئيسية لتفعيل الإشعارات الفورية.</li>
            </ol>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5 pt-2">
          <Button
            onClick={handleEnable}
            disabled={isSubscribing}
            className="flex-1 h-11 text-xs sm:text-sm font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-md shadow-[#15B8A6]/25 cursor-pointer"
          >
            {isSubscribing ? 'جاري التفعيل...' : 'تفعيل الإشعارات'}
          </Button>

          <Button
            variant="outline"
            onClick={handleDismiss}
            className="h-11 px-4 text-xs sm:text-sm font-bold text-slate-600 border-[#E5EAF0] hover:bg-slate-50 rounded-xl cursor-pointer"
          >
            لاحقاً
          </Button>
        </div>

        <div className="text-center pt-1 text-[11px] text-slate-400 flex items-center justify-center gap-1">
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
          <span>خصوصية كاملة • لا نشارك بياناتك ولا نرسل إعلانات</span>
        </div>
      </div>
    </div>
  )
}
