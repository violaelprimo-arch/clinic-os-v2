'use client'

import React, { useState, useRef, useEffect } from 'react'
import {
  Sparkles,
  Compass,
  ArrowUpRight,
  Gift,
  RotateCcw,
  Maximize2,
  CheckCircle2,
  MessageCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useLanguage } from '@/context/LanguageContext'
import { useDemoClinic } from './demo/useDemoClinic'
import { DemoBrowserFrame } from './demo/DemoBrowserFrame'
import { DemoPlatformTabs } from './demo/DemoPlatformTabs'
import { DemoDoctorDashboard } from './demo/DemoDoctorDashboard'
import { DemoPatientRecords } from './demo/DemoPatientRecords'
import { DemoPrescriptionView } from './demo/DemoPrescriptionView'
import { DemoReportsView } from './demo/DemoReportsView'
import { DemoPatientPortal } from './demo/DemoPatientPortal'
import { DemoGuidedTour } from './demo/DemoGuidedTour'
import { DemoFullScreenModal } from './demo/DemoFullScreenModal'
import { LandingPageConfig } from '@/lib/landing-config'

interface InteractiveProductDemoProps {
  config: LandingPageConfig
  onOpenTrial: () => void
  trialWhatsappHref: string
}

export function InteractiveProductDemo({
  config,
  onOpenTrial,
  trialWhatsappHref,
}: InteractiveProductDemoProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  const sectionRef = useRef<HTMLElement>(null)
  const [isIntersecting, setIsIntersecting] = useState(false)
  const [isFullScreen, setIsFullScreen] = useState(false)
  const [isTourOpen, setIsTourOpen] = useState(false)
  const [tourStepIndex, setTourStepIndex] = useState(0)
  const [targetPatientForRx, setTargetPatientForRx] = useState<string | undefined>(undefined)

  // Demo in-memory state engine
  const demo = useDemoClinic()

  // Lazy hydration on scroll near viewport
  useEffect(() => {
    if (!sectionRef.current) return

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setIsIntersecting(true)
          observer.disconnect()
        }
      },
      { rootMargin: '300px' },
    )

    observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  // Header titles: customizable or default
  const sectionTitle = !isRtl && (config as any).demoSectionTitleEn
    ? (config as any).demoSectionTitleEn
    : (config as any).demoSectionTitle || copy('جرّب يلا كلينيك بنفسك', 'Try Yalla Clinic Yourself')

  const sectionSubtitle = !isRtl && (config as any).demoSectionSubtitleEn
    ? (config as any).demoSectionSubtitleEn
    : (config as any).demoSectionSubtitle ||
      copy(
        'استكشف واجهات يلا كلينيك الحقيقية: تحكّم في الدور، واكتب الروشتة، وجرّب حجز المريض ومتابعة التقارير في تجربة حية وتفاعلية بالكامل.',
        'Explore real Yalla Clinic interfaces: manage live queues, write prescriptions, test patient booking, and monitor finances in a fully interactive demo.',
      )

  const handleOpenPrescriptionForPatient = (patientName: string) => {
    setTargetPatientForRx(patientName)
    demo.setPlatformTab('doctor')
    demo.setDoctorSubTab('prescriptions')
  }

  const handleStartTour = () => {
    setTourStepIndex(0)
    setIsTourOpen(true)
    demo.setPlatformTab('doctor')
    demo.setDoctorSubTab('dashboard')
  }

  const renderActivePlatformView = () => {
    if (demo.platformTab === 'patient') {
      return (
        <DemoPatientPortal
          demo={demo}
          onSwitchToDoctor={() => {
            demo.setPlatformTab('doctor')
            demo.setDoctorSubTab('dashboard')
          }}
        />
      )
    }

    // Doctor Platform sub-views
    switch (demo.doctorSubTab) {
      case 'dashboard':
        return (
          <DemoDoctorDashboard
            demo={demo}
            onOpenPrescription={handleOpenPrescriptionForPatient}
          />
        )
      case 'patients':
        return (
          <DemoPatientRecords
            demo={demo}
            onOpenPrescription={handleOpenPrescriptionForPatient}
          />
        )
      case 'prescriptions':
        return (
          <DemoPrescriptionView
            demo={demo}
            initialPatientName={targetPatientForRx}
          />
        )
      case 'reports':
        return <DemoReportsView demo={demo} />
      default:
        return (
          <DemoDoctorDashboard
            demo={demo}
            onOpenPrescription={handleOpenPrescriptionForPatient}
          />
        )
    }
  }

  const demoContent = (
    <div className="flex flex-col">
      <DemoPlatformTabs
        platformTab={demo.platformTab}
        onSelectPlatformTab={(tab) => {
          demo.setPlatformTab(tab)
          if (tab === 'doctor' && !demo.doctorSubTab) {
            demo.setDoctorSubTab('dashboard')
          }
        }}
        doctorSubTab={demo.doctorSubTab}
        onSelectDoctorSubTab={demo.setDoctorSubTab}
        waitingCount={demo.waitingList.length}
        inExamCount={demo.currentInExam ? 1 : 0}
      />
      <div className="min-h-[580px]">{renderActivePlatformView()}</div>
    </div>
  )

  return (
    <section
      id="showcase"
      ref={sectionRef}
      className="border-y border-border/80 bg-gradient-to-b from-secondary/20 via-background to-secondary/20 py-20"
      aria-label={sectionTitle}
    >
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* Section Header */}
        <div className="mb-10 text-center">
          <p className="landing-eyebrow flex items-center justify-center gap-1.5">
            <Sparkles className="size-3.5 text-primary" />
            <span>{copy('تجربة حية وتفاعلية', 'LIVE INTERACTIVE EXPERIENCE')}</span>
          </p>
          <h2 className="landing-title mt-2">{sectionTitle}</h2>
          <p className="mx-auto mt-3 max-w-3xl text-sm leading-7 text-muted-foreground sm:text-base">
            {sectionSubtitle}
          </p>

          {/* Quick CTA Pills */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
            <Button
              type="button"
              onClick={handleStartTour}
              className="gap-2 rounded-2xl bg-primary px-5 py-2.5 text-xs sm:text-sm font-black text-primary-foreground shadow-lg shadow-primary/25 hover:bg-primary/90 transition-all hover:scale-105 active:scale-95"
            >
              <Sparkles className="size-4" />
              <span>{copy('ابدأ الجولة الإرشادية', 'Start Guided Tour')}</span>
            </Button>

            <Button
              type="button"
              variant="outline"
              onClick={() => {
                demo.setPlatformTab('doctor')
                demo.setDoctorSubTab('dashboard')
              }}
              className="gap-2 rounded-2xl border-border bg-card px-5 py-2.5 text-xs sm:text-sm font-bold text-foreground hover:bg-muted transition-all"
            >
              <Compass className="size-4 text-primary" />
              <span>{copy('استكشف بنفسك حرّاً', 'Explore Freely')}</span>
            </Button>
          </div>
        </div>

        {/* Browser Mockup Frame holding the interactive demo */}
        <div className="relative mx-auto min-h-[640px] w-full">
          {isIntersecting ? (
            <DemoBrowserFrame
              onReset={demo.resetDemo}
              onToggleFullScreen={() => setIsFullScreen(true)}
              onStartTour={handleStartTour}
            >
              {demoContent}
            </DemoBrowserFrame>
          ) : (
            // Skeleton while approaching viewport
            <div className="flex min-h-[640px] flex-col items-center justify-center rounded-3xl border border-border/80 bg-muted/20 p-8 text-center animate-pulse">
              <span className="grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary">
                <Sparkles className="size-7" />
              </span>
              <h4 className="mt-4 text-sm font-black text-foreground">
                {copy('جاري تجهيز بيئة التجربة التفاعلية...', 'Preparing interactive workspace...')}
              </h4>
            </div>
          )}
        </div>

        {/* Bottom Call-To-Action (CTA) */}
        <div className="mt-14 rounded-3xl border border-primary/25 bg-gradient-to-r from-primary/10 via-card to-background p-6 sm:p-8 shadow-xl shadow-primary/5 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1.5 text-center md:text-start">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold text-primary">
              <Gift className="size-4" />
              {copy('جاهز لتجربة المنصة على عيادتك؟', 'Ready to experience it on your clinic?')}
            </span>
            <h3 className="text-xl sm:text-2xl font-black text-foreground">
              {copy('ابدأ نسختك المجانية لمدة 7 أيام الآن', 'Start your 7-day free trial today')}
            </h3>
            <p className="text-xs sm:text-sm text-muted-foreground max-w-xl">
              {copy(
                'جهّز عيادتك وفريقك واستقبل حجوزات المرضى من اليوم الأول مع دعم فني متواصل وتدريب كامل.',
                'Configure your clinic and team, manage appointments from day one with dedicated 24/7 technical onboarding.',
              )}
            </p>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <a
              href={trialWhatsappHref}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-12 items-center justify-center gap-2.5 rounded-2xl bg-gradient-to-r from-emerald-600 via-teal-600 to-emerald-600 hover:from-emerald-500 hover:to-teal-500 px-6 py-3 text-sm font-black text-white shadow-lg shadow-emerald-600/25 transition-all duration-200 hover:scale-105 active:scale-95"
            >
              <MessageCircle className="size-4.5" />
              <span>{copy('اطلب تجربة مجانية عبر واتساب', 'Request Free Trial via WhatsApp')}</span>
              <ArrowUpRight className="size-4" />
            </a>

            <Button
              type="button"
              variant="outline"
              onClick={onOpenTrial}
              className="min-h-12 rounded-2xl border-border bg-card px-5 text-sm font-bold hover:bg-muted"
            >
              {copy('سجل طلب التجربة بالموقع', 'Register via Web Form')}
            </Button>
          </div>
        </div>
      </div>

      {/* Guided Tour Modal */}
      <DemoGuidedTour
        isOpen={isTourOpen}
        onClose={() => setIsTourOpen(false)}
        currentStepIndex={tourStepIndex}
        onStepChange={setTourStepIndex}
        onNavigateTab={(tab, subTab) => {
          demo.setPlatformTab(tab)
          if (subTab) demo.setDoctorSubTab(subTab)
        }}
      />

      {/* Fullscreen Expanded View Dialog */}
      <DemoFullScreenModal
        isOpen={isFullScreen}
        onClose={() => setIsFullScreen(false)}
        onReset={demo.resetDemo}
        onStartTour={() => {
          setIsFullScreen(false)
          handleStartTour()
        }}
      >
        <DemoBrowserFrame
          isFullScreen
          onReset={demo.resetDemo}
          onToggleFullScreen={() => setIsFullScreen(false)}
        >
          {demoContent}
        </DemoBrowserFrame>
      </DemoFullScreenModal>
    </section>
  )
}
