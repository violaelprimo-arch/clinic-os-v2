'use client'

import React, { useState } from 'react'
import {
  Calendar,
  CalendarCheck,
  Tv,
  FileSignature,
  Receipt,
  Building2,
  Users,
  Database,
  TrendingUp,
  Smartphone,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Sparkles,
  Award,
  Stethoscope,
  LayoutGrid,
  Check
} from 'lucide-react'
import { type FeatureItem, DEFAULT_CLINICAL_FEATURES } from '@/lib/landing-config'
import { useLanguage } from '@/context/LanguageContext'

interface LandingFeaturesSectionProps {
  features?: FeatureItem[]
}

const featureIcons: Record<string, React.ComponentType<{ className?: string }>> = {
  Calendar,
  CalendarCheck,
  Tv,
  FileSignature,
  Receipt,
  Building2,
  Users,
  Database,
  TrendingUp,
  Smartphone,
  ShieldCheck,
  Clock,
  CheckCircle2,
  Sparkles,
  Award,
  Stethoscope
}

type AudienceFilter = 'all' | 'doctor' | 'reception' | 'patient'

function getFeatureAudiences(f: FeatureItem): AudienceFilter[] {
  // If explicitly assigned a specific audience in config (and not 'all'):
  if (f.targetAudience && f.targetAudience !== 'all') {
    return [f.targetAudience as AudienceFilter]
  }
  if (f.category && f.category !== 'general' && f.category !== 'all') {
    return [f.category as AudienceFilter]
  }

  // Map features by ID and content keywords
  const id = (f.id || '').toLowerCase()
  const text = `${id} ${f.title || ''} ${f.description || ''} ${f.badge || ''}`.toLowerCase()
  const list: AudienceFilter[] = []

  // Doctor audience:
  if (['records', 'rx', 'drugs', 'devices', 'emr-records', 'rx-protocols'].includes(id) ||
      /طبيب|دكتور|روشتة|أدوية|تشخيص|rx|doctor|drug|emr/i.test(text)) {
    list.push('doctor')
  }

  // Reception audience:
  if (['queue', 'finance', 'branches', 'clinic-schedule-tv', 'finance-invoices', 'multi-branch-team'].includes(id) ||
      /استقبال|حسابات|فواتير|فروع|انتظار|شاشة|reception|tv|billing|invoice|branch/i.test(text)) {
    list.push('reception')
  }

  // Patient audience:
  if (['queue', 'records', 'devices', 'queue-booking', 'live-turn-tracking'].includes(id) ||
      /مريض|حجز|موبايل|هاتف|دور|patient|booking|mobile|portal/i.test(text)) {
    list.push('patient')
  }

  return list.length > 0 ? list : ['doctor', 'reception', 'patient']
}

function matchesAudience(f: FeatureItem, audience: AudienceFilter): boolean {
  if (audience === 'all') return true
  const audiences = getFeatureAudiences(f)
  return audiences.includes(audience)
}

