const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');
console.log(c.substring(c.indexOf('تم تسجيل حجزك بنجاح') - 200, c.indexOf('تم تسجيل حجزك بنجاح') + 2500));
