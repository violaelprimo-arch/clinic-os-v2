import fs from 'fs';

const path = 'src/components/clinic/BookingForm.tsx';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Add imports
const oldImport = "import { createAtomicAppointment } from '@/lib/queueService'";
const newImport = `import { createAtomicAppointment } from '@/lib/queueService'
import {
  resolveEffectiveDailyLimit,
  isAppointmentActive,
  getCairoDateString,
  filterAvailableDays,
  findNearestAvailableDate,
  CAPACITY_FULL_MESSAGE
} from '@/lib/bookingCapacity'`;

if (!code.includes(oldImport)) {
  console.error('Old import not found in BookingForm.tsx');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Replace count fetching & available days calculation
const oldChunkStart = "  const [dailyBookingCounts, setDailyBookingCounts] = useState<{ [date: string]: number }>({})";
const oldChunkEnd = "  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'instapay' | 'wallet'>('cash')";

const startIndex = code.indexOf(oldChunkStart);
const endIndex = code.indexOf(oldChunkEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find chunk bounds in BookingForm.tsx', { startIndex, endIndex });
  process.exit(1);
}

const newChunk = `  // Max daily bookings quota - unified resolution (clinic limit takes precedence over legacy branch values)
  const maxLimit = useMemo(() => {
    return resolveEffectiveDailyLimit(clinic, selectedBranch, (branches?.length || 0) > 1)
  }, [clinic, selectedBranch, branches])

  const [dailyBookingCounts, setDailyBookingCounts] = useState<{ [date: string]: number }>({})
  const [autoForwardedNotice, setAutoForwardedNotice] = useState<string>('')
  const [selectedDate, setSelectedDate] = useState<string>('')

  // Fetch existing appointments count for this branch / clinic
  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const clinicId = clinic.id || clinic.slug

    const fetchCounts = async () => {
      try {
        const q = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', clinicId)
        )
        const snap = await getDocs(q)
        const counts: { [date: string]: number } = {}
        const isMultiBranch = (branches?.length || 0) > 1

        snap.docs.forEach((docSnap) => {
          const d = docSnap.data()
          if (isMultiBranch && selectedBranch?.id && selectedBranch.id !== 'main') {
            const apptBranch = d.branch_id || d.branchId || null
            if (apptBranch && apptBranch !== selectedBranch.id) {
              return
            }
          }
          if (d.date && isAppointmentActive(d.status)) {
            counts[d.date] = (counts[d.date] || 0) + 1
          }
        })
        setDailyBookingCounts(counts)
      } catch (err) {
        console.error('Error fetching booking counts:', err)
      }
    }
    fetchCounts()
  }, [clinic?.id, clinic?.slug, selectedBranch?.id, branches])

  // Smart Date State (Today only or forward multi-day scheduling)
  const isTodayOnly = clinic?.bookingAvailability === 'today_only' || clinic?.allowFutureBookings === false

  // Compute available days: check selected branch weekly schedule & max daily bookings (completely exclude full days)
  const availableDays = useMemo(() => {
    const branchSchedule = selectedBranch?.weeklySchedule || clinic?.weeklySchedule || []
    const todayCairo = getCairoDateString()

    const maxDaysToScan = isTodayOnly ? 14 : 21
    const targetCount = isTodayOnly ? 1 : 6

    const days = filterAvailableDays({
      startDateStr: todayCairo,
      maxDaysToScan,
      targetCount,
      limit: maxLimit,
      dailyCounts: dailyBookingCounts,
      schedule: branchSchedule,
      isRtl
    })

    return days.map(d => ({
      iso: d.iso,
      label: d.label,
      formattedDate: d.subLabel
    }))
  }, [selectedBranch?.weeklySchedule, clinic?.weeklySchedule, maxLimit, dailyBookingCounts, isRtl, isTodayOnly])

  // Auto-advance to nearest available date when current selection is full or unavailable
  useEffect(() => {
    if (availableDays.length > 0) {
      const isSelectedAvailable = availableDays.some((d) => d.iso === selectedDate)
      if (!isSelectedAvailable) {
        const nextDay = availableDays[0]
        const todayCairo = getCairoDateString()
        if (nextDay.iso !== todayCairo && maxLimit > 0 && (dailyBookingCounts[todayCairo] || 0) >= maxLimit) {
          setAutoForwardedNotice(
            isRtl
              ? \`اكتملت حجوزات هذا اليوم، تم اختيار أقرب يوم متاح: \${nextDay.label} (\${nextDay.formattedDate})\`
              : \`Today's bookings are full. Nearest available date selected: \${nextDay.label} (\${nextDay.formattedDate})\`
          )
        } else {
          setAutoForwardedNotice('')
        }
        setSelectedDate(nextDay.iso)
      }
    } else {
      setSelectedDate('')
      setAutoForwardedNotice('')
    }
  }, [availableDays, selectedDate, maxLimit, dailyBookingCounts, isRtl])
`;

code = code.substring(0, startIndex) + newChunk + '\n  ' + code.substring(endIndex);

// 3. Update handleNextStep1 to require available days
const oldStep1Validation = "    if (!selectedDate) return toast.error(isRtl ? 'يرجى اختيار يوم الحجز' : 'Please select a booking date')";
const newStep1Validation = "    if (!selectedDate || availableDays.length === 0) return toast.error(isRtl ? 'لا توجد مواعيد متاحة للحجز حالياً' : 'No available booking slots currently')";

if (!code.includes(oldStep1Validation)) {
  console.error('oldStep1Validation not found in BookingForm.tsx');
  process.exit(1);
}
code = code.replace(oldStep1Validation, newStep1Validation);

// 4. Update createAtomicAppointment maxLimit and error handling
const oldSubmitQuota = `      const maxLimit = Number(selectedBranch?.maxDailyBookings || clinic?.maxDailyBookings) || 0
      // Atomically allocate next sequential queue number with zero concurrency collisions
      const { id: newApptId, queueNumber: allocatedQueueNumber } = await createAtomicAppointment(newAppt, maxLimit)`;

const newSubmitQuota = `      // Atomically allocate next sequential queue number with zero concurrency collisions
      const { id: newApptId, queueNumber: allocatedQueueNumber } = await createAtomicAppointment(newAppt, maxLimit)`;

if (!code.includes(oldSubmitQuota)) {
  console.error('oldSubmitQuota not found in BookingForm.tsx');
  process.exit(1);
}
code = code.replace(oldSubmitQuota, newSubmitQuota);

// 5. Update catch block for QUOTA_EXCEEDED
const oldCatch = `      if (error?.message?.includes('QUOTA_EXCEEDED')) {
        toast.error('اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.')
      } else {
        toast.error('حدث خطأ أثناء إتمام الحجز، يرجى المحاولة ثانيةً.')
      }`;

const newCatch = `      if (error?.message?.includes('QUOTA_EXCEEDED')) {
        const branchSchedule = selectedBranch?.weeklySchedule || clinic?.weeklySchedule || []
        const nearest = findNearestAvailableDate({
          startDateStr: selectedDate,
          schedule: branchSchedule,
          dailyCounts: { ...dailyBookingCounts, [selectedDate]: (dailyBookingCounts[selectedDate] || 0) + 1 },
          limit: maxLimit,
          isRtl
        })
        if (nearest) {
          setSelectedDate(nearest.iso)
          toast.error(
            isRtl
              ? \`اكتملت حجوزات هذا اليوم، تم اختيار أقرب يوم متاح: \${nearest.label} (\${nearest.subLabel})\`
              : \`This day is fully booked. Nearest date selected: \${nearest.label} (\${nearest.subLabel})\`
          )
        } else {
          toast.error(CAPACITY_FULL_MESSAGE)
        }
      } else {
        toast.error(t('booking_submit_error', 'حدث خطأ أثناء إتمام الحجز، يرجى المحاولة ثانيةً.'))
      }`;

if (!code.includes(oldCatch)) {
  console.error('oldCatch not found in BookingForm.tsx');
  process.exit(1);
}
code = code.replace(oldCatch, newCatch);

// 6. Update step 1 UI to include autoForwardedNotice and disable next button when no available days
const oldDateUIStart = "{/* Date Selection */}";
const oldDateUIEnd = "<Button\n            onClick={handleNextStep1}";

const dateUIStartIdx = code.indexOf(oldDateUIStart);
const dateUIEndIdx = code.indexOf(oldDateUIEnd);

if (dateUIStartIdx === -1 || dateUIEndIdx === -1) {
  console.error('Could not find dateUI in BookingForm.tsx', { dateUIStartIdx, dateUIEndIdx });
  process.exit(1);
}

const newDateUI = `{/* Date Selection */}
            <div className="space-y-2 pt-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                  <Calendar className="w-4 h-4 text-primary" />
                  {t('booking_day', 'يوم الحجز (مواعيد')} {selectedBranch?.name || t('branch', 'الفرع')})
                </Label>
                {selectedDate && (
                  <span className="text-[11px] font-bold text-primary">
                    {availableDays.find((d) => d.iso === selectedDate)?.label} ({availableDays.find((d) => d.iso === selectedDate)?.formattedDate})
                  </span>
                )}
              </div>

              {/* Auto forward notice banner */}
              {autoForwardedNotice && (
                <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-start gap-2.5 text-xs font-bold text-amber-800 dark:text-amber-300">
                  <AlertCircle className="w-4 h-4 shrink-0 text-amber-600 mt-0.5" />
                  <div>{autoForwardedNotice}</div>
                </div>
              )}

              {availableDays.length > 0 ? (
                <>
                  <div className={\`grid \${availableDays.length === 1 ? 'grid-cols-1 max-w-[220px] mx-auto' : 'grid-cols-3'} gap-2\`}>
                    {availableDays.map((d) => {
                      const isSelected = selectedDate === d.iso
                      return (
                        <button
                          key={d.iso}
                          type="button"
                          onClick={() => setSelectedDate(d.iso)}
                          className={\`p-3 rounded-2xl border text-center transition-all cursor-pointer flex flex-col items-center justify-center gap-1 \${
                            isSelected
                              ? 'bg-primary text-white border-primary shadow-md shadow-primary/20 ring-2 ring-primary/30'
                              : 'bg-card text-foreground border-border hover:border-primary hover:bg-primary/5'
                          }\`}
                        >
                          <span className={\`text-xs font-black \${isSelected ? 'text-white' : 'text-foreground'}\`}>
                            {d.label}
                          </span>
                          <span className={\`text-[10px] font-bold \${isSelected ? 'text-white/90' : 'text-muted-foreground font-mono'}\`}>
                            {d.formattedDate}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                  {isTodayOnly && (
                    <p className="text-[10px] text-amber-600 dark:text-amber-400 font-bold text-center pt-1">
                      ⚡ {isRtl ? 'الحجز متاح لليوم الحالي فقط بتعليمات العيادة' : 'Booking is restricted to today only'}
                    </p>
                  )}
                </>
              ) : (
                <div className="p-4 rounded-2xl bg-destructive/10 border border-destructive/20 text-center space-y-1">
                  <p className="text-xs sm:text-sm font-black text-destructive">
                    {t('no_available_times', 'لا توجد مواعيد متاحة حاليًا')}
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    {isRtl
                      ? 'اكتمل عدد الحجوزات المتاحة لجميع الأيام في فترة الحجز المسموحة. يرجى التواصل مع العيادة.'
                      : 'All booking slots in the available horizon are fully booked. Please contact the clinic.'}
                  </p>
                </div>
              )}
            </div>
          </div>

          `;

const oldButton = `<Button
            onClick={handleNextStep1}
            className="w-full h-12 text-sm font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md mt-2"`;

const newButton = `<Button
            onClick={handleNextStep1}
            disabled={availableDays.length === 0 || !selectedDate}
            className="w-full h-12 text-sm font-black bg-primary hover:bg-primary-hover text-white rounded-xl shadow-md mt-2 disabled:opacity-50"`;

code = code.substring(0, dateUIStartIdx) + newDateUI + code.substring(dateUIEndIdx);
code = code.replace(oldButton, newButton);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully updated BookingForm.tsx');
