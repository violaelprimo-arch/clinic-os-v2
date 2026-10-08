const fs = require('fs');

[
  'src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 
  'src/components/clinic/A4Prescription.tsx', 
  'src/app/clinic/[slug]/admin/prescriptions/page.tsx', 
  'src/app/clinic/[slug]/patient/page.tsx', 
  'src/components/clinic/BookingForm.tsx'
].forEach(f => { 
  if (fs.existsSync(f)) { 
    let c = fs.readFileSync(f, 'utf8'); 
    c = c.replace(/\\\$\\{/g, '${'); 
    fs.writeFileSync(f, c); 
  } 
});
