const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');
let m = c.match(/<Input[^>]*>/g);
console.log(m.filter(i => i.includes('date') || i.includes('time') || i.includes('dateStr') || i.includes('timeStr')));
