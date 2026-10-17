import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { slug = 'zizo', phone, password } = body

    if (!phone || !password) {
      return NextResponse.json(
        { error: 'يرجى إدخال رقم الهاتف وكلمة المرور' },
        { status: 400 }
      )
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '')

    // Resolve clinic
    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    const clinicId = cSnap.empty ? slug : cSnap.docs[0].id

    // Check patient_accounts
    const accQ = query(
      collection(db, 'patient_accounts'),
      where('clinic_id', '==', clinicId),
      where('phone', '==', cleanPhone)
    )
    const accSnap = await getDocs(accQ)

    if (!accSnap.empty) {
      const user = accSnap.docs[0].data()
      if (user.password && user.password !== password) {
        return NextResponse.json(
          { error: 'كلمة المرور غير صحيحة' },
          { status: 401 }
        )
      }
      return NextResponse.json({
        success: true,
        patient: {
          id: accSnap.docs[0].id,
          name: user.name || 'المريض',
          phone: cleanPhone,
          age: user.age || '',
          clinic_id: clinicId,
          slug
        }
      })
    }

    // Check past appointments
    const apptQ = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('phone', '==', cleanPhone)
    )
    const apptSnap = await getDocs(apptQ)

    if (!apptSnap.empty) {
      const firstAppt = apptSnap.docs[0].data()
      const patientName = firstAppt.patientName || 'المريض'
      const patientAge = firstAppt.age || ''

      const newAccRef = await addDoc(collection(db, 'patient_accounts'), {
        clinic_id: clinicId,
        name: patientName,
        phone: cleanPhone,
        age: patientAge,
        password,
        createdAt: new Date().toISOString()
      })

      return NextResponse.json({
        success: true,
        patient: {
          id: newAccRef.id,
          name: patientName,
          phone: cleanPhone,
          age: patientAge,
          clinic_id: clinicId,
          slug
        }
      })
    }

    return NextResponse.json(
      { error: 'رقم الهاتف غير مسجل في هذه العيادة. يرجى إنشاء حساب جديد.' },
      { status: 404 }
    )
  } catch (error: any) {
    console.error('Patient login API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء تسجيل الدخول' },
      { status: 500 }
    )
  }
}
