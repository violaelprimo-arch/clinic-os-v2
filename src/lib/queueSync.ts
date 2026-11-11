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

export interface QueueWebSocketOptions {
  slug: string
  role: 'staff' | 'tv' | 'patient'
  date?: string
  branchId?: string | null
  appointmentId?: string | null
  onSnapshot: (payload: Record<string, any>) => void
  onConnectionChange?: (connected: boolean) => void
  onAuthRevoked?: () => void
  pingIntervalMs?: number
}

export interface QueueWebSocketHandle {
  isConnected: () => boolean
  requestResync: () => void
  close: () => void
}

/**
 * Connect a screen (`AdminDashboard`, `TV`, `Track`) to the clinic's
 * Cloudflare Durable Object WebSocket room with automatic keepalive & backoff.
 */
export function connectClinicQueueWebSocket(
  options: QueueWebSocketOptions,
): QueueWebSocketHandle {
  const noop: QueueWebSocketHandle = {
    isConnected: () => false,
    requestResync: () => {},
    close: () => {},
  }
  if (typeof window === 'undefined' || typeof WebSocket === 'undefined') {
    return noop
  }
  const slug = String(options.slug || '').trim()
  if (!slug) return noop

  let closedByCaller = false
  let ws: WebSocket | null = null
  let connected = false
  let reconnectAttempt = 0
  let reconnectTimer: number | null = null
  let pingTimer: number | null = null
  let pongTimeoutTimer: number | null = null
  const pingMs = Math.max(10000, options.pingIntervalMs ?? 25000)

  const clearTimers = () => {
    if (reconnectTimer !== null) {
      window.clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    if (pingTimer !== null) {
      window.clearInterval(pingTimer)
      pingTimer = null
    }
    if (pongTimeoutTimer !== null) {
      window.clearTimeout(pongTimeoutTimer)
      pongTimeoutTimer = null
    }
  }

  const setConnState = (next: boolean) => {
    if (connected === next) return
    connected = next
    options.onConnectionChange?.(next)
  }

  const buildUrl = () => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const query = new URLSearchParams({ role: options.role })
    if (options.date) query.set('date', options.date)
    if (options.branchId && options.branchId !== 'all') query.set('branchId', options.branchId)
    if (options.appointmentId) query.set('appointmentId', options.appointmentId)
    return `${protocol}//${window.location.host}/api/clinic/${encodeURIComponent(slug)}/queue/ws?${query.toString()}`
  }

  const scheduleReconnect = () => {
    if (closedByCaller || reconnectTimer !== null) return
    const delay = Math.min(30000, 1000 * Math.pow(2, reconnectAttempt))
    reconnectAttempt = Math.min(reconnectAttempt + 1, 5)
    reconnectTimer = window.setTimeout(() => {
      reconnectTimer = null
      if (!closedByCaller) connect()
    }, delay)
  }

  const startKeepalive = () => {
    if (pingTimer !== null) window.clearInterval(pingTimer)
    pingTimer = window.setInterval(() => {
      if (!ws || ws.readyState !== WebSocket.OPEN) return
      if (document.visibilityState !== 'visible') return
      try {
        ws.send(JSON.stringify({ type: 'ping' }))
        if (pongTimeoutTimer !== null) window.clearTimeout(pongTimeoutTimer)
        pongTimeoutTimer = window.setTimeout(() => {
          try {
            ws?.close(4000, 'PING_TIMEOUT')
          } catch {}
        }, 8000)
      } catch {}
    }, pingMs)
  }

  const connect = () => {
    if (closedByCaller) return
    if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) {
      return
    }
    try {
      const socket = new WebSocket(buildUrl())
      ws = socket

      socket.onopen = () => {
        if (closedByCaller) {
          try { socket.close(1000, 'UNMOUNTED') } catch {}
          return
        }
        reconnectAttempt = 0
        setConnState(true)
        startKeepalive()
      }

      socket.onmessage = (event) => {
        if (typeof event.data !== 'string') return
        let payload: Record<string, any> | null = null
        try {
          payload = JSON.parse(event.data)
        } catch {
          return
        }
        if (!payload || typeof payload !== 'object') return

        if (payload.type === 'pong') {
          if (pongTimeoutTimer !== null) {
            window.clearTimeout(pongTimeoutTimer)
            pongTimeoutTimer = null
          }
          return
        }

        if (payload.type === 'snapshot' || payload.type === 'queue_update') {
          if (payload.notificationsChanged) {
            window.dispatchEvent(
              new CustomEvent('yalla_notifications_changed', { detail: { slug } }),
            )
          }
          options.onSnapshot(payload)
        }
      }

      socket.onclose = (event) => {
        if (ws === socket) ws = null
        clearTimers()
        setConnState(false)
        if (closedByCaller) return
        if (event.code === 4001 || event.code === 4003) {
          closedByCaller = true
          options.onAuthRevoked?.()
          return
        }
        scheduleReconnect()
      }

      socket.onerror = () => {
        // Error leads to onclose where backoff reconnect triggers cleanly.
      }
    } catch {
      setConnState(false)
      scheduleReconnect()
    }
  }

  const onVisibilityOrOnline = () => {
    if (closedByCaller) return
    if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return
    if (!ws || ws.readyState === WebSocket.CLOSED) {
      reconnectAttempt = 0
      if (reconnectTimer !== null) {
        window.clearTimeout(reconnectTimer)
        reconnectTimer = null
      }
      connect()
    }
  }

  window.addEventListener('online', onVisibilityOrOnline)
  document.addEventListener('visibilitychange', onVisibilityOrOnline)
  connect()

  return {
    isConnected: () => connected && ws?.readyState === WebSocket.OPEN,
    requestResync: () => {
      if (ws && ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: 'resync' }))
        } catch {}
      } else if (!closedByCaller) {
        connect()
      }
    },
    close: () => {
      closedByCaller = true
      clearTimers()
      setConnState(false)
      window.removeEventListener('online', onVisibilityOrOnline)
      document.removeEventListener('visibilitychange', onVisibilityOrOnline)
      if (ws) {
        try { ws.close(1000, 'CLOSED') } catch {}
        ws = null
      }
    },
  }
}
