'use client'

import React, { useRef, useEffect, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, type LucideIcon } from 'lucide-react'

export interface CmsTabDefinition {
  id: string
  labelAr: string
  labelEn: string
  Icon: LucideIcon
}

interface LandingPageTabsBarProps {
  tabs: readonly (readonly [string, string, LucideIcon])[]
  activeTab: string
  onTabChange: (id: string) => void
  newInquiriesCount?: number
  newTrialsCount?: number
  pendingFeedbackCount?: number
  isRtl?: boolean
}

// English translations dictionary for bilingual support
const tabLabelsEn: Record<string, string> = {
  order: 'Sections Order & Visibility',
  theme: 'Appearance & 3D Motion',
  hero: 'Hero Section',
  orbit: 'Interactive 3D Orbit',
  gallery: 'System Gallery',
  features: 'Platform Features',
  steps: 'How It Works',
  pricing: 'Pricing & Plans',
  faq: 'FAQ',
  inbox: 'Inquiries & Complaints',
  testimonials: 'Reviews & Feedback',
  stats: 'Stats & Numbers',
  contacts: 'Contact & Footer',
  trials: 'Trial Requests',
}

export function LandingPageTabsBar({
  tabs,
  activeTab,
  onTabChange,
  newInquiriesCount = 0,
  newTrialsCount = 0,
  pendingFeedbackCount = 0,
  isRtl = true,
}: LandingPageTabsBarProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const tabRefs = useRef<Map<string, HTMLButtonElement>>(new Map())

  const [canScrollLeft, setCanScrollLeft] = useState(false)
  const [canScrollRight, setCanScrollRight] = useState(false)
  const [hasOverflow, setHasOverflow] = useState(false)
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false)

  // Detect user prefers-reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    setPrefersReducedMotion(mediaQuery.matches)

    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches)
    mediaQuery.addEventListener('change', handler)
    return () => mediaQuery.removeEventListener('change', handler)
  }, [])

  // Check scroll boundaries accurately for both RTL and LTR
  const updateScrollState = useCallback(() => {
    const el = containerRef.current
    if (!el) return

    const { scrollLeft, scrollWidth, clientWidth } = el
    const maxScroll = Math.max(0, scrollWidth - clientWidth)

    if (maxScroll <= 3) {
      setHasOverflow(false)
      setCanScrollLeft(false)
      setCanScrollRight(false)
      return
    }

    setHasOverflow(true)
    const threshold = 4

    if (isRtl) {
      // In RTL modern browsers (Chromium, Firefox, Safari):
      // scrollLeft is 0 at the rightmost (start).
      // scrollLeft becomes negative (down to -maxScroll) as you scroll left.
      // In some older WebKit engines, scrollLeft may be positive (maxScroll down to 0).
      let offsetFromRight = 0
      if (scrollLeft <= 0) {
        offsetFromRight = Math.abs(scrollLeft)
      } else {
        offsetFromRight = maxScroll - scrollLeft
      }

      // Can scroll left (further down the list) if we haven't reached maxScroll yet
      const canLeft = offsetFromRight < (maxScroll - threshold)
      // Can scroll right (back to the beginning) if we have scrolled left
      const canRight = offsetFromRight > threshold

      setCanScrollLeft(canLeft)
      setCanScrollRight(canRight)
    } else {
      // In LTR:
      // scrollLeft is 0 at the leftmost (start).
      // scrollLeft increases up to maxScroll as you scroll right.
      const canLeft = scrollLeft > threshold
      const canRight = scrollLeft < (maxScroll - threshold)

      setCanScrollLeft(canLeft)
      setCanScrollRight(canRight)
    }
  }, [isRtl])

  // Scroll container by delta
  const handleScrollBy = useCallback(
    (direction: 'left' | 'right') => {
      const el = containerRef.current
      if (!el) return

      const delta = Math.round(el.clientWidth * 0.6)
      const scrollAmount = direction === 'left' ? -delta : delta
      const behavior = prefersReducedMotion ? 'auto' : 'smooth'

      el.scrollBy({ left: scrollAmount, behavior })
    },
    [prefersReducedMotion]
  )

  // Scroll active tab cleanly into container view without ANY vertical jump
  const scrollActiveTabIntoView = useCallback(
    (tabId: string, smooth = true) => {
      const container = containerRef.current
      const tabEl = tabRefs.current.get(tabId)
      if (!container || !tabEl) return

      const containerRect = container.getBoundingClientRect()
      const tabRect = tabEl.getBoundingClientRect()
      const margin = 20 // safe visible margin in px

      const behavior = !smooth || prefersReducedMotion ? 'auto' : 'smooth'

      if (tabRect.left < containerRect.left + margin) {
        const diff = containerRect.left + margin - tabRect.left
        container.scrollBy({ left: -diff, behavior })
      } else if (tabRect.right > containerRect.right - margin) {
        const diff = tabRect.right - (containerRect.right - margin)
        container.scrollBy({ left: diff, behavior })
      }
    },
    [prefersReducedMotion]
  )

  // Scroll active tab on mount and whenever activeTab or isRtl changes
  useEffect(() => {
    const timer = setTimeout(() => {
      updateScrollState()
      scrollActiveTabIntoView(activeTab, false)
    }, 50)
    return () => clearTimeout(timer)
  }, [activeTab, isRtl, updateScrollState, scrollActiveTabIntoView])

  // ResizeObserver & window resize to keep scroll state responsive
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    updateScrollState()

    const ro = new ResizeObserver(() => {
      updateScrollState()
      scrollActiveTabIntoView(activeTab, false)
    })
    ro.observe(el)

    const handleResize = () => {
      updateScrollState()
    }
    window.addEventListener('resize', handleResize)
    window.addEventListener('orientationchange', handleResize)

    return () => {
      ro.disconnect()
      window.removeEventListener('resize', handleResize)
      window.removeEventListener('orientationchange', handleResize)
    }
  }, [updateScrollState, scrollActiveTabIntoView, activeTab])

  // Keyboard navigation for tablist (W3C ARIA Tab pattern)
  const handleKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, currentIndex: number) => {
    let targetIndex = -1

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      // In RTL: ArrowRight moves towards the previous tab (to the right)
      targetIndex = isRtl
        ? (currentIndex - 1 + tabs.length) % tabs.length
        : (currentIndex + 1) % tabs.length
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      // In RTL: ArrowLeft moves towards the next tab (to the left)
      targetIndex = isRtl
        ? (currentIndex + 1) % tabs.length
        : (currentIndex - 1 + tabs.length) % tabs.length
    } else if (e.key === 'Home') {
      e.preventDefault()
      targetIndex = 0
    } else if (e.key === 'End') {
      e.preventDefault()
      targetIndex = tabs.length - 1
    }

    if (targetIndex >= 0 && targetIndex < tabs.length) {
      const nextTabId = tabs[targetIndex][0]
      onTabChange(nextTabId)
      const nextTabBtn = tabRefs.current.get(nextTabId)
      nextTabBtn?.focus()
      scrollActiveTabIntoView(nextTabId, true)
    }
  }

  return (
    <div
      className="relative w-full min-w-0 max-w-full my-1 group/tabs"
      dir={isRtl ? 'rtl' : 'ltr'}
    >
      {/* Edge Fade Overlay: Start */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute start-0 top-0 bottom-0 w-8 z-10 rounded-s-2xl ${
          isRtl ? 'bg-gradient-to-l' : 'bg-gradient-to-r'
        } from-white dark:from-[#081526] to-transparent transition-opacity duration-200 ${
          (isRtl ? canScrollRight : canScrollLeft) ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Edge Fade Overlay: End */}
      <div
        aria-hidden="true"
        className={`pointer-events-none absolute end-0 top-0 bottom-0 w-8 z-10 rounded-e-2xl ${
          isRtl ? 'bg-gradient-to-r' : 'bg-gradient-to-l'
        } from-white dark:from-[#081526] to-transparent transition-opacity duration-200 ${
          (isRtl ? canScrollLeft : canScrollRight) ? 'opacity-100' : 'opacity-0'
        }`}
      />

      {/* Scroll Arrow Button: Left */}
      {hasOverflow && (
        <button
          type="button"
          onClick={() => handleScrollBy('left')}
          disabled={!canScrollLeft}
          aria-label={isRtl ? 'تمرير التبويبات لليسار' : 'Scroll tabs left'}
          title={isRtl ? 'تمرير لليسار' : 'Scroll left'}
          className={`absolute start-1.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center border shadow-md transition-all duration-200 cursor-pointer ${
            canScrollLeft
              ? 'bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 border-sky-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-700 hover:scale-105 active:scale-95'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
      )}

      {/* Scroll Arrow Button: Right */}
      {hasOverflow && (
        <button
          type="button"
          onClick={() => handleScrollBy('right')}
          disabled={!canScrollRight}
          aria-label={isRtl ? 'تمرير التبويبات لليمين' : 'Scroll tabs right'}
          title={isRtl ? 'تمرير لليمين' : 'Scroll right'}
          className={`absolute end-1.5 top-1/2 -translate-y-1/2 z-20 w-8 h-8 rounded-full flex items-center justify-center border shadow-md transition-all duration-200 cursor-pointer ${
            canScrollRight
              ? 'bg-white/95 dark:bg-slate-800/95 text-slate-700 dark:text-slate-200 border-sky-200 dark:border-slate-700 hover:bg-sky-50 dark:hover:bg-slate-700 hover:scale-105 active:scale-95'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      )}

      {/* Main Tablist Scroll Container */}
      <div
        ref={containerRef}
        onScroll={updateScrollState}
        role="tablist"
        aria-orientation="horizontal"
        aria-label={isRtl ? 'أقسام إعدادات الواجهة الرئيسية' : 'Landing Page Settings Sections'}
        className="w-full min-w-0 max-w-full overflow-x-auto touch-pan-x bg-white dark:bg-[#081526] p-2 rounded-2xl border border-sky-100 dark:border-slate-800 shadow-sm flex items-center gap-1.5 sm:gap-2 scrollbar-thin [scrollbar-width:thin] [&::-webkit-scrollbar]:h-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-slate-200 dark:[&::-webkit-scrollbar-thumb]:bg-slate-800 [&::-webkit-scrollbar-thumb]:rounded-full"
        style={{
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {tabs.map(([id, labelAr, Icon], index) => {
          const active = activeTab === id
          const badgeCount =
            id === 'inbox'
              ? newInquiriesCount
              : id === 'trials'
              ? newTrialsCount
              : id === 'testimonials'
              ? pendingFeedbackCount
              : 0
          const displayLabel = isRtl ? labelAr : (tabLabelsEn[id] || labelAr)

          return (
            <button
              key={id}
              ref={(el) => {
                if (el) {
                  tabRefs.current.set(id, el)
                } else {
                  tabRefs.current.delete(id)
                }
              }}
              type="button"
              role="tab"
              id={`landing-tab-${id}`}
              aria-selected={active}
              aria-controls={`landing-panel-${id}`}
              tabIndex={active ? 0 : -1}
              onClick={() => {
                onTabChange(id)
                scrollActiveTabIntoView(id, true)
              }}
              onKeyDown={(e) => handleKeyDown(e, index)}
              className={`shrink-0 min-h-[44px] py-2.5 px-3.5 sm:px-4 rounded-xl text-xs sm:text-[13px] font-bold flex items-center gap-2 transition-all cursor-pointer select-none whitespace-nowrap focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-[#081526] ${
                active
                  ? 'bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 font-black shadow-xs border border-sky-300 dark:border-sky-700 ring-1 ring-sky-300/40 dark:ring-sky-700/40'
                  : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800/50 border border-transparent'
              }`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform ${active ? 'scale-110' : ''}`} />
              <span className="leading-none">{displayLabel}</span>
              {badgeCount > 0 && (
                <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-full bg-rose-500 text-white text-[10px] font-mono font-bold leading-none shadow-xs shrink-0">
                  {badgeCount}
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
