import { NextRequest, NextResponse } from 'next/server'
import {
  readDocument,
  queryDocuments,
  queryDocumentsByField,
  queryDocumentsByFields,
} from '@/lib/server/firebase-rest'
import { calculatePatientLivePosition, sortQueue } from '@/lib/queueCalculations'
import { getPhoneSearchVariants, normalizePhoneDigits } from '@/lib/countryPhoneHelper'
import { computeQueueWatermark } from '@/lib/queueSync'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
}

// Clinic IDs are immutable per slug; caching the lookup removes a redundant
// Firestore scan on every 1s TV / patient-track poll.
const clinicIdBySlugCache = new Map<string, string>()

async function resolveClinicDoc(slug: string): Promise<{ clinicId: string; clinicData: any | null }> {
  const cachedId = clinicIdBySlugCache.get(slug)
  if (cachedId) {
    const cachedDoc = await readDocument(`clinics/${cachedId}`)
    if (cachedDoc && (cachedDoc.slug === slug || cachedDoc.id === slug)) {
      return { clinicId: cachedDoc.id || cachedId, clinicData: cachedDoc }
    }
    clinicIdBySlugCache.delete(slug)
  }

  const [directDoc, bySlug] = await Promise.all([
    /^[a-zA-Z0-9_-]{1,128}$/.test(slug) ? readDocument(`clinics/${slug}`).catch(() => null) : Promise.resolve(null),
    queryDocumentsByFields('clinics', { slug }, 1).catch(() => []),
  ])

  let clinicDoc: any =
    (bySlug && bySlug[0]) ||
    (directDoc && (directDoc.slug === slug || directDoc.id === slug) ? directDoc : null)

  if (!clinicDoc) {
    const allClinics = await queryDocuments('clinics')
    clinicDoc = allClinics.find((c: any) => c.slug === slug || c.id === slug) || null
  }

  const clinicId = clinicDoc ? String(clinicDoc.id) : slug
  if (clinicDoc) {
    if (clinicIdBySlugCache.size >= 200) {
      const oldestKey = clinicIdBySlugCache.keys().next().value
      if (oldestKey) clinicIdBySlugCache.delete(oldestKey)
    }
    clinicIdBySlugCache.set(slug, clinicId)
  }

  return { clinicId, clinicData: clinicDoc || null }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params
    const slug = resolvedParams.slug || 'zizo'
    const { searchParams } = new URL(req.url)
    const phone = searchParams.get('phone')
    const branchId = searchParams.get('branchId')
    const appointmentId = searchParams.get('appointmentId')
    if (appointmentId && !/^[A-Za-z0-9_-]{1,128}$/.test(appointmentId)) {
      return NextResponse.json({ error: 'معرف الحجز غير صالح' }, { status: 400, headers: noStore })
    }

    const datesParam = searchParams.get('dates')
    const tvOnly = searchParams.get('tv') === '1' && !appointmentId && !phone
    const nowCairo = new Date()
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowCairo)
    const snapshotStartedAt = new Date().toISOString()

    // Warm path: start clinic, direct appointment, and today's queue queries in one parallel round-trip.
    const cachedId = !datesParam ? clinicIdBySlugCache.get(slug) : undefined
    let clinicId = slug
    let clinicData: any = null
    let directlyRequested: any = null
    let allAppts: any[] = []

    if (cachedId) {
      const [cachedClinicDoc, directAppt, prefetchedAppts, historyAppts] = await Promise.all([
        readDocument(`clinics/${cachedId}`),
        appointmentId ? readDocument(`appointments/${appointmentId}`) : Promise.resolve(null),
        queryDocumentsByFields('appointments', { clinic_id: cachedId, date: todayStr }, 250),
        phone && !appointmentId
          ? queryDocumentsByField('appointments', 'clinic_id', cachedId, 500)
          : Promise.resolve([]),
      ])

      if (cachedClinicDoc && (cachedClinicDoc.slug === slug || cachedClinicDoc.id === slug)) {
        clinicId = String(cachedClinicDoc.id || cachedId)
        clinicData = cachedClinicDoc
        directlyRequested = directAppt
        if (phone && !appointmentId && historyAppts.length > 0) {
          const byId = new Map<string, any>()
          for (const a of prefetchedAppts) byId.set(String(a.id), a)
          for (const a of historyAppts) byId.set(String(a.id), a)
          allAppts = Array.from(byId.values())
        } else {
          allAppts = prefetchedAppts
        }
      } else {
        clinicIdBySlugCache.delete(slug)
      }
    }

    if (!clinicData && !allAppts.length) {
      const resolved = await resolveClinicDoc(slug)
      clinicId = resolved.clinicId
      clinicData = resolved.clinicData

      if (datesParam) {
        // Clinic/date scoped capacity rather than reading only the first 200
        // historical appointments and undercounting future bookings.
        const requestedDates = [...new Set(datesParam.split(',').map(d => d.trim()).filter(Boolean))]
        if (requestedDates.length > 14 ||
            requestedDates.some(d => !/^\d{4}-\d{2}-\d{2}$/.test(d))) {
          return NextResponse.json({ error: 'INVALID_DATE_RANGE' }, { status: 400, headers: noStore })
        }
        const results = await Promise.all(requestedDates.map(async day => {
          const items = await queryDocumentsByFields('appointments',
            { clinic_id: clinicId, date: day }, 250)
          const active = items.filter((a: any) =>
            a.status !== 'cancelled' && a.status !== 'no_show' &&
            (!branchId || (a.branch_id || a.branchId) === branchId))
          return [day, active.length] as const
        }))
        return NextResponse.json({
          success: true,
          dailyCounts: Object.fromEntries(results),
          maxDailyBookings: Number(clinicData?.maxDailyBookings) || 0
        }, { headers: noStore })
      }

      const [directAppt, todayAppts, historyAppts] = await Promise.all([
        appointmentId ? readDocument(`appointments/${appointmentId}`) : Promise.resolve(null),
        queryDocumentsByFields('appointments', { clinic_id: clinicId, date: todayStr }, 250),
        phone && !appointmentId && !tvOnly
          ? queryDocumentsByField('appointments', 'clinic_id', clinicId, 500)
          : Promise.resolve([]),
      ])
      directlyRequested = directAppt
      if (historyAppts.length > 0) {
        const byId = new Map<string, any>()
        for (const a of todayAppts) byId.set(String(a.id), a)
        for (const a of historyAppts) byId.set(String(a.id), a)
        allAppts = Array.from(byId.values())
      } else {
        allAppts = todayAppts
      }
    }

    if (appointmentId && directlyRequested &&
        ![directlyRequested.clinic_id, directlyRequested.clinicId].includes(clinicId)) {
      return NextResponse.json({ error: 'الحجز لا يتبع هذه العيادة' }, { status: 403, headers: noStore })
    }

    if (appointmentId && directlyRequested?.date && String(directlyRequested.date) !== todayStr && !phone) {
      const targetDateAppts = await queryDocumentsByFields(
        'appointments',
        { clinic_id: clinicId, date: String(directlyRequested.date) },
        250
      )
      const byId = new Map<string, any>()
      for (const a of allAppts) byId.set(String(a.id), a)
      for (const a of targetDateAppts) byId.set(String(a.id), a)
      allAppts = Array.from(byId.values())
    }

    const clinicAppts = allAppts.filter((a: any) => a.clinic_id === clinicId || a.clinicId === clinicId)

    const allTodayAppts = clinicAppts
      .filter((a: any) => a.date === todayStr)
      .filter((a: any) => !branchId || a.branch_id === branchId || a.branchId === branchId || a.branchName === branchId)

    const inProgressAppt = allTodayAppts.find((a: any) => a.status === 'in_progress' || a.status === 'examining')
    const waitingAppts = sortQueue(allTodayAppts, clinicData)

    // 3. Handle phone / appointment search
    let matchingAppointments: any[] = []
    let patientQueueInfo: any = null

    if (appointmentId || phone) {
      let matchedDocs: any[] = []

      if (appointmentId) {
        const directDoc: any = directlyRequested
        if (directDoc && (directDoc.clinic_id === clinicId || directDoc.clinicId === clinicId)) {
          matchedDocs.push({ id: appointmentId, ...directDoc })
        }
      }

      if (phone && matchedDocs.length === 0) {
        const cleanPhone = phone.trim().replace(/\s+/g, '')
        const normalizedDigits = normalizePhoneDigits(cleanPhone).replace(/[^0-9]/g, '')
        const variants = getPhoneSearchVariants(cleanPhone)

        matchedDocs = clinicAppts.filter((a: any) => {
          if (!a.phone && !a.patientPhone) return false
          const p = String(a.phone || a.patientPhone)
          const aPhoneDigits = normalizePhoneDigits(p).replace(/[^0-9]/g, '')
          if (aPhoneDigits === normalizedDigits || variants.includes(p.trim())) {
            return true
          }
          if (normalizedDigits.length >= 7 && aPhoneDigits.endsWith(normalizedDigits.slice(-7))) {
            return true
          }
          return false
        })
      }

      // Sort matching appointments: Today's active first, then future upcoming, then past
      matchingAppointments = matchedDocs.map((appt: any) => {
        const apptDate = appt.date || todayStr
        const isToday = apptDate === todayStr
        const isFuture = apptDate > todayStr
        const isPast = apptDate < todayStr

        let queueInfo = null

        if (isToday) {
          queueInfo = calculatePatientLivePosition({
            targetAppointmentId: appt.id,
            targetAppointment: appt,
            allTodayAppointments: allTodayAppts,
            clinic: clinicData
          })
        } else if (isFuture) {
          queueInfo = calculatePatientLivePosition({
            targetAppointmentId: appt.id,
            targetAppointment: appt,
            allTodayAppointments: [],
            clinic: clinicData,
            bookingDateStr: apptDate
          })
        } else {
          // Past appointment
          queueInfo = {
            status: appt.status === 'completed' ? 'completed' : 'past',
            statusLabel: appt.status === 'completed' ? 'تم الكشف الطبي بنجاح' : 'حجز سابق',
            isCurrentTurn: false,
            isNextInLine: false,
            aheadCount: 0,
            effectivePosition: 0,
            estimatedWaitMins: 0,
            formattedWaitTime: 'منتهي',
            isPast: true
          }
        }

        return {
          id: appt.id,
          clinic_id: appt.clinic_id || appt.clinicId,
          branch_id: appt.branch_id || appt.branchId,
          queue_number: appt.queue_number ?? appt.queueNumber,
          calledAt: appt.calledAt,
          startedAt: appt.startedAt,
          patientName: appt.patientName,
          phone: appt.phone || appt.patientPhone,
          serviceId: appt.serviceId,
          serviceName: appt.serviceName || 'كشف',
          branchId: appt.branch_id || appt.branchId,
          branchName: appt.branchName || 'الفرع الرئيسي',
          date: appt.date,
          time: appt.time || 'حسب الدور',
          queueNumber: appt.queue_number ?? appt.queueNumber,
          status: appt.status || 'waiting',
          paymentStatus: appt.paymentStatus || 'unpaid',
          isToday,
          isFuture,
          isPast,
          queueInfo
        }
      })

      // Sort: active/today first, then future by date ascending, then past by date descending
      matchingAppointments.sort((a, b) => {
        if (a.isToday && !b.isToday) return -1
        if (!a.isToday && b.isToday) return 1
        if (a.isFuture && b.isFuture) {
          return new Date(a.date).getTime() - new Date(b.date).getTime()
        }
        if (a.isFuture && !b.isFuture) return -1
        if (!a.isFuture && b.isFuture) return 1
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      })

      if (appointmentId) {
        const specific = matchingAppointments.find((a) => a.id === appointmentId)
        if (specific) patientQueueInfo = specific.queueInfo
      } else if (matchingAppointments.length > 0) {
        patientQueueInfo = matchingAppointments[0].queueInfo
      }
    }

    const currentTurn =
      (inProgressAppt?.queue_number ?? inProgressAppt?.queueNumber) ||
      ((waitingAppts[0]?.queue_number ?? waitingAppts[0]?.queueNumber) ?? 1)
    const aheadCount = patientQueueInfo?.aheadCount ?? waitingAppts.length
    const waitMinutes = patientQueueInfo?.estimatedWaitMins ?? (aheadCount * 15)

    const queueWatermark = computeQueueWatermark(
      directlyRequested ? [...allTodayAppts, { id: appointmentId, ...directlyRequested }] : allTodayAppts,
      snapshotStartedAt
    )

    return NextResponse.json({
      success: true,
      serverTime: new Date().toISOString(),
      queueWatermark,
      currentTurn,
      aheadCount,
      waitMinutes,
      totalWaiting: waitingAppts.length,
      isExamining: Boolean(inProgressAppt),
      clinic: clinicData ? {
        id: clinicId,
        name: clinicData.clinicName || clinicData.name,
        doctorName: clinicData.doctorName,
        specialty: clinicData.specialty,
        logoUrl: clinicData.logoUrl,
        primaryColor: clinicData.primaryColor,
        secondaryColor: clinicData.secondaryColor
      } : null,
      tvQueue: {
        currentPatient: inProgressAppt ? {
          id: inProgressAppt.id,
          queueNumber: inProgressAppt.queue_number ?? inProgressAppt.queueNumber,
          patientName: inProgressAppt.patientName,
          status: inProgressAppt.status,
          calledAt: inProgressAppt.calledAt,
          startedAt: inProgressAppt.startedAt,
          branchId: inProgressAppt.branch_id || inProgressAppt.branchId || null,
          branchName: inProgressAppt.branchName || '',
          serviceId: inProgressAppt.serviceId || '',
          serviceName: inProgressAppt.serviceName || 'كشف طبي'
        } : null,
        nextWaitingPatients: waitingAppts.slice(0, 10).map((a: any) => ({
          id: a.id,
          queueNumber: a.queue_number ?? a.queueNumber,
          patientName: a.patientName,
          status: a.status || 'waiting',
          branchId: a.branch_id || a.branchId || null,
          branchName: a.branchName || '',
          serviceId: a.serviceId || '',
          serviceName: a.serviceName || 'كشف طبي',
          priorityNext: Boolean(a.priorityNext),
          isUrgent: Boolean(a.isUrgent),
          createdAt: a.createdAt || null,
          requeuedAt: a.requeuedAt || null,
        }))
      },
      currentPatientExamining: inProgressAppt
        ? {
            queueNumber: inProgressAppt.queue_number,
            label: `مريض دور #${inProgressAppt.queue_number}`
          }
        : null,
      patientQueueInfo,
      patientAppointment: matchingAppointments[0] || null,
      matchingAppointments
    }, { headers: noStore })
  } catch (error: any) {
    console.error('Queue API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء جلب بيانات الانتظار' },
      { status: 500, headers: noStore }
    )
  }
}
