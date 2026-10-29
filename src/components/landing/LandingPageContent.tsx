'use client'

import React, { useState, useEffect, useRef } from 'react'
import { LandingNavbar } from './LandingNavbar'
import { LandingHeroSection } from './LandingHeroSection'
import { LandingStatsSection } from './LandingStatsSection'
import { LandingFeaturesSection } from './LandingFeaturesSection'
import { SystemGalleryCarousel } from './SystemGalleryCarousel'
import { LandingStepsSection } from './LandingStepsSection'
import { LandingTestimonialsSection } from './LandingTestimonialsSection'
import { LandingPricingSection } from './LandingPricingSection'
import { LandingFaqSection } from './LandingFaqSection'
import { LandingContactSection } from './LandingContactSection'
import { LandingCtaSection } from './LandingCtaSection'
import { LandingFooter } from './LandingFooter'
import { MessageCircle, X, Loader2, CheckCircle2, ShieldCheck, ArrowLeft, ArrowRight, AlertCircle } from 'lucide-react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { submitFreeTrialRequest } from '@/lib/landing-service'
import { whatsappNumber, type LandingPageConfig } from '@/lib/landing-config'
import { useLanguage } from '@/context/LanguageContext'
import { useScrollReveal } from './useScrollReveal'
import { toast } from 'sonner'
import './landing.css'

interface LandingPageContentProps {
  config: LandingPageConfig
  isPreview?: boolean
}

