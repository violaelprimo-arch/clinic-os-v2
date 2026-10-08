const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

c = c.replace(
  "const [allowPatientMedicalView, setAllowPatientMedicalView] = useState(true)",
  "const [allowPatientMedicalView, setAllowPatientMedicalView] = useState(true)\n  const [hidePrices, setHidePrices] = useState(false)"
);

const loadFind = `setAllowPatientMedicalView(data.allowPatientMedicalView !== false)`;
const loadReplace = `setAllowPatientMedicalView(data.allowPatientMedicalView !== false)\n        setHidePrices(data.hidePrices === true)`;
c = c.replace(loadFind, loadReplace);

const saveFind = `allowPatientMedicalView,`;
const saveReplace = `allowPatientMedicalView,\n      hidePrices,`;
c = c.replace(saveFind, saveReplace);

const uiFind = `<div className="pt-4 border-t border-[#E5EAF0]">
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
            </div>`;

const uiReplace = `<div className="pt-4 border-t border-[#E5EAF0]">
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
            
            <div className="pt-4 border-t border-[#E5EAF0]">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#182230]">إخفاء أسعار الخدمات</h4>
                  <p className="text-xs text-slate-500">منع ظهور الأسعار في واجهة الحجز الخاصة بالمرضى (تظل ظاهرة لك وللسكرتارية).</p>
                </div>
                <Switch 
                  checked={hidePrices}
                  onCheckedChange={setHidePrices}
                />
              </div>
            </div>`;

c = c.replace(uiFind, uiReplace);

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c);
