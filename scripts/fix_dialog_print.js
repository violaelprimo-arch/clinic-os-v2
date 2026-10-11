const fs = require('fs');
let c = fs.readFileSync('src/components/ui/dialog.tsx', 'utf8');

c = c.replace(
  /"fixed inset-0 isolate z-50 bg-black\/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0",/,
  '"fixed inset-0 isolate z-50 bg-black/10 duration-100 supports-backdrop-filter:backdrop-blur-xs data-open:animate-in data-open:fade-in-0 data-closed:animate-out data-closed:fade-out-0 print:hidden",'
);

fs.writeFileSync('src/components/ui/dialog.tsx', c);
console.log('Fixed dialog overlay print css!');
