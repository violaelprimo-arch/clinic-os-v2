const fs = require('fs');

let c1 = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');
c1 = c1.replace(/doc\(db, 'appointments', apptId\)/g, "doc(db, 'appointments', apptId as string)");
fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c1);

let c2 = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
c2 = c2.replace(
  /const \[activeTab, setActiveTab\] = useState<\s*'services' \| 'profile' \| 'queue' \| 'payment' \| 'staff' \| 'print' \| 'ai'\s*>\('profile'\)/g,
  "const [activeTab, setActiveTab] = useState<'services' | 'profile' | 'queue' | 'payment' | 'staff' | 'print' | 'ai' | 'security'>('profile')"
);
fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c2);
console.log('Fixed TS Errors!');
