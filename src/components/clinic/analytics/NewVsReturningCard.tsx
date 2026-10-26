'use client'

import React from 'react'
import { UserPlus, UserCheck, TrendingUp, Users } from 'lucide-react'

export interface NewVsReturningCardProps {
  newPatientsCount: number
  newPatientsPercentage: number
  returningPatientsCount: number
  returningPatientsPercentage: number
  totalPatients: number
  timelineTrend?: Array<{ label: string; newCount: number; returningCount: number }>
  isRtl?: boolean
  language?: string
}

export function NewVsReturningCard({
  newPatientsCount,
  newPatientsPercentage,
  returningPatientsCount,
  returningPatientsPercentage,
  totalPatients,
  timelineTrend = [],
  isRtl = true,
  language = 'ar'
}: NewVsReturningCardProps) {
  // SVG Donut calculation
  const size = 180
  const strokeWidth = 22
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  const newOffset = 0
  const newLength = (newPatientsPercentage / 100) * circumference
  const retLength = (returningPatientsPercentage / 100) * circumference
  const retOffset = -newLength

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <UserCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'New vs. Returning Patients' : 'المرضى الجدد والعائدون'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Retention and acquisition: first-ever visit vs repeat visits'
                : 'اكتساب المرضى الجدد ومعدل ولاء وعودة المرضى السابقين'}
            </p>
          </div>
        </div>
      </div>

      {/* Donut & Stats Row */}
      <div className="flex flex-col sm:flex-row items-center justify-around gap-6 pt-1">
        {/* Donut */}
        <div className="relative w-[180px] h-[180px] shrink-0 select-none">
          <svg width={size} height={size} className="transform -rotate-90">
            {/* Background track */}
            <circle
              cx={center}
              cy={center}
              r={radius}
              stroke="#334155"
              strokeWidth={strokeWidth}
              fill="none"
              opacity="0.15"
            />

            {totalPatients > 0 && (
              <>
                {/* New Patients Slice */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke="#00F0FF"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${newLength} ${circumference}`}
                  strokeDashoffset={newOffset}
                  fill="none"
                  className="transition-all duration-300"
                />

                {/* Returning Patients Slice */}
                <circle
                  cx={center}
                  cy={center}
                  r={radius}
                  stroke="#087CF4"
                  strokeWidth={strokeWidth}
                  strokeDasharray={`${retLength} ${circumference}`}
                  strokeDashoffset={retOffset}
                  fill="none"
                  className="transition-all duration-300"
                />
              </>
            )}
          </svg>

          {/* Center Callout */}
          <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
            <span className="text-xl font-black font-mono text-foreground">{totalPatients}</span>
            <span className="text-[10px] text-muted-foreground font-bold">{language === 'en' ? 'Patients' : 'مريض'}</span>
          </div>
        </div>

        {/* 2 Big Stat Cards */}
        <div className="w-full max-w-xs space-y-3">
          {/* New Patients Card */}
          <div className="p-3.5 rounded-2xl bg-cyan-500/10 border border-cyan-500/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-cyan-500/20 text-cyan-600 dark:text-cyan-400 flex items-center justify-center">
                <UserPlus className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-foreground block">
                  {language === 'en' ? 'New Patients' : 'مرضى جدد'}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium block">
                  {language === 'en' ? 'First visit in this period' : 'أول زيارة لهم في العيادة'}
                </span>
              </div>
            </div>

            <div className="text-end font-mono">
              <span className="text-sm font-black text-foreground block">{newPatientsCount}</span>
              <span className="text-xs font-black text-cyan-600 dark:text-cyan-400 block">{newPatientsPercentage}%</span>
            </div>
          </div>

          {/* Returning Patients Card */}
          <div className="p-3.5 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-primary/20 text-primary flex items-center justify-center">
                <UserCheck className="w-4 h-4" />
              </div>
              <div>
                <span className="text-xs font-black text-foreground block">
                  {language === 'en' ? 'Returning Patients' : 'مرضى عائدون'}
                </span>
                <span className="text-[10px] text-muted-foreground font-medium block">
                  {language === 'en' ? 'Had prior completed visits' : 'لديهم كشف سابق مسجل'}
                </span>
              </div>
            </div>

            <div className="text-end font-mono">
              <span className="text-sm font-black text-foreground block">{returningPatientsCount}</span>
              <span className="text-xs font-black text-primary block">{returningPatientsPercentage}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Footnote */}
      <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex items-center justify-between">
        <span>✓ الفئتان مانعتان للجمع تماماً (100% بدون تكرار المريض).</span>
        <span className="font-bold text-foreground">
          {newPatientsPercentage > returningPatientsPercentage
            ? '🚀 معدل اكتساب مرضى جدد مرتفع'
            : '⭐ معدل ولاء ومتابعة قوي'}
        </span>
      </div>
    </div>
  )
}
