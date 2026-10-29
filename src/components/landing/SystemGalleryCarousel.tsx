'use client'

import React, { useState, useEffect, useRef, useCallback } from 'react'
import {
  ChevronLeft,
  ChevronRight,
  Maximize2,
  Minimize2,
  X,
  Play,
  Pause,
  ZoomIn,
  ZoomOut,
  Sparkles,
  Layers,
  ArrowRight,
  ArrowLeft,
  Monitor
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { type ScreenshotItem } from '@/lib/landing-config'
import { useLanguage } from '@/context/LanguageContext'

export interface SystemGalleryCarouselProps {
  screenshots: ScreenshotItem[]
  autoplay?: boolean
  intervalSeconds?: number
  sectionTitle?: string
  sectionSubtitle?: string
}

export function SystemGalleryCarousel({
  screenshots = [],
  autoplay = true,
  intervalSeconds = 6,
  sectionTitle,
  sectionSubtitle,
}: SystemGalleryCarouselProps) {
  const { isRtl } = useLanguage()
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isPlaying, setIsPlaying] = useState(autoplay)
  const [isHovered, setIsHovered] = useState(false)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [lightboxZoom, setLightboxZoom] = useState(1)

  // Drag / swipe states
  const dragStartRef = useRef<{ x: number; y: number; time: number } | null>(null)
  const isDraggingRef = useRef(false)
  const scrollPosRef = useRef(0)

  const count = screenshots.length
  const safeIndex = count > 0 ? (currentIndex % count + count) % count : 0
  const currentItem = screenshots[safeIndex]

  const nextSlide = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev + 1) % count)
  }, [count])

  const prevSlide = useCallback(() => {
    if (count <= 1) return
    setCurrentIndex((prev) => (prev - 1 + count) % count)
  }, [count])

  const goToSlide = (idx: number) => {
    setCurrentIndex(idx)
  }

  // Auto-play timer
  useEffect(() => {
    if (!isPlaying || isHovered || lightboxIndex !== null || count <= 1) return

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches) return

    const timer = setInterval(() => {
      if (!document.hidden) {
        nextSlide()
      }
    }, Math.max(2, intervalSeconds) * 1000)

    return () => clearInterval(timer)
  }, [isPlaying, isHovered, lightboxIndex, count, intervalSeconds, nextSlide])

  // Lightbox keyboard controls (Escape, ArrowLeft, ArrowRight)
  useEffect(() => {
    if (lightboxIndex === null) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeLightbox()
      } else if (e.key === 'ArrowRight') {
        if (isRtl) {
          prevLightbox()
        } else {
          nextLightbox()
        }
      } else if (e.key === 'ArrowLeft') {
        if (isRtl) {
          nextLightbox()
        } else {
          prevLightbox()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [lightboxIndex, isRtl, count])

  const openLightbox = (index: number) => {
    scrollPosRef.current = window.scrollY
    setLightboxIndex(index)
    setLightboxZoom(1)
  }

  const closeLightbox = () => {
    setLightboxIndex(null)
    setLightboxZoom(1)
    // Restore scroll position
    window.scrollTo({ top: scrollPosRef.current, behavior: 'instant' })
  }

  const nextLightbox = () => {
    if (count <= 1 || lightboxIndex === null) return
    setLightboxIndex((prev) => (prev! + 1) % count)
    setLightboxZoom(1)
  }

  const prevLightbox = () => {
    if (count <= 1 || lightboxIndex === null) return
    setLightboxIndex((prev) => (prev! - 1 + count) % count)
    setLightboxZoom(1)
  }

  // Pointer drag for mouse and touch
  const handlePointerDown = (e: React.PointerEvent) => {
    dragStartRef.current = { x: e.clientX, y: e.clientY, time: Date.now() }
    isDraggingRef.current = false
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    if (Math.hypot(dx, dy) > 8) {
      isDraggingRef.current = true
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!dragStartRef.current) return
    const dx = e.clientX - dragStartRef.current.x
    const dy = e.clientY - dragStartRef.current.y
    const elapsed = Date.now() - dragStartRef.current.time
    const wasDragging = isDraggingRef.current

    dragStartRef.current = null
    isDraggingRef.current = false

    if (wasDragging && Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy)) {
      if (isRtl) {
        if (dx < 0) nextSlide()
        else prevSlide()
      } else {
        if (dx < 0) nextSlide()
        else prevSlide()
      }
    } else if (!wasDragging && elapsed < 400 && Math.hypot(dx, dy) < 10) {
      openLightbox(safeIndex)
    }
  }

  // Handle empty state
  if (count === 0) {
    return (
      <section id="gallery" className="py-16 px-4 max-w-6xl mx-auto text-center">
        <div className="bg-white dark:bg-slate-900 rounded-3xl p-10 border border-dashed border-slate-200 dark:border-slate-800 space-y-3">
          <Monitor className="w-12 h-12 text-slate-300 dark:text-slate-600 mx-auto" />
          <h3 className="text-base font-black text-slate-800 dark:text-slate-200">
            {sectionTitle || 'معرض واجهات يلا كلينيك'}
          </h3>
          <p className="text-xs text-slate-400 max-w-md mx-auto">
            {sectionSubtitle || 'يمكن لمالك المنصة إضافة لقطات وصور حقيقية للنظام بسهولة من لوحة تحكم المالك.'}
          </p>
        </div>
      </section>
    )
  }

  return (
    <section
      id="gallery"
      aria-label="معرض صور النظام"
      className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto relative select-none"
    >
      {/* Section Header */}
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-xs font-black">
          <Layers className="w-3.5 h-3.5" />
          <span>{isRtl ? 'واجهات حقيقية من داخل العيادة' : 'Authentic Clinic System Views'}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {sectionTitle || (isRtl ? 'معرض واجهات يلا كلينيك الحقيقية' : 'Real Yalla Clinic Screenshots')}
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
          {sectionSubtitle ||
            (isRtl
              ? 'شاشات سهلة وسريعة تم تصميمها مع الأطباء لتناسب ضغط العمل اليومي وتوفير وقت العيادة.'
              : 'Designed with doctors to handle busy clinic days with zero friction.')}
        </p>
      </div>

      {/* Main Carousel Frame Container */}
      <div
        className="relative max-w-5xl mx-auto"
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        onFocus={() => setIsHovered(true)}
        onBlur={() => setIsHovered(false)}
      >
        {/* macOS-style Top Bar & Frame */}
        <div className="rounded-3xl bg-white dark:bg-[#081526] shadow-2xl border border-sky-100 dark:border-slate-800 overflow-hidden transition-all duration-300">
          {/* Top Window Bar */}
          <div className="px-4 py-3 bg-slate-50 dark:bg-slate-800/60 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-rose-400/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-amber-400/80 inline-block" />
              <span className="w-3 h-3 rounded-full bg-emerald-400/80 inline-block" />
              <span className="mr-2 text-xs font-bold text-slate-500 dark:text-slate-400 hidden sm:inline">
                Yalla Clinic OS — {currentItem.category || (isRtl ? 'شاشة النظام' : 'System View')}
              </span>
            </div>

            {/* Play/Pause & Counter Controls in Header */}
            <div className="flex items-center gap-2">
              <span className="text-[11px] font-mono font-bold text-slate-400">
                {safeIndex + 1} / {count}
              </span>

              {count > 1 && (
                <button
                  type="button"
                  onClick={() => setIsPlaying((p) => !p)}
                  className="w-7 h-7 rounded-lg bg-white dark:bg-slate-700 border border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-300 flex items-center justify-center hover:bg-sky-50 dark:hover:bg-slate-600 transition-colors cursor-pointer"
                  title={isPlaying ? 'إيقاف التحريك التلقائي' : 'تشغيل التحريك التلقائي'}
                >
                  {isPlaying ? <Pause className="w-3 h-3" /> : <Play className="w-3 h-3" />}
                </button>
              )}

              <button
                type="button"
                onClick={() => openLightbox(safeIndex)}
                className="w-7 h-7 rounded-lg bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 flex items-center justify-center hover:bg-sky-100 transition-colors cursor-pointer"
                title="تكبير الصورة بالحجم الكامل"
              >
                <Maximize2 className="w-3 h-3" />
              </button>
            </div>
          </div>

          {/* Screenshot Display Area with Pointer Swipe Support */}
          <div
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className="relative bg-slate-950/5 dark:bg-slate-950/40 min-h-[260px] sm:min-h-[440px] md:min-h-[500px] flex items-center justify-center p-2 sm:p-4 cursor-zoom-in touch-pan-y"
            title="اضغط للتكبير (Lightbox) أو اسحب للتنقل بين الصور"
          >
            <AnimatePresence mode="wait">
              <motion.div
                key={currentItem.id || safeIndex}
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.98 }}
                transition={{ duration: 0.35, ease: 'easeOut' }}
                className="w-full flex items-center justify-center"
              >
                <img
                  src={currentItem.imageUrl}
                  alt={currentItem.altText || currentItem.title || 'لقطة شاشة من نظام يلا كلينيك'}
                  draggable={false}
                  loading="lazy"
                  className="max-h-[340px] sm:max-h-[520px] w-auto max-w-full rounded-2xl object-contain shadow-lg border border-slate-200/50 dark:border-slate-700/50"
                />
              </motion.div>
            </AnimatePresence>

            {/* Desktop Navigation Arrows on the sides */}
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    isRtl ? prevSlide() : prevSlide()
                  }}
                  className="absolute right-2 sm:right-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xl border border-sky-100 dark:border-slate-800 text-slate-800 dark:text-white flex items-center justify-center hover:bg-sky-50 dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all cursor-pointer z-10"
                  aria-label="الصورة السابقة"
                >
                  {isRtl ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
                </button>

                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    isRtl ? nextSlide() : nextSlide()
                  }}
                  className="absolute left-2 sm:left-4 top-1/2 -translate-y-1/2 w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-white/90 dark:bg-slate-900/90 backdrop-blur-md shadow-xl border border-sky-100 dark:border-slate-800 text-slate-800 dark:text-white flex items-center justify-center hover:bg-sky-50 dark:hover:bg-slate-800 hover:scale-105 active:scale-95 transition-all cursor-pointer z-10"
                  aria-label="الصورة التالية"
                >
                  {isRtl ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                </button>
              </>
            )}
          </div>

          {/* Info Card beneath image */}
          <div className="p-5 sm:p-6 bg-white dark:bg-[#081526] border-t border-slate-100 dark:border-slate-800 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-0.5 rounded-md bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 font-bold text-xs border border-sky-100 dark:border-sky-800">
                    {currentItem.category || (isRtl ? 'النظام الطبي' : 'Clinical OS')}
                  </span>
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white">
                    {isRtl ? currentItem.title : currentItem.titleEn || currentItem.title}
                  </h3>
                </div>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 font-medium">
                  {isRtl ? currentItem.subtitle : currentItem.subtitleEn || currentItem.subtitle}
                </p>
              </div>

              {/* Highlights Pill Badges */}
              {currentItem.highlights && currentItem.highlights.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1 sm:pt-0">
                  {currentItem.highlights.map((tag, idx) => (
                    <span
                      key={idx}
                      className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-[11px] font-bold"
                    >
                      ✓ {tag}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Carousel Dots & Controls Below Container */}
        {count > 1 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            {screenshots.map((_, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => goToSlide(idx)}
                className={`transition-all rounded-full cursor-pointer ${
                  safeIndex === idx
                    ? 'w-8 h-2.5 bg-sky-600 dark:bg-sky-400'
                    : 'w-2.5 h-2.5 bg-slate-300 dark:bg-slate-700 hover:bg-slate-400'
                }`}
                aria-label={`الانتقال إلى الشريحة ${idx + 1}`}
              />
            ))}
          </div>
        )}
      </div>

      {/* ============================================================ */}
      {/* FULLSCREEN LIGHTBOX MODAL */}
      {/* ============================================================ */}
      {lightboxIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-md flex flex-col items-center justify-between p-3 sm:p-6 overflow-hidden select-none"
        >
          {/* Lightbox Header */}
          <div className="w-full max-w-6xl flex items-center justify-between text-white pb-3 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <span className="px-2.5 py-0.5 rounded-md bg-sky-600 text-white text-xs font-black">
                {screenshots[lightboxIndex]?.category || 'يلا كلينيك'}
              </span>
              <h4 className="text-sm sm:text-base font-black truncate max-w-sm sm:max-w-md">
                {screenshots[lightboxIndex]?.title}
              </h4>
              <span className="text-xs text-slate-400 font-mono hidden sm:inline">
                ({lightboxIndex + 1} / {count})
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setLightboxZoom((z) => (z > 1 ? 1 : 1.6))}
                className="p-2 rounded-xl bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
                title={lightboxZoom > 1 ? 'تصغير' : 'تكبير'}
              >
                {lightboxZoom > 1 ? <ZoomOut className="w-4 h-4" /> : <ZoomIn className="w-4 h-4" />}
              </button>

              <button
                type="button"
                onClick={closeLightbox}
                className="p-2 rounded-xl bg-rose-500/20 hover:bg-rose-500/40 text-rose-200 border border-rose-500/40 transition-colors cursor-pointer flex items-center gap-1 text-xs font-bold"
                title="إغلاق (Escape)"
              >
                <X className="w-4 h-4" />
                <span className="hidden sm:inline">إغلاق</span>
              </button>
            </div>
          </div>

          {/* Lightbox Image Viewport */}
          <div className="relative flex-1 w-full max-w-6xl flex items-center justify-center overflow-auto p-2">
            <img
              src={screenshots[lightboxIndex]?.imageUrl}
              alt={screenshots[lightboxIndex]?.title || 'لقطة شاشة مكبرة'}
              style={{
                transform: `scale(${lightboxZoom})`,
                transition: 'transform 0.2s ease-out',
              }}
              className="max-h-[75vh] sm:max-h-[82vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />

            {/* Prev / Next controls inside Lightbox */}
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={isRtl ? prevLightbox : nextLightbox}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
                  aria-label="السابق"
                >
                  {isRtl ? <ChevronRight className="w-6 h-6" /> : <ChevronLeft className="w-6 h-6" />}
                </button>

                <button
                  type="button"
                  onClick={isRtl ? nextLightbox : prevLightbox}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-11 h-11 rounded-2xl bg-black/60 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all cursor-pointer"
                  aria-label="التالي"
                >
                  {isRtl ? <ChevronLeft className="w-6 h-6" /> : <ChevronRight className="w-6 h-6" />}
                </button>
              </>
            )}
          </div>

          {/* Lightbox Footer */}
          <div className="w-full max-w-6xl pt-2 text-center text-xs text-slate-400 shrink-0">
            <p>{screenshots[lightboxIndex]?.subtitle}</p>
          </div>
        </div>
      )}
    </section>
  )
}
