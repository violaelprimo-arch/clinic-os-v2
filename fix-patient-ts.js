const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');
c = c.replace(
  'const appts = snap.docs.map(d => ({ id: d.id, ...d.data() }))',
  'const appts = snap.docs.map(d => ({ id: d.id, ...d.data() } as any))'
);
fs.writeFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', c);
