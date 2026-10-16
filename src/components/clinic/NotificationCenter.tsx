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
import { useLanguage } from '@/context/LanguageContext'
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
  const { t, isRtl, dir, language } = useLanguage()
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
      toast.success(isRtl ? 'تم تفعيل التنبيهات المباشرة والصوتية على هذا الجهاز بنجاح!' : 'Live push & sound notifications enabled successfully!')
    } else {
      toast.info(isRtl ? 'تم رفض إذن التنبيهات أو غير مدعوم في متصفحك' : 'Notification permission was denied or is not supported')
    }
  }

  const handleMarkAllRead = async () => {
    for (const n of notifications.filter((n) => !n.isRead)) {
      if (n.id !== 'owner-broadcast-alert' && n.id !== 'subscription-exp-alert') {
        await markNotificationAsRead(n.id)
      }
    }
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })))
    toast.success(isRtl ? 'تم تحديد جميع الإشعارات كمقروءة' : 'All notifications marked as read')
  }

  const handleTestSound = () => {
    playNotificationSound('turn_ready')
    toast.success(isRtl ? 'تم تشغيل صوت التنبيه التجريبي بنجاح 🔔' : 'Notification chime played successfully 🔔')
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
        return <Sparkles className="w-4 h-4 text-primary" />
      case 'system':
        return <AlertCircle className="w-4 h-4 text-rose-500" />
      default:
        return <Bell className="w-4 h-4 text-muted-foreground" />
    }
  }

  return (
    <div className="relative" dir={dir}>
      {/* Bell Trigger Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2.5 rounded-xl border border-border text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors cursor-pointer"
        title={t('notifications_center_title', isRtl ? 'مركز الإشعارات والتنبيهات' : 'Notification Center')}
      >
        <Bell className="w-5 h-5" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 bg-rose-500 text-white font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center ring-2 ring-background animate-pulse">
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
          <div className={`absolute ${isRtl ? 'left-0 sm:left-0' : 'right-0 sm:right-0'} mt-2 w-80 sm:w-96 bg-card text-card-foreground border border-border rounded-2xl shadow-2xl z-50 overflow-hidden flex flex-col max-h-[480px] animate-in fade-in-50`}>
            {/* Header */}
            <div className="p-3.5 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4 text-primary" />
                <h4 className="font-bold text-xs text-foreground">
                  {t('notifications_center_title', isRtl ? 'مركز التنبيهات' : 'Notifications')} ({notifications.length})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={handleTestSound}
                  className="text-[10px] font-bold text-muted-foreground hover:text-primary flex items-center gap-1 cursor-pointer bg-background px-2 py-1 rounded-lg border border-border shadow-2xs"
                  title={isRtl ? 'تجربة صوت التنبيه' : 'Test sound chime'}
                >
                  <Volume2 className="w-3 h-3 text-primary" />
                  <span>{t('sound_test', isRtl ? 'صوت' : 'Sound')}</span>
                </button>
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-primary hover:underline cursor-pointer"
                  >
                    {t('mark_all_read', isRtl ? 'تعليم الكل كمقروء' : 'Mark all read')}
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-muted-foreground hover:text-foreground p-1 rounded-lg cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Browser push permission banner if not granted */}
            {!hasPushPermission && typeof window !== 'undefined' && 'Notification' in window && (
              <div className="p-2.5 bg-primary/10 border-b border-primary/20 flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-foreground">
                  {isRtl ? 'تفعيل الإشعارات الصوتية والمباشرة' : 'Enable live push and sound alerts'}
                </span>
                <Button
                  size="sm"
                  onClick={handleEnablePush}
                  className="h-7 text-[10px] px-2.5 yalla-gradient-btn text-white font-bold rounded-lg cursor-pointer"
                >
                  {isRtl ? 'تفعيل التنبيه' : 'Enable'}
                </Button>
              </div>
            )}

            {/* List */}
            <div className="overflow-y-auto divide-y divide-border flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground space-y-2">
                  <Bell className="w-8 h-8 mx-auto text-muted-foreground/40" />
                  <p className="text-xs font-bold text-foreground">{isRtl ? 'لا توجد تنبيهات حالياً' : 'No notifications yet'}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {isRtl ? 'ستصلك التنبيهات الفورية فور حدوث حجز أو حركة دور' : 'Real-time alerts will appear here as bookings or queue progress'}
                  </p>
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
                        ? (isRtl ? 'bg-amber-500/10 border-r-4 border-r-amber-500' : 'bg-amber-500/10 border-l-4 border-l-amber-500')
                        : n.isRead
                        ? 'bg-card hover:bg-muted/30 opacity-80'
                        : (isRtl ? 'bg-primary/5 hover:bg-primary/10 border-r-4 border-r-primary' : 'bg-primary/5 hover:bg-primary/10 border-l-4 border-l-primary')
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-background border border-border shrink-0 mt-0.5 shadow-2xs">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <h5 className="font-bold text-xs text-foreground truncate flex items-center gap-1.5">
                          {n.title}
                          {n.id === 'owner-broadcast-alert' && (
                            <span className="text-[9px] font-black text-amber-600 bg-amber-500/10 px-1.5 py-0.2 rounded-md border border-amber-500/20">
                              {isRtl ? 'إداري' : 'Admin'}
                            </span>
                          )}
                        </h5>
                        <span className="text-[9px] font-medium text-muted-foreground shrink-0 font-mono">
                          {new Date(n.createdAt).toLocaleTimeString(language === 'ar' ? 'ar-EG' : 'en-US', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed whitespace-pre-wrap">
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

