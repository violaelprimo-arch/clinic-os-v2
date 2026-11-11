if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: queue-ws-gateway cannot be imported in client-side bundles')
}

import { verifySessionToken } from '../auth-crypto'
import { isCurrentClinicDoctor } from '../clinic-credential-policy'
import {
  isFirestoreQuotaError,
  queryDocuments,
  queryDocumentsByField,
  readDocument,
} from './firebase-rest'
import {
  getClinicMetaFromRoom,
  getClinicRoomStub,
  getOrHydrateDayFromRoom,
  resolveClinicSlugFromRoom,
  setClinicSlugInRoom,
  updateClinicMetaInRoom,
  upsertAppointmentInRoom,
} from './queue-room-client'
import { syncWorkerEnv } from './worker-env'

const WS_ROUTE_REGEX = /^\/api\/clinic\/([a-zA-Z0-9_-]{1,128})\/queue\/ws$/
const slugToClinicIdCache = new Map<string, string>()

function getTodayCairoStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
}

function parseCookieValue(cookieHeader: string | null, name: string): string {
  if (!cookieHeader) return ''
  const parts = cookieHeader.split(';')
  for (const part of parts) {
    const idx = part.indexOf('=')
    if (idx <= 0) continue
    const key = part.slice(0, idx).trim()
    if (key === name) {
      const val = part.slice(idx + 1).trim()
      try {
        return decodeURIComponent(val)
      } catch {
        return val
      }
    }
  }
  return ''
}

async function resolveClinicForSocket(
  slug: string,
): Promise<{ clinicId: string; clinicDoc: Record<string, any> } | null> {
  let clinicId = slugToClinicIdCache.get(slug) || (await resolveClinicSlugFromRoom(slug)) || ''
  let clinicDoc: Record<string, any> | null = null

  if (clinicId) {
    clinicDoc = await getClinicMetaFromRoom(clinicId)
    if (clinicDoc && (clinicDoc.slug === slug || clinicDoc.id === slug)) {
      slugToClinicIdCache.set(slug, clinicId)
      return { clinicId: String(clinicDoc.id || clinicId), clinicDoc }
    }
    slugToClinicIdCache.delete(slug)
  }

  const [directDoc, bySlug] = await Promise.all([
    readDocument(`clinics/${slug}`).catch((err) => {
      if (isFirestoreQuotaError(err)) throw err
      return null
    }),
    queryDocumentsByField('clinics', 'slug', slug, 1).catch((err) => {
      if (isFirestoreQuotaError(err)) throw err
      return []
    }),
  ])

  let resolved: Record<string, any> | null =
    (bySlug && bySlug[0]) ||
    (directDoc && (directDoc.slug === slug || directDoc.id === slug) ? directDoc : null)

  if (!resolved) {
    const allClinics = await queryDocuments('clinics')
    resolved = allClinics.find((c: any) => c.slug === slug || c.id === slug) || null
  }

  if (!resolved) return null
  clinicId = String(resolved.id || slug)
  if (slugToClinicIdCache.size >= 200) {
    const oldest = slugToClinicIdCache.keys().next().value
    if (oldest) slugToClinicIdCache.delete(oldest)
  }
  slugToClinicIdCache.set(slug, clinicId)
  await setClinicSlugInRoom(slug, clinicId)
  await updateClinicMetaInRoom({ clinicId, clinic: resolved })
  return { clinicId, clinicDoc: resolved }
}

/**
 * Intercept Cloudflare Worker GET `/api/clinic/[slug]/queue/ws` upgrades before
 * OpenNext so `101 Switching Protocols` and WebSocket hibernation work natively.
 */
