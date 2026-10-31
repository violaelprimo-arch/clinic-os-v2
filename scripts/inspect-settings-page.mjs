import fs from 'fs';

const path = 'src/app/clinic/[slug]/admin/settings/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (
    line.includes('maxDailyBookings') ||
    line.includes('maxPatients') ||
    line.includes('maxBookings') ||
    line.includes('dailyLimit') ||
    line.includes('الحد الأقصى') ||
    line.includes('كشوفات') ||
    line.includes('الحجوزات اليومية')
  ) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
