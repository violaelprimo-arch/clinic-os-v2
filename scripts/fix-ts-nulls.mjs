import fs from 'fs';

// 1. BookingModal.tsx
const bmPath = 'src/components/clinic/BookingModal.tsx';
let bmCode = fs.readFileSync(bmPath, 'utf8').replace(/\r\n/g, '\n');
bmCode = bmCode.replace(
  'if (nearest.nearestDateStr) {',
  'if (nearest && nearest.nearestDateStr) {'
);
fs.writeFileSync(bmPath, bmCode, 'utf8');
console.log('Fixed BookingModal.tsx');

// 2. book/route.ts
const bookPath = 'src/app/api/clinic/book/route.ts';
let bookCode = fs.readFileSync(bookPath, 'utf8').replace(/\r\n/g, '\n');
bookCode = bookCode.replace(
  'nextAvailableDate: nearest.nearestDateStr,\n          nextAvailableFormatted: nearest.formattedDate',
  'nextAvailableDate: nearest?.nearestDateStr || null,\n          nextAvailableFormatted: nearest?.formattedDate || null'
);
bookCode = bookCode.replace(
  'nextAvailableDate: nearest.nearestDateStr,\n            nextAvailableFormatted: nearest.formattedDate',
  'nextAvailableDate: nearest?.nearestDateStr || null,\n            nextAvailableFormatted: nearest?.formattedDate || null'
);
fs.writeFileSync(bookPath, bookCode, 'utf8');
console.log('Fixed book/route.ts');

// 3. in-clinic-booking/route.ts
const inPath = 'src/app/api/clinic/[slug]/in-clinic-booking/route.ts';
let inCode = fs.readFileSync(inPath, 'utf8').replace(/\r\n/g, '\n');
inCode = inCode.replace(
  'nextAvailableDate: nearest.nearestDateStr,\n          nextAvailableFormatted: nearest.formattedDate',
  'nextAvailableDate: nearest?.nearestDateStr || null,\n          nextAvailableFormatted: nearest?.formattedDate || null'
);
inCode = inCode.replace(
  'nextAvailableDate: nearest.nearestDateStr,\n            nextAvailableFormatted: nearest.formattedDate',
  'nextAvailableDate: nearest?.nearestDateStr || null,\n            nextAvailableFormatted: nearest?.formattedDate || null'
);
fs.writeFileSync(inPath, inCode, 'utf8');
console.log('Fixed in-clinic-booking/route.ts');
