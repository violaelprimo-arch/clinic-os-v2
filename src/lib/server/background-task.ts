import 'server-only'

const CLOUDFLARE_CONTEXT_SYMBOL = Symbol.for('__cloudflare-context__')

export type WaitUntilFn = (promise: Promise<unknown>) => void

function getCloudflareWaitUntil(): WaitUntilFn | null {
  try {
    const ctx = (globalThis as Record<PropertyKey, any>)[CLOUDFLARE_CONTEXT_SYMBOL]?.ctx
    if (ctx && typeof ctx.waitUntil === 'function') {
      return (promise: Promise<unknown>) => ctx.waitUntil(promise)
    }
  } catch {}
  return null
}

/**
 * Run an asynchronous post-commit task (such as Web Push or notification creation)
 * without delaying the HTTP mutation response, keeping Cloudflare Worker isolates alive
 * via ExecutionContext.waitUntil when available.
 */
export function scheduleBackgroundTask(
  taskFactory: () => Promise<unknown>,
  label: string,
  customWaitUntil?: WaitUntilFn | null,
): void {
  const safePromise = Promise.resolve()
    .then(() => taskFactory())
    .catch((error) => {
      console.warn(
        `[bg-task:${label}] Non-blocking task error:`,
        error instanceof Error ? error.message : 'UNKNOWN',
      )
    })

  const waitUntil = customWaitUntil ?? getCloudflareWaitUntil()
  if (waitUntil) {
    try {
      waitUntil(safePromise)
    } catch (error) {
      console.warn(
        `[bg-task:${label}] Failed to attach waitUntil:`,
        error instanceof Error ? error.message : 'UNKNOWN',
      )
    }
  }
}
