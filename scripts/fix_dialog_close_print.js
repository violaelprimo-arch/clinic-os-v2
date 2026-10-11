const fs = require('fs');
let c = fs.readFileSync('src/components/ui/dialog.tsx', 'utf8');

c = c.replace(
  /className="absolute top-2 right-2"/g,
  'className="absolute top-2 right-2 print:hidden"'
);

fs.writeFileSync('src/components/ui/dialog.tsx', c);
console.log('Fixed Dialog close button print css!');
