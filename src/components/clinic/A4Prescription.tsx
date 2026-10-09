import { ClinicLogo } from '@/components/clinic/ClinicLogo'

export function A4Prescription({ clinic, patientName, age, date, diagnosis, drugs, templateMode = 'standard', topOffset = 180 }: any) {
  return (
    <div className="w-full bg-white relative mx-auto flex flex-col justify-between overflow-hidden shadow-lg border border-[#E5EAF0] print:border-none print:shadow-none print:p-8"
         style={{
           aspectRatio: '1 / 1.414',
           maxWidth: '800px',
           ...(templateMode === 'custom' && clinic?.prescriptionTemplateUrl ? {
             backgroundImage: `url("${clinic.prescriptionTemplateUrl}")`,
             backgroundSize: '100% 100%',
             backgroundPosition: 'top center',
             backgroundRepeat: 'no-repeat',
             paddingTop: `${topOffset}px`
           } : { padding: '2rem' })
         }}
         dir="rtl"
    >
      <div className="flex-1 flex flex-col">
        {/* Header */}
        {templateMode === 'standard' && (
          <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4 mb-4">
            <div>
              <h2 className="text-xl font-black text-[#182230]">
                {clinic?.doctorName ? `د. ${clinic.doctorName}` : 'د. الطبيب'}
              </h2>
              <p className="text-xs font-bold text-[#15B8A6] mt-0.5">
                {clinic?.specialty || 'استشاري الطب الباطني والجهاز الهضمي'}
              </p>
              <p className="text-[10px] text-slate-400 mt-0.5">
                عضو الجمعية الطبية المصرية
              </p>
            </div>
            <div className="text-left flex flex-col items-end">
              <ClinicLogo size="sm" variant="light" showSubtitle={false} />
              <span className="text-[10px] font-bold text-slate-400 mt-1 font-mono">
                {clinic?.clinicName || 'Clinic OS'}
              </span>
            </div>
          </div>
        )}

        {/* Meta Strip */}
        <div className={`flex items-center justify-between py-2 text-xs font-bold mb-4 ${templateMode === 'custom' ? 'bg-white/85 px-3 border border-slate-200/80 rounded-lg' : 'border-b border-dashed border-[#E5EAF0]'}`}>
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">الاسم:</span>
            <span className="text-[#182230] text-sm">{patientName}</span>
          </div>
          {age && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-400">السن:</span>
              <span className="text-[#182230]">{age}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="text-slate-400">التاريخ:</span>
            <span className="text-[#182230] font-mono">{date}</span>
          </div>
        </div>

        {/* Diagnosis */}
        {diagnosis && (
          <div className="mb-4 text-xs font-semibold px-2 flex items-baseline gap-1.5 bg-white/70 py-1 rounded">
            <span className="text-slate-400 font-bold">التشخيص:</span>
            <span className="text-[#182230] font-bold">{diagnosis}</span>
          </div>
        )}

        {/* Rx Symbol */}
        <div className="pt-2 pb-2 text-left" dir="ltr">
          <span className="text-3xl font-black font-serif text-[#182230] tracking-wider select-none">R/</span>
        </div>

        {/* Medicines */}
        <div className="space-y-4 pl-3 flex-1" dir="ltr">
          {drugs?.filter((d: any) => d.name?.trim()).map((drug: any, index: number) => (
            <div key={index} className="flex gap-4">
              <span className="text-xs font-black text-slate-400 pt-1 shrink-0">{index + 1}.</span>
              <div className="space-y-1">
                <h3 className="text-base font-black text-[#182230] tracking-tight">{drug.name}</h3>
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                  {drug.dosage && <span className="font-bold text-[#15B8A6]">{drug.dosage}</span>}
                  {drug.duration && <span className="text-slate-500 font-medium">{drug.duration}</span>}
                  {drug.notes && <span className="text-slate-400">({drug.notes})</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      {templateMode === 'standard' && (
        <div className="mt-8 pt-4 border-t border-slate-900 flex items-center justify-between text-[10px] font-bold text-slate-400 pb-2">
          <div className="flex items-center gap-3">
            <span>{clinic?.address || 'العنوان غير مسجل'}</span>
            <span>•</span>
            <span dir="ltr">{clinic?.clinicPhone || clinic?.phones?.[0] || 'الهاتف غير مسجل'}</span>
          </div>
          <div className="text-left font-serif italic text-slate-300">
            Powered by Clinic OS
          </div>
        </div>
      )}
    </div>
  )
}
