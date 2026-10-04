const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8');

content = content.replace('<DialogTrigger asChild>', '');
content = content.replace('</DialogTrigger>', '');
content = content.replace('<Button variant="outline" className="h-12 border-primary/20 text-primary hover:bg-primary/5 px-6">', '<Button variant="outline" onClick={() => setIsFavoritesOpen(true)} className="h-12 border-primary/20 text-primary hover:bg-primary/5 px-6">');

fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', content);
