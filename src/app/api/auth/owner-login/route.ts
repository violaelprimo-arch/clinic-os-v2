import { NextRequest, NextResponse } from 'next/server'
import { OWNER_COOKIE, createOwnerSession } from '@/lib/owner-session'
import { verifyFirebaseOwnerIdToken } from '@/lib/server/firebase-owner-auth'
import {
  ApiError,
  apiFailure,
  assertSameOrigin,
  enforceSubmissionLimit,
  readJson,
} from '@/lib/server/owner-access'

export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const body = await readJson(request, 12500)
    const secret = process.env.OWNER_SESSION_SECRET || process.env.AUTH_SECRET || ''
    if (secret.length < 32)
      throw new ApiError(503, 'OWNER_SETUP_REQUIRED', 'إعدادات دخول المالك غير مكتملة.')

    await enforceSubmissionLimit(request, 'owner-login', 10000)
    let owner: { uid: string; email: string }
    try {
      owner = await verifyFirebaseOwnerIdToken(body.idToken)
    } catch (error) {
      const code = error instanceof Error ? error.message : ''
      if (code === 'OWNER_FIREBASE_SETUP_REQUIRED')
        throw new ApiError(503, 'OWNER_SETUP_REQUIRED', 'إعداد Firebase أو معرف المالك غير مكتمل.')
      if (code === 'OWNER_AUTH_SERVICE_UNAVAILABLE')
        throw new ApiError(503, 'OWNER_AUTH_UNAVAILABLE', 'خدمة تسجيل الدخول غير متاحة مؤقتًا.')
      if (code === 'OWNER_ACCESS_DENIED')
        throw new ApiError(403, 'OWNER_ACCESS_DENIED', 'هذا الحساب لا يملك صلاحية مالك المنصة.')
      throw new ApiError(401, 'OWNER_TOKEN_INVALID', 'جلسة Firebase غير صالحة. سجّل الدخول مرة أخرى.')
    }

    const response = NextResponse.json(
      { success: true, owner: { ...owner, role: 'owner' } },
      { headers: { 'Cache-Control': 'no-store' } },
    )
    response.cookies.set(
      OWNER_COOKIE,
      await createOwnerSession(owner.email, owner.uid, secret),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 3600,
      },
    )
    return response
  } catch (error) {
    return apiFailure(error)
  }
}
