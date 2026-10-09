import fs from 'fs';
const c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
const s = c.indexOf("activeTab === 'queue'");
console.log(c.substring(s, s + 1500));
