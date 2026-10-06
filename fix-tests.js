const fs = require('fs');
let content = fs.readFileSync('tests/clinic-simulation.spec.ts', 'utf8');

content = content.replace(/\.filter\(\{ state: 'visible' \}\)/g, '.first()');

fs.writeFileSync('tests/clinic-simulation.spec.ts', content);
