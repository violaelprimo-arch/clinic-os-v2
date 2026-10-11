const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

c = c.replace(
  /<span className="text-\[#182230\]">\{age \|\| '28'\} سنة<\/span>/g,
  '<span className="text-[#182230]">{age ? age + " سنة" : "....................."}</span>'
);

c = c.replace(
  /placeholder="28 سنة"/g,
  'placeholder="مثال: 25 سنة"'
);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
console.log('Fixed hardcoded 28 in prescriptions page!');
