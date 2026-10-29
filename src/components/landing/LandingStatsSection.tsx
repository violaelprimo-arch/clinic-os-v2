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
  const [displayValue, setDisplayValue] = useState<string>(stat.value || '0')
  const cardRef = useRef<HTMLDivElement | null>(null)
  const animatedRef = useRef(false)

  const IconComponent = iconMap[stat.iconName || 'TrendingUp'] || TrendingUp
  const delayClass = index === 0 ? 'delay-75' : index === 1 ? 'delay-150' : index === 2 ? 'delay-225' : 'delay-300'

  useEffect(() => {
    const el = cardRef.current
    if (!el) return

    const rawStr = String(stat.value || '0').replace(/,/g, '')
    const num = parseFloat(rawStr)
    if (isNaN(num)) {
      setDisplayValue(stat.value)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && !animatedRef.current) {
          animatedRef.current = true

          const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
          if (prefersReduced) {
            setDisplayValue(stat.value)
            return
          }

          const duration = 1200
          const start = performance.now()
          const isDecimal = String(stat.value).includes('.')

          const animate = (time: number) => {
            const elapsed = time - start
            const progress = Math.min(1, elapsed / duration)
            const easeOut = 1 - Math.pow(1 - progress, 3)
            const current = num * easeOut

            setDisplayValue(isDecimal ? current.toFixed(1) : Math.round(current).toString())

            if (progress < 1) {
              requestAnimationFrame(animate)
            } else {
              setDisplayValue(stat.value)
            }
          }

          requestAnimationFrame(animate)
        }
      },
      { threshold: 0.25 }
    )

    observer.observe(el)
    return () => observer.disconnect()
  }, [stat.value])

  const isAutomated = stat.sourceType === 'automated'

  return (
    <div
      ref={cardRef}
      className={`landing-reveal ${delayClass} landing-card-glow p-6 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm flex flex-col justify-between hover:border-sky-300 dark:hover:border-slate-700 transition-all group active:scale-[0.99]`}
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 group-hover:scale-105 transition-transform">
          <IconComponent className="w-7 h-7" />
        </div>
        <div className="space-y-0.5 min-w-0">
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
          <p className="text-xs sm:text-sm font-bold text-slate-700 dark:text-slate-300 truncate">
            {isRtl ? stat.label : stat.labelEn || stat.label}
          </p>
        </div>
      </div>

      {/* Source Verification Badge */}
      <div className="pt-3 mt-3 border-t border-slate-100 dark:border-slate-800/80 flex items-center justify-between text-[11px] text-slate-500 dark:text-slate-400 font-medium">
        {isAutomated ? (
          <span className="inline-flex items-center gap-1.5 text-emerald-600 dark:text-emerald-400 font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span>بيانات حية مباشرة</span>
          </span>
        ) : (
          <span className="truncate" title={stat.sourceNote || 'إحصائية موثقة'}>
            {stat.sourceNote || 'إحصائية موثقة'}
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
