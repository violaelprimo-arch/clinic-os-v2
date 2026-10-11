const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/page.tsx', 'utf8');

c = c.replace(/if \(clinicData\.isActive === false\) {[\s\S]*?return\s*}/g, `if (clinicData.isActive === false) {
          setError('العيادة غير موجودة')
          setClinic(null)
          setLoading(false)
          return
        }`);

c = c.replace(/if \(clinicData\.expirationDate && new Date\(clinicData\.expirationDate\) < new Date\(\)\) {[\s\S]*?return\s*}/g, `if (clinicData.expirationDate && new Date(clinicData.expirationDate) < new Date()) {
          setError('العيادة غير موجودة')
          setClinic(null)
          setLoading(false)
          return
        }`);

fs.writeFileSync('src/app/clinic/[slug]/page.tsx', c);
console.log('Fixed patient page errors safely!');
