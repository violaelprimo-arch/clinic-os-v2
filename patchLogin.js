const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/login/page.tsx', 'utf8');

const newLoginLogic = `
            // Check if credentials match either doctor or assistant
            const isDoctor = clinicDoc.doctorEmail === inputEmail && clinicDoc.doctorPassword === password
            let isAssistant = clinicDoc.assistantEmail === inputEmail && clinicDoc.assistantPassword === password

            // Also check multiple assistants array
            if (!isAssistant && clinicDoc.assistants) {
              const matchedAss = clinicDoc.assistants.find(a => a.email === inputEmail && a.password === password)
              if (matchedAss) isAssistant = true;
            }

            if (isDoctor || isAssistant) {
`;

content = content.replace(`            // Check if credentials match either doctor or assistant
            const isDoctor = clinicDoc.doctorEmail === inputEmail && clinicDoc.doctorPassword === password
            const isAssistant = clinicDoc.assistantEmail === inputEmail && clinicDoc.assistantPassword === password

            if (isDoctor || isAssistant) {`, newLoginLogic);

fs.writeFileSync('src/app/clinic/[slug]/login/page.tsx', content);
console.log('Successfully updated login/page.tsx');
