const fs = require('fs');

const pFile = 'src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx';
let pContent = fs.readFileSync(pFile, 'utf8');

pContent = pContent.replace(
  /href=\{`\/clinic\/\$\{slug\}\/admin\/prescriptions\?appointmentId=\$\{appt\.id\}&phone=\$\{phone\}`\}/g,
  `href={\`/clinic/\${slug}/admin/prescriptions?appointmentId=\${appt.id}&phone=\${phone}&patientName=\${name}&age=\${age}\`}`
);

fs.writeFileSync(pFile, pContent);

const rFile = 'src/app/clinic/[slug]/admin/prescriptions/page.tsx';
let rContent = fs.readFileSync(rFile, 'utf8');

rContent = rContent.replace(
  `const [age, setAge] = useState('28')`,
  `const [age, setAge] = useState(searchParams?.get('age') || '')`
);
rContent = rContent.replace(
  `const [patientPhone, setPatientPhone] = useState(searchParams?.get('patientPhone') || '')`,
  `const [patientPhone, setPatientPhone] = useState(searchParams?.get('phone') || searchParams?.get('patientPhone') || '')`
);

fs.writeFileSync(rFile, rContent);
