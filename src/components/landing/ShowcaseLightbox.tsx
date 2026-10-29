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
  AlertCircle,
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
  const [imageLoading, setImageLoading] = useState(true)
  const [imageError, setImageError] = useState(false)

  const dialogRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const imageWrapperRef = useRef<HTMLDivElement>(null)
  const triggerElementRef = useRef<HTMLElement | null>(null)
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 })
  const hasDraggedRef = useRef(false)
  const touchStartRef = useRef<{ x: number; y: number; time: number; distance?: number } | null>(null)

  // Ensure client-side mounting for Portal
  useEffect(() => {
    setMounted(true)
  }, [])

  const currentShot = screenshots[currentIndex]

  // Reset zoom & pan when image changes or modal opens
  const resetZoom = useCallback(() => {
    setScale(1)
    setPosition({ x: 0, y: 0 })
  }, [])

  // Reset state on image change
  useEffect(() => {
    if (open) {
      setImageLoading(true)
      setImageError(false)
      resetZoom()
    }
  }, [currentIndex, open, resetZoom])

  // Scroll lock with zero layout jump + remember trigger focus
  useEffect(() => {
    if (!open) return

    // Save active trigger element to return focus after close
    triggerElementRef.current = document.activeElement as HTMLElement

    // Save exact scroll position
    const scrollY = window.scrollY
    const originalOverflow = document.body.style.overflow
    const originalPosition = document.body.style.position
    const originalTop = document.body.style.top
    const originalWidth = document.body.style.width

    // Apply strict viewport scroll-lock without layout shift
    document.body.style.overflow = 'hidden'
    document.body.style.position = 'fixed'
    document.body.style.top = `-${scrollY}px`
    document.body.style.width = '100%'

    return () => {
      // Restore styles
      document.body.style.overflow = originalOverflow
      document.body.style.position = originalPosition
      document.body.style.top = originalTop
      document.body.style.width = originalWidth

      // Restore exact scroll position
      window.scrollTo(0, scrollY)

      // Restore focus to initiating element
      triggerElementRef.current?.focus?.()
    }
  }, [open])

  // Focus trap inside lightbox modal
  useEffect(() => {
    if (!open) return

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab' || !dialogRef.current) return

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )
      if (!focusable || focusable.length === 0) return

      const firstEl = focusable[0]
      const lastEl = focusable[focusable.length - 1]

      if (e.shiftKey) {
        if (document.activeElement === firstEl) {
          e.preventDefault()
          lastEl.focus()
        }
      } else {
        if (document.activeElement === lastEl) {
          e.preventDefault()
          firstEl.focus()
        }
      }
    }

    window.addEventListener('keydown', handleTabKey)
    return () => window.removeEventListener('keydown', handleTabKey)
  }, [open])

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

  // Clamping pan position within boundaries
  const updatePosition = useCallback((newX: number, newY: number, currentScale: number) => {
    if (!containerRef.current) return
    const rect = containerRef.current.getBoundingClientRect()
    const maxOffsetX = Math.max(0, (rect.width * currentScale - rect.width) / 2)
    const maxOffsetY = Math.max(0, (rect.height * currentScale - rect.height) / 2)

    setPosition({
      x: Math.max(-maxOffsetX, Math.min(maxOffsetX, newX)),
      y: Math.max(-maxOffsetY, Math.min(maxOffsetY, newY)),
    })
  }, [])

  // Recalculate and re-clamp on resize or orientation change
  useEffect(() => {
    const handleResize = () => {
      if (scale > 1) {
        updatePosition(position.x, position.y, scale)
      }
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)
    return () => {
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [scale, position, updatePosition])

  // Mouse pan handlers with strict distinction between drag and click
  const handleMouseDown = (e: React.MouseEvent) => {
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    }
    hasDraggedRef.current = false
    setIsDragging(true)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return
    const deltaX = e.clientX - dragStartRef.current.x
    const deltaY = e.clientY - dragStartRef.current.y
    const dist = Math.hypot(deltaX, deltaY)

    if (dist > 6) {
      hasDraggedRef.current = true
    }

    if (scale > 1) {
      updatePosition(dragStartRef.current.posX + deltaX, dragStartRef.current.posY + deltaY, scale)
    }
  }

  const handleMouseUp = (e: React.MouseEvent) => {
    if (!isDragging) return
    setIsDragging(false)

    // Swipe at 1x scale
    if (scale <= 1 && hasDraggedRef.current) {
      const deltaX = e.clientX - dragStartRef.current.x
      const deltaY = e.clientY - dragStartRef.current.y
      if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
        if (deltaX < 0) {
          if (isRtl) handlePrev()
          else handleNext()
        } else {
          if (isRtl) handleNext()
          else handlePrev()
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
      hasDraggedRef.current = false
      setIsDragging(true)
    } else if (e.touches.length === 2) {
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
    if (e.touches.length === 1) {
      const touch = e.touches[0]
      const deltaX = touch.clientX - dragStartRef.current.x
      const deltaY = touch.clientY - dragStartRef.current.y
      const dist = Math.hypot(deltaX, deltaY)

      if (dist > 6) {
        hasDraggedRef.current = true
      }

      if (scale > 1) {
        updatePosition(dragStartRef.current.posX + deltaX, dragStartRef.current.posY + deltaY, scale)
      }
    } else if (e.touches.length === 2 && touchStartRef.current?.distance) {
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
    if (scale <= 1 && touchStartRef.current && e.changedTouches.length > 0 && hasDraggedRef.current) {
      const touch = e.changedTouches[0]
      const deltaX = touch.clientX - touchStartRef.current.x
      const deltaY = touch.clientY - touchStartRef.current.y
      const elapsed = Date.now() - touchStartRef.current.time

      if (Math.abs(deltaX) > 40 && Math.abs(deltaX) > Math.abs(deltaY) * 1.5 && elapsed < 600) {
        if (deltaX < 0) {
          if (isRtl) handlePrev()
          else handleNext()
        } else {
          if (isRtl) handleNext()
          else handlePrev()
        }
      }
    }
    touchStartRef.current = null
  }

  // Double click toggles between 1x and 2x zoom
  const handleDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    if (scale > 1) {
      resetZoom()
    } else {
      setScale(2)
    }
  }

  // Handle backdrop click to close (strictly when not dragging and clicked outside content)
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (hasDraggedRef.current) return
    if (e.target === containerRef.current) {
      onClose()
    }
  }

  if (!open || !currentShot || !mounted || typeof document === 'undefined') return null

  const title = !isRtl && currentShot.titleEn ? currentShot.titleEn : currentShot.title
  const subtitle = !isRtl && currentShot.subtitleEn ? currentShot.subtitleEn : currentShot.subtitle
  const category = !isRtl && currentShot.categoryEn ? currentShot.categoryEn : currentShot.category

  return createPortal(
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      aria-label={isRtl ? 'معاينة الصورة المكبرة' : 'Enlarged Image Preview'}
      tabIndex={-1}
      className="fixed inset-0 z-[99999] h-screen h-[100dvh] w-screen w-[100dvw] flex flex-col justify-between bg-black/95 backdrop-blur-md select-none text-white overflow-hidden animate-in fade-in duration-200"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        width: '100%',
        height: '100dvh',
        margin: 0,
        padding: 0,
        overscrollBehavior: 'contain',
      }}
    >
      {/* 1. Top Bar with Title, Counter & Action Controls */}
      <header className="flex h-14 sm:h-16 shrink-0 items-center justify-between border-b border-white/10 px-4 sm:px-6 bg-black/75 backdrop-blur-md z-30">
        <div className="flex items-center gap-3 min-w-0">
          {/* Published Screenshots Counter */}
          <span className="font-mono text-xs sm:text-sm text-primary font-black px-2.5 py-1 rounded-lg bg-white/10 border border-white/15 shrink-0" dir="ltr">
            {String(currentIndex + 1).padStart(2, '0')} / {String(screenshots.length).padStart(2, '0')}
          </span>

          <div className="min-w-0 flex items-center gap-2">
            {category && (
              <span className="hidden md:inline-block text-[11px] font-bold px-2 py-0.5 rounded bg-white/10 text-white/80 shrink-0">
                {category}
              </span>
            )}
            <span className="hidden sm:inline-block truncate text-xs sm:text-sm font-bold text-white/95 max-w-[140px] md:max-w-xs">
              {title}
            </span>
          </div>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={zoomOut}
            disabled={scale <= 1}
            className="text-white/80 hover:text-white hover:bg-white/10 size-8 sm:size-9 rounded-xl disabled:opacity-30 cursor-pointer"
            title={isRtl ? 'تصغير (-)' : 'Zoom Out (-)'}
            aria-label={isRtl ? 'تصغير' : 'Zoom Out'}
          >
            <ZoomOut className="size-4" />
          </Button>

          <span className="min-w-[44px] text-center font-mono text-xs text-white/80 font-bold select-none">
            {Math.round(scale * 100)}%
          </span>

          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={zoomIn}
            disabled={scale >= 3.5}
            className="text-white/80 hover:text-white hover:bg-white/10 size-8 sm:size-9 rounded-xl disabled:opacity-30 cursor-pointer"
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
            className="text-white/80 hover:text-white hover:bg-white/10 size-8 sm:size-9 rounded-xl disabled:opacity-30 cursor-pointer"
            title={isRtl ? 'إعادة ضبط الحجم (0)' : 'Reset Zoom (0)'}
            aria-label={isRtl ? 'إعادة ضبط الحجم' : 'Reset Zoom'}
          >
            <RotateCcw className="size-4" />
          </Button>

          <div className="mx-1 h-5 w-px bg-white/20" />

          {/* Dedicated Close Button */}
          <Button
            type="button"
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="text-white hover:text-white bg-white/10 hover:bg-white/20 size-8 sm:size-9 rounded-xl border border-white/20 cursor-pointer shadow-md transition-all active:scale-95"
            title={isRtl ? 'إغلاق (Esc)' : 'Close (Esc)'}
            aria-label={isRtl ? 'إغلاق' : 'Close'}
          >
            <X className="size-5" />
          </Button>
        </div>
      </header>

      {/* 2. Main Viewport Area (Strictly Centered horizontally and vertically) */}
      <div
        ref={containerRef}
        onClick={handleBackdropClick}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        className={`relative flex-1 w-full min-h-0 overflow-hidden flex items-center justify-center p-3 sm:p-5 md:p-6 ${
          scale > 1 ? (isDragging ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-default'
        }`}
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
              className="absolute start-3 sm:start-6 top-1/2 -translate-y-1/2 z-20 flex size-10 sm:size-12 items-center justify-center rounded-full bg-black/70 text-white/90 hover:bg-black/95 hover:text-white backdrop-blur-md border border-white/20 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
              title={isRtl ? 'الصورة السابقة (سهم يمين)' : 'Previous Image (Left arrow)'}
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
              className="absolute end-3 sm:end-6 top-1/2 -translate-y-1/2 z-20 flex size-10 sm:size-12 items-center justify-center rounded-full bg-black/70 text-white/90 hover:bg-black/95 hover:text-white backdrop-blur-md border border-white/20 transition-all shadow-xl hover:scale-105 active:scale-95 cursor-pointer"
              title={isRtl ? 'الصورة التالية (سهم يسار)' : 'Next Image (Right arrow)'}
              aria-label={isRtl ? 'الصورة التالية' : 'Next Image'}
            >
              {isRtl ? <ChevronLeft className="size-6" /> : <ChevronRight className="size-6" />}
            </button>
          </>
        )}

        {/* Scaled & Panned Image Wrapper */}
        <div
          ref={imageWrapperRef}
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.2s cubic-bezier(0.2, 0, 0, 1)',
          }}
          onDoubleClick={handleDoubleClick}
          onClick={(e) => e.stopPropagation()} // Clicking the image does NOT close the modal!
          className="will-change-transform max-w-full max-h-full flex items-center justify-center m-auto relative"
        >
          {/* Loading Spinner */}
          {imageLoading && !imageError && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-white/80 min-h-[220px]">
              <div className="w-10 h-10 rounded-full border-3 border-primary border-t-transparent animate-spin" />
              <span className="text-xs font-bold tracking-wide">
                {isRtl ? 'جاري تحميل الصورة...' : 'Loading image...'}
              </span>
            </div>
          )}

          {/* Error Message if image fails */}
          {imageError ? (
            <div className="p-8 rounded-3xl bg-secondary/40 border border-white/10 text-center space-y-3 max-w-sm m-auto">
              <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
              <p className="text-sm font-bold text-white">
                {isRtl ? 'تعذر تحميل هذه الصورة' : 'Failed to load this image'}
              </p>
              <p className="text-xs text-white/60">
                {isRtl ? 'يرجى مراجعة رابط الصورة في لوحة تحكم المالك.' : 'Please check the image URL in the owner panel.'}
              </p>
            </div>
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              key={currentShot.imageUrl}
              src={currentShot.imageUrl}
              alt={(!isRtl && currentShot.altTextEn ? currentShot.altTextEn : currentShot.altText) || title}
              draggable={false}
              onLoad={() => setImageLoading(false)}
              onError={() => {
                setImageLoading(false)
                setImageError(true)
              }}
              style={{
                maxHeight: 'calc(100dvh - 140px)',
                maxWidth: 'calc(100dvw - 24px)',
              }}
              className={`w-auto h-auto object-contain rounded-2xl shadow-2xl pointer-events-none select-none border border-white/15 mx-auto transition-opacity duration-200 ${
                imageLoading ? 'opacity-0' : 'opacity-100'
              }`}
            />
          )}
        </div>

        {/* Pan hint when zoomed */}
        {scale > 1 && (
          <div className="absolute bottom-4 start-1/2 -translate-x-1/2 z-20 flex items-center gap-1.5 rounded-full bg-black/85 px-3 py-1.5 text-xs text-white/90 backdrop-blur-md border border-white/15 pointer-events-none shadow-lg">
            <Move className="size-3.5 text-primary" />
            <span>{isRtl ? 'اسحب للتحريك في جميع الاتجاهات' : 'Drag to pan around'}</span>
          </div>
        )}
      </div>

      {/* 3. Footer Info & Caption */}
      <footer className="shrink-0 min-h-[48px] border-t border-white/10 bg-black/75 px-4 py-2.5 text-center sm:px-6 backdrop-blur-md z-30">
        <h3 className="text-xs sm:text-sm font-bold text-white/95 truncate">{title}</h3>
        {subtitle && (
          <p className="mt-0.5 text-[11px] sm:text-xs text-white/65 line-clamp-1">{subtitle}</p>
        )}
      </footer>
    </div>,
    document.body
  )
}
