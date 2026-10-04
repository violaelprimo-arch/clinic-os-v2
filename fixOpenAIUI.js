const fs = require('fs');
let content = fs.readFileSync('src/app/owner/page.tsx', 'utf8');

content = content.replace('إعدادات النظام المركزية (Global AI)', 'إعدادات النظام المركزية (OpenAI / ChatGPT)');
content = content.replace('مفتاح Gemini API الخاص بك', 'مفتاح OpenAI API الخاص بك');
content = content.replace('AIzaSy...', 'sk-proj-...');

fs.writeFileSync('src/app/owner/page.tsx', content);
console.log('Owner UI updated to OpenAI');
