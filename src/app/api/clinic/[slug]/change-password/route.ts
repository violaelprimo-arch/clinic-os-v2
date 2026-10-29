import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifyPassword, hashPassword, createSessionToken, verifySessionToken } from '@/lib/auth-crypto'
import { recordAuditLog } from '@/lib/audit-logger'

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const { slug } = await params
    const body = await req.json().catch(() => ({}))
    const { currentPassword, newPassword } = body

    if (!slug) {
      return NextResponse.json({ error: 'معرف العيادة مطلوب' }, { status: 400 })
    }

    if (!currentPassword || !newPassword) {
      return NextResponse.json(
        { error: 'يرجى إدخال كلمة المرور الحالية وكلمة المرور الجديدة' },
        { status: 400 }
      )
    }

    if (String(newPassword).length < 6) {
      return NextResponse.json(
        { error: 'يجب ألا تقل كلمة المرور الجديدة عن 6 خانات' },
        { status: 400 }
      )
    }

    if (currentPassword === newPassword) {
      return NextResponse.json(
        { error: 'كلمة المرور الجديدة يجب أن تكون مختلفة عن كلمة المرور الحالية' },
        { status: 400 }
      )
    }

    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const snap = await getDocs(q)
    if (snap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const cDoc = snap.docs[0]
    const clinic = cDoc.data()
    const clinicId = cDoc.id

    // Verify current password against stored hash/legacy
    const storedHash = clinic.doctorPasswordHash || clinic.doctorPassword
    const isCurrentValid = await verifyPassword(currentPassword, storedHash)
    if (!isCurrentValid) {
      return NextResponse.json(
        { error: 'كلمة المرور الحالية غير صحيحة' },
        { status: 401 }
      )
    }

    // Hash new password securely
    const newHash = await hashPassword(newPassword)

    await updateDoc(doc(db, 'clinics', clinicId), {
      doctorPasswordHash: newHash,
      doctorPassword: null, // Clear plaintext initial password
      mustChangePassword: false,
      passwordLastChangedAt: new Date().toISOString()
    })

    // Issue updated session token without mustChangePassword flag
    const updatedToken = await createSessionToken({
      role: 'doctor',
      email: clinic.doctorEmail,
      name: clinic.doctorName || 'طبيب العيادة',
      clinicId,
      slug,
      mustChangePassword: false
    })

    await recordAuditLog({
      action: 'PASSWORD_RESET',
      actorName: clinic.doctorName || 'طبيب العيادة',
      actorRole: 'doctor',
      clinicId,
      details: { email: clinic.doctorEmail, forcedChangeCompleted: true }
    })

    const response = NextResponse.json({
      success: true,
      message: 'تم تغيير كلمة المرور بنجاح!',
      token: updatedToken
    })

    response.cookies.set('clinic_session', updatedToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60
    })

    return response
  } catch (err: any) {
    console.error('Change password API error:', err)
    return NextResponse.json(
      { error: err?.message || 'حدث خطأ أثناء تغيير كلمة المرور' },
      { status: 500 }
    )
  }
}
