'use client'

import React, { useState } from 'react'
import {
  ShieldCheck, AlertTriangle, Eye, ArrowUpRight,
  ExternalLink, User, Calendar, MapPin, Stethoscope, Clock, CreditCard
} from 'lucide-react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { DataCompletenessReport } from '@/lib/analyticsService'

export interface IncompletePatientItem {
  id: string
  name: string
  phone: string
  missingFields: string[]
}

export interface IncompleteVisitItem {
  id: string
  patientName: string
  date: string
  missingFields: string[]
}

export interface DataCompletenessCardProps {
  report: DataCompletenessReport
  incompletePatients?: IncompletePatientItem[]
  incompleteVisits?: IncompleteVisitItem[]
  slug: string
  isRtl?: boolean
  language?: string
}

export function DataCompletenessCard({
  report,
  incompletePatients = [],
  incompleteVisits = [],
  slug,
  isRtl = true,
  language = 'ar'
}: DataCompletenessCardProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [modalTab, setModalTab] = useState<'patients' | 'visits'>('patients')

  const {
    overallPercentage,
    agePercentage,
    regionPercentage,
    diagnosisPercentage,
    timingPercentage,
    paymentPercentage,
    incompletePatientsCount,
    incompleteVisitsCount
  } = report

  const metrics = [
    { labelAr: 'أعمار وتواريخ ميلاد المرضى', labelEn: 'Patient Ages', pct: agePercentage, icon: User },
    { labelAr: 'المناطق السكنية والمحافظات', labelEn: 'Geographic Regions', pct: regionPercentage, icon: MapPin },
    { labelAr: 'التشخيص الطبي بالكشف والروشتة', labelEn: 'Clinical Diagnoses', pct: diagnosisPercentage, icon: Stethoscope },
    { labelAr: 'توقيتات الحضور والبدء والانتهاء', labelEn: 'Visit Timings', pct: timingPercentage, icon: Clock },
    { labelAr: 'بيانات ووسائل وسندات الدفع', labelEn: 'Payment Records', pct: paymentPercentage, icon: CreditCard }
  ]

  return (
    <>
      <div className="ios-glass-card p-6 rounded-3xl border border-border/80 shadow-sm space-y-5">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/80">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                <span>{language === 'en' ? 'Data Quality & Completeness Audit' : 'مؤشر جودة واكتمال السجلات الطبية'}</span>
                <span className={`text-[11px] font-black font-mono px-2 py-0.5 rounded-full ${
                  overallPercentage >= 80
                    ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400'
                    : 'bg-amber-500/15 text-amber-700 dark:text-amber-400'
                }`}>
                  {overallPercentage}%
                </span>
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {language === 'en'
                  ? 'Audit of essential clinical, demographic, and operational data fields'
                  : 'تدقيق اكتمال الحقول الأساسية لضمان دقة التقارير وسلامة المتابعة'}
              </p>
            </div>
          </div>

          {/* Action to View Incomplete Records */}
          <Button
            size="sm"
            onClick={() => setIsModalOpen(true)}
            className="rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border/80 cursor-pointer h-9 px-3.5"
          >
            <Eye className="w-3.5 h-3.5 text-primary me-1" />
            <span>{language === 'en' ? 'Review Incomplete Records' : 'استعراض السجلات الناقصة'}</span>
          </Button>
        </div>

        {/* 5 Progress Bars Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {metrics.map((m, idx) => {
            const Icon = m.icon
            const isGood = m.pct >= 80
            return (
              <div key={idx} className="p-3.5 rounded-2xl bg-card border border-border/70 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <Icon className="w-3.5 h-3.5 text-primary" />
                    <span className="text-[11px] font-bold text-foreground truncate">
                      {language === 'en' ? m.labelEn : m.labelAr}
                    </span>
                  </div>
                  <span className={`text-xs font-black font-mono ${isGood ? 'text-emerald-600' : 'text-amber-600'}`}>
                    {m.pct}%
                  </span>
                </div>

                {/* Progress bar */}
                <div className="w-full h-2 rounded-full bg-secondary overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isGood ? 'bg-emerald-500' : 'bg-amber-500'
                    }`}
                    style={{ width: `${m.pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>

        {/* Source of Referral Note */}
        <div className="pt-2 border-t border-border/60 text-[10px] text-muted-foreground flex flex-wrap items-center justify-between gap-2">
          <span>
            💡 <strong>مصدر معرفة المريض بالعيادة:</strong> يتم تسجيله كحقل اختياري عند إنشاء الملف دون نسب المرضى القدامى إلى أي مصدر بالتخمين.
          </span>
          <span className="font-bold text-foreground">
            {incompletePatientsCount > 0
              ? `يوجد ${incompletePatientsCount} ملف مريض يحتاج استكمال بيانات`
              : 'جميع ملفات المرضى مستوفاة البيانات ✓'}
          </span>
        </div>
      </div>

      {/* Incomplete Records Review Dialog */}
      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto p-6 rounded-3xl" dir={isRtl ? 'rtl' : 'ltr'}>
          <DialogHeader className="text-start pb-3 border-b border-border/80">
            <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-amber-500" />
              <span>قائمة السجلات الطبية والبيانات الناقصة</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              يمكنك فتح ملف أي مريض واستكمال بياناته مباشرة دون أي تعديل تلقائي على قيمه الحالية.
            </DialogDescription>

            {/* Tab switch */}
            <div className="inline-flex rounded-xl p-0.5 bg-secondary/80 border border-border mt-3 w-fit">
              <button
                type="button"
                onClick={() => setModalTab('patients')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  modalTab === 'patients'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                ملفات المرضى ({incompletePatients.length})
              </button>
              <button
                type="button"
                onClick={() => setModalTab('visits')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  modalTab === 'visits'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                زيارات بحاجة لتوثيق ({incompleteVisits.length})
              </button>
            </div>
          </DialogHeader>

          {/* List content */}
          <div className="space-y-2 pt-2">
            {modalTab === 'patients' ? (
              incompletePatients.length === 0 ? (
                <div className="p-8 text-center text-xs text-emerald-600 font-bold">
                  جميع ملفات المرضى مستوفاة الأعمار والمناطق بنسبة 100%!
                </div>
              ) : (
                incompletePatients.slice(0, 25).map((p) => (
                  <div
                    key={p.id}
                    className="p-3 rounded-2xl border border-border bg-card flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-black text-foreground block">{p.name || 'بدون اسم'}</span>
                      <span className="text-[11px] text-muted-foreground font-mono font-bold block">{p.phone}</span>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {p.missingFields.map((f, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold"
                          >
                            ينقص: {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <a
                      href={`/clinic/${slug}/admin/patients?search=${encodeURIComponent(p.phone)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 shrink-0"
                    >
                      <span>فتح الملف</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))
              )
            ) : (
              incompleteVisits.length === 0 ? (
                <div className="p-8 text-center text-xs text-emerald-600 font-bold">
                  جميع كشوفات وزيارات الفترة موثقة بالكامل بنسبة 100%!
                </div>
              ) : (
                incompleteVisits.slice(0, 25).map((v) => (
                  <div
                    key={v.id}
                    className="p-3 rounded-2xl border border-border bg-card flex items-center justify-between gap-3 text-xs"
                  >
                    <div>
                      <span className="font-black text-foreground block">{v.patientName}</span>
                      <span className="text-[11px] text-muted-foreground font-mono font-bold block">التاريخ: {v.date}</span>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        {v.missingFields.map((f, i) => (
                          <span
                            key={i}
                            className="text-[9px] px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold"
                          >
                            ينقص: {f}
                          </span>
                        ))}
                      </div>
                    </div>

                    <a
                      href={`/clinic/${slug}/admin`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-secondary hover:bg-secondary/80 text-foreground border border-border/80 shrink-0"
                    >
                      <span>عرض الكشف</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                ))
              )
            )}
          </div>

          <div className="flex justify-end pt-3 border-t border-border/80">
            <Button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="rounded-xl text-xs font-bold bg-secondary text-foreground"
            >
              إغلاق
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
