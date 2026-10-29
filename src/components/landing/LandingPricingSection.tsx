'use client'

import React from 'react'
import { Check, Sparkles, ShieldCheck, ArrowRight, ArrowLeft } from 'lucide-react'
import { type PricingPlanItem } from '@/lib/landing-config'
import { useLanguage } from '@/context/LanguageContext'

interface LandingPricingSectionProps {
  plans: PricingPlanItem[]
  onSelectPlan?: (planName: string) => void
}

export function LandingPricingSection({ plans, onSelectPlan }: LandingPricingSectionProps) {
  const { isRtl } = useLanguage()

  if (!plans || plans.length === 0) return null

  return (
    <section id="pricing" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-xs font-black">
          <Sparkles className="w-3.5 h-3.5" />
          <span>{isRtl ? 'باقات واضحة وبسيطة' : 'Transparent & Scalable Plans'}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {isRtl ? 'اختر الباقة المناسبة لحجم عيادتك' : 'Choose the Right Plan for Your Clinic'}
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
          {isRtl
            ? 'اشتراكات مرنة بدون عقود إلزامية، مع إمكانية تجربة النظام مجاناً بكامل مزاياه قبل الاشتراك.'
            : 'Flexible plans with no lock-in contracts, with free trial on all features.'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
        {plans.map((plan, idx) => {
          const isPop = plan.popular
          const delayClass = idx === 0 ? 'delay-75' : idx === 1 ? 'delay-150' : 'delay-225'

          return (
            <div
              key={plan.id || idx}
              className={`landing-reveal ${delayClass} landing-card-glow relative rounded-3xl p-6 sm:p-8 flex flex-col justify-between transition-all ${
                isPop
                  ? 'bg-white dark:bg-[#081526] border-2 border-sky-500 shadow-xl ring-4 ring-sky-500/10 scale-100 md:-translate-y-2'
                  : 'bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm hover:border-sky-300'
              }`}
            >
              {isPop && (
                <div className="absolute -top-3.5 left-1/2 -translate-x-1/2 px-4 py-1 rounded-full bg-gradient-to-r from-sky-600 to-indigo-600 text-white text-[11px] font-black shadow-md flex items-center gap-1.5 animate-pulse">
                  <Sparkles className="w-3 h-3 text-amber-300" />
                  <span>{plan.badge || (isRtl ? 'الباقة الأكثر طلباً' : 'Most Popular')}</span>
                </div>
              )}

              <div className="space-y-5">
                <div className="space-y-2">
                  <h3 className="font-black text-slate-900 dark:text-white text-lg sm:text-xl">
                    {isRtl ? plan.name : plan.nameEn || plan.name}
                  </h3>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl sm:text-4xl font-black text-slate-900 dark:text-white font-mono">
                      {isRtl ? plan.price : plan.priceEn || plan.price}
                    </span>
                    <span className="text-xs font-bold text-slate-500 dark:text-slate-400">
                      {isRtl ? `ج.م / ${plan.period}` : `EGP / ${plan.periodEn || plan.period}`}
                    </span>
                  </div>
                </div>

                {/* Features list */}
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  {(plan.features || []).map((feat, fIdx) => (
                    <div key={fIdx} className="flex items-start gap-2.5 text-xs font-medium text-slate-700 dark:text-slate-300">
                      <span className="w-4 h-4 rounded-full bg-sky-100 dark:bg-sky-950 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0 mt-0.5 font-bold">
                        ✓
                      </span>
                      <span className="leading-relaxed">{feat}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-6">
                <button
                  type="button"
                  onClick={() => onSelectPlan?.(plan.name)}
                  className={`landing-btn-press w-full py-3.5 rounded-2xl font-black text-xs sm:text-sm flex items-center justify-center gap-2 transition-all cursor-pointer shadow-sm ${
                    isPop
                      ? 'bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white hover:opacity-95'
                      : 'bg-sky-50 dark:bg-sky-950/60 hover:bg-sky-100 text-sky-600 dark:text-sky-300 border border-sky-200 dark:border-sky-800'
                  }`}
                >
                  <span>{isRtl ? 'طلب هذه الباقة والتجربة' : 'Start with this plan'}</span>
                  {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
