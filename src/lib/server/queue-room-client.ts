if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: queue-room-client cannot be imported in client-side bundles')
}

import { getQueueRoomNamespace } from './worker-env'
import { isFirestoreQuotaError } from './firebase-rest'
import type { QueueWatermark } from '../queueSync'

export interface StoredDaySnapshotLike {
  clinicId: string
  date: string
  clinic: Record<string, any> | null
  appointments: Array<Record<string, any>>
  queueWatermark: QueueWatermark
  revision: number
  serverTime: string
  source: 'do_sqlite' | 'firestore_hydrated' | 'mutation'
}

const REGISTRY_ROOM_NAME = '__slug_index__'

async function getStubByRoomName(roomName: string): Promise<DurableObjectStub | null> {
  const ns = await getQueueRoomNamespace()
  if (!ns) return null
  if (typeof ns.getByName === 'function') {
    return ns.getByName(roomName)
  }
  const id = ns.idFromName(roomName)
  return ns.get(id)
}

export async function getClinicRoomStub(clinicId: string): Promise<DurableObjectStub | null> {
  if (!clinicId) return null
  return getStubByRoomName(`clinic:${clinicId}`)
}

async function invokeRoomRpc<T>(
  roomName: string,
  action: string,
  params: Record<string, unknown>,
): Promise<T | null> {
  const stub = await getStubByRoomName(roomName)
  if (!stub) return null
  try {
    if (typeof stub[action] === 'function') {
      return (await stub[action](params)) as T
    }
    const res = await stub.fetch('https://queue-room.internal/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, params }),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      if (txt.includes('FIRESTORE_QUOTA_EXHAUSTED')) {
        const err = new Error('FIRESTORE_QUOTA_EXHAUSTED') as Error & { status?: number }
        err.status = 429
        throw err
      }
      return null
    }
    return (await res.json()) as T
  } catch (error) {
    if (isFirestoreQuotaError(error)) {
      throw error
    }
    console.warn(`[queue-room-client] RPC ${action} failed for ${roomName}:`, error)
    return null
  }
}

export async function resolveClinicSlugFromRoom(slug: string): Promise<string | null> {
  const stub = await getStubByRoomName(REGISTRY_ROOM_NAME)
  if (!stub) return null
  try {
    if (typeof stub.resolveClinicSlug === 'function') {
      return await stub.resolveClinicSlug(slug)
    }
    const res = await stub.fetch('https://queue-room.internal/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'resolveClinicSlug', params: { slug } }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { clinicId?: string | null }
    return data.clinicId || null
  } catch {
    return null
  }
}

export async function setClinicSlugInRoom(slug: string, clinicId: string): Promise<void> {
  const stub = await getStubByRoomName(REGISTRY_ROOM_NAME)
  if (!stub) return
  try {
    if (typeof stub.setClinicSlugMapping === 'function') {
      await stub.setClinicSlugMapping(slug, clinicId)
      return
    }
    await stub.fetch('https://queue-room.internal/rpc', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'setClinicSlugMapping', params: { slug, clinicId } }),
    })
  } catch {}
}

export async function getClinicMetaFromRoom(
  clinicId: string,
  forceRefresh = false,
  maxAgeMs?: number,
): Promise<Record<string, any> | null> {
  const result = await invokeRoomRpc<Record<string, any> | { clinic?: Record<string, any> | null } | null>(
    `clinic:${clinicId}`,
    'getClinicMeta',
    {
      clinicId,
      forceRefresh,
      ...(typeof maxAgeMs === 'number' && Number.isFinite(maxAgeMs) ? { maxAgeMs } : {}),
    },
  )
  if (!result) return null
  if ('clinic' in result && Object.keys(result).length === 1) {
    return result.clinic || null
  }
  return result as Record<string, any>
}

export async function getOrHydrateDayFromRoom(
  clinicId: string,
  date: string,
  forceRehydrate = false,
): Promise<StoredDaySnapshotLike | null> {
  return invokeRoomRpc<StoredDaySnapshotLike>(`clinic:${clinicId}`, 'getOrHydrateDay', {
    clinicId,
    date,
    forceRehydrate,
  })
}

export async function getCachedDayFromRoomIfWarm(
  clinicId: string,
  date: string,
): Promise<StoredDaySnapshotLike | null> {
  return invokeRoomRpc<StoredDaySnapshotLike | null>(`clinic:${clinicId}`, 'getCachedDayIfWarm', {
    clinicId,
    date,
  })
}

export async function publishDaySnapshotToRoom(params: {
  clinicId: string
  date: string
  appointments: Array<Record<string, any>>
  clinic?: Record<string, any> | null
  commitIso?: string | null
  notifyChanged?: boolean
}): Promise<StoredDaySnapshotLike | null> {
  return invokeRoomRpc<StoredDaySnapshotLike>(
    `clinic:${params.clinicId}`,
    'publishDaySnapshot',
    params as unknown as Record<string, unknown>,
  )
}

export async function upsertAppointmentInRoom(params: {
  clinicId: string
  date?: string
  appointment: Record<string, any>
  clinic?: Record<string, any> | null
  commitIso?: string | null
  notifyChanged?: boolean
}): Promise<StoredDaySnapshotLike | null> {
  return invokeRoomRpc<StoredDaySnapshotLike>(
    `clinic:${params.clinicId}`,
    'upsertAppointment',
    params as unknown as Record<string, unknown>,
  )
}

export async function updateClinicMetaInRoom(params: {
  clinicId: string
  clinic: Record<string, any>
  notifyChanged?: boolean
}): Promise<{ ok: boolean; closedRevokedCount: number } | null> {
  return invokeRoomRpc<{ ok: boolean; closedRevokedCount: number }>(
    `clinic:${params.clinicId}`,
    'updateClinicMeta',
    params as unknown as Record<string, unknown>,
  )
}
