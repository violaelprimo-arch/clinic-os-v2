const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', 'utf8');

content = content.replace("</DialogTrigger>\n          </div>\n          <DialogContent", "</DialogTrigger>\n          <DialogContent");
content = content.replace("</Dialog>\n      </div>", "</Dialog>\n        </div>\n      </div>");

fs.writeFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', content);
