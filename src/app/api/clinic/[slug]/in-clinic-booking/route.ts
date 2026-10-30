import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, doc, getDoc, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifySessionToken } from '@/lib/auth-crypto'
import { createAtomicAppointment } from '@/lib/queueService'
import { createClinicNotification } from '@/lib/notificationService'
import { cleanPhoneForWhatsApp } from '@/lib/countryPhoneHelper'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const resolvedParams = await params
    const slug = resolvedParams.slug

    // 1. Authenticate user session
    const sessionToken =
      req.cookies.get('clinic_session')?.value ||
      req.headers.get('Authorization')?.replace('Bearer ', '')

    if (!sessionToken) {
      return NextResponse.json({ error: 'غير مصرح بالوصول — يرجى تسجيل الدخول' }, { status: 401 })
    }

    const session = await verifySessionToken(sessionToken)
    if (!session.valid || !session.payload) {
      return NextResponse.json({ error: 'جلسة الدخول غير صالحة أو منتهية' }, { status: 401 })
    }

    const userRole = session.payload.role
    if (userRole !== 'doctor' && userRole !== 'assistant') {
      return NextResponse.json({ error: 'صلاحيات غير كافية لإجراء الحجز الداخلي' }, { status: 403 })
    }

    // 2. Fetch and resolve clinic
    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    if (cSnap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const clinicDoc = cSnap.docs[0]
    const clinic = clinicDoc.data()
    const clinicId = clinicDoc.id

    // Verify session belongs to this clinic
    if (session.payload.clinicId && session.payload.clinicId !== clinicId && session.payload.clinicId !== slug) {
      return NextResponse.json({ error: 'غير مصرح لك بإجراء حجوزات لهذه العيادة' }, { status: 403 })
    }

    // Assistant assistantPermissions check
    if (userRole === 'assistant') {
      const permissions = clinic.assistantPermissions || ['appointments']
      if (!permissions.includes('appointments') && !permissions.includes('in-clinic-booking')) {
        return NextResponse.json({ error: 'ليس لديك صلاحية لتسجيل الحجوزات' }, { status: 403 })
      }
    }

    const body = await req.json().catch(() => ({}))
    const {
      patientName,
      phone,
      age,
      birthDate,
      gender = 'أنثى',
      branchId,
      serviceId,
      date,
      time,
      paymentMethod = 'cash',
      paymentStatus = 'unpaid',
      notes,
      residence
    } = body

    // 3. Validate mandatory fields
    if (!patientName || !String(patientName).trim()) {
      return NextResponse.json({ error: 'اسم المريض مطلوب' }, { status: 400 })
    }
    if (!phone || !String(phone).trim()) {
      return NextResponse.json({ error: 'رقم هاتف المريض مطلوب' }, { status: 400 })
    }

    const cleanName = String(patientName).trim()
    const cleanPhone = String(phone).trim().replace(/\s+/g, '')

    // 4. Branch Restriction Check
    const lockedBranchId = session.payload.branchId
    let effectiveBranchId = branchId || lockedBranchId || null

    if (userRole === 'assistant' && lockedBranchId) {
      if (branchId && branchId !== lockedBranchId) {
        return NextResponse.json(
          { error: 'غير مصرح لك بتسجيل حجز لفرع آخر غير الفرع المقيد به حسابك' },
          { status: 403 }
        )
      }
      effectiveBranchId = lockedBranchId
    }

    // Resolve branch details from database
    let branchName = 'الفرع الرئيسي'
    let branchMaxLimit = 0
    if (effectiveBranchId) {
      try {
        const bDoc = await getDoc(doc(db, 'branches', effectiveBranchId))
        if (bDoc.exists()) {
          const bData = bDoc.data()
          if (bData.isArchived) {
            return NextResponse.json({ error: 'هذا الفرع مؤرشف حاليًا وغير متاح للحجز' }, { status: 400 })
          }
          branchName = bData.name || branchName
          branchMaxLimit = Number(bData.maxDailyBookings) || 0
        } else if (clinic.branches && Array.isArray(clinic.branches)) {
          const found = clinic.branches.find((b: any) => b.id === effectiveBranchId)
          if (found) {
            branchName = found.name || branchName
            branchMaxLimit = Number(found.maxDailyBookings) || 0
          }
        }
      } catch (err) {
        console.warn('Branch fetch warning:', err)
      }
    }

    // 5. Service & Pricing Verification from Database
    const clinicServices = Array.isArray(clinic.services) && clinic.services.length > 0
      ? clinic.services
      : [
          { id: '1', name: 'كشف عادي', price: 250 },
          { id: '2', name: 'استشارة', price: 150 },
          { id: '3', name: 'كشف مستعجل', price: 400 },
          { id: '4', name: 'متابعة دورية', price: 100 }
        ]

    const targetService = clinicServices.find((s: any) => String(s.id) === String(serviceId)) || clinicServices[0]
    const verifiedServiceId = String(targetService.id)
    const verifiedServiceName = String(targetService.name || 'كشف عيادة')
    // Server-enforced price from database
    const verifiedServicePrice = Number(targetService.price) || 0

    const isUrgent =
      Boolean(targetService.isUrgent) ||
      verifiedServiceName.includes('مستعجل') ||
      verifiedServiceName.includes('طوارئ') ||
      verifiedServiceId === '3'

    // 6. Booking Date & Capacity Limits
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
    }

    // 7. Duplicate Booking Guard (prevents double clicking / accidental multi-submits)
    const cleanPhoneDigits = cleanPhone.replace(/[^0-9]/g, '')
    const existingDuplicate = activeAppts.find((d) => {
      const data = d.data()
      const dPhone = String(data.phone || '').replace(/[^0-9]/g, '')
      const dName = String(data.patientName || '').trim().toLowerCase()
      const dBranch = data.branch_id || data.branchId || null
      const isSameBranch = !effectiveBranchId || !dBranch || dBranch === effectiveBranchId

      return (
        isSameBranch &&
        dPhone === cleanPhoneDigits &&
        dName === cleanName.toLowerCase() &&
        (data.status === 'waiting' || data.status === 'in_progress')
      )
    })

    if (existingDuplicate) {
      const dupData = existingDuplicate.data()
      return NextResponse.json(
        {
          error: `يوجد حجز مسجل بالفعل لهذا المريض في نفس التاريخ والفرع (تذكرة رقم #${dupData.queue_number || '--'})`
        },
        { status: 409 }
      )
    }

    // Calculate age if not provided but birthDate exists
    let calculatedAge = age ? String(age).trim() : ''
    if (!calculatedAge && birthDate) {
      const bYear = new Date(birthDate).getFullYear()
      const curYear = new Date().getFullYear()
      if (bYear > 1900 && bYear <= curYear) {
        calculatedAge = String(curYear - bYear)
      }
    }

    // 8. Prepare appointment data with source: 'in_clinic'
    const newAppointmentData = {
      clinic_id: clinicId,
      branch_id: effectiveBranchId || null,
      branchName,
      patientName: cleanName,
      phone: cleanPhone,
      age: calculatedAge || null,
      birthDate: birthDate || null,
      gender: gender || 'أنثى',
      serviceId: verifiedServiceId,
      serviceName: verifiedServiceName,
      servicePrice: verifiedServicePrice,
      isUrgent,
      date: bookingDate,
      time: time || 'حسب الدور',
      status: 'waiting',
      paymentMethod: paymentMethod || 'cash',
      paymentStatus: paymentStatus === 'paid' ? 'paid' : 'unpaid',
      source: 'in_clinic', // explicitly marks as in-clinic booking
      notes: notes ? String(notes).trim() : null,
      patientResidenceSnapshot: residence || null,
      bookedBy: {
        role: userRole,
        name: session.payload.name || 'الاستقبال',
        email: session.payload.email
      },
      createdAt: new Date().toISOString()
    }

    // 9. Atomically allocate queue ticket number with quota protection
    let newApptId: string
    let queueNumber: number
    try {
      const atomicRes = await createAtomicAppointment(newAppointmentData, effectiveLimit)
      newApptId = atomicRes.id
      queueNumber = atomicRes.queueNumber
    } catch (atomicErr: any) {
      if (atomicErr?.message?.includes('QUOTA_EXCEEDED')) {
        return NextResponse.json(
          { error: 'اكتمل عدد الحجوزات المتاحة لهذا اليوم. برجاء اختيار موعد آخر.' },
          { status: 400 }
        )
      }
      throw atomicErr
    }

    // 10. Auto-create or update patient account
    try {
      const accQ = query(
        collection(db, 'patient_accounts'),
        where('clinic_id', '==', clinicId),
        where('phone', '==', cleanPhone)
      )
      const accSnap = await getDocs(accQ)
      if (accSnap.empty) {
        await addDoc(collection(db, 'patient_accounts'), {
          clinic_id: clinicId,
          name: cleanName,
          phone: cleanPhone,
          age: calculatedAge || '',
          gender: gender || '',
          createdAt: new Date().toISOString()
        })
      }
    } catch (e) {
      console.warn('Patient account auto update warning:', e)
    }

    // 11. Trigger Staff Notifications
    try {
      createClinicNotification({
        clinicId,
        branchId: effectiveBranchId || undefined,
        recipientType: 'staff',
        recipientTarget: clinicId,
        title: 'حجز جديد داخل العيادة',
        body: `تم تسجيل حجز للمريض ${cleanName} (${verifiedServiceName} - دور #${queueNumber})`,
        type: 'new_booking',
        appointmentId: newApptId
      })
    } catch (e) {
      console.warn('Notification warning:', e)
    }

    return NextResponse.json({
      success: true,
      appointment: {
        id: newApptId,
        queueNumber,
        patientName: cleanName,
        phone: cleanPhone,
        serviceId: verifiedServiceId,
        serviceName: verifiedServiceName,
        servicePrice: verifiedServicePrice,
        branchId: effectiveBranchId,
        branchName,
        date: bookingDate,
        time: time || 'حسب الدور',
        paymentMethod: paymentMethod || 'cash',
        paymentStatus: paymentStatus === 'paid' ? 'paid' : 'unpaid',
        source: 'in_clinic'
      }
    })
  } catch (error: any) {
    console.error('In-clinic booking API error:', error)
    return NextResponse.json(
      { error: error?.message || 'حدث خطأ في الخادم أثناء تأكيد الحجز' },
      { status: 500 }
    )
  }
}
