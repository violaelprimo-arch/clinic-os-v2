const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

// 1. Add state
c = c.replace(
  /const \[averageVisitTime, setAverageVisitTime\] = useState<number>\(15\)/,
  `const [averageVisitTime, setAverageVisitTime] = useState<number>(15)
  const [maxDailyBookings, setMaxDailyBookings] = useState<number>(0)`
);

// 2. Load from Firestore
c = c.replace(
  /setAverageVisitTime\(data\.averageVisitTime \|\| 15\)/,
  `setAverageVisitTime(data.averageVisitTime || 15)
          setMaxDailyBookings(data.maxDailyBookings || 0)`
);

// 3. Save to Firestore
c = c.replace(
  /averageVisitTime: Number\(averageVisitTime\) \|\| 15,/,
  `averageVisitTime: Number(averageVisitTime) || 15,
        maxDailyBookings: Number(maxDailyBookings) || 0,`
);

// 4. Add UI in queue tab
const queueUiTarget = `<p className="text-[11px] text-slate-400">
                يُستخدم لحساب الوقت التقريبي المتبقي لشاشة تتبع دور المريض الذكية تلقائياً.
              </p>
            </div>`;

const queueUiAddition = `<p className="text-[11px] text-slate-400">
                يُستخدم لحساب الوقت التقريبي المتبقي لشاشة تتبع دور المريض الذكية تلقائياً.
              </p>
            </div>

            <div className="space-y-2 pb-4 border-b border-[#E5EAF0]">
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
            </div>`;

c = c.replace(queueUiTarget, queueUiAddition);

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c, 'utf8');
console.log('Successfully updated settings/page.tsx with maxDailyBookings!');
