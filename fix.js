const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', 'utf8');
c = c.replace(/\\`/g, '`');
c = c.replace(/\\\$/g, '$');
fs.writeFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', c);
