const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/finance/page.tsx', 'utf8');
const lines = c.split('\n');
lines.forEach((l, i) => {
  if (l.includes('h-64') || l.includes('الرسم البياني') || l.includes('Chart')) {
    console.log(`${i+1}: ${l}`);
  }
});
