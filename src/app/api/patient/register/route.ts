import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { hashPassword, createSessionToken } from '@/lib/auth-crypto'

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

    if (String(password).length < 6) {
      return NextResponse.json(
        { error: 'يجب ألا تقل كلمة المرور عن 6 خانات' },
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

    // Check if phone already exists in this clinic
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

    // Cryptographically hash password (A03 - P0 Hardening)
    const passwordHash = await hashPassword(String(password))

    const newDoc = await addDoc(collection(db, 'patient_accounts'), {
      clinic_id: clinicId,
      name: cleanName,
      phone: cleanPhone,
      age: cleanAge,
      passwordHash,
      createdAt: new Date().toISOString()
    })

    const patientData = {
      id: newDoc.id,
      name: cleanName,
      phone: cleanPhone,
      age: cleanAge,
      clinic_id: clinicId,
      slug
    }

    const token = await createSessionToken({
      role: 'patient',
      name: cleanName,
      phone: cleanPhone,
      clinicId,
      slug,
      patientId: newDoc.id
    })

    const response = NextResponse.json(
      {
        success: true,
        token,
        patient: patientData
      },
      { status: 201 }
    )

    response.cookies.set('patient_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 30 * 24 * 60 * 60
    })

    return response
  } catch (error: any) {
    console.error('Patient register API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء إنشاء الحساب' },
      { status: 500 }
    )
  }
}
