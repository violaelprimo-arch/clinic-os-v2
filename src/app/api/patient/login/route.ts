import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, addDoc, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifyPassword, hashPassword, createSessionToken } from '@/lib/auth-crypto'

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
      const userDoc = accSnap.docs[0]
      const user = userDoc.data()
      const storedPassword = user.passwordHash || user.password

      // A03 - Reject accounts without a password; do NOT allow arbitrary password bypass
      if (!storedPassword || String(storedPassword).trim() === '') {
        return NextResponse.json(
          {
            error:
              'لم يتم تعيين كلمة مرور لهذا الحساب بعد. يرجى إنشاء حساب جديد بكلمة مرور أو مراجعة إدارة العيادة.'
          },
          { status: 403 }
        )
      }

      const isMatch = await verifyPassword(String(password), String(storedPassword))
      if (!isMatch) {
        return NextResponse.json(
          { error: 'كلمة المرور غير صحيحة' },
          { status: 401 }
        )
      }

      // Automatically upgrade legacy plaintext password to secure cryptographic hash
      if (!user.passwordHash) {
        const newHash = await hashPassword(String(password))
        updateDoc(doc(db, 'patient_accounts', userDoc.id), {
          passwordHash: newHash,
          password: ''
        }).catch(() => {})
      }

      const patientData = {
        id: userDoc.id,
        name: user.name || 'المريض',
        phone: cleanPhone,
        age: user.age || '',
        clinic_id: clinicId,
        slug
      }

      const token = await createSessionToken({
        role: 'patient',
        name: patientData.name,
        phone: cleanPhone,
        clinicId,
        slug,
        patientId: userDoc.id
      })

      const response = NextResponse.json({
        success: true,
        token,
        patient: patientData
      })

      response.cookies.set('patient_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60 // 30 days
      })

      return response
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

      const passwordHash = await hashPassword(String(password))

      const newAccRef = await addDoc(collection(db, 'patient_accounts'), {
        clinic_id: clinicId,
        name: patientName,
        phone: cleanPhone,
        age: patientAge,
        passwordHash,
        createdAt: new Date().toISOString()
      })

      const patientData = {
        id: newAccRef.id,
        name: patientName,
        phone: cleanPhone,
        age: patientAge,
        clinic_id: clinicId,
        slug
      }

      const token = await createSessionToken({
        role: 'patient',
        name: patientName,
        phone: cleanPhone,
        clinicId,
        slug,
        patientId: newAccRef.id
      })

      const response = NextResponse.json({
        success: true,
        token,
        patient: patientData
      })

      response.cookies.set('patient_session', token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/',
        maxAge: 30 * 24 * 60 * 60
      })

      return response
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
