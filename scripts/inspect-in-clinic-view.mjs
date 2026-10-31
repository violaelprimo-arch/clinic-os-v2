import fs from 'fs';

const path = 'src/components/clinic/InClinicBookingView.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (
    line.includes('max') ||
    line.includes('limit') ||
    line.includes('capacity') ||
    line.includes('Bookings') ||
    line.includes('اكتمل') ||
    line.includes('سعة') ||
    line.includes('49') ||
    line.includes('50')
  ) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
