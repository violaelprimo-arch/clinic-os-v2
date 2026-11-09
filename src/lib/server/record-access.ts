if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: record-access cannot be imported in client-side bundles')
}
import type { NextRequest } from 'next/server'
import { verifySessionToken, verifyShareToken, createShareToken } from '@/lib/auth-crypto'
import { OWNER_COOKIE, verifyOwnerSession } from '@/lib/owner-session'

export interface RecordAccessResult {
  authorized: boolean
  status?: number
  error?: string
  accessorRole?: 'owner' | 'doctor' | 'assistant' | 'patient' | 'guest_token'
}

function normalizePhone(raw?: string): string {
  if (!raw) return ''
  return raw.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(-9)
}

/**
 * Authorize server-side access to patient invoices and prescriptions.
 * Prevents IDOR and unauthorized public access.
 * Permitted accessors:
 * 1. Platform Owner (OWNER_COOKIE verified with PLATFORM_OWNER_UID)
 * 2. Clinic Doctor or Assistant for that specific clinic
 * 3. Patient who owns the record (matched by phone or patientId)
 * 4. Guest with a valid HMAC-SHA256 signed share token (?token=...)
 */
export async function authorizeRecordAccess(
  req: NextRequest,
  options: {
    clinicId: string
    clinicSlug: string
    recordId: string
    recordType: 'invoice' | 'prescription'
    recordPhone?: string
    recordPatientId?: string
  }
): Promise<RecordAccessResult> {
  const { clinicId, clinicSlug, recordId, recordType, recordPhone, recordPatientId } = options

  // 1. Check Platform Owner
  const ownerCookie = req.cookies.get(OWNER_COOKIE)?.value
  if (ownerCookie) {
    const secret = process.env.OWNER_SESSION_SECRET || process.env.AUTH_SECRET || ''
    if (secret.length >= 32) {
      const owner = await verifyOwnerSession(ownerCookie, secret)
      if (owner && process.env.PLATFORM_OWNER_UID && owner.uid === process.env.PLATFORM_OWNER_UID) {
        return { authorized: true, accessorRole: 'owner' }
      }
    }
  }

  // 2. Check Share Token (?token=... or x-share-token)
  const tokenParam = req.nextUrl.searchParams.get('token') || req.headers.get('x-share-token')
  if (tokenParam) {
    const isValidShare = await verifyShareToken(tokenParam, {
      clinicId,
      recordId,
      type: recordType
    })
    if (isValidShare) {
      return { authorized: true, accessorRole: 'guest_token' }
    }
    // If a share token was provided but is invalid or expired, reject explicitly
    return {
      authorized: false,
      status: 401,
      error: 'رابط المشاركة غير صالح أو انتهت صلاحيته'
    }
  }

  // Extract session token from cookie or Authorization header
  const authHeader = req.headers.get('Authorization')
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7).trim() : null
  const clinicSessionCookie = req.cookies.get('clinic_session')?.value
  const patientSessionCookie = req.cookies.get('patient_session')?.value

  // 3. Check Clinic Staff (Doctor / Assistant)
  const candidateClinicToken = clinicSessionCookie || bearerToken
  if (candidateClinicToken) {
    const clinicSession = await verifySessionToken(candidateClinicToken)
    if (clinicSession.valid && clinicSession.payload) {
      const role = clinicSession.payload.role
      if (role === 'doctor' || role === 'assistant') {
        const tokenClinicId = clinicSession.payload.clinicId
        const tokenSlug = clinicSession.payload.slug

        if (tokenClinicId === clinicId || (tokenSlug && tokenSlug === clinicSlug)) {
          return { authorized: true, accessorRole: role }
        } else {
          return {
            authorized: false,
            status: 403,
            error: 'لا تملك صلاحية الوصول لسجلات عيادة أخرى (Cross-Clinic Access Denied)'
          }
        }
      }
    }
  }

  // 4. Check Patient Session
  const candidatePatientToken = patientSessionCookie || bearerToken
  if (candidatePatientToken) {
    const patientSession = await verifySessionToken(candidatePatientToken)
    if (patientSession.valid && patientSession.payload && patientSession.payload.role === 'patient') {
      const sessionPhone = normalizePhone(patientSession.payload.phone as string)
      const targetPhone = normalizePhone(recordPhone)
      const sessionPatientId = patientSession.payload.patientId

      const phoneMatches = sessionPhone && targetPhone && sessionPhone === targetPhone
      const idMatches = sessionPatientId && recordPatientId && sessionPatientId === recordPatientId

      if (phoneMatches || idMatches) {
        return { authorized: true, accessorRole: 'patient' }
      }

      return {
        authorized: false,
        status: 403,
        error: 'هذا السجل الطبي لا يخص حساب المريض المسجل'
      }
    }
  }

  // 5. No valid credentials provided
  return {
    authorized: false,
    status: 401,
    error: 'يرجى تسجيل الدخول أو استخدام رابط مشاركة صالح للوصول إلى هذا السجل'
  }
}

/**
 * Generate a signed share token for WhatsApp/SMS links.
 */
export async function generateRecordShareToken(
  clinicId: string,
  recordId: string,
  type: 'invoice' | 'prescription',
  expiresInHours = 168 // 7 days
): Promise<string> {
  return createShareToken({
    clinicId,
    recordId,
    type,
    expiresInHours
  })
}
