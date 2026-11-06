import { NextRequest, NextResponse } from 'next/server'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { verifyPassword, hashPassword, createSessionToken } from '@/lib/auth-crypto'
import { recordAuditLog } from '@/lib/audit-logger'
import { SINGLE_CLINIC_SLUG } from '@/lib/single-clinic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, password, slug: rawSlug } = body

    if (!email || !password) {
      return NextResponse.json({ error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور' }, { status: 400 })
    }

    const trimmedEmail = String(email).trim().toLowerCase()
    const slug = typeof rawSlug === 'string' && rawSlug.trim() ? rawSlug.trim() : null

    // 1. Locate the clinic document
    let clinicDoc: any = null
    let effectiveSlug: string = slug || SINGLE_CLINIC_SLUG

    if (slug) {
      const q = query(collection(db, 'clinics'), where('slug', '==', slug))
      const snap = await getDocs(q)
      if (!snap.empty) {
        clinicDoc = snap.docs[0]
        effectiveSlug = clinicDoc.data().slug || slug
      }
    } else {
      // Universal login: lookup clinic by doctor email
      const docQ = query(collection(db, 'clinics'), where('doctorEmail', '==', trimmedEmail))
      const docSnap = await getDocs(docQ)
      if (!docSnap.empty) {
        clinicDoc = docSnap.docs[0]
        effectiveSlug = clinicDoc.data().slug || effectiveSlug
      } else {
        // Lookup clinic by assistant primary email
        const assQ = query(collection(db, 'clinics'), where('assistantEmail', '==', trimmedEmail))
        const assSnap = await getDocs(assQ)
        if (!assSnap.empty) {
          clinicDoc = assSnap.docs[0]
          effectiveSlug = clinicDoc.data().slug || effectiveSlug
        } else {
          // Check all clinics for secondary assistant array matching email
          const allClinicsSnap = await getDocs(collection(db, 'clinics'))
          for (const d of allClinicsSnap.docs) {
            const data = d.data()
            if (Array.isArray(data.assistants)) {
              if (data.assistants.some((a: any) => (a.email || '').trim().toLowerCase() === trimmedEmail)) {
                clinicDoc = d
                effectiveSlug = data.slug || effectiveSlug
                break
              }
            }
          }
        }
      }
    }

    if (!clinicDoc) {
      // Prevent tenant enumeration by returning standard 401
      return NextResponse.json({ error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
    }

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
      slug: effectiveSlug,
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
      details: { email: trimmedEmail, branchId: assignedBranchId, universal: !slug }
    })

    const canonicalDashboardUrl = `/clinic/${effectiveSlug}/admin`

    const response = NextResponse.json({
      success: true,
      token,
      redirectUrl: canonicalDashboardUrl,
      user: {
        role,
        name: userName,
        email: trimmedEmail,
        clinicId,
        slug: effectiveSlug,
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
