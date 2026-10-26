'use client'

import React from 'react'
import { Clock, Hourglass, Stethoscope, AlertCircle, CheckCircle2 } from 'lucide-react'
import { TimingMetrics } from '@/lib/analyticsService'

export interface ServiceTimingBreakdown {
  serviceName: string
  meanWaitMins: number | null
  meanConsultMins: number | null
  visitsCount: number
}

export interface WaitingDurationCardProps {
  metrics: TimingMetrics
  serviceBreakdown?: ServiceTimingBreakdown[]
  isRtl?: boolean
  language?: string
}

export function WaitingDurationCard({
  metrics,
  serviceBreakdown = [],
  isRtl = true,
  language = 'ar'
}: WaitingDurationCardProps) {
  const {
    validWaitingCount,
    meanWaitingMinutes,
    medianWaitingMinutes,
    validConsultationCount,
    meanConsultationMinutes,
    medianConsultationMinutes,
    excludedWaitingOutliersCount,
    excludedConsultationOutliersCount
  } = metrics

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Clock className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Waiting & Consultation Durations' : 'الانتظار ومدة الكشف الفعلي'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Calculated from actual recorded check-in, start, and completion timestamps'
                : 'محسوبة من التوقيتات الفعلية المسجلة من الحضور للدخول ثم إنهاء الكشف'}
            </p>
          </div>
        </div>

        {/* Excluded Outliers Callout */}
        {(excludedWaitingOutliersCount > 0 || excludedConsultationOutliersCount > 0) && (
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20">
            <AlertCircle className="w-3.5 h-3.5" />
            <span>
              تم استبعاد {excludedWaitingOutliersCount + excludedConsultationOutliersCount} سجل غير مكتمل التوقيتات
            </span>
          </div>
        )}
      </div>

      {/* 2 Main Metric Blocks: Waiting Time vs Consultation Time */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Waiting Block */}
        <div className="p-4 rounded-3xl bg-secondary/40 border border-border/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <Hourglass className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-black text-foreground">
                {language === 'en' ? 'Patient Waiting Time' : 'زمن انتظار المريض بالعيادة'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono font-bold">
              {validWaitingCount} {language === 'en' ? 'valid visits' : 'كشف موثق'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-card border border-border/60 text-center">
              <span className="text-[10px] font-bold text-muted-foreground block">
                {language === 'en' ? 'Mean (Average)' : 'المتوسط الحسابي'}
              </span>
              <span className="text-xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-1 block">
                {meanWaitingMinutes !== null ? `${meanWaitingMinutes} د` : '—'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-card border border-border/60 text-center">
              <span className="text-[10px] font-bold text-muted-foreground block">
                {language === 'en' ? 'Median (Middle)' : 'الوسيط الإحصائي'}
              </span>
              <span className="text-xl font-black font-mono text-cyan-600 dark:text-cyan-400 mt-1 block">
                {medianWaitingMinutes !== null ? `${medianWaitingMinutes} د` : '—'}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            محسوب من لحظة تسجيل وصول المريض للعيادة وحتى لحظة النداء والدخول لغرفة الكشف.
          </p>
        </div>

        {/* Consultation Duration Block */}
        <div className="p-4 rounded-3xl bg-secondary/40 border border-border/80 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-primary/15 text-primary flex items-center justify-center">
                <Stethoscope className="w-3.5 h-3.5" />
              </div>
              <span className="text-xs font-black text-foreground">
                {language === 'en' ? 'Consultation Duration' : 'مدة الكشف الفعلي مع الطبيب'}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground font-mono font-bold">
              {validConsultationCount} {language === 'en' ? 'valid visits' : 'كشف موثق'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 pt-1">
            <div className="p-3 rounded-2xl bg-card border border-border/60 text-center">
              <span className="text-[10px] font-bold text-muted-foreground block">
                {language === 'en' ? 'Mean (Average)' : 'المتوسط الحسابي'}
              </span>
              <span className="text-xl font-black font-mono text-primary mt-1 block">
                {meanConsultationMinutes !== null ? `${meanConsultationMinutes} د` : '—'}
              </span>
            </div>

            <div className="p-3 rounded-2xl bg-card border border-border/60 text-center">
              <span className="text-[10px] font-bold text-muted-foreground block">
                {language === 'en' ? 'Median (Middle)' : 'الوسيط الإحصائي'}
              </span>
              <span className="text-xl font-black font-mono text-primary mt-1 block">
                {medianConsultationMinutes !== null ? `${medianConsultationMinutes} د` : '—'}
              </span>
            </div>
          </div>

          <p className="text-[10px] text-muted-foreground leading-relaxed">
            محسوب من لحظة بدء الكشف بالداخل وحتى تسجيل إنهاء الكشف وإصدار الروشتة.
          </p>
        </div>
      </div>

      {/* Services Breakdown Table if available */}
      {serviceBreakdown.length > 0 && (
        <div className="pt-2 border-t border-border/60 space-y-2">
          <h4 className="text-xs font-black text-foreground">
            {language === 'en' ? 'Durations Breakdown by Service:' : 'متوسط الانتظار والكشف حسب الخدمة الطبية:'}
          </h4>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start">
              <thead className="bg-secondary/70 text-muted-foreground font-bold">
                <tr>
                  <th className="py-2 px-3 text-start">الخدمة الطبية</th>
                  <th className="py-2 px-3 text-center">متوسط الانتظار</th>
                  <th className="py-2 px-3 text-center">متوسط مدة الكشف</th>
                  <th className="py-2 px-3 text-center">عدد الكشوفات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {serviceBreakdown.map((s, idx) => (
                  <tr key={idx} className="hover:bg-muted/30 font-medium">
                    <td className="py-2 px-3 font-bold text-foreground">{s.serviceName}</td>
                    <td className="py-2 px-3 text-center font-mono text-cyan-600 dark:text-cyan-400">
                      {s.meanWaitMins !== null ? `${s.meanWaitMins} د` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-primary">
                      {s.meanConsultMins !== null ? `${s.meanConsultMins} د` : '—'}
                    </td>
                    <td className="py-2 px-3 text-center font-mono text-muted-foreground">{s.visitsCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
