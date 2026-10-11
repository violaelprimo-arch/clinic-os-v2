const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/patient/login/page.tsx', 'utf8');
// It became import { PhoneInput } from '@/components/ui/phone-input' or similar because of global replace.
// Let's just remove that line since it's not used.
c = c.split('\n').filter(line => !line.includes('components/ui/phone-input') && !line.includes('components/ui/password-input')).join('\n');
fs.writeFileSync('src/app/clinic/[slug]/patient/login/page.tsx', c);
