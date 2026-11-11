export interface QueueWatermark {
  maxModifiedMs: number
  snapshotAtMs: number
  lastMutationCommitMs?: number
}

const TIMESTAMP_FIELDS = [
  'updatedAt',
  'completedAt',
  'calledAt',
  'startedAt',
  'skippedAt',
  'requeuedAt',
  'noShowAt',
  'paymentConfirmedAt',
  'paymentRejectedAt',
  'createdAt',
] as const

function parseTimestampMs(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value !== 'string' || !value) return 0
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : 0
}

/** Return the newest modification timestamp (epoch ms) observed on an appointment record. */
export function extractAppointmentModifiedMs(appt: Record<string, any> | null | undefined): number {
  if (!appt || typeof appt !== 'object') return 0
  let maxMs = 0
  for (const field of TIMESTAMP_FIELDS) {
    const ms = parseTimestampMs(appt[field])
    if (ms > maxMs) maxMs = ms
  }
  return maxMs
}

/** Build a monotonic watermark summarizing a queue snapshot and its read/commit timestamp. */
export function computeQueueWatermark(
  appointments: Array<Record<string, any>>,
  snapshotStartedIso: string | number,
  lastMutationCommitIso?: string | number | null,
): QueueWatermark {
  let maxModifiedMs = 0
  for (const appt of appointments) {
    const ms = extractAppointmentModifiedMs(appt)
    if (ms > maxModifiedMs) maxModifiedMs = ms
  }
  const snapshotAtMs = parseTimestampMs(snapshotStartedIso) || Date.now()
  const lastMutationCommitMs = lastMutationCommitIso
    ? parseTimestampMs(lastMutationCommitIso)
    : 0
  return {
    maxModifiedMs,
    snapshotAtMs,
    ...(lastMutationCommitMs > 0 ? { lastMutationCommitMs } : {}),
  }
}

/**
 * Determine whether an incoming queue snapshot should replace the currently displayed state.
 * Prevents delayed poll responses or pre-mutation snapshots from overwriting newer state.
 */
export function shouldAcceptQueueSnapshot(
  current: QueueWatermark | null,
  incoming: QueueWatermark | null | undefined,
  options: {
    reqSeq?: number
    lastAcceptedSeq?: number
    isMutation?: boolean
  } = {},
): boolean {
  if (!incoming) return current === null
  if (!current) return true

  if (options.isMutation) {
    const currentCommit = current.lastMutationCommitMs ?? 0
    const incomingCommit = incoming.lastMutationCommitMs ?? incoming.snapshotAtMs
    if (currentCommit > 0 && incomingCommit > 0 && incomingCommit < currentCommit) {
      return false
    }
    return incoming.maxModifiedMs >= current.maxModifiedMs || incomingCommit >= currentCommit
  }

  if (
    options.reqSeq !== undefined &&
    options.lastAcceptedSeq !== undefined &&
    options.reqSeq < options.lastAcceptedSeq
  ) {
    return false
  }

  if (incoming.maxModifiedMs < current.maxModifiedMs) {
    return false
  }

  const currentCommit = current.lastMutationCommitMs ?? 0
  if (
    currentCommit > 0 &&
    incoming.snapshotAtMs < currentCommit &&
    incoming.maxModifiedMs <= current.maxModifiedMs
  ) {
    return false
  }

  return true
}

/** Merge an accepted incoming watermark monotonically into the active client watermark. */
export function mergeQueueWatermark(
  current: QueueWatermark | null,
  incoming: QueueWatermark | null | undefined,
  options: { isMutation?: boolean } = {},
): QueueWatermark | null {
  if (!incoming) return current
  const maxModifiedMs = Math.max(current?.maxModifiedMs ?? 0, incoming.maxModifiedMs)
  const snapshotAtMs = Math.max(current?.snapshotAtMs ?? 0, incoming.snapshotAtMs)
  const mutationMs = Math.max(
    current?.lastMutationCommitMs ?? 0,
    incoming.lastMutationCommitMs ?? 0,
    options.isMutation ? incoming.snapshotAtMs : 0,
  )
  return {
    maxModifiedMs,
    snapshotAtMs,
    ...(mutationMs > 0 ? { lastMutationCommitMs: mutationMs } : {}),
  }
}

function normalizeQueueChannelSlug(slug: string): string {
  return String(slug || '').trim().toLowerCase().replace(/[^a-z0-9_-]/g, '')
}

/**
 * Notify sibling browser tabs (Admin, TV, Track) on the same device immediately after a queue change.
 */
export function publishClinicQueueSignal(
  slug: string,
  watermark?: QueueWatermark | null,
): void {
  if (typeof window === 'undefined') return
  const safeSlug = normalizeQueueChannelSlug(slug)
  if (!safeSlug) return
  const payload = {
    slug: safeSlug,
    sentAt: Date.now(),
    watermark: watermark || null,
  }
  try {
    if ('BroadcastChannel' in window) {
      const channel = new BroadcastChannel(`yalla_clinic_queue_${safeSlug}`)
      channel.postMessage(payload)
      channel.close()
    }
  } catch {}
  try {
    localStorage.setItem(`yalla_queue_ping_${safeSlug}`, JSON.stringify(payload))
  } catch {}
}

/**
 * Subscribe a TV, Track, or staff view to immediate same-device queue signals
 * from sibling tabs (and Service Worker push messages when present).
 */
export function subscribeClinicQueueSignal(
  slug: string,
  onSignal: (watermark?: QueueWatermark | null) => void,
): () => void {
  if (typeof window === 'undefined') return () => {}
  const safeSlug = normalizeQueueChannelSlug(slug)
  if (!safeSlug) return () => {}

  let channel: BroadcastChannel | null = null
  try {
    if ('BroadcastChannel' in window) {
      channel = new BroadcastChannel(`yalla_clinic_queue_${safeSlug}`)
      channel.onmessage = (event) => {
        onSignal(event?.data?.watermark || null)
      }
    }
  } catch {}

  const onStorage = (event: StorageEvent) => {
    if (event.key !== `yalla_queue_ping_${safeSlug}` || !event.newValue) return
    try {
      const parsed = JSON.parse(event.newValue)
      onSignal(parsed?.watermark || null)
    } catch {
      onSignal(null)
    }
  }
  window.addEventListener('storage', onStorage)

  const onServiceWorkerMessage = (event: MessageEvent) => {
    if (event?.data?.type === 'PUSH_NOTIFICATION_RECEIVED') {
      onSignal(null)
    }
  }
  if ('serviceWorker' in navigator && navigator.serviceWorker) {
    navigator.serviceWorker.addEventListener('message', onServiceWorkerMessage)
  }

  return () => {
    try {
      channel?.close()
    } catch {}
    window.removeEventListener('storage', onStorage)
    if ('serviceWorker' in navigator && navigator.serviceWorker) {
      navigator.serviceWorker.removeEventListener('message', onServiceWorkerMessage)
    }
  }
}
