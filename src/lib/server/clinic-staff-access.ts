import 'server-only'
import type { NextRequest } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'
import { isCurrentClinicDoctor } from '@/lib/clinic-credential-policy'
import { readDocument } from './firebase-rest'
import { getClinicMetaFromRoom, updateClinicMetaInRoom } from './queue-room-client'

/** Validate both the signature and the current account before privileged reads. */
export async function getCurrentClinicStaff(req: NextRequest, expectedSlug?: string) {
  const token = req.cookies.get('clinic_session')?.value ||
    req.headers.get('authorization')?.replace(/^Bearer\s+/i, '') || ''
  const session = await verifySessionToken(token)
  const user = session.payload
  if (!session.valid || !user || !['doctor', 'assistant'].includes(user.role) ||
      typeof user.clinicId !== 'string' || !/^[a-zA-Z0-9_-]{1,128}$/.test(user.clinicId) ||
      typeof user.slug !== 'string' || (expectedSlug && user.slug !== expectedSlug)) return null
  let clinic = await getClinicMetaFromRoom(user.clinicId)
  if (!clinic) {
    clinic = await readDocument(`clinics/${user.clinicId}`)
    if (clinic) {
      await updateClinicMetaInRoom({ clinicId: user.clinicId, clinic }).catch(() => null)
    }
  }
  if (!clinic || clinic.slug !== user.slug ||
      Number(user.credentialsVersion || 0) !== Number(clinic.credentialsVersion || 0)) return null
  if (user.role === 'doctor') {
    if (!isCurrentClinicDoctor(user, clinic, user.clinicId, user.slug)) return null
    return { user, clinic, clinicId: user.clinicId as string, accountKey: 'doctor' }
  }
  const normalized = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : ''
  const candidates = [
    { email: clinic.assistantEmail, username: clinic.assistantUsername, id: 'primary-assistant', branchId: clinic.assistantBranchId },
    ...(Array.isArray(clinic.assistants) ? clinic.assistants : []),
  ]
  const account = candidates.find((a: any) => a.isActive !== false && (
    (normalized(user.email) && normalized(user.email) === normalized(a.email)) ||
    (normalized(user.username) && normalized(user.username) === normalized(a.username))
  )) as Record<string, any> | undefined
  if (!account || String(account.branchId || '') !== String(user.branchId || '')) return null
  return { user, clinic, clinicId: user.clinicId as string,
    accountKey: String(account.id || account.email || account.username) }
}
