const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/layout.tsx', 'utf8');

c = c.replace(
  /<nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white\/95 backdrop-blur-md border-t border-\[#E5EAF0\] px-3 py-2 z-40 flex justify-around items-center shadow-lg">/,
  '<nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white/95 backdrop-blur-md border-t border-[#E5EAF0] px-3 py-2 z-40 flex justify-around items-center shadow-lg print:hidden">'
);

fs.writeFileSync('src/app/clinic/[slug]/admin/layout.tsx', c);
console.log('Fixed admin mobile nav print css!');
