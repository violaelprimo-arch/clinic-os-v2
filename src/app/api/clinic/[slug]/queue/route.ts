import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { calculatePatientLivePosition } from '@/lib/queueCalculations'

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

    // Resolve clinic
    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    const clinicDoc = cSnap.empty ? null : cSnap.docs[0]
    const clinicId = clinicDoc ? clinicDoc.id : slug
    const clinicData = clinicDoc ? clinicDoc.data() : null

    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())

    const apptQ = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', today)
    )
    const apptSnap = await getDocs(apptQ)
    const allAppts = apptSnap.docs
      .map((d) => ({ id: d.id, ...d.data() } as any))
      .filter((a) => !branchId || a.branch_id === branchId)

    const inProgressAppt = allAppts.find((a) => a.status === 'in_progress')
    const waitingAppts = allAppts.filter((a) => a.status === 'waiting' || !a.status)

    let patientQueueInfo = null
    if (phone) {
      const cleanPhone = phone.trim().replace(/\s+/g, '')
      const myAppt = allAppts.find((a) => a.phone && a.phone.replace(/\s+/g, '') === cleanPhone)
      if (myAppt) {
        patientQueueInfo = calculatePatientLivePosition({
          targetAppointmentId: myAppt.id,
          targetAppointment: myAppt,
          allTodayAppointments: allAppts,
          clinic: clinicData
        })
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
      currentPatientExamining: inProgressAppt
        ? { queueNumber: inProgressAppt.queue_number, patientName: inProgressAppt.patientName }
        : null,
      patientQueueInfo
    })
  } catch (error: any) {
    console.error('Queue API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء جلب بيانات الانتظار' },
      { status: 500 }
    )
  }
}