export function LandingPageContent({ config, isPreview = false }: LandingPageContentProps) {
  const { isRtl } = useLanguage()
  const [trialOpen, setTrialOpen] = useState(false)
  const [selectedPlanName, setSelectedPlanName] = useState<string>('')

  // Trial form state
  const [doctorName, setDoctorName] = useState('')
  const [clinicName, setClinicName] = useState('')
  const [specialty, setSpecialty] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [governorate, setGovernorate] = useState('')
  const [city, setCity] = useState('')
  const [address, setAddress] = useState('')
  const [expectedPatientsPerDay, setExpectedPatientsPerDay] = useState('')
  const [notes, setNotes] = useState('')
  const [honeypot, setHoneypot] = useState('')
  const [isSubmittingTrial, setIsSubmittingTrial] = useState(false)
  const [trialSuccess, setTrialSuccess] = useState(false)
  const [submittedRequestNumber, setSubmittedRequestNumber] = useState<string>('')
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({})

  // Form input refs for auto-focusing invalid fields
  const doctorNameInputRef = useRef<HTMLInputElement>(null)
  const clinicNameInputRef = useRef<HTMLInputElement>(null)
  const specialtyInputRef = useRef<HTMLInputElement>(null)
  const phoneInputRef = useRef<HTMLInputElement>(null)
  const emailInputRef = useRef<HTMLInputElement>(null)

  const primaryContact =
    config.contacts.find((c) => c.isPrimary && c.whatsappEnabled) ||
    config.contacts.find((c) => c.whatsappEnabled)
  const number = whatsappNumber(primaryContact?.whatsappNumber || config.primaryWhatsapp || '201551007018')
  const whatsappUrl = number ? `https://wa.me/${number}` : 'https://wa.me/201551007018'

  // Scroll Progress Bar
  useEffect(() => {
    const handleScroll = () => {
      const totalScroll = document.documentElement.scrollHeight - window.innerHeight
      if (totalScroll <= 0) return
      const progress = Math.min(1, Math.max(0, window.scrollY / totalScroll))
      const bar = document.getElementById('landing-scroll-progress')
      if (bar) {
        bar.style.transform = `scaleX(${progress})`
      }
    }
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Desktop Ambient Cursor Spotlight
  const cursorRef = useRef<HTMLDivElement | null>(null)
  useEffect(() => {
    if (
      config.themeSettings?.motionLevel === 'none' ||
      config.themeSettings?.enableBackgroundAnimation === false
    )
      return
    const isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    if (isTouch) return

    let rafId: number
    let targetX = -1000
    let targetY = -1000
    let curX = -1000
    let curY = -1000

    const onPointerMove = (e: MouseEvent) => {
      targetX = e.clientX
      targetY = e.clientY
    }

    const updateCursor = () => {
      curX += (targetX - curX) * 0.15
      curY += (targetY - curY) * 0.15
      if (cursorRef.current) {
        cursorRef.current.style.left = `${curX}px`
        cursorRef.current.style.top = `${curY}px`
      }
      rafId = requestAnimationFrame(updateCursor)
    }

    window.addEventListener('pointermove', onPointerMove, { passive: true })
    rafId = requestAnimationFrame(updateCursor)

    return () => {
      window.removeEventListener('pointermove', onPointerMove)
      cancelAnimationFrame(rafId)
    }
  }, [config.themeSettings?.motionLevel, config.themeSettings?.enableBackgroundAnimation])

  // Scroll reveal trigger
  useScrollReveal(
    config.themeSettings?.enableSectionMotion !== false &&
      config.themeSettings?.motionLevel !== 'none'
  )

  const handleTrialSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setFieldErrors({})

    const clientErrors: Record<string, string> = {}
    if (!doctorName.trim() || doctorName.trim().length < 2) {
      clientErrors.doctorName = 'اسم الطبيب يجب أن يتكون من حرفين على الأقل'
    }
    if (!clinicName.trim() || clinicName.trim().length < 2) {
      clientErrors.clinicName = 'اسم العيادة يجب أن يتكون من حرفين على الأقل'
    }
    if (!phone.trim()) {
      clientErrors.phone = 'رقم الهاتف مطلوب'
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      clientErrors.email = 'يرجى إدخال بريد إلكتروني صحيح (مثال: doctor@example.com)'
    }

    if (Object.keys(clientErrors).length > 0) {
      setFieldErrors(clientErrors)
      if (clientErrors.doctorName) doctorNameInputRef.current?.focus()
      else if (clientErrors.clinicName) clinicNameInputRef.current?.focus()
      else if (clientErrors.phone) phoneInputRef.current?.focus()
      else if (clientErrors.email) emailInputRef.current?.focus()
      toast.error('يرجى مراجعة الحقول المحددة وتصحيح البيانات')
      return
    }

    setIsSubmittingTrial(true)
    try {
      const response = await submitFreeTrialRequest({
        doctorName: doctorName.trim(),
        clinicName: clinicName.trim(),
        specialty: specialty.trim() || 'طب عام',
        phone: phone.trim(),
        email: email.trim(),
        governorate: governorate.trim(),
        city: city.trim(),
        address: address.trim(),
        expectedPatientsPerDay: expectedPatientsPerDay.trim(),
        notes: (selectedPlanName ? `[الباقة المطلوبة: ${selectedPlanName}] ` : '') + notes.trim(),
        website: honeypot,
      })

      if (response?.requestNumber) {
        setSubmittedRequestNumber(response.requestNumber)
      }
      setTrialSuccess(true)
      toast.success('تم تسجيل طلب التجربة بنجاح!')
    } catch (err: any) {
      if (err?.fieldErrors && typeof err.fieldErrors === 'object' && Object.keys(err.fieldErrors).length > 0) {
        setFieldErrors(err.fieldErrors)
        if (err.fieldErrors.doctorName) doctorNameInputRef.current?.focus()
        else if (err.fieldErrors.clinicName) clinicNameInputRef.current?.focus()
        else if (err.fieldErrors.specialty) specialtyInputRef.current?.focus()
        else if (err.fieldErrors.phone) phoneInputRef.current?.focus()
        else if (err.fieldErrors.email) emailInputRef.current?.focus()
        toast.error(err.message || 'يرجى مراجعة الحقول المحددة وتصحيح البيانات')
      } else {
        toast.error(err?.message || 'تعذر إرسال الطلب، يرجى المحاولة ثانيةً')
      }
    } finally {
      setIsSubmittingTrial(false)
    }
  }

  const vis = config.visibility
  const order = config.sectionOrder || [
    'navbar',
    'hero',
    'stats',
    'features',
    'gallery',
    'steps',
    'testimonials',
    'partners',
    'pricing',
    'faq',
    'contact',
    'cta',
    'footer',
  ]

  // Render individual sections based on key
  const renderSectionInner = (sectionKey: string) => {
    switch (sectionKey) {
      case 'navbar':
        if (!vis.showNavbar) return null
        return (
          <LandingNavbar
            key="navbar"
            config={config}
            onOpenTrial={() => {
              setSelectedPlanName('')
              setTrialOpen(true)
            }}
          />
        )

      case 'hero':
        if (!vis.showHero) return null
        return (
          <LandingHeroSection
            key="hero"
            badge={isRtl ? config.heroBadge : config.english.heroBadge || config.heroBadge}
            title={isRtl ? config.heroTitle : config.english.heroTitle || config.heroTitle}
            highlight={isRtl ? config.heroHighlight : config.english.heroHighlight || config.heroHighlight}
            subtitle={isRtl ? config.heroSubtitle : config.english.heroSubtitle || config.heroSubtitle}
            heroImage={config.heroImage}
            trialButtonText={isRtl ? config.trialButtonText : config.english.trialButtonText || config.trialButtonText}
            galleryButtonText={isRtl ? config.galleryButtonText : config.english.galleryButtonText || config.galleryButtonText}
            loginButtonText={isRtl ? config.loginButtonText : config.english.loginButtonText || config.loginButtonText}
            loginUrl={config.loginUrl}
            trialDaysCount={config.trialDaysCount}
            enable3DTilt={config.themeSettings?.enable3DTilt !== false}
            enableHero3D={config.themeSettings?.enableHero3D !== false}
            motionLevel={config.themeSettings?.motionLevel || 'subtle'}
            motionSpeed={config.themeSettings?.motionSpeed || 'normal'}
            onOpenTrial={() => {
              setSelectedPlanName('')
              setTrialOpen(true)
            }}
          />
        )

      case 'stats':
        if (!vis.showStats) return null
        return <LandingStatsSection key="stats" stats={config.stats} />

      case 'features':
        if (!vis.showFeatures) return null
        return <LandingFeaturesSection key="features" features={config.features} />

      case 'gallery':
        if (!vis.showScreenshots) return null
        return (
          <SystemGalleryCarousel
            key="gallery"
            screenshots={config.screenshots}
            autoplay={config.gallerySettings?.autoplay}
            intervalSeconds={config.gallerySettings?.intervalSeconds}
            sectionTitle={isRtl ? config.demoSectionTitle : config.english.demoSectionTitle || config.demoSectionTitle}
            sectionSubtitle={isRtl ? config.demoSectionSubtitle : config.english.demoSectionSubtitle || config.demoSectionSubtitle}
          />
        )

      case 'steps':
        if (!vis.showSteps) return null
        return <LandingStepsSection key="steps" steps={config.steps} />

      case 'testimonials':
      case 'partners':
        // Testimonials handles both feedbacks and partner client logos smoothly
        if (sectionKey === 'testimonials' && !vis.showFeedback && !vis.showClients) return null
        if (sectionKey === 'partners' && order.includes('testimonials')) return null // avoid duplicate
        return (
          <LandingTestimonialsSection
            key="testimonials"
            feedbacks={config.feedbacks}
            clients={config.clients}
            showFeedback={vis.showFeedback}
            showClients={vis.showClients}
          />
        )

      case 'pricing':
        if (!vis.showPricing) return null
        return (
          <LandingPricingSection
            key="pricing"
            plans={config.pricingPlans}
            onSelectPlan={(plan) => {
              setSelectedPlanName(plan)
              setTrialOpen(true)
            }}
          />
        )

      case 'faq':
        if (!vis.showFaq) return null
        return <LandingFaqSection key="faq" faqItems={config.faqItems} />

      case 'contact':
        if (!vis.showContactForm) return null
        return (
          <LandingContactSection
            key="contact"
            contacts={config.contacts}
            primaryWhatsapp={config.primaryWhatsapp}
          />
        )

      case 'cta':
        if (!vis.showTrialBanner) return null
        return (
          <LandingCtaSection
            key="cta"
            trialDaysCount={config.trialDaysCount}
            whatsappUrl={whatsappUrl}
            onOpenTrial={() => {
              setSelectedPlanName('')
              setTrialOpen(true)
            }}
          />
        )

      case 'footer':
        if (!vis.showFooter) return null
        return <LandingFooter key="footer" config={config} />

      default:
        return null
    }
  }

  const renderSection = (sectionKey: string) => {
    const el = renderSectionInner(sectionKey)
    if (!el) return null
    return (
      <div
        key={sectionKey}
        data-section-id={sectionKey}
        onClick={
          isPreview
            ? (e) => {
                e.stopPropagation()
                if (window.parent && window.parent !== window) {
                  window.parent.postMessage(
                    { type: 'section-selected', sectionId: sectionKey },
                    location.origin
                  )
                }
              }
            : undefined
        }
        className={
          isPreview
            ? 'group relative transition-all duration-200 hover:outline-2 hover:outline-sky-500 hover:outline-offset-2 cursor-pointer'
            : undefined
        }
      >
        {isPreview && (
          <div className="absolute top-2 left-2 z-30 opacity-0 group-hover:opacity-100 transition-opacity bg-sky-600 text-white text-[10px] font-bold px-2 py-0.5 rounded shadow pointer-events-none">
            انقر للتعديل: {sectionKey}
          </div>
        )}
        {el}
      </div>
    )
  }

  const motionClass = `motion-${config.themeSettings?.motionLevel || 'subtle'}`
  const speedClass = `speed-${config.themeSettings?.motionSpeed || 'normal'}`
  const radiusClass = config.themeSettings?.borderRadiusPreset || 'rounded-2xl'
  const sectionMotionClass =
    config.themeSettings?.enableSectionMotion === false ? 'no-section-motion' : ''

  return (
    <div
      dir={isRtl ? 'rtl' : 'ltr'}
      className={`min-h-screen bg-[#f8fbff] dark:bg-[#050d1a] text-slate-900 dark:text-white antialiased transition-colors relative overflow-hidden ${motionClass} ${speedClass} ${radiusClass} ${sectionMotionClass}`}
    >
      {/* Top Scroll Progress Indicator */}
      <div
        id="landing-scroll-progress"
        aria-hidden="true"
        className="landing-scroll-progress-bar"
      />

      {/* Desktop Ambient Cursor Spotlight */}
      {config.themeSettings?.enableBackgroundAnimation !== false &&
        config.themeSettings?.motionLevel !== 'none' && (
          <div
            ref={cursorRef}
            aria-hidden="true"
            className="landing-cursor-glow hidden lg:block"
          />
        )}

      {/* Multi-Layer Ambient Background: Aurora, Grid & Floating Diffuse Orbs */}
      {config.themeSettings?.enableBackgroundAnimation !== false &&
        config.themeSettings?.motionLevel !== 'none' && (
          <div
            aria-hidden="true"
            className="pointer-events-none fixed inset-0 overflow-hidden z-0"
          >
            <div className="landing-aurora" />
            <div className="landing-perspective-grid" />
            <div className="landing-ambient-orb landing-ambient-orb-1" />
            <div className="landing-ambient-orb landing-ambient-orb-2" />
            <div className="landing-ambient-orb landing-ambient-orb-3" />
          </div>
        )}

      {/* Dynamic Ordered Sections */}
      <div className="relative z-10">
        {order.map((key) => renderSection(key))}
      </div>

      {/* Floating WhatsApp Action Button */}
      {vis.showFloatingWhatsapp && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noreferrer"
          className="fixed bottom-6 right-6 z-40 w-14 h-14 rounded-full bg-emerald-500 hover:bg-emerald-600 text-white shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all cursor-pointer group"
          title="محادثة واتساب مباشرة"
        >
          <MessageCircle className="w-7 h-7" />
          <span className="sr-only">واتساب</span>
        </a>
      )}

      {/* ============================================================ */}
      {/* FREE TRIAL REQUEST MODAL */}
      {/* ============================================================ */}
      <Dialog open={trialOpen} onOpenChange={setTrialOpen}>
        <DialogContent className="max-w-lg p-6 sm:p-8 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 space-y-4">
          <DialogHeader className="text-right">
            <DialogTitle className="text-lg sm:text-xl font-black text-slate-900 dark:text-white">
              {isRtl
                ? `طلب تجربة مجانية لعيادتك (${config.trialDaysCount} يوماً)`
                : `Request Free Clinic Trial (${config.trialDaysCount} Days)`}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500 dark:text-slate-400">
              {isRtl
                ? 'املأ بيانات العيادة وسيتم تجهيز حسابك فوراً والتواصل معك لتفعيل النظام.'
                : 'Fill in your clinic info and our team will set up your trial workspace immediately.'}
            </DialogDescription>
          </DialogHeader>

          {trialSuccess ? (
            <div className="py-6 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-950/70 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mx-auto shadow-sm">
                <CheckCircle2 className="w-7 h-7" />
              </div>
              <h4 className="font-black text-lg text-slate-900 dark:text-white">
                تم استلام طلب تسجيل عيادتك بنجاح!
              </h4>

              {submittedRequestNumber && (
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-sky-50 dark:bg-sky-950/70 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 text-xs font-mono shadow-xs">
                  <span className="font-sans font-bold">رقم الطلب المرجعي:</span>
                  <span className="font-black text-sm tracking-wider">{submittedRequestNumber}</span>
                </div>
              )}

              <p className="text-xs text-slate-500 dark:text-slate-400 max-w-sm mx-auto leading-relaxed">
                سيتواصل معك فريق Yalla Clinic لمراجعة التفاصيل وتجهيز بيانات الدخول ولوحة تحكم العيادة مباشرة.
              </p>
              <div className="pt-2 flex flex-col sm:flex-row gap-2">
                <a
                  href={`${whatsappUrl}?text=${encodeURIComponent(
                    `مرحبًا، سجلت طلب تسجيل عيادة في يلا كلينك (رقم الطلب: ${submittedRequestNumber || 'جديد'}) باسم د. ${doctorName} لعيادة ${clinicName}.`
                  )}`}
                  target="_blank"
                  rel="noreferrer"
                  className="flex-1 py-3 rounded-xl bg-emerald-500 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-sm hover:bg-emerald-600 transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  <span>متابعة مع المبيعات على واتساب فوراً</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    setTrialOpen(false)
                    setTrialSuccess(false)
                    setSubmittedRequestNumber('')
                  }}
                  className="py-3 px-5 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors"
                >
                  إغلاق
                </button>
              </div>
            </div>
          ) : (
            <form onSubmit={handleTrialSubmit} className="space-y-3.5">
              {selectedPlanName && (
                <div className="p-2.5 rounded-xl bg-sky-50 dark:bg-sky-950/60 border border-sky-200 dark:border-sky-800 text-xs font-bold text-sky-700 dark:text-sky-300 flex items-center justify-between">
                  <span>الباقة المختارة: {selectedPlanName}</span>
                  <button
                    type="button"
                    onClick={() => setSelectedPlanName('')}
                    className="text-[10px] text-slate-400 hover:text-rose-500 underline"
                  >
                    تغيير
                  </button>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم الطبيب <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={doctorNameInputRef}
                    type="text"
                    required
                    value={doctorName}
                    onChange={(e) => {
                      setDoctorName(e.target.value)
                      if (fieldErrors.doctorName) setFieldErrors(prev => ({ ...prev, doctorName: '' }))
                    }}
                    placeholder="د. محمد علي"
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs text-slate-900 dark:text-white transition-all ${
                      fieldErrors.doctorName
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-sky-500'
                    }`}
                  />
                  {fieldErrors.doctorName && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.doctorName}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    اسم العيادة / المركز <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={clinicNameInputRef}
                    type="text"
                    required
                    value={clinicName}
                    onChange={(e) => {
                      setClinicName(e.target.value)
                      if (fieldErrors.clinicName) setFieldErrors(prev => ({ ...prev, clinicName: '' }))
                    }}
                    placeholder="عيادة الشفاء التخصصية"
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs text-slate-900 dark:text-white transition-all ${
                      fieldErrors.clinicName
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-sky-500'
                    }`}
                  />
                  {fieldErrors.clinicName && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.clinicName}</span>
                    </p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    التخصص الطبي
                  </label>
                  <input
                    ref={specialtyInputRef}
                    type="text"
                    value={specialty}
                    onChange={(e) => {
                      setSpecialty(e.target.value)
                      if (fieldErrors.specialty) setFieldErrors(prev => ({ ...prev, specialty: '' }))
                    }}
                    placeholder="باطنة / أطفال / عظام..."
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs text-slate-900 dark:text-white transition-all ${
                      fieldErrors.specialty
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-sky-500'
                    }`}
                  />
                  {fieldErrors.specialty && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.specialty}</span>
                    </p>
                  )}
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    رقم الهاتف (واتساب) <span className="text-rose-500">*</span>
                  </label>
                  <input
                    ref={phoneInputRef}
                    type="tel"
                    required
                    value={phone}
                    onChange={(e) => {
                      setPhone(e.target.value)
                      if (fieldErrors.phone) setFieldErrors(prev => ({ ...prev, phone: '' }))
                    }}
                    placeholder="010XXXXXXXX"
                    className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs text-slate-900 dark:text-white transition-all ${
                      fieldErrors.phone
                        ? 'border-rose-500 ring-2 ring-rose-500/20'
                        : 'border-slate-200 dark:border-slate-700 focus:border-sky-500'
                    }`}
                    dir="ltr"
                  />
                  {fieldErrors.phone && (
                    <p className="text-[11px] font-bold text-rose-500 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                      <span>{fieldErrors.phone}</span>
                    </p>
                  )}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  البريد الإلكتروني <span className="text-rose-500">*</span>
                </label>
                <input
                  ref={emailInputRef}
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value)
                    if (fieldErrors.email) setFieldErrors(prev => ({ ...prev, email: '' }))
                  }}
                  placeholder="doctor@example.com"
                  className={`w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border text-xs text-slate-900 dark:text-white transition-all ${
                    fieldErrors.email
                      ? 'border-rose-500 ring-2 ring-rose-500/20'
                      : 'border-slate-200 dark:border-slate-700 focus:border-sky-500'
                  }`}
                  dir="ltr"
                />
                {fieldErrors.email && (
                  <p className="text-[11px] font-bold text-rose-500 mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                    <span>{fieldErrors.email}</span>
                  </p>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المحافظة
                  </label>
                  <input
                    type="text"
                    value={governorate}
                    onChange={(e) => setGovernorate(e.target.value)}
                    placeholder="القاهرة / الجيزة / الإسكندرية..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    المنطقة أو المركز
                  </label>
                  <input
                    type="text"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    placeholder="التجمع / المعادي / الدقي..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    العنوان التفصيلي
                  </label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="اسم الشارع أو المبنى الطبي..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                    الكشوفات المتوقعة يومياً
                  </label>
                  <input
                    type="text"
                    value={expectedPatientsPerDay}
                    onChange={(e) => setExpectedPatientsPerDay(e.target.value)}
                    placeholder="مثال: 15 - 30 مريض"
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
                  ملاحظات أو متطلبات خاصة (اختياري)
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="عدد الفروع أو متطلبات خاصة..."
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white resize-none"
                />
              </div>

              {/* Honeypot anti-spam protection (off-screen, never autofilled) */}
              <input
                type="text"
                name="clinic_reg_notes_hp"
                value={honeypot}
                onChange={(e) => setHoneypot(e.target.value)}
                tabIndex={-1}
                autoComplete="new-password"
                aria-hidden="true"
                style={{
                  position: 'absolute',
                  opacity: 0,
                  pointerEvents: 'none',
                  left: '-9999px',
                  width: '1px',
                  height: '1px',
                  overflow: 'hidden',
                }}
              />

              <div className="pt-2 flex items-center gap-2">
                <button
                  type="submit"
                  disabled={isSubmittingTrial}
                  className="flex-1 py-3 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-black text-xs shadow-md hover:opacity-95 transition-all cursor-pointer disabled:opacity-50 flex items-center justify-center gap-1.5"
                >
                  {isSubmittingTrial ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>جاري إرسال الطلب...</span>
                    </>
                  ) : (
                    <span>تأكيد طلب التجربة المجانية</span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setTrialOpen(false)}
                  className="py-3 px-4 rounded-xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs"
                >
                  إلغاء
                </button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
