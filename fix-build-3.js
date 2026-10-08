const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');
c = c.replace(
  '{appt.diagnosis || <span className="text-slate-400 italic">لا يوجد تشخيص مسجل لهذه الزيارة.</span>}',
  '{appt.diagnosis ? appt.diagnosis : <span className="text-slate-400 italic">لا يوجد تشخيص مسجل لهذه الزيارة.</span>}'
);
fs.writeFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', c);
