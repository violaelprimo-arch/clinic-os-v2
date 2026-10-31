import fs from 'fs';

const path = 'src/app/clinic/[slug]/admin/branches/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (
    line.includes('maxDailyBookings') ||
    line.includes('maxPatients') ||
    line.includes('maxBookings') ||
    line.includes('dailyLimit') ||
    line.includes('الحد الأقصى')
  ) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
