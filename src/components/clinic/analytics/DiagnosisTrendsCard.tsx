'use client'

import React, { useState } from 'react'
import { Stethoscope, BarChart3, TrendingUp, AlertCircle, FileText, CheckCircle2 } from 'lucide-react'
import { DiagnosisItem } from '@/lib/analyticsService'

export interface DiagnosisTrendsCardProps {
  diagnoses: DiagnosisItem[]
  totalClinicalVisits: number
  confirmedCount: number
  unclassifiedCount: number
  isRtl?: boolean
  language?: string
}

export function DiagnosisTrendsCard({
  diagnoses,
  totalClinicalVisits,
  confirmedCount,
  unclassifiedCount,
  isRtl = true,
  language = 'ar'
}: DiagnosisTrendsCardProps) {
  const [filterMode, setFilterMode] = useState<'all' | 'confirmed' | 'unclassified'>('all')

  const filtered = diagnoses.filter((d) => {
    if (filterMode === 'confirmed') return !d.isUnclassified
    if (filterMode === 'unclassified') return d.isUnclassified
    return true
  })

  const maxCount = Math.max(...filtered.map((d) => d.patientCount), 1)

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
            <Stethoscope className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>«أكثر التشخيصات تسجيلًا في العيادة»</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Clinical diagnoses recorded by doctor in patient visits'
                : 'التشخيصات الطبية المعتمدة الموثقة بملفات الكشف والروشتات'}
            </p>
          </div>
        </div>

        {/* Filter Chips */}
        <div className="inline-flex rounded-xl p-0.5 bg-secondary/80 border border-border">
          <button
            type="button"
            onClick={() => setFilterMode('all')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filterMode === 'all'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {language === 'en' ? 'All' : 'الكل'} ({diagnoses.length})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('confirmed')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filterMode === 'confirmed'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {language === 'en' ? 'Confirmed' : 'مؤكد'} ({confirmedCount})
          </button>
          <button
            type="button"
            onClick={() => setFilterMode('unclassified')}
            className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
              filterMode === 'unclassified'
                ? 'bg-primary text-primary-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {language === 'en' ? 'Unclassified' : 'غير مصنف'} ({unclassifiedCount})
          </button>
        </div>
      </div>

      {/* Bar Chart & Comparison Rows */}
      {filtered.length === 0 ? (
        <div className="p-8 text-center text-xs text-muted-foreground">
          {language === 'en' ? 'No diagnoses recorded in this period' : 'لا توجد تشخيصات مسجلة في هذه الفترة'}
        </div>
      ) : (
        <div className="space-y-3 pt-1">
          {filtered.slice(0, 8).map((d, idx) => {
            const widthPct = Math.max(6, Math.round((d.patientCount / maxCount) * 100))
            return (
              <div key={d.normalizedKey + idx} className="space-y-1">
                <div className="flex items-center justify-between text-xs font-bold">
                  <span className="flex items-center gap-1.5 truncate">
                    <span className="w-5 h-5 rounded-md bg-secondary text-muted-foreground text-[10px] flex items-center justify-center shrink-0 font-mono">
                      {idx + 1}
                    </span>
                    <span className="text-foreground truncate">{d.name}</span>
                    {d.isUnclassified && (
                      <span className="text-[9px] px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold shrink-0">
                        {language === 'en' ? 'Unclassified' : 'غير مصنف'}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-muted-foreground shrink-0 ps-2">
                    <strong className="text-foreground">{d.patientCount}</strong> {language === 'en' ? 'pts' : 'مريض'}{' '}
                    <span className="text-primary font-bold">({d.percentage}%)</span>
                  </span>
                </div>

                {/* Progress Bar Track */}
                <div className="w-full h-3 rounded-full bg-secondary overflow-hidden">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-purple-500 transition-all duration-500"
                    style={{ width: `${widthPct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Clarification Footnote */}
      <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground leading-relaxed flex items-start gap-1.5">
        <AlertCircle className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
        <span>
          {language === 'en'
            ? 'Note: This analysis strictly reflects records documented in the clinic during the period and does not represent an epidemiological prevalence survey of the general population.'
            : 'تنويه: يعكس هذا التحليل سجلات العيادة الموثقة خلال الفترة المحددة فقط، ولا يقدم تقديرًا لانتشار الأمراض بين سكان المنطقة عمومًا.'}
        </span>
      </div>
    </div>
  )
}
