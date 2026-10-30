'use client'

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import {
  Calendar,
  CalendarCheck,
  Tv,
  FileText,
  FileSignature,
  Receipt,
  Building2,
  Users,
  Smartphone,
  ShieldCheck,
  Clock,
  Sparkles,
  Award,
  Stethoscope,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ExternalLink,
  Layers,
  CheckCircle2,
  X,
  Maximize2
} from 'lucide-react'
import { OrbitCardItem, DEFAULT_ORBIT_CARDS } from '@/lib/landing-config'

interface ClinicPillars3DSceneProps {
  cards?: OrbitCardItem[]
  heroImage?: string
  motionLevel?: 'none' | 'subtle' | 'normal' | 'advanced'
  motionSpeed?: 'slow' | 'normal' | 'fast'
  isRtl?: boolean
  className?: string
  fallbackView?: React.ReactNode
}

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  CalendarCheck,
  Tv,
  FileText,
  FileSignature,
  Receipt,
  Building2,
  Users,
  Smartphone,
  ShieldCheck,
  Clock,
  Sparkles,
  Award,
  Stethoscope,
  Layers,
  CheckCircle2,
}

export function ClinicPillars3DScene({
  cards,
  heroImage,
  motionLevel = 'subtle',
  motionSpeed = 'normal',
  isRtl = true,
  className = '',
  fallbackView
}: ClinicPillars3DSceneProps) {
  // 1. Resolve and filter visible cards
  const rawCards = (cards && cards.length > 0) ? cards : DEFAULT_ORBIT_CARDS
  const visibleCards = useMemo(() => {
    const list = rawCards.filter((c) => c.visible !== false)
    return list.length > 0 ? list : DEFAULT_ORBIT_CARDS
  }, [rawCards])

  // Expanded card state: null means base view (all small nodes orbiting)
  // When a user clicks a node or icon, expandedIndex is set to that card's index
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null)
  const [activeIndex, setActiveIndex] = useState<number>(0)
  const [isPlaying, setIsPlaying] = useState<boolean>(motionLevel !== 'none')
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const [rotationAngle, setRotationAngle] = useState<number>(0)
  const [isMobile, setIsMobile] = useState<boolean>(false)

  // Track viewport width for responsive orbital radius
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768)
    }
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Auto-rotation speed
  const speedStep = useMemo(() => {
    if (motionLevel === 'none') return 0
    if (motionSpeed === 'fast') return 0.007
    if (motionSpeed === 'slow') return 0.002
    return 0.004
  }, [motionLevel, motionSpeed])

  // Continuous subtle orbital drift when not hovered and not expanded
  useEffect(() => {
    if (!isPlaying || isHovered || expandedIndex !== null || motionLevel === 'none') return

    let rafId: number
    const animate = () => {
      setRotationAngle((prev) => (prev + speedStep) % (Math.PI * 2))
      rafId = requestAnimationFrame(animate)
    }
    rafId = requestAnimationFrame(animate)
    return () => cancelAnimationFrame(rafId)
  }, [isPlaying, isHovered, expandedIndex, motionLevel, speedStep])

  // Navigation handlers
  const handlePrev = useCallback(() => {
    if (expandedIndex !== null) {
      setExpandedIndex((prev) => (prev === null ? 0 : (prev - 1 + visibleCards.length) % visibleCards.length))
    } else {
      setRotationAngle((prev) => prev - (Math.PI * 2) / visibleCards.length)
    }
  }, [expandedIndex, visibleCards.length])

  const handleNext = useCallback(() => {
    if (expandedIndex !== null) {
      setExpandedIndex((prev) => (prev === null ? 0 : (prev + 1) % visibleCards.length))
    } else {
      setRotationAngle((prev) => prev + (Math.PI * 2) / visibleCards.length)
    }
  }, [expandedIndex, visibleCards.length])

  const handleCardClick = useCallback((index: number) => {
    if (expandedIndex === index) {
      setExpandedIndex(null) // toggle close if already open
    } else {
      setExpandedIndex(index)
      setActiveIndex(index)
    }
  }, [expandedIndex])

  const currentExpandedCard = expandedIndex !== null ? visibleCards[expandedIndex] : null
  const ExpandedIcon = currentExpandedCard ? (ICON_MAP[currentExpandedCard.iconName] || CalendarCheck) : null

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`relative w-full overflow-hidden bg-gradient-to-b from-[#050b14] via-[#071324] to-[#040912] rounded-3xl border border-sky-900/40 p-4 sm:p-7 select-none transition-all ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{ minHeight: '520px' }}
    >
      {/* Dynamic Background Orbital Rings & Laser Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284c70a_1px,transparent_1px),linear-gradient(to_bottom,#0284c70a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        {/* Ambient Glowing Orbs */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[480px] h-[480px] rounded-full blur-3xl opacity-20 transition-all duration-700 pointer-events-none"
          style={{
            background: `radial-gradient(circle, ${currentExpandedCard?.glowColor || '#00a8e8'} 0%, transparent 70%)`
          }}
        />

        {/* SVG Orbital Ellipses */}
        <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
          <ellipse
            cx="50%"
            cy="50%"
            rx="45%"
            ry="32%"
            fill="none"
            stroke="url(#orbit-laser-grad)"
            strokeWidth="1.5"
            strokeDasharray="6 8"
            className="opacity-35 animate-[spin_80s_linear_infinite]"
          />
          <ellipse
            cx="50%"
            cy="50%"
            rx="30%"
            ry="20%"
            fill="none"
            stroke="rgba(2, 132, 199, 0.25)"
            strokeWidth="1"
            className="opacity-45"
          />
          <defs>
            <linearGradient id="orbit-laser-grad" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#00a8e8" stopOpacity="0.8" />
              <stop offset="50%" stopColor="#6366f1" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#00a8e8" stopOpacity="0.8" />
            </linearGradient>
          </defs>
        </svg>
      </div>

      {/* Top Header Bar & Interaction Status */}
      <div className="relative z-20 flex items-center justify-between gap-3 pb-4 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50" />
          <span className="font-black text-slate-200 tracking-wide text-xs">
            {isRtl ? 'مدار المنظومة السحابية المتكاملة' : 'Interactive Cloud OS Orbit'}
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-400 font-mono text-[10px] font-bold">
            {expandedIndex !== null ? `${expandedIndex + 1} / ${visibleCards.length}` : `${visibleCards.length} وظائف سحابية`}
          </span>
        </div>

        {/* Controls: Prev / Pause / Next */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-xl p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isRtl ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronLeft className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={() => setIsPlaying(!isPlaying)}
            aria-label={isPlaying ? 'Pause orbit rotation' : 'Start orbit rotation'}
            className="p-1.5 rounded-lg text-slate-400 hover:text-sky-400 hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isPlaying ? <Pause className="w-3.5 h-3.5" /> : <Play className="w-3.5 h-3.5" />}
          </button>
          <button
            type="button"
            onClick={handleNext}
            aria-label="Next"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3D Orbit Stage */}
      <div
        className="relative z-10 w-full flex items-center justify-center my-4 sm:my-6"
        style={{ minHeight: '360px' }}
      >
        {/* Central Core Hub (Rendered in the center when looking at the orbit) */}
        <div
          className={`transition-all duration-500 ease-out flex flex-col items-center justify-center text-center p-6 rounded-3xl border ${
            expandedIndex !== null
              ? 'opacity-20 scale-90 blur-xs pointer-events-none'
              : 'opacity-100 scale-100'
          }`}
          style={{
            backgroundColor: 'rgba(6, 16, 32, 0.6)',
            borderColor: 'rgba(2, 132, 199, 0.25)',
            boxShadow: '0 0 45px rgba(0, 168, 232, 0.15)'
          }}
        >
          <div className="relative mb-3">
            <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-sky-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-sky-600/30">
              <Stethoscope className="w-8 h-8" />
            </div>
            <span className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-emerald-400 border-2 border-slate-900 animate-ping" />
          </div>

          <h4 className="text-sm sm:text-base font-black text-white tracking-tight">
            {isRtl ? 'يلا كلينيك OS' : 'Yalla Clinic OS'}
          </h4>
          <p className="text-[11px] text-sky-400 font-bold mt-0.5">
            {isRtl ? 'المنظومة السحابية الموحدة للعيادات' : 'Unified Medical Operating System'}
          </p>

          <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-sky-950/70 border border-sky-800/50 text-[10px] font-bold text-sky-300 animate-pulse">
            <Sparkles className="w-3 h-3 text-amber-400" />
            <span>{isRtl ? 'انقر على أي بطاقة لتكبيرها' : 'Click any node to expand'}</span>
          </div>
        </div>

        {/* Floating Orbital Nodes (The small nodes orbiting in 3D around the center) */}
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          {visibleCards.map((card, idx) => {
            const total = visibleCards.length
            const angleRad = (idx * 2 * Math.PI) / total - Math.PI / 2 + rotationAngle

            // Responsive radius for desktop vs mobile
            const radiusX = isMobile ? 140 : 320
            const radiusY = isMobile ? 100 : 125
            const x = Math.cos(angleRad) * radiusX
            const y = Math.sin(angleRad) * radiusY
            const z = Math.sin(angleRad) * 60

            const CardIcon = ICON_MAP[card.iconName] || CalendarCheck
            const isThisExpanded = expandedIndex === idx

            const scale = isThisExpanded ? 1.05 : 0.85 + (z / 200) * 0.2
            const opacity = expandedIndex !== null && !isThisExpanded ? 0.25 : 0.85 + (z / 200) * 0.15

            return (
              <button
                key={card.id || idx}
                type="button"
                onClick={() => handleCardClick(idx)}
                aria-label={`توسيع ${card.title}`}
                className="absolute pointer-events-auto cursor-pointer group transition-all duration-300 ease-out focus:outline-hidden"
                style={{
                  transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`,
                  opacity,
                  zIndex: isThisExpanded ? 40 : Math.round(z + 50)
                }}
              >
                <div
                  className="px-3 sm:px-4 py-2 sm:py-2.5 rounded-2xl border flex items-center gap-2 sm:gap-2.5 backdrop-blur-xl transition-all duration-300 group-hover:scale-110 group-hover:opacity-100 group-hover:border-sky-300 active:scale-95 shadow-xl"
                  style={{
                    backgroundColor: 'rgba(6, 16, 32, 0.92)',
                    borderColor: card.cardColor ? `${card.cardColor}55` : 'rgba(255, 255, 255, 0.2)',
                    boxShadow: `0 8px 24px rgba(0, 0, 0, 0.6), 0 0 16px ${card.glowColor || 'rgba(0, 168, 232, 0.3)'}`
                  }}
                >
                  <div
                    className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 shadow-md group-hover:rotate-6 transition-transform"
                    style={{
                      backgroundColor: `${card.cardColor || '#0ea5e9'}25`,
                      color: card.cardColor || '#0ea5e9'
                    }}
                  >
                    <CardIcon className="w-4 h-4" />
                  </div>

                  <div className="text-right min-w-0">
                    <span className="text-[11px] sm:text-xs font-black text-slate-100 block whitespace-nowrap leading-tight">
                      {isRtl ? card.title : card.titleEn || card.title}
                    </span>
                  </div>

                  <span
                    className="w-2 h-2 rounded-full shrink-0 animate-ping ml-1"
                    style={{ backgroundColor: card.cardColor || '#0ea5e9' }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {/* Backdrop overlay when a card is expanded */}
        {currentExpandedCard && (
          <div
            onClick={() => setExpandedIndex(null)}
            className="absolute inset-0 z-30 bg-black/60 backdrop-blur-xs transition-opacity animate-in fade-in duration-300 cursor-pointer"
            title="انقر للإغلاق والرجوع للمدار"
          />
        )}

        {/* Expanded Spotlight Card (Appears ONLY when clicked, with high-end spring motion) */}
        {currentExpandedCard && (
          <div
            className="relative z-40 w-full max-w-xl mx-auto rounded-3xl p-6 sm:p-8 backdrop-blur-2xl border-2 shadow-2xl animate-in zoom-in-95 fade-in duration-300 ease-out"
            style={{
              backgroundColor: 'rgba(7, 18, 36, 0.96)',
              borderColor: currentExpandedCard.cardColor || '#00a8e8',
              boxShadow: `0 24px 60px -10px rgba(0, 0, 0, 0.85), 0 0 40px ${currentExpandedCard.glowColor || 'rgba(0, 168, 232, 0.4)'}`,
            }}
          >
            {/* Top Bar with Icon, Subtitle & Close (X) Button */}
            <div className="flex items-center justify-between gap-3 mb-5">
              <div className="flex items-center gap-3">
                <div
                  className="w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg"
                  style={{
                    backgroundColor: `${currentExpandedCard.cardColor || '#00a8e8'}25`,
                    color: currentExpandedCard.cardColor || '#00a8e8',
                    boxShadow: `0 0 20px ${currentExpandedCard.glowColor || 'rgba(0, 168, 232, 0.4)'}`
                  }}
                >
                  {ExpandedIcon && <ExpandedIcon className="w-7 h-7" />}
                </div>
                <div>
                  <span
                    className="text-xs font-bold tracking-wide uppercase"
                    style={{ color: currentExpandedCard.cardColor || '#00a8e8' }}
                  >
                    {isRtl ? currentExpandedCard.subtitle : currentExpandedCard.subtitleEn || currentExpandedCard.subtitle}
                  </span>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-bold text-slate-300">
                      {isRtl ? 'وظيفة نشطة ومزامنة' : 'Active & Synced'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Close Button (X) */}
              <button
                type="button"
                onClick={() => setExpandedIndex(null)}
                className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer border border-white/15"
                title="إغلاق والرجوع للمدار"
                aria-label="إغلاق"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Prominent High-Contrast Title */}
            <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug mb-3">
              {isRtl ? currentExpandedCard.title : currentExpandedCard.titleEn || currentExpandedCard.title}
            </h3>

            {/* Full Readable Description */}
            <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium mb-5">
              {isRtl ? currentExpandedCard.description : currentExpandedCard.descriptionEn || currentExpandedCard.description}
            </p>

            {/* Bottom Action Strip */}
            <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
              <button
                type="button"
                onClick={() => setExpandedIndex(null)}
                className="text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer flex items-center gap-1"
              >
                <X className="w-3.5 h-3.5" />
                <span>{isRtl ? 'إغلاق والرجوع للمدار' : 'Back to Orbit'}</span>
              </button>

              {currentExpandedCard.buttonText && (
                <a
                  href={currentExpandedCard.buttonLink || '#contact'}
                  className="px-4 py-2 rounded-xl text-xs sm:text-sm font-black text-white shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                  style={{
                    backgroundColor: currentExpandedCard.cardColor || '#00a8e8',
                    boxShadow: `0 4px 18px ${currentExpandedCard.glowColor || 'rgba(0, 168, 232, 0.4)'}`
                  }}
                >
                  <span>{isRtl ? currentExpandedCard.buttonText : currentExpandedCard.buttonTextEn || currentExpandedCard.buttonText}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Bottom Fast Navigation Pills (Clickable for Mobile & Desktop) */}
      <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 pt-2">
        {visibleCards.map((card, idx) => {
          const isSelected = expandedIndex === idx
          const CardIcon = ICON_MAP[card.iconName] || CalendarCheck
          return (
            <button
              key={card.id || idx}
              type="button"
              onClick={() => handleCardClick(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-lg scale-105 font-black'
                  : 'bg-slate-900/80 text-slate-400 hover:text-white border border-slate-800 hover:border-slate-700'
              }`}
            >
              <CardIcon className={`w-3.5 h-3.5 ${isSelected ? 'text-sky-600' : 'text-slate-400'}`} />
              <span className="hidden sm:inline">
                {isRtl ? card.title : card.titleEn || card.title}
              </span>
              <span className="sm:hidden">#{idx + 1}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
