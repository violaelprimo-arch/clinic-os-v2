const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
console.log(c.substring(c.indexOf('activeTab === \'queue\''), c.indexOf('activeTab === \'queue\'') + 2000));
