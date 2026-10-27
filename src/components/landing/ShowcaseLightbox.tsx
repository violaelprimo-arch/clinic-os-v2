'use client'

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { createPortal } from 'react-dom'
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  Move,
} from 'lucide-react'
import { Button } from '@/components/ui/button'

export interface ShowcaseScreenshot {
  id: string
  imageUrl: string
  title: string
  titleEn?: string
  subtitle?: string
  subtitleEn?: string
  category?: string
  categoryEn?: string
  highlights?: string[]
  highlightsEn?: string[]
  isVisible?: boolean
  altText?: string
  altTextEn?: string
}

interface ShowcaseLightboxProps {
  open: boolean
  onClose: () => void
  screenshots: ShowcaseScreenshot[]
  currentIndex: number
  onNavigate: (index: number) => void
  isRtl: boolean
}

export function ShowcaseLightbox({
  open,
  onClose,
  screenshots,
  currentIndex,
  onNavigate,
  isRtl,
}: ShowcaseLightboxProps) {
  const [scale, setScale] = useState(1)
  const [position, setPosition] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const [mounted, setMounted] = useState(false)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const containerRef = useRef<HTMLDivElement>(null)
  const lastActiveElementRef = useRef<HTMLElement | null>(null)
  const touchStartRef = useRef<{ x: number; y: number; time: number; distance?: number } | null>(null)

  useEffect(() => {
    setMounted(true)
  }, [])

  const currentShot = screenshots[currentIndex]

  // Reset zoom & pan when image changes or opens
  const resetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  useEffect(() => {
    if (open) {
      resetZoom()
      lastActiveElementRef.current = document.activeElement as HTMLElement
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
      lastActiveElementRef.current?.focus?.()
    }
    return () => {
      document.body.style.overflow = ''
    }
  }, [open, resetZoom])

  useEffect(() => {
    resetZoom()
  }, [currentIndex, resetZoom])

  const zoomIn = () => {
    setScale((prev) => Math.min(prev + 0.5, 3.5))
  }

  const zoomOut = () => {
    setScale((prev) => {
      const next = Math.max(prev - 0.5, 1)
      if (next === 1) setPosition({ x: 0, y: 0 })
      return next
    })
  }

  const handleNext = useCallback(() => {
    if (screenshots.length > 0) {
      onNavigate((currentIndex + 1) % screenshots.length)
    }
  }, [currentIndex, screenshots.length, onNavigate])

  const handlePrev = useCallback(() => {
    if (screenshots.length > 0) {
      onNavigate((currentIndex - 1 + screenshots.length) % screenshots.length)
    }
  }, [currentIndex, screenshots.length, onNavigate])

  // Keyboard controls
  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (isRtl) handlePrev()
        else handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (isRtl) handleNext()
        else handlePrev()
      } else if (e.key === '+' || e.key === '=') {
        e.preventDefault()
        zoomIn()
      } else if (e.key === '-' || e.key === '_') {
        e.preventDefault()
        zoomOut()
      } else if (e.key === '0') {
        e.preventDefault()
        resetZoom()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [open, onClose, isRtl, handleNext, handlePrev, resetZoom])

  // Pan boundary clamping
  const updatePosition = (newX: number, newY: number, currentScale: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const maxOffsetX = Math.max(0, (rect.width * currentScale - rect.width) / 2)
    const maxOffsetY = Math.max(0, (rect.height * currentScale - rect.height) / 2)

    setPosition({
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
    })
  }

  // Mouse pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) {
      dragStartRef.current = { x: e.clientX, y: e.clientY, posX: 0, posY: 0 }
      setIsDragging(true)
      return
    }
    e.preventDefault()
    setIsDragging(true)
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y

    if (scale > 1) {
      updatePosition(dragStartRef.current.posX + deltaX, dragStartRef.current.posY + deltaY, scale)
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return
    setIsDragging(false)

    // If at scale 1, detect horizontal swipe gesture
    if (scale <= 1) {
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y
      if (Math.abs(deltaX) > 50 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          handleNext()
        } else {
          handlePrev()
        }
      }
    }
  }

  // Touch handlers (pan + pinch-to-zoom + swipe)
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      touchStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        time: Date.now(),
      }
      dragStartRef.current = {
        x: touch.clientX,
        y: touch.clientY,
        posX: position.x,
        posY: position.y,
      }
      setIsDragging(true)
    } else if (e.touches.length === 2) {
      // Pinch to zoom start
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const distance = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      touchStartRef.current = {
        x: (t1.clientX + t2.clientX) / 2,
        y: (t1.clientY + t2.clientY) / 2,
        time: Date.now(),
        distance,
      }
      setIsDragging(true)
    }
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!isDragging) return
    if (e.touches.length === 1 && scale > 1) {
      const touch = e.touches[0]
      const deltaX = touch.clientX - dragStartRef.current.x
      const deltaY = touch.clientY - dragStartRef.current.y
      updatePosition(dragStartRef.current.posX + deltaX, dragStartRef.current.posY + deltaY, scale)
    } else if (e.touches.length === 2 && touchStartRef.current?.distance) {
      // Pinch to zoom move
      const t1 = e.touches[0]
      const t2 = e.touches[1]
      const currentDist = Math.hypot(t2.clientX - t1.clientX, t2.clientY - t1.clientY)
      const ratio = currentDist / touchStartRef.current.distance
      const newScale = Math.max(1, Math.min(3.5, scale * ratio))
      setScale(newScale)
      touchStartRef.current.distance = currentDist
    }
  }

  const handleTouchEnd = (e: React.TouchEvent) => {
    setIsDragging(false)
    if (scale <= 1 && touchStartRef.current && e.changedTouches.length > 0) {
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y
      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY)) {
        if (deltaX < 0) {
          handleNext()
        } else {
          handlePrev()
        }
      }
    }
    touchStartRef.current = null
  }

  // Double click toggles between 1x and 2x zoom
  const handleDoubleClick = () => {
    if (scale > 1) {
      resetZoom()
    } else {
      setScale(2)
    }
  }

  if (!open || !currentShot || !mounted || typeof document === 'undefined') return null

  const title = !isRtl && currentShot.titleEn ? currentShot.titleEn : currentShot.title
  const subtitle = !isRtl && currentShot.subtitleEn ? currentShot.subtitleEn : currentShot.subtitle

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isRtl ? 'معاينة الصورة المكبرة' : 'Enlarged Image Preview'}
      className="fixed inset-0 z-[9999] h-screen w-screen flex flex-col justify-between bg-black/95 backdrop-blur-md select-none text-white overflow-hidden animate-in fade-in duration-200"
      style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, width: '100vw', height: '100vh', margin: 0, padding: 0 }}
    >
      {/* Top Bar with Controls */}
      <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6 bg-black/60 backdrop-blur-md z-30">
        <div className="flex items-center gap-3">
          <span className="font-mono text-sm text-primary font-bold">
            {String(currentIndex + 1).padStart(2, '0')} / {String(screenshots.length).padStart(2, '0')}
          </span>
          <span className="hidden sm:inline-block max-w-[280px] md:max-w-md truncate text-sm font-semibold text-white/90">
            {title}
          </span>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1 sm:gap-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 1}
            className="text-white/80 hover:text-white hover:bg-white/10 size-9 disabled:opacity-30 cursor-pointer"
            title={isRtl ? 'تصغير (-)' : 'Zoom Out (-)'}
            aria-label={isRtl ? 'تصغير' : 'Zoom Out'}
          >
            <ZoomOut className="size-4" />
          </Button>

          <span className="min-w-[48px] text-center font-mono text-xs text-white/70">
            {Math.round(scale * 100)}%
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 3.5}
            className="text-white/80 hover:text-white hover:bg-white/10 size-9 disabled:opacity-30 cursor-pointer"
            title={isRtl ? 'تكبير (+)' : 'Zoom In (+)'}
            aria-label={isRtl ? 'تكبير' : 'Zoom In'}
          >
            <ZoomIn className="size-4" />
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={resetZoom}
            disabled={scale === 1 && position.x === 0 && position.y === 0}
            className="text-white/80 hover:text-white hover:bg-white/10 size-9 disabled:opacity-30 cursor-pointer"
            title={isRtl ? 'إعادة ضبط الحجم (0)' : 'Reset Zoom (0)'}
            aria-label={isRtl ? 'إعادة ضبط الحجم' : 'Reset Zoom'}
          >
            <RotateCcw className="size-4" />
          </Button>

          <div className="mx-1 h-5 w-px bg-white/20" />

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white/80 hover:text-white hover:bg-white/15 size-9 rounded-xl cursor-pointer"
            title={isRtl ? 'إغلاق (Esc)' : 'Close (Esc)'}
            aria-label={isRtl ? 'إغلاق' : 'Close'}
          >
            <X className="size-5" />
          </Button>
        </div>
      </header>

      {/* Main Image Viewport (Centered) */}
      <div
        ref={containerRef}
        className={`relative flex-1 w-full h-full min-h-0 overflow-hidden flex items-center justify-center p-3 sm:p-6 ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
        onClick={(e) => {
          if (e.target === containerRef.current) {
            onClose()
          }
        }}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDoubleClick={handleDoubleClick}
      >
        {/* Next / Prev Navigation overlay buttons */}
        {screenshots.length > 1 && (
          <>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handlePrev()
              }}
              className="absolute start-3 sm:start-6 top-1/2 -translate-y-1/2 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white/90 hover:bg-black/90 hover:text-white backdrop-blur-sm border border-white/15 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              aria-label={isRtl ? 'الصورة السابقة' : 'Previous Image'}
            >
              {isRtl ? <ChevronRight className="size-6" /> : <ChevronLeft className="size-6" />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation()
                handleNext()
              }}
              className="absolute end-3 sm:end-6 top-1/2 -translate-y-1/2 z-20 flex size-11 items-center justify-center rounded-full bg-black/60 text-white/90 hover:bg-black/90 hover:text-white backdrop-blur-sm border border-white/15 transition-all shadow-lg hover:scale-105 active:scale-95 cursor-pointer"
              aria-label={isRtl ? 'الصورة التالية' : 'Next Image'}
            >
              {isRtl ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
            </button>
          </>
        )}

        {/* Scaled & Panned Image (Strictly Centered horizontally and vertically) */}
        <div
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
          }}
          className="will-change-transform max-w-full max-h-full flex items-center justify-center m-auto"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={currentShot.imageUrl}
            alt={(!isRtl && currentShot.altTextEn ? currentShot.altTextEn : currentShot.altText) || title}
            draggable={false}
            className="max-h-[calc(100vh-140px)] max-w-[calc(100vw-24px)] sm:max-w-[calc(100vw-100px)] w-auto h-auto object-contain rounded-xl shadow-2xl pointer-events-none select-none border border-white/10 mx-auto"
          />
        </div>

        {/* Pan hint when zoomed */}
        {scale > 1 && (
          <div className="absolute bottom-6 start-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/75 px-3 py-1.5 text-xs text-white/80 backdrop-blur-sm border border-white/10 pointer-events-none">
            <Move className="size-3.5 text-primary" />
            <span>{isRtl ? 'اسحب للتحريك في جميع الاتجاهات' : 'Drag to pan around'}</span>
          </div>
        )}
      </div>

      {/* Footer Info & Caption */}
      <footer className="shrink-0 border-t border-white/10 bg-black/60 px-4 py-3 text-center sm:px-6 backdrop-blur-sm z-30">
        <h3 className="text-sm font-bold text-white/95">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-xs text-white/60 line-clamp-1">{subtitle}</p>
        )}
      </footer>
    </div>,
    document.body
  )
}
