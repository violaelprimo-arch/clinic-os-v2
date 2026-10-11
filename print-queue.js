const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
let queueTabStart = c.indexOf("activeTab === 'queue'");
console.log(c.substring(queueTabStart, queueTabStart + 2000));
