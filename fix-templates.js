const fs = require('fs');
['src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 
 'src/app/clinic/[slug]/admin/prescriptions/page.tsx', 
 'src/components/clinic/A4Prescription.tsx'].forEach(f => {
  if (fs.existsSync(f)) {
    let c = fs.readFileSync(f, 'utf8');
    // Replace literal '\${' with '${'
    c = c.replace(/\\\$\\{/g, '${'); // Oh wait, backslashes in regex: '\\$\\{' matches '\${'.
    // Let's just do split.join:
    c = c.split('\\${').join('${');
    fs.writeFileSync(f, c);
  }
});
