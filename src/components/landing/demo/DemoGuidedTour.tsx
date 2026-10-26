'use client'

import React, { useEffect, useCallback } from 'react'
import {
  Sparkles,
  ChevronRight,
  ChevronLeft,
  X,
  Check,
  ArrowRight,
  ArrowLeft,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { TourStep, DemoPlatformTab, DemoDoctorSubTab } from './types'
import { useLanguage } from '@/context/LanguageContext'

interface DemoGuidedTourProps {
  isOpen: boolean
  onClose: () => void
  currentStepIndex: number
  onStepChange: (index: number) => void
  onNavigateTab: (tab: DemoPlatformTab, subTab?: DemoDoctorSubTab) => void
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: 'kpi-summary',
    title: 'نظرة عامة على لوحة الطبيب وحجوزات اليوم',
    titleEn: "Doctor Workspace & Today's Summary",
    description:
      'شاهد إجمالي حجوزات اليوم، والمرضى المنتظرين، والمريض الجاري فحصه، وإجمالي التحصيل المالي المباشر في مكان واحد.',
    descriptionEn:
      "Monitor today's total bookings, waiting queue, active examination room, and live revenue at a single glance.",
    targetTab: 'doctor',
    targetSubTab: 'dashboard',
  },
  {
    id: 'active-exam',
    title: 'إدارة الدور المباشر وغرفة الكشف',
    titleEn: 'Live Queue & Active Consultation',
    description:
      'تابع المريض في غرفة الكشف مع مؤقت زمني دقيق، وأنهِ الكشف أو استدعِ المريض التالي بضغطة زر واحدة دون تأخير.',
    descriptionEn:
      'Follow the patient in the examination room with real-time consultation timer, finish the visit, or call next patient instantly.',
    targetTab: 'doctor',
    targetSubTab: 'dashboard',
  },
  {
    id: 'patient-records',
    title: 'سجل المرضى والملف الطبي الشامل',
    titleEn: 'Patient Records & Full Medical History',
    description:
      'ابحث في سجل المرضى وافتح الملف الطبي الشامل للاطلاع على الزيارات السابقة، والتشخيصات، والروشتات السابقة، والحساسية الدوائية.',
    descriptionEn:
      'Search patient records and open complete medical files to view previous visits, diagnoses, past prescriptions, and drug allergies.',
    targetTab: 'doctor',
    targetSubTab: 'patients',
  },
  {
    id: 'smart-rx',
    title: 'الروشتة الإلكترونية الذكية ومعاينة A4',
    titleEn: 'Smart Digital Prescription & A4 Preview',
    description:
      'اكتب التشخيص واختر الأدوية والجرعات من دليل الأدوية، مع معاينة حية لقالب الروشتة الرسمي وإمكانية طباعتها فورًا أو تحميل PDF تجريبي.',
    descriptionEn:
      'Enter diagnosis and medications with live A4 preview, then print or download a demo PDF with a single click.',
    targetTab: 'doctor',
    targetSubTab: 'prescriptions',
  },
  {
    id: 'finance-reports',
    title: 'التقارير المالية والتحليلات اللحظية',
    titleEn: 'Live Financial Reports & Analytics',
    description:
      'تابع الإيرادات النقدية والمحافظ الإلكترونية، وتوزيع الدخل حسب نوع الكشف وساعات الذروة. تتحدث الأرقام تلقائيًا مع كل إجراء كشف!',
    descriptionEn:
      'Monitor cash and electronic revenue, service performance, and peak hours. All numbers update dynamically with clinic actions!',
    targetTab: 'doctor',
    targetSubTab: 'reports',
  },
  {
    id: 'patient-booking',
    title: 'بوابة المريض وحجز الدور ذاتياً',
    titleEn: 'Patient Self-Service Booking & Turn Tracker',
    description:
      'جرّب تجربة المريض: اختر الخدمة وسجل بياناتك فورًا لتستلم رقم دورك وتشاهد تتبع الانتظار المباشر، ثم انتقل لمنصة الطبيب لتجد حجزك قد ظهر!',
    descriptionEn:
      'Experience patient booking: pick a service, confirm your ticket, and track live queue progress — then check the doctor queue to see it live!',
    targetTab: 'patient',
  },
]

