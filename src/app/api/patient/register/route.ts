import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { slug = 'zizo', name, phone, age, password } = body

    if (!name || !phone || !password) {
      return NextResponse.json(
        { error: 'يرجى إكمال جميع الحقول الإلزامية: الاسم، الهاتف، وكلمة المرور' },
        { status: 400 }
      )
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '')
    const cleanName = String(name).trim()
    const cleanAge = String(age || '').trim()

    // Resolve clinic
    const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
    const cSnap = await getDocs(cQ)
    const clinicId = cSnap.empty ? slug : cSnap.docs[0].id

    // Check if phone already exists
    const checkQ = query(
      collection(db, 'patient_accounts'),
      where('clinic_id', '==', clinicId),
      where('phone', '==', cleanPhone)
    )
    const checkSnap = await getDocs(checkQ)

    if (!checkSnap.empty) {
      return NextResponse.json(
        { error: 'رقم الهاتف مسجل بالفعل في هذه العيادة. يرجى تسجيل الدخول.' },
        { status: 409 }
      )
    }

    const newDoc = await addDoc(collection(db, 'patient_accounts'), {
      clinic_id: clinicId,
      name: cleanName,
      phone: cleanPhone,
      age: cleanAge,
      password: String(password),
      createdAt: new Date().toISOString()
    })

    return NextResponse.json(
      {
        success: true,
        patient: {
          id: newDoc.id,
          name: cleanName,
          phone: cleanPhone,
          age: cleanAge,
          clinic_id: clinicId,
          slug
        }
      },
      { status: 201 }
    )
  } catch (error: any) {
    console.error('Patient register API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء إنشاء الحساب' },
      { status: 500 }
    )
  }
}
