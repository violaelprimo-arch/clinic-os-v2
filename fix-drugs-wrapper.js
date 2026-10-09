const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', 'utf8');

c = c.replace(/<\/Dialog>\s*<\/div>\s*\{\/\* 2\. Search & Multi-Filters Bar/, '</Dialog>\n        </div>\n      </div>\n\n      {/* 2. Search & Multi-Filters Bar');

fs.writeFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', c);
