import fs from 'fs';

const path = 'src/app/api/clinic/[slug]/in-clinic-booking/route.ts';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Add imports
const oldImport = "import { createAtomicAppointment } from '@/lib/queueService'";
const newImport = `import { createAtomicAppointment } from '@/lib/queueService'
import {
  resolveEffectiveDailyLimit,
  isAppointmentActive,
  getCairoDateString,
  findNearestAvailableDate,
  CAPACITY_FULL_MESSAGE
} from '@/lib/bookingCapacity'`;

if (!code.includes(oldImport)) {
  console.error('Import not found in in-clinic-booking');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Update limit resolution
const oldLimitBlock = `    // 6. Booking Date & Capacity Limits
    const nowCairo = new Date()
    const todayCairo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowCairo)
    const bookingDate = date || todayCairo

    // Check clinic/branch daily limit
    const effectiveLimit = branchMaxLimit > 0 ? branchMaxLimit : (Number(clinic.maxDailyBookings) || 0)
    const qAppts = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', bookingDate)
    )
    const apptSnap = await getDocs(qAppts)
    const activeAppts = apptSnap.docs.filter((d) => d.data().status !== 'cancelled')

    const activeScoped = effectiveBranchId && branchMaxLimit > 0
      ? activeAppts.filter((d) => (d.data().branch_id || d.data().branchId || null) === effectiveBranchId)
      : activeAppts

    if (effectiveLimit > 0 && activeScoped.length >= effectiveLimit) {
      return NextResponse.json(
        { error: 'اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.' },
        { status: 400 }
      )
    }`;

const newLimitBlock = `    // 6. Booking Date & Capacity Limits
    const todayCairo = getCairoDateString()
    const bookingDate = date || todayCairo

    // Check clinic/branch daily limit using unified resolution
    const effectiveLimit = resolveEffectiveDailyLimit(clinic, { maxDailyBookings: branchMaxLimit }, Boolean(clinic.branchesEnabled))
    const qAppts = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', bookingDate)
    )
    const apptSnap = await getDocs(qAppts)
    const activeAppts = apptSnap.docs.filter((d) => isAppointmentActive(d.data().status))

    const activeScoped = effectiveBranchId && effectiveLimit > 0
      ? activeAppts.filter((d) => (d.data().branch_id || d.data().branchId || null) === effectiveBranchId)
      : activeAppts

    if (effectiveLimit > 0 && activeScoped.length >= effectiveLimit) {
      const nearest = findNearestAvailableDate({
        requestedDateStr: bookingDate,
        limit: effectiveLimit,
        dailyCounts: { [bookingDate]: activeScoped.length },
        schedule: clinic.weeklySchedule || []
      })
      return NextResponse.json(
        {
          error: CAPACITY_FULL_MESSAGE,
          isFull: true,
          limit: effectiveLimit,
          nextAvailableDate: nearest.nearestDateStr,
          nextAvailableFormatted: nearest.formattedDate
        },
        { status: 400 }
      )
    }`;

if (!code.includes(oldLimitBlock)) {
  console.error('Limit block not found in in-clinic-booking');
  process.exit(1);
}
code = code.replace(oldLimitBlock, newLimitBlock);

// 3. Update catch
const oldCatch = `      if (atomicErr?.message?.includes('QUOTA_EXCEEDED')) {
        return NextResponse.json(
          { error: 'اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.' },
          { status: 400 }
        )
      }`;

const newCatch = `      if (atomicErr?.message?.includes('QUOTA_EXCEEDED')) {
        const nearest = findNearestAvailableDate({
          requestedDateStr: bookingDate,
          limit: effectiveLimit,
          dailyCounts: { [bookingDate]: effectiveLimit },
          schedule: clinic.weeklySchedule || []
        })
        return NextResponse.json(
          {
            error: CAPACITY_FULL_MESSAGE,
            isFull: true,
            limit: effectiveLimit,
            nextAvailableDate: nearest.nearestDateStr,
            nextAvailableFormatted: nearest.formattedDate
          },
          { status: 400 }
        )
      }`;

if (!code.includes(oldCatch)) {
  console.error('Catch not found in in-clinic-booking');
  process.exit(1);
}
code = code.replace(oldCatch, newCatch);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully patched in-clinic-booking route');
