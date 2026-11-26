'use client'

import React from 'react'
import {
  Check,
  CheckCheck,
  Clock,
  WifiOff,
  Loader2,
  AlertTriangle,
  XCircle,
  Ban,
  TimerOff,
} from 'lucide-react'

export interface WhatsAppDeliveryBadgeProps {
  status?: string | null
  lastError?: string | null
  sentAt?: string | null
  deliveredAt?: string | null
  compact?: boolean
}

export function formatWhatsAppStatusMeta(status?: string | null) {
  switch (status) {
    case 'queued':
    case 'pending':
      return {
        labelAr: 'في طابور الإرسال',
        labelEn: 'Queued',
        classes: 'bg-sky-500/10 text-sky-700 dark:text-sky-300 border-sky-500/25',
        Icon: Clock,
      }
    case 'waiting_for_connection':
      return {
        labelAr: 'بانتظار اتصال الواتساب',
        labelEn: 'Waiting for Connection',
        classes: 'bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30',
        Icon: WifiOff,
      }
    case 'processing':
      return {
        labelAr: 'جاري الإرسال',
        labelEn: 'Processing',
        classes: 'bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border-indigo-500/25',
        Icon: Loader2,
      }
    case 'sent':
      return {
        labelAr: 'تم الإرسال لمزود الخدمة',
        labelEn: 'Sent to Provider',
        classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
        Icon: Check,
      }
    case 'delivered':
      return {
        labelAr: 'تم التسليم المؤكد',
        labelEn: 'Delivered',
        classes: 'bg-emerald-600/15 text-emerald-800 dark:text-emerald-200 border-emerald-500/40',
        Icon: CheckCheck,
      }
    case 'uncertain':
      return {
        labelAr: 'رد غير مؤكد (يحتاج مراجعة)',
        labelEn: 'Uncertain Outcome',
        classes: 'bg-orange-500/10 text-orange-700 dark:text-orange-300 border-orange-500/30',
        Icon: AlertTriangle,
      }
    case 'failed':
      return {
        labelAr: 'تعذر الإرسال',
        labelEn: 'Failed',
        classes: 'bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30',
        Icon: XCircle,
      }
    case 'cancelled':
      return {
        labelAr: 'ملغاة',
        labelEn: 'Cancelled',
        classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-300 border-slate-400/30',
        Icon: Ban,
      }
    case 'expired':
      return {
        labelAr: 'منتهية الصلاحية',
        labelEn: 'Expired',
        classes: 'bg-slate-500/10 text-slate-600 dark:text-slate-400 border-slate-400/25',
        Icon: TimerOff,
      }
    default:
      return {
        labelAr: 'إرسال تلقائي مفعّل',
        labelEn: 'Auto-Send Enabled',
        classes: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/25',
        Icon: Check,
      }
  }
}

export function WhatsAppDeliveryBadge({
  status,
  lastError,
  sentAt,
  deliveredAt,
  compact = false,
}: WhatsAppDeliveryBadgeProps) {
  const meta = formatWhatsAppStatusMeta(status)
  const Icon = meta.Icon
  const tooltip = deliveredAt
    ? `تم التسليم: ${new Date(deliveredAt).toLocaleString('ar-EG')}`
    : sentAt
    ? `أُرسل للمزود: ${new Date(sentAt).toLocaleString('ar-EG')}`
    : lastError || meta.labelAr

  return (
    <span
      title={tooltip}
      className={`inline-flex items-center gap-1.5 rounded-xl border font-bold ${
        compact ? 'px-2.5 py-1 text-[11px]' : 'px-3 py-1.5 text-xs'
      } ${meta.classes}`}
    >
      <Icon className={`w-3.5 h-3.5 shrink-0 ${status === 'processing' ? 'animate-spin' : ''}`} />
      <span>{meta.labelAr}</span>
    </span>
  )
}
