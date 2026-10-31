import fs from 'fs';

const code = fs.readFileSync('src/components/clinic/PremiumLanding.tsx', 'utf8');
const lines = code.split('\n');
lines.forEach((l, i) => {
  if (l.includes('BookingModal') || l.includes('BookingForm') || l.includes('clinic=') || l.includes('maxDailyBookings')) {
    console.log(`${i+1}: ${l.trim()}`);
  }
});
