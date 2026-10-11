const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
console.log(c.substring(0, 1500));
