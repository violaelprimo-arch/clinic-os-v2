'use client'

import React from 'react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import {
  ShieldCheck,
  Calendar,
  Clock,
  User,
  Pill,
  FileText,
  Stethoscope,
  MapPin,
  Phone,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Award
} from 'lucide-react'
import { useLanguage } from '@/context/LanguageContext'

export interface A4PrescriptionProps {
  clinic: any
  patientName: string
  age?: string | number
  date: string
  diagnosis?: string
  drugs: Array<{
    name: string
    dosage?: string
    duration?: string
    notes?: string
  }>
  instructions?: string
  templateMode?: 'standard' | 'custom'
  topOffset?: number
  primaryColor?: string
  secondaryColor?: string
  branchName?: string
  prescriptionNumber?: string
  pageSize?: 'a4' | 'a5'
  showHeaderFooter?: boolean
  printBackground?: boolean
}

export function A4Prescription({
  clinic,
  patientName,
  age,
  date,
  diagnosis,
  drugs = [],
  instructions,
  templateMode = 'standard',
  topOffset = 25,
  primaryColor,
  secondaryColor,
  branchName,
  prescriptionNumber,
  pageSize = 'a4',
  showHeaderFooter = true,
  printBackground = true
}: A4PrescriptionProps) {
  const { t, tDynamic, language, isRtl } = useLanguage()
  const safeOffset = typeof topOffset === 'number' && topOffset <= 60 && topOffset >= 0 ? topOffset : 25
  const pColor = primaryColor || clinic?.primaryColor || '#061A38'
  const sColor = secondaryColor || clinic?.secondaryColor || '#087CF4'
  const isA5 = pageSize === 'a5'

  const doctorName = clinic?.doctorName || (isRtl ? 'أحمد عبد العزيز' : 'Ahmed Abdel Aziz')
  const doctorTitle = clinic?.doctorTitle || (isRtl ? 'د.' : 'Dr.')
  const specialty = tDynamic(clinic?.specialty) || (isRtl ? 'استشاري العيادة الطبية' : 'Consultant Physician')
  const degree = clinic?.certificationTitle || (isRtl ? 'عضو الجمعية الطبية المصرية' : 'Member of Egyptian Medical Association')
  const syndicate = clinic?.certificationEntity || (isRtl ? 'نقابة الأطباء' : 'Physicians Syndicate')

  const validDrugs = (drugs || []).filter((d: any) => d.name && d.name.trim())

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @import url('https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap');

        #patient-a4-print-sheet,
        #patient-a4-print-sheet * {
          font-family: 'Cairo', var(--font-cairo), -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif !important;
          letter-spacing: 0px !important;
          word-spacing: 0px !important;
          font-feature-settings: "liga" 1, "calt" 1, "dlig" 1 !important;
          font-variant-ligatures: normal !important;
          text-rendering: geometricPrecision !important;
          -webkit-font-smoothing: antialiased !important;
        }

        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          @page {
            size: ${isA5 ? 'A5' : 'A4'} portrait;
            margin: 0 !important;
          }
          html, body {
            margin: 0 !important;
            padding: 0 !important;
            background: #ffffff !important;
            width: ${isA5 ? '148mm' : '210mm'} !important;
            height: ${isA5 ? '210mm' : '297mm'} !important;
          }
          #patient-a4-print-sheet {
            width: ${isA5 ? '148mm' : '210mm'} !important;
            min-height: ${isA5 ? '210mm' : '297mm'} !important;
            max-height: ${isA5 ? '210mm' : '297mm'} !important;
            box-sizing: border-box !important;
            padding-top: ${
              templateMode === 'custom'
                ? `${safeOffset}%`
                : showHeaderFooter
                ? isA5 ? '10mm' : '14mm'
                : '10mm'
            } !important;
            padding-left: ${isA5 ? '10mm' : '14mm'} !important;
            padding-right: ${isA5 ? '10mm' : '14mm'} !important;
            padding-bottom: ${showHeaderFooter ? (isA5 ? '8mm' : '12mm') : '8mm'} !important;
            max-width: none !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            background-color: #ffffff !important;
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            page-break-after: avoid !important;
            break-after: avoid !important;
            ${templateMode === 'custom' && !printBackground ? 'background-image: none !important;' : ''}
          }
          ${!showHeaderFooter ? '.rx-header, .rx-footer { display: none !important; }' : ''}
        }
      `
        }}
      />

      <div
        id="patient-a4-print-sheet"
        className={`w-full bg-white relative mx-auto flex flex-col justify-between overflow-hidden shadow-2xl border border-slate-200 aspect-[1/1.414] ${
          isA5 ? 'max-w-[560px] text-[11px] p-6' : 'max-w-[800px] text-xs p-8 sm:p-10'
        } ${language === 'en' ? 'text-left' : 'text-right'} font-sans transition-all`}
        style={{
          ...(templateMode === 'custom' && clinic?.prescriptionTemplateUrl && printBackground
            ? {
                backgroundImage: `url("${clinic.prescriptionTemplateUrl}")`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'top center',
                backgroundRepeat: 'no-repeat',
                paddingTop: `${safeOffset}%`
              }
            : {})
        }}
        dir={language === 'en' ? 'ltr' : 'rtl'}
      >
        {/* Luxury Vector Corner Brackets (Standard Mode) */}
        {showHeaderFooter && templateMode === 'standard' && (
          <>
            <svg className="absolute top-2.5 right-2.5 w-4 h-4 pointer-events-none opacity-40" viewBox="0 0 20 20" fill="none" style={{ color: sColor }}>
              <path d="M18 2h-8M18 2v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <svg className="absolute top-2.5 left-2.5 w-4 h-4 pointer-events-none opacity-40" viewBox="0 0 20 20" fill="none" style={{ color: sColor }}>
              <path d="M2 2h8M2 2v8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <svg className="absolute bottom-2.5 right-2.5 w-4 h-4 pointer-events-none opacity-40" viewBox="0 0 20 20" fill="none" style={{ color: sColor }}>
              <path d="M18 18h-8M18 18v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
            <svg className="absolute bottom-2.5 left-2.5 w-4 h-4 pointer-events-none opacity-40" viewBox="0 0 20 20" fill="none" style={{ color: sColor }}>
              <path d="M2 18h8M2 18v-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </>
        )}

        {/* Main Content Container */}
        <div className="flex-1 flex flex-col relative z-10">
          
          {/* =========================================================================
              1. HEADER (Clean Medical Luxury Letterhead)
             ========================================================================= */}
          {showHeaderFooter && (templateMode === 'standard' || !clinic?.prescriptionTemplateUrl || !printBackground) && (
            <div className="rx-header mb-3">
              <div className="flex items-start justify-between gap-4 pb-3">
                {/* Doctor Arabic Details */}
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h1 className={`${isA5 ? 'text-lg sm:text-xl' : 'text-2xl sm:text-3xl'} font-black text-slate-900`}>
                      {doctorTitle} {doctorName}
                    </h1>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`${isA5 ? 'text-xs' : 'text-sm'} font-extrabold`}
                      style={{ color: sColor }}
                    >
                      {specialty}
                    </span>
                  </div>
                  <div className={`flex items-center gap-1.5 ${isA5 ? 'text-[9.5px]' : 'text-[11px]'} text-slate-500 font-semibold`}>
                    <Award className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{degree}</span>
                    <span>•</span>
                    <span>{syndicate}</span>
                  </div>
                </div>

                {/* Clinic Logo & Brand Identity */}
                <div className="text-left flex flex-col items-end shrink-0" dir="ltr">
                  <img
                    src={clinic?.logoUrl || '/brand/yalla-clinic/logo-light-bg.png'}
                    alt={clinic?.clinicName || 'Yalla Clinic'}
                    crossOrigin="anonymous"
                    className={`${isA5 ? 'h-8 sm:h-9' : 'h-10 sm:h-11'} w-auto max-w-[170px] object-contain mb-1`}
                  />
                  <span className={`${isA5 ? 'text-[10px]' : 'text-xs'} font-black text-slate-800 mt-0.5`} dir="rtl">
                    {clinic?.clinicName || 'Yalla Clinic'}
                  </span>
                  {branchName && (
                    <span className="inline-flex items-center gap-1 text-[9.5px] font-bold text-slate-500 mt-0.5 bg-slate-100/80 px-2 py-0.5 rounded-md border border-slate-200/60" dir="rtl">
                      <MapPin className="w-2.5 h-2.5 text-primary" />
                      <span>فرع: {tDynamic(branchName)}</span>
                    </span>
                  )}
                </div>
              </div>

              {/* Vector Double Accent Divider Line */}
              <div className="relative flex items-center justify-center my-1">
                <div className="w-full h-[2.5px] rounded-full" style={{ backgroundColor: sColor }} />
                <div
                  className="absolute w-3 h-3 rotate-45 border-2 bg-white"
                  style={{ borderColor: sColor }}
                />
              </div>
            </div>
          )}

          {/* =========================================================================
              2. PATIENT METADATA STRIP (Vector Structured Grid)
             ========================================================================= */}
          <div
            className={`mb-3.5 rounded-xl border transition-all ${
              templateMode === 'custom' && !showHeaderFooter
                ? 'bg-transparent border-transparent'
                : 'bg-slate-50/90 border-slate-200/80 shadow-xs'
            }`}
          >
            <div className={`grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-2.5 ${isA5 ? 'text-[10px]' : 'text-xs'}`}>
              {/* Patient Name */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-blue-100/70 text-blue-700 flex items-center justify-center shrink-0">
                  <User className="w-3.5 h-3.5" />
                </div>
                <div className="overflow-hidden">
                  <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
                    {language === 'en' ? 'Patient:' : 'المريض:'}
                  </span>
                  <strong className="text-slate-900 font-black block text-[11px] sm:text-xs leading-normal">
                    {patientName || (language === 'en' ? 'Patient' : 'المريض')}
                  </strong>
                </div>
              </div>

              {/* Age */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-emerald-100/70 text-emerald-700 flex items-center justify-center shrink-0">
                  <Calendar className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
                    {language === 'en' ? 'Age:' : 'السن:'}
                  </span>
                  <strong className="text-slate-900 font-black text-[11px] sm:text-xs">
                    {age ? `${age} ${language === 'en' ? 'yrs' : 'سنة'}` : '—'}
                  </strong>
                </div>
              </div>

              {/* Date */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-purple-100/70 text-purple-700 flex items-center justify-center shrink-0">
                  <Clock className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
                    {language === 'en' ? 'Date:' : 'التاريخ:'}
                  </span>
                  <strong className="text-slate-900 font-mono text-[11px] sm:text-xs" dir="ltr">
                    {date}
                  </strong>
                </div>
              </div>

              {/* Rx Number */}
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-lg bg-amber-100/70 text-amber-700 flex items-center justify-center shrink-0">
                  <FileText className="w-3.5 h-3.5" />
                </div>
                <div>
                  <span className="text-[10px] text-slate-400 font-semibold block leading-tight">
                    {language === 'en' ? 'Rx #:' : 'رقم الروشتة:'}
                  </span>
                  <strong className="text-slate-900 font-mono text-[11px] sm:text-xs" dir="ltr">
                    #{prescriptionNumber || '1042'}
                  </strong>
                </div>
              </div>
            </div>

            {/* Diagnosis (if present) */}
            {diagnosis && (
              <div className="border-t border-slate-200/80 px-3 py-1.5 flex items-center gap-2 bg-blue-50/50 rounded-b-xl">
                <Stethoscope className="w-3.5 h-3.5 text-primary shrink-0" />
                <span className="text-[10.5px] font-bold text-primary">
                  {language === 'en' ? 'Clinical Diagnosis:' : 'التشخيص الطبي:'}
                </span>
                <span className="text-[11px] font-extrabold text-slate-900">
                  {diagnosis}
                </span>
              </div>
            )}
          </div>

          {/* =========================================================================
              3. RX SECTION (Classical Vector Rx Symbol & Structured Medicine Cards)
             ========================================================================= */}
          <div className="flex items-center justify-between pb-1 pt-0.5 select-none" dir="ltr">
            <div className="flex items-baseline gap-2">
              <span
                className={`${isA5 ? 'text-3xl' : 'text-4xl'} font-black font-serif tracking-wider`}
                style={{ color: sColor }}
              >
                ℞
              </span>
              <span className="text-[10px] font-black tracking-widest text-slate-400 uppercase">
                Prescription
              </span>
            </div>
            <div className="flex-1 border-b border-dashed border-slate-200 mx-4" />
          </div>

          {/* Medicines List Container */}
          <div className="flex-1 space-y-2.5 pt-1">
            {validDrugs.length === 0 ? (
              <div className="py-12 text-center text-slate-400 border border-dashed border-slate-200 rounded-xl">
                <Pill className="w-8 h-8 mx-auto mb-2 opacity-30 text-slate-400" />
                <p className="text-xs font-bold">{language === 'en' ? 'No medicines listed yet' : 'لم يتم تسجيل أدوية بالروشتة بعد'}</p>
              </div>
            ) : (
              validDrugs.map((drug: any, index: number) => (
                <div
                  key={index}
                  className="flex items-start gap-3 p-2.5 sm:p-3 rounded-xl bg-slate-50/70 border border-slate-200/70 hover:border-slate-300 transition-all"
                  dir="ltr"
                >
                  {/* Number Badge */}
                  <div
                    className="w-6 h-6 rounded-lg text-white font-black text-xs flex items-center justify-center shrink-0 shadow-xs mt-0.5"
                    style={{ backgroundColor: sColor }}
                  >
                    {index + 1}
                  </div>

                  {/* Drug Title and Dosage Block (Unified left-to-right alignment!) */}
                  <div className="flex-1 min-w-0 space-y-1 text-left">
                    {/* Drug Commercial Name in Bold Latin */}
                    <div className="flex items-center gap-2">
                      <h3 className={`${isA5 ? 'text-xs sm:text-sm' : 'text-sm sm:text-base'} font-black text-slate-900`}>
                        {drug.name}
                      </h3>
                    </div>

                    {/* Dosage, Duration, and Notes Badges (Kept strictly with the drug!) */}
                    {(drug.dosage || drug.duration || drug.notes) && (
                      <div className="flex flex-wrap items-center gap-1.5 pt-0.5" dir={isRtl ? 'rtl' : 'ltr'}>
                        {drug.dosage && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-blue-100/70 text-blue-800 font-bold border border-blue-200 text-[10.5px]">
                            <Clock className="w-3 h-3 text-blue-600 shrink-0" />
                            <span>{drug.dosage}</span>
                          </span>
                        )}
                        {drug.duration && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-emerald-100/70 text-emerald-800 font-bold border border-emerald-200 text-[10.5px]">
                            <Calendar className="w-3 h-3 text-emerald-600 shrink-0" />
                            <span>{drug.duration}</span>
                          </span>
                        )}
                        {drug.notes && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-md bg-amber-100/70 text-amber-800 font-semibold border border-amber-200 text-[10.5px] italic">
                            <span>({drug.notes})</span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}

            {/* Subtle Ruled Guideline Lines (Pad Aesthetic for Balance) */}
            {validDrugs.length > 0 && validDrugs.length < 4 && (
              <div className="space-y-4 pt-3 pointer-events-none opacity-40">
                <div className="w-full border-b border-dashed border-slate-200" />
                <div className="w-full border-b border-dashed border-slate-200" />
              </div>
            )}
          </div>

          {/* =========================================================================
              4. CLINICAL INSTRUCTIONS BOX
             ========================================================================= */}
          {instructions && (
            <div className={`mt-3 p-3 bg-amber-50/70 rounded-xl border border-amber-200/80 ${isA5 ? 'text-[10px]' : 'text-xs'} leading-relaxed`}>
              <div className="flex items-center gap-1.5 font-black text-amber-900 mb-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>{language === 'en' ? 'Important Clinical Instructions:' : 'إرشادات وتعليمات الطبيب للمريض:'}</span>
              </div>
              <p className="text-amber-950 font-medium whitespace-pre-wrap">{instructions}</p>
            </div>
          )}
        </div>

        {/* =========================================================================
            5. FOOTER & OFFICIAL DOCTOR STAMP (Vector Official Seal & Certification)
           ========================================================================= */}
        {showHeaderFooter && (templateMode === 'standard' || !clinic?.prescriptionTemplateUrl || !printBackground) && (
          <div className="rx-footer mt-4 pt-3 border-t-2 relative z-10" style={{ borderColor: sColor }}>
            <div className="flex items-end justify-between gap-4">
              
              {/* Doctor Signature */}
              <div className="flex items-center gap-3">
                <div className="text-center">
                  <div
                    className={`${isA5 ? 'w-28' : 'w-36'} border-b-2 border-slate-400 pb-1 text-slate-800 ${isA5 ? 'text-xs' : 'text-sm'} font-bold leading-normal`}
                  >
                    {doctorTitle} {doctorName}
                  </div>
                  <span className="text-[9px] text-slate-400 font-bold block mt-1">
                    {language === 'en' ? "Doctor's Signature" : 'توقيع الطبيب'}
                  </span>
                </div>
              </div>

              {/* Digital Verification Seal & QR Placeholder */}
              <div className="hidden sm:flex flex-col items-center justify-center p-2 rounded-xl bg-slate-50 border border-slate-200 text-center">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-emerald-700">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  <span>{language === 'en' ? 'Certified E-Prescription' : 'روشتة موثقة إلكترونياً'}</span>
                </div>
                <span className="text-[8.5px] font-mono text-slate-400 mt-0.5">
                  ID: RX-{prescriptionNumber || '1042'}-{date.replace(/-/g, '')}
                </span>
              </div>

              {/* Clinic Address & Contacts */}
              <div className={`${language === 'en' ? 'text-left' : 'text-right'} space-y-0.5 text-[9.5px] text-slate-600 max-w-[220px]`}>
                <p className="flex items-center gap-1 font-semibold leading-normal">
                  <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{clinic?.clinicAddress || (language === 'en' ? 'Registered at clinic' : 'العنوان: مسجل بالعيادة')}</span>
                </p>
                <p className="flex items-center gap-1 font-semibold" dir="ltr">
                  <Phone className="w-3 h-3 text-slate-400 shrink-0" />
                  <span>{clinic?.clinicPhone || clinic?.phones?.[0] || '16XXX'}</span>
                </p>
                <p className="text-[8.5px] text-slate-400 pt-0.5 font-medium">
                  {language === 'en' ? 'Yalla Clinic • Intelligent Clinic System' : 'نظام تشغيل العيادات الذكي • Yalla Clinic'}
                </p>
              </div>

            </div>
          </div>
        )}

      </div>
    </>
  )
}
