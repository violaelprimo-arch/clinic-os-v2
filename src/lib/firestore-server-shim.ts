/**
 * Server-side replacement for `firebase/firestore` (wired up via `turbopack.resolveAlias`
 * in next.config.ts).
 *
 * Why: the full Firestore SDK's Node build uses gRPC + protobufjs, which generates code
 * with `new Function()`. Cloudflare Workers forbid runtime code generation, which caused
 * "EvalError: Code generation from strings disallowed for this context" (HTTP 500).
 *
 * Firestore Lite talks to Firestore over plain `fetch` (REST), so it runs fine on Workers.
 * The browser bundle still gets the full SDK (realtime listeners etc.).
 */
export * from '@firebase/firestore/lite'

// Realtime listeners are browser-only. They are only ever called inside useEffect,
// which never runs during server rendering, so a no-op stub is safe here.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function onSnapshot(..._args: unknown[]): () => void {
  return () => {}
}
