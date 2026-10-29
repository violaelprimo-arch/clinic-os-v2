import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, updateDoc, doc, addDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPhoneSearchVariants } from '@/lib/countryPhoneHelper'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { clinic_id, phone, avatarUrl, name, age } = body

    if (!clinic_id || !phone) {
      return NextResponse.json(
        { error: 'المعلومات المطلوبة غير مكتملة (رقم الهاتف والعيادة مطلوبان)' },
        { status: 400 }
      )
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '')
    const phoneVariants = getPhoneSearchVariants(cleanPhone)
    const searchPhones = phoneVariants.length > 0 ? phoneVariants.slice(0, 10) : [cleanPhone]

    // Find patient_accounts
    const accQ = query(
      collection(db, 'patient_accounts'),
      where('clinic_id', '==', clinic_id),
      where('phone', 'in', searchPhones)
    )
    const accSnap = await getDocs(accQ)

    if (!accSnap.empty) {
      const targetDoc = accSnap.docs[0]
      await updateDoc(doc(db, 'patient_accounts', targetDoc.id), {
        avatarUrl: avatarUrl || '',
        updatedAt: new Date().toISOString()
      })
      return NextResponse.json({
        success: true,
        docId: targetDoc.id,
        avatarUrl: avatarUrl || ''
      })
    } else {
      // Create new account if not present
      const newDoc = await addDoc(collection(db, 'patient_accounts'), {
        clinic_id,
        phone: cleanPhone,
        name: name || 'المريض',
        age: age || '',
        avatarUrl: avatarUrl || '',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      })
      return NextResponse.json({
        success: true,
        docId: newDoc.id,
        avatarUrl: avatarUrl || ''
      })
    }
  } catch (err: any) {
    console.error('Error in /api/patient/avatar:', err)
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ أثناء حفظ الصورة' },
      { status: 500 }
    )
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const { clinic_id, phone } = body

    if (!clinic_id || !phone) {
      return NextResponse.json(
        { error: 'المعلومات المطلوبة غير مكتملة' },
        { status: 400 }
      )
    }

    const cleanPhone = String(phone).trim().replace(/\s+/g, '')
    const phoneVariants = getPhoneSearchVariants(cleanPhone)
    const searchPhones = phoneVariants.length > 0 ? phoneVariants.slice(0, 10) : [cleanPhone]

    const accQ = query(
      collection(db, 'patient_accounts'),
      where('clinic_id', '==', clinic_id),
      where('phone', 'in', searchPhones)
    )
    const accSnap = await getDocs(accQ)

    if (!accSnap.empty) {
      for (const d of accSnap.docs) {
        await updateDoc(doc(db, 'patient_accounts', d.id), {
          avatarUrl: '',
          updatedAt: new Date().toISOString()
        })
      }
    }

    return NextResponse.json({ success: true })
  } catch (err: any) {
    console.error('Error deleting avatar:', err)
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ أثناء إزالة الصورة' },
      { status: 500 }
    )
  }
}
