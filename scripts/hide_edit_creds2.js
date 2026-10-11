const fs = require('fs');
let c = fs.readFileSync('src/app/owner/page.tsx', 'utf8');

c = c.replace(
  /<div className="space-y-3">\s*<h3 className="text-xs font-black text-slate-700 flex items-center gap-2">\s*<Users className="w-4 h-4 text-\[#15B8A6\]" \/>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/,
  match => `{!editingId && (
${match}
)}`
);

fs.writeFileSync('src/app/owner/page.tsx', c);
console.log('Hidden emails in edit mode for real!');
