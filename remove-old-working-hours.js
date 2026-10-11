const fs = require('fs');

let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
c = c.replace(/setWorkingDays\([\s\S]*?\)/g, '');
c = c.replace(/setWorkingHoursStart\([\s\S]*?\)/g, '');
c = c.replace(/setWorkingHoursEnd\([\s\S]*?\)/g, '');

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c);
