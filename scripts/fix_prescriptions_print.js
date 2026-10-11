const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

c = c.replace(
  /<div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">/,
  '<div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto print:p-0 print:m-0 print:max-w-none print:w-full" dir="rtl">'
);

c = c.replace(
  /<div className="lg:col-span-5 print:w-full print:block space-y-3">/,
  '<div className="lg:col-span-5 print:w-full print:block print:p-0 print:m-0 space-y-3">'
);

c = c.replace(
  /className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-\[#E5EAF0\] relative min-h-\[620px\] flex flex-col justify-between rounded-2xl print:shadow-none print:border-none print:p-8"/,
  'className="medical-card bg-white p-6 sm:p-8 space-y-6 shadow-lg border border-[#E5EAF0] relative min-h-[620px] flex flex-col justify-between rounded-2xl print:shadow-none print:border-none print:!p-8 print:!w-[210mm] print:!h-[297mm] print:!max-w-none print:!rounded-none print:m-0"'
);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
console.log('Fixed prescriptions page print styles!');
