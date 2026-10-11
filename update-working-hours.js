const fs = require('fs');

const settingsFile = 'src/app/clinic/[slug]/admin/settings/page.tsx';
let c = fs.readFileSync(settingsFile, 'utf8');

const oldStates = `  const [workingDays, setWorkingDays] = useState<string[]>([])
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00')
  const [workingHoursEnd, setWorkingHoursEnd] = useState('22:00')`;

const newStates = `  const [weeklySchedule, setWeeklySchedule] = useState([
    { day: 'السبت', isOpen: true, start: '09:00', end: '22:00', id: 'saturday' },
    { day: 'الأحد', isOpen: true, start: '09:00', end: '22:00', id: 'sunday' },
    { day: 'الاثنين', isOpen: true, start: '09:00', end: '22:00', id: 'monday' },
    { day: 'الثلاثاء', isOpen: true, start: '09:00', end: '22:00', id: 'tuesday' },
    { day: 'الأربعاء', isOpen: true, start: '09:00', end: '22:00', id: 'wednesday' },
    { day: 'الخميس', isOpen: true, start: '09:00', end: '22:00', id: 'thursday' },
    { day: 'الجمعة', isOpen: false, start: '09:00', end: '22:00', id: 'friday' }
  ])`;

c = c.replace(oldStates, newStates);

// Replace save logic
c = c.replace(
  `workingDays,
      workingHoursStart,
      workingHoursEnd,`,
  `weeklySchedule,`
);

// Replace load logic
const oldLoad = `          if (data.workingDays) setWorkingDays(data.workingDays)
          if (data.workingHoursStart) setWorkingHoursStart(data.workingHoursStart)
          if (data.workingHoursEnd) setWorkingHoursEnd(data.workingHoursEnd)`;
const newLoad = `          if (data.weeklySchedule) setWeeklySchedule(data.weeklySchedule)`;
c = c.replace(oldLoad, newLoad);

// Remove old UI
const oldUIRegex = /\{?\/\*\s*Working Hours\s*\*\/\}?[\s\S]*?(?=\{?\/\*\s*Brand Colors\s*\*\/\}?)/;
const newUI = `{/* Weekly Schedule */}
              <div className="space-y-4 pt-6 border-t border-[#E5EAF0]">
                <div>
                  <h4 className="font-bold text-[#182230] flex items-center gap-2">
                    <Clock className="w-5 h-5 text-[#15B8A6]" />
                    مواعيد عمل العيادة
                  </h4>
                  <p className="text-xs text-slate-500 mt-1">حدد أيام العمل وساعات الدوام لكل يوم، مع إمكانية قفل أيام الإجازة.</p>
                </div>
                <div className="space-y-3 mt-4">
                  {weeklySchedule.map((dayItem, idx) => (
                    <div key={dayItem.id} className={\`flex items-center justify-between p-3 rounded-xl border \${dayItem.isOpen ? 'bg-white border-[#E5EAF0]' : 'bg-slate-50 border-slate-200'}\`}>
                      <div className="flex items-center gap-3">
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            const newSched = [...weeklySchedule];
                            newSched[idx].isOpen = !newSched[idx].isOpen;
                            setWeeklySchedule(newSched);
                          }}
                          className={\`w-12 h-8 rounded-lg text-xs font-bold \${dayItem.isOpen ? 'bg-emerald-50 border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800' : 'bg-slate-200 border-slate-300 text-slate-500 hover:bg-slate-300'}\`}
                        >
                          {dayItem.isOpen ? 'مفتوح' : 'مغلق'}
                        </Button>
                        <span className={\`font-bold w-16 \${dayItem.isOpen ? 'text-[#182230]' : 'text-slate-400'}\`}>{dayItem.day}</span>
                      </div>
                      <div className={\`flex items-center gap-2 \${!dayItem.isOpen && 'opacity-50 pointer-events-none'}\`}>
                        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 px-1">من</span>
                          <Input 
                            type="time" 
                            value={dayItem.start} 
                            onChange={(e) => {
                              const newSched = [...weeklySchedule];
                              newSched[idx].start = e.target.value;
                              setWeeklySchedule(newSched);
                            }}
                            className="h-7 text-xs w-24 p-1 bg-white"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
                          <span className="text-[10px] font-bold text-slate-500 px-1">إلى</span>
                          <Input 
                            type="time" 
                            value={dayItem.end} 
                            onChange={(e) => {
                              const newSched = [...weeklySchedule];
                              newSched[idx].end = e.target.value;
                              setWeeklySchedule(newSched);
                            }}
                            className="h-7 text-xs w-24 p-1 bg-white"
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              `;
c = c.replace(oldUIRegex, newUI);

fs.writeFileSync(settingsFile, c);
