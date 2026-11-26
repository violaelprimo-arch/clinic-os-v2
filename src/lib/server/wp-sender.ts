import 'server-only'

export type WpSenderMode = 'off' | 'mock' | 'live'

export interface WpSenderClinicEntry {
  clinicId: string
  mode: WpSenderMode
  senderNumber: string
  sessionId: string
  apiKey: string
}

export type WpSenderErrorClass =
  | 'not_configured'
  | 'disabled'
  | 'live_disabled'
  | 'disconnected'
  | 'transient'
  | 'uncertain'
  | 'permanent'

export interface WpSenderResult {
  ok: boolean
  mode: WpSenderMode | 'unconfigured'
  mocked?: boolean
  /** 'sent' means provider API accepted the message; never equals confirmed 'delivered' */
  deliveryState?: 'sent'
  messageId?: string
  senderNumber?: string
  sessionId?: string
  errorClass?: WpSenderErrorClass
  error?: string
  httpStatus?: number
}

export interface WpSenderSessionHealth {
  configured: boolean
  mode: WpSenderMode | 'unconfigured'
  connected: boolean
  sessionId: string
  senderNumber: string
  state: 'connected' | 'disconnected' | 'mock' | 'unconfigured' | 'off' | 'unknown'
  reason?: string
}

const SEND_TIMEOUT_MS = 12_000
const STATUS_TIMEOUT_MS = 4_000

const DISCONNECTED_HINTS = [
  'disconnect',
  'not connected',
  'session_not_found',
  'session not found',
  'session expired',
  'logged out',
  'logout',
  'scan qr',
  'qr',
  'offline',
  'inactive session',
  'client not ready',
]

const TRANSIENT_HINTS = [
  'timeout',
  'temporarily',
  'rate limit',
  'too many requests',
  'bad gateway',
  'service unavailable',
  'gateway timeout',
  'econnreset',
  'fetch failed',
  'network',
]

function normalizeClinicKey(clinicId: string): string {
  return String(clinicId || '').trim()
}

