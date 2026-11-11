import 'server-only'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'
import { getCurrentClinicStaff } from '@/lib/server/clinic-staff-access'
import { readDocument } from '@/lib/server/firebase-rest'

type PushClaim = { clinicId: string; appointmentId: string; expiresAt: number }
const encoder = new TextEncoder()
const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
const bytesFromBase64url = (value: string) => Uint8Array.from(
  atob(value.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - value.length % 4) % 4)),
  x => x.charCodeAt(0),
)

async function key() {
  const secret = process.env.CLINIC_SESSION_SECRET || process.env.AUTH_SECRET
  if (!secret || secret.length < 32) throw new Error('PUSH_SIGNING_SECRET_NOT_CONFIGURED')
  return crypto.subtle.importKey('raw', encoder.encode('push-registration-v1:' + secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}

/** Only the booking success API can issue a capability for that exact appointment. */
export async function issueBookingPushClaim(clinicId: string, appointmentId: string) {
  const body: PushClaim = { clinicId, appointmentId, expiresAt: Date.now() + 7 * 86400000 }
  const data = base64url(encoder.encode(JSON.stringify(body)))
  const sig = await crypto.subtle.sign('HMAC', await key(), encoder.encode(data))
  return data + '.' + base64url(new Uint8Array(sig))
}

async function verifyBookingPushClaim(token: unknown, clinicId: string, appointmentId: string) {
  if (typeof token !== 'string' || token.length > 1500 || !token.includes('.')) return false
  try {
    const parts = token.split('.')
    if (parts.length !== 2) return false
    const sig = bytesFromBase64url(parts[1])
    if (sig.length !== 32) return false
    const valid = await crypto.subtle.verify('HMAC', await key(), sig, encoder.encode(parts[0]))
    if (!valid) return false
    const parsed = JSON.parse(new TextDecoder().decode(bytesFromBase64url(parts[0]))) as PushClaim
    return parsed.clinicId === clinicId && parsed.appointmentId === appointmentId &&
      Number.isFinite(parsed.expiresAt) && parsed.expiresAt > Date.now()
  } catch { return false }
}

export async function authorizePushTarget(req: NextRequest, options: {
  role: 'patient' | 'staff'
  clinicId: string
  appointmentId?: string
  pushClaim?: unknown
}): Promise<{ clinicId: string; appointmentId?: string; phone?: string; role: 'patient' | 'staff' } | null> {
  const { role, clinicId, appointmentId, pushClaim } = options
  if (!/^[A-Za-z0-9_-]{1,128}$/.test(clinicId)) return null
  if (role === 'staff') {
    const staff = await getCurrentClinicStaff(req)
    if (!staff || staff.clinicId !== clinicId) return null
    return { clinicId, role: 'staff' }
  }
  if (!appointmentId || !/^[A-Za-z0-9_-]{1,128}$/.test(appointmentId)) return null
  const verifiedClaim = await verifyBookingPushClaim(pushClaim, clinicId, appointmentId)
  const session = verifiedClaim
    ? null
    : await verifySessionToken(req.cookies.get('patient_session')?.value || '')
  if (!verifiedClaim && (
    !session?.valid || session.payload?.role !== 'patient' ||
    session.payload?.clinicId !== clinicId || !session.payload?.phone
  )) {
    return null
  }
  const appt = await readDocument(`appointments/${appointmentId}`)
  if (!appt || ![appt.clinic_id, appt.clinicId].includes(clinicId)) return null
  if (!verifiedClaim) {
    const normalize = (p: unknown) => String(p || '').replace(/\D/g, '').replace(/^20/, '0')
    if (normalize(session!.payload!.phone) !== normalize(appt.phone || appt.patientPhone)) return null
  }
  return { clinicId, appointmentId, role: 'patient', phone: String(appt.phone || appt.patientPhone || '') }
}

export function sameOriginMutation(req: NextRequest) {
  const origin = req.headers.get('origin')
  return !origin || origin === new URL(req.url).origin
}