export async function maybeHandleQueueWebSocketRequest(
  request: Request,
  env: Record<string, unknown>,
): Promise<Response | null> {
  const url = new URL(request.url)
  const match = WS_ROUTE_REGEX.exec(url.pathname)
  if (!match) return null

  syncWorkerEnv(env)

  if (request.headers.get('upgrade')?.toLowerCase() !== 'websocket') {
    return new Response('Upgrade Required', { status: 426 })
  }

  const slug = match[1]
  const roleParam = url.searchParams.get('role') || 'tv'
  if (!['staff', 'tv', 'patient'].includes(roleParam)) {
    return new Response('Invalid queue socket role', { status: 400 })
  }
  const role = roleParam as 'staff' | 'tv' | 'patient'

  const todayStr = getTodayCairoStr()
  const requestedDate = url.searchParams.get('date') || todayStr
  if (!/^\d{4}-\d{2}-\d{2}$/.test(requestedDate)) {
    return new Response('Invalid date parameter', { status: 400 })
  }

  const requestedBranchId = (url.searchParams.get('branchId') || '').trim()
  if (requestedBranchId && !/^[a-zA-Z0-9_-]{1,128}$/.test(requestedBranchId)) {
    return new Response('Invalid branchId parameter', { status: 400 })
  }

  const appointmentId = (url.searchParams.get('appointmentId') || '').trim()
  if (appointmentId && !/^[a-zA-Z0-9_-]{1,128}$/.test(appointmentId)) {
    return new Response('Invalid appointmentId parameter', { status: 400 })
  }
  if (role === 'patient' && !appointmentId) {
    return new Response('Patient socket requires appointmentId', { status: 403 })
  }

  try {
    const clinicInfo = await resolveClinicForSocket(slug)
    if (!clinicInfo) {
      return new Response('Clinic not found', { status: 404 })
    }
    const { clinicId, clinicDoc } = clinicInfo

    let effectiveBranchId = requestedBranchId
    let effectiveDate = requestedDate
    let credentialsVersion: number | undefined
    let accountKey: string | undefined

    if (role === 'staff') {
      const token =
        parseCookieValue(request.headers.get('cookie'), 'clinic_session') ||
        (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '').trim()

      const session = await verifySessionToken(token)
      const user = session.payload
      if (
        !session.valid ||
        !user ||
        !['doctor', 'assistant'].includes(String(user.role)) ||
        String(user.clinicId || '') !== clinicId ||
        String(user.slug || '') !== slug ||
        Number(user.credentialsVersion || 0) !== Number(clinicDoc.credentialsVersion || 0)
      ) {
        return new Response('Unauthorized staff socket', { status: 401 })
      }

      credentialsVersion = Number(user.credentialsVersion || 0)

      if (user.role === 'doctor') {
        if (!isCurrentClinicDoctor(user, clinicDoc, clinicId, slug)) {
          return new Response('Unauthorized doctor socket', { status: 401 })
        }
        accountKey = 'doctor'
      } else {
        const norm = (v: unknown) => (typeof v === 'string' ? v.trim().toLowerCase() : '')
        const candidates = [
          {
            email: clinicDoc.assistantEmail,
            username: clinicDoc.assistantUsername,
            id: 'primary-assistant',
            branchId: clinicDoc.assistantBranchId,
          },
          ...(Array.isArray(clinicDoc.assistants) ? clinicDoc.assistants : []),
        ]
        const account = candidates.find(
          (a: any) =>
            a &&
            a.isActive !== false &&
            ((norm(user.email) && norm(user.email) === norm(a.email)) ||
              (norm(user.username) && norm(user.username) === norm(a.username))),
        ) as Record<string, any> | undefined

        if (!account || String(account.branchId || '') !== String(user.branchId || '')) {
          return new Response('Unauthorized assistant socket', { status: 403 })
        }
        accountKey = String(account.id || account.email || account.username)
        // Strictly lock assistant sockets to their assigned branch regardless of query params.
        effectiveBranchId = String(account.branchId || '')
      }
    } else if (role === 'patient') {
      const warmDay = await getOrHydrateDayFromRoom(clinicId, todayStr)
      let targetAppt = warmDay?.appointments.find((a) => String(a.id) === appointmentId) || null
      if (!targetAppt) {
        const directDoc = await readDocument(`appointments/${appointmentId}`)
        if (directDoc && (directDoc.clinic_id === clinicId || directDoc.clinicId === clinicId)) {
          targetAppt = directDoc
          const apptDate = String(directDoc.date || todayStr)
          await upsertAppointmentInRoom({
            clinicId,
            date: apptDate,
            appointment: directDoc,
            clinic: clinicDoc,
          })
        }
      }
      if (!targetAppt || (targetAppt.clinic_id !== clinicId && targetAppt.clinicId !== clinicId)) {
        return new Response('Appointment does not belong to clinic', { status: 403 })
      }
      effectiveDate = String(targetAppt.date || todayStr)
      effectiveBranchId =
        requestedBranchId || String(targetAppt.branch_id || targetAppt.branchId || '')
    }

    const stub = await getClinicRoomStub(clinicId)
    if (!stub) {
      return new Response('Queue Durable Object binding unavailable', { status: 503 })
    }

    const headers = new Headers()
    for (const hName of [
      'upgrade',
      'sec-websocket-key',
      'sec-websocket-version',
      'sec-websocket-extensions',
      'sec-websocket-protocol',
    ]) {
      const val = request.headers.get(hName)
      if (val) headers.set(hName, val)
    }

    headers.set('x-queue-clinic-id', clinicId)
    headers.set('x-queue-internal-role', role)
    headers.set('x-queue-date', effectiveDate)
    if (effectiveBranchId) headers.set('x-queue-branch-id', effectiveBranchId)
    if (appointmentId) headers.set('x-queue-appointment-id', appointmentId)
    if (credentialsVersion !== undefined) {
      headers.set('x-queue-credentials-version', String(credentialsVersion))
    }
    if (accountKey) headers.set('x-queue-account-key', accountKey)

    const internalReq = new Request('https://queue-room.internal/ws', {
      method: 'GET',
      headers,
    })

    return stub.fetch(internalReq)
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      return new Response('Service temporarily busy (Firestore quota)', { status: 503 })
    }
    console.error('[queue-ws-gateway] WebSocket handshake failed:', error)
    return new Response('WebSocket setup error', { status: 500 })
  }
}