export function getAllWpSenderClinics(): Record<string, any> {
  const raw = process.env.WPSENDER_CLINICS_JSON || '{}'
  try {
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

/**
 * Strictly resolve credentials for ONE specific clinic.
 * Never falls back to another clinic's session, sender number, or API key.
 */
export function getWpSenderConfig(clinicId: string): WpSenderClinicEntry | null {
  const id = normalizeClinicKey(clinicId)
  if (!id) return null
  const all = getAllWpSenderClinics()
  const entry = Object.prototype.hasOwnProperty.call(all, id) ? all[id] : undefined
  if (!entry || typeof entry !== 'object') {
    return null
  }
  // If JSON entry explicitly specifies clinicId, verify strict match to forbid cross-clinic aliasing.
  if (entry.clinicId && String(entry.clinicId).trim() !== id) {
    return null
  }
  let mode: WpSenderMode =
    entry.mode === 'live' || entry.mode === 'mock' ? entry.mode : 'off'
  if (mode === 'live' && process.env.WPSENDER_LIVE_ENABLED !== 'true') {
    mode = 'off'
  }
  return {
    clinicId: id,
    mode,
    senderNumber: String(entry.senderNumber || '').trim(),
    sessionId: String(entry.sessionId || '').trim(),
    apiKey: String(entry.apiKey || '').trim(),
  }
}

export function getPublicWpSenderSummary(clinicId: string) {
  const cfg = getWpSenderConfig(clinicId)
  return {
    configured: Boolean(cfg && cfg.mode !== 'off' && (cfg.senderNumber || cfg.sessionId)),
    mode: cfg ? cfg.mode : 'off',
    hasSession: Boolean(cfg?.sessionId),
    senderNumber: cfg?.senderNumber ? cfg.senderNumber : '',
    livePlatformEnabled: process.env.WPSENDER_LIVE_ENABLED === 'true',
  }
}

export function normalizeWpPhone(phone: string): string {
  const digits = String(phone || '').replace(/\D/g, '')
  if (!digits) return ''
  if (digits.startsWith('00')) return digits.slice(2)
  if (digits.startsWith('01') && digits.length === 11) return `20${digits.slice(1)}`
  if (digits.startsWith('0') && digits.length >= 10) return `20${digits.slice(1)}`
  return digits
}

function classifyProviderError(status: number, bodyText: string): WpSenderErrorClass {
  const lower = String(bodyText || '').toLowerCase()
  if (DISCONNECTED_HINTS.some((h) => lower.includes(h)) || status === 409 || status === 424) {
    return 'disconnected'
  }
  if (status === 429 || status >= 500 || TRANSIENT_HINTS.some((h) => lower.includes(h))) {
    return 'transient'
  }
  if (status === 401 || status === 403) {
    return lower.includes('api key') || lower.includes('token') ? 'permanent' : 'disconnected'
  }
  return 'permanent'
}

/**
 * Lightweight pre-send health check for live WP Sender sessions.
 * Avoids sending into an explicitly disconnected session and fails gracefully if upstream
 * status endpoint is not supported.
 */
export async function checkWpSenderSessionHealth(
  clinicId: string,
  options?: { fetchImpl?: typeof fetch; persistedStatus?: string },
): Promise<WpSenderSessionHealth> {
  const cfg = getWpSenderConfig(clinicId)
  if (!cfg || !cfg.clinicId || (cfg.mode === 'off' && !cfg.senderNumber && !cfg.sessionId && !cfg.apiKey)) {
    return {
      configured: false,
      mode: 'unconfigured',
      connected: false,
      sessionId: '',
      senderNumber: '',
      state: 'unconfigured',
      reason: 'CLINIC_WPSENDER_NOT_CONFIGURED',
    }
  }
  if (cfg.mode === 'off') {
    return {
      configured: true,
      mode: 'off',
      connected: false,
      sessionId: cfg.sessionId,
      senderNumber: cfg.senderNumber,
      state: 'off',
      reason: 'CLINIC_WPSENDER_MODE_OFF',
    }
  }
  if (cfg.mode === 'mock') {
    if (options?.persistedStatus === 'disconnected') {
      return {
        configured: true,
        mode: 'mock',
        connected: false,
        sessionId: cfg.sessionId || `mock-${cfg.clinicId}`,
        senderNumber: cfg.senderNumber || 'mock-sender',
        state: 'disconnected',
        reason: 'SESSION_DISCONNECTED',
      }
    }
    return {
      configured: true,
      mode: 'mock',
      connected: true,
      sessionId: cfg.sessionId || `mock-${cfg.clinicId}`,
      senderNumber: cfg.senderNumber || 'mock-sender',
      state: 'mock',
    }
  }
  if (process.env.WPSENDER_LIVE_ENABLED !== 'true') {
    return {
      configured: true,
      mode: 'live',
      connected: false,
      sessionId: cfg.sessionId,
      senderNumber: cfg.senderNumber,
      state: 'off',
      reason: 'WPSENDER_LIVE_DISABLED',
    }
  }
  if (!cfg.apiKey || !cfg.senderNumber) {
    return {
      configured: false,
      mode: 'live',
      connected: false,
      sessionId: cfg.sessionId,
      senderNumber: cfg.senderNumber,
      state: 'unconfigured',
      reason: 'MISSING_CLINIC_CREDENTIALS',
    }
  }
  if (options?.persistedStatus === 'disconnected') {
    // Verify remotely before staying blocked in case QR was scanned outside dashboard.
    if (!cfg.sessionId) {
      return {
        configured: true,
        mode: 'live',
        connected: false,
        sessionId: '',
        senderNumber: cfg.senderNumber,
        state: 'disconnected',
        reason: 'SESSION_DISCONNECTED',
      }
    }
  }
  if (!cfg.sessionId) {
    return {
      configured: true,
      mode: 'live',
      connected: true,
      sessionId: '',
      senderNumber: cfg.senderNumber,
      state: 'unknown',
    }
  }

  const doFetch = options?.fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)
  try {
    const res = await doFetch(
      `https://backendapi.wpsenderx.com/api/whatsapp-session/${encodeURIComponent(cfg.sessionId)}/status`,
      {
        method: 'GET',
        headers: { 'X-API-Key': cfg.apiKey, Accept: 'application/json' },
        signal: controller.signal,
      },
    )
    if (!res.ok) {
      if (res.status === 404 || res.status === 405 || res.status === 501) {
        return {
          configured: true,
          mode: 'live',
          connected: options?.persistedStatus !== 'disconnected',
          sessionId: cfg.sessionId,
          senderNumber: cfg.senderNumber,
          state: options?.persistedStatus === 'disconnected' ? 'disconnected' : 'unknown',
        }
      }
      const txt = await res.text().catch(() => '')
      const cls = classifyProviderError(res.status, txt)
      if (cls === 'disconnected') {
        return {
          configured: true,
          mode: 'live',
          connected: false,
          sessionId: cfg.sessionId,
          senderNumber: cfg.senderNumber,
          state: 'disconnected',
          reason: txt || `HTTP_${res.status}`,
        }
      }
      return {
        configured: true,
        mode: 'live',
        connected: true,
        sessionId: cfg.sessionId,
        senderNumber: cfg.senderNumber,
        state: 'unknown',
      }
    }

    const data = await res.json().catch(() => ({} as any))
    const rawState = String(data?.status || data?.state || data?.data?.status || '').toLowerCase()
    const explicitFalse =
      data?.connected === false ||
      data?.isConnected === false ||
      data?.data?.connected === false ||
      ['disconnected', 'closed', 'qr', 'qr_ready', 'logged_out', 'offline'].includes(rawState)

    if (explicitFalse) {
      return {
        configured: true,
        mode: 'live',
        connected: false,
        sessionId: cfg.sessionId,
        senderNumber: cfg.senderNumber,
        state: 'disconnected',
        reason: rawState || 'SESSION_DISCONNECTED',
      }
    }
    const explicitTrue =
      data?.connected === true ||
      data?.isConnected === true ||
      data?.data?.connected === true ||
      ['connected', 'ready', 'open', 'authenticated', 'working'].includes(rawState)

    return {
      configured: true,
      mode: 'live',
      connected: true,
      sessionId: cfg.sessionId,
      senderNumber: cfg.senderNumber,
      state: explicitTrue ? 'connected' : 'unknown',
    }
  } catch {
    return {
      configured: true,
      mode: 'live',
      connected: options?.persistedStatus !== 'disconnected',
      sessionId: cfg.sessionId,
      senderNumber: cfg.senderNumber,
      state: options?.persistedStatus === 'disconnected' ? 'disconnected' : 'unknown',
    }
  } finally {
    clearTimeout(timer)
  }
}

export interface WpSenderSessionResult {
  success: boolean
  sessionId?: string
  senderNumber?: string
  qrCode?: string
  connected?: boolean
  error?: string
}

/**
 * Create or initialize a dedicated WP Sender session for a clinic.
 * Multi-tenant safe: strictly uses the target clinic's credentials and session ID.
 */
export async function createWpSenderSession(
  clinicId: string,
  senderNumber?: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<WpSenderSessionResult> {
  const cfg = getWpSenderConfig(clinicId)
  const phone = senderNumber ? normalizeWpPhone(senderNumber) : cfg?.senderNumber || ''
  const targetSessionId = cfg?.sessionId || `session_${clinicId}`

  if (!cfg || cfg.mode === 'off') {
    return {
      success: true,
      sessionId: targetSessionId,
      senderNumber: phone,
      qrCode: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" fill="%23111827" font-size="14" font-family="sans-serif">QR Mock: ${targetSessionId}</text></svg>`,
      connected: false,
    }
  }

  if (cfg.mode === 'mock' || process.env.WPSENDER_LIVE_ENABLED !== 'true') {
    return {
      success: true,
      sessionId: targetSessionId,
      senderNumber: phone || cfg.senderNumber || 'mock-sender',
      qrCode: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" fill="%23111827" font-size="14" font-family="sans-serif">QR Mock: ${targetSessionId}</text></svg>`,
      connected: false,
    }
  }

  if (!cfg.apiKey) {
    return { success: false, error: 'MISSING_CLINIC_WPSENDER_API_KEY' }
  }

  const doFetch = options?.fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS * 2)

  try {
    const res = await doFetch('https://backendapi.wpsenderx.com/api/whatsapp-session', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cfg.apiKey,
        Accept: 'application/json',
      },
      body: JSON.stringify({
        session_id: targetSessionId,
        sender_number: phone || cfg.senderNumber,
      }),
      signal: controller.signal,
    })

    const raw = await res.text().catch(() => '')
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = null
    }

    if (!res.ok) {
      return {
        success: false,
        sessionId: targetSessionId,
        error: data?.message || data?.error || `HTTP_${res.status}: ${raw.slice(0, 100)}`,
      }
    }

    const qr = data?.qr || data?.qrcode || data?.qrCode || data?.data?.qr || data?.data?.qrcode
    return {
      success: true,
      sessionId: targetSessionId,
      senderNumber: phone || cfg.senderNumber,
      qrCode: qr || undefined,
      connected: data?.connected === true || data?.status === 'connected',
    }
  } catch (err: any) {
    return {
      success: false,
      sessionId: targetSessionId,
      error: err?.message || 'FAILED_TO_CREATE_WPSENDER_SESSION',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Fetch the active QR code for a clinic's WP Sender session.
 */
export async function getWpSenderQrCode(
  clinicId: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<WpSenderSessionResult> {
  const cfg = getWpSenderConfig(clinicId)
  const targetSessionId = cfg?.sessionId || `session_${clinicId}`

  if (!cfg || cfg.mode === 'off' || cfg.mode === 'mock' || process.env.WPSENDER_LIVE_ENABLED !== 'true') {
    return {
      success: true,
      sessionId: targetSessionId,
      senderNumber: cfg?.senderNumber || '',
      qrCode: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="200" height="200"><rect width="100%" height="100%" fill="%23f3f4f6"/><text x="50%" y="50%" text-anchor="middle" fill="%23111827" font-size="14" font-family="sans-serif">QR Mock: ${targetSessionId}</text></svg>`,
      connected: false,
    }
  }

  if (!cfg.apiKey) {
    return { success: false, error: 'MISSING_CLINIC_WPSENDER_API_KEY' }
  }

  const doFetch = options?.fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)

  try {
    const res = await doFetch(
      `https://backendapi.wpsenderx.com/api/whatsapp-session/${encodeURIComponent(targetSessionId)}/qr`,
      {
        method: 'GET',
        headers: {
          'X-API-Key': cfg.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    )

    const raw = await res.text().catch(() => '')
    let data: any = null
    try {
      data = raw ? JSON.parse(raw) : {}
    } catch {
      data = null
    }

    if (!res.ok) {
      return {
        success: false,
        sessionId: targetSessionId,
        error: data?.message || data?.error || `HTTP_${res.status}`,
      }
    }

    const qr = data?.qr || data?.qrcode || data?.qrCode || data?.data?.qr || data?.data?.qrcode
    return {
      success: true,
      sessionId: targetSessionId,
      senderNumber: cfg.senderNumber,
      qrCode: qr || undefined,
      connected: data?.connected === true,
    }
  } catch (err: any) {
    return {
      success: false,
      sessionId: targetSessionId,
      error: err?.message || 'FAILED_TO_FETCH_QR',
    }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Disconnect and unlink a clinic's WP Sender session.
 */
export async function unlinkWpSenderSession(
  clinicId: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<{ success: boolean; error?: string }> {
  const cfg = getWpSenderConfig(clinicId)
  if (!cfg || cfg.mode === 'off' || cfg.mode === 'mock' || process.env.WPSENDER_LIVE_ENABLED !== 'true') {
    return { success: true }
  }

  if (!cfg.sessionId || !cfg.apiKey) {
    return { success: true }
  }

  const doFetch = options?.fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), STATUS_TIMEOUT_MS)

  try {
    const res = await doFetch(
      `https://backendapi.wpsenderx.com/api/whatsapp-session/${encodeURIComponent(cfg.sessionId)}/disconnect`,
      {
        method: 'POST',
        headers: {
          'X-API-Key': cfg.apiKey,
          Accept: 'application/json',
        },
        signal: controller.signal,
      },
    )
    if (!res.ok && res.status !== 404) {
      const raw = await res.text().catch(() => '')
      return { success: false, error: raw || `HTTP_${res.status}` }
    }
    return { success: true }
  } catch (err: any) {
    return { success: false, error: err?.message || 'FAILED_TO_DISCONNECT' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Re-link or restart session pairing for a clinic.
 */
export async function relinkWpSenderSession(
  clinicId: string,
  options?: { fetchImpl?: typeof fetch },
): Promise<WpSenderSessionResult> {
  await unlinkWpSenderSession(clinicId, options).catch(() => null)
  return createWpSenderSession(clinicId, undefined, options)
}

export type WpSenderConfig = WpSenderClinicEntry

export interface SendWpSenderParams {
  clinicId: string
  phone: string
  message: string
  idempotencyKey?: string
  fetchImpl?: typeof fetch
  persistedSessionStatus?: string
}

/**
 * Send a WhatsApp message strictly through the target clinic's WP Sender session.
 * Supports both the modern structured result call and legacy (entry, phone, message) callers.
 */
export async function sendWpSenderMessage(params: SendWpSenderParams): Promise<WpSenderResult>
export async function sendWpSenderMessage(
  clinicOrEntry: string | WpSenderClinicEntry,
  phone: string,
  message: string,
): Promise<{ id?: string; status: string; mocked?: boolean }>
export async function sendWpSenderMessage(
  paramsOrEntry: SendWpSenderParams | string | WpSenderClinicEntry,
  legacyPhone?: string,
  legacyMessage?: string,
): Promise<any> {
  if (typeof paramsOrEntry === 'string' || (paramsOrEntry && !('clinicId' in paramsOrEntry && 'phone' in paramsOrEntry))) {
    const clinicId =
      typeof paramsOrEntry === 'string'
        ? paramsOrEntry
        : String((paramsOrEntry as WpSenderClinicEntry).clinicId || '')
    const res = await dispatchWpSenderMessage({
      clinicId,
      phone: legacyPhone || '',
      message: legacyMessage || '',
    })
    if (!res.ok) {
      throw new Error(res.error || 'WPSENDER_SEND_FAILED')
    }
    const ret: { id?: string; status: string; mocked?: boolean } = {
      id: res.messageId,
      status: res.mocked ? 'mock_sent' : 'accepted',
    }
    if (res.mocked) {
      ret.mocked = true
    }
    return ret
  }
  return dispatchWpSenderMessage(paramsOrEntry as SendWpSenderParams)
}

async function dispatchWpSenderMessage(params: SendWpSenderParams): Promise<WpSenderResult> {
  const cfg = getWpSenderConfig(params.clinicId)
  if (!cfg || !cfg.clinicId) {
    return { ok: false, mode: 'unconfigured', errorClass: 'not_configured', error: 'CLINIC_ID_REQUIRED' }
  }
  if (cfg.mode === 'off') {
    return {
      ok: false,
      mode: 'off',
      errorClass: 'disabled',
      error: 'WPSENDER_DISABLED: clinic mode is off or platform live messaging is disabled',
    }
  }

  const normalizedPhone = normalizeWpPhone(params.phone)
  if (!normalizedPhone || normalizedPhone.length < 10) {
    return {
      ok: false,
      mode: cfg.mode,
      errorClass: 'permanent',
      error: 'INVALID_RECIPIENT_PHONE',
    }
  }

  const cleanMessage = String(params.message || '').trim()
  if (!cleanMessage) {
    return {
      ok: false,
      mode: cfg.mode,
      errorClass: 'permanent',
      error: 'EMPTY_MESSAGE_TEXT',
    }
  }

  if (cfg.mode === 'mock') {
    if (params.persistedSessionStatus === 'disconnected') {
      return {
        ok: false,
        mode: 'mock',
        senderNumber: cfg.senderNumber,
        sessionId: cfg.sessionId,
        errorClass: 'disconnected',
        error: 'SESSION_DISCONNECTED',
      }
    }
    return {
      ok: true,
      mode: 'mock',
      mocked: true,
      deliveryState: 'sent',
      senderNumber: cfg.senderNumber || 'mock-sender',
      sessionId: cfg.sessionId || `mock-${cfg.clinicId}`,
      messageId: `mock_${cfg.clinicId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    }
  }

  if (process.env.WPSENDER_LIVE_ENABLED !== 'true') {
    return {
      ok: false,
      mode: 'live',
      errorClass: 'live_disabled',
      error: 'WPSENDER_LIVE_DISABLED',
    }
  }

  if (!cfg.apiKey || !cfg.senderNumber) {
    return {
      ok: false,
      mode: 'live',
      errorClass: 'not_configured',
      error: 'MISSING_CLINIC_WPSENDER_CREDENTIALS',
    }
  }

  // Pre-send connectivity guard if session was flagged disconnected or status API confirms offline.
  if (params.persistedSessionStatus === 'disconnected') {
    const health = await checkWpSenderSessionHealth(cfg.clinicId, {
      fetchImpl: params.fetchImpl,
      persistedStatus: params.persistedSessionStatus,
    })
    if (!health.connected) {
      return {
        ok: false,
        mode: 'live',
        senderNumber: cfg.senderNumber,
        sessionId: cfg.sessionId,
        errorClass: 'disconnected',
        error: health.reason || 'SESSION_DISCONNECTED',
      }
    }
  }

  const doFetch = params.fetchImpl || fetch
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), SEND_TIMEOUT_MS)

  let response: Response
  try {
    response = await doFetch('https://backendapi.wpsenderx.com/api/messages/send', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': cfg.apiKey,
        ...(params.idempotencyKey ? { 'X-Idempotency-Key': params.idempotencyKey } : {}),
      },
      redirect: 'error',
      body: JSON.stringify({
        phone: normalizedPhone,
        sender_number: cfg.senderNumber,
        message: cleanMessage,
        ...(cfg.sessionId ? { session_id: cfg.sessionId } : {}),
      }),
      signal: controller.signal,
    })
  } catch (err: any) {
    clearTimeout(timer)
    const msg = err instanceof Error ? err.message : String(err || 'NETWORK_ERROR')
    // Request may already have left the worker and hit provider; mark as UNCERTAIN so we do not blindly duplicate!
    return {
      ok: false,
      mode: 'live',
      senderNumber: cfg.senderNumber,
      sessionId: cfg.sessionId,
      errorClass: 'uncertain',
      error: err?.name === 'AbortError' ? 'PROVIDER_RESPONSE_TIMEOUT_UNCERTAIN' : `UNCERTAIN_TRANSPORT_${msg}`,
    }
  } finally {
    clearTimeout(timer)
  }

  const rawText = await response.text().catch(() => '')
  let data: any = null
  try {
    data = rawText ? JSON.parse(rawText) : {}
  } catch {
    data = null
  }

  if (response.ok) {
    if (data && data.status === 'success') {
      const msgId = data?.data?.message_id || data?.message_id || data?.id
      if (!msgId) {
        return {
          ok: false,
          mode: 'live',
          senderNumber: cfg.senderNumber,
          sessionId: cfg.sessionId,
          httpStatus: response.status,
          errorClass: 'uncertain',
          error: 'PROVIDER_ACCEPTED_WITHOUT_MESSAGE_ID',
        }
      }
      return {
        ok: true,
        mode: 'live',
        deliveryState: 'sent',
        senderNumber: cfg.senderNumber,
        sessionId: cfg.sessionId,
        httpStatus: response.status,
        messageId: String(msgId),
      }
    }
    // HTTP 2xx with unreadable or unexpected body -> treat as uncertain to avoid duplicate send!
    if (!data) {
      return {
        ok: false,
        mode: 'live',
        senderNumber: cfg.senderNumber,
        sessionId: cfg.sessionId,
        httpStatus: response.status,
        errorClass: 'uncertain',
        error: 'PROVIDER_NON_JSON_2XX_UNCERTAIN',
      }
    }
  }

  const errorText = String(data?.message || data?.error || rawText || `HTTP_${response.status}`)
  const errorClass = classifyProviderError(response.status, errorText)
  return {
    ok: false,
    mode: 'live',
    senderNumber: cfg.senderNumber,
    sessionId: cfg.sessionId,
    httpStatus: response.status,
    errorClass,
    error: errorText.slice(0, 300),
  }
}
