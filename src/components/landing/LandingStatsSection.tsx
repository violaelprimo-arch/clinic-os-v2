'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  TrendingUp,
  Building2,
  ShieldCheck,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  Award,
  Activity,
  Database,
} from 'lucide-react'
import { type StatItem } from '@/lib/landing-config'
import { useLanguage } from '@/context/LanguageContext'

interface LandingStatsSectionProps {
  stats: StatItem[]
}

const iconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  TrendingUp,
  Building2,
  ShieldCheck,
  Clock,
  Users,
  CheckCircle2,
  Calendar,
  Sparkles,
  Award,
  Activity,
  Database,
}

function StatCard({ stat, index = 0 }: { stat: StatItem; index?: number }) {
  const { isRtl } = useLanguage()

  // Exact manual value from owner settings: handles 0, decimals, commas, large numbers
  const rawValue =
    stat.value !== undefined && stat.value !== null && String(stat.value).trim() !== ''
      ? String(stat.value).trim()
      : '0'

  const [displayValue, setDisplayValue] = useState<string>(rawValue)
  const cardRef = useRef<HTMLDivElement | null>(null)
  const animatedRef = useRef(false)

  const IconComponent = iconMap[stat.iconName || 'TrendingUp'] || TrendingUp
  const delayClass =
    index === 0 ? 'delay-75' : index === 1 ? 'delay-150' : index === 2 ? 'delay-225' : 'delay-300'

  useEffect(() => {
    // If value changes in parent/preview, synchronize immediately
    setDisplayValue(rawValue)
    animatedRef.current = false

    const el = cardRef.current
    if (!el) return

    const cleanNumStr = rawValue.replace(/,/g, '').trim()
    const num = parseFloat(cleanNumStr)

    // Non-numeric or exactly 0: display immediately without delay
    if (isNaN(num) || num === 0) {
      setDisplayValue(rawValue)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !animatedRef.current) {
          animatedRef.current = true

          const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          if (prefersReduced) {
            setDisplayValue(rawValue)
            return
          }

          const duration = 1000 // fast & non-blocking
          const start = performance.now()
          const isDecimal = rawValue.includes('.')
          const hasCommas = rawValue.includes(',')
          const decimalPlaces = isDecimal ? rawValue.split('.')[1]?.length || 1 : 0

          const animate = (time: number) => {
            const elapsed = time - start
            const progress = Math.min(1, elapsed / duration)
            const easeOut = 1 - Math.pow(1 - progress, 3)
            const current = num * easeOut

            if (progress < 1) {
              if (isDecimal) {
                setDisplayValue(current.toFixed(decimalPlaces))
              } else if (hasCommas) {
                setDisplayValue(Math.round(current).toLocaleString('en-US'))
              } else {
                setDisplayValue(Math.round(current).toString())
              }
              requestAnimationFrame(animate)
            } else {
              // MUST end with the EXACT saved value!
              setDisplayValue(rawValue)
            }
          }

          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.25 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [rawValue])

  const isAutomated = stat.sourceType === 'automated'
  const title = isRtl ? stat.label : stat.labelEn || stat.label
  const description = isRtl
    ? stat.description || stat.sourceNote
    : stat.descriptionEn || stat.description || stat.sourceNote

  return (
    <div
      ref={cardRef}
      className={`landing-reveal ${delayClass} landing-card-glow p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-sky-300 dark:hover:border-slate-700 transition-all group active:scale-[0.99]`}
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform mt-0.5">
          <IconComponent className="w-7 h-7" />
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-baseline gap-1">
            <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono tracking-tight">
              {displayValue}
            </span>
            {stat.unit && (
              <span className="text-lg font-bold text-sky-600 dark:text-sky-400">
                {stat.unit}
              </span>
            )}
          </div>
          <p className="text-xs sm:text-sm font-bold text-slate-800 dark:text-slate-200 line-clamp-1">
            {title}
          </p>
          {description ? (
            <p className="text-[11px] text-slate-500 dark:text-slate-400 line-clamp-2 leading-relaxed">
              {description}
            </p>
          ) : null}
        </div>
      </div>

      {/* Source Verification Badge */}
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        {isAutomated ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>{isRtl ? 'بيانات حية مباشرة' : 'Live Automated Data'}</span>
          </span>
        ) : (
          <span
            className="truncate"
            title={stat.sourceNote || description || (isRtl ? 'إحصائية موثقة' : 'Verified Statistic')}
          >
            {stat.sourceNote || description || (isRtl ? 'إحصائية موثقة' : 'Verified Statistic')}
          </span>
        )}
      </div>
    </div>
  )
}

export function LandingStatsSection({ stats }: LandingStatsSectionProps) {
  const visibleStats = (stats || []).filter((s) => s.visible !== false)
  if (visibleStats.length === 0) return null

  return (
    <section aria-label="إحصائيات المنصة" className="py-8 sm:py-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {visibleStats.map((stat, idx) => (
          <StatCard key={stat.id || idx} stat={stat} index={idx} />
        ))}
      </div>
    </section>
  )
}
