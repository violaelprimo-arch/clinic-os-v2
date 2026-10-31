import fs from 'fs';

const path = 'src/components/clinic/BookingModal.tsx';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Add imports
const oldImport = "import { createAtomicAppointment, removeUndefinedFields } from '@/lib/queueService'";
const newImport = `import { createAtomicAppointment, removeUndefinedFields } from '@/lib/queueService'
import {
  resolveEffectiveDailyLimit,
  isAppointmentActive,
  getCairoDateString,
  filterAvailableDays,
  findNearestAvailableDate,
  CAPACITY_FULL_MESSAGE
} from '@/lib/bookingCapacity'`;

if (!code.includes(oldImport)) {
  console.error('Import not found in BookingModal.tsx');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Replace maxLimit and availableDays logic
const oldLogicStart = "  // Max daily bookings quota";
const oldLogicEnd = "  // Live estimated queue & wait time calculation";

const startIndex = code.indexOf(oldLogicStart);
const endIndex = code.indexOf(oldLogicEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find logic slice in BookingModal.tsx', { startIndex, endIndex });
  process.exit(1);
}

const newLogic = `  // Max daily bookings quota - unified resolution (clinic limit takes precedence over legacy branch values)
  const maxLimit = useMemo(() => {
    return resolveEffectiveDailyLimit(clinic, selectedBranch, (branches?.length || 0) > 1)
  }, [clinic, selectedBranch, branches])

  const [dailyBookingCounts, setDailyBookingCounts] = useState<Record<string, number>>({})
  const [autoForwardedNotice, setAutoForwardedNotice] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')

  // Smart Date State (Today only or forward multi-day scheduling)
  const isTodayOnly = clinic?.bookingAvailability === 'today_only' || clinic?.allowFutureBookings === false

  // Compute available days: filter out scheduled holidays and COMPLETELY EXCLUDE full days
  const availableDays = useMemo(() => {
    const branchSchedule = selectedBranch?.weeklySchedule || clinic?.weeklySchedule || []
    const todayCairo = getCairoDateString()

    // Scan up to 21 days ahead to find available slots
    const maxDaysToScan = isTodayOnly ? 14 : 21
    const targetCount = isTodayOnly ? 1 : 6

    const days = filterAvailableDays({
      startDateStr: todayCairo,
      maxDaysToScan,
      targetCount,
      limit: maxLimit,
      dailyCounts: dailyBookingCounts,
      schedule: branchSchedule,
      isRtl: true
    })

    return days
  }, [dailyBookingCounts, maxLimit, isTodayOnly, selectedBranch?.weeklySchedule, clinic?.weeklySchedule])

  // Real-time synchronization of daily booking counts
  useEffect(() => {
    if (!clinicId) return
    let isCancelled = false

    const branchSchedule = selectedBranch?.weeklySchedule || clinic?.weeklySchedule || []
    const todayCairo = getCairoDateString()
    const maxDaysToScan = isTodayOnly ? 14 : 21
    const candidateDays: string[] = []

    const baseDate = new Date()
    for (let i = 0; i < maxDaysToScan; i++) {
      const d = new Date(baseDate.getTime() + i * 86400000)
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      const day = String(d.getDate()).padStart(2, '0')
      candidateDays.push(\`\${year}-\${month}-\${day}\`)
    }

    Promise.all(
      candidateDays.map(async (iso) => {
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', clinicId),
          where('date', '==', iso)
        )
        const snap = await getDocs(q)
        let active = snap.docs.filter((d) => isAppointmentActive(d.data().status))
        if (selectedBranch?.id && maxLimit > 0 && selectedBranch.id !== 'main') {
          active = active.filter((d) => (d.data().branch_id || d.data().branchId || null) === selectedBranch.id)
        }
        return { iso, count: active.length }
      })
    )
      .then((results) => {
        if (isCancelled) return
        const map: Record<string, number> = {}
        results.forEach((r) => {
          map[r.iso] = r.count
        })
        setDailyBookingCounts(map)
      })
      .catch((err) => console.warn('Error fetching daily booking counts:', err))

    return () => {
      isCancelled = true
    }
  }, [clinicId, maxLimit, isTodayOnly, selectedBranch?.id, selectedBranch?.weeklySchedule, clinic?.weeklySchedule])

  // Auto-select nearest available date and display auto-forward notice if today is full
  useEffect(() => {
    if (availableDays.length > 0) {
      const todayCairo = getCairoDateString()
      const todayCount = dailyBookingCounts[todayCairo] || 0
      const isTodayFull = maxLimit > 0 && todayCount >= maxLimit

      if (isTodayFull && availableDays[0].iso !== todayCairo) {
        setAutoForwardedNotice(\`اكتملت حجوزات هذا اليوم، تم اختيار أقرب يوم متاح: \${availableDays[0].label} (\${availableDays[0].formattedDate})\`)
      } else {
        setAutoForwardedNotice('')
      }

      const isCurrentSelectedValid = availableDays.some((d) => d.iso === selectedDate)
      if (!isCurrentSelectedValid) {
        setSelectedDate(availableDays[0].iso)
      }
    } else {
      setSelectedDate('')
      setAutoForwardedNotice('')
    }
  }, [availableDays, selectedDate, dailyBookingCounts, maxLimit])

`;

code = code.slice(0, startIndex) + newLogic + code.slice(endIndex);

// 3. Update Step 3 rendering
const oldStep3Grid = `<div className={\`grid \${availableDays.length === 1 ? 'grid-cols-1 max-w-[220px] mx-auto' : 'grid-cols-3'} gap-2\`}>
                    {availableDays.map((d) => {
                      const isSelected = selectedDate === d.iso
                      const isFull = d.isFull
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          disabled={isFull}
                          onClick={() => setSelectedDate(d.iso)}
                          className={\`p-2.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center \${
                            isFull
                              ? 'border-slate-200 dark:border-slate-800 bg-slate-100/70 dark:bg-slate-900/50 opacity-60 cursor-not-allowed'
                              : isSelected
                              ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 shadow-md ring-2 ring-sky-400/20 cursor-pointer'
                              : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300 cursor-pointer'
                          }\`}
                        >
                          <span className={\`text-xs font-black \${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}\`}>
                            {d.label}
                          </span>
                          <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                            {d.subLabel}
                          </span>
                          {isFull && (
                            <span className="mt-1 text-[8.5px] font-black text-rose-500 bg-rose-50 dark:bg-rose-950 px-1.5 py-0.5 rounded-full">
                              مكتمل العدد
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>`;

const newStep3Grid = `{/* Auto forward notice banner */}
                  {autoForwardedNotice && (
                    <div className="mb-3 p-3 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 flex items-start gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                      <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                      <div>{autoForwardedNotice}</div>
                    </div>
                  )}

                  {availableDays.length === 0 ? (
                    <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-800 text-center space-y-1.5 my-2">
                      <p className="text-xs sm:text-sm font-black text-rose-700 dark:text-rose-300">
                        لا توجد مواعيد متاحة حاليًا
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">
                        اكتمل عدد الحجوزات المتاحة لجميع الأيام في فترة الحجز المسموحة. يرجى المتابعة لاحقاً أو التواصل مع العيادة.
                      </p>
                    </div>
                  ) : (
                    <div className={\`grid \${availableDays.length === 1 ? 'grid-cols-1 max-w-[220px] mx-auto' : 'grid-cols-3'} gap-2\`}>
                      {availableDays.map((d) => {
                        const isSelected = selectedDate === d.iso
                        return (
                          <button
                            key={d.iso}
                            type="button"
                            onClick={() => setSelectedDate(d.iso)}
                            className={\`p-2.5 rounded-2xl border-2 text-center transition-all flex flex-col items-center justify-center cursor-pointer \${
                              isSelected
                                ? 'border-sky-500 bg-sky-50 dark:bg-sky-950/60 shadow-md ring-2 ring-sky-400/20'
                                : 'border-slate-100 dark:border-slate-700 bg-white dark:bg-slate-800 hover:border-sky-300'
                            }\`}
                          >
                            <span className={\`text-xs font-black \${isSelected ? 'text-sky-600 dark:text-sky-400' : 'text-slate-900 dark:text-white'}\`}>
                              {d.label}
                            </span>
                            <span className="text-[10px] font-bold text-slate-400 mt-0.5">
                              {d.subLabel}
                            </span>
                          </button>
                        )
                      })}
                    </div>
                  )}`;

if (!code.includes(oldStep3Grid)) {
  console.error('Step 3 grid not found in BookingModal.tsx');
  process.exit(1);
}
code = code.replace(oldStep3Grid, newStep3Grid);

// 4. Update QUOTA_EXCEEDED error catch in handleConfirmBooking
const oldCatch = `      if (err?.message?.includes('QUOTA_EXCEEDED')) {
        toast.error('اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.')
      } else {`;

const newCatch = `      if (err?.message?.includes('QUOTA_EXCEEDED')) {
        const branchSchedule = selectedBranch?.weeklySchedule || clinic?.weeklySchedule || []
        const nearest = findNearestAvailableDate({
          requestedDateStr: selectedDate,
          limit: maxLimit,
          dailyCounts: { [selectedDate]: maxLimit },
          schedule: branchSchedule
        })
        if (nearest.nearestDateStr) {
          setSelectedDate(nearest.nearestDateStr)
          setAutoForwardedNotice(\`اكتملت حجوزات هذا اليوم أثناء تسجيلك، تم اختيار أقرب يوم متاح: \${nearest.formattedDate}. يرجى تأكيد الحجز.\`)
          setStep(3)
          toast.error(\`اكتملت حجوزات هذا اليوم. تم اختيار أقرب موعد متاح: \${nearest.formattedDate}\`)
        } else {
          toast.error(CAPACITY_FULL_MESSAGE)
        }
      } else {`;

if (!code.includes(oldCatch)) {
  console.error('Catch not found in BookingModal.tsx');
  process.exit(1);
}
code = code.replace(oldCatch, newCatch);

// 5. Update next button disabled condition
const oldDisabled = "disabled={submitting}";
const newDisabled = "disabled={submitting || (step === 3 && availableDays.length === 0) || (step === 6 && !selectedDate)}";

if (!code.includes(oldDisabled)) {
  console.error('Disabled button not found in BookingModal.tsx');
  process.exit(1);
}
code = code.replace(oldDisabled, newDisabled);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully updated BookingModal.tsx');
