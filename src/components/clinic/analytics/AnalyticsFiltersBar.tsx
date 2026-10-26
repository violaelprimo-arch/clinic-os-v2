'use client'

import React from 'react'
import {
  Calendar, Building2, Filter, RefreshCw, FileSpreadsheet,
  Printer, ArrowRightLeft, Layers, Stethoscope, Clock
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { DateRange, PeriodComparison } from '@/lib/analyticsService'

export interface AnalyticsFiltersBarProps {
  datePreset: 'today' | 'week' | 'month' | 'year' | 'custom'
  setDatePreset: (preset: 'today' | 'week' | 'month' | 'year' | 'custom') => void
  dateRange: DateRange
  setDateRange: (range: DateRange) => void
  branches: any[]
  selectedBranchId: string
  setSelectedBranchId: (id: string) => void
  services: any[]
  selectedServiceId: string
  setSelectedServiceId: (id: string) => void
  comparePrevious: boolean
  setComparePrevious: (comp: boolean) => void
  comparison: PeriodComparison
  isLoading: boolean
  onRefresh: () => void
  onExportExcel: () => void
  onExportPdf: () => void
  lastUpdatedText: string
  isRtl?: boolean
  language?: string
}

export function AnalyticsFiltersBar({
  datePreset,
  setDatePreset,
  dateRange,
  setDateRange,
  branches,
  selectedBranchId,
  setSelectedBranchId,
  services,
  selectedServiceId,
  setSelectedServiceId,
  comparePrevious,
  setComparePrevious,
  comparison,
  isLoading,
  onRefresh,
  onExportExcel,
  onExportPdf,
  lastUpdatedText,
  isRtl = true,
  language = 'ar'
}: AnalyticsFiltersBarProps) {
  const presets = [
    { id: 'today', labelAr: 'اليوم', labelEn: 'Today' },
    { id: 'week', labelAr: 'آخر 7 أيام', labelEn: 'Last 7 Days' },
    { id: 'month', labelAr: 'هذا الشهر', labelEn: 'This Month' },
    { id: 'year', labelAr: 'هذه السنة', labelEn: 'This Year' },
    { id: 'custom', labelAr: 'فترة مخصصة', labelEn: 'Custom Range' }
  ]

  const activeBranchName =
    selectedBranchId === 'all'
      ? (language === 'en' ? 'All Branches' : 'جميع الفروع')
      : (branches.find((b) => b.id === selectedBranchId)?.name || (language === 'en' ? 'Selected Branch' : 'فرع محدد'))

  return (
    <div className="ios-glass-card p-5 border border-border/80 rounded-3xl space-y-4 shadow-sm select-none">
      {/* Top Row: Presets & Action Buttons */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
        {/* Presets Chips */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5 me-1">
            <Calendar className="w-3.5 h-3.5 text-primary" />
            <span>{language === 'en' ? 'Period:' : 'الفترة:'}</span>
          </span>
          {presets.map((p) => {
            const isActive = datePreset === p.id
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => setDatePreset(p.id as any)}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-primary text-primary-foreground shadow-sm shadow-primary/20 scale-[1.02]'
                    : 'bg-secondary/70 hover:bg-secondary text-muted-foreground hover:text-foreground border border-border/50'
                }`}
              >
                {language === 'en' ? p.labelEn : p.labelAr}
              </button>
            )
          })}
        </div>

        {/* Action Controls: Compare Toggle & Exports */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Comparison Toggle */}
          <button
            type="button"
            onClick={() => setComparePrevious(!comparePrevious)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer ${
              comparePrevious
                ? 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border-purple-500/30 shadow-xs'
                : 'bg-secondary/60 text-muted-foreground border-border hover:bg-secondary'
            }`}
            title={language === 'en' ? 'Compare with previous period' : 'مقارنة بالفترة السابقة'}
          >
            <ArrowRightLeft className="w-3.5 h-3.5" />
            <span>{language === 'en' ? 'Compare with Previous' : 'مقارنة بالفترة السابقة'}</span>
          </button>

          {/* Export Excel Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={onExportExcel}
            className="rounded-xl text-xs font-bold border-border/80 hover:bg-emerald-500/10 hover:text-emerald-600 hover:border-emerald-500/30 cursor-pointer h-9 px-3"
          >
            <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-600 me-1" />
            <span>{language === 'en' ? 'Excel' : 'إكسيل'}</span>
          </Button>

          {/* Export PDF / Print Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={onExportPdf}
            className="rounded-xl text-xs font-bold border-border/80 hover:bg-primary/10 hover:text-primary hover:border-primary/30 cursor-pointer h-9 px-3"
          >
            <Printer className="w-3.5 h-3.5 text-primary me-1" />
            <span>{language === 'en' ? 'Print / PDF' : 'طباعة / PDF'}</span>
          </Button>

          {/* Refresh Button */}
          <Button
            size="sm"
            onClick={onRefresh}
            disabled={isLoading}
            className="rounded-xl text-xs font-bold yalla-gradient-btn text-white h-9 px-3 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 me-1 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? (language === 'en' ? 'Loading...' : 'جاري التحديث...') : (language === 'en' ? 'Refresh' : 'تحديث')}</span>
          </Button>
        </div>
      </div>

      {/* Second Row: Date Inputs, Branch Filter, Service Filter */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-3 border-t border-border/60">
        {/* From Date */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">
            {language === 'en' ? 'From Date:' : 'من تاريخ:'}
          </label>
          <input
            type="date"
            value={dateRange.from}
            onChange={(e) => {
              setDatePreset('custom')
              setDateRange({ ...dateRange, from: e.target.value })
            }}
            className="w-full h-9 px-3 rounded-xl border border-border text-xs font-mono font-bold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* To Date */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">
            {language === 'en' ? 'To Date:' : 'إلى تاريخ:'}
          </label>
          <input
            type="date"
            value={dateRange.to}
            onChange={(e) => {
              setDatePreset('custom')
              setDateRange({ ...dateRange, to: e.target.value })
            }}
            className="w-full h-9 px-3 rounded-xl border border-border text-xs font-mono font-bold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>

        {/* Branch Filter */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">
            {language === 'en' ? 'Branch Filter:' : 'فلترة الفرع:'}
          </label>
          <div className="relative">
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="w-full h-9 px-3 rounded-xl border border-border text-xs font-bold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
            >
              <option value="all">{language === 'en' ? 'All Permitted Branches' : 'جميع الفروع المصرح بها'}</option>
              {branches.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.name} {b.isMain ? (language === 'en' ? '(Main)' : '(الرئيسي)') : ''}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Service Filter */}
        <div>
          <label className="text-[11px] font-bold text-muted-foreground block mb-1">
            {language === 'en' ? 'Service Filter:' : 'فلترة الخدمة الطبية:'}
          </label>
          <select
            value={selectedServiceId}
            onChange={(e) => setSelectedServiceId(e.target.value)}
            className="w-full h-9 px-3 rounded-xl border border-border text-xs font-bold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer"
          >
            <option value="all">{language === 'en' ? 'All Services' : 'جميع الخدمات'}</option>
            {services.map((s) => (
              <option key={s.id || s.name} value={s.id || s.name}>
                {s.name} ({s.price} ج.م)
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Comparison & Metadata Status Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40 text-[11px] text-muted-foreground">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="flex items-center gap-1 font-medium">
            <Clock className="w-3 h-3 text-primary" />
            <span>{lastUpdatedText}</span>
          </span>
          <span>•</span>
          <span className="font-bold text-foreground">
            {language === 'en' ? 'Active Branch:' : 'الفرع:'} {activeBranchName}
          </span>
          <span>•</span>
          <span className="text-[10px] text-muted-foreground font-mono">
            Africa/Cairo (توقيت القاهرة)
          </span>
        </div>

        {comparePrevious && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-lg bg-purple-500/10 text-purple-700 dark:text-purple-300 font-bold border border-purple-500/20 text-[10px]">
            <span>{language === 'en' ? 'Current Period:' : 'الحالية:'} {comparison.currentPeriod.from} ➔ {comparison.currentPeriod.to}</span>
            <span>⟷</span>
            <span>{language === 'en' ? 'Previous Period:' : 'السابقة:'} {comparison.previousPeriod.from} ➔ {comparison.previousPeriod.to}</span>
          </div>
        )}
      </div>
    </div>
  )
}
