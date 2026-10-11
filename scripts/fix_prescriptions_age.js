const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

c = c.replace(
  /if \(selected\) \{\s*setPatientName\(selected\.patientName \|\| ''\)\s*setPatientPhone\(selected\.phone \|\| ''\)\s*\}/,
  `if (selected) {
                        setPatientName(selected.patientName || '')
                        setPatientPhone(selected.phone || '')
                        setAge(selected.age || selected.dob || '')
                      }`
);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
console.log('Fixed age autofill in prescriptions page!');
