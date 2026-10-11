const fs = require('fs');

const pFile = 'src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx';
let c = fs.readFileSync(pFile, 'utf8');

const funcsBlock = `
  const handlePrint = () => {
    window.print()
  }

  const sendWhatsAppRx = (appt: any) => {
    if (!phone) return toast.error('يرجى إدخال رقم هاتف المريض')
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone

    const drugsList = appt.drugs
      .filter((d: any) => d.name)
      .map((d: any, i: number) => \`\${i + 1}. \${d.name} (\${d.dosage} - \${d.duration})\`)
      .join('\\n')

    const message = encodeURIComponent(
      \`الروشتة الطبية الإلكترونية 📋\\nالعيادة: \${clinic?.clinicName || 'العيادة'}\\nالمريض: \${patientData?.name}\\nالتاريخ: \${appt.date}\\n\\nالعلاج المطلوب:\\n\${drugsList}\\n\\nنتمنى لك الشفاء العاجل!\`
    )
    window.open(\`https://wa.me/\${formattedPhone}?text=\${message}\`, '_blank')
  }`;

// Remove it from the wrong place
c = c.replace(`export default function PatientProfilePage({${funcsBlock}`, `export default function PatientProfilePage({`);

// Find the correct opening brace of the function body
const searchStr = `  const phone = decodeURIComponent(patientId)`;
c = c.replace(searchStr, `${funcsBlock}\n\n${searchStr}`);

fs.writeFileSync(pFile, c);
