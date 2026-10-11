const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/page.tsx', 'utf8');

c = c.replace(
  /setError\('تم ايقاف نشاط العيادة مؤقتا من قبل الادارة\.'\)/g,
  "setError('العيادة غير موجودة')"
);

c = c.replace(
  /setError\('انتهت فترة نشاط العيادة\. يرجى التواصل مع الادارة\.'\)/g,
  "setError('العيادة غير موجودة')"
);

fs.writeFileSync('src/app/clinic/[slug]/page.tsx', c);
console.log('Fixed patient page errors!');
