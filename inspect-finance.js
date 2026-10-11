const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/finance/page.tsx', 'utf8');
const firstLines = c.substring(0, 1500);
console.log(firstLines);
