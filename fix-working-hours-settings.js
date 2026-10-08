const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

c = c.replace(
  "const [hidePrices, setHidePrices] = useState(false)",
  "const [hidePrices, setHidePrices] = useState(false)\n  const [workingDays, setWorkingDays] = useState<string[]>([])\n  const [workingHoursStart, setWorkingHoursStart] = useState('09:00')\n  const [workingHoursEnd, setWorkingHoursEnd] = useState('22:00')"
);

const loadReplace = `setHidePrices(data.hidePrices === true)\n        setWorkingDays(data.workingDays || ['Saturday', 'Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday'])\n        setWorkingHoursStart(data.workingHoursStart || '09:00')\n        setWorkingHoursEnd(data.workingHoursEnd || '22:00')`;
c = c.replace("setHidePrices(data.hidePrices === true)", loadReplace);

const saveReplace = `hidePrices,\n      workingDays,\n      workingHoursStart,\n      workingHoursEnd,`;
c = c.replace("hidePrices,", saveReplace);

const uiReplace = `<div className="pt-4 border-t border-[#E5EAF0]">
              <div className="flex items-center justify-between pb-3">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-[#182230]">مواعيد عمل العيادة</h4>
                  <p className="text-xs text-slate-500">حدد أيام العمل وساعات العمل. لن يتمكن المرضى من الحجز خارج هذه الأوقات.</p>
                </div>
              </div>
              <div className="space-y-4 pt-2">
                <div className="flex flex-wrap gap-2">
                  {[
                    { id: 'Saturday', name: 'السبت' }, { id: 'Sunday', name: 'الأحد' }, 
                    { id: 'Monday', name: 'الاثنين' }, { id: 'Tuesday', name: 'الثلاثاء' }, 
                    { id: 'Wednesday', name: 'الأربعاء' }, { id: 'Thursday', name: 'الخميس' }, 
                    { id: 'Friday', name: 'الجمعة' }
                  ].map(day => (
                    <Button
                      key={day.id}
                      type="button"
                      variant={workingDays.includes(day.id) ? "default" : "outline"}
                      onClick={() => {
                        if (workingDays.includes(day.id)) setWorkingDays(workingDays.filter(d => d !== day.id));
                        else setWorkingDays([...workingDays, day.id]);
                      }}
                      className={workingDays.includes(day.id) ? "bg-[#15B8A6] hover:bg-[#0D9488] text-white" : ""}
                    >
                      {day.name}
                    </Button>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-4 max-w-sm">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">من الساعة</Label>
                    <Input type="time" value={workingHoursStart} onChange={e => setWorkingHoursStart(e.target.value)} />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-600">إلى الساعة</Label>
                    <Input type="time" value={workingHoursEnd} onChange={e => setWorkingHoursEnd(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            <div className="pt-4 border-t border-[#E5EAF0]">`;

c = c.replace(`<div className="pt-4 border-t border-[#E5EAF0]">`, uiReplace);

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c);
