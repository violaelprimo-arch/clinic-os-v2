const fs = require('fs');
const pFile = 'src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx';
let c = fs.readFileSync(pFile, 'utf8');

c = c.replace(
  /appointmentId=\$\{appt\.id\}&phone=\$\{phone\}&patientName=\$\{name\}&age=\$\{age\}/g,
  `appointmentId=\$\{appt.id\}&phone=\$\{phone\}&patientName=\$\{patientData?.name\}&age=\$\{patientData?.age || patientData?.dob\}`
);

fs.writeFileSync(pFile, c);
