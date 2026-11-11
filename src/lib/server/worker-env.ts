if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: worker-env cannot be imported in client-side bundles')
}

const SYNCED_ENV_KEYS = [
  'FIREBASE_SERVICE_ACCOUNT_JSON',
  'FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'FIREBASE_CLIENT_EMAIL',
  'FIREBASE_PRIVATE_KEY',
  'FIRESTORE_EMULATOR_HOST',
  'CLINIC_SESSION_SECRET',
  'AUTH_SECRET',
  'PATIENT_SESSION_SECRET',
  'OWNER_SESSION_SECRET',
  'PUSH_SUBSCRIPTION_TOKEN_SECRET',
  'VAPID_PUBLIC_KEY',
  'VAPID_PRIVATE_KEY',
  'VAPID_SUBJECT',
  'QUEUE_ROOM_TEST_TELEMETRY',
] as const

const WORKER_ENV_SYMBOL = Symbol.for('clinic.os.worker.env.bindings')
const TEST_QUEUE_ROOM_SYMBOL = Symbol.for('clinic.os.worker.test.queue.room')

/**
 * Sync Cloudflare Worker / Durable Object env secrets into `process.env`
 * whenever running outside OpenNext's internal fetch wrapper (e.g. direct
 * WebSocket upgrades or Durable Object hibernation wakeups).
 */
export function syncWorkerEnv(env?: Record<string, unknown> | null): void {
  if (!env || typeof env !== 'object') return
  ;(globalThis as Record<symbol, unknown>)[WORKER_ENV_SYMBOL] = env
  if (typeof process === 'undefined' || !process.env) return
  for (const key of SYNCED_ENV_KEYS) {
    const value = env[key]
    if (typeof value === 'string' && value.length > 0 && !process.env[key]) {
      process.env[key] = value
    }
  }
}

export async function getWorkerEnvBindings(): Promise<Record<string, unknown> | null> {
  const cached = (globalThis as Record<symbol, unknown>)[WORKER_ENV_SYMBOL]
  if (cached && typeof cached === 'object') {
    return cached as Record<string, unknown>
  }
  try {
    const cf = await import('@opennextjs/cloudflare')
    if (typeof cf.getCloudflareContext === 'function') {
      const ctx = await cf.getCloudflareContext({ async: true })
      if (ctx?.env && typeof ctx.env === 'object') {
        syncWorkerEnv(ctx.env as unknown as Record<string, unknown>)
        return ctx.env as unknown as Record<string, unknown>
      }
    }
  } catch {
    // Expected when invoked inside Node test runners or non-OpenNext contexts.
  }
  return null
}

export function setTestQueueRoomNamespace(ns: DurableObjectNamespace | null): void {
  ;(globalThis as Record<symbol, unknown>)[TEST_QUEUE_ROOM_SYMBOL] = ns
}

export async function getQueueRoomNamespace(): Promise<DurableObjectNamespace | null> {
  const testNs = (globalThis as Record<symbol, unknown>)[TEST_QUEUE_ROOM_SYMBOL]
  if (testNs && typeof testNs === 'object') {
    return testNs as DurableObjectNamespace
  }
  // Prefer active Cloudflare context first so per-request env overrides take precedence.
  try {
    const cf = await import('@opennextjs/cloudflare')
    if (typeof cf.getCloudflareContext === 'function') {
      const ctx = await cf.getCloudflareContext({ async: true })
      if (ctx?.env && typeof ctx.env === 'object') {
        const envObj = ctx.env as unknown as Record<string, unknown>
        syncWorkerEnv(envObj)
        const room = envObj.QUEUE_ROOM
        if (room && typeof room === 'object') {
          return room as DurableObjectNamespace
        }
      }
    }
  } catch {
    // Ignore outside Cloudflare / OpenNext request scope.
  }
  const cached = (globalThis as Record<symbol, unknown>)[WORKER_ENV_SYMBOL] as Record<string, unknown> | undefined
  if (cached?.QUEUE_ROOM && typeof cached.QUEUE_ROOM === 'object') {
    return cached.QUEUE_ROOM as DurableObjectNamespace
  }
  return null
}
