const fs = require('fs');
const f = 'src/app/clinic/[slug]/admin/settings/page.tsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(/const \[showPrices,[\s\S]*?setShowPrices\] = useState\(true\)/, 'const [showPrices, setShowPrices] = useState(true)');

c = c.replace(/isClinicOpen,\s*showPrices,/, `isClinicOpen,
        showPrices,
        ...(newDoctorEmail ? { doctorEmail: newDoctorEmail } : {}),
        ...(newDoctorPassword ? { doctorPassword: newDoctorPassword } : {}),`);

fs.writeFileSync(f, c);
console.log('Fixed settings!');
