const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

c = c.replace(
  "const [regularPerUrgent, setRegularPerUrgent] = useState(2)",
  "const [queueNormal, setQueueNormal] = useState(3)\n  const [queueConsult, setQueueConsult] = useState(2)\n  const [queueUrgent, setQueueUrgent] = useState(1)"
);
c = c.replace("const [urgentPerRegular, setUrgentPerRegular] = useState(1)", "");

// Load settings
c = c.replace("setRegularPerUrgent(data.regularPerUrgent || 2)", "setQueueNormal(data.queueNormal ?? 3)\n        setQueueConsult(data.queueConsult ?? 2)\n        setQueueUrgent(data.queueUrgent ?? 1)");
c = c.replace("setUrgentPerRegular(data.urgentPerRegular || 1)", "");

// Save settings
c = c.replace("regularPerUrgent: Number(regularPerUrgent) || 2,", "queueNormal: Number(queueNormal) ?? 3,\n      queueConsult: Number(queueConsult) ?? 2,\n      queueUrgent: Number(queueUrgent) ?? 1,");
c = c.replace("urgentPerRegular: Number(urgentPerRegular) || 1,", "");

// Change UI
const findUI = `<div className="space-y-3">
              <h4 className="font-bold text-sm text-[#182230]">نظام دخول الطوارئ / الكشف المستعجل</h4>
              <p className="text-xs text-slate-500">يحدد كم كشف عادي يدخل بعده كشف مستعجل تلقائياً في شاشة الدور</p>
              
              <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">عدد الكشوفات العادية</Label>
                  <Input
                    type="number"
                    value={regularPerUrgent}
                    onChange={e => setRegularPerUrgent(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold"
                    min={1}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">عدد الكشوفات المستعجلة</Label>
                  <Input
                    type="number"
                    value={urgentPerRegular}
                    onChange={e => setUrgentPerRegular(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold"
                    min={1}
                  />
                </div>
              </div>
            </div>`;

const replaceUI = `<div className="space-y-3">
              <h4 className="font-bold text-sm text-[#182230]">نمط دخول المرضى في الدور</h4>
              <p className="text-xs text-slate-500">
                حدد الترتيب التلقائي (مثلاً: 3 عادي، ثم 2 استشارة، ثم 1 مستعجل).
                <br/>
                <strong className="text-amber-600">ملاحظة: </strong>
                إذا تم تعيين المستعجل على 0، فهذا يعني أن الطوارئ تدخل فورا بمجرد التسجيل!
              </p>
              
              <div className="grid grid-cols-3 gap-4 max-w-md">
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-600">كشف عادي</Label>
                  <Input
                    type="number"
                    value={queueNormal}
                    onChange={e => setQueueNormal(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-600">استشارة</Label>
                  <Input
                    type="number"
                    value={queueConsult}
                    onChange={e => setQueueConsult(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold"
                    min={0}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[10px] font-bold text-slate-600">كشف مستعجل</Label>
                  <Input
                    type="number"
                    value={queueUrgent}
                    onChange={e => setQueueUrgent(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl font-bold"
                    min={0}
                  />
                </div>
              </div>
            </div>`;

c = c.replace(findUI, replaceUI);

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c);
