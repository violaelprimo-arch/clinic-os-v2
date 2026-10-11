const fs = require('fs');

const pFile = 'src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx';
let c = fs.readFileSync(pFile, 'utf8');

// Fix DialogTrigger asChild
c = c.replace(/<DialogTrigger asChild>/g, `<DialogTrigger>`);

// Fix FileText import
if (!c.includes('FileText')) {
  c = c.replace(
    /Save, MessageCircle } from 'lucide-react'/,
    `Save, MessageCircle, FileText } from 'lucide-react'`
  );
  if (!c.includes('FileText')) {
     c = c.replace(
      /Save } from 'lucide-react'/,
      `Save, MessageCircle, FileText } from 'lucide-react'`
     );
  }
}

fs.writeFileSync(pFile, c);
