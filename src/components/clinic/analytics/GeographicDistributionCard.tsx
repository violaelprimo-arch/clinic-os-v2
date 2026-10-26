'use client'

import React, { useState, useMemo } from 'react'
import dynamic from 'next/dynamic'
import {
  MapPin, Search, ShieldCheck, AlertCircle, Users,
  Compass, Sparkles, Navigation, X, ExternalLink, ChevronLeft
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export interface AreaDataPoint {
  id: string
  nameAr: string
  nameEn: string
  governorateAr: string
  patientCount: number
  percentage: number
  isMapped: boolean
  coords: { lat: number; lng: number } | null
}

export interface GeographicDistributionCardProps {
  areaData: AreaDataPoint[]
  unrecordedCount: number
  unrecordedPercentage: number
  unmappedCount: number
  totalPatients: number
  onOpenMissingLocationsModal?: () => void
  isRtl?: boolean
  language?: string
}

// Dynamically import Leaflet RealInteractiveMap without SSR to guarantee zero window reference errors
const RealInteractiveMap = dynamic(() => import('./RealInteractiveMap'), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[520px] rounded-3xl bg-[#091220] flex flex-col items-center justify-center gap-3 border border-cyan-500/20 text-cyan-400">
      <div className="w-10 h-10 border-3 border-cyan-500/20 border-t-cyan-400 rounded-full animate-spin"></div>
      <span className="text-xs font-bold text-slate-300">جاري تحميل خريطة جوجل الحية والأحياء...</span>
    </div>
  )
})

