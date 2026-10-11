const fs = require('fs');
let c = fs.readFileSync('src/app/owner/page.tsx', 'utf8');

c = c.replace(
  /<h3 className="font-black text-sm text-\[#182230\] flex items-center gap-2">\s*<Users className="w-4 h-4 text-\[#15B8A6\]" \/>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
  match => `{!editingId && (
<>
${match}
</>
)}`
);

fs.writeFileSync('src/app/owner/page.tsx', c);
console.log('Hidden emails in edit mode!');
