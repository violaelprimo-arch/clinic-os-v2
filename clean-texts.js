const fs = require('fs');

const files = [
  'src/app/clinic/[slug]/admin/layout.tsx',
  'src/app/clinic/[slug]/admin/page.tsx',
  'src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx',
  'src/app/clinic/[slug]/admin/prescriptions/page.tsx',
  'src/app/clinic/[slug]/admin/settings/page.tsx',
  'src/app/clinic/[slug]/page.tsx',
  'src/app/clinic/[slug]/patient/page.tsx',
  'src/app/clinic/[slug]/track/[appointmentId]/page.tsx',
  'src/components/clinic/PremiumLanding.tsx'
];

files.forEach(f => {
  let c = fs.readFileSync(f, 'utf8');
  c = c.replace(/محمد علي/g, 'الطبيب');
  c = c.replace(/محمد محمود/g, 'المريض');
  c = c.replace(/عيادة د\. الطبيب التخصصية/g, 'العيادة التخصصية');
  c = c.replace(/عيادة د\. الطبيب/g, 'العيادة');
  fs.writeFileSync(f, c);
});
