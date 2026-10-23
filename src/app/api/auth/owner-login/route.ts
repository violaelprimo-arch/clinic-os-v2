import { NextRequest, NextResponse } from 'next/server'
import {
  OWNER_COOKIE,
  OWNER_EMAIL,
  createOwnerSession,
  verifyOwnerPassword,
} from '@/lib/owner-session'
import { verifyPassword } from '@/lib/auth-crypto'
import { readDocument, firebaseOwnerToken } from '@/lib/server/firebase-rest'
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
    const body = await readJson(request)
    const email =
      typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
    const password = typeof body.password === 'string' ? body.password : ''
    if (!email || !password || password.length > 256)
      throw new ApiError(
        400,
        'INVALID_INPUT',
        'أدخل البريد الإلكتروني وكلمة المرور.',
      )
    const secret =
      process.env.OWNER_SESSION_SECRET || process.env.AUTH_SECRET || ''
    if (secret.length < 32)
      throw new ApiError(
        503,
        'OWNER_SETUP_REQUIRED',
        'إعدادات دخول المالك غير مكتملة. راجع إعدادات الخادم.',
      )
    await enforceSubmissionLimit(request, 'owner-login', 10000)
    if (email !== OWNER_EMAIL)
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      )
    // Only designated platform owner records are eligible. Clinic/assistant credentials never grant ownership.
    const record =
      (await readDocument('owners/' + OWNER_EMAIL)) ||
      (await readDocument('owners/platform')) ||
      (await readDocument('settings/global'))
    const storedEmail = String(record?.email || record?.ownerEmail || '')
      .trim()
      .toLowerCase()
    const stored =
      record?.ownerPasswordHash || record?.passwordHash || record?.ownerPassword
    const matched =
      storedEmail === email &&
      record?.disabled !== true &&
      typeof stored === 'string' &&
      (stored.startsWith('pbkdf2$')
        ? await verifyOwnerPassword(password, stored)
        : await verifyPassword(password, stored))
    if (!matched)
      throw new ApiError(
        401,
        'INVALID_CREDENTIALS',
        'البريد الإلكتروني أو كلمة المرور غير صحيحة.',
      )
    const firebaseToken = await firebaseOwnerToken(email)
    const response = NextResponse.json(
      { success: true, owner: { email, role: 'owner' }, firebaseToken },
      { headers: { 'Cache-Control': 'no-store' } },
    )
    response.cookies.set(
      OWNER_COOKIE,
      await createOwnerSession(email, secret),
      {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 86400,
      },
    )
    return response
  } catch (error) {
    return apiFailure(error)
  }
}
