'use client'

import { useState, useEffect } from 'react'
import { Bell, Check, Clock, ShieldCheck, FileText, AlertCircle, X } from 'lucide-react'
import {
  ClinicNotification
} from '@/types/clinic'
import {
  subscribeToRecipientNotifications,
  markNotificationAsRead,
  requestBrowserNotificationPermission
} from '@/lib/notificationService'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

export function NotificationCenter({
  recipientTarget,
  recipientLabel = 'المستخدم'
}: {
  recipientTarget: string
  recipientLabel?: string
}) {
  const [notifications, setNotifications] = useState<ClinicNotification[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [hasPushPermission, setHasPushPermission] = useState(false)

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setHasPushPermission(Notification.permission === 'granted')
    }
  }, [])

  useEffect(() => {
    if (!recipientTarget) return
    const unsub = subscribeToRecipientNotifications(recipientTarget, (list) => {
      setNotifications(list)
    })
    return () => unsub()
  }, [recipientTarget])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleEnablePush = async () => {
    const granted = await requestBrowserNotificationPermission()
    if (granted) {
      setHasPushPermission(true)
      toast.success('تم تفعيل التنبيهات المباشرة على هذا الجهاز بنجاح!')
    } else {
      toast.info('تم رفض إذن التنبيهات أو غير مدعوم في متصفحك')
    }
  }

  const handleMarkAllRead = async () => {
    for (const n of notifications.filter((n) => !n.isRead)) {
      await markNotificationAsRead(n.id)
    }
    toast.success('تم تحديد جميع الإشعارات كمقروءة')
  }

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'approaching_turn':
        return <Clock className="w-4 h-4 text-amber-500" />
      case 'turn_ready':
        return <Check className="w-4 h-4 text-emerald-500" />
      case 'payment_confirmed':
        return <ShieldCheck className="w-4 h-4 text-teal-500" />
      case 'prescription_ready':
        return <FileText className="w-4 h-4 text-blue-500" />
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
        title="مركز الإشعارات"
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
                <Bell className="w-4 h-4 text-[#15B8A6]" />
                <h4 className="font-bold text-xs text-[#182230]">
                  مركز التنبيهات ({notifications.length})
                </h4>
              </div>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={handleMarkAllRead}
                    className="text-[10px] font-bold text-[#15B8A6] hover:underline cursor-pointer"
                  >
                    تعليم الكل كمقروء
                  </button>
                )}
                <button
                  onClick={() => setIsOpen(false)}
                  className="text-slate-400 hover:text-slate-600 p-1 rounded-lg"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Browser push permission banner if not granted */}
            {!hasPushPermission && typeof window !== 'undefined' && 'Notification' in window && (
              <div className="p-2.5 bg-teal-50 border-b border-teal-100 flex items-center justify-between text-xs">
                <span className="text-[11px] font-semibold text-teal-900">
                  تفعيل إشعارات المتصفح عند اقتراب دورك
                </span>
                <Button
                  size="sm"
                  onClick={handleEnablePush}
                  className="h-7 text-[10px] px-2.5 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-lg"
                >
                  تفعيل
                </Button>
              </div>
            )}

            {/* List */}
            <div className="overflow-y-auto divide-y divide-[#E5EAF0] flex-1">
              {notifications.length === 0 ? (
                <div className="py-12 text-center text-slate-400 space-y-2">
                  <Bell className="w-8 h-8 mx-auto text-slate-300 opacity-60" />
                  <p className="text-xs font-bold text-slate-500">لا توجد تنبيهات حالياً</p>
                  <p className="text-[10px] text-slate-400">ستصلك التنبيهات فور تحديث دورك أو حالتك</p>
                </div>
              ) : (
                notifications.map((n) => (
                  <div
                    key={n.id}
                    onClick={() => markNotificationAsRead(n.id)}
                    className={`p-3 transition-colors cursor-pointer flex items-start gap-3 ${
                      n.isRead ? 'bg-white hover:bg-slate-50/80 opacity-80' : 'bg-teal-50/40 hover:bg-teal-50/70 border-r-4 border-r-[#15B8A6]'
                    }`}
                  >
                    <div className="p-2 rounded-xl bg-white border border-[#E5EAF0] shrink-0 mt-0.5 shadow-2xs">
                      {getNotificationIcon(n.type)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <h5 className="font-bold text-xs text-[#182230] truncate">{n.title}</h5>
                        <span className="text-[9px] font-medium text-slate-400">
                          {new Date(n.createdAt).toLocaleTimeString('ar-EG', {
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-600 mt-1 leading-relaxed">{n.body}</p>
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
