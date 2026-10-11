const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');

const target = `<A4Prescription 
                                  clinic={clinic}
                                  patientName={patientData.name}
                                  age={patientData.age || patientData.dob}
                                  date={appt.date}
                                  diagnosis={appt.diagnosis}
                                  drugs={appt.drugs}
                                  templateMode={clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'}
                                  topOffset={180}
                                />`;

const replacement = `<A4Prescription 
                                  clinic={clinic}
                                  patientName={patientData?.name || appt?.patientName || 'المريض'}
                                  age={patientData?.age || appt?.age || patientData?.dob || appt?.dob || ''}
                                  date={appt.date}
                                  diagnosis={appt.diagnosis}
                                  drugs={appt.drugs}
                                  templateMode={clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'}
                                  topOffset={25}
                                />`;

// Fallback regex in case of formatting
if (c.includes(target)) {
  c = c.replace(target, replacement);
  console.log('Direct string replace succeeded!');
} else {
  c = c.replace(
    /<A4Prescription[\s\S]*?topOffset=\{180\}[\s\S]*?\/>/,
    replacement
  );
  console.log('Regex replace ran!');
}

fs.writeFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', c, 'utf8');
console.log('Successfully updated patient profile A4Prescription call!');
