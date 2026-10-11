const fs = require('fs');

const pFile = 'src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx';
let c = fs.readFileSync(pFile, 'utf8');

c = c.replace(
  /Save, MessageCircle \} from 'lucide-react'/,
  `Save, MessageCircle, FileText } from 'lucide-react'`
);

fs.writeFileSync(pFile, c);
