'use client'

import React, { useEffect } from 'react'
import { Minimize2, X, Lock, Sparkles, RotateCcw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/LanguageContext'

interface DemoFullScreenModalProps {
  isOpen: boolean
  onClose: () => void
  onReset: () => void
  onStartTour: () => void
  children: React.ReactNode
}

export function DemoFullScreenModal({
  isOpen,
  onClose,
  onReset,
  onStartTour,
  children,
}: DemoFullScreenModalProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      }
    }

    document.body.style.overflow = 'hidden'
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      document.body.style.overflow = ''
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={copy('العرض الموسّع للمنصة', 'Expanded Product Demo')}
      className="fixed inset-0 z-50 flex flex-col bg-background/95 backdrop-blur-md animate-in fade-in duration-200"
    >
      {/* Top Modal Controls Bar */}
      <div className="flex items-center justify-between border-b border-border bg-card px-4 py-2.5 sm:px-6">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-3 rounded-full bg-rose-500/80" />
            <span className="size-3 rounded-full bg-amber-500/80" />
            <span className="size-3 rounded-full bg-emerald-500/80" />
          </div>
          <strong className="text-xs sm:text-sm font-black text-foreground">
            {copy('العرض الموسّع — تجربة يلا كلينيك التفاعلية', 'Expanded View — Yalla Clinic Live Demo')}
          </strong>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={onStartTour}
            className="h-8 gap-1.5 rounded-xl border-primary/30 bg-primary/5 text-xs font-bold text-primary"
          >
            <Sparkles className="size-3.5" />
            <span className="hidden sm:inline">{copy('ابدأ الجولة الإرشادية', 'Guided Tour')}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="h-8 gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden sm:inline">{copy('إعادة التجربة', 'Reset')}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onClose}
            className="h-8 gap-1.5 rounded-xl text-xs text-muted-foreground hover:text-foreground"
            title={copy('إنهاء العرض الموسّع (Esc)', 'Exit Fullscreen (Esc)')}
          >
            <Minimize2 className="size-3.5" />
            <span className="hidden sm:inline">{copy('تصغير', 'Minimize')}</span>
          </Button>

          <button
            type="button"
            onClick={onClose}
            className="grid size-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
            aria-label={copy('إغلاق', 'Close')}
          >
            <X className="size-4" />
          </button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 overflow-y-auto bg-muted/10 p-2 sm:p-4">
        <div className="mx-auto max-w-7xl h-full">{children}</div>
      </div>
    </div>
  )
}
