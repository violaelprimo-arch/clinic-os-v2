const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/patient/login/page.tsx', 'utf8');

c = c.replace(/<div className="space-y-1.5">\s*<Label className="text-xs font-bold text-slate-600">كلمة المرور<\/Label>[\s\S]*?<\/div>\s*<\/div>/g, '');
// Let's just use string replace for the whole block
const pwdBlock = `            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-slate-600">كلمة المرور</Label>
              <div className="relative">
                <Lock className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 z-10" />
                <PasswordInput 
                  required 
                  value={phone} 
                  onChange={e => setPassword(e.target.value)} 
                  placeholder="••••••••" 
                  className="pr-10 h-11 text-xs bg-slate-50 rounded-xl border-[#E5EAF0] focus:bg-white"
                />
              </div>
            </div>`;

c = c.replace(pwdBlock, '');
c = c.replace(/phone,\s*phone,/g, 'phone,');
c = c.replace(/where\('phone', '==', phone\), where\('phone', '==', phone\)/g, "where('phone', '==', phone)");

fs.writeFileSync('src/app/clinic/[slug]/patient/login/page.tsx', c);
