'use client'

import React, { useState } from 'react'
import { ChevronDown, HelpCircle } from 'lucide-react'
import { type FaqItem } from '@/lib/landing-config'
import { useLanguage } from '@/context/LanguageContext'

interface LandingFaqSectionProps {
  faqItems: FaqItem[]
}

export function LandingFaqSection({ faqItems }: LandingFaqSectionProps) {
  const { isRtl } = useLanguage()
  const [openIndex, setOpenIndex] = useState<number | null>(0)

  if (!faqItems || faqItems.length === 0) return null

  const toggle = (idx: number) => {
    setOpenIndex((prev) => (prev === idx ? null : idx))
  }

  return (
    <section id="faq" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-5xl mx-auto">
      <div className="text-center max-w-3xl mx-auto mb-14 space-y-3">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-xs font-black">
          <HelpCircle className="w-3.5 h-3.5" />
          <span>{isRtl ? 'إجابات على استفساراتك' : 'Frequently Asked Questions'}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight">
          {isRtl ? 'الأسئلة الأكثر شيوعاً حول المنصة' : 'Everything You Need to Know'}
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium">
          {isRtl
            ? 'كل ما يهم الأطباء وإدارات العيادات حول الخصائص والتشغيل والاشتراك.'
            : 'Answers to the most common questions about features, setup and subscriptions.'}
        </p>
      </div>

      <div className="space-y-3">
        {faqItems.map((item, idx) => {
          const isOpen = openIndex === idx
          return (
            <div
              key={item.id || idx}
              className={`rounded-2xl transition-all border ${
                isOpen
                  ? 'bg-white dark:bg-[#081526] border-sky-300 dark:border-sky-800 shadow-md'
                  : 'bg-white/80 dark:bg-[#081526]/60 border-slate-200 dark:border-slate-800/80 hover:border-sky-200'
              }`}
            >
              <button
                type="button"
                onClick={() => toggle(idx)}
                className="w-full p-5 text-right flex items-center justify-between gap-4 cursor-pointer"
                aria-expanded={isOpen}
              >
                <span className="font-black text-sm sm:text-base text-slate-900 dark:text-white">
                  {isRtl ? item.question : item.questionEn || item.question}
                </span>
                <div
                  className={`w-7 h-7 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-500 flex items-center justify-center shrink-0 transition-transform duration-200 ${
                    isOpen ? 'rotate-180 bg-sky-100 dark:bg-sky-900 text-sky-600' : ''
                  }`}
                >
                  <ChevronDown className="w-4 h-4" />
                </div>
              </button>

              <div className={`landing-faq-accordion-body ${isOpen ? 'is-open' : ''}`}>
                <div className="landing-faq-accordion-content">
                  <div className="px-5 pb-5 pt-2 text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium border-t border-slate-100 dark:border-slate-800/80">
                    <p>{isRtl ? item.answer : item.answerEn || item.answer}</p>
                  </div>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
