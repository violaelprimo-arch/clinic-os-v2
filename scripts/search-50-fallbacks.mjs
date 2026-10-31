import fs from 'fs';

const files = [
  'src/components/clinic/BookingForm.tsx',
  'src/components/clinic/BookingModal.tsx',
  'src/components/clinic/PremiumLanding.tsx',
  'src/components/clinic/InClinicBookingView.tsx',
  'src/app/clinic/[slug]/page.tsx',
  'src/app/clinic/[slug]/admin/settings/page.tsx',
  'src/app/clinic/[slug]/admin/branches/page.tsx',
  'src/app/clinic/[slug]/patient/page.tsx'
];

files.forEach(f => {
  if (!fs.existsSync(f)) return;
  const content = fs.readFileSync(f, 'utf8');
  const lines = content.split('\n');
  lines.forEach((l, idx) => {
    if (l.includes('50') || l.includes('49') || l.includes('placeholder') && l.includes('50')) {
      console.log(`${f}:${idx+1}: ${l.trim()}`);
    }
  });
});
