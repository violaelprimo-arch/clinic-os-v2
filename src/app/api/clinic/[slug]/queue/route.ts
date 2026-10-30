import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { calculatePatientLivePosition, formatWaitDuration } from '@/lib/queueCalculations'
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

    // 1. Resolve clinic document
    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    const clinicDoc = cSnap.empty ? null : cSnap.docs[0]
    const clinicId = clinicDoc ? clinicDoc.id : slug
    const clinicData = clinicDoc ? clinicDoc.data() : null

    const nowCairo = new Date()
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(nowCairo)

    // 2. Fetch today's appointments for this clinic
    const todayApptQ = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', todayStr)
    )
    const todayApptSnap = await getDocs(todayApptQ)
    const allTodayAppts = todayApptSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((a) => !branchId || a.branch_id === branchId || a.branchName === branchId)

    const inProgressAppt = allTodayAppts.find((a) => a.status === 'in_progress')
    const waitingAppts = allTodayAppts.filter((a) => a.status === 'waiting' || !a.status)

    // 3. Handle phone / appointment search
    let matchingAppointments: any[] = []
    let patientQueueInfo: any = null

    if (phone) {
      const cleanPhone = phone.trim().replace(/\s+/g, '')
      const normalizedDigits = normalizePhoneDigits(cleanPhone).replace(/[^0-9]/g, '')
      const variants = getPhoneSearchVariants(cleanPhone)

      // Query appointments for this phone within this clinic
      const phoneApptQ = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinicId)
      )
      const phoneApptSnap = await getDocs(phoneApptQ)

      const matchedDocs = phoneApptSnap.docs
        .map((d) => ({ id: d.id, ...d.data() } as any))
        .filter((a) => {
          if (!a.phone) return false
          const aPhoneDigits = normalizePhoneDigits(String(a.phone)).replace(/[^0-9]/g, '')
          if (aPhoneDigits === normalizedDigits || variants.includes(String(a.phone).trim())) {
            return true
          }
          if (normalizedDigits.length >= 7 && aPhoneDigits.endsWith(normalizedDigits.slice(-7))) {
            return true
          }
          return false
        })

      // Sort matching appointments: Today's active first, then future upcoming, then past
      matchingAppointments = matchedDocs.map((appt) => {
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
          // Calculate remaining time until appointment date
          const futureDate = new Date(`${apptDate}T09:00:00`)
          const diffMs = Math.max(0, futureDate.getTime() - nowCairo.getTime())
          const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24))

          queueInfo = {
            status: 'upcoming',
            statusLabel: `موعد قادم في ${apptDate}`,
            isCurrentTurn: false, // strictly false for future dates!
            isNextInLine: false,
            aheadCount: 0,
            effectivePosition: 0,
            estimatedWaitMins: diffDays * 24 * 60,
            formattedWaitTime: diffDays === 1 ? 'غداً' : `خلال ${diffDays} يوم`,
            isFuture: true,
            daysRemaining: diffDays
          }
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
          patientName: appt.patientName,
          phone: appt.phone,
          serviceId: appt.serviceId,
          serviceName: appt.serviceName || 'كشف',
          branchId: appt.branch_id,
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
      // Privacy Guard: Anonymize other patients entirely
      currentPatientExamining: inProgressAppt
        ? {
            queueNumber: inProgressAppt.queue_number,
            label: `مريض دور #${inProgressAppt.queue_number}`
          }
        : null,
      patientQueueInfo,
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