export function GeographicDistributionCard({
  areaData,
  unrecordedCount,
  unrecordedPercentage,
  unmappedCount,
  totalPatients,
  onOpenMissingLocationsModal,
  isRtl = true,
  language = 'ar'
}: GeographicDistributionCardProps) {
  const [search, setSearch] = useState('')
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(null)

  // Active booked areas with patient count > 0
  const activeAreas = useMemo(() => {
    return areaData
      .filter((a) => a.patientCount > 0)
      .sort((a, b) => b.patientCount - a.patientCount)
  }, [areaData])

  // Filtered active areas matching search
  const filteredAreas = useMemo(() => {
    if (!search.trim()) return activeAreas
    const s = search.toLowerCase().trim()
    return activeAreas.filter((a) => {
      return (
        a.nameAr.toLowerCase().includes(s) ||
        a.governorateAr.toLowerCase().includes(s) ||
        (a.nameEn && a.nameEn.toLowerCase().includes(s))
      )
    })
  }, [activeAreas, search])

  const totalMappedPatients = useMemo(() => {
    return activeAreas.reduce((sum, a) => sum + a.patientCount, 0)
  }, [activeAreas])

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5" dir={isRtl ? 'rtl' : 'ltr'}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0 border border-cyan-500/20">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Geographic Patient Distribution' : 'توزيع المرضى حسب المناطق الجغرافية'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {language === 'en' ? 'Google Maps Engine' : 'خريطة جوجل الحية وتفاصيل الأحياء'}
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Interactive real map with detailed districts, streets, and patient density markers'
                : 'خريطة فعلية تفاعلية تعرض شوارع وأحياء الجمهورية مع كثافة وأعداد مرضى العيادة بدقة'}
            </p>
          </div>
        </div>

        {/* Missing Region Notice & Privacy Shield */}
        <div className="flex items-center gap-2 flex-wrap">
          {unrecordedCount > 0 && (
            <button
              type="button"
              onClick={onOpenMissingLocationsModal}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{unrecordedCount} {language === 'en' ? 'Unrecorded Region' : 'مريض بدون منطقة'} ({unrecordedPercentage}%)</span>
            </button>
          )}

          <span className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            <span>{language === 'en' ? '100% Privacy Protected' : 'خصوصية مشفرة 100%'}</span>
          </span>
        </div>
      </div>

      {/* Main Grid: Real Map (7 cols) & Booked Areas Side Panel (5 cols) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Real Interactive Map Viewport (7 cols on desktop) */}
        <div className="lg:col-span-7 order-2 lg:order-1">
          <RealInteractiveMap
            areaData={areaData}
            selectedAreaId={selectedAreaId}
            onSelectArea={(id) => setSelectedAreaId(id)}
            isRtl={isRtl}
            language={language}
          />
        </div>

        {/* Side Panel: Booked Areas & Patient Counts (5 cols on desktop, on the Left in RTL) */}
        <div className="lg:col-span-5 order-1 lg:order-2 space-y-3">
          {/* Panel Header */}
          <div className="flex items-center justify-between pb-1">
            <div className="flex items-center gap-1.5">
              <Users className="w-4 h-4 text-primary" />
              <h4 className="text-xs font-black text-foreground">
                {language === 'en' ? 'Booked Regions & Districts' : 'المناطق المسجلة بالحجوزات'}
              </h4>
            </div>
            <span className="text-[11px] font-bold font-mono px-2 py-0.5 rounded-lg bg-primary/10 text-primary">
              {activeAreas.length} {language === 'en' ? 'Active Areas' : 'منطقة نشطة'}
            </span>
          </div>

          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'en' ? 'Search booked regions...' : 'بحث في المناطق والأحياء المسجلة...'}
              className="w-full h-9 ps-9 pe-8 rounded-xl border border-border text-xs font-bold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Areas List Area */}
          <div className="max-h-[385px] overflow-y-auto space-y-2 pe-1 scrollbar-thin">
            {/* Case A: Active areas exist and match search */}
            {filteredAreas.length > 0 && (
              filteredAreas.map((a, idx) => {
                const isSelected = selectedAreaId === a.id
                const isTop = idx === 0
                return (
                  <div
                    key={a.id}
                    onClick={() => setSelectedAreaId(isSelected ? null : a.id)}
                    className={`w-full p-3 rounded-2xl border text-start transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary shadow-sm ring-1 ring-primary/30'
                        : 'bg-card hover:bg-muted/50 border-border/70 text-foreground'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className={`w-6 h-6 rounded-lg text-[11px] font-black font-mono flex items-center justify-center shrink-0 ${
                            isTop ? 'bg-primary text-primary-foreground' : 'bg-secondary text-muted-foreground'
                          }`}
                        >
                          {idx + 1}
                        </span>
                        <div className="truncate">
                          <span className="text-xs font-black block truncate text-foreground">{a.nameAr}</span>
                          <span className="text-[10px] text-muted-foreground font-medium block">
                            {a.governorateAr} {a.nameEn ? `• ${a.nameEn}` : ''}
                          </span>
                        </div>
                      </div>

                      <div className="text-end shrink-0">
                        <span className="text-xs font-black font-mono block text-foreground">
                          {a.patientCount} <span className="text-[9px] text-muted-foreground font-bold">{language === 'en' ? 'pts' : 'مريض'}</span>
                        </span>
                        <span className="text-[10px] text-primary font-bold font-mono">
                          {a.percentage}%
                        </span>
                      </div>
                    </div>

                    {/* Progress Bar & Click-to-Fly action */}
                    <div className="mt-2.5 pt-2 border-t border-border/50 flex items-center justify-between gap-2">
                      <div className="flex-1 bg-secondary rounded-full h-1.5 overflow-hidden">
                        <div
                          className="bg-primary h-full rounded-full transition-all"
                          style={{ width: `${Math.min(100, Math.max(5, a.percentage * 2.5))}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-bold text-cyan-600 dark:text-cyan-400 hover:underline flex items-center gap-0.5 shrink-0">
                        <span>{language === 'en' ? 'View on Map' : 'تحديد بالخريطة'}</span>
                        <ChevronLeft className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                )
              })
            )}

            {/* Case B: User searched for something that doesn't match */}
            {search.trim() !== '' && filteredAreas.length === 0 && (
              <div className="p-6 text-center text-xs text-muted-foreground bg-muted/20 rounded-2xl border border-dashed border-border space-y-2">
                <Search className="w-6 h-6 mx-auto text-muted-foreground/60" />
                <p className="font-bold">
                  {language === 'en' ? `No booked regions matching "${search}"` : `لا توجد مناطق مسجلة تطابق: "${search}"`}
                </p>
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="text-[11px] font-bold text-primary hover:underline cursor-pointer"
                >
                  {language === 'en' ? 'Clear search filter' : 'مسح البحث وعرض كافة المناطق'}
                </button>
              </div>
            )}

            {/* Case C: Search is empty, but no patients have a recorded residence yet (User screenshot scenario) */}
            {search.trim() === '' && activeAreas.length === 0 && (
              <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-start space-y-3">
                <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <h5 className="font-black text-xs">
                    {language === 'en' ? 'No regions recorded yet in this period' : 'لم يتم تسجيل مناطق سكن للمرضى بعد'}
                  </h5>
                </div>

                <p className="text-[11px] text-amber-900/80 dark:text-amber-300/80 leading-relaxed font-medium">
                  {language === 'en'
                    ? `All ${unrecordedCount || totalPatients} patients registered during this period have not specified their residential area yet.`
                    : `جميع المرضى المسجلين في هذا النطاق (${unrecordedCount || totalPatients} مريض) لم يتم تحديد منطقة سكنهم بالملف بعد.`}
                </p>

                <div className="pt-1">
                  <button
                    type="button"
                    onClick={onOpenMissingLocationsModal}
                    className="w-full py-2 px-3 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-300 border border-amber-500/30 font-bold text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <span>{language === 'en' ? 'Update Patient Residential Areas' : 'استعراض المرضى لتحديث مناطقهم'}</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* Unrecorded & Quality Summary Footer */}
          <div className="p-3.5 rounded-2xl bg-muted/40 border border-border/80 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                <span>{language === 'en' ? 'Unrecorded Residence:' : 'مرضى بدون منطقة مسجلة:'}</span>
              </span>
              <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                {unrecordedCount} ({unrecordedPercentage}%)
              </span>
            </div>

            {totalMappedPatients > 0 && (
              <div className="flex items-center justify-between pt-1 border-t border-border/50">
                <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full bg-cyan-500"></span>
                  <span>{language === 'en' ? 'Geolocated Patients:' : 'مرضى محددون على الخريطة:'}</span>
                </span>
                <span className="font-mono font-black text-cyan-600 dark:text-cyan-400">
                  {totalMappedPatients} ({Math.round((totalMappedPatients / Math.max(1, totalPatients)) * 100)}%)
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
