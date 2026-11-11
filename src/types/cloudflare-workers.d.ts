interface WebSocket {
  accept(): void
  serializeAttachment(attachment: unknown): void
  deserializeAttachment(): unknown
}

  class WebSocketPair {
    0: WebSocket
    1: WebSocket
  }

  interface SqlStorageCursor<T = Record<string, unknown>> {
    toArray(): T[]
    one(): T
    raw(): unknown[][]
    readonly columnNames: string[]
    readonly rowsRead: number
    readonly rowsWritten: number
  }

  interface SqlStorage {
    exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]): SqlStorageCursor<T>
  }

  interface DurableObjectStorage {
    readonly sql: SqlStorage
    get<T = unknown>(key: string): Promise<T | undefined>
    put<T = unknown>(key: string, value: T): Promise<void>
    delete(key: string): Promise<boolean>
    blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
  }

  interface DurableObjectId {
    toString(): string
    readonly name?: string
  }

  interface DurableObjectState {
    readonly id: DurableObjectId
    readonly storage: DurableObjectStorage
    acceptWebSocket(ws: WebSocket, tags?: string[]): void
    getWebSockets(tag?: string): WebSocket[]
    setWebSocketAutoResponse(maybeReqResp?: unknown): void
    waitUntil(promise: Promise<unknown>): void
    blockConcurrencyWhile<T>(callback: () => Promise<T>): Promise<T>
  }

  interface DurableObjectStub {
    fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>
    [method: string]: any
  }

  interface DurableObjectNamespace {
    idFromName(name: string): DurableObjectId
    get(id: DurableObjectId): DurableObjectStub
    getByName?(name: string): DurableObjectStub
  }

  interface ResponseInit {
    webSocket?: WebSocket
  }

  interface CloudflareEnv {
    QUEUE_ROOM?: DurableObjectNamespace
    FIREBASE_SERVICE_ACCOUNT_JSON?: string
    FIREBASE_PROJECT_ID?: string
    NEXT_PUBLIC_FIREBASE_PROJECT_ID?: string
    FIREBASE_CLIENT_EMAIL?: string
    FIREBASE_PRIVATE_KEY?: string
    FIRESTORE_EMULATOR_HOST?: string
    CLINIC_SESSION_SECRET?: string
    AUTH_SECRET?: string
    PATIENT_SESSION_SECRET?: string
    OWNER_SESSION_SECRET?: string
    PUSH_SUBSCRIPTION_TOKEN_SECRET?: string
    VAPID_PUBLIC_KEY?: string
    VAPID_PRIVATE_KEY?: string
    VAPID_SUBJECT?: string
    QUEUE_ROOM_TEST_TELEMETRY?: string
}

declare module 'cloudflare:workers' {
  export class DurableObject<Env = CloudflareEnv> {
    protected readonly ctx: DurableObjectState
    protected readonly env: Env
    constructor(ctx: DurableObjectState, env: Env)
    fetch?(request: Request): Response | Promise<Response>
    webSocketMessage?(ws: WebSocket, message: string | ArrayBuffer): void | Promise<void>
    webSocketClose?(ws: WebSocket, code: number, reason: string, wasClean: boolean): void | Promise<void>
    webSocketError?(ws: WebSocket, error: unknown): void | Promise<void>
    alarm?(): void | Promise<void>
  }
}
