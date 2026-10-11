const fs = require('fs');
let c1 = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');
c1 = c1.replace(/searchParams\.get\('appointmentId'\)\),/g, "searchParams.get('appointmentId') as string),");
fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c1);

let c2 = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
c2 = c2.replace(/<'services' \| 'profile' \| 'queue' \| 'payment' \| 'staff' \| 'print' \| 'ai'>/g, "<'services' | 'profile' | 'queue' | 'payment' | 'staff' | 'print' | 'ai' | 'security'>");
fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c2);

console.log('Fixed TS Errors!');