export function LandingFeaturesSection({ features }: LandingFeaturesSectionProps) {
  const { isRtl } = useLanguage()
  const [activeAudience, setActiveAudience] = useState<AudienceFilter>('all')

  // Filter out hidden features and any legacy fake AI features
  const sourceFeatures = (features && features.length > 0) ? features : DEFAULT_CLINICAL_FEATURES
  const rawVisible = sourceFeatures.filter(
    (f) =>
      f.visible !== false &&
      f.id !== 'ai' &&
      !f.title?.includes('الذكاء الاصطناعي')
  )
  const visibleFeatures = rawVisible.length > 0 ? rawVisible : DEFAULT_CLINICAL_FEATURES

  const audienceFiltered =
    activeAudience === 'all'
      ? visibleFeatures
      : visibleFeatures.filter((f) => matchesAudience(f, activeAudience))

  // Fallback to all visible features if filter returned empty, ensuring section is NEVER blank
  const filteredFeatures = audienceFiltered.length > 0 ? audienceFiltered : visibleFeatures

  const audienceTabs: { id: AudienceFilter; labelAr: string; labelEn: string; icon: React.ComponentType<{ className?: string }> }[] = [
    { id: 'all', labelAr: 'جميع المميزات', labelEn: 'All Capabilities', icon: LayoutGrid },
    { id: 'doctor', labelAr: '🩺 للطبيب والعيادة', labelEn: 'For Doctors', icon: Stethoscope },
    { id: 'reception', labelAr: '📋 للاستقبال والإدارة', labelEn: 'For Reception & Admin', icon: Building2 },
    { id: 'patient', labelAr: '📱 لتجربة المريض', labelEn: 'For Patients', icon: Smartphone },
  ]

  return (
    <section id="features" className="py-16 sm:py-24 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto scroll-mt-20">
      <div className="text-center max-w-3xl mx-auto mb-10 sm:mb-14 space-y-4">
        <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 border border-sky-200 dark:border-sky-800 text-xs font-black shadow-xs">
          <ShieldCheck className="w-3.5 h-3.5 text-sky-600" />
          <span>{isRtl ? 'المنظومة الطبية الشاملة المعتمدة' : 'Verified Clinical Operating System'}</span>
        </div>

        <h2 className="text-2xl sm:text-4xl lg:text-5xl font-black text-slate-900 dark:text-white tracking-tight leading-tight">
          {isRtl ? 'كل ما تحتاجه عيادتك في نظام واحد متصل' : 'Everything Your Clinic Needs in One Unified System'}
        </h2>

        <p className="text-sm sm:text-base text-slate-600 dark:text-slate-400 font-medium max-w-2xl mx-auto">
          {isRtl
            ? 'وظائف عيادية وإدارية مجربة يومياً في المراكز الطبية لتنظيم عمل الطبيب، تسريع الاستقبال، وإراحة المريض.'
            : 'Battle-tested daily clinical workflows built for doctors, reception teams, and patients.'}
        </p>

        {/* Stakeholder Filter Tabs */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
          {audienceTabs.map((tab) => {
            const TabIcon = tab.icon
            const isActive = activeAudience === tab.id
            const count = tab.id === 'all'
              ? visibleFeatures.length
              : visibleFeatures.filter((f) => matchesAudience(f, tab.id)).length

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveAudience(tab.id)}
                className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-black transition-all flex items-center gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-md shadow-sky-600/20 scale-[1.02]'
                    : 'bg-white dark:bg-slate-800/80 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700'
                }`}
              >
                <TabIcon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-sky-600'}`} />
                <span>{isRtl ? tab.labelAr : tab.labelEn}</span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                    isActive
                      ? 'bg-white/20 text-white'
                      : 'bg-slate-100 dark:bg-slate-700/60 text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Features Grid */}
      <div key={activeAudience} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-7 transition-all duration-300">
        {filteredFeatures.map((feat, idx) => {
          const Icon = featureIcons[feat.iconName] || CalendarCheck

          return (
            <div
              key={feat.id || idx}
              className="landing-card-glow opacity-100 p-6 sm:p-7 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm space-y-4 hover:border-sky-300 dark:hover:border-slate-700 hover:shadow-lg transition-all flex flex-col justify-between group active:scale-[0.99]"
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-2">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 dark:bg-sky-950/70 text-sky-600 dark:text-sky-400 flex items-center justify-center group-hover:scale-105 transition-transform">
                    <Icon className="w-6 h-6" />
                  </div>
                  {feat.badge && (
                    <span className="px-3 py-1 rounded-full bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 text-xs font-bold border border-slate-200/60 dark:border-slate-700">
                      {isRtl ? feat.badge : feat.badgeEn || feat.badge}
                    </span>
                  )}
                </div>

                <div className="space-y-2">
                  <h3 className="font-black text-slate-900 dark:text-white text-base sm:text-lg leading-snug">
                    {isRtl ? feat.title : feat.titleEn || feat.title}
                  </h3>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed font-medium">
                    {isRtl ? feat.description : feat.descriptionEn || feat.description}
                  </p>
                </div>
              </div>

              {/* Tangible Practical Benefit Pill */}
              {(feat.practicalBenefit || isRtl) && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800/80">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold">
                    <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>{isRtl ? feat.practicalBenefit || 'ميزة عملية لعيادتك' : feat.practicalBenefitEn || feat.practicalBenefit}</span>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
