const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');
const i = c.indexOf('العمر');
if (i !== -1) {
  console.log(c.substring(i - 1000, i + 1000));
} else {
  console.log('Not found');
}
