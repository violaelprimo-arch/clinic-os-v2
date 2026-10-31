import fs from 'fs';

const path = 'src/app/api/clinic/book/route.ts';
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
  console.error('Import not found');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Replace date & limit resolution
const oldLimitBlock = `    // Resolve booking date in Cairo timezone
    const nowCairo = new Date()
    const todayCairo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowCairo)
    const bookingDate = date || todayCairo

    // Resolve maxDailyBookings from branch (if set) or clinic
    let effectiveLimit = Number(cData.maxDailyBookings) || 0
    if (branchId) {
      try {
        const bDoc = await getDoc(doc(db, 'branches', String(branchId)))
        if (bDoc.exists() && bDoc.data()?.maxDailyBookings) {
          effectiveLimit = Number(bDoc.data()?.maxDailyBookings) || effectiveLimit
        }
      } catch (e) {
        // Fallback to clinic limit
      }
    }`;

const newLimitBlock = `    // Resolve booking date in Cairo timezone
    const todayCairo = getCairoDateString()
    const bookingDate = date || todayCairo

    // Resolve branch details if branchId provided
    let bData: any = null
    if (branchId) {
      try {
        const bDoc = await getDoc(doc(db, 'branches', String(branchId)))
        if (bDoc.exists()) {
          bData = bDoc.data()
        }
      } catch (e) {
        // Fallback
      }
    }

    // Unified resolution: clinic limit takes precedence for single clinic, sub-branch limit respected in multi-branch
    const effectiveLimit = resolveEffectiveDailyLimit(cData, bData, Boolean(cData.branchesEnabled))`;

if (!code.includes(oldLimitBlock)) {
  console.error('Limit block not found');
  process.exit(1);
}
code = code.replace(oldLimitBlock, newLimitBlock);

// 3. Replace capacity check and add duplicate guard
const oldCheck = `    const apptSnap = await getDocs(qAppts)
    const activeAppts = apptSnap.docs.filter((d) => d.data().status !== 'cancelled')

    const activeScoped = branchId && effectiveLimit > 0
      ? activeAppts.filter((d) => (d.data().branch_id || d.data().branchId || null) === branchId)
      : activeAppts

    // Enforce daily capacity limit immediately
    if (effectiveLimit > 0 && activeScoped.length >= effectiveLimit) {
      return NextResponse.json(
        { error: 'اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.' },
        { status: 400 }
      )
    }`;

const newCheck = `    const apptSnap = await getDocs(qAppts)
    const activeAppts = apptSnap.docs.filter((d) => isAppointmentActive(d.data().status))

    const activeScoped = branchId && effectiveLimit > 0
      ? activeAppts.filter((d) => (d.data().branch_id || d.data().branchId || null) === branchId)
      : activeAppts

    // Enforce daily capacity limit immediately with next available day suggestion
    if (effectiveLimit > 0 && activeScoped.length >= effectiveLimit) {
      const nearest = findNearestAvailableDate({
        requestedDateStr: bookingDate,
        limit: effectiveLimit,
        dailyCounts: { [bookingDate]: activeScoped.length },
        schedule: bData?.weeklySchedule || cData?.weeklySchedule || []
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
    }

    // Duplicate booking protection (accidental double submit within active session)
    const cleanDigits = cleanPhone.replace(/[^0-9]/g, '')
    const existingDuplicate = activeAppts.find((d) => {
      const data = d.data()
      const dPhone = String(data.phone || '').replace(/[^0-9]/g, '')
      const dName = String(data.patientName || '').trim().toLowerCase()
      const dService = String(data.serviceId || '')
      return (
        dPhone === cleanDigits &&
        dName === cleanName.toLowerCase() &&
        dService === String(serviceId) &&
        (data.status === 'waiting' || data.status === 'in_progress')
      )
    })

    if (existingDuplicate) {
      const dup = existingDuplicate.data()
      return NextResponse.json({
        success: true,
        isExisting: true,
        appointmentId: existingDuplicate.id,
        queueNumber: dup.queue_number,
        aheadCount: 0,
        date: dup.date,
        time: dup.time,
        branchName: dup.branchName || branchName || 'الفرع الرئيسي',
        serviceName: dup.serviceName || verifiedServiceName,
        servicePrice: dup.servicePrice || verifiedServicePrice
      })
    }`;

if (!code.includes(oldCheck)) {
  console.error('Check block not found');
  process.exit(1);
}
code = code.replace(oldCheck, newCheck);

// 4. Update QUOTA_EXCEEDED error handling
const oldQuotaCatch = `      if (atomicErr?.message?.includes('QUOTA_EXCEEDED')) {
        return NextResponse.json(
          { error: 'اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.' },
          { status: 400 }
        )
      }`;

const newQuotaCatch = `      if (atomicErr?.message?.includes('QUOTA_EXCEEDED')) {
        const nearest = findNearestAvailableDate({
          requestedDateStr: bookingDate,
          limit: effectiveLimit,
          dailyCounts: { [bookingDate]: effectiveLimit },
          schedule: bData?.weeklySchedule || cData?.weeklySchedule || []
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

if (!code.includes(oldQuotaCatch)) {
  console.error('Quota catch block not found');
  process.exit(1);
}
code = code.replace(oldQuotaCatch, newQuotaCatch);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully patched src/app/api/clinic/book/route.ts');
