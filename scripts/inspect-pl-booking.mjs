import fs from 'fs';

const path = 'src/components/clinic/PremiumLanding.tsx';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (
    line.includes('BookingModal') ||
    line.includes('BookingForm') ||
    line.includes('bookingModalOpen') ||
    line.includes('branches') ||
    line.includes('maxLimit') ||
    line.includes('maxDailyBookings')
  ) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
