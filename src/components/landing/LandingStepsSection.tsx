'use client'

import React from 'react'
import { Rocket, Settings, CheckCircle2, ArrowLeft, ArrowRight, Sparkles } from 'lucide-react'
import { type StepItem } from '@/lib/landing-config'
import { useLanguage } from '@/context/LanguageContext'

interface LandingStepsSectionProps {
  steps: StepItem[]
  onActionClick?: () => void
}

const stepIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Rocket,
  Settings,
  CheckCircle2,
  Sparkles
}

export function LandingStepsSection({ steps, onActionClick }: LandingStepsSectionProps) {
  const { isRtl } = useLanguage()

  if (!steps || steps.length === 0) return null

  return (
    <section id="steps" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-xs font-black">
          <Sparkles className="w-3.5 h-3.5 text-amber-500" />
          <span>{isRtl ? 'سهولة البداية والتشغيل' : 'Fast Clinic Setup'}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {isRtl ? 'كيف تبدأ استخدام يلا كلينك في عيادتك؟' : 'How to Get Started with Yalla Clinic'}
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
          {isRtl
            ? 'خطوات بسيطة وواضحة لبدء العمل في نفس اليوم دون الحاجة لأجهزة مخصصة أو تركيبات معقدة.'
            : 'Simple steps to start using the system on the same day without special hardware.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
        {/* Subtle Horizontal Connecting Trail on Desktop */}
        <div
          aria-hidden="true"
          className="hidden md:block absolute top-14 left-[15%] right-[15%] h-[2px] bg-gradient-to-r from-sky-400/20 via-sky-500/60 to-indigo-500/20 z-0 pointer-events-none"
        />

        {steps.map((step, idx) => {
          const Icon = stepIcons[step.iconName] || CheckCircle2
          const delayClass = idx === 0 ? 'delay-75' : idx === 1 ? 'delay-150' : 'delay-225'

          return (
            <div
              key={step.id || idx}
              className={`landing-reveal ${delayClass} landing-card-glow relative z-10 p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-4 hover:border-sky-300 dark:hover:border-slate-700 transition-all flex flex-col justify-between group active:scale-[0.99]`}
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center font-black text-lg group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="w-9 h-9 rounded-full bg-slate-100 dark:bg-slate-800 font-mono font-black text-xs text-sky-600 dark:text-sky-400 flex items-center justify-center border border-sky-200/50 dark:border-sky-800/50 shadow-xs">
                    0{step.number || idx + 1}
                  </span>
                </div>

                <div className="space-y-2">
                  <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg">
                    {isRtl ? step.title : step.titleEn || step.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
                    {isRtl ? step.description : step.descriptionEn || step.description}
                  </p>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
