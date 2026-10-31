import fs from 'fs';

const path = 'src/app/clinic/[slug]/admin/booking/page.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (
    line.includes('max') ||
    line.includes('limit') ||
    line.includes('capacity') ||
    line.includes('Bookings') ||
    line.includes('اكتمل') ||
    line.includes('متاح') ||
    line.includes('سعة')
  ) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
