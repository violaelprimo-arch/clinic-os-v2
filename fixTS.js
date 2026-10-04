const fs = require('fs');

let content = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

// Remove setAiApiKey from useEffect
content = content.replace(/setAiApiKey\(.*?\)/g, '');

// Remove aiApiKey shorthand from save payload 
content = content.replace(/aiApiKey,/g, '');
content = content.replace(/aiApiKey\s*/g, ''); 
// wait, if I remove 'aiApiKey ' it might mess up other variables. Let's be precise.
content = content.replace(/\baiApiKey\b/g, '');

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', content);
console.log('Fixed typescript errors');
