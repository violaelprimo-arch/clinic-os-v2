import fs from 'fs';

function inspect(file) {
  console.log('=== Inspecting ' + file + ' ===');
  const content = fs.readFileSync(file, 'utf8');
  const lines = content.split('\n');
  lines.forEach((line, i) => {
    if (
      line.includes('max') ||
      line.includes('limit') ||
      line.includes('capacity') ||
      line.includes('Bookings') ||
      line.includes('49') ||
      line.includes('50') ||
      line.includes('available') ||
      line.includes('اكتمل')
    ) {
      console.log(`${i + 1}: ${line.trim()}`);
    }
  });
}

inspect('src/components/clinic/BookingForm.tsx');
inspect('src/components/clinic/BookingModal.tsx');
