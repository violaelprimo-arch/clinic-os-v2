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
  RotateCw,
  ChevronLeft,
  ChevronRight,
  Play,
  Pause,
  ExternalLink,
  Layers,
  CheckCircle2
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
  CheckCircle2
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

  // Determine initial active card
  const defaultIdx = useMemo(() => {
    const found = visibleCards.findIndex((c) => c.isDefaultActive)
    return found >= 0 ? found : 0
  }, [visibleCards])

  const [activeIndex, setActiveIndex] = useState<number>(defaultIdx)
  const [isPlaying, setIsPlaying] = useState<boolean>(motionLevel !== 'none')
  const [isHovered, setIsHovered] = useState<boolean>(false)
  const [touchStartX, setTouchStartX] = useState<number | null>(null)

  // Keep active index in bounds if cards change
  useEffect(() => {
    if (activeIndex >= visibleCards.length) {
      setActiveIndex(0)
    }
  }, [visibleCards.length, activeIndex])

  // Auto-rotation interval based on motionSpeed
  const autoRotateInterval = useMemo(() => {
    if (motionSpeed === 'fast') return 3500
    if (motionSpeed === 'slow') return 7000
    return 5000
  }, [motionSpeed])

  useEffect(() => {
    if (!isPlaying || isHovered || motionLevel === 'none' || visibleCards.length <= 1) return

    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % visibleCards.length)
    }, autoRotateInterval)

    return () => clearInterval(timer)
  }, [isPlaying, isHovered, motionLevel, visibleCards.length, autoRotateInterval])

  // Navigation handlers
  const handlePrev = useCallback(() => {
    setActiveIndex((prev) => (prev - 1 + visibleCards.length) % visibleCards.length)
  }, [visibleCards.length])

  const handleNext = useCallback(() => {
    setActiveIndex((prev) => (prev + 1) % visibleCards.length)
  }, [visibleCards.length])

  const handleSelectCard = useCallback((index: number) => {
    setActiveIndex(index)
  }, [])

  // Touch Swipe Handlers for Mobile
  const handleTouchStart = (e: React.TouchEvent) => {
    setTouchStartX(e.touches[0].clientX)
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return
    const touchEndX = e.changedTouches[0].clientX
    const diff = touchEndX - touchStartX
    if (Math.abs(diff) > 40) {
      if (diff > 0) {
        // Swiped Right
        isRtl ? handleNext() : handlePrev()
      } else {
        // Swiped Left
        isRtl ? handlePrev() : handleNext()
      }
    }
    setTouchStartX(null)
  }

  const activeCard = visibleCards[activeIndex] || visibleCards[0]
  const ActiveIcon = ICON_MAP[activeCard.iconName] || CalendarCheck

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`relative w-full overflow-hidden bg-gradient-to-b from-[#050b14] via-[#071324] to-[#040912] rounded-3xl border border-sky-900/40 p-4 sm:p-8 select-none ${className}`}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
      style={{ minHeight: '520px' }}
    >
      {/* Dynamic Background Orbital Rings & Laser Grid */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Subtle grid pattern */}
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#0284c70a_1px,transparent_1px),linear-gradient(to_bottom,#0284c70a_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)]" />

        {/* Ambient Glowing Orbs */}
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] rounded-full blur-3xl opacity-25 transition-all duration-700"
          style={{
            background: `radial-gradient(circle, ${activeCard.glowColor || '#00a8e8'} 0%, transparent 70%)`
          }}
        />

        {/* SVG Orbital Ellipses */}
        <svg className="absolute inset-0 w-full h-full" preserveAspectRatio="none">
          <ellipse
            cx="50%"
            cy="52%"
            rx="46%"
            ry="32%"
            fill="none"
            stroke="url(#orbit-laser-grad)"
            strokeWidth="1.5"
            strokeDasharray="6 8"
            className="opacity-40 animate-[spin_60s_linear_infinite]"
          />
          <ellipse
            cx="50%"
            cy="52%"
            rx="32%"
            ry="20%"
            fill="none"
            stroke="rgba(2, 132, 199, 0.25)"
            strokeWidth="1"
            className="opacity-50"
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

      {/* Top Header Bar & Real-time Indicator */}
      <div className="relative z-20 flex items-center justify-between gap-3 pb-4 border-b border-slate-800/80 text-xs">
        <div className="flex items-center gap-2.5">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse shadow-md shadow-emerald-400/50" />
          <span className="font-black text-slate-200 tracking-wide text-xs">
            {isRtl ? 'مدار المنظومة السحابية المتكاملة' : 'Interactive Cloud OS Orbit'}
          </span>
          <span className="hidden sm:inline-block px-2 py-0.5 rounded-full bg-sky-950/80 border border-sky-800/60 text-sky-400 font-mono text-[10px] font-bold">
            {activeIndex + 1} / {visibleCards.length}
          </span>
        </div>

        {/* Play / Pause / Rotate Controls */}
        <div className="flex items-center gap-1.5 bg-slate-900/80 border border-slate-800 rounded-xl p-1 backdrop-blur-md">
          <button
            type="button"
            onClick={handlePrev}
            aria-label="Previous card"
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
            aria-label="Next card"
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            {isRtl ? <ChevronLeft className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Main 3D Orbit Stage */}
      <div
        className="relative z-10 w-full flex items-center justify-center my-6 sm:my-8"
        style={{ minHeight: '340px' }}
      >
        {/* Orbital Satellite Nodes (Surrounding Nodes in the 3D Ring) */}
        <div className="absolute inset-0 hidden md:flex items-center justify-center pointer-events-none">
          {visibleCards.map((card, idx) => {
            const total = visibleCards.length
            // Calculate relative angle from active card (active card is at angle 0 = front)
            const diff = idx - activeIndex
            const normalizedAngle = ((diff % total) + total) % total
            const angleRad = (normalizedAngle * 2 * Math.PI) / total

            // Elliptical orbit projection
            const radiusX = 380
            const radiusY = 130
            const x = Math.sin(angleRad) * radiusX
            const y = Math.cos(angleRad) * radiusY * 0.4
            const z = Math.cos(angleRad) * 100

            const isCurrent = idx === activeIndex
            const CardIcon = ICON_MAP[card.iconName] || CalendarCheck

            // If active, it will be rendered in the main spotlight card below
            if (isCurrent) return null

            const scale = 0.72 + (z / 200) * 0.15
            const opacity = 0.5 + (z / 200) * 0.35

            return (
              <button
                key={card.id || idx}
                type="button"
                onClick={() => handleSelectCard(idx)}
                className="absolute pointer-events-auto cursor-pointer group transition-all duration-700 ease-out focus:outline-hidden"
                style={{
                  transform: `translate3d(${x}px, ${y}px, ${z}px) scale(${scale})`,
                  opacity,
                  zIndex: Math.round(z + 50)
                }}
              >
                <div
                  className="px-4 py-2.5 rounded-2xl border flex items-center gap-2.5 backdrop-blur-xl transition-all duration-300 group-hover:scale-110 group-hover:opacity-100"
                  style={{
                    backgroundColor: 'rgba(6, 16, 32, 0.85)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    boxShadow: '0 8px 24px rgba(0, 0, 0, 0.5)'
                  }}
                >
                  <div
                    className="w-7 h-7 rounded-xl flex items-center justify-center shrink-0"
                    style={{
                      backgroundColor: `${card.cardColor || '#0ea5e9'}25`,
                      color: card.cardColor || '#0ea5e9'
                    }}
                  >
                    <CardIcon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-black text-slate-200 whitespace-nowrap">
                    {isRtl ? card.title : card.titleEn || card.title}
                  </span>
                  <span
                    className="w-2 h-2 rounded-full shrink-0 animate-ping"
                    style={{ backgroundColor: card.cardColor || '#0ea5e9' }}
                  />
                </div>
              </button>
            )
          })}
        </div>

        {/* Spotlight Active Center Card (High Contrast, Large Typography, Crisp DOM) */}
        <div
          className="relative z-30 w-full max-w-xl mx-auto rounded-3xl p-6 sm:p-8 backdrop-blur-2xl transition-all duration-500 ease-out border-2 shadow-2xl"
          style={{
            backgroundColor: 'rgba(7, 18, 36, 0.94)',
            borderColor: activeCard.cardColor || '#00a8e8',
            boxShadow: `0 20px 60px -10px rgba(0, 0, 0, 0.8), 0 0 35px ${activeCard.glowColor || 'rgba(0, 168, 232, 0.35)'}`,
            transform: 'scale(1.02)'
          }}
        >
          {/* Top Status & Pill Bar */}
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-3">
              <div
                className="w-13 h-13 rounded-2xl flex items-center justify-center shadow-lg transition-transform duration-300"
                style={{
                  backgroundColor: `${activeCard.cardColor || '#00a8e8'}25`,
                  color: activeCard.cardColor || '#00a8e8',
                  boxShadow: `0 0 20px ${activeCard.glowColor || 'rgba(0, 168, 232, 0.4)'}`
                }}
              >
                <ActiveIcon className="w-7 h-7" />
              </div>
              <div>
                <span
                  className="text-xs font-bold tracking-wide uppercase"
                  style={{ color: activeCard.cardColor || '#00a8e8' }}
                >
                  {isRtl ? activeCard.subtitle : activeCard.subtitleEn || activeCard.subtitle}
                </span>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                  <span className="text-[11px] font-bold text-slate-300">
                    {isRtl ? 'وظيفة نشطة ومزامنة' : 'Active & Synced'}
                  </span>
                </div>
              </div>
            </div>

            <span className="px-3 py-1 rounded-full text-xs font-bold bg-white/10 text-white border border-white/15">
              #{activeIndex + 1}
            </span>
          </div>

          {/* Prominent High-Contrast Title */}
          <h3 className="text-xl sm:text-2xl lg:text-3xl font-black text-white tracking-tight leading-snug mb-3">
            {isRtl ? activeCard.title : activeCard.titleEn || activeCard.title}
          </h3>

          {/* Full Readable Description */}
          <p className="text-sm sm:text-base text-slate-200 leading-relaxed font-medium mb-5">
            {isRtl ? activeCard.description : activeCard.descriptionEn || activeCard.description}
          </p>

          {/* Bottom Action Strip */}
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t border-slate-800/80">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-400">
              <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              <span>{isRtl ? 'معتمد في العيادات والمراكز' : 'Verified Clinical Workflow'}</span>
            </div>

            {activeCard.buttonText && (
              <a
                href={activeCard.buttonLink || '#contact'}
                className="px-4 py-2 rounded-xl text-xs sm:text-sm font-black text-white shadow-md transition-all hover:scale-105 active:scale-95 flex items-center gap-1.5"
                style={{
                  backgroundColor: activeCard.cardColor || '#00a8e8',
                  boxShadow: `0 4px 18px ${activeCard.glowColor || 'rgba(0, 168, 232, 0.4)'}`
                }}
              >
                <span>{isRtl ? activeCard.buttonText : activeCard.buttonTextEn || activeCard.buttonText}</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Fast Navigation Pills (Clickable for Mobile & Desktop) */}
      <div className="relative z-20 flex flex-wrap items-center justify-center gap-2 pt-2">
        {visibleCards.map((card, idx) => {
          const isSelected = idx === activeIndex
          const CardIcon = ICON_MAP[card.iconName] || CalendarCheck
          return (
            <button
              key={card.id || idx}
              type="button"
              onClick={() => handleSelectCard(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                isSelected
                  ? 'bg-white text-slate-900 shadow-lg scale-105'
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
