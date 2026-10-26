'use client'

import React from 'react'
import { CheckCircle2, XCircle, AlertTriangle, CalendarCheck, HelpCircle } from 'lucide-react'
import { AttendanceMetrics } from '@/lib/analyticsService'

export interface AttendanceNoShowCardProps {
  metrics: AttendanceMetrics
  isRtl?: boolean
  language?: string
}

export function AttendanceNoShowCard({
  metrics,
  isRtl = true,
  language = 'ar'
}: AttendanceNoShowCardProps) {
  const {
    totalResolved,
    totalUndecided,
    completedCount,
    cancelledCount,
    noShowCount,
    skippedCount,
    attendanceRate,
    cancellationRate,
    noShowRate
  } = metrics

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
            <CalendarCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Attendance, Cancellation & No-Show' : 'نسب الحضور والإلغاء وعدم الحضور'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Rate of completed appointments vs cancellations & no-shows'
                : 'معدل الحضور الفعلي للمواعيد المحسومة واستبعاد الحجوزات القادمة'}
            </p>
          </div>
        </div>

        {/* Undecided Notice */}
        {totalUndecided > 0 && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-secondary text-muted-foreground border border-border/70">
            <HelpCircle className="w-3.5 h-3.5" />
            <span>{totalUndecided} {language === 'en' ? 'Upcoming / Undecided' : 'حجز قادم / غير محسوم'}</span>
          </div>
        )}
      </div>

      {/* 3 Metric Gauges Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {/* Card 1: Attendance */}
        <div className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/25 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-emerald-700 dark:text-emerald-400">
              {language === 'en' ? 'Attendance Rate' : 'نسبة الحضور الملتزم'}
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400">
              {attendanceRate}%
            </span>
            <span className="text-xs font-bold text-muted-foreground font-mono">
              ({completedCount} {language === 'en' ? 'attended' : 'حضر'})
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-emerald-500/20 overflow-hidden">
            <div
              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
              style={{ width: `${attendanceRate}%` }}
            />
          </div>
        </div>

        {/* Card 2: Cancellation */}
        <div className="p-4 rounded-3xl bg-amber-500/10 border border-amber-500/25 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-amber-700 dark:text-amber-400">
              {language === 'en' ? 'Cancellation Rate' : 'نسبة الإلغاء المسبق'}
            </span>
            <XCircle className="w-4 h-4 text-amber-600" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-amber-600 dark:text-amber-400">
              {cancellationRate}%
            </span>
            <span className="text-xs font-bold text-muted-foreground font-mono">
              ({cancelledCount} {language === 'en' ? 'cancelled' : 'أُلغي'})
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-amber-500/20 overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${cancellationRate}%` }}
            />
          </div>
        </div>

        {/* Card 3: No-Show */}
        <div className="p-4 rounded-3xl bg-rose-500/10 border border-rose-500/25 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-rose-700 dark:text-rose-400">
              {language === 'en' ? 'No-Show Rate' : 'نسبة عدم الحضور (غياب)'}
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>

          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400">
              {noShowRate}%
            </span>
            <span className="text-xs font-bold text-muted-foreground font-mono">
              ({noShowCount} {language === 'en' ? 'no-show' : 'لم يحضر'})
            </span>
          </div>

          {/* Progress bar */}
          <div className="w-full h-2 rounded-full bg-rose-500/20 overflow-hidden">
            <div
              className="h-full bg-rose-500 rounded-full transition-all duration-500"
              style={{ width: `${noShowRate}%` }}
            />
          </div>
        </div>
      </div>

      {/* Explanatory Footnote & Denominator Callout */}
      <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
        <span>
          📌 <strong>المقام المعتمد في الحساب:</strong> إجمالي الحجوزات المحسومة داخل الفترة ({totalResolved} حجز).
        </span>
        <span>
          تم استبعاد الحجوزات القادمة ({totalUndecided}) تجنباً لاحتسابها غياباً بالخطأ.
        </span>
      </div>
    </div>
  )
}
