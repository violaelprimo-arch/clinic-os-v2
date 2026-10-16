'use client'

import React from 'react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { ShieldCheck, QrCode } from 'lucide-react'
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
  const { t, tDynamic, language } = useLanguage()
  const safeOffset = typeof topOffset === 'number' && topOffset <= 60 && topOffset >= 0 ? topOffset : 25
  const pColor = primaryColor || clinic?.primaryColor || '#061A38'
  const sColor = secondaryColor || clinic?.secondaryColor || '#087CF4'
  const isA5 = pageSize === 'a5'

  return (
    <>
      <style
        dangerouslySetInnerHTML={{
          __html: `
        @media print {
          * {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          @page {
            size: ${isA5 ? 'A5' : 'A4'} portrait;
            margin: 0;
          }
          #patient-a4-print-sheet {
            padding-top: ${
              templateMode === 'custom'
                ? `${safeOffset}%`
                : showHeaderFooter
                ? isA5 ? '18mm' : '26mm'
                : '15mm'
            } !important;
            padding-left: ${isA5 ? '12mm' : '18mm'} !important;
            padding-right: ${isA5 ? '12mm' : '18mm'} !important;
            padding-bottom: ${showHeaderFooter ? (isA5 ? '14mm' : '18mm') : '10mm'} !important;
            width: ${isA5 ? '148mm' : '210mm'} !important;
            height: ${isA5 ? '210mm' : '297mm'} !important;
            max-width: none !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
            background-color: #ffffff !important;
            ${templateMode === 'custom' && !printBackground ? 'background-image: none !important;' : ''}
          }
          ${!showHeaderFooter ? '.rx-header, .rx-footer { display: none !important; }' : ''}
        }
      `
        }}
      />

      <div
        id="patient-a4-print-sheet"
        className={`w-full bg-white relative mx-auto flex flex-col justify-between overflow-hidden shadow-2xl border border-[#E5EAF0] aspect-[1/1.414] ${
          isA5 ? 'max-w-[560px] text-[11px]' : 'max-w-[800px] text-xs'
        } ${language === 'en' ? 'text-left' : 'text-right'} font-sans transition-all`}
        style={{
          ...(templateMode === 'custom' && clinic?.prescriptionTemplateUrl && printBackground
            ? {
                backgroundImage: `url("${clinic.prescriptionTemplateUrl}")`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'top center',
                backgroundRepeat: 'no-repeat',
                paddingTop: `${safeOffset}%`,
                paddingLeft: isA5 ? '1.5rem' : '2rem',
                paddingRight: isA5 ? '1.5rem' : '2rem',
                paddingBottom: isA5 ? '1.5rem' : '2rem'
              }
            : {
                paddingTop: showHeaderFooter ? (isA5 ? '1.75rem' : '2.5rem') : (isA5 ? '1.25rem' : '1.75rem'),
                paddingBottom: showHeaderFooter ? (isA5 ? '1.5rem' : '2.25rem') : (isA5 ? '1rem' : '1.5rem'),
                paddingLeft: isA5 ? '1.75rem' : '2.5rem',
                paddingRight: isA5 ? '1.75rem' : '2.5rem'
              })
        }}
        dir={language === 'en' ? 'ltr' : 'rtl'}
      >
        <div className="flex-1 flex flex-col">
          {/* Header (Rendered when showHeaderFooter is true, unless background template replaces it) */}
          {showHeaderFooter && (templateMode === 'standard' || !clinic?.prescriptionTemplateUrl || !printBackground) && (
            <div
              className="rx-header flex items-start justify-between pb-4 mb-4 border-b-2"
              style={{ borderColor: sColor }}
            >
              <div className="space-y-0.5">
                <h2 className={`${isA5 ? 'text-lg' : 'text-2xl'} font-black text-[#182230]`}>
                  {clinic?.doctorName ? (language === 'en' ? `Dr. ${clinic.doctorName}` : `د. ${clinic.doctorName}`) : (language === 'en' ? 'Dr. Attending Physician' : 'د. الطبيب المعالج')}
                </h2>
                <p className={`${isA5 ? 'text-xs' : 'text-sm'} font-black`} style={{ color: sColor }}>
                  {tDynamic(clinic?.specialty) || (language === 'en' ? 'Clinic Medical Consultant' : 'استشاري العيادة الطبية')}
                </p>
                <p className={`${isA5 ? 'text-[10px]' : 'text-xs'} text-[#64748B] font-medium`}>
                  {clinic?.certificationTitle || (language === 'en' ? 'Member of Egyptian Medical Association' : 'عضو الجمعية الطبية المصرية')} • {clinic?.certificationEntity || (language === 'en' ? 'Physicians Syndicate' : 'نقابة الأطباء')}
                </p>
              </div>

              <div className={`${language === 'en' ? 'text-right' : 'text-left'} flex flex-col ${language === 'en' ? 'items-end' : 'items-end'}`}>
                {clinic?.logoUrl ? (
                  <img src={clinic.logoUrl} alt="Logo" crossOrigin="anonymous" className={`${isA5 ? 'max-h-9' : 'max-h-12'} object-contain mb-1`} />
                ) : (
                  <ClinicLogo size="sm" variant="light" showSubtitle={false} />
                )}
                <span className={`${isA5 ? 'text-[10px]' : 'text-xs'} font-bold text-[#334155] mt-1`}>
                  {clinic?.clinicName || 'Yalla Clinic'}
                </span>
                {branchName && (
                  <span className="text-[10px] font-bold text-[#94A3B8]">
                    {language === 'en' ? 'Branch: ' : 'فرع: '}{tDynamic(branchName)}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Patient Meta Strip */}
          <div
            className={`flex items-center justify-between py-2 px-3 ${
              isA5 ? 'text-[10px]' : 'text-xs'
            } font-bold mb-3 rounded-xl ${
              templateMode === 'custom'
                ? 'bg-transparent text-[#0F172A] border-none'
                : 'bg-[#F8FAFC] border border-[#F1F5F9]'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[#94A3B8] font-semibold">{language === 'en' ? 'Patient:' : 'المريض:'}</span>
              <span className="text-[#182230] font-black">{patientName || (language === 'en' ? 'Patient' : 'المريض')}</span>
            </div>

            {age && (
              <div className="flex items-center gap-1.5">
                <span className="text-[#94A3B8] font-semibold">{language === 'en' ? 'Age:' : 'السن:'}</span>
                <span className="text-[#182230] font-black">{age} {language === 'en' ? 'yrs' : 'سنة'}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-[#94A3B8] font-semibold">{language === 'en' ? 'Date:' : 'التاريخ:'}</span>
              <span className="text-[#182230] font-mono" dir="ltr">{date}</span>
            </div>

            {prescriptionNumber && (
              <div className="flex items-center gap-1.5">
                <span className="text-[#94A3B8] font-semibold">{language === 'en' ? 'Rx #:' : 'رقم الروشتة:'}</span>
                <span className="text-[#182230] font-mono" dir="ltr">#{prescriptionNumber}</span>
              </div>
            )}
          </div>

          {/* Diagnosis (if present) */}
          {diagnosis && (
            <div className={`mb-3 ${isA5 ? 'text-[10px]' : 'text-xs'} font-bold px-3 py-1.5 bg-[#F0F7FF] rounded-lg border border-[#D0E2FF] flex items-center gap-2`}>
              <span className="text-[#087CF4]">{language === 'en' ? 'Clinical Diagnosis:' : 'التشخيص الطبي:'}</span>
              <span className="text-[#182230]">{diagnosis}</span>
            </div>
          )}

          {/* Rx Symbol */}
          <div className="pt-1 pb-2 text-left" dir="ltr">
            <span
              className={`${isA5 ? 'text-3xl' : 'text-4xl'} font-black font-serif tracking-wider select-none`}
              style={{ color: sColor }}
            >
              R/
            </span>
          </div>

          {/* Medicines List */}
          <div className="space-y-3.5 pl-2 flex-1" dir="ltr">
            {drugs
              ?.filter((d: any) => d.name?.trim())
              .map((drug: any, index: number) => (
                <div key={index} className="flex gap-3 pb-2 border-b border-dashed border-[#F1F5F9]">
                  <span
                    className={`${isA5 ? 'text-xs' : 'text-sm'} font-black pt-0.5 shrink-0`}
                    style={{ color: sColor }}
                  >
                    {index + 1}.
                  </span>
                  <div className="space-y-0.5 text-left flex-1">
                    <h3 className={`${isA5 ? 'text-sm' : 'text-base'} font-black text-[#182230] tracking-tight`}>
                      {drug.name}
                    </h3>
                    <div className={`flex flex-wrap items-center gap-x-3 gap-y-0.5 ${isA5 ? 'text-[10px]' : 'text-xs'}`}>
                      {drug.dosage && (
                        <span className="font-bold text-[#087CF4]">
                          {language === 'en' ? 'Dosage: ' : 'الجرعة: '}{drug.dosage}
                        </span>
                      )}
                      {drug.duration && (
                        <span className="text-[#64748B] font-medium">
                          {language === 'en' ? 'Duration: ' : 'المدة: '}{drug.duration}
                        </span>
                      )}
                      {drug.notes && (
                        <span className="text-[#94A3B8] italic">
                          ({drug.notes})
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>

          {/* Doctor Clinical Instructions */}
          {instructions && (
            <div className={`mt-3 p-2.5 bg-[#F8FAFC] rounded-xl border border-[#E2E8F0] ${isA5 ? 'text-[10px]' : 'text-xs'} ${language === 'en' ? 'text-left' : 'text-right'} leading-relaxed`}>
              <strong className="text-[#334155] block mb-0.5">{language === 'en' ? 'Important Patient Instructions:' : 'تعليمات هامة للمريض:'}</strong>
              <p className="text-[#475569]">{instructions}</p>
            </div>
          )}
        </div>

        {/* Footer (Rendered when showHeaderFooter is true, unless background template replaces it) */}
        {showHeaderFooter && (templateMode === 'standard' || !clinic?.prescriptionTemplateUrl || !printBackground) && (
          <div
            className={`rx-footer mt-5 pt-3 border-t-2 flex items-end justify-between ${
              isA5 ? 'text-[10px]' : 'text-xs'
            } font-bold text-[#64748B] pb-1`}
            style={{ borderColor: sColor }}
          >
            {/* Doctor Signature & Stamp */}
            <div className="text-center">
              <div className={`${isA5 ? 'w-28' : 'w-36'} border-b-2 border-[#CBD5E1] pb-1 italic font-serif text-[#475569] ${isA5 ? 'text-xs' : 'text-sm'}`}>
                {clinic?.doctorName ? (language === 'en' ? `Dr. ${clinic.doctorName}` : `د. ${clinic.doctorName}`) : (language === 'en' ? 'Dr. Physician' : 'د. الطبيب')}
              </div>
              <span className="text-[9px] text-[#94A3B8] font-bold block mt-1">{language === 'en' ? "Doctor's Signature & Stamp" : 'توقيع وختم الطبيب'}</span>
            </div>

            {/* Verification Badge */}
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#F8FAFC] border border-[#E2E8F0] text-[10px] text-[#475569]">
              <ShieldCheck className="w-4 h-4 text-[#059669] shrink-0" />
              <span>{language === 'en' ? 'Electronically Certified Prescription' : 'روشتة رسمية موثقة إلكترونياً'}</span>
            </div>

            {/* Clinic Address & Contacts */}
            <div className={`${language === 'en' ? 'text-left' : 'text-right'} space-y-0.5 text-[10px]`}>
              <p>{clinic?.clinicAddress || (language === 'en' ? 'Address: Registered at clinic' : 'العنوان: مسجل بالعيادة')}</p>
              <p dir="ltr">{language === 'en' ? 'Phone: ' : 'هاتف: '}{clinic?.clinicPhone || clinic?.phones?.[0] || (language === 'en' ? 'Registered at clinic' : 'مسجل بالعيادة')}</p>
              <p className="text-[9px] text-[#94A3B8] pt-0.5">
                {language === 'en' ? 'All rights reserved YallaCodeX 2026' : 'جميع الحقوق محفوظة YallaCodeX 2026'}
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
