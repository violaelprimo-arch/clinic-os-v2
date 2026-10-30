'use client'

import React, { useRef, useState, useCallback, useEffect } from 'react'
import {
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Monitor,
  ShieldCheck,
  CheckCircle2,
  CalendarCheck,
  Building2,
  Calendar,
  Layers,
  FileText,
  Tv,
  BadgePercent,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Box,
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'
import { ClinicPillars3DScene } from './ClinicPillars3DScene'
import { OrbitCardItem } from '@/lib/landing-config'

interface LandingHeroSectionProps {
  badge?: string
  title?: string
  highlight?: string
  subtitle?: string
  heroImage?: string
  trialButtonText?: string
  galleryButtonText?: string
  loginButtonText?: string
  loginUrl?: string
  trialDaysCount?: number
  enable3DTilt?: boolean
  enableHero3D?: boolean
  motionLevel?: 'none' | 'subtle' | 'normal' | 'advanced'
  motionSpeed?: 'slow' | 'normal' | 'fast'
  onOpenTrial: () => void
}

export function LandingHeroSection({
  badge,
  title,
  highlight,
  subtitle,
  heroImage,
  trialButtonText = 'طلب تجربة مجانية',
  galleryButtonText = 'شاهد صور النظام الحقيقية',
  loginButtonText = 'تسجيل الدخول للعيادة',
  loginUrl = '/clinic/zizo/login',
  trialDaysCount = 14,
  enable3DTilt = true,
  enableHero3D = true,
  motionLevel = 'subtle',
  motionSpeed = 'normal',
  onOpenTrial,
}: LandingHeroSectionProps) {
  const { isRtl } = useLanguage()
  const frameRef = useRef<HTMLDivElement | null>(null)
  const [tiltStyle, setTiltStyle] = useState<React.CSSProperties>({})
  const [glareStyle, setGlareStyle] = useState<React.CSSProperties>({ opacity: 0 })
  const isTouchDeviceRef = useRef(false)
  
  // Default to '3d' if enabled and motion is not none, otherwise 'blueprint'
  const shouldDefaultTo3D = enableHero3D && motionLevel !== 'none'
  const [displayMode, setDisplayMode] = useState<'3d' | 'blueprint'>(
    shouldDefaultTo3D ? '3d' : 'blueprint'
  )

  const effectiveTrialText =
    trialButtonText && trialButtonText.trim()
      ? trialButtonText
      : isRtl
      ? 'طلب تجربة مجانية'
      : 'Request Free Trial'
  const effectiveDaysCount = trialDaysCount && trialDaysCount > 0 ? trialDaysCount : 14

  useEffect(() => {
    isTouchDeviceRef.current =
      'ontouchstart' in window || navigator.maxTouchPoints > 0
  }, [])

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enable3DTilt || motionLevel === 'none' || isTouchDeviceRef.current) return
      const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
      if (prefersReduced) return

      const frame = frameRef.current
      if (!frame) return

      const rect = frame.getBoundingClientRect()
      const x = e.clientX - rect.left
      const y = e.clientY - rect.top

      const centerX = rect.width / 2
      const centerY = rect.height / 2

      const maxRotate = motionLevel === 'advanced' ? 7 : 4
      const rotateX = -((y - centerY) / centerY) * maxRotate
      const rotateY = ((x - centerX) / centerX) * maxRotate

      setTiltStyle({
        transform: `perspective(1200px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) scale3d(1.01, 1.01, 1.01)`,
        transition: 'transform 0.1s ease-out',
      })

      const glareX = (x / rect.width) * 100
      const glareY = (y / rect.height) * 100
      setGlareStyle({
        opacity: 0.15,
        background: `radial-gradient(circle at ${glareX}% ${glareY}%, rgba(255, 255, 255, 0.4) 0%, transparent 60%)`,
        transition: 'opacity 0.2s ease-out',
      })
    },
    [enable3DTilt, motionLevel]
  )

  const handleMouseLeave = useCallback(() => {
    setTiltStyle({
      transform: 'perspective(1200px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)',
      transition: 'transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
    })
    setGlareStyle({
      opacity: 0,
      transition: 'opacity 0.4s ease-out',
    })
  }, [])

  const scrollToGallery = () => {
    const el = document.getElementById('gallery')
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' })
    }
  }

  return (
    <section aria-label="القسم الرئيسي" className="pt-8 sm:pt-14 pb-16 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      <div className="text-center max-w-4xl mx-auto space-y-6 sm:space-y-7">
        {/* Hero Badge */}
        {badge && (
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-gradient-to-r from-sky-500/10 via-sky-500/5 to-indigo-500/10 border border-sky-400/30 text-sky-700 dark:text-sky-300 text-xs sm:text-sm font-black shadow-xs">
            <Sparkles className="w-4 h-4 text-sky-600 animate-pulse" />
            <span>{badge}</span>
          </div>
        )}

        {/* Main Title & Value Proposition */}
        <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black text-slate-900 dark:text-white tracking-tight leading-[1.25]">
          {title}{' '}
          <span className="bg-gradient-to-r from-[#0066dc] via-sky-500 to-[#00a8e8] bg-clip-text text-transparent">
            {highlight}
          </span>
        </h1>

        {/* Concise Description Tailored for Doctors */}
        <p className="text-sm sm:text-lg text-slate-600 dark:text-slate-300 leading-relaxed max-w-3xl mx-auto font-medium">
          {subtitle}
        </p>

        {/* Primary and Secondary CTA Buttons */}
        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onOpenTrial}
            className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-black text-sm sm:text-base shadow-xl shadow-sky-600/25 hover:shadow-2xl hover:scale-[1.01] active:scale-[0.99] transition-all flex items-center justify-center gap-2.5 cursor-pointer"
          >
            <span>{effectiveTrialText}</span>
            {effectiveDaysCount > 0 && (
              <span className="px-2.5 py-0.5 rounded-lg bg-white/20 text-white text-xs font-mono font-bold">
                {effectiveDaysCount} يوم مجاناً
              </span>
            )}
            {isRtl ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
          </button>

          <button
            type="button"
            onClick={scrollToGallery}
            className="w-full sm:w-auto px-7 py-4 rounded-2xl bg-white dark:bg-[#081526] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-800 dark:text-slate-100 border border-slate-200 dark:border-slate-700 font-bold text-sm sm:text-base transition-all flex items-center justify-center gap-2 cursor-pointer shadow-xs hover:border-sky-300"
          >
            <Monitor className="w-4 h-4 text-sky-600" />
            <span>{galleryButtonText}</span>
          </button>
        </div>

        {/* Fast Assurance Pills */}
        <div className="pt-2 flex flex-wrap items-center justify-center gap-4 sm:gap-6 text-xs font-bold text-slate-500 dark:text-slate-400">
          <span className="flex items-center gap-1.5">
            <CheckCircle2 className="w-4 h-4 text-emerald-500 shrink-0" />
            <span>بدون كارت فيزا للتجربة</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5">
            <CalendarCheck className="w-4 h-4 text-sky-500 shrink-0" />
            <span>تفعيل فوري لعيادتك</span>
          </span>
          <span className="hidden sm:inline">•</span>
          <span className="flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-indigo-500 shrink-0" />
            <span>خصوصية وسرية تامة للملفات الطبية</span>
          </span>
        </div>
      </div>

      {/* Hero Showcase Frame with 3D Perspective Tilt */}
      <div
        ref={frameRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        style={tiltStyle}
        className="mt-12 sm:mt-16 max-w-5xl mx-auto rounded-3xl overflow-hidden shadow-2xl border-4 border-white dark:border-slate-800 bg-[#06101e] ring-1 ring-slate-900/10 relative transition-transform duration-100 will-change-transform"
      >
        {/* Dynamic 3D Glare Layer */}
        <div
          aria-hidden="true"
          className="absolute inset-0 pointer-events-none z-20 transition-opacity"
          style={glareStyle}
        />

        {/* Window Chrome Bar */}
        <div className="bg-slate-900/90 backdrop-blur-md px-4 py-2.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 relative z-10">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-rose-500/80" />
            <div className="w-3 h-3 rounded-full bg-amber-500/80" />
            <div className="w-3 h-3 rounded-full bg-emerald-500/80" />
            <span className="text-xs font-mono text-slate-400 mr-2 hidden sm:inline">
              yalla-clinic.com — يلا كلينيك OS
            </span>
          </div>

          {/* Mode Switcher Pill: 3D Scene vs System Blueprint */}
          <div className="flex items-center gap-1 p-0.5 rounded-xl bg-slate-800/90 border border-slate-700/70 text-xs">
            <button
              type="button"
              onClick={() => setDisplayMode('3d')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                displayMode === '3d'
                  ? 'bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>مشهد 3D التفاعلي</span>
            </button>
            <button
              type="button"
              onClick={() => setDisplayMode('blueprint')}
              className={`px-3 py-1 rounded-lg font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                displayMode === 'blueprint'
                  ? 'bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white shadow-xs'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>معمارية النظام</span>
            </button>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-400 font-bold hidden md:flex">
            <span className="inline-flex items-center gap-1.5 text-sky-400">
              <span className="w-2 h-2 rounded-full bg-sky-400 animate-pulse" />
              المنظومة الطبية الموحدة
            </span>
          </div>
        </div>

        {displayMode === '3d' ? (
          <ClinicPillars3DScene
            heroImage={heroImage}
            motionLevel={motionLevel}
            motionSpeed={motionSpeed}
            isRtl={isRtl}
            fallbackView={
              /* Fallback view when WebGL is unsupported */
              heroImage ? (
                <div className="relative group">
                  <img
                    src={heroImage}
                    alt="شاشة نظام يلا كلينيك لإدارة العيادات والمراكز الطبية"
                    className="w-full h-auto object-cover max-h-[600px]"
                  />
                </div>
              ) : (
                <div className="p-6 sm:p-10 bg-gradient-to-b from-[#091528] via-[#071120] to-[#050b15] text-white space-y-8 relative">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-black text-white">حجز سريع ومتابعة الدور</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        حجز فوري برقم الموبايل بدون OTP مع تتبع مباشر لرقم الدور والوقت المتوقع.
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                        <Tv className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-black text-white">شاشة تلفزيون الانتظار</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        عرض الدور اللحظي على شاشات Smart TV في صالة العيادة مع نداء صوتي وتنبيه بالاسم.
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                        <FileText className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-black text-white">السجل الطبي والروشتة A4</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        تاريخ الزيارات السابقة، دليل الأدوية المصري، قوالب Rx بضغطة زر وطباعة رسمية معتمدة.
                      </p>
                    </div>
                    <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                        <BadgePercent className="w-4 h-4" />
                      </div>
                      <h4 className="text-sm font-black text-white">حسابات وفواتير دقيقة</h4>
                      <p className="text-xs text-slate-400 leading-relaxed font-medium">
                        حصر الإيراد اليومي لكل فرع، سندات القبض، ودعم الكاش والمحافظ الإلكترونية وانستاباي.
                      </p>
                    </div>
                  </div>
                </div>
              )
            }
          />
        ) : heroImage ? (
          <div className="relative group">
            <img
              src={heroImage}
              alt="شاشة نظام يلا كلينيك لإدارة العيادات والمراكز الطبية"
              className="w-full h-auto object-cover max-h-[600px]"
            />
          </div>
        ) : (
          /* Authentic Yalla Clinic OS Architectural Showcase (Zero fake patient cards or buttons) */
          <div className="p-6 sm:p-10 bg-gradient-to-b from-[#091528] via-[#071120] to-[#050b15] text-white space-y-8 relative">
            {/* Top Showcase Branding Banner */}
            <div className="flex flex-wrap items-center justify-between gap-4 pb-6 border-b border-slate-800/80">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#0066dc] to-[#00a8e8] flex items-center justify-center shadow-lg shadow-sky-500/20">
                  <Monitor className="w-6 h-6 text-white" />
                </div>
                <div>
                  <div className="text-xs font-bold text-sky-400 uppercase tracking-wider">
                    واجهة العمل الطبية السحابية
                  </div>
                  <h3 className="text-lg sm:text-xl font-black text-white">
                    يلا كلينيك — Yalla Clinic OS
                  </h3>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="px-3 py-1.5 rounded-xl bg-slate-800/80 border border-slate-700/80 text-xs font-bold text-slate-300 flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-400" />
                  <span>تطوير Yalla CodeX</span>
                </span>
              </div>
            </div>

            {/* 4 Pillars Interconnected Architecture Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Pillar 1 */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2 hover:border-sky-500/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-sky-500/10 text-sky-400 flex items-center justify-center font-bold">
                  <Calendar className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-white">حجز سريع ومتابعة الدور</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  حجز فوري برقم الموبايل للمريض بدون OTP مع تتبع مباشر لرقم الدور والوقت المتوقع.
                </p>
              </div>

              {/* Pillar 2 */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2 hover:border-sky-500/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold">
                  <Tv className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-white">شاشة تلفزيون الانتظار</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  عرض الدور اللحظي على شاشات Smart TV في صالة العيادة مع نداء صوتي وتنبيه بالاسم.
                </p>
              </div>

              {/* Pillar 3 */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2 hover:border-sky-500/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-400 flex items-center justify-center font-bold">
                  <FileText className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-white">السجل الطبي والروشتة A4</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  تاريخ الزيارات السابقة، دليل الأدوية المصري، قوالب Rx بضغطة زر وطباعة رسمية معتمدة.
                </p>
              </div>

              {/* Pillar 4 */}
              <div className="p-4 rounded-2xl bg-slate-800/50 border border-slate-700/60 space-y-2 hover:border-sky-500/50 transition-colors">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-400 flex items-center justify-center font-bold">
                  <BadgePercent className="w-4 h-4" />
                </div>
                <h4 className="text-sm font-black text-white">حسابات وفواتير دقيقة</h4>
                <p className="text-xs text-slate-400 leading-relaxed font-medium">
                  حصر الإيراد اليومي لكل فرع، سندات القبض، ودعم الكاش والمحافظ الإلكترونية وانستاباي.
                </p>
              </div>
            </div>

            {/* Bottom Invitation to View Authentic Gallery */}
            <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-800/60 text-xs">
              <span className="text-slate-400 font-medium">
                استكشف الشاشات الحقيقية الكاملة للنظام المستخدمة يوميًا في العيادات
              </span>
              <button
                type="button"
                onClick={scrollToGallery}
                className="inline-flex items-center gap-1.5 text-sky-400 hover:text-sky-300 font-bold underline cursor-pointer"
              >
                <span>معاينة شاشات النظام في المعرض</span>
                {isRtl ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
