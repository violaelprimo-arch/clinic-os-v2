const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

// Fix the useState
content = content.replace(/const \[aiInstructions,\s*aiApiKey,\s*setAiInstructions\]/, 'const [aiInstructions, setAiInstructions]');

// Ensure aiApiKey is in the updateDoc call inside handleSave
if (!content.includes('aiApiKey,')) {
    content = content.replace('aiInstructions,', 'aiInstructions,\n        aiApiKey,');
}

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', content);
