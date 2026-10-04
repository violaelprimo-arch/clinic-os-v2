const fs = require('fs');

let content = fs.readFileSync('src/app/api/chat/route.ts', 'utf8');

content = content.replace(/if\s*\(data\.error\)\s*\{[\s\S]*?return NextResponse\.json\(\{ reply: '.*?' \}\)\s*\}/, 
  `if (data.error) {
      console.error('Gemini API Error:', data.error);
      return NextResponse.json({ reply: 'خطأ من جوجل: ' + (data.error.message || 'المفتاح غير صالح') });
    }`);

fs.writeFileSync('src/app/api/chat/route.ts', content);
console.log('Fixed chat route error reporting');
