const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/A4Prescription.tsx', 'utf8');

c = c.replace(
  /className="w-full bg-white relative mx-auto flex flex-col justify-between overflow-hidden shadow-lg border border-\[#E5EAF0\] print:border-none print:shadow-none print:p-8"/,
  'className="w-full bg-white relative mx-auto flex flex-col justify-between overflow-hidden shadow-lg border border-[#E5EAF0] print:border-none print:shadow-none print:p-0 print:m-0 print:!w-[210mm] print:!h-[297mm] print:!max-w-none print:!aspect-auto"'
);

fs.writeFileSync('src/components/clinic/A4Prescription.tsx', c);
console.log('Fixed A4Prescription print classes!');
