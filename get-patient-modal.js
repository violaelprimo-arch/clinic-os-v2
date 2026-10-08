const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', 'utf8');
const i = c.indexOf('// Add Patient Modal');
if (i !== -1) {
  console.log(c.substring(i - 100, i + 1500));
} else {
  console.log('Not found');
  console.log(c.substring(c.indexOf('<Dialog'), c.indexOf('<Dialog') + 2000));
}
