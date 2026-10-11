const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');

c = c.replace(
  /<div className="max-w-5xl mx-auto space-y-6" dir="rtl">/,
  '<div className="max-w-5xl mx-auto space-y-6 print:hidden" dir="rtl">'
);

c = c.replace(
  /<DialogContent className="max-w-3xl max-h-\[90vh\] overflow-y-auto">/,
  '<DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto print:max-w-none print:w-full print:h-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-transparent print:p-0 print:m-0">'
);

fs.writeFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', c);
console.log('Fixed patient profile print logic!');
