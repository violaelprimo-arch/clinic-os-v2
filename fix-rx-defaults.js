const fs = require('fs');

const pFile = 'src/app/clinic/[slug]/admin/prescriptions/page.tsx';
let pContent = fs.readFileSync(pFile, 'utf8');

const oldState = `const [drugs, setDrugs] = useState<any[]>([
    { id: 1, name: searchParams?.get('drug') || 'Augmentin 1g', dosage: 'قرص كل 12 ساعة', duration: 'لمدة 5 أيام' },
    { id: 2, name: 'Catafast 50 mg', dosage: 'كيس عند اللزوم', duration: 'بعد الأكل' }
  ])`;

const newState = `const [drugs, setDrugs] = useState<any[]>([
    { id: 1, name: searchParams?.get('drug') || '', dosage: '', duration: '' }
  ])`;

pContent = pContent.replace(oldState, newState);

// Also replace Rx with R in the form if it says Rx
pContent = pContent.replace(/الأدوية والجرعات \(Rx\)/g, 'الأدوية والجرعات (R)');

fs.writeFileSync(pFile, pContent);
