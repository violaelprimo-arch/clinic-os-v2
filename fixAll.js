const fs = require('fs');

function fixModel(file) {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/models\/gemini-pro:generateContent/g, 'models/gemini-1.5-flash:generateContent');
  fs.writeFileSync(file, content);
}
fixModel('src/app/api/chat/route.ts');
fixModel('src/app/api/ai-train/route.ts');

let ownerContent = fs.readFileSync('src/app/owner/page.tsx', 'utf8');

// Remove the input field in the grid
ownerContent = ownerContent.replace(/<div className="space-y-2"><Label>Gemini API Key<\/Label><Input type="password" value=\{aiApiKey\} onChange=\{e => setAiApiKey\(e\.target\.value\)\} dir="ltr" className="text-right" placeholder="AIzaSy\.\.\." \/><\/div>/g, '');

fs.writeFileSync('src/app/owner/page.tsx', ownerContent);
console.log('Fixed model and cleaned owner page UI');
