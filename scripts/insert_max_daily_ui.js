const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

const target = `<div className="space-y-4 pt-4 border-t border-[#E5EAF0]">
    <h4 className="font-bold text-sm text-[#182230]">مواعيد العمل الأسبوعية</h4>`;

const addition = `<div className="space-y-2 pb-4 border-b border-[#E5EAF0]">
              <Label className="text-xs font-bold text-slate-600">
                الحد الأقصى لعدد الكشوفات يومياً
              </Label>
              <Input
                type="number"
                value={maxDailyBookings || ''}
                onChange={e => setMaxDailyBookings(Number(e.target.value) || 0)}
                placeholder="مثال: 50 (أو 0 لعدد غير محدود)"
                className="h-10 text-sm rounded-xl max-w-xs font-bold"
                min={0}
                max={500}
              />
              <p className="text-[11px] text-slate-400">
                عند اكتمال هذا العدد من الحجوزات في أي يوم، يتم إغلاق الحجز لذلك اليوم تلقائياً وإتاحة اليوم التالي للمرضى.
              </p>
            </div>

            ` + target;

if (c.includes(target)) {
  c = c.replace(target, addition);
  fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c, 'utf8');
  console.log('Successfully added maxDailyBookings UI to settings/page.tsx!');
} else {
  console.error('Target not found in settings/page.tsx!');
}
