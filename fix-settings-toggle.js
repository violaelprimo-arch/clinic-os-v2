const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

// 1. Add state for the new toggle
c = c.replace(
  "const [averageVisitTime, setAverageVisitTime] = useState(15)",
  "const [averageVisitTime, setAverageVisitTime] = useState(15)\n  const [allowPatientMedicalView, setAllowPatientMedicalView] = useState(true)"
);

// 2. Fetch the state from clinic doc
const loadFind = `setAverageVisitTime(data.averageVisitTime || 15)`;
const loadReplace = `setAverageVisitTime(data.averageVisitTime || 15)\n        setAllowPatientMedicalView(data.allowPatientMedicalView !== false)`;
c = c.replace(loadFind, loadReplace);

// 3. Save the state to clinic doc
const saveFind = `averageVisitTime: Number(averageVisitTime) || 15,`;
const saveReplace = `averageVisitTime: Number(averageVisitTime) || 15,\n      allowPatientMedicalView,`;
c = c.replace(saveFind, saveReplace);

// 4. Add the toggle UI in the "profile" or "queue" tab? The prompt says "في إعدادات الطبيب". Let's put it in profile tab.
const uiFind = `              <p className="text-[11px] text-slate-400">
                هذا الرابط سيتوجه إليه المريض للوصول للعيادة.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 2. Queue Settings Tab */}`;

const uiReplace = `              <p className="text-[11px] text-slate-400">
                هذا الرابط سيتوجه إليه المريض للوصول للعيادة.
              </p>
            </div>
            
            <div className="pt-4 border-t border-[#E5EAF0]">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#182230]">بوابة المرضى (Patient Portal)</h4>
                  <p className="text-xs text-slate-500">السماح للمرضى برؤية الروشتات والتشخيصات من حساباتهم. إذا تم إغلاقه، سيظهر لهم فقط تاريخ الزيارة.</p>
                </div>
                <Switch 
                  checked={allowPatientMedicalView}
                  onCheckedChange={setAllowPatientMedicalView}
                />
              </div>
            </div>

          </div>
        </div>
      )}

      {/* 2. Queue Settings Tab */}`;

c = c.replace(uiFind, uiReplace);

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c);
