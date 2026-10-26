'use client'

import React from 'react'
import {
  Stethoscope,
  UserCheck,
  LayoutDashboard,
  Users,
  FileSignature,
  TrendingUp,
  Clock,
  Sparkles,
} from 'lucide-react'
import { DemoPlatformTab, DemoDoctorSubTab } from './types'
import { useLanguage } from '@/context/LanguageContext'

interface DemoPlatformTabsProps {
  platformTab: DemoPlatformTab
  onSelectPlatformTab: (tab: DemoPlatformTab) => void
  doctorSubTab: DemoDoctorSubTab
  onSelectDoctorSubTab: (tab: DemoDoctorSubTab) => void
  waitingCount: number
  inExamCount: number
}

export function DemoPlatformTabs({
  platformTab,
  onSelectPlatformTab,
  doctorSubTab,
  onSelectDoctorSubTab,
  waitingCount,
  inExamCount,
}: DemoPlatformTabsProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  return (
    <div className="border-b border-border/80 bg-muted/30">
      {/* Top Main Switcher: Doctor vs Patient */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6">
        <div className="inline-flex rounded-2xl border border-border/80 bg-background/80 p-1 shadow-sm">
          <button
            type="button"
            id="tab-doctor-platform"
            onClick={() => onSelectPlatformTab('doctor')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-200 ${
              platformTab === 'doctor'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Stethoscope className="size-4" />
            <span>{copy('منصة الطبيب والاستقبال', 'Doctor & Reception')}</span>
            {waitingCount > 0 && (
              <span
                className={`grid size-5 place-items-center rounded-full text-[10px] font-black ${
                  platformTab === 'doctor'
                    ? 'bg-primary-foreground text-primary'
                    : 'bg-primary/10 text-primary'
                }`}
              >
                {waitingCount}
              </span>
            )}
          </button>

          <button
            type="button"
            id="tab-patient-portal"
            onClick={() => onSelectPlatformTab('patient')}
            className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-xs sm:text-sm font-bold transition-all duration-200 ${
              platformTab === 'patient'
                ? 'bg-primary text-primary-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <UserCheck className="size-4" />
            <span>{copy('بوابة المريض (الحجز ومتابعة الدور)', 'Patient Portal')}</span>
            <span
              className={`rounded-md px-1.5 py-0.5 text-[10px] font-bold ${
                platformTab === 'patient'
                  ? 'bg-primary-foreground/20 text-primary-foreground'
                  : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
              }`}
            >
              {copy('حجز فوري', 'Live Booking')}
            </span>
          </button>
        </div>

        {/* Status Callout */}
        <div className="hidden items-center gap-2 text-xs text-muted-foreground md:flex">
          <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>
            {platformTab === 'doctor'
              ? copy(
                  'الحالة متزامنة: أي حجز من بوابة المريض يظهر هنا فورًا',
                  'Synced state: New bookings appear here instantly',
                )
              : copy(
                  'جرّب الحجز وسيرتبط حجزك مباشرةً بدور الطبيب',
                  'Try booking to see your ticket in the queue',
                )}
          </span>
        </div>
      </div>

      {/* Secondary Navigation for Doctor Platform */}
      {platformTab === 'doctor' && (
        <div className="flex overflow-x-auto border-t border-border/60 bg-background/50 px-4 py-1.5 scrollbar-none sm:px-6">
          <div className="flex items-center gap-1.5 min-w-max">
            <button
              type="button"
              id="subtab-dashboard"
              onClick={() => onSelectDoctorSubTab('dashboard')}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                doctorSubTab === 'dashboard'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <LayoutDashboard className="size-3.5" />
              <span>{copy('لوحة الدور والحجوزات', 'Live Queue')}</span>
              {inExamCount > 0 && (
                <span className="size-2 rounded-full bg-emerald-500" title={copy('مريض في الكشف', 'In Exam')} />
              )}
            </button>

            <button
              type="button"
              id="subtab-patients"
              onClick={() => onSelectDoctorSubTab('patients')}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                doctorSubTab === 'patients'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <Users className="size-3.5" />
              <span>{copy('سجل المرضى', 'Patient Records')}</span>
            </button>

            <button
              type="button"
              id="subtab-prescriptions"
              onClick={() => onSelectDoctorSubTab('prescriptions')}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                doctorSubTab === 'prescriptions'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <FileSignature className="size-3.5" />
              <span>{copy('الروشتات والتشخيص', 'Prescriptions & Rx')}</span>
            </button>

            <button
              type="button"
              id="subtab-reports"
              onClick={() => onSelectDoctorSubTab('reports')}
              className={`inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-xs font-bold transition-all ${
                doctorSubTab === 'reports'
                  ? 'bg-primary/10 text-primary'
                  : 'text-muted-foreground hover:bg-muted hover:text-foreground'
              }`}
            >
              <TrendingUp className="size-3.5" />
              <span>{copy('المالية والتقارير', 'Finances & Reports')}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
