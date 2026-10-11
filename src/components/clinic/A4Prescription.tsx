import { ClinicLogo } from '@/components/clinic/ClinicLogo'

export function A4Prescription({ clinic, patientName, age, date, diagnosis, drugs, templateMode = 'standard', topOffset = 25 }: any) {
  return (
    <div className="w-full bg-white relative mx-auto flex flex-col justify-between overflow-hidden shadow-lg border border-[#E5EAF0] aspect-[1/1.414] max-w-[800px] print:border-none print:shadow-none print:!px-8 print:!pb-8 print:!pt-0 print:m-0 print:!w-[210mm] print:!h-[297mm] print:!max-w-none print:!aspect-auto"
         style={{
           ...(templateMode === 'custom' && clinic?.prescriptionTemplateUrl ? {
             backgroundImage: `url("${clinic.prescriptionTemplateUrl}")`,
             backgroundSize: '100% 100%',
             backgroundPosition: 'top center',
             backgroundRepeat: 'no-repeat',
             paddingTop: `${topOffset}%`
           } : { paddingTop: '2rem', paddingBottom: '2rem', paddingLeft: '2rem', paddingRight: '2rem' })
         }}
         dir="rtl"
    >
      <div className="flex-1 flex flex-col">
        {/* Header (Standard Mode Only) */}
        {templateMode === 'standard' && (
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
            <div>
              <h2 className="text-2xl font-black text-[#182230]">
                {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'د. الطبيب'}
              </h2>
              <p className="text-sm font-bold text-[#15B8A6] mt-0.5">
                {clinic?.specialty || 'العيادة الطبية الشاملة'}
              </p>
              <p className="text-xs text-slate-500 mt-1">
                عضو الجمعية الطبية المصرية
              </p>
            </div>
            <div className="text-left flex flex-col items-end">
              <ClinicLogo size="sm" variant="light" showSubtitle={false} />
              <span className="text-xs font-bold text-slate-500 mt-1 font-mono">
                {clinic?.clinicName || 'Clinic OS'}
              </span>
            </div>
          </div>
        )}

        {/* Clean Patient Meta Strip */}
        <div className={`flex items-center justify-between py-2 text-sm font-bold mb-4 ${templateMode === 'custom' ? 'bg-transparent' : 'border-b-2 border-slate-100 px-2'}`}>
          <div className="flex items-center gap-1.5">
            {templateMode === 'standard' && <span className="text-slate-400">الاسم:</span>}
            <span className="text-[#182230]">{patientName}</span>
          </div>
          {age && (
            <div className="flex items-center gap-1.5">
              {templateMode === 'standard' && <span className="text-slate-400">السن:</span>}
              <span className="text-[#182230]">{age}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            {templateMode === 'standard' && <span className="text-slate-400">التاريخ:</span>}
            <span className="text-[#182230] font-mono">{date}</span>
          </div>
        </div>

        {/* Diagnosis */}
        {diagnosis && (
          <div className="mb-4 text-sm font-semibold px-2 flex items-baseline gap-1.5">
            <span className="text-slate-400 font-bold">التشخيص:</span>
            <span className="text-[#182230] font-bold">{diagnosis}</span>
          </div>
        )}

        {/* Rx Symbol */}
        <div className="pt-2 pb-4 text-left" dir="ltr">
          <span className="text-4xl font-black font-serif text-[#182230] tracking-wider select-none">R/</span>
        </div>

        {/* Medicines */}
        <div className="space-y-5 pl-4 flex-1" dir="ltr">
          {drugs?.filter((d: any) => d.name?.trim()).map((drug: any, index: number) => (
            <div key={index} className="flex gap-4">
              <span className="text-sm font-black text-slate-400 pt-0.5 shrink-0">{index + 1}.</span>
              <div className="space-y-1">
                <h3 className="text-lg font-black text-[#182230] tracking-tight">{drug.name}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                  {drug.dosage && <span className="font-bold text-[#15B8A6]">{drug.dosage}</span>}
                  {drug.duration && <span className="text-slate-500 font-medium">{drug.duration}</span>}
                  {drug.notes && <span className="text-slate-400">({drug.notes})</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer (Standard Mode Only) */}
      {templateMode === 'standard' && (
        <div className="mt-8 pt-4 border-t-2 border-slate-900 flex items-end justify-between text-xs font-bold text-slate-500 pb-2">
          <div className="text-center">
            <div className="w-32 border-b-2 border-slate-400 pb-1 italic font-serif text-slate-500 text-sm">
              {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'د. الطبيب'}
            </div>
            <span className="text-[10px] text-slate-400 font-bold">توقيع وختم الطبيب</span>
          </div>

          <div className="text-right space-y-1">
            <p className="flex items-center gap-1.5 justify-end">
              <span>{clinic?.clinicAddress || 'العنوان غير مسجل'}</span>
            </p>
            <p className="flex items-center gap-1.5 justify-end" dir="ltr">
              <span>{clinic?.clinicPhone || clinic?.phones?.[0] || 'رقم الهاتف غير مسجل'}</span>
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
