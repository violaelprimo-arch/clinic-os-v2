'use client'

import React, { useState, useMemo, useRef } from 'react'
import {
  MapPin, Search, ZoomIn, ZoomOut, RotateCcw, ShieldCheck,
  AlertCircle, ChevronRight, Eye, Building2, Users
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { AreaCoordinate, EGYPT_AREAS_COORDINATES } from '@/lib/analyticsService'

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
  const [hoveredArea, setHoveredArea] = useState<AreaDataPoint | null>(null)
  const [zoomLevel, setZoomLevel] = useState(1)
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 })

  // Map projection bounds for Egypt
  const MAP_W = 600
  const MAP_H = 500
  const MIN_LNG = 28.5 // Focused on populated Egypt Nile Valley & Delta
  const MAX_LNG = 35.5
  const MIN_LAT = 23.5
  const MAX_LAT = 31.8

  const projectCoords = (lat: number, lng: number) => {
    const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * MAP_W
    const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * MAP_H
    return { x, y }
  }

  // Filtered list
  const filteredAreas = useMemo(() => {
    return areaData
      .filter((a) => {
        if (!search.trim()) return true
        const s = search.toLowerCase()
        return a.nameAr.toLowerCase().includes(s) || a.governorateAr.toLowerCase().includes(s) || a.nameEn.toLowerCase().includes(s)
      })
      .sort((a, b) => b.patientCount - a.patientCount)
  }, [areaData, search])

  const maxCount = useMemo(() => {
    return Math.max(...areaData.map((a) => a.patientCount), 1)
  }, [areaData])

  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => Math.min(3, Math.max(0.8, prev + delta)))
  }

  const handleResetZoom = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
    setSelectedAreaId(null)
  }

  const selectedArea = useMemo(() => {
    return areaData.find((a) => a.id === selectedAreaId) || null
  }, [areaData, selectedAreaId])

  return (
    <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 flex items-center justify-center shrink-0">
            <MapPin className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-black text-sm text-foreground flex items-center gap-2">
              <span>{language === 'en' ? 'Geographic Patient Distribution' : 'توزيع المرضى حسب المناطق الجغرافية'}</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold">
                {language === 'en' ? 'Interactive Map' : 'خريطة تفاعلية'}
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Density and distribution by Governorate, City, and District'
                : 'كثافة وتوزيع المرضى حسب المحافظة والمدينة والحي'}
            </p>
          </div>
        </div>

        {/* Missing Region Notice & Privacy Shield */}
        <div className="flex items-center gap-2 flex-wrap">
          {unrecordedCount > 0 && (
            <button
              type="button"
              onClick={onOpenMissingLocationsModal}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-[11px] font-bold bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/30 hover:bg-amber-500/20 transition-all cursor-pointer"
            >
              <AlertCircle className="w-3.5 h-3.5" />
              <span>{unrecordedCount} {language === 'en' ? 'Unrecorded Region' : 'مريض بدون منطقة'} ({unrecordedPercentage}%)</span>
            </button>
          )}

          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold border border-emerald-500/20">
            <ShieldCheck className="w-3 h-3" />
            <span>{language === 'en' ? '100% Privacy Protected' : 'خصوصية مشفرة 100%'}</span>
          </span>
        </div>
      </div>

      {/* Main Grid: Interactive Map (Left/Center) & Ranked Areas List (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
        {/* Map Viewport (7 cols on desktop) */}
        <div className="lg:col-span-7 bg-slate-950/90 dark:bg-black/95 rounded-3xl border border-cyan-500/20 p-4 relative overflow-hidden shadow-inner flex flex-col justify-between min-h-[460px]">
          {/* Map Controls Floating Bar */}
          <div className="absolute top-4 start-4 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-white/10 shadow-lg">
            <button
              type="button"
              onClick={() => handleZoom(0.25)}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="تكبير الخريطة"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => handleZoom(-0.25)}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="تصغير الخريطة"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleResetZoom}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إعادة ضبط الرؤية"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-cyan-400 font-bold px-1.5">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>

          {/* Color Scale Legend */}
          <div className="absolute top-4 end-4 z-20 bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-white/10 text-[10px] text-slate-300 flex items-center gap-2 shadow-lg">
            <span>{language === 'en' ? 'Density:' : 'الكثافة:'}</span>
            <div className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-cyan-400/50" />
              <span className="text-[9px] text-slate-400">1</span>
              <span className="w-8 h-1.5 rounded-full bg-gradient-to-r from-cyan-400/50 via-primary to-purple-500" />
              <span className="text-[9px] text-slate-400">{maxCount}</span>
              <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            </div>
          </div>

          {/* SVG Map Canvas */}
          <div className="relative w-full h-[400px] overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing">
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="w-full h-full transition-transform duration-300"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x}px, ${panOffset.y}px)`
              }}
            >
              {/* Defs: Gradients and Glows */}
              <defs>
                <radialGradient id="bubbleGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.8" />
                  <stop offset="60%" stopColor="#087CF4" stopOpacity="0.4" />
                  <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0" />
                </radialGradient>
                <filter id="mapGlow" x="-20%" y="-20%" width="140%" height="140%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>
              </defs>

              {/* Stylized Nile River & Delta Background Path */}
              <g className="opacity-25" stroke="#00F0FF" strokeWidth="2.5" fill="none">
                {/* Lake Nasser & Nile Course */}
                <path d="M 450 490 Q 440 450 435 400 T 410 320 T 360 250 T 340 180 T 310 145" />
                {/* Rosetta Branch */}
                <path d="M 310 145 Q 280 110 240 70" />
                {/* Damietta Branch */}
                <path d="M 310 145 Q 350 110 380 65" />
                {/* Suez Canal Outline */}
                <path d="M 420 80 L 415 170" strokeDasharray="3 3" strokeWidth="1.5" />
                {/* Mediterranean Coast Arc */}
                <path d="M 120 70 Q 250 85 460 85" stroke="#38BDF8" strokeWidth="1" strokeDasharray="2 2" />
                {/* Red Sea Coast */}
                <path d="M 415 170 Q 480 280 540 480" stroke="#38BDF8" strokeWidth="1" strokeDasharray="2 2" />
              </g>

              {/* Geographic Region Center Dots (Muted Reference Grid) */}
              {EGYPT_AREAS_COORDINATES.map((reg) => {
                const { x, y } = projectCoords(reg.lat, reg.lng)
                if (x < 10 || x > MAP_W - 10 || y < 10 || y > MAP_H - 10) return null
                return (
                  <circle
                    key={reg.id}
                    cx={x}
                    cy={y}
                    r="2"
                    fill="#334155"
                    className="opacity-40"
                  />
                )
              })}

              {/* Active Data Bubbles */}
              {areaData
                .filter((a) => a.isMapped && a.coords)
                .map((a) => {
                  const { x, y } = projectCoords(a.coords!.lat, a.coords!.lng)
                  if (x < 0 || x > MAP_W || y < 0 || y > MAP_H) return null

                  // Calculate proportional radius
                  const ratio = Math.min(1, a.patientCount / maxCount)
                  const radius = 9 + ratio * 24
                  const isSelected = selectedAreaId === a.id
                  const isHovered = hoveredArea?.id === a.id

                  return (
                    <g
                      key={a.id}
                      className="cursor-pointer transition-transform"
                      onClick={() => setSelectedAreaId(isSelected ? null : a.id)}
                      onMouseEnter={() => setHoveredArea(a)}
                      onMouseLeave={() => setHoveredArea(null)}
                    >
                      {/* Pulsing ring on selection/hover */}
                      {(isSelected || isHovered) && (
                        <circle
                          cx={x}
                          cy={y}
                          r={radius + 8}
                          fill="none"
                          stroke="#00F0FF"
                          strokeWidth="2"
                          className="animate-ping opacity-75"
                        />
                      )}

                      {/* Outer Glow Halo */}
                      <circle
                        cx={x}
                        cy={y}
                        r={radius + 4}
                        fill="url(#bubbleGlow)"
                        className="transition-all duration-300"
                      />

                      {/* Core Bubble */}
                      <circle
                        cx={x}
                        cy={y}
                        r={radius}
                        fill={isSelected ? '#00F0FF' : ratio > 0.5 ? '#8B5CF6' : '#087CF4'}
                        fillOpacity={isSelected ? 0.95 : 0.8}
                        stroke="#FFFFFF"
                        strokeWidth={isSelected ? 3 : 1.5}
                        className="transition-all duration-200"
                        filter="url(#mapGlow)"
                      />

                      {/* Patient Count Label inside bubble */}
                      <text
                        x={x}
                        y={y + 4}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize={radius > 16 ? 12 : 10}
                        fontWeight="900"
                        fontFamily="monospace"
                        className="pointer-events-none select-none"
                      >
                        {a.patientCount}
                      </text>

                      {/* Area Name Tag */}
                      <text
                        x={x}
                        y={y - radius - 5}
                        textAnchor="middle"
                        fill={isSelected ? '#00F0FF' : '#E2E8F0'}
                        fontSize="10"
                        fontWeight="bold"
                        className="pointer-events-none select-none drop-shadow-md"
                      >
                        {a.nameAr}
                      </text>
                    </g>
                  )
                })}
            </svg>
          </div>

          {/* Floating Hover/Select Tooltip Card */}
          {(hoveredArea || selectedArea) && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-slate-900/95 backdrop-blur-xl border border-cyan-400/40 rounded-2xl p-3.5 shadow-2xl flex items-center justify-between gap-4 z-30"
            >
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-cyan-400/20 text-cyan-400 flex items-center justify-center font-bold">
                  <MapPin className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-black text-white flex items-center gap-1.5">
                    <span>{(hoveredArea || selectedArea)?.nameAr}</span>
                    <span className="text-[10px] text-slate-400 font-medium">
                      ({(hoveredArea || selectedArea)?.governorateAr})
                    </span>
                  </h4>
                  <p className="text-[10px] text-cyan-300 font-medium mt-0.5">
                    {language === 'en' ? 'Geographic distribution within active period' : 'توزيع جغرافي مسجل للمرضى بالعيادة'}
                  </p>
                </div>
              </div>

              <div className="text-end shrink-0">
                <span className="text-base font-black font-mono text-white">
                  {(hoveredArea || selectedArea)?.patientCount}{' '}
                  <span className="text-[10px] font-bold text-slate-300">{language === 'en' ? 'pts' : 'مريض'}</span>
                </span>
                <span className="text-[11px] font-extrabold text-cyan-400 block font-mono">
                  {(hoveredArea || selectedArea)?.percentage}%
                </span>
              </div>
            </motion.div>
          )}

          {/* Bottom Footnote */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
            <span>{language === 'en' ? 'Centers represent general district centroids' : 'الدوائر تمثل المراكز الجغرافية للمناطق والمدن'}</span>
            <span className="font-mono text-cyan-400">
              {areaData.filter((a) => a.isMapped).length} {language === 'en' ? 'Active Zones' : 'منطقة نشطة'}
            </span>
          </div>
        </div>

        {/* Ranked Areas List (5 cols on desktop) */}
        <div className="lg:col-span-5 space-y-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={language === 'en' ? 'Search regions...' : 'بحث في المناطق والمحافظات...'}
              className="w-full h-9 ps-9 pe-3 rounded-xl border border-border text-xs font-bold bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>

          {/* Ranked List Scroll Area */}
          <div className="max-h-[380px] overflow-y-auto space-y-1.5 pe-1 scrollbar-thin">
            {filteredAreas.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {language === 'en' ? 'No regions matching your search' : 'لا توجد مناطق تطابق بحثك'}
              </div>
            ) : (
              filteredAreas.map((a, idx) => {
                const isSelected = selectedAreaId === a.id
                return (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => setSelectedAreaId(isSelected ? null : a.id)}
                    className={`w-full p-2.5 rounded-2xl border text-start flex items-center justify-between gap-2.5 transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-primary/10 border-primary text-primary shadow-xs'
                        : 'bg-card hover:bg-muted/50 border-border/70 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="w-6 h-6 rounded-lg bg-secondary text-muted-foreground text-[11px] font-black font-mono flex items-center justify-center shrink-0">
                        {idx + 1}
                      </span>
                      <div className="truncate">
                        <span className="text-xs font-black block truncate">{a.nameAr}</span>
                        <span className="text-[10px] text-muted-foreground font-medium block">
                          {a.governorateAr}
                        </span>
                      </div>
                    </div>

                    <div className="text-end shrink-0">
                      <span className="text-xs font-black font-mono block">
                        {a.patientCount} <span className="text-[9px] text-muted-foreground font-bold">{language === 'en' ? 'pts' : 'مريض'}</span>
                      </span>
                      <span className="text-[10px] text-primary font-bold font-mono">
                        {a.percentage}%
                      </span>
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Unrecorded & Unmapped Summary Box */}
          <div className="p-3 rounded-2xl bg-muted/40 border border-border/80 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-muted-foreground">
                {language === 'en' ? 'Unrecorded Region:' : 'منطقة غير مسجلة بالملف:'}
              </span>
              <span className="font-mono font-black text-amber-600 dark:text-amber-400">
                {unrecordedCount} ({unrecordedPercentage}%)
              </span>
            </div>
            {unmappedCount > 0 && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-muted-foreground">
                  {language === 'en' ? 'Unmapped Free-text:' : 'نصوص خارج نطاق الخريطة:'}
                </span>
                <span className="font-mono font-black text-slate-500">
                  {unmappedCount}
                </span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
