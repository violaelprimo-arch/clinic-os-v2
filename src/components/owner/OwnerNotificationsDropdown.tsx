'use client'

import React, { useState, useEffect, useRef } from 'react'
import { Bell, CheckCheck, Inbox, Check, ExternalLink, X, Clock } from 'lucide-react'
import { collection, query, where, onSnapshot, orderBy, doc, updateDoc, writeBatch } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { playNotificationSound } from '@/lib/notificationService'

interface OwnerNotificationItem {
  id: string
  title: string
  body: string
  type: string
  requestId?: string
  requestNumber?: string
  doctorName?: string
  clinicName?: string
  isRead: boolean
  createdAt: string
}

interface OwnerNotificationsDropdownProps {
  onSelectRequest: (requestId: string) => void
}

export function OwnerNotificationsDropdown({
  onSelectRequest,
}: OwnerNotificationsDropdownProps) {
  const [notifications, setNotifications] = useState<OwnerNotificationItem[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)
  const previousUnreadRef = useRef<number>(0)

  // Real-time listener on owner notifications
  useEffect(() => {
    const q = query(
      collection(db, 'notifications'),
      where('recipientType', '==', 'owner'),
      orderBy('createdAt', 'desc')
    )

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const items: OwnerNotificationItem[] = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            title: data.title || 'طلب عيادة جديد',
            body: data.body || '',
            type: data.type || 'new_clinic_request',
            requestId: data.requestId || '',
            requestNumber: data.requestNumber || '',
            doctorName: data.doctorName || '',
            clinicName: data.clinicName || '',
            isRead: data.isRead === true || data.read === true,
            createdAt: data.createdAt || new Date().toISOString(),
          }
        })

        const unreadCount = items.filter((n) => !n.isRead).length
        // If unread count increased while listening, chime!
        if (unreadCount > previousUnreadRef.current && previousUnreadRef.current !== 0) {
          playNotificationSound('chime')
        }
        previousUnreadRef.current = unreadCount

        setNotifications(items)
      },
      (err) => {
        console.warn('Error reading owner notifications:', err)
      }
    )

    return () => unsubscribe()
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside)
    }
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [isOpen])

  const unreadCount = notifications.filter((n) => !n.isRead).length

  const handleMarkAsRead = async (id: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    try {
      await updateDoc(doc(db, 'notifications', id), {
        isRead: true,
        read: true,
      })
    } catch (err) {
      console.error('Mark as read error:', err)
    }
  }

  const handleMarkAllAsRead = async () => {
    try {
      const batch = writeBatch(db)
      notifications
        .filter((n) => !n.isRead)
        .forEach((n) => {
          batch.update(doc(db, 'notifications', n.id), {
            isRead: true,
            read: true,
          })
        })
      await batch.commit()
    } catch (err) {
      console.error('Mark all as read error:', err)
    }
  }

  const handleNotificationClick = (n: OwnerNotificationItem) => {
    if (!n.isRead) {
      handleMarkAsRead(n.id)
    }
    if (n.requestId) {
      onSelectRequest(n.requestId)
      setIsOpen(false)
    }
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        type="button"
        onClick={() => setIsOpen((prev) => !prev)}
        className="relative h-11 w-11 rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all cursor-pointer shadow-xs"
        title="إشعارات طلبات العيادات"
        aria-label="إشعارات المالك"
      >
        <Bell className="w-4 h-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[20px] h-5 px-1 rounded-full bg-rose-500 text-white font-black text-[10px] flex items-center justify-center animate-pulse shadow-sm">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Floating Dropdown */}
      {isOpen && (
        <div
          dir="rtl"
          className="absolute left-0 sm:left-auto sm:right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-white dark:bg-[#081526] border border-slate-200 dark:border-slate-800 shadow-2xl z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        >
          {/* Header */}
          <div className="p-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="font-black text-xs text-slate-900 dark:text-white">
                إشعارات المنصة
              </span>
              {unreadCount > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-600 dark:bg-rose-950/40 dark:text-rose-400 text-[10px] font-black">
                  {unreadCount} غير مقروء
                </span>
              )}
            </div>

            {unreadCount > 0 && (
              <button
                type="button"
                onClick={handleMarkAllAsRead}
                className="text-[11px] text-sky-600 hover:text-sky-700 font-bold transition-colors cursor-pointer flex items-center gap-1"
              >
                <CheckCheck className="w-3.5 h-3.5" />
                <span>تعليم الكل كمقروء</span>
              </button>
            )}
          </div>

          {/* Notifications List */}
          <div className="max-h-80 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800/80">
            {notifications.length === 0 ? (
              <div className="p-8 text-center space-y-2">
                <Inbox className="w-8 h-8 text-slate-300 dark:text-slate-700 mx-auto" />
                <p className="text-xs text-slate-500 font-bold">لا توجد إشعارات حتى الآن</p>
                <p className="text-[11px] text-slate-400">
                  عند وصول أي طلب عيادة جديد سيظهر التنبيه هنا فوراً.
                </p>
              </div>
            ) : (
              notifications.slice(0, 20).map((n) => (
                <div
                  key={n.id}
                  onClick={() => handleNotificationClick(n)}
                  className={`p-3.5 transition-colors cursor-pointer flex items-start gap-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 ${
                    !n.isRead ? 'bg-sky-50/50 dark:bg-sky-950/20' : ''
                  }`}
                >
                  <div
                    className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                      !n.isRead
                        ? 'bg-sky-600 text-white shadow-xs'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-500'
                    }`}
                  >
                    <Inbox className="w-4 h-4" />
                  </div>

                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-1">
                      <h4
                        className={`text-xs truncate ${
                          !n.isRead
                            ? 'font-black text-slate-900 dark:text-white'
                            : 'font-bold text-slate-700 dark:text-slate-300'
                        }`}
                      >
                        {n.title}
                      </h4>
                      <span className="text-[10px] text-slate-400 shrink-0 font-medium">
                        {n.createdAt
                          ? new Date(n.createdAt).toLocaleTimeString('ar-EG', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : ''}
                      </span>
                    </div>

                    <p className="text-[11px] text-slate-600 dark:text-slate-400 line-clamp-2 leading-relaxed">
                      {n.body}
                    </p>

                    <div className="pt-1 flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-sky-600 flex items-center gap-1">
                        <span>عرض تفاصيل الطلب</span>
                        <ExternalLink className="w-2.5 h-2.5" />
                      </span>

                      {!n.isRead && (
                        <button
                          type="button"
                          onClick={(e) => handleMarkAsRead(n.id, e)}
                          className="text-[10px] text-slate-400 hover:text-slate-600 font-bold"
                          title="تعليم كمقروء"
                        >
                          تم القراءة
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
