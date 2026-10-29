import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifyPassword, hashPassword, createSessionToken } from '@/lib/auth-crypto'
import { recordAuditLog } from '@/lib/audit-logger'
import { SINGLE_CLINIC_SLUG } from '@/lib/single-clinic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, slug = SINGLE_CLINIC_SLUG } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' }, { status: 400 })
    }

    const trimmedEmail = String(email).trim().toLowerCase()

    // 1. Fetch the single clinic document
    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const snap = await getDocs(q)
    if (snap.empty) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404 })
    }

    const clinicDoc = snap.docs[0]
    const clinic = clinicDoc.data()
    const clinicId = clinicDoc.id

    // Check Doctor
    const isDoctorEmail = (clinic.doctorEmail || '').trim().toLowerCase() === trimmedEmail
    let isDoctorMatch = false
    if (isDoctorEmail) {
      const storedHash = clinic.doctorPasswordHash || clinic.doctorPassword
      isDoctorMatch = await verifyPassword(password, storedHash)

      // If matched and hash was not stored, automatically upgrade to hash
      if (isDoctorMatch && !clinic.doctorPasswordHash) {
        const newHash = await hashPassword(password)
        updateDoc(doc(db, 'clinics', clinicId), { doctorPasswordHash: newHash }).catch(() => {})
      }
    }

    // Check Assistant
    const isAssEmail = (clinic.assistantEmail || '').trim().toLowerCase() === trimmedEmail
    let isAssMatch = false
    if (isAssEmail) {
      const storedHash = clinic.assistantPasswordHash || clinic.assistantPassword
      isAssMatch = await verifyPassword(password, storedHash)

      if (isAssMatch && !clinic.assistantPasswordHash) {
        const newHash = await hashPassword(password)
        updateDoc(doc(db, 'clinics', clinicId), { assistantPasswordHash: newHash }).catch(() => {})
      }
    }

    // Check secondary assistants array
    let matchedSecondaryAss: any = null
    if (!isDoctorMatch && !isAssMatch && Array.isArray(clinic.assistants)) {
      for (const ass of clinic.assistants) {
        if ((ass.email || '').trim().toLowerCase() === trimmedEmail) {
          const matched = await verifyPassword(password, ass.passwordHash || ass.password)
          if (matched) {
            matchedSecondaryAss = ass
            break
          }
        }
      }
    }

    if (!isDoctorMatch && !isAssMatch && !matchedSecondaryAss) {
      return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
    }

    const role: 'doctor' | 'assistant' = isDoctorMatch ? 'doctor' : 'assistant'
    const userName = isDoctorMatch
      ? (clinic.doctorName || 'دكتور العيادة')
      : (matchedSecondaryAss?.name || 'مساعد العيادة')

    const assignedBranchId = isDoctorMatch ? undefined : (matchedSecondaryAss?.branchId || clinic.assistantBranchId || undefined)
    const assignedBranchName = isDoctorMatch ? undefined : (matchedSecondaryAss?.branchName || clinic.assistantBranchName || undefined)

    const isMustChangePassword = isDoctorMatch && clinic.mustChangePassword === true

    // Create cryptographically signed session token
    const token = await createSessionToken({
      role,
      email: trimmedEmail,
      name: userName,
      clinicId,
      slug,
      branchId: assignedBranchId,
      branchName: assignedBranchName,
      mustChangePassword: isMustChangePassword
    })

    // Record audit log
    await recordAuditLog({
      action: 'AUTH_LOGIN',
      actorName: userName,
      actorRole: role,
      clinicId,
      details: { email: trimmedEmail, branchId: assignedBranchId }
    })

    const response = NextResponse.json({
      success: true,
      token,
      user: {
        role,
        name: userName,
        email: trimmedEmail,
        clinicId,
        slug,
        branchId: assignedBranchId,
        branchName: assignedBranchName,
        mustChangePassword: isMustChangePassword
      }
    })

    // Set secure HTTP-only cookie
    response.cookies.set('clinic_session', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 7 * 24 * 60 * 60 // 7 days
    })

    return response
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 })
  }
}
