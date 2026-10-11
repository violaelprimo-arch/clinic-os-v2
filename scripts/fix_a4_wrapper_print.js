const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');

c = c.replace(
  /<div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:border-0 print:m-0">/,
  '<div className="bg-white rounded-xl border border-slate-200 overflow-hidden print:overflow-visible print:border-0 print:m-0 print:p-0 print:w-[100vw] print:h-[100vh]">'
);

fs.writeFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', c);
console.log('Fixed A4Prescription wrapper print css!');
