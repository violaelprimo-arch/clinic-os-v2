const fs = require('fs');

const pFile = 'src/app/clinic/[slug]/admin/prescriptions/page.tsx';
let pContent = fs.readFileSync(pFile, 'utf8');

// Replace the drugs state initialization using regex
pContent = pContent.replace(
  /const \[drugs, setDrugs\] = useState<any\[\]>\(\[[\s\S]*?\]\)/,
  `const [drugs, setDrugs] = useState<any[]>([\n    { id: 1, name: searchParams?.get('drug') || '', dosage: '', duration: '' }\n  ])`
);

// Also change placeholder
pContent = pContent.replace('اسم الدواء (مثال: Augmentin 1g)', 'اسم الدواء');

fs.writeFileSync(pFile, pContent);
