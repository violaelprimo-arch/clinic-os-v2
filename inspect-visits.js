const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');
const i = c.indexOf("activeTab === 'visits'");
console.log(c.substring(i, i + 1500));
