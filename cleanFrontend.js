const fs = require('fs');

// AIChatWidget
let chatWidget = fs.readFileSync('src/components/clinic/AIChatWidget.tsx', 'utf8');
chatWidget = chatWidget.replace(/aiApiKey:\s*clinic\?\.aiApiKey\s*\|\|\s*'',/, '');
fs.writeFileSync('src/components/clinic/AIChatWidget.tsx', chatWidget);

// AI Training Page
let aiTraining = fs.readFileSync('src/app/clinic/[slug]/admin/ai-training/page.tsx', 'utf8');
aiTraining = aiTraining.replace(/if\s*\(!hasApiKey\)\s*\{[\s\S]*?return\n\s*\}/, '');
aiTraining = aiTraining.replace('body: JSON.stringify({ slug, newMessages, aiApiKey: apiKey })', 'body: JSON.stringify({ slug, newMessages })');
fs.writeFileSync('src/app/clinic/[slug]/admin/ai-training/page.tsx', aiTraining);

console.log('Cleaned up frontend api key logic');
