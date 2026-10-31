import fs from 'fs';

const path = 'src/app/api/clinic/[slug]/in-clinic-booking/route.ts';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (
    line.includes('max') ||
    line.includes('limit') ||
    line.includes('capacity') ||
    line.includes('Bookings') ||
    line.includes('اكتمل') ||
    line.includes('atomic') ||
    line.includes('createAtomicAppointment')
  ) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
