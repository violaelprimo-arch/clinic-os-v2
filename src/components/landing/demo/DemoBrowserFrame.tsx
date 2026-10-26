'use client'

import React from 'react'
import {
  RotateCcw,
  Maximize2,
  Lock,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  RefreshCw,
  ExternalLink,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/LanguageContext'

interface DemoBrowserFrameProps {
  children: React.ReactNode
  onReset: () => void
  onToggleFullScreen: () => void
  isFullScreen?: boolean
  onStartTour?: () => void
}

export function DemoBrowserFrame({
  children,
  onReset,
  onToggleFullScreen,
  isFullScreen = false,
  onStartTour,
}: DemoBrowserFrameProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  return (
    <div
      className={`relative flex flex-col overflow-hidden border border-border/80 bg-background shadow-2xl transition-all duration-300 ${
        isFullScreen
          ? 'h-full w-full rounded-none'
          : 'rounded-3xl shadow-primary/10 hover:border-primary/40'
      }`}
    >
      {/* Browser Chrome Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/80 bg-muted/60 px-4 py-3 sm:px-6">
        {/* Left: Window Dots & Navigation Controls */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5" aria-hidden="true">
            <span className="size-3 rounded-full bg-rose-500/80 transition-opacity hover:opacity-100" />
            <span className="size-3 rounded-full bg-amber-500/80 transition-opacity hover:opacity-100" />
            <span className="size-3 rounded-full bg-emerald-500/80 transition-opacity hover:opacity-100" />
          </div>

          <div className="hidden items-center gap-1 text-muted-foreground sm:flex">
            <button
              type="button"
              disabled
              aria-label="Previous"
              className="grid size-6 place-items-center rounded-md opacity-40 hover:bg-muted"
            >
              {isRtl ? <ArrowRight className="size-3.5" /> : <ArrowLeft className="size-3.5" />}
            </button>
            <button
              type="button"
              disabled
              aria-label="Next"
              className="grid size-6 place-items-center rounded-md opacity-40 hover:bg-muted"
            >
              {isRtl ? <ArrowLeft className="size-3.5" /> : <ArrowRight className="size-3.5" />}
            </button>
            <button
              type="button"
              onClick={onReset}
              title={copy('إعادة تعيين التجربة', 'Reset Demo')}
              className="grid size-6 place-items-center rounded-md transition-colors hover:bg-muted hover:text-foreground"
            >
              <RefreshCw className="size-3" />
            </button>
          </div>
        </div>

        {/* Center: Fake Address Bar */}
        <div className="order-last flex w-full min-w-0 flex-1 items-center justify-center sm:order-none sm:w-auto sm:max-w-md">
          <div className="flex w-full items-center justify-center gap-2 rounded-xl border border-border/60 bg-background/80 px-3 py-1.5 text-xs text-muted-foreground shadow-inner backdrop-blur-sm">
            <Lock className="size-3 shrink-0 text-emerald-500" />
            <span className="truncate font-mono text-[11px] font-medium tracking-tight">
              https://yallaclinic.com/demo/workspace
            </span>
            <span className="ms-auto hidden shrink-0 items-center gap-1 rounded-md bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-bold text-emerald-600 dark:text-emerald-400 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              {copy('معزول 100%', '100% Isolated')}
            </span>
          </div>
        </div>

        {/* Right: Actions (Tour, Reset, FullScreen) */}
        <div className="flex items-center gap-2">
          {onStartTour && (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={onStartTour}
              className="h-8 gap-1.5 rounded-xl border-primary/30 bg-primary/5 px-2.5 text-xs font-bold text-primary hover:bg-primary/10"
            >
              <Sparkles className="size-3.5" />
              <span className="hidden sm:inline">{copy('ابدأ الجولة الإرشادية', 'Guided Tour')}</span>
              <span className="sm:hidden">{copy('جولة', 'Tour')}</span>
            </Button>
          )}

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onReset}
            className="h-8 gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            title={copy('إعادة البيانات لنقطة البداية', 'Reset demo to initial state')}
          >
            <RotateCcw className="size-3.5" />
            <span className="hidden md:inline">{copy('إعادة التجربة', 'Reset')}</span>
          </Button>

          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onToggleFullScreen}
            className="h-8 gap-1.5 rounded-xl px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
            title={isFullScreen ? copy('تصغير العرض', 'Exit Fullscreen') : copy('فتح العرض بشكل موسّع', 'Expand Fullscreen')}
          >
            <Maximize2 className="size-3.5" />
            <span className="hidden lg:inline">
              {isFullScreen ? copy('تصغير', 'Minimize') : copy('عرض موسّع', 'Expand')}
            </span>
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative flex-1 overflow-x-hidden overflow-y-auto bg-card text-foreground">
        {children}
      </div>
    </div>
  )
}
