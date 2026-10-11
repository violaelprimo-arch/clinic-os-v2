const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

c = c.replace(
  /const \[patientName, setPatientName\] = useState\(searchParams\?\.get\('patientName'\) \|\| ''\)/,
  `const [appointmentId, setAppointmentId] = useState(searchParams?.get('appointmentId') || '');\n  const [patientName, setPatientName] = useState(searchParams?.get('patientName') || '')`
);

c = c.replace(
  /setPatientName\(selected\.patientName \|\| ''\)/,
  `setPatientName(selected.patientName || '')\n                        setAppointmentId(selected.id)`
);

c = c.replace(
  /if \(searchParams\?\.get\('appointmentId'\)\) \{/g,
  `if (appointmentId) {`
);

c = c.replace(
  /searchParams\.get\('appointmentId'\) as string/g,
  `appointmentId`
);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
console.log('Fixed appointmentId in prescriptions page!');
