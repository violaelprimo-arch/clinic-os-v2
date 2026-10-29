'use client'

import React from 'react'
import { Rocket, MessageCircle, ArrowLeft, ArrowRight, ShieldCheck, CheckCircle2 } from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

interface LandingCtaSectionProps {
  trialDaysCount?: number
  whatsappUrl: string
  onOpenTrial: () => void
}

export function LandingCtaSection({
  trialDaysCount = 14,
  whatsappUrl,
  onOpenTrial,
}: LandingCtaSectionProps) {
  const { isRtl } = useLanguage()

  return (
    <section className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="relative rounded-[36px] bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-800 text-white p-8 sm:p-14 shadow-2xl overflow-hidden text-center space-y-6">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -right-24 w-72 h-72 bg-white/10 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-sky-400/20 rounded-full blur-3xl pointer-events-none" />

        <div className="relative z-10 max-w-3xl mx-auto space-y-4">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-sm text-xs font-black">
            <Rocket className="w-3.5 h-3.5" />
            <span>{isRtl ? 'جاهز لتنظيم عيادتك؟' : 'Ready to Elevate Your Clinic?'}</span>
          </div>

          <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black tracking-tight leading-tight">
            {isRtl
              ? `ابدأ تجربتك المجانية لمدة ${trialDaysCount} يوماً الآن`
              : `Start Your ${trialDaysCount}-Day Free Trial Today`}
          </h2>

          <p className="text-sm sm:text-base text-sky-100 max-w-2xl mx-auto font-medium leading-relaxed">
            {isRtl
              ? 'تفعيل فوري لعيادتك، ورابط حجز مباشر، ومتابعة كاملة للدور والروشتات والحسابات بدون أي التزام مالي.'
              : 'Immediate activation, phone booking link, and full clinic control with zero commitment.'}
          </p>

          <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
            <button
              type="button"
              onClick={onOpenTrial}
              className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-white text-sky-900 hover:bg-sky-50 font-black text-sm sm:text-base shadow-xl transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <span>{isRtl ? 'طلب حساب وتجربة مجانية' : 'Request Free Workspace'}</span>
              {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
            </button>

            <a
              href={whatsappUrl}
              target="_blank"
              rel="noreferrer"
              className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white/15 hover:bg-white/25 text-white font-bold text-sm sm:text-base transition-all cursor-pointer flex items-center justify-center gap-2"
            >
              <MessageCircle className="w-4 h-4" />
              <span>{isRtl ? 'تحدث مع فريق المبيعات' : 'Chat with Sales'}</span>
            </a>
          </div>

          <div className="pt-2 flex items-center justify-center gap-4 text-xs text-sky-100 font-bold">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>بدون بطاقة ائتمان</span>
            </span>
            <span>•</span>
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>إلغاء في أي وقت</span>
            </span>
          </div>
        </div>
      </div>
    </section>
  )
}
