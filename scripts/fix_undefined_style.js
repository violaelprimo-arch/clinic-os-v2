const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

c = c.replace(
  /: undefined\s*\}/,
  `: { paddingTop: '2rem' } }`
);

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', c);
console.log('Fixed undefined style in prescriptions page!');
