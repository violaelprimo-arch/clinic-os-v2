import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/owner-session'
import { createDocument } from './firebase-rest'
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message)
  }
}
export function assertSameOrigin(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (!origin) return
  try {
    const originUrl = new URL(origin)
    const nextUrl = request.nextUrl
    if (
      origin === nextUrl.origin ||
      originUrl.hostname === nextUrl.hostname ||
      originUrl.hostname === 'localhost' ||
      originUrl.hostname.endsWith('.localhost') ||
      ['yalla-clinic.com', 'yalaa-clinic.com'].some(
        (domain) =>
          originUrl.hostname === domain ||
          originUrl.hostname.endsWith('.' + domain),
      )
    ) {
      return
    }
  } catch {
    // Fall through to throw
  }
  throw new ApiError(403, 'ORIGIN_REJECTED', 'هذا الطلب غير مسموح.')
}
export async function requireOwner(request: NextRequest) {
  const secret =
    process.env.OWNER_SESSION_SECRET || process.env.AUTH_SECRET || ''
  if (secret.length < 32)
    throw new ApiError(
      503,
      'OWNER_SETUP_REQUIRED',
      'إعدادات دخول المالك غير مكتملة. راجع إعدادات الخادم.',
    )
  const owner = await verifyOwnerSession(
    request.cookies.get(OWNER_COOKIE)?.value || '',
    secret,
  )
  if (!owner)
    throw new ApiError(
      401,
      'OWNER_LOGIN_REQUIRED',
      'سجّل الدخول بحساب مالك المنصة أولًا.',
    )
  // The cookie is tied to one Firebase Authentication UID.
  // Old email-only cookies are rejected after migration.
  if (!process.env.PLATFORM_OWNER_UID || owner.uid !== process.env.PLATFORM_OWNER_UID)
    throw new ApiError(403, 'OWNER_ACCESS_DENIED', 'حساب المالك غير مصرح به.')
  if (request.method !== 'GET') assertSameOrigin(request)
  return owner
}
export async function readJson(request: NextRequest, max = 16384) {
  if (!request.headers.get('content-type')?.includes('application/json'))
    throw new ApiError(415, 'JSON_REQUIRED', 'صيغة الطلب غير صحيحة.')
  if (Number(request.headers.get('content-length') || 0) > max)
    throw new ApiError(413, 'BODY_TOO_LARGE', 'حجم الطلب أكبر من المسموح.')
  const body = await request.text()
  if (new TextEncoder().encode(body).length > max)
    throw new ApiError(413, 'BODY_TOO_LARGE', 'حجم الطلب أكبر من المسموح.')
  try {
    return JSON.parse(body)
  } catch {
    throw new ApiError(400, 'INVALID_JSON', 'بيانات الطلب غير صالحة.')
  }
}
export function apiFailure(error: unknown) {
  if (error instanceof ApiError)
    return NextResponse.json(
      { error: error.message, code: error.code },
      { status: error.status, headers: { 'Cache-Control': 'no-store' } },
    )
  const code = error instanceof Error ? error.message : 'UNEXPECTED_FAILURE'
  // Only a fixed internal code is logged. Request bodies, passwords and tokens are never logged.
  console.error(
    'Landing API failure:',
    /^[A-Z_]+$/.test(code) ? code : 'UNEXPECTED_FAILURE',
  )
  if (code === 'RATE_LIMITED')
    return NextResponse.json(
      { error: 'تم إرسال طلب مؤخرًا. حاول بعد قليل.', code },
      { status: 429 },
    )
  return NextResponse.json(
    {
      error: 'تعذر الاتصال بالخدمة. تحقق من إعدادات Firebase وحاول مرة أخرى.',
      code: 'SERVICE_UNAVAILABLE',
    },
    { status: 503 },
  )
}
export async function enforceSubmissionLimit(
  request: NextRequest,
  action: string,
  windowMs = 60000,
) {
  const ip =
    request.headers.get('cf-connecting-ip') ||
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    'unknown'
  const salt = process.env.OWNER_SESSION_SECRET || process.env.AUTH_SECRET
  if (!salt || salt.length < 32)
    throw new ApiError(
      503,
      'SERVICE_SETUP_REQUIRED',
      'الخدمة غير متاحة مؤقتًا.',
    )
  const bucket = Math.floor(Date.now() / windowMs)
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`${salt}:${action}:${bucket}:${ip}`),
  )
  const key = Array.from(new Uint8Array(digest), (b) =>
    b.toString(16).padStart(2, '0'),
  ).join('')
  await createDocument(
    'landing_rate_limits',
    {
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + windowMs * 2),
    },
    key,
  )
}
