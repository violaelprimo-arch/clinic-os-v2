const fs = require('fs');
const f = 'src/app/clinic/[slug]/admin/settings/page.tsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(
  /<div className="space-y-3">\s*<h4 className="font-bold text-sm text-\[#182230\]">نظام ترتيب الأدوار/,
  `<div className="space-y-4 pt-4 border-t border-[#E5EAF0]">
    <h4 className="font-bold text-sm text-[#182230]">مواعيد العمل الأسبوعية</h4>
    <p className="text-xs text-slate-500">تحديد أيام العمل ومواعيد استقبال المرضى</p>
    <div className="space-y-3">
      {weeklySchedule.map((day, idx) => (
        <div key={day.id} className="flex items-center justify-between p-3 bg-slate-50 border border-slate-200 rounded-xl">
          <div className="flex items-center gap-3 w-32">
            <Switch
              checked={day.isOpen}
              onCheckedChange={(val) => {
                const newS = [...weeklySchedule];
                newS[idx].isOpen = val;
                setWeeklySchedule(newS);
              }}
            />
            <span className="text-xs font-bold text-slate-700">{day.day}</span>
          </div>
          {day.isOpen && (
            <div className="flex items-center gap-2">
              <Input
                type="time"
                value={day.start}
                onChange={(e) => {
                  const newS = [...weeklySchedule];
                  newS[idx].start = e.target.value;
                  setWeeklySchedule(newS);
                }}
                className="h-9 text-xs w-28"
              />
              <span className="text-xs text-slate-400">إلى</span>
              <Input
                type="time"
                value={day.end}
                onChange={(e) => {
                  const newS = [...weeklySchedule];
                  newS[idx].end = e.target.value;
                  setWeeklySchedule(newS);
                }}
                className="h-9 text-xs w-28"
              />
            </div>
          )}
        </div>
      ))}
    </div>
  </div>

  <div className="space-y-3 pt-4 border-t border-[#E5EAF0]">
    <h4 className="font-bold text-sm text-[#182230]">نظام ترتيب الأدوار`
);

fs.writeFileSync(f, c);
console.log('Settings updated!');
