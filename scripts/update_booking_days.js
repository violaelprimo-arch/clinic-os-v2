const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

// 1. Add useMemo import
c = c.replace(
  "import { useState, useEffect } from 'react'",
  "import { useState, useEffect, useMemo } from 'react'"
);

// 2. Add booking counts state & calculation right after preselectedServiceId effect
const targetState = `  useEffect(() => {
    if (preselectedServiceId) {
      setSelectedServiceId(preselectedServiceId)
    }
  }, [preselectedServiceId])
  const [selectedDate, setSelectedDate] = useState<string>(new Date().toISOString().split('T')[0])`;

const replacementState = `  useEffect(() => {
    if (preselectedServiceId) {
      setSelectedServiceId(preselectedServiceId)
    }
  }, [preselectedServiceId])

  const [dailyBookingCounts, setDailyBookingCounts] = useState<{ [date: string]: number }>({})

  // Fetch existing appointments count to enforce maxDailyBookings limit
  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const fetchCounts = async () => {
      try {
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', clinic.id || clinic.slug)
        )
        const snap = await getDocs(q)
        const counts: { [date: string]: number } = {}
        snap.docs.forEach(docSnap => {
          const d = docSnap.data()
          if (d.date && d.status !== 'cancelled') {
            counts[d.date] = (counts[d.date] || 0) + 1
          }
        })
        setDailyBookingCounts(counts)
      } catch (err) {
        console.error('Error fetching booking counts:', err)
      }
    }
    fetchCounts()
  }, [clinic?.id, clinic?.slug])

  // Compute available days: only open days in weeklySchedule & not exceeding maxDailyBookings
  const availableDays = useMemo(() => {
    const list: { iso: string; label: string; formattedDate: string }[] = []
    const dayNamesAr = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
    const dayKeys = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
    const monthNamesAr = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ]

    const maxLimit = Number(clinic?.maxDailyBookings) || 0

    // Scan up to 14 days ahead
    for (let i = 0; i < 14; i++) {
      const d = new Date()
      d.setDate(d.getDate() + i)

      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const dayNum = String(d.getDate()).padStart(2, '0')
      const iso = \`\${year}-\${month}-\${dayNum}\`

      const dayIndex = d.getDay()
      const dayKey = dayKeys[dayIndex]
      const dayNameAr = dayNamesAr[dayIndex]

      // Check weeklySchedule: if clinic is closed on this day, SKIP
      if (clinic?.weeklySchedule && clinic.weeklySchedule.length > 0) {
        const sched = clinic.weeklySchedule.find((s: any) => s.id === dayKey)
        if (sched && sched.isOpen === false) {
          continue
        }
      }

      // Check max daily bookings: if day is full, SKIP
      const bookedCount = dailyBookingCounts[iso] || 0
      if (maxLimit > 0 && bookedCount >= maxLimit) {
        continue
      }

      let label = dayNameAr
      if (i === 0) label = 'اليوم'
      else if (i === 1) label = 'غداً'

      const formattedDate = \`\${d.getDate()} \${monthNamesAr[d.getMonth()]}\`

      list.push({
        iso,
        label,
        formattedDate
      })

      // Show up to 6 active available days
      if (list.length >= 6) break
    }

    return list
  }, [clinic?.weeklySchedule, clinic?.maxDailyBookings, dailyBookingCounts])

  const [selectedDate, setSelectedDate] = useState<string>('')

  // Keep selectedDate pointed to the first valid available day
  useEffect(() => {
    if (availableDays.length > 0) {
      const isSelectedAvailable = availableDays.some(d => d.iso === selectedDate)
      if (!isSelectedAvailable) {
        setSelectedDate(availableDays[0].iso)
      }
    }
  }, [availableDays, selectedDate])`;

c = c.replace(targetState, replacementState);

// 3. Update handleNextStep1 to validate chosen date & limit
const targetStep1 = `    if (selectedDate && clinic?.weeklySchedule) {
      const d = new Date(selectedDate);
      const days = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
      const dayName = days[d.getDay()];
      const daySched = clinic.weeklySchedule.find((s: any) => s.id === dayName);
      if (daySched && !daySched.isOpen) {
        return toast.error(\`عذراً، العيادة لا تعمل يوم \${daySched.day}\`);
      }
    }`;

const replacementStep1 = `    if (!selectedDate) {
      return toast.error('يرجى اختيار يوم الحجز');
    }
    const maxLimit = Number(clinic?.maxDailyBookings) || 0;
    if (maxLimit > 0 && (dailyBookingCounts[selectedDate] || 0) >= maxLimit) {
      return toast.error('عذراً، اكتمل الحد الأقصى لحجوزات هذا اليوم. يرجى اختيار يوم آخر.');
    }`;

c = c.replace(targetStep1, replacementStep1);

// 4. Update Date Input UI to interactive cards
const targetDateInput = `          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-slate-600">تاريخ الحجز</Label>
            <Input
              type="date"
              value={selectedDate}
              min={new Date().toISOString().split('T')[0]}
              onChange={e => setSelectedDate(e.target.value)}
              className="h-12 text-sm rounded-xl bg-[#F6F8FB] border-[#E5EAF0] focus:bg-white"
            />
          </div>`;

const replacementDateInput = `          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-[#15B8A6]" />
                يوم الحجز (المواعيد المتاحة)
              </Label>
              {selectedDate && (
                <span className="text-[11px] font-bold text-[#15B8A6]">
                  {availableDays.find(d => d.iso === selectedDate)?.label} ({availableDays.find(d => d.iso === selectedDate)?.formattedDate})
                </span>
              )}
            </div>

            {availableDays.length > 0 ? (
              <div className="grid grid-cols-3 gap-2">
                {availableDays.map((d) => {
                  const isSelected = selectedDate === d.iso
                  return (
                    <button
                      key={d.iso}
                      type="button"
                      onClick={() => setSelectedDate(d.iso)}
                      className={\`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 \${
                        isSelected
                          ? 'bg-[#15B8A6] text-white border-[#15B8A6] shadow-md shadow-[#15B8A6]/20 ring-2 ring-[#15B8A6]/30'
                          : 'bg-white text-slate-700 border-[#E5EAF0] hover:border-[#15B8A6] hover:bg-teal-50/20'
                      }\`}
                    >
                      <span className={\`text-xs font-black \${isSelected ? 'text-white' : 'text-[#182230]'}\`}>
                        {d.label}
                      </span>
                      <span className={\`text-[10px] font-bold \${isSelected ? 'text-white/90' : 'text-slate-400 font-mono'}\`}>
                        {d.formattedDate}
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-center text-xs text-amber-800 font-bold">
                لا توجد مواعيد متاحة للحجز حالياً. يرجى التواصل مع إدارة العيادة.
              </div>
            )}
          </div>`;

c = c.replace(targetDateInput, replacementDateInput);

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c, 'utf8');
console.log('Successfully updated BookingForm.tsx with interactive available day cards & limits!');
