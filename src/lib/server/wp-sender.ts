import 'server-only'

const SEND_URL = 'https://backendapi.wpsenderx.com/api/messages/send'

export type WpSenderConfig =
  | { mode: 'mock'; senderNumber: string }
  | { mode: 'off'; senderNumber: string }
  | { mode: 'live'; senderNumber: string; apiKey: string }

export function getWpSenderConfig(clinicId: string): WpSenderConfig | null {
  try {
    const clinics = JSON.parse(process.env.WPSENDER_CLINICS_JSON || '{}')
    if (!clinics || !Object.hasOwn(clinics, clinicId)) return null

    const entry = clinics[clinicId]
    const senderNumber = String(entry?.senderNumber ?? '').replace(/^\+/, '')
    if (entry?.mode === 'mock' && /^\d{8,15}$/.test(senderNumber)) return { mode: 'mock', senderNumber }
    if (entry?.mode === 'live' && process.env.WPSENDER_LIVE_ENABLED === 'true'
      && /^\d{8,15}$/.test(senderNumber) && typeof entry.apiKey === 'string' && entry.apiKey.trim()) {
      return { mode: 'live', senderNumber, apiKey: entry.apiKey.trim() }
    }
    return { mode: 'off', senderNumber }
  } catch {
    return { mode: 'off', senderNumber: '' }
  }
}

export async function sendWpSenderMessage(config: WpSenderConfig, recipient: string, message: string) {
  if (config.mode === 'off') throw new Error('WPSENDER_DISABLED')
  const phone = recipient.replace(/^\+/, '')
  if (!/^\d{8,15}$/.test(phone)) throw new Error('WPSENDER_INVALID_RECIPIENT')
  if (config.mode === 'mock') return { id: crypto.randomUUID(), status: 'mock_sent' as const }

  const response = await fetch(SEND_URL, {
    method: 'POST',
    redirect: 'error',
    signal: AbortSignal.timeout(15000),
    headers: {
      'Content-Type': 'application/json',
      'X-API-Key': config.apiKey
    },
    body: JSON.stringify({ phone, message, sender_number: config.senderNumber })
  })
  if (!response.ok) throw new Error(`WPSENDER_HTTP_${response.status}`)

  const result = await response.json()
  if (result?.status !== 'success' || !result.data?.message_id) {
    throw new Error('WPSENDER_UNCONFIRMED_RESPONSE')
  }
  return { id: String(result.data.message_id), status: 'accepted' as const }
}
