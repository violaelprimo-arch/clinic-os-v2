const fs = require('fs');

// 1. Update settings/page.tsx to load weeklySchedule from data
let settings = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');
const settingsTarget = "setMaxDailyBookings(data.maxDailyBookings || 0)";
const settingsAddition = `setMaxDailyBookings(data.maxDailyBookings || 0)
          if (data.weeklySchedule && Array.isArray(data.weeklySchedule)) {
            setWeeklySchedule(data.weeklySchedule)
          }`;

if (settings.includes(settingsTarget)) {
  settings = settings.replace(settingsTarget, settingsAddition);
  fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', settings, 'utf8');
  console.log('Successfully added weeklySchedule loading to settings/page.tsx!');
} else {
  console.error('Target not found in settings/page.tsx');
}

// 2. Update PremiumLanding.tsx
let landing = fs.readFileSync('src/components/clinic/PremiumLanding.tsx', 'utf8');

// Add formatTime12 helper function before component or at top
if (!landing.includes('function formatTime12')) {
  const helper = `function formatTime12(timeStr?: string) {
  if (!timeStr) return ''
  const [hStr, mStr] = timeStr.split(':')
  const h = Number(hStr)
  const m = Number(mStr)
  if (isNaN(h)) return timeStr
  const period = h >= 12 ? 'م' : 'ص'
  const hour12 = h % 12 === 0 ? 12 : h % 12
  const minute = m !== undefined && m !== 0 ? \`:\${String(m).padStart(2, '0')}\` : ':00'
  return \`\${hour12}\${minute} \${period}\`
}

`;
  landing = landing.replace('export function PremiumLanding', helper + 'export function PremiumLanding');
}

// Replace Card 1 (Location card working hours)
const card1Target = `<div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-1">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                      <Clock className="w-4 h-4" />
                      <span>مواعيد الحضور والعمل:</span>
                    </div>
                    <p className="text-xs text-slate-200">
                      يومياً من السبت إلى الخميس (من 2:00 ظهراً حتى 10:00 مساءً)
                    </p>
                  </div>`;

const card1Replacement = `<div className="p-3.5 rounded-2xl bg-white/10 backdrop-blur-md border border-white/10 space-y-2">
                    <div className="flex items-center gap-2 text-xs font-bold text-teal-300">
                      <Clock className="w-4 h-4" />
                      <span>مواعيد الحضور والعمل:</span>
                    </div>
                    {clinic?.weeklySchedule && clinic.weeklySchedule.filter((d: any) => d.isOpen).length > 0 ? (
                      <div className="space-y-1.5 text-xs text-slate-200 max-h-40 overflow-y-auto no-scrollbar">
                        {clinic.weeklySchedule.filter((d: any) => d.isOpen).map((d: any) => (
                          <div key={d.id} className="flex justify-between items-center text-[11px] border-b border-white/5 pb-0.5">
                            <span className="font-bold text-white">{d.day}:</span>
                            <span className="font-mono text-teal-200" dir="ltr">
                              {formatTime12(d.start)} — {formatTime12(d.end)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-200">
                        يومياً من السبت إلى الخميس (من 2:00 ظهراً حتى 10:00 مساءً)
                      </p>
                    )}
                  </div>`;

if (landing.includes(card1Target)) {
  landing = landing.replace(card1Target, card1Replacement);
  console.log('Replaced Card 1 working hours!');
} else {
  // Regex fallback
  landing = landing.replace(
    /<div className="p-3\.5 rounded-2xl bg-white\/10[\s\S]*?يومياً من السبت إلى الخميس[\s\S]*?<\/div>/,
    card1Replacement
  );
  console.log('Regex replaced Card 1 working hours!');
}

// Replace Footer Card working hours
const card2Target = `<div className="pt-1.5 border-t border-slate-200/60">
                  <span className="text-[10px] text-slate-400 block">
                    السبت إلى الخميس: 2:00 م — 10:00 م
                  </span>
                </div>`;

const card2Replacement = `<div className="pt-1.5 border-t border-slate-200/60 space-y-1">
                  {clinic?.weeklySchedule && clinic.weeklySchedule.filter((d: any) => d.isOpen).length > 0 ? (
                    clinic.weeklySchedule.filter((d: any) => d.isOpen).map((d: any) => (
                      <div key={d.id} className="flex justify-between items-center text-[10px] text-slate-600">
                        <span className="font-bold text-slate-800">{d.day}:</span>
                        <span className="font-mono text-slate-500" dir="ltr">
                          {formatTime12(d.start)} — {formatTime12(d.end)}
                        </span>
                      </div>
                    ))
                  ) : (
                    <span className="text-[10px] text-slate-400 block">
                      السبت إلى الخميس: 2:00 م — 10:00 م
                    </span>
                  )}
                </div>`;

if (landing.includes(card2Target)) {
  landing = landing.replace(card2Target, card2Replacement);
  console.log('Replaced Footer Card working hours!');
} else {
  landing = landing.replace(
    /<div className="pt-1\.5 border-t border-slate-200\/60">\s*<span className="text-\[10px\] text-slate-400 block">\s*السبت إلى الخميس: 2:00 م — 10:00 م\s*<\/span>\s*<\/div>/,
    card2Replacement
  );
  console.log('Regex replaced Footer Card working hours!');
}

fs.writeFileSync('src/components/clinic/PremiumLanding.tsx', landing, 'utf8');
console.log('Successfully updated PremiumLanding.tsx with dynamic working hours!');
