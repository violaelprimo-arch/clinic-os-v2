const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

const aiConfigBlock = `
          {/* AI Settings */}
          <Card className="shadow-lg border-t-4 border-t-blue-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Bot className="w-5 h-5 text-blue-500"/> إعدادات الذكاء الاصطناعي (API)</CardTitle>
              <CardDescription>ضع مفتاح Gemini الخاص بك هنا ليعمل المساعد الذكي.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label className="font-bold text-red-500">Gemini API Key</Label>
                <Input type="password" value={aiApiKey} onChange={e => setAiApiKey(e.target.value)} dir="ltr" className="text-right border-red-200 focus:border-red-500" placeholder="AIzaSy..." />
                <p className="text-xs text-slate-500">يمكنك الحصول عليه مجاناً من https://aistudio.google.com/app/apikey</p>
              </div>
            </CardContent>
          </Card>
`;

content = content.replace('{/* Payment Settings */}', aiConfigBlock + '\n\n          {/* Payment Settings */}');
content = content.replace('aiInstructions,', 'aiInstructions,\n        aiApiKey,');

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', content);
console.log('Added AI Key to settings');
