import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { hashPassword, createSessionToken } from '@/lib/auth-crypto'
import { queryDocuments, writeDocument } from '@/lib/server/firebase-rest'

function normalizePhone(p: string): string {
  return String(p || '').replace(/\D/g, '').replace(/^20/, '0')
}

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
    const normalizedInputPhone = normalizePhone(cleanPhone)

    // Resolve clinic
    let clinicId = slug
    try {
      const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
      const cSnap = await getDocs(cQ)
      if (!cSnap.empty) {
        clinicId = cSnap.docs[0].id
      }
    } catch (e) {
      console.warn('Clinic query error:', e)
    }

    // Check if phone already exists in this clinic via server REST
    let allAccounts: any[] = []
    try {
      allAccounts = await queryDocuments('patient_accounts')
    } catch (e) {
      console.warn('queryDocuments patient_accounts error:', e)
    }

    const existing = allAccounts.find((acc: any) => {
      const pNorm = normalizePhone(acc.phone)
      const phoneMatches = pNorm === normalizedInputPhone || acc.phone === cleanPhone
      const clinicMatches = !acc.clinic_id || acc.clinic_id === clinicId || acc.clinicId === clinicId
      return phoneMatches && clinicMatches
    })

    if (existing) {
      return NextResponse.json(
        { error: 'رقم الهاتف مسجل بالفعل في هذه العيادة. يرجى تسجيل الدخول.' },
        { status: 409 }
      )
    }

    // Cryptographically hash password (A03 - P0 Hardening)
    const passwordHash = await hashPassword(String(password))
    const newDocId = crypto.randomUUID()

    await writeDocument(`patient_accounts/${newDocId}`, {
      clinic_id: clinicId,
      name: cleanName,
      phone: cleanPhone,
      age: cleanAge,
      passwordHash,
      createdAt: new Date().toISOString()
    }, true)

    const patientData = {
      id: newDocId,
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
      patientId: newDocId
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
  } catch (error: any) {
    console.error('Patient registration API error:', error)
    return NextResponse.json(
      { error: 'حدث خطأ في الخادم أثناء إنشاء الحساب: ' + (error.message || '') },
      { status: 500 }
    )
  }
}
