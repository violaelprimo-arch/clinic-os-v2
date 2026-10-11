const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');
c = c.replace(/paymentStatus: paymentMethod === 'cash' \? 'pending' : 'paid'/g, "paymentStatus: 'pending'");
fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
