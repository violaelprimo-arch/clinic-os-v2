const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

c = c.replace(
  "import { ClinicLogo } from '@/components/clinic/ClinicLogo'",
  "import { ClinicLogo } from '@/components/clinic/ClinicLogo'\nimport { A4Prescription } from '@/components/clinic/A4Prescription'"
);

// We need to replace everything from <style dangerouslySetInnerHTML to the end of <div className="medical-card ...
const findLayout = `          {/* Print CSS Exact Colors */}
          <style dangerouslySetInnerHTML={{ __html: '@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }' }} />

          {/* Actual Sheet */}
          <div
            className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-[#E5EAF0] relative min-h-[620px] flex flex-col justify-between rounded-2xl print:shadow-none print:border-none print:p-8"
            style={
              templateMode === 'custom' && clinic?.prescriptionTemplateUrl
                ? {
                    backgroundImage: \`url("\${clinic.prescriptionTemplateUrl}")\`,
                    backgroundSize: '100% 100%',
                    backgroundPosition: 'top center',
                    backgroundRepeat: 'no-repeat',
                    paddingTop: \`\${topOffset}px\`,
                  }
                : undefined
            }
          >
            
            {/* Top Sheet Header (Only in Standard Mode) */}
            <div>
              {templateMode === 'standard' && (
                <div className="flex items-start justify-between border-b-2 border-slate-900 pb-4">
                  <div>
                    <h2 className="text-xl font-black text-[#182230]">
                      {clinic?.doctorName ? \`د. \${clinic.doctorName}\` : 'د. الطبيب'}
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

              {/* Patient Meta Strip */}
              <div
                className={\`flex items-center justify-between py-2.5 text-xs font-bold rounded-lg \${
                  templateMode === 'custom'
                    ? 'bg-white/85 backdrop-blur-2xs border border-slate-200/80 px-3 shadow-2xs mt-1'
                    : 'border-b border-dashed border-[#E5EAF0] mb-2'
                }\`}
              >
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">الاسم:</span>
                  <span className="text-[#182230] text-sm">{patientName}</span>
                </div>
                {patientAge && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-slate-400">السن:</span>
                    <span className="text-[#182230]">{patientAge}</span>
                  </div>
                )}
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">التاريخ:</span>
                  <span className="text-[#182230] font-mono">{dateStr}</span>
                </div>
              </div>

              {/* Diagnosis Strip (Optional) */}
              {diagnosis && (
                <div className="mt-2.5 text-xs text-slate-600 font-semibold px-1 flex items-baseline gap-1.5 bg-white/70 backdrop-blur-2xs py-1 rounded">
                  <span className="text-slate-400 font-bold">التشخيص:</span>
                  <span className="text-[#182230] font-bold">{diagnosis}</span>
                </div>
              )}

              {/* The Iconic Rx/ Symbol */}
              <div className="pt-4 pb-2 text-left" dir="ltr">
                <span className="text-3xl font-black font-serif text-[#182230] tracking-wider select-none">
                  Rx/
                </span>
              </div>

              {/* Medicines List */}
              <div className="space-y-4 pl-3 min-h-[220px]" dir="ltr">
                {drugs.filter(d => d.name.trim()).map((drug, index) => (
                  <div key={index} className="flex gap-4 group">
                    <span className="text-xs font-black text-slate-400 pt-1 shrink-0 select-none">
                      {index + 1}.
                    </span>
                    <div className="space-y-1">
                      <h3 className="text-base font-black text-[#182230] tracking-tight group-hover:text-[#15B8A6] transition-colors">
                        {drug.name}
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
                        {drug.dosage && (
                          <span className="font-bold text-[#15B8A6]">
                            {drug.dosage}
                          </span>
                        )}
                        {drug.duration && (
                          <span className="text-slate-500 font-medium">
                            {drug.duration}
                          </span>
                        )}
                        {drug.notes && (
                          <span className="text-slate-400">
                            ({drug.notes})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Footer (Only in Standard Mode) */}
            {templateMode === 'standard' && (
              <div className="mt-8 pt-4 border-t-2 border-slate-900 flex items-center justify-between text-[10px] font-bold text-slate-400">
                <div className="flex items-center gap-3">
                  <span>{clinic?.address || 'عنوان العيادة يظهر هنا'}</span>
                  <span>•</span>
                  <span dir="ltr">{clinic?.clinicPhone || '01000000000'}</span>
                </div>
                <div className="text-left font-serif italic text-slate-300">
                  Powered by Clinic OS
                </div>
              </div>
            )}
          </div>`;

const replaceLayout = `
          {/* Print CSS Exact Colors */}
          <style dangerouslySetInnerHTML={{ __html: '@media print { * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; } }' }} />

          <A4Prescription
            clinic={clinic}
            patientName={patientName}
            age={patientAge}
            date={dateStr}
            diagnosis={diagnosis}
            drugs={drugs}
            templateMode={templateMode}
            topOffset={topOffset}
          />
`;

c = c.replace(findLayout, replaceLayout);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
