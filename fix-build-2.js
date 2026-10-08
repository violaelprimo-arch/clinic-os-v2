const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/finance/page.tsx', 'utf8');
const findMock = `  // Daily revenue bar heights (Mocked data representing daily distributions matching mockup)
  const dailyData = [
    { day: 'السبت', val: 320, pct: 45 },
    { day: 'الأحد', val: 540, pct: 75 },
    { day: 'الاثنين', val: 280, pct: 40 },
    { day: 'الثلاثاء', val: 720, pct: 100 },
    { day: 'الأربعاء', val: 490, pct: 68 },
    { day: 'الخميس', val: 610, pct: 85 },
    { day: 'الجمعة', val: 190, pct: 28 }
  ]`;
c = c.replace(findMock, '');
fs.writeFileSync('src/app/clinic/[slug]/admin/finance/page.tsx', c);
