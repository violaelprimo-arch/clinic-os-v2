'use client'

import React from 'react'
import {
  Users, CheckCircle2, TrendingUp, Wallet, Clock, ShieldCheck,
  ArrowUpRight, ArrowDownRight, Minus, Lock, AlertCircle
} from 'lucide-react'
import { MetricDelta } from '@/lib/analyticsService'

export interface KpiCardData {
  titleAr: string
  titleEn: string
  value: string | number
  unit?: string
  subtextAr: string
  subtextEn: string
  delta?: MetricDelta | null
  icon: any
  colorClass: string
  bgClass: string
  borderClass: string
  isLocked?: boolean
  onClick?: () => void
}

export interface AnalyticsKpiCardsProps {
  uniquePatients: number
  uniquePatientsDelta?: MetricDelta | null
  completedVisits: number
  completedVisitsDelta?: MetricDelta | null
  attendanceRate: number
  attendanceRateDelta?: MetricDelta | null
  netCollections: number
  netCollectionsDelta?: MetricDelta | null
  avgWaitMins: number | null
  avgConsultMins: number | null
  validTimingCount: number
  completenessScore: number
  canViewFinance: boolean
  onOpenCompletenessModal?: () => void
  isRtl?: boolean
  language?: string
}

export function AnalyticsKpiCards({
  uniquePatients,
  uniquePatientsDelta,
  completedVisits,
  completedVisitsDelta,
  attendanceRate,
  attendanceRateDelta,
  netCollections,
  netCollectionsDelta,
  avgWaitMins,
  avgConsultMins,
  validTimingCount,
  completenessScore,
  canViewFinance,
  onOpenCompletenessModal,
  isRtl = true,
  language = 'ar'
}: AnalyticsKpiCardsProps) {
  const renderDelta = (delta?: MetricDelta | null) => {
    if (!delta) return null
    if (delta.isNeutral) {
      return (
        <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-muted-foreground bg-muted px-1.5 py-0.5 rounded-md">
          <Minus className="w-3 h-3" />
          <span>0%</span>
        </span>
      )
    }
    const isUp = delta.isIncrease
    return (
      <span
        className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
          isUp
            ? 'text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
            : 'text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20'
        }`}
      >
        {isUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
        <span>{delta.formattedDelta}</span>
      </span>
    )
  }

  const cards: KpiCardData[] = [
    // 1. Unique Patients
    {
      titleAr: 'إجمالي المرضى الفريدين',
      titleEn: 'Unique Patients',
      value: uniquePatients.toLocaleString(),
      subtextAr: 'مريض فريد بالعيادة (بدون تكرار)',
      subtextEn: 'Deduplicated unique patients',
      delta: uniquePatientsDelta,
      icon: Users,
      colorClass: 'text-primary',
      bgClass: 'bg-primary/10',
      borderClass: 'border-primary/25 hover:border-primary/50'
    },
    // 2. Completed Visits
    {
      titleAr: 'الزيارات الطبية المكتملة',
      titleEn: 'Completed Visits',
      value: completedVisits.toLocaleString(),
      subtextAr: 'كشف مكتمل وموثق في الفترة',
      subtextEn: 'Completed clinical consultations',
      delta: completedVisitsDelta,
      icon: CheckCircle2,
      colorClass: 'text-cyan-600 dark:text-cyan-400',
      bgClass: 'bg-cyan-500/10',
      borderClass: 'border-cyan-500/25 hover:border-cyan-500/50'
    },
    // 3. Attendance Rate
    {
      titleAr: 'نسبة حضور المرضى',
      titleEn: 'Attendance Rate',
      value: `${attendanceRate}%`,
      subtextAr: 'من إجمالي المواعيد المحسومة',
      subtextEn: 'Of all resolved bookings',
      delta: attendanceRateDelta,
      icon: TrendingUp,
      colorClass: 'text-emerald-600 dark:text-emerald-400',
      bgClass: 'bg-emerald-500/10',
      borderClass: 'border-emerald-500/25 hover:border-emerald-500/50'
    },
    // 4. Net Collections
    {
      titleAr: 'صافي التحصيل المؤكد',
      titleEn: 'Net Collections',
      value: canViewFinance ? `${netCollections.toLocaleString()} ج.م` : '••••••',
      subtextAr: canViewFinance ? 'المحصل فعلياً بعد المرتجعات' : 'خاص بصلاحيات الطبيب والمالية',
      subtextEn: canViewFinance ? 'Confirmed collections net of refunds' : 'Restricted to Finance permission',
      delta: canViewFinance ? netCollectionsDelta : null,
      icon: canViewFinance ? Wallet : Lock,
      colorClass: 'text-amber-600 dark:text-amber-400',
      bgClass: 'bg-amber-500/10',
      borderClass: 'border-amber-500/25 hover:border-amber-500/50',
      isLocked: !canViewFinance
    },
    // 5. Avg Timing
    {
      titleAr: 'متوسط الانتظار والكشف',
      titleEn: 'Avg Wait & Consultation',
      value: avgConsultMins !== null ? `${avgConsultMins} دقيقة` : '—',
      subtextAr: avgWaitMins !== null
        ? `انتظار: ${avgWaitMins} د • حساب من ${validTimingCount} كشف`
        : `حساب من ${validTimingCount} كشف مكتمل`,
      subtextEn: avgWaitMins !== null
        ? `Wait: ${avgWaitMins}m • based on ${validTimingCount} visits`
        : `Based on ${validTimingCount} visits`,
      delta: null,
      icon: Clock,
      colorClass: 'text-purple-600 dark:text-purple-400',
      bgClass: 'bg-purple-500/10',
      borderClass: 'border-purple-500/25 hover:border-purple-500/50'
    },
    // 6. Data Completeness
    {
      titleAr: 'مؤشر اكتمال السجلات',
      titleEn: 'Data Completeness',
      value: `${completenessScore}%`,
      subtextAr: 'العمر، المنطقة، التشخيص، التوقيت',
      subtextEn: 'Age, Region, Diagnosis, Timings',
      delta: null,
      icon: ShieldCheck,
      colorClass: completenessScore >= 80 ? 'text-emerald-600 dark:text-emerald-400' : 'text-amber-600 dark:text-amber-400',
      bgClass: completenessScore >= 80 ? 'bg-emerald-500/10' : 'bg-amber-500/10',
      borderClass: 'border-emerald-500/25 hover:border-emerald-500/50',
      onClick: onOpenCompletenessModal
    }
  ]

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-3.5">
      {cards.map((c, i) => {
        const IconComponent = c.icon
        return (
          <div
            key={i}
            onClick={c.onClick}
            className={`ios-glass-card p-4 rounded-3xl border shadow-xs transition-all duration-300 relative overflow-hidden group ${
              c.borderClass
            } ${c.onClick ? 'cursor-pointer hover:-translate-y-1' : ''}`}
          >
            {/* Top row: Label & Icon */}
            <div className="flex items-start justify-between gap-2">
              <span className="text-[11px] font-bold text-muted-foreground line-clamp-1">
                {language === 'en' ? c.titleEn : c.titleAr}
              </span>
              <div className={`w-7 h-7 rounded-xl ${c.bgClass} ${c.colorClass} flex items-center justify-center shrink-0`}>
                <IconComponent className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Value & Delta */}
            <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
              <span className="text-xl sm:text-2xl font-black font-mono text-foreground tracking-tight">
                {c.value}
              </span>
              {renderDelta(c.delta)}
            </div>

            {/* Subtext description */}
            <p className="text-[10px] text-muted-foreground font-medium mt-1 line-clamp-1" title={language === 'en' ? c.subtextEn : c.subtextAr}>
              {language === 'en' ? c.subtextEn : c.subtextAr}
            </p>
          </div>
        )
      })}
    </div>
  )
}
