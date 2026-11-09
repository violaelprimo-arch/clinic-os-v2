import { NextRequest, NextResponse } from 'next/server'
import { queryDocuments, writeDocument } from '@/lib/server/firebase-rest'
import { verifyPassword, hashPassword, createSessionToken } from '@/lib/auth-crypto'
import { recordAuditLog } from '@/lib/audit-logger'
import { SINGLE_CLINIC_SLUG } from '@/lib/single-clinic'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { email, username, identifier, password, slug: rawSlug } = body
    const loginIdentifier = String(identifier || username || email || '').trim().toLowerCase()
    if (!loginIdentifier || !password || loginIdentifier.length > 254 ||
        typeof password !== 'string' || password.length > 1024) {
      return NextResponse.json({ error: 'يرجى إدخال اسم المستخدم أو البريد الإلكتروني وكلمة المرور' }, { status: 400 })
    }
    const slug = typeof rawSlug === 'string' && rawSlug.trim() ? rawSlug.trim() : null

    // Resolve the clinic on the trusted server. Client Firestore reads were
    // denied after hardening Firestore rules and caused valid logins to fail.
    // Username is an alias only; passwords remain salted hashes in Firestore.
    const slug = typeof rawSlug === 'string' && rawSlug.trim()
      ? rawSlug.trim().toLowerCase() : null
    const clinics = await queryDocuments('clinics')
    const matchingClinics = clinics.filter((c: any) => {
      if (slug && c.slug !== slug) return false
      const values = [
        c.doctorEmail, c.assistantEmail, c.doctorUsername, c.assistantUsername,
        ...(Array.isArray(c.assistants) ? c.assistants.flatMap((a: any) => [a.email, a.username]) : [])
      ]
      return values.some(v => typeof v === 'string' && v.trim().toLowerCase() === loginIdentifier)
    })
    // Fail closed when username/email aliases are ambiguous across tenants.
    if (matchingClinics.length !== 1) {
      return NextResponse.json({ error: 'اسم المستخدم أو البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
    }
    const clinic = matchingClinics[0] as any
    const clinicId = String(clinic.id)
    const effectiveSlug = String(clinic.slug || slug || SINGLE_CLINIC_SLUG)
    if (clinic.isActive === false) {
      return NextResponse.json({ error: 'هذا الحساب غير متاح حالياً، تواصل مع إدارة المنصة' }, { status: 403 })
    }

    // Check Doctor
    const isDoctorEmail = [clinic.doctorEmail, clinic.doctorUsername].some((v: unknown) => typeof v === 'string' && v.trim().toLowerCase() === loginIdentifier)
    let isDoctorMatch = false
    if (isDoctorEmail) {
      const storedHash = clinic.doctorPasswordHash || clinic.doctorPassword
      isDoctorMatch = await verifyPassword(password, storedHash)

      // If matched and hash was not stored, automatically upgrade to hash
      if (isDoctorMatch && (!clinic.doctorPasswordHash || !String(clinic.doctorPasswordHash).startsWith('pbkdf2:'))) {
        const newHash = await hashPassword(password)
        await writeDocument(`clinics/${clinicId}`, { doctorPasswordHash: newHash, doctorPassword: null }, true)
      }
    }

    // Check Assistant
    const isAssEmail = [clinic.assistantEmail, clinic.assistantUsername].some((v: unknown) => typeof v === 'string' && v.trim().toLowerCase() === loginIdentifier)
    let isAssMatch = false
    if (isAssEmail) {
      const storedHash = clinic.assistantPasswordHash || clinic.assistantPassword
      isAssMatch = await verifyPassword(password, storedHash)

      if (isAssMatch && (!clinic.assistantPasswordHash || !String(clinic.assistantPasswordHash).startsWith('pbkdf2:'))) {
        const newHash = await hashPassword(password)
        await writeDocument(`clinics/${clinicId}`, { assistantPasswordHash: newHash, assistantPassword: null }, true)
      }
    }

    // Check secondary assistants array
    let matchedSecondaryAss: any = null
    if (!isDoctorMatch && !isAssMatch && Array.isArray(clinic.assistants)) {
      for (const ass of clinic.assistants) {
        if ([ass.email, ass.username].some((v: unknown) => typeof v === 'string' && v.trim().toLowerCase() === loginIdentifier)) {
          const matched = await verifyPassword(password, ass.passwordHash || ass.password)
          if (matched) {
            matchedSecondaryAss = ass
            break
          }
        }
      }
    }

    if (!isDoctorMatch && !isAssMatch && !matchedSecondaryAss) {
      return NextResponse.json({ error: 'اسم المستخدم أو البريد الإلكتروني أو كلمة المرور غير صحيحة' }, { status: 401 })
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
      email: isDoctorMatch ? clinic.doctorEmail : (matchedSecondaryAss?.email || clinic.assistantEmail || ''),
      username: isDoctorMatch ? (clinic.doctorUsername || undefined) : (matchedSecondaryAss?.username || clinic.assistantUsername || undefined),
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
      details: { identifierType: loginIdentifier.includes('@') ? 'email' : 'username', branchId: assignedBranchId, universal: !slug }
    })

    const canonicalDashboardUrl = `/clinic/${effectiveSlug}/admin`

    const response = NextResponse.json({
      success: true,
      token,
      redirectUrl: canonicalDashboardUrl,
      user: {
        role,
        name: userName,
        email: isDoctorMatch ? clinic.doctorEmail : (matchedSecondaryAss?.email || clinic.assistantEmail || ''),
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
    console.error('[clinic-login] Login request failed:', err instanceof Error ? err.message : 'UNKNOWN')
    return NextResponse.json({ error: 'تعذر تسجيل الدخول مؤقتاً. يرجى إعادة المحاولة.' }, { status: 503 })
  }
}
