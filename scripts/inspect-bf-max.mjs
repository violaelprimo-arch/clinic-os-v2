import fs from 'fs';

const bf = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');
const lines = bf.split('\n');

lines.forEach((l, i) => {
  if (l.includes('maxLimit') || l.includes('maxDailyBookings') || l.includes('bookedCount') || l.includes('كشوفات') || l.includes('كشف')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});
