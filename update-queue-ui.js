const fs = require('fs');

const settingsFile = 'src/app/clinic/[slug]/admin/settings/page.tsx';
let c = fs.readFileSync(settingsFile, 'utf8');

const anchor = `<h4 className="font-bold text-sm text-[#182230]">نظام دخول الطوارئ / الكشف المستعجل</h4>`;
const endAnchor = `يتبعها (كشف مستعجل)</Label>`;
// Actually, let's just replace the whole div className="space-y-3" after averageVisitTime.

const oldRegex = /<div className="space-y-3">\s*<h4 className="font-bold text-sm text-\[#182230\]">نظام دخول الطوارئ \/ الكشف المستعجل<\/h4>[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/;

const newUI = `<div className="space-y-3">
              <h4 className="font-bold text-sm text-[#182230]">نظام ترتيب الأدوار (نمط الدخول)</h4>
              <p className="text-xs text-slate-500">حدد عدد الحالات التي تدخل بالترتيب قبل إعادة الدورة. اكتب (0) للمستعجل ليدخل فوراً قبل أي خدمة أخرى.</p>
              
              <div className="grid grid-cols-3 gap-4 max-w-lg">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 text-rose-600">كشف مستعجل</Label>
                  <Input
                    type="number"
                    value={queueUrgent}
                    onChange={e => setQueueUrgent(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold border-rose-200 bg-rose-50 text-rose-900"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">كشف عادي</Label>
                  <Input
                    type="number"
                    value={queueNormal}
                    onChange={e => setQueueNormal(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600 text-blue-600">استشارة</Label>
                  <Input
                    type="number"
                    value={queueConsult}
                    onChange={e => setQueueConsult(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold border-blue-200 bg-blue-50 text-blue-900"
                    min={0}
                  />
                </div>
              </div>
            </div>`;

c = c.replace(oldRegex, newUI);

fs.writeFileSync(settingsFile, c);
