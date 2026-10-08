const fs = require('fs');

function cleanFile(filePath, regex, replacement) {
  let content = fs.readFileSync(filePath, 'utf8');
  content = content.replace(regex, replacement);
  fs.writeFileSync(filePath, content);
}

// 1. patients/page.tsx
let f1 = 'src/app/clinic/[slug]/admin/patients/page.tsx';
let c1 = fs.readFileSync(f1, 'utf8');
c1 = c1.replace(/\/\/ If no records in Firebase, populate clean realistic demo patient records[\s\S]*?if \(loadedPatients\.length === 0\) \{[\s\S]*?\}\n/g, '');
fs.writeFileSync(f1, c1);

// Let's print out what needs to be cleaned in other files:
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
  const c = fs.readFileSync(f, 'utf8');
  if (c.includes('محمد علي') || c.includes('محمد محمود')) {
    console.log('--- ' + f + ' ---');
    let lines = c.split('\n');
    lines.forEach((l, i) => {
      if (l.includes('محمد علي') || l.includes('محمد محمود')) {
        console.log(i + 1 + ': ' + l.trim());
      }
    });
  }
});
