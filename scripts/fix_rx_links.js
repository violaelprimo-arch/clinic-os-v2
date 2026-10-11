const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8');

c = c.replace(
  /\/admin\/prescriptions\?patientName=\$\{encodeURIComponent\(b\.patientName\)\}\&patientPhone=\$\{encodeURIComponent\(b\.phone\)\}/g,
  '/admin/prescriptions?appointmentId=${b.id}&patientName=${encodeURIComponent(b.patientName)}&patientPhone=${encodeURIComponent(b.phone)}&age=${encodeURIComponent(b.age || b.dob || \'\')}'
);

c = c.replace(
  /\/admin\/prescriptions\?patientName=\$\{encodeURIComponent\(currentPatient\.patientName\)\}\&patientPhone=\$\{encodeURIComponent\(currentPatient\.phone\)\}/g,
  '/admin/prescriptions?appointmentId=${currentPatient.id}&patientName=${encodeURIComponent(currentPatient.patientName)}&patientPhone=${encodeURIComponent(currentPatient.phone)}&age=${encodeURIComponent(currentPatient.age || currentPatient.dob || \'\')}'
);

fs.writeFileSync('src/components/clinic/AdminDashboard.tsx', c);
console.log('Fixed rx links in AdminDashboard!');
