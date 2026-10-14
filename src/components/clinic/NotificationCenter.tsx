'use client'

import { useState, useEffect, useRef } from 'react'
import {
  Bell, Check, Clock, ShieldCheck, FileText, AlertCircle,
  X, Volume2, Sparkles, MessageCircle
} from 'lucide-react'
import { ClinicNotification } from '@/types/clinic'
import {
  subscribeToRecipientNotifications,
  subscribeToClinicStaffNotifications,
  markNotificationAsRead,
  requestBrowserNotificationPermission,
  playNotificationSound
} from '@/lib/notificationService'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function NotificationCenter({
  recipientTarget,
  clinicId,
  slug,
  clinic,
  recipientLabel = 'المستخدم',
  recipientType = 'staff'
}: {
  recipientTarget?: string
  clinicId?: string
  slug?: string
  clinic?: any
  recipientLabel?: string
  recipientType?: 'staff' | 'patient'
}) {
  const [notifications, setNotifications] = useState<ClinicNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hasPushPermission, setHasPushPermission] = useState(false)
  const prevCountRef = useRef<number | null>(null)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasPushPermission(Notification.permission === 'granted')
    }
  }, [])

  useEffect(() => {
    let unsub: () => void

    if (recipientType === 'staff') {
      const activeClinicId = clinicId || clinic?.id || recipientTarget
      const activeSlug = slug || clinic?.slug || ''
      unsub = subscribeToClinicStaffNotifications(activeClinicId, activeSlug, (list) => {
        // Integrate Owner Direct Broadcast Message if present on clinic document
        let merged = [...list]
        if (clinic?.ownerMessage && clinic.ownerMessage.trim()) {
          const ownerMsgItem: ClinicNotification = {
            id: 'owner-broadcast-alert',
            clinicId: activeClinicId,
            recipientType: 'staff',
            recipientTarget: activeClinicId,
            title: 'رسالة إدارية من مالك المنصة 📢',
            body: clinic.ownerMessage.trim(),
            type: 'system',
            isRead: false,
            createdAt: clinic.updatedAt || new Date().toISOString()
          }
          // Only add if not already in list
          if (!merged.some(m => m.id === 'owner-broadcast-alert' || m.body === clinic.ownerMessage.trim())) {
            merged.unshift(ownerMsgItem)
          }
        }

        // Check subscription expiration
        if (clinic?.expirationDate) {
          const diffDays = Math.ceil(
            (new Date(clinic.expirationDate).getTime() - Date.now()) / (1000 * 3600 * 24)
          )
          if (diffDays <= 7 && diffDays >= 0) {
            const expItem: ClinicNotification = {
              id: 'subscription-exp-alert',
              clinicId: activeClinicId,
              recipientType: 'staff',
              recipientTarget: activeClinicId,
              title: 'تنبيه موعد تجديد الاشتراك ⚠️',
              body: `يتبقى ${diffDays} أيام على انتهاء اشتراك العيادة. يرجى التواصل مع مالك المنصة للتجديد.`,
              type: 'system',
              isRead: false,
              createdAt: new Date().toISOString()
            }
            if (!merged.some(m => m.id === 'subscription-exp-alert')) {
              merged.unshift(expItem)
            }
          }
        }

        // Play sound on arrival of new unread notification
        if (prevCountRef.current !== null && merged.length > prevCountRef.current) {
          playNotificationSound('chime')
          const newest = merged[0]
          if (newest && !newest.isRead) {
            toast.info(`🔔 ${newest.title}: ${newest.body}`)
          }
        }
        prevCountRef.current = merged.length
        setNotifications(merged)
      })
    } else {
      // Patient notifications
      if (!recipientTarget) return
      unsub = subscribeToRecipientNotifications(recipientTarget, (list) => {
        if (prevCountRef.current !== null && list.length > prevCountRef.current) {
          playNotificationSound('turn_ready')
          const newest = list[0]
          if (newest) {
            toast.info(`🔔 ${newest.title}: ${newest.body}`)
          }
        }
        prevCountRef.current = list.length
        setNotifications(list)
      })
    }

    return () => {
      if (unsub) unsub()
    }
  }, [recipientTarget, clinicId, slug, clinic?.id, clinic?.ownerMessage, clinic?.expirationDate, recipientType])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleEnablePush = async () => {
    const granted = await requestBrowserNotificationPermission()
    if (granted) {
      setHasPushPermission(true)
      playNotificationSound('chime')
      toast.success('تم تفعيل التنبيهات المباشرة والصوتية على هذا الجهاز بنجاح!')
    } else {
      toast.info('تم رفض إذن التنبيهات أو غير مدعوم في متصفحك')
    }
  }

  const handleMarkAllRead = async () => {
    for (const n of notifications.filter((n) => !n.isRead)) {
      if (n.id !== 'owner-broadcast-alert' && n.id !== 'subscription-exp-alert') {
        await markNotificationAsRead(n.id)
      }
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    toast.success('تم تحديد جميع الإشعارات كمقروءة')
  }

  const handleTestSound = () => {
    playNotificationSound('turn_ready')
    toast.success('تم تشغيل صوت التنبيه التجريبي بنجاح 🔔')
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approaching_turn':
        return <Clock className="w-4 h-4 text-amber-500" />
      case 'turn_ready':
        return <Check className="w-4 h-4 text-emerald-500" />
      case 'payment_confirmed':
        return <ShieldCheck className="w-4 h-4 text-teal-500" />
      case 'payment_pending':
        return <Clock className="w-4 h-4 text-amber-600" />
      case 'prescription_ready':
        return <FileText className="w-4 h-4 text-blue-500" />
      case 'new_booking':
        return <Sparkles className="w-4 h-4 text-[#087CF4]" />
      case 'system':
        return <AlertCircle className="w-4 h-4 text-rose-500" />
      default:
        return <Bell className="w-4 h-4 text-slate-500" />
    }
  }

  return (
    <div className="relative" dir="rtl">
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl border border-[#E5EAF0] text-slate-600 hover:text-[#182230] hover:bg-slate-50 transition-colors cursor-pointer"
        title="مركز الإشعارات والتنبيهات"
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-white animate-pulse">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown Popover */}
      {isOpen && (
        <>
          <div
            className="fixed inset-0 z-40 bg-transparent"
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute left-0 sm:right-auto sm:left-0 mt-2 w-80 sm:w-96 bg-white border border-[#E5EAF0] rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px] animate-in fade-in-50">
            {/* Header */}
            <div className="p-3.5 border-b border-[#E5EAF0] flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-[#087CF4]" />
                <h4 className="font-bold text-xs text-[#182230]">
                  مركز التنبيهات ({notifications.length})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestSound}
                  className="text-[10px] font-bold text-slate-500 hover:text-[#087CF4] flex items-center gap-1 cursor-pointer bg-white px-2 py-1 rounded-lg border border-slate-200"
                  title="تجربة صوت التنبيه"
                >
                  <Volume2 className="w-3 h-3 text-[#087CF4]" />
                  <span>صوت</span>
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-[#087CF4] hover:underline cursor-pointer"
                  >
                    تعليم الكل كمقروء
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Browser push permission banner if not granted */}
            {!hasPushPermission && typeof window !== 'undefined' && 'Notification' in window && (
              <div className="p-2.5 bg-blue-50 border-b border-blue-100 flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-blue-900">
                  تفعيل الإشعارات الصوتية والمباشرة
                </span>
                <Button
                  size="sm"
                  onClick={handleEnablePush}
                  className="h-7 text-[10px] px-2.5 bg-[#087CF4] hover:bg-[#0769D1] text-white font-bold rounded-lg cursor-pointer"
                >
                  تفعيل التنبيه
                </Button>
              </div>
            )}

            {/* List */}
            <div className="overflow-y-auto divide-y divide-[#E5EAF0] flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Bell className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
                  <p className="text-xs font-bold text-slate-500">لا توجد تنبيهات حالياً</p>
                  <p className="text-[10px] text-slate-400">ستصلك التنبيهات الفورية فور حدوث حجز أو حركة دور</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => {
                      if (n.id !== 'owner-broadcast-alert' && n.id !== 'subscription-exp-alert') {
                        markNotificationAsRead(n.id)
                      }
                    }}
                    className={`p-3 transition-colors cursor-pointer flex items-start gap-3 ${
                      n.id === 'owner-broadcast-alert'
                        ? 'bg-amber-50/80 border-r-4 border-r-amber-500'
                        : n.isRead
                        ? 'bg-white hover:bg-slate-50/80 opacity-80'
                        : 'bg-blue-50/40 hover:bg-blue-50/70 border-r-4 border-r-[#087CF4]'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white border border-[#E5EAF0] shrink-0 mt-0.5 shadow-2xs">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className="font-bold text-xs text-[#182230] truncate flex items-center gap-1.5">
                          {n.title}
                          {n.id === 'owner-broadcast-alert' && (
                            <span className="text-[9px] font-black text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded-md">
                              إداري
                            </span>
                          )}
                        </h5>
                        <span className="text-[9px] font-medium text-slate-400 shrink-0">
                          {new Date(n.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed whitespace-pre-wrap">
                        {n.body}
                      </p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  )
}

