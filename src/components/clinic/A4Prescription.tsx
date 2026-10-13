'use client'

import React from 'react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'

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
  prescriptionNumber
}: A4PrescriptionProps) {
  const safeOffset = typeof topOffset === 'number' && topOffset <= 60 && topOffset >= 0 ? topOffset : 25
  const pColor = primaryColor || clinic?.primaryColor || '#0f766e'
  const sColor = secondaryColor || clinic?.secondaryColor || '#14b8a6'

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
            size: A4 portrait;
            margin: 0;
          }
          #patient-a4-print-sheet {
            padding-top: ${templateMode === 'custom' ? `${safeOffset}%` : '28mm'} !important;
            padding-left: 20mm !important;
            padding-right: 20mm !important;
            padding-bottom: 20mm !important;
            width: 210mm !important;
            height: 297mm !important;
            max-width: none !important;
            border: none !important;
            box-shadow: none !important;
            border-radius: 0 !important;
            margin: 0 !important;
          }
        }
      `
        }}
      />

      <div
        id="patient-a4-print-sheet"
        className="w-full bg-white relative mx-auto flex flex-col justify-between overflow-hidden shadow-2xl border border-[#E5EAF0] aspect-[1/1.414] max-w-[800px] text-right font-sans"
        style={{
          ...(templateMode === 'custom' && clinic?.prescriptionTemplateUrl
            ? {
                backgroundImage: `url("${clinic.prescriptionTemplateUrl}")`,
                backgroundSize: '100% 100%',
                backgroundPosition: 'top center',
                backgroundRepeat: 'no-repeat',
                paddingTop: `${safeOffset}%`,
                paddingLeft: '2rem',
                paddingRight: '2rem',
                paddingBottom: '2rem'
              }
            : {
                paddingTop: '2.5rem',
                paddingBottom: '2.5rem',
                paddingLeft: '2.5rem',
                paddingRight: '2.5rem'
              })
        }}
        dir="rtl"
      >
        <div className="flex-1 flex flex-col">
          {/* Header (Standard Mode Only) */}
          {templateMode === 'standard' && (
            <div
              className="flex items-start justify-between pb-5 mb-5 border-b-2"
              style={{ borderColor: pColor }}
            >
              <div>
                <h2 className="text-2xl font-black text-[#182230]" style={{ color: pColor }}>
                  {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'د. الطبيب المعالج'}
                </h2>
                <p className="text-sm font-black mt-0.5" style={{ color: sColor }}>
                  {clinic?.specialty || 'استشاري العيادة الطبية'}
                </p>
                <p className="text-xs text-slate-500 mt-1 font-medium">
                  {clinic?.certificationTitle || 'عضو الجمعية الطبية المصرية'} • {clinic?.certificationEntity || 'نقابة الأطباء'}
                </p>
              </div>

              <div className="text-left flex flex-col items-end">
                {clinic?.logoUrl ? (
                  <img src={clinic.logoUrl} alt="Logo" className="max-h-12 object-contain mb-1" />
                ) : (
                  <ClinicLogo size="sm" variant="light" showSubtitle={false} />
                )}
                <span className="text-xs font-bold text-slate-700 mt-1">
                  {clinic?.clinicName || 'Clinic OS'}
                </span>
                {branchName && (
                  <span className="text-[10px] font-bold text-slate-400">
                    فرع: {branchName}
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Patient Meta Strip */}
          <div
            className={`flex items-center justify-between py-2.5 px-3 text-xs font-bold mb-4 rounded-xl ${
              templateMode === 'custom'
                ? 'bg-transparent text-slate-900 border-none'
                : 'bg-slate-50 border border-slate-100'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">المريض:</span>
              <span className="text-[#182230] font-black">{patientName || 'المريض'}</span>
            </div>

            {age && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">السن:</span>
                <span className="text-[#182230] font-black">{age}</span>
              </div>
            )}

            <div className="flex items-center gap-1.5">
              <span className="text-slate-400 font-semibold">التاريخ:</span>
              <span className="text-[#182230] font-mono" dir="ltr">{date}</span>
            </div>

            {prescriptionNumber && (
              <div className="flex items-center gap-1.5">
                <span className="text-slate-400 font-semibold">رقم الروشتة:</span>
                <span className="text-[#182230] font-mono text-[11px]" dir="ltr">#{prescriptionNumber}</span>
              </div>
            )}
          </div>

          {/* Diagnosis (if present) */}
          {diagnosis && (
            <div className="mb-4 text-xs font-bold px-3 py-1.5 bg-teal-50/50 rounded-lg border border-teal-100 flex items-center gap-2">
              <span className="text-[#0D9488]">التشخيص الطبي:</span>
              <span className="text-[#182230]">{diagnosis}</span>
            </div>
          )}

          {/* Rx Symbol */}
          <div className="pt-2 pb-3 text-left" dir="ltr">
            <span
              className="text-4xl font-black font-serif tracking-wider select-none"
              style={{ color: pColor }}
            >
              R/
            </span>
          </div>

          {/* Medicines List */}
          <div className="space-y-4 pl-3 flex-1" dir="ltr">
            {drugs
              ?.filter((d: any) => d.name?.trim())
              .map((drug: any, index: number) => (
                <div key={index} className="flex gap-3.5 pb-2 border-b border-dashed border-slate-100">
                  <span
                    className="text-sm font-black pt-0.5 shrink-0"
                    style={{ color: sColor }}
                  >
                    {index + 1}.
                  </span>
                  <div className="space-y-1 text-left flex-1">
                    <h3 className="text-base font-black text-[#182230] tracking-tight">
                      {drug.name}
                    </h3>
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs">
                      {drug.dosage && (
                        <span className="font-bold text-[#0D9488]">
                          الجرعة: {drug.dosage}
                        </span>
                      )}
                      {drug.duration && (
                        <span className="text-slate-500 font-medium">
                          المدة: {drug.duration}
                        </span>
                      )}
                      {drug.notes && (
                        <span className="text-slate-400 italic">
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
            <div className="mt-4 p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs text-right leading-relaxed">
              <strong className="text-slate-700 block mb-1">تعليمات هامة للمريض:</strong>
              <p className="text-slate-600">{instructions}</p>
            </div>
          )}
        </div>

        {/* Footer (Standard Mode Only) */}
        {templateMode === 'standard' && (
          <div
            className="mt-6 pt-4 border-t-2 flex items-end justify-between text-xs font-bold text-slate-500 pb-1"
            style={{ borderColor: pColor }}
          >
            <div className="text-center">
              <div className="w-36 border-b-2 border-slate-300 pb-1 italic font-serif text-slate-600 text-sm">
                {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'د. الطبيب'}
              </div>
              <span className="text-[10px] text-slate-400 font-bold block mt-1">توقيع وختم الطبيب</span>
            </div>

            <div className="text-right space-y-0.5 text-[11px]">
              <p>{clinic?.clinicAddress || 'العنوان: مسجل بالعيادة'}</p>
              <p dir="ltr">هاتف: {clinic?.clinicPhone || clinic?.phones?.[0] || 'مسجل بالعيادة'}</p>
              <p className="text-[9px] text-slate-400 pt-1">
                جميع الحقوق محفوظة © {new Date().getFullYear()} Clinic OS
              </p>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
