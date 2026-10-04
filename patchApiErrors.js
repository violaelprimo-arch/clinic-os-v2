const fs = require('fs');

function patchFile(filepath) {
  let content = fs.readFileSync(filepath, 'utf8');
  content = content.replace(/if\s*\(data\.error\)\s*\{[\s\S]*?return\s*NextResponse\.json\(\{ reply: '.*?حدث خطأ في النظام\.' \}\)\s*\}/, 
    `if (data.error) {
      console.error('Gemini API Error:', data.error);
      return NextResponse.json({ reply: 'عذراً، حدث خطأ في مفتاح الذكاء الاصطناعي: ' + (data.error.message || 'المفتاح غير صالح') });
    }`);
  fs.writeFileSync(filepath, content);
}

patchFile('src/app/api/ai-train/route.ts');
patchFile('src/app/api/chat/route.ts');
console.log('Patched API error handling');
