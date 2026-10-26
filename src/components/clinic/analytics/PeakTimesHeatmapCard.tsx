'use client'

import React, { useState } from 'react'
import { Flame, Clock, Calendar, Info } from 'lucide-react'
import { HeatmapCell } from '@/lib/analyticsService'

export interface PeakTimesHeatmapCardProps {
  cells: HeatmapCell[]
  maxDensity: number
  peakCell: HeatmapCell | null
  mode: 'booked' | 'actual'
  setMode: (mode: 'booked' | 'actual') => void
  isRtl?: boolean
  language?: string
}

export function PeakTimesHeatmapCard({
  cells,
  maxDensity,
  peakCell,
  mode,
  setMode,
  isRtl = true,
  language = 'ar'
}: PeakTimesHeatmapCardProps) {
  const [activeCell, setActiveCell] = useState<HeatmapCell | null>(null)

  const days = [
    { idx: 0, ar: 'السبت', en: 'Sat' },
    { idx: 1, ar: 'الأحد', en: 'Sun' },
    { idx: 2, ar: 'الاثنين', en: 'Mon' },
    { idx: 3, ar: 'الثلاثاء', en: 'Tue' },
    { idx: 4, ar: 'الأربعاء', en: 'Wed' },
    { idx: 5, ar: 'الخميس', en: 'Thu' },
    { idx: 6, ar: 'الجمعة', en: 'Fri' }
  ]

  const hours = [9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22]

  const getCellFor = (dayIdx: number, hour: number) => {
    return cells.find((c) => c.dayIndex === dayIdx && c.hour === hour) || null
  }

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
            <Flame className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Peak Hours & Traffic Heatmap' : 'خريطة أوقات الذروة وازدحام العيادة'}</span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Density matrix by day of the week and hour of the day'
                : 'مصفوفة الكثافة باليوم والساعة لتحديد فترات الذروة بالعيادة'}
            </p>
          </div>
        </div>

        {/* Toggle Mode & Peak Callout */}
        <div className="flex items-center gap-2 flex-wrap">
          {peakCell && (
            <span className="text-[10px] font-bold px-2.5 py-1 rounded-xl bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/25 flex items-center gap-1">
              <Flame className="w-3.5 h-3.5" />
              <span>
                {language === 'en' ? 'Peak Hour:' : 'أعلى ذروة:'} {peakCell.dayLabelAr} ({peakCell.hourLabelAr}) — {peakCell.count} كشف
              </span>
            </span>
          )}

          <div className="inline-flex rounded-xl p-0.5 bg-secondary/80 border border-border">
            <button
              type="button"
              onClick={() => setMode('booked')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'booked'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {language === 'en' ? 'Booked Times' : 'المواعيد المحجوزة'}
            </button>
            <button
              type="button"
              onClick={() => setMode('actual')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                mode === 'actual'
                  ? 'bg-primary text-primary-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {language === 'en' ? 'Actual Attendance' : 'الحضور الفعلي'}
            </button>
          </div>
        </div>
      </div>

      {/* Heatmap Grid Matrix */}
      <div className="overflow-x-auto select-none pt-1">
        <div className="min-w-[700px] space-y-1.5">
          {/* Hours Header Row */}
          <div className="grid grid-cols-15 gap-1.5 items-center text-center text-[10px] font-bold text-muted-foreground pb-1">
            <div className="col-span-1 text-start ps-1">{language === 'en' ? 'Day' : 'اليوم'}</div>
            {hours.map((h) => {
              const isPm = h >= 12
              const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
              return (
                <div key={h} className="col-span-1 truncate font-mono">
                  {h12}{isPm ? 'م' : 'ص'}
                </div>
              )
            })}
          </div>

          {/* Days Rows */}
          {days.map((d) => (
            <div key={d.idx} className="grid grid-cols-15 gap-1.5 items-center">
              {/* Day Label */}
              <div className="col-span-1 text-xs font-black text-foreground truncate ps-1">
                {language === 'en' ? d.en : d.ar}
              </div>

              {/* Hour Cells */}
              {hours.map((h) => {
                const cell = getCellFor(d.idx, h)
                const count = cell?.count || 0
                const intensity = cell?.intensity || 0
                const isSelected = activeCell?.dayIndex === d.idx && activeCell?.hour === h

                // Color based on intensity
                let bgStyle = 'bg-secondary/40 text-muted-foreground'
                if (intensity > 0.75) {
                  bgStyle = 'bg-amber-500 text-white font-black shadow-xs shadow-amber-500/20'
                } else if (intensity > 0.5) {
                  bgStyle = 'bg-primary text-white font-black shadow-xs shadow-primary/20'
                } else if (intensity > 0.25) {
                  bgStyle = 'bg-cyan-500/35 text-cyan-900 dark:text-cyan-100 font-bold'
                } else if (intensity > 0) {
                  bgStyle = 'bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold'
                }

                return (
                  <button
                    key={h}
                    type="button"
                    onClick={() => setActiveCell(isSelected ? null : cell)}
                    className={`col-span-1 h-9 rounded-xl flex items-center justify-center text-xs font-mono transition-all cursor-pointer ${bgStyle} ${
                      isSelected ? 'ring-2 ring-foreground scale-105 z-10' : 'hover:scale-105'
                    }`}
                    title={`${d.ar} ${h}:00 — ${count} كشف`}
                  >
                    {count > 0 ? count : '·'}
                  </button>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* Selected Cell Callout & Color Legend */}
      <div className="pt-2 border-t border-border/60 flex flex-wrap items-center justify-between gap-3 text-xs">
        {activeCell ? (
          <div className="inline-flex items-center gap-2 p-2 rounded-xl bg-muted/60 text-foreground font-bold">
            <Clock className="w-3.5 h-3.5 text-primary" />
            <span>
              {activeCell.dayLabelAr} {activeCell.hourLabelAr}: <strong>{activeCell.count} كشف مسجل</strong>
            </span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground">
            {language === 'en' ? 'Click any cell to inspect exact patient volume' : 'اضغط على أي خانة لعرض تفاصيل الكثافة'}
          </span>
        )}

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>{language === 'en' ? 'Density:' : 'التدرج:'}</span>
          <span className="px-2 py-0.5 rounded-md bg-secondary text-[10px] font-bold">هادئ</span>
          <span className="px-2 py-0.5 rounded-md bg-cyan-500/20 text-cyan-700 text-[10px] font-bold">معتدل</span>
          <span className="px-2 py-0.5 rounded-md bg-primary text-white text-[10px] font-bold">مزدحم</span>
          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white text-[10px] font-black">ذروة قصوى 🔥</span>
        </div>
      </div>
    </div>
  )
}
