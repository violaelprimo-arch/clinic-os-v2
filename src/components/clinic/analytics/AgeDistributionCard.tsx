'use client'

import React, { useState } from 'react'
import { Users, Baby, Activity, AlertCircle, FileSpreadsheet, Eye } from 'lucide-react'
import { AgeAnalysisResult, AgeCategory } from '@/lib/analyticsService'

export interface AgeDistributionCardProps {
  ageAnalysis: AgeAnalysisResult
  totalPatients: number
  isRtl?: boolean
  language?: string
}

export function AgeDistributionCard({
  ageAnalysis,
  totalPatients,
  isRtl = true,
  language = 'ar'
}: AgeDistributionCardProps) {
  const [hoveredCategory, setHoveredCategory] = useState<AgeCategory | null>(null)
  const [showTableModal, setShowTableModal] = useState(false)

  const {
    meanAge,
    medianAge,
    validAgeCount,
    missingAgeCount,
    missingAgePercentage,
    invalidAgeCount,
    pediatricInfantsCount,
    categories
  } = ageAnalysis

  // SVG Donut calculation
  const size = 200
  const strokeWidth = 24
  const radius = (size - strokeWidth) / 2
  const center = size / 2
  const circumference = 2 * Math.PI * radius

  let accumulatedPercentage = 0

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Age Distribution Analysis' : 'تحليل الفئات والأعمار للمرضى'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Non-overlapping age brackets calculated at first completed visit'
                : 'فئات عمرية غير متداخلة محسوبة عند أول زيارة مكتملة'}
            </p>
          </div>
        </div>

        {/* Modal Table Button */}
        <button
          type="button"
          onClick={() => setShowTableModal(!showTableModal)}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border/70 transition-all cursor-pointer"
        >
          <Eye className="w-3.5 h-3.5 text-primary" />
          <span>{showTableModal ? (language === 'en' ? 'Show Chart' : 'عرض الرسم') : (language === 'en' ? 'Detailed Table' : 'جدول التفاصيل')}</span>
        </button>
      </div>

      {/* 4 Stat Badges Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Mean Age */}
        <div className="p-3 rounded-2xl bg-card border border-border/60 text-center">
          <span className="text-[10px] font-bold text-muted-foreground block">
            {language === 'en' ? 'Mean Age:' : 'متوسط العمر:'}
          </span>
          <span className="text-lg font-black font-mono text-primary mt-0.5 block">
            {meanAge !== null ? `${meanAge} ${language === 'en' ? 'yrs' : 'سنة'}` : '—'}
          </span>
        </div>

        {/* Median Age */}
        <div className="p-3 rounded-2xl bg-card border border-border/60 text-center">
          <span className="text-[10px] font-bold text-muted-foreground block">
            {language === 'en' ? 'Median Age:' : 'الوسيط العمري:'}
          </span>
          <span className="text-lg font-black font-mono text-cyan-600 dark:text-cyan-400 mt-0.5 block">
            {medianAge !== null ? `${medianAge} ${language === 'en' ? 'yrs' : 'سنة'}` : '—'}
          </span>
        </div>

        {/* Valid Records */}
        <div className="p-3 rounded-2xl bg-card border border-border/60 text-center">
          <span className="text-[10px] font-bold text-muted-foreground block">
            {language === 'en' ? 'Valid Records:' : 'أعمار صالحة:'}
          </span>
          <span className="text-lg font-black font-mono text-emerald-600 dark:text-emerald-400 mt-0.5 block">
            {validAgeCount} <span className="text-[10px] text-muted-foreground">{language === 'en' ? 'pts' : 'مريض'}</span>
          </span>
        </div>

        {/* Missing / Unrecorded */}
        <div className="p-3 rounded-2xl bg-card border border-border/60 text-center">
          <span className="text-[10px] font-bold text-muted-foreground block">
            {language === 'en' ? 'Missing Age:' : 'ملفات بدون عمر:'}
          </span>
          <span className="text-lg font-black font-mono text-amber-600 dark:text-amber-400 mt-0.5 block">
            {missingAgeCount} <span className="text-[10px] text-muted-foreground">({missingAgePercentage}%)</span>
          </span>
        </div>
      </div>

      {/* Main Content: Donut Chart or Table */}
      {!showTableModal ? (
        <div className="flex flex-col md:flex-row items-center justify-around gap-6 pt-2">
          {/* SVG Donut Chart with Center Callout */}
          <div className="relative w-[200px] h-[200px] shrink-0 select-none">
            <svg width={size} height={size} className="transform -rotate-90">
              {/* Background Track */}
              <circle
                cx={center}
                cy={center}
                r={radius}
                stroke="#334155"
                strokeWidth={strokeWidth}
                fill="none"
                opacity="0.15"
              />

              {/* Slices */}
              {validAgeCount > 0 &&
                categories.map((c) => {
                  const strokeDasharray = `${(c.percentage / 100) * circumference} ${circumference}`
                  const strokeDashoffset = -((accumulatedPercentage / 100) * circumference)
                  accumulatedPercentage += c.percentage

                  const isHovered = hoveredCategory?.id === c.id

                  return (
                    <circle
                      key={c.id}
                      cx={center}
                      cy={center}
                      r={radius}
                      stroke={c.color}
                      strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
                      strokeDasharray={strokeDasharray}
                      strokeDashoffset={strokeDashoffset}
                      fill="none"
                      className="cursor-pointer transition-all duration-200"
                      onMouseEnter={() => setHoveredCategory(c)}
                      onMouseLeave={() => setHoveredCategory(null)}
                    />
                  )
                })}
            </svg>

            {/* Center Label */}
            <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
              {hoveredCategory ? (
                <>
                  <span className="text-xs font-black" style={{ color: hoveredCategory.color }}>
                    {hoveredCategory.percentage}%
                  </span>
                  <span className="text-[10px] font-bold text-foreground font-mono">
                    {hoveredCategory.count} {language === 'en' ? 'pts' : 'مريض'}
                  </span>
                  <span className="text-[9px] text-muted-foreground font-medium">
                    {hoveredCategory.range} {language === 'en' ? 'yrs' : 'سنة'}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-xl font-black font-mono text-foreground">{validAgeCount}</span>
                  <span className="text-[10px] text-muted-foreground font-bold">{language === 'en' ? 'Patients' : 'مريض'}</span>
                </>
              )}
            </div>
          </div>

          {/* Categories Legend & Breakdown List */}
          <div className="w-full max-w-md space-y-2">
            {categories.map((c) => {
              const isHovered = hoveredCategory?.id === c.id
              return (
                <div
                  key={c.id}
                  onMouseEnter={() => setHoveredCategory(c)}
                  onMouseLeave={() => setHoveredCategory(null)}
                  className={`p-2.5 rounded-2xl border transition-all cursor-pointer flex items-center justify-between gap-3 ${
                    isHovered
                      ? 'bg-muted/80 border-primary shadow-xs'
                      : 'bg-card border-border/70 hover:bg-muted/40'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: c.color }} />
                    <span className="text-xs font-black text-foreground">
                      {language === 'en' ? c.labelEn : c.labelAr}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 font-mono">
                    <span className="text-xs font-bold text-muted-foreground">
                      {c.count} {language === 'en' ? 'pts' : 'مريض'}
                    </span>
                    <span className="text-xs font-black px-2 py-0.5 rounded-lg bg-secondary text-foreground">
                      {c.percentage}%
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ) : (
        /* Detailed Exportable Table View */
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-start">
            <thead className="bg-secondary/70 text-muted-foreground font-bold border-b border-border/80">
              <tr>
                <th className="py-2 px-3 text-start">{language === 'en' ? 'Age Bracket' : 'الفئة العمرية'}</th>
                <th className="py-2 px-3 text-start">{language === 'en' ? 'Range' : 'النطاق'}</th>
                <th className="py-2 px-3 text-center">{language === 'en' ? 'Unique Patients' : 'المرضى الفريدين'}</th>
                <th className="py-2 px-3 text-center">{language === 'en' ? 'Percentage' : 'النسبة'}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {categories.map((c) => (
                <tr key={c.id} className="hover:bg-muted/30">
                  <td className="py-2 px-3 font-bold flex items-center gap-1.5">
                    <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: c.color }} />
                    <span>{language === 'en' ? c.labelEn : c.labelAr}</span>
                  </td>
                  <td className="py-2 px-3 font-mono text-muted-foreground">{c.range} سنة</td>
                  <td className="py-2 px-3 text-center font-bold font-mono">{c.count}</td>
                  <td className="py-2 px-3 text-center font-bold font-mono text-primary">{c.percentage}%</td>
                </tr>
              ))}
              <tr className="bg-muted/40 font-bold">
                <td className="py-2 px-3">{language === 'en' ? 'Missing / Unrecorded Age' : 'أعمار غير مسجلة'}</td>
                <td className="py-2 px-3 font-mono text-muted-foreground">—</td>
                <td className="py-2 px-3 text-center font-mono text-amber-600">{missingAgeCount}</td>
                <td className="py-2 px-3 text-center font-mono text-amber-600">{missingAgePercentage}%</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* Pediatric Infants & Excluded Footnote */}
      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between text-[11px] text-muted-foreground gap-2">
        <span className="flex items-center gap-1.5">
          <Baby className="w-3.5 h-3.5 text-cyan-500" />
          <span>
            {language === 'en' ? 'Pediatric infants (< 1 yr):' : 'أطفال رضع (< سنة):'}{' '}
            <strong className="text-foreground">{pediatricInfantsCount}</strong>
          </span>
        </span>
        {invalidAgeCount > 0 && (
          <span className="text-amber-600 dark:text-amber-400 font-bold">
            {language === 'en' ? 'Excluded invalid entries:' : 'قيم غير صالحة مستبعدة من المتوسط:'}{' '}
            {invalidAgeCount}
          </span>
        )}
      </div>
    </div>
  )
}
