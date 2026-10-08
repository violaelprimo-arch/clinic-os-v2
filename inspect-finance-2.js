const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/finance/page.tsx', 'utf8');
console.log(c.substring(c.indexOf('generateReport = async'), c.indexOf('generateReport = async') + 1500));
