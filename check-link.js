const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');
let idx = c.indexOf('appointmentId=${appt.id}&phone=${phone}&patientName=${name}&age=${age}');
console.log(c.substring(idx - 200, idx + 200));
