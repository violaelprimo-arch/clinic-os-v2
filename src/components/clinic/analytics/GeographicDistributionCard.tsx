'use client'

import React, { useState, useMemo, useRef, useEffect } from 'react'
import {
  MapPin, Search, ZoomIn, ZoomOut, RotateCcw, ShieldCheck,
  AlertCircle, ChevronRight, Eye, Building2, Users, Compass,
  Sparkles, Layers, Move, Navigation
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { EGYPT_AREAS_COORDINATES } from '@/lib/analyticsService'

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

// Major Egypt Geographic Landmarks for realistic map appearance
const EGYPT_LANDMARKS = [
  { id: 'cairo', nameAr: 'القاهرة', nameEn: 'Cairo', lat: 30.0444, lng: 31.2357, type: 'major' },
  { id: 'alexandria', nameAr: 'الإسكندرية', nameEn: 'Alexandria', lat: 31.2001, lng: 29.9187, type: 'major' },
  { id: 'giza', nameAr: 'الجيزة', nameEn: 'Giza', lat: 30.0131, lng: 31.2089, type: 'major' },
  { id: 'mansoura', nameAr: 'المنصورة', nameEn: 'Mansoura', lat: 31.0409, lng: 31.3785, type: 'city' },
  { id: 'tanta', nameAr: 'طنطا', nameEn: 'Tanta', lat: 30.7865, lng: 31.0004, type: 'city' },
  { id: 'zagazig', nameAr: 'الزقازيق', nameEn: 'Zagazig', lat: 30.5877, lng: 31.5020, type: 'city' },
  { id: 'portsaid', nameAr: 'بورسعيد', nameEn: 'Port Said', lat: 31.2653, lng: 32.3019, type: 'city' },
  { id: 'suez', nameAr: 'السويس', nameEn: 'Suez', lat: 29.9668, lng: 32.5498, type: 'city' },
  { id: 'ismailia', nameAr: 'الإسماعيلية', nameEn: 'Ismailia', lat: 30.5965, lng: 32.2715, type: 'city' },
  { id: 'fayoum', nameAr: 'الفيوم', nameEn: 'Fayoum', lat: 29.3084, lng: 30.8428, type: 'city' },
  { id: 'benisuef', nameAr: 'بني سويف', nameEn: 'Beni Suef', lat: 29.0661, lng: 31.0994, type: 'city' },
  { id: 'minya', nameAr: 'المنيا', nameEn: 'Minya', lat: 28.0871, lng: 30.7618, type: 'city' },
  { id: 'asyut', nameAr: 'أسيوط', nameEn: 'Asyut', lat: 27.1809, lng: 31.1837, type: 'city' },
  { id: 'sohag', nameAr: 'سوهاج', nameEn: 'Sohag', lat: 26.5590, lng: 31.6957, type: 'city' },
  { id: 'qena', nameAr: 'قنا', nameEn: 'Qena', lat: 26.1551, lng: 32.7160, type: 'city' },
  { id: 'luxor', nameAr: 'الأقصر', nameEn: 'Luxor', lat: 25.6872, lng: 32.6396, type: 'city' },
  { id: 'aswan', nameAr: 'أسوان', nameEn: 'Aswan', lat: 24.0889, lng: 32.8998, type: 'city' },
  { id: 'hurghada', nameAr: 'الغردقة', nameEn: 'Hurghada', lat: 27.2579, lng: 33.8116, type: 'city' },
  { id: 'sharm', nameAr: 'شرم الشيخ', nameEn: 'Sharm El Sheikh', lat: 27.9158, lng: 34.3299, type: 'city' },
  { id: 'matruh', nameAr: 'مرسى مطروح', nameEn: 'Matruh', lat: 31.3543, lng: 27.2373, type: 'city' },
  { id: 'arish', nameAr: 'العريش', nameEn: 'Arish', lat: 31.1325, lng: 33.8033, type: 'city' }
]

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
  const [isDragging, setIsDragging] = useState(false)
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 })

  const mapContainerRef = useRef<HTMLDivElement>(null)

  // Map projection bounds for Egypt
  const MAP_W = 700
  const MAP_H = 620
  const MIN_LNG = 25.0
  const MAX_LNG = 36.0
  const MIN_LAT = 22.0
  const MAX_LAT = 32.0

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

  // Zoom handlers
  const handleZoom = (delta: number) => {
    setZoomLevel((prev) => {
      const next = Math.min(4, Math.max(0.7, prev + delta))
      return Number(next.toFixed(2))
    })
  }

  const handleResetZoom = () => {
    setZoomLevel(1)
    setPanOffset({ x: 0, y: 0 })
    setSelectedAreaId(null)
  }

  // Mouse drag & pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return
    setIsDragging(true)
    setDragStart({
      x: e.clientX - panOffset.x,
      y: e.clientY - panOffset.y
    })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    setPanOffset({
      x: e.clientX - dragStart.x,
      y: e.clientY - dragStart.y
    })
  }

  const handleMouseUp = () => {
    setIsDragging(false)
  }

  // Touch drag for mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      setIsDragging(true)
      setDragStart({
        x: touch.clientX - panOffset.x,
        y: touch.clientY - panOffset.y
      })
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging || e.touches.length !== 1) return
    const touch = e.touches[0]
    setPanOffset({
      x: touch.clientX - dragStart.x,
      y: touch.clientY - dragStart.y
    })
  }

  const handleTouchEnd = () => {
    setIsDragging(false)
  }

  // Smooth mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    e.stopPropagation()
    const zoomDelta = e.deltaY < 0 ? 0.15 : -0.15
    handleZoom(zoomDelta)
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
              <span className="text-[10px] px-2 py-0.5 rounded-full bg-cyan-500/15 text-cyan-700 dark:text-cyan-300 font-bold flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
                {language === 'en' ? 'Live Geographic Radar' : 'خريطة تفاعلية ورادار حي'}
              </span>
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {language === 'en'
                ? 'Density and distribution by Governorate, City, and District with smooth mouse navigation'
                : 'كثافة وتوزيع المرضى حسب المحافظة والمدينة والحي مع تحكم بالماوس واللمس'}
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
        <div
          ref={mapContainerRef}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          className={`lg:col-span-7 bg-[#060D19] rounded-3xl border border-cyan-500/30 p-4 relative overflow-hidden shadow-2xl flex flex-col justify-between min-h-[480px] select-none ${
            isDragging ? 'cursor-grabbing' : 'cursor-grab'
          }`}
        >
          {/* Top Left Floating Bar: Zoom & Reset Controls */}
          <div className="absolute top-4 start-4 z-20 flex items-center gap-1.5 bg-slate-900/90 backdrop-blur-md p-1.5 rounded-2xl border border-cyan-500/30 shadow-xl">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleZoom(0.25); }}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-cyan-500/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="تكبير الخريطة (أو استخدم عجلة الماوس)"
            >
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleZoom(-0.25); }}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-cyan-500/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="تصغير الخريطة"
            >
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); handleResetZoom(); }}
              className="w-7 h-7 rounded-xl bg-white/10 hover:bg-cyan-500/20 text-white flex items-center justify-center transition-colors cursor-pointer"
              title="إعادة ضبط الموضع والحجم الافتراضي"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-mono text-cyan-400 font-bold px-1.5">
              {Math.round(zoomLevel * 100)}%
            </span>
          </div>

          {/* Top Right Floating Bar: Compass & Density Scale Legend */}
          <div className="absolute top-4 end-4 z-20 flex items-center gap-2">
            <div className="bg-slate-900/90 backdrop-blur-md px-3 py-1.5 rounded-2xl border border-cyan-500/30 text-[10px] text-slate-300 flex items-center gap-2 shadow-xl">
              <span className="text-cyan-400 font-bold">{language === 'en' ? 'Density:' : 'الكثافة:'}</span>
              <div className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full bg-cyan-400" />
                <span className="text-[9px] text-slate-400">1</span>
                <span className="w-10 h-2 rounded-full bg-gradient-to-r from-cyan-400 via-primary to-purple-500" />
                <span className="text-[9px] text-slate-400">{maxCount}</span>
                <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
              </div>
            </div>

            {/* Navigation North Arrow */}
            <div className="w-8 h-8 rounded-2xl bg-slate-900/90 backdrop-blur-md border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-xl" title="اتجاه الشمال">
              <Navigation className="w-4 h-4 fill-cyan-400/30 text-cyan-400 transform -rotate-45" />
            </div>
          </div>

          {/* SVG Map Canvas with Realistic Cartographic Contours */}
          <div className="relative w-full h-[410px] overflow-hidden flex items-center justify-center">
            <svg
              viewBox={`0 0 ${MAP_W} ${MAP_H}`}
              className="w-full h-full transition-transform duration-75 ease-out pointer-events-auto"
              style={{
                transform: `scale(${zoomLevel}) translate(${panOffset.x / zoomLevel}px, ${panOffset.y / zoomLevel}px)`
              }}
            >
              {/* Definitions: Gradients, Filters, Animations */}
              <defs>
                {/* Glowing Heat Blob Gradients */}
                <radialGradient id="highDensityGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.95" />
                  <stop offset="45%" stopColor="#087CF4" stopOpacity="0.6" />
                  <stop offset="80%" stopColor="#00F0FF" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="#00F0FF" stopOpacity="0" />
                </radialGradient>

                <radialGradient id="midDensityGlow" cx="50%" cy="50%" r="50%">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity="0.9" />
                  <stop offset="50%" stopColor="#087CF4" stopOpacity="0.5" />
                  <stop offset="100%" stopColor="#087CF4" stopOpacity="0" />
                </radialGradient>

                {/* Radar Sweep Gradient */}
                <linearGradient id="radarSweepGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#00F0FF" stopOpacity="0" />
                  <stop offset="70%" stopColor="#00F0FF" stopOpacity="0.08" />
                  <stop offset="100%" stopColor="#00F0FF" stopOpacity="0.35" />
                </linearGradient>

                {/* Neon Glow Filter */}
                <filter id="neonGlow" x="-30%" y="-30%" width="160%" height="160%">
                  <feGaussianBlur stdDeviation="4" result="blur" />
                  <feComposite in="SourceGraphic" in2="blur" operator="over" />
                </filter>

                {/* Heat Map Soft Blur Filter */}
                <filter id="heatBlur" x="-40%" y="-40%" width="180%" height="180%">
                  <feGaussianBlur stdDeviation="7" />
                </filter>
              </defs>

              {/* Cartographic Coordinate Grid Lines (Parallels & Meridians) */}
              <g stroke="#1E293B" strokeWidth="0.8" strokeDasharray="3 4">
                {/* Latitudes: 31°N, 28°N, 25°N, 23°N */}
                <line x1="0" y1="62" x2={MAP_W} y2="62" />
                <text x="12" y="58" fill="#475569" fontSize="9" fontFamily="monospace">31°N</text>

                <line x1="0" y1="248" x2={MAP_W} y2="248" />
                <text x="12" y="244" fill="#475569" fontSize="9" fontFamily="monospace">28°N</text>

                <line x1="0" y1="434" x2={MAP_W} y2="434" />
                <text x="12" y="430" fill="#475569" fontSize="9" fontFamily="monospace">25°N</text>

                {/* Longitudes: 27°E, 30°E, 33°E, 35°E */}
                <line x1="127" y1="0" x2="127" y2={MAP_H} />
                <text x="130" y="20" fill="#475569" fontSize="9" fontFamily="monospace">27°E</text>

                <line x1="318" y1="0" x2="318" y2={MAP_H} />
                <text x="321" y="20" fill="#475569" fontSize="9" fontFamily="monospace">30°E</text>

                <line x1="509" y1="0" x2="509" y2={MAP_H} />
                <text x="512" y="20" fill="#475569" fontSize="9" fontFamily="monospace">33°E</text>
              </g>

              {/* Realistic Egypt Landmass Outline Path */}
              <path
                d="
                  M 64 41
                  L 142 40
                  Q 200 55 248 69
                  Q 280 60 312 50
                  Q 330 45 345 40
                  Q 380 28 433 34
                  L 464 46
                  Q 510 56 560 56
                  L 585 48
                  L 630 152
                  Q 625 200 610 230
                  L 585 262
                  L 550 235
                  L 505 145
                  L 480 126
                  L 482 150
                  L 500 185
                  L 520 230
                  L 560 294
                  L 568 325
                  L 585 365
                  L 625 430
                  L 655 500
                  L 690 580
                  L 690 620
                  L 0 620
                  L 0 41
                  Z
                "
                fill="#0B132B"
                stroke="#1E3A8A"
                strokeWidth="1.8"
                className="transition-colors"
              />

              {/* Sea Water Bodies Background Accent */}
              {/* Mediterranean Sea Water Tone */}
              <path
                d="M 0 0 L 700 0 L 700 40 L 585 48 Q 510 56 464 46 Q 380 28 345 40 Q 330 45 312 50 Q 280 60 248 69 Q 200 55 142 40 L 64 41 L 0 41 Z"
                fill="#030816"
                opacity="0.8"
              />

              {/* Red Sea & Gulf of Suez & Gulf of Aqaba Water Tone */}
              <path
                d="
                  M 480 126
                  L 505 145
                  L 550 235
                  L 585 262
                  L 610 230
                  L 625 200
                  L 630 152
                  L 700 152
                  L 700 620
                  L 690 580
                  L 655 500
                  L 625 430
                  L 585 365
                  L 568 325
                  L 560 294
                  L 520 230
                  L 500 185
                  L 482 150
                  Z
                "
                fill="#030816"
                opacity="0.8"
              />

              {/* Realistic Nile River & Delta Streams */}
              <g stroke="#00F0FF" fill="none">
                {/* Lake Nasser (Southern Egypt Reservoir) */}
                <path
                  d="M 503 615 C 495 570 515 540 503 491"
                  strokeWidth="5"
                  strokeOpacity="0.4"
                  strokeLinecap="round"
                />

                {/* Upper Egypt & Nile Course through Luxor, Qena Bend, Asyut, Minya */}
                <path
                  d="
                    M 503 491
                    Q 498 465 495 440
                    Q 485 415 486 392
                    Q 505 375 500 365
                    Q 460 370 430 340
                    Q 393 320 393 299
                    Q 375 250 372 215
                    Q 370 190 388 155
                    Q 392 135 396 121
                    L 395 105
                  "
                  strokeWidth="2.5"
                  strokeOpacity="0.6"
                  strokeLinecap="round"
                />

                {/* Rosetta Branch (Western Delta) */}
                <path
                  d="M 395 105 Q 370 80 345 40"
                  strokeWidth="2.2"
                  strokeOpacity="0.65"
                  strokeLinecap="round"
                />

                {/* Damietta Branch (Eastern Delta) */}
                <path
                  d="M 395 105 Q 415 75 433 34"
                  strokeWidth="2.2"
                  strokeOpacity="0.65"
                  strokeLinecap="round"
                />

                {/* Suez Canal */}
                <path
                  d="M 464 46 L 465 85 L 475 95 L 480 126"
                  strokeWidth="1.8"
                  strokeDasharray="3 3"
                  strokeOpacity="0.7"
                />
              </g>

              {/* Geographic Sea & Regional Watermarks (Like a Real Physical Map) */}
              <text x="210" y="32" fill="#38BDF8" fontSize="11" fontWeight="bold" opacity="0.35" letterSpacing="3">
                البحر الأبيض المتوسط • MEDITERRANEAN SEA
              </text>
              <text x="610" y="370" fill="#38BDF8" fontSize="10" fontWeight="bold" opacity="0.35" transform="rotate(65 610,370)" letterSpacing="2">
                البحر الأحمر • RED SEA
              </text>
              <text x="560" y="170" fill="#38BDF8" fontSize="9" fontWeight="bold" opacity="0.3" letterSpacing="1">
                سيناء • SINAI
              </text>
              <text x="140" y="300" fill="#64748B" fontSize="10" fontWeight="bold" opacity="0.2" letterSpacing="2">
                الصحراء الغربية • WESTERN DESERT
              </text>
              <text x="430" y="240" fill="#64748B" fontSize="9" fontWeight="bold" opacity="0.2" letterSpacing="1">
                الصحراء الشرقية
              </text>

              {/* Dynamic Radar Sweep Beam (Motion Graphic Animation) */}
              <g className="pointer-events-none">
                <circle
                  cx="396"
                  cy="121"
                  r="260"
                  fill="url(#radarSweepGrad)"
                  className="animate-spin opacity-40 origin-[396px_121px]"
                  style={{ animationDuration: '9s' }}
                />
                <circle
                  cx="396"
                  cy="121"
                  r="260"
                  fill="none"
                  stroke="#00F0FF"
                  strokeWidth="1"
                  strokeDasharray="4 6"
                  opacity="0.2"
                />
              </g>

              {/* Permanent Geographic Landmarks (City reference nodes like a real map) */}
              {EGYPT_LANDMARKS.map((city) => {
                const { x, y } = projectCoords(city.lat, city.lng)
                if (x < 10 || x > MAP_W - 10 || y < 10 || y > MAP_H - 10) return null
                const isMajor = city.type === 'major'
                return (
                  <g key={city.id} className="pointer-events-none opacity-60">
                    <circle
                      cx={x}
                      cy={y}
                      r={isMajor ? 2.5 : 1.8}
                      fill={isMajor ? '#38BDF8' : '#64748B'}
                    />
                    <text
                      x={x}
                      y={y - 5}
                      textAnchor="middle"
                      fill={isMajor ? '#94A3B8' : '#64748B'}
                      fontSize={isMajor ? '8.5' : '7.5'}
                      fontWeight={isMajor ? 'bold' : 'normal'}
                      fontFamily="system-ui"
                    >
                      {city.nameAr}
                    </text>
                  </g>
                )
              })}

              {/* Layer 1: Soft Heat Density Glow Blobs under active clusters */}
              {areaData
                .filter((a) => a.isMapped && a.coords)
                .map((a) => {
                  const { x, y } = projectCoords(a.coords!.lat, a.coords!.lng)
                  if (x < 0 || x > MAP_W || y < 0 || y > MAP_H) return null
                  const ratio = Math.min(1, a.patientCount / maxCount)
                  const blurRadius = 16 + ratio * 32
                  return (
                    <circle
                      key={`glow-${a.id}`}
                      cx={x}
                      cy={y}
                      r={blurRadius}
                      fill={ratio > 0.4 ? 'url(#highDensityGlow)' : 'url(#midDensityGlow)'}
                      filter="url(#heatBlur)"
                      opacity={0.8}
                      className="pointer-events-none"
                    />
                  )
                })}

              {/* Layer 2: Interactive Active Patient Hubs & Motion Beacons */}
              {areaData
                .filter((a) => a.isMapped && a.coords)
                .map((a) => {
                  const { x, y } = projectCoords(a.coords!.lat, a.coords!.lng)
                  if (x < 0 || x > MAP_W || y < 0 || y > MAP_H) return null

                  const ratio = Math.min(1, a.patientCount / maxCount)
                  const radius = 10 + ratio * 20
                  const isSelected = selectedAreaId === a.id
                  const isHovered = hoveredArea?.id === a.id

                  return (
                    <g
                      key={`node-${a.id}`}
                      className="cursor-pointer transition-transform"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedAreaId(isSelected ? null : a.id)
                      }}
                      onMouseEnter={() => setHoveredArea(a)}
                      onMouseLeave={() => setHoveredArea(null)}
                    >
                      {/* Concentric Animated Pulse Ring */}
                      <circle
                        cx={x}
                        cy={y}
                        r={radius + 8}
                        fill="none"
                        stroke={ratio > 0.5 ? '#8B5CF6' : '#00F0FF'}
                        strokeWidth="1.5"
                        className="animate-ping opacity-60 pointer-events-none"
                      />

                      {/* Halo Ring */}
                      {(isSelected || isHovered) && (
                        <circle
                          cx={x}
                          cy={y}
                          r={radius + 6}
                          fill="none"
                          stroke="#FFFFFF"
                          strokeWidth="2.5"
                          className="opacity-90 animate-pulse pointer-events-none"
                        />
                      )}

                      {/* Core Bubble with Vibrant Gradient */}
                      <circle
                        cx={x}
                        cy={y}
                        r={radius}
                        fill={
                          isSelected
                            ? '#00F0FF'
                            : ratio > 0.6
                            ? '#8B5CF6'
                            : ratio > 0.25
                            ? '#087CF4'
                            : '#06B6D4'
                        }
                        fillOpacity={isSelected ? 1 : 0.9}
                        stroke="#FFFFFF"
                        strokeWidth={isSelected ? 2.8 : 1.5}
                        filter="url(#neonGlow)"
                        className="transition-all duration-200"
                      />

                      {/* Patient Count Inside Node */}
                      <text
                        x={x}
                        y={y + 4}
                        textAnchor="middle"
                        fill="#FFFFFF"
                        fontSize={radius > 16 ? 12 : 10}
                        fontWeight="900"
                        fontFamily="monospace"
                        className="pointer-events-none select-none drop-shadow"
                      >
                        {a.patientCount}
                      </text>

                      {/* Prominent Real-Map Badge Tag: Area Name + Patients */}
                      <g
                        transform={`translate(${x}, ${y - radius - 14})`}
                        className="pointer-events-none select-none transition-transform"
                      >
                        {/* Tag Background Pill */}
                        <rect
                          x="-45"
                          y="-10"
                          width="90"
                          height="18"
                          rx="9"
                          fill="#030816"
                          fillOpacity={isSelected || isHovered ? 0.95 : 0.85}
                          stroke={isSelected ? '#00F0FF' : isHovered ? '#38BDF8' : '#1E293B'}
                          strokeWidth={isSelected || isHovered ? 1.5 : 1}
                        />

                        {/* Status Beacon Dot inside Pill */}
                        <circle
                          cx="-35"
                          cy="-1"
                          r="3"
                          fill={ratio > 0.5 ? '#8B5CF6' : '#00F0FF'}
                        />

                        {/* Tag Text: Area Name */}
                        <text
                          x="-5"
                          y="2.5"
                          textAnchor="middle"
                          fill={isSelected ? '#00F0FF' : '#E2E8F0'}
                          fontSize="9.5"
                          fontWeight="bold"
                          fontFamily="system-ui"
                          className="drop-shadow-sm"
                        >
                          {a.nameAr}
                        </text>
                      </g>
                    </g>
                  )
                })}
            </svg>
          </div>

          {/* Floating Hover/Select Tooltip Card */}
          <AnimatePresence>
            {(hoveredArea || selectedArea) && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 8 }}
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
                      {language === 'en' ? 'Registered patients within selected timeframe' : 'توزيع جغرافي مسجل للمرضى بالعيادة'}
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
          </AnimatePresence>

          {/* Bottom Footnote with Navigation Tip */}
          <div className="pt-2 border-t border-white/10 flex items-center justify-between text-[10px] text-slate-400">
            <span className="flex items-center gap-1">
              <Move className="w-3 h-3 text-cyan-400" />
              <span>{language === 'en' ? 'Drag map to pan • Mouse wheel to zoom' : 'اسحب الخريطة بالماوس أو اللمس للتحريك • عجلة الماوس للزوم'}</span>
            </span>
            <span className="font-mono text-cyan-400 font-bold">
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
          <div className="max-h-[390px] overflow-y-auto space-y-1.5 pe-1 scrollbar-thin">
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
                    onClick={() => {
                      setSelectedAreaId(isSelected ? null : a.id)
                      // Center map onto the selected region coordinates
                      if (a.coords && !isSelected) {
                        const { x, y } = projectCoords(a.coords.lat, a.coords.lng)
                        setPanOffset({
                          x: (MAP_W / 2 - x) * zoomLevel,
                          y: (MAP_H / 2 - y) * zoomLevel
                        })
                      }
                    }}
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