export function DemoGuidedTour({
  isOpen,
  onClose,
  currentStepIndex,
  onStepChange,
  onNavigateTab,
}: DemoGuidedTourProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  const currentStep = TOUR_STEPS[currentStepIndex] || TOUR_STEPS[0]
  const isFirst = currentStepIndex === 0
  const isLast = currentStepIndex === TOUR_STEPS.length - 1

  // Handle navigation
  const goToStep = useCallback(
    (index: number) => {
      if (index < 0 || index >= TOUR_STEPS.length) return
      onStepChange(index)
      const target = TOUR_STEPS[index]
      onNavigateTab(target.targetTab, target.targetSubTab)
    },
    [onNavigateTab, onStepChange],
  )

  const handleNext = () => {
    if (isLast) {
      onClose()
    } else {
      goToStep(currentStepIndex + 1)
    }
  }

  const handlePrev = () => {
    if (!isFirst) {
      goToStep(currentStepIndex - 1)
    }
  }

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
      } else if (e.key === 'ArrowRight') {
        e.preventDefault()
        if (isRtl) handlePrev()
        else handleNext()
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault()
        if (isRtl) handleNext()
        else handlePrev()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, isRtl, isFirst, isLast, currentStepIndex])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center p-4 sm:items-center sm:p-6 pointer-events-none">
      {/* Semi-transparent backdrop */}
      <div
        className="fixed inset-0 bg-background/60 backdrop-blur-xs transition-opacity pointer-events-auto"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Floating Tour Modal Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={copy('جولة إرشادية في المنصة', 'Product Guided Tour')}
        className="pointer-events-auto relative w-full max-w-lg rounded-3xl border-2 border-primary/50 bg-card p-6 shadow-2xl shadow-primary/20 transition-all duration-300 animate-in fade-in zoom-in-95"
      >
        {/* Top Badges & Close Button */}
        <div className="flex items-center justify-between gap-3 border-b border-border/80 pb-3">
          <div className="flex items-center gap-2">
            <span className="grid size-7 place-items-center rounded-xl bg-primary/10 text-primary">
              <Sparkles className="size-4" />
            </span>
            <span className="font-mono text-xs font-black text-primary">
              {copy(
                `خطوة ${currentStepIndex + 1} من ${TOUR_STEPS.length}`,
                `Step ${currentStepIndex + 1} of ${TOUR_STEPS.length}`,
              )}
            </span>
          </div>

          <button
            type="button"
            onClick={onClose}
            aria-label={copy('إغلاق الجولة', 'Close tour')}
            className="grid size-8 place-items-center rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="mt-4 space-y-2">
          <h3 className="text-lg font-black text-foreground">
            {!isRtl && currentStep.titleEn ? currentStep.titleEn : currentStep.title}
          </h3>
          <p className="text-xs sm:text-sm leading-6 text-muted-foreground">
            {!isRtl && currentStep.descriptionEn
              ? currentStep.descriptionEn
              : currentStep.description}
          </p>
        </div>

        {/* Step Progress Dots */}
        <div className="mt-5 flex items-center justify-center gap-1.5" aria-hidden="true">
          {TOUR_STEPS.map((step, i) => (
            <button
              key={step.id}
              type="button"
              onClick={() => goToStep(i)}
              className={`h-1.5 rounded-full transition-all ${
                currentStepIndex === i
                  ? 'w-6 bg-primary'
                  : 'w-1.5 bg-muted-foreground/30 hover:bg-muted-foreground/60'
              }`}
            />
          ))}
        </div>

        {/* Footer Navigation Buttons */}
        <div className="mt-6 flex items-center justify-between gap-3 pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="text-xs text-muted-foreground hover:text-foreground"
          >
            {copy('تخطي الجولة', 'Skip Tour')}
          </Button>

          <div className="flex items-center gap-2">
            {!isFirst && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handlePrev}
                className="gap-1.5 rounded-xl text-xs font-bold"
              >
                {isRtl ? <ChevronRight className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
                {copy('السابق', 'Previous')}
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleNext}
              className="gap-1.5 rounded-xl bg-primary text-xs font-bold text-primary-foreground shadow-sm shadow-primary/20"
            >
              <span>{isLast ? copy('إنهاء واستكشاف حر', 'Finish Tour') : copy('التالي', 'Next')}</span>
              {isLast ? (
                <Check className="size-3.5" />
              ) : isRtl ? (
                <ChevronLeft className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
