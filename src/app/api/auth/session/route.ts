import { NextRequest, NextResponse } from 'next/server'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { createClinicFirebaseCustomToken } from '@/lib/server/firebase-clinic-custom-token'
import { assertSameOrigin } from '@/lib/server/owner-access'

export async function GET(req: NextRequest) {
  try {
    const staff = await getCurrentClinicStaff(req)
    if (!staff) return NextResponse.json({ authenticated: false }, { status: 401 })
    return NextResponse.json({ authenticated: true, user: staff.user }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'تعذر التحقق من الجلسة مؤقتًا' }, { status: 503 })
  }
}

/** Establish the Firebase SDK identity on this origin, including clinic subdomains. */
export async function POST(req: NextRequest) {
  try {
    assertSameOrigin(req)
    const staff = await getCurrentClinicStaff(req)
    if (!staff) return NextResponse.json({ authenticated: false }, { status: 401 })
    const firebaseCustomToken = await createClinicFirebaseCustomToken({
      clinicId: staff.clinicId, role: staff.user.role, accountKey: staff.accountKey,
      credentialsVersion: Number(staff.clinic.credentialsVersion || 0),
      branchId: staff.user.branchId,
    })
    return NextResponse.json({ authenticated: true, user: staff.user, firebaseCustomToken }, {
      headers: { 'Cache-Control': 'private, no-store' },
    })
  } catch {
    return NextResponse.json({ error: 'تعذر إنشاء جلسة Firebase. أعد المحاولة.' }, { status: 503 })
  }
}

export async function DELETE(req: NextRequest) {
  assertSameOrigin(req)
  const response = NextResponse.json({ success: true })
  const options = { httpOnly: true, secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const, path: '/', maxAge: 0 }
  if (req.nextUrl.hostname === 'yalla-clinic.com' || req.nextUrl.hostname.endsWith('.yalla-clinic.com')) {
    response.cookies.set('clinic_session', '', { ...options, domain: '.yalla-clinic.com' })
  }
  response.headers.append('Set-Cookie', `clinic_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax${options.secure ? '; Secure' : ''}`)
  return response
}
