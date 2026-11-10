import { NextRequest, NextResponse } from 'next/server'
import { readDocument, queryDocuments, queryDocumentsByFields } from '@/lib/server/firebase-rest'
import { calculatePatientLivePosition } from '@/lib/queueCalculations'
import { getPhoneSearchVariants, normalizePhoneDigits } from '@/lib/countryPhoneHelper'

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
      return NextResponse.json({ error: 'معرف الحجز غير صالح' }, { status: 400 })
    }

    // 1. Resolve clinic document via secure server REST
    const allClinics = await queryDocuments('clinics')
    const clinicDoc = allClinics.find((c: any) => c.slug === slug || c.id === slug)
    const clinicId = clinicDoc ? clinicDoc.id : slug
    const clinicData: any = clinicDoc || null

    const datesParam = searchParams.get('dates')
    if (datesParam) {
      const dateList = datesParam.split(',').map((d) => d.trim()).filter(Boolean)
      const dailyCounts: Record<string, number> = {}

      const allAppts = await queryDocuments('appointments')
      const clinicAppts = allAppts.filter(
        (a: any) => (a.clinic_id === clinicId || a.clinicId === clinicId) && a.status !== 'cancelled'
      )

      for (const dStr of dateList) {
        dailyCounts[dStr] = clinicAppts.filter((a: any) => a.date === dStr).length
      }

      return NextResponse.json({
        success: true,
        dailyCounts,
        maxDailyBookings: Number(clinicData?.maxDailyBookings) || 0
      })
    }

    const nowCairo = new Date()
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowCairo)

    // 2. TV and individual patient tracking use a tenant/date-scoped query.
    // Unrelated historical appointments must not hide the active queue.
    const tvOnly = searchParams.get('tv') === '1' && !appointmentId && !phone
    const directlyRequested = appointmentId
      ? await readDocument(`appointments/${appointmentId}`)
      : null
    if (appointmentId && directlyRequested &&
        ![directlyRequested.clinic_id, directlyRequested.clinicId].includes(clinicId)) {
      return NextResponse.json({ error: 'الحجز لا يتبع هذه العيادة' }, { status: 403 })
    }
    const snapshotDate = (appointmentId && directlyRequested?.date)
      ? String(directlyRequested.date) : todayStr
    const allAppts = (tvOnly || (appointmentId && directlyRequested))
      ? await queryDocumentsByFields('appointments',
          { clinic_id: clinicId, date: snapshotDate }, 250)
      : await queryDocuments('appointments')
    const clinicAppts = allAppts.filter((a: any) => a.clinic_id === clinicId || a.clinicId === clinicId)

    const allTodayAppts = clinicAppts
      .filter((a: any) => a.date === todayStr)
      .filter((a: any) => !branchId || a.branch_id === branchId || a.branchName === branchId)

    const inProgressAppt = allTodayAppts.find((a: any) => a.status === 'in_progress' || a.status === 'examining')
    const waitingAppts = allTodayAppts.filter((a: any) => a.status === 'waiting' || !a.status)

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
          queueNumber: appt.queue_number,
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

    const currentTurn = inProgressAppt?.queue_number || (waitingAppts[0]?.queue_number ?? 1)
    const aheadCount = patientQueueInfo?.aheadCount ?? waitingAppts.length
    const waitMinutes = patientQueueInfo?.estimatedWaitMins ?? (aheadCount * 15)

    return NextResponse.json({
      success: true,
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
          queueNumber: inProgressAppt.queue_number,
          patientName: inProgressAppt.patientName,
          status: inProgressAppt.status,
          calledAt: inProgressAppt.calledAt,
          startedAt: inProgressAppt.startedAt,
          branchId: inProgressAppt.branch_id || inProgressAppt.branchId || null,
          branchName: inProgressAppt.branchName || '',
          serviceName: inProgressAppt.serviceName || 'كشف طبي'
        } : null,
        nextWaitingPatients: waitingAppts.slice(0, 10).map((a: any) => ({
          id: a.id,
          queueNumber: a.queue_number,
          patientName: a.patientName,
          status: a.status,
          branchId: a.branch_id || a.branchId || null,
          branchName: a.branchName || '',
          serviceName: a.serviceName || 'كشف طبي'
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
    })
  } catch (error: any) {
    console.error('Queue API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء جلب بيانات الانتظار' },
      { status: 500 }
    )
  }
}
