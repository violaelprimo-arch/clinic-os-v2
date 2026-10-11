const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');
let s = c.indexOf('type="date"');
console.log(c.substring(s-300, s+600));
