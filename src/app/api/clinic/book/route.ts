import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { createClinicNotification } from '@/lib/notificationService'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const {
      clinicId: rawClinicId,
      slug = 'zizo',
      branchId = null,
      branchName = 'الفرع الرئيسي',
      serviceId = '1',
      serviceName = 'كشف عادي',
      servicePrice = 250,
      date,
      time = '10:30 ص',
      patientName,
      patientPhone,
      birthDate,
      gender = 'أنثى',
      age
    } = body

    if (!patientName || !patientPhone) {
      return NextResponse.json(
        { error: 'اسم المريض ورقم الهاتف مطلوبان' },
        { status: 400 }
      )
    }

    const cleanPhone = String(patientPhone).trim().replace(/\s+/g, '')
    const cleanName = String(patientName).trim()

    // Resolve clinic ID
    let clinicId = rawClinicId
    if (!clinicId) {
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      clinicId = cSnap.empty ? slug : cSnap.docs[0].id
    }

    const bookingDate = date || new Date().toISOString().split('T')[0]

    // Calculate real sequential queue number
    const qAppts = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', bookingDate)
    )
    const apptSnap = await getDocs(qAppts)
    const filteredAppts = apptSnap.docs.filter((d) => {
      const data = d.data()
      return !branchId || data.branch_id === branchId || data.branchName === branchName
    })

    const queueNumber = filteredAppts.length + 1
    const aheadCount = filteredAppts.filter(
      (d) => d.data().status === 'waiting' || !d.data().status
    ).length

    const isUrgent =
      String(serviceName).includes('مستعجل') ||
      String(serviceName).includes('طوارئ') ||
      String(serviceId) === '3'

    let calculatedAge = age ? String(age).trim() : ''
    if (!calculatedAge && birthDate) {
      const bYear = new Date(birthDate).getFullYear()
      const curYear = new Date().getFullYear()
      if (bYear > 1900 && bYear <= curYear) {
        calculatedAge = String(curYear - bYear)
      }
    }

    const newAppt = {
      clinic_id: clinicId,
      branch_id: branchId || null,
      branchName: branchName || 'الفرع الرئيسي',
      patientName: cleanName,
      phone: cleanPhone,
      age: calculatedAge || null,
      birthDate: birthDate || null,
      gender: gender || 'أنثى',
      serviceId: String(serviceId),
      serviceName: String(serviceName),
      servicePrice: Number(servicePrice) || 0,
      isUrgent,
      date: bookingDate,
      time: String(time),
      queue_number: queueNumber,
      status: 'waiting',
      paymentMethod: 'cash',
      paymentStatus: 'unpaid',
      createdAt: new Date().toISOString()
    }

    const docRef = await addDoc(collection(db, 'appointments'), newAppt)

    // Auto-create patient account if missing
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
          createdAt: new Date().toISOString()
        })
      }
    } catch (e) {
      console.warn('Patient account auto creation notice:', e)
    }

    // Trigger clinic notifications
    createClinicNotification({
      clinicId,
      branchId: branchId || undefined,
      recipientType: 'staff',
      recipientTarget: clinicId,
      title: 'حجز جديد مسجل',
      body: `حجز جديد للمريض ${cleanName} برقم دور #${queueNumber}.`,
      type: 'new_booking',
      appointmentId: docRef.id
    }).catch(() => {})

    return NextResponse.json(
      {
        success: true,
        appointment: {
          id: docRef.id,
          queueNumber,
          aheadCount,
          date: bookingDate,
          time,
          branchName,
          patientName: cleanName
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Booking API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء تسجيل الحجز' },
      { status: 500 }
    )
  }
}
