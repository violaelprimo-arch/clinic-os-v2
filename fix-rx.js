const fs = require('fs');

// 1. Update prescriptions page defaults and R/ symbol
let pFile = 'src/app/clinic/[slug]/admin/prescriptions/page.tsx';
let pContent = fs.readFileSync(pFile, 'utf8');
pContent = pContent.replace(
  `const [drugs, setDrugs] = useState<any[]>([
    { name: 'Augmentin 1g', dosage: 'قرص كل 12 ساعة', duration: 'لمدة 5 أيام', notes: '' },
    { name: 'Catafast 50 mg', dosage: 'كيس عند اللزوم', duration: '', notes: 'بعد الأكل' }
  ])`,
  `const [drugs, setDrugs] = useState<any[]>([
    { name: '', dosage: '', duration: '', notes: '' }
  ])`
);
pContent = pContent.replace(/>\s*Rx\/\s*</g, '>R/<');
fs.writeFileSync(pFile, pContent);

// 2. Update A4Prescription component R/ symbol
let a4File = 'src/components/clinic/A4Prescription.tsx';
let a4Content = fs.readFileSync(a4File, 'utf8');
a4Content = a4Content.replace(/>\s*Rx\/\s*</g, '>R/<');
fs.writeFileSync(a4File, a4Content);
