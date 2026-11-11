if (typeof window !== 'undefined') {
  throw new Error('SERVER_ONLY_MODULE: queue-room-do cannot be imported in client-side bundles')
}

import { DurableObject } from 'cloudflare:workers'
import { syncWorkerEnv } from './worker-env'
import {
  queryDocumentsByFields,
  readDocument,
} from './firebase-rest'
import {
  buildPatientTrackPayload,
  buildStaffQueuePayload,
  buildTvQueuePayload,
  sanitizeClinicPublicSummary,
} from '../queue-projections'
import { computeQueueWatermark, type QueueWatermark } from '../queueSync'

export interface QueueSocketAttachment {
  clinicId: string
  role: 'staff' | 'tv' | 'patient'
  branchId: string | null
  date: string
  appointmentId?: string | null
  credentialsVersion?: number
  accountKey?: string
}

export interface StoredDaySnapshot {
  clinicId: string
  date: string
  clinic: Record<string, any> | null
  appointments: Array<Record<string, any>>
  queueWatermark: QueueWatermark
  revision: number
  serverTime: string
  source: 'do_sqlite' | 'firestore_hydrated' | 'mutation'
}

interface DailyQueueRow {
  date: string
  appointments_json: string
  watermark_json: string
  revision: number
  updated_at: string
}

interface ClinicMetaRow {
  clinic_id: string
  clinic_json: string
  credentials_version: number
  updated_at: string
}

interface SlugIndexRow {
  clinic_id: string
  updated_at: string
}

function getTodayCairoStr(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
}

function isStaffSocketValid(
  attachment: QueueSocketAttachment,
  clinicDoc: Record<string, any> | null,
): boolean {
  if (!clinicDoc) return true
  const currentVersion = Number(clinicDoc.credentialsVersion || 0)
  const tokenVersion = Number(attachment.credentialsVersion || 0)
  if (tokenVersion !== currentVersion) return false

  const accountKey = attachment.accountKey
  if (accountKey && accountKey !== 'doctor') {
    const candidates = [
      {
        email: clinicDoc.assistantEmail,
        username: clinicDoc.assistantUsername,
        id: 'primary-assistant',
        branchId: clinicDoc.assistantBranchId,
        isActive: clinicDoc.assistantIsActive ?? true,
      },
      ...(Array.isArray(clinicDoc.assistants) ? clinicDoc.assistants : []),
    ]
    const matched = candidates.find(
      (a: any) =>
        a &&
        a.isActive !== false &&
        (String(a.id || '') === accountKey ||
          String(a.email || '').trim().toLowerCase() === accountKey.toLowerCase() ||
          String(a.username || '').trim().toLowerCase() === accountKey.toLowerCase()),
    )
    if (!matched) return false
    if (String(matched.branchId || '') !== String(attachment.branchId || '')) return false
  }
  return true
}

export class QueueRoomDO extends DurableObject<CloudflareEnv> {
  private inflightHydrations = new Map<string, Promise<StoredDaySnapshot>>()
  private inflightClinicFetch: Promise<Record<string, any> | null> | null = null

  constructor(ctx: DurableObjectState, env: CloudflareEnv) {
    super(ctx, env)
    syncWorkerEnv(env as unknown as Record<string, unknown>)
    this.ctx.blockConcurrencyWhile(async () => {
      this.ctx.storage.sql.exec(`
        CREATE TABLE IF NOT EXISTS daily_queues (
          date TEXT PRIMARY KEY,
          appointments_json TEXT NOT NULL,
          watermark_json TEXT NOT NULL,
          revision INTEGER NOT NULL DEFAULT 1,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS clinic_meta (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          clinic_id TEXT NOT NULL,
          clinic_json TEXT NOT NULL,
          credentials_version INTEGER NOT NULL DEFAULT 0,
          updated_at TEXT NOT NULL
        );
        CREATE TABLE IF NOT EXISTS slug_index (
          slug TEXT PRIMARY KEY,
          clinic_id TEXT NOT NULL,
          updated_at TEXT NOT NULL
        );
      `)
    })
  }

  private readClinicMetaRow(): ClinicMetaRow | null {
    const rows = this.ctx.storage.sql
      .exec<ClinicMetaRow>(
        'SELECT clinic_id, clinic_json, credentials_version, updated_at FROM clinic_meta WHERE id = 1',
      )
      .toArray()
    return rows[0] || null
  }

  private writeClinicMetaRow(clinicId: string, clinicDoc: Record<string, any>): void {
    const nowIso = new Date().toISOString()
    const version = Number(clinicDoc.credentialsVersion || 0)
    this.ctx.storage.sql.exec(
      `INSERT INTO clinic_meta (id, clinic_id, clinic_json, credentials_version, updated_at)
       VALUES (1, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         clinic_id = excluded.clinic_id,
         clinic_json = excluded.clinic_json,
         credentials_version = excluded.credentials_version,
         updated_at = excluded.updated_at`,
      clinicId,
      JSON.stringify(clinicDoc),
      version,
      nowIso,
    )
  }

  private readDailyQueueRow(date: string): DailyQueueRow | null {
    const rows = this.ctx.storage.sql
      .exec<DailyQueueRow>(
        'SELECT date, appointments_json, watermark_json, revision, updated_at FROM daily_queues WHERE date = ?',
        date,
      )
      .toArray()
    return rows[0] || null
  }

  private writeDailyQueueRow(
    date: string,
    appointments: Array<Record<string, any>>,
    watermark: QueueWatermark,
    revision: number,
  ): void {
    const nowIso = new Date().toISOString()
    this.ctx.storage.sql.exec(
      `INSERT INTO daily_queues (date, appointments_json, watermark_json, revision, updated_at)
       VALUES (?, ?, ?, ?, ?)
       ON CONFLICT(date) DO UPDATE SET
         appointments_json = excluded.appointments_json,
         watermark_json = excluded.watermark_json,
         revision = excluded.revision,
         updated_at = excluded.updated_at`,
      date,
      JSON.stringify(appointments),
      JSON.stringify(watermark),
      revision,
      nowIso,
    )
  }

  private async ensureClinicMeta(
    clinicId: string,
    forceRefresh = false,
    maxAgeMs?: number,
  ): Promise<Record<string, any> | null> {
    if (!forceRefresh) {
      const cached = this.readClinicMetaRow()
      if (cached && cached.clinic_id === clinicId) {
        const ageMs = Date.now() - Date.parse(cached.updated_at || '')
        const withinMaxAge =
          !maxAgeMs || !Number.isFinite(ageMs) ? true : ageMs <= maxAgeMs
        if (withinMaxAge) {
          try {
            return JSON.parse(cached.clinic_json) as Record<string, any>
          } catch {}
        }
      }
    }

    if (!this.inflightClinicFetch) {
      this.inflightClinicFetch = (async () => {
        const doc = await readDocument(`clinics/${clinicId}`)
        if (doc) {
          this.writeClinicMetaRow(clinicId, doc)
        }
        return doc
      })().finally(() => {
        this.inflightClinicFetch = null
      })
    }
    return this.inflightClinicFetch
  }

  async resolveClinicSlug(slug: string): Promise<string | null> {
    const rows = this.ctx.storage.sql
      .exec<SlugIndexRow>('SELECT clinic_id, updated_at FROM slug_index WHERE slug = ?', slug)
      .toArray()
    return rows[0]?.clinic_id || null
  }

  async setClinicSlugMapping(slug: string, clinicId: string): Promise<{ ok: true }> {
    const cleanSlug = String(slug || '').trim()
    const cleanId = String(clinicId || '').trim()
    if (cleanSlug && cleanId) {
      this.ctx.storage.sql.exec(
        `INSERT INTO slug_index (slug, clinic_id, updated_at)
         VALUES (?, ?, ?)
         ON CONFLICT(slug) DO UPDATE SET
           clinic_id = excluded.clinic_id,
           updated_at = excluded.updated_at`,
        cleanSlug,
        cleanId,
        new Date().toISOString(),
      )
    }
    return { ok: true }
  }

  async getClinicMeta(params: {
    clinicId: string
    forceRefresh?: boolean
    maxAgeMs?: number
  }): Promise<Record<string, any> | null> {
    return this.ensureClinicMeta(params.clinicId, Boolean(params.forceRefresh), params.maxAgeMs)
  }

  async getCachedDayIfWarm(params: {
    clinicId: string
    date: string
  }): Promise<StoredDaySnapshot | null> {
    const row = this.readDailyQueueRow(params.date)
    const metaRow = this.readClinicMetaRow()
    if (!row || !metaRow || metaRow.clinic_id !== params.clinicId) return null
    try {
      const appointments = JSON.parse(row.appointments_json) as Array<Record<string, any>>
      const queueWatermark = JSON.parse(row.watermark_json) as QueueWatermark
      const clinic = JSON.parse(metaRow.clinic_json) as Record<string, any>
      return {
        clinicId: params.clinicId,
        date: params.date,
        clinic: sanitizeClinicPublicSummary(clinic, params.clinicId),
        appointments,
        queueWatermark,
        revision: row.revision,
        serverTime: row.updated_at,
        source: 'do_sqlite',
      }
    } catch {
      return null
    }
  }

  async getOrHydrateDay(params: {
    clinicId: string
    date: string
    forceRehydrate?: boolean
  }): Promise<StoredDaySnapshot> {
    const clinicId = params.clinicId
    const date = params.date || getTodayCairoStr()

    if (!params.forceRehydrate) {
      const existingRow = this.readDailyQueueRow(date)
      if (existingRow) {
        const clinic = await this.ensureClinicMeta(clinicId)
        const appointments = JSON.parse(existingRow.appointments_json) as Array<Record<string, any>>
        const queueWatermark = JSON.parse(existingRow.watermark_json) as QueueWatermark
        return {
          clinicId,
          date,
          clinic: sanitizeClinicPublicSummary(clinic, clinicId),
          appointments,
          queueWatermark,
          revision: existingRow.revision,
          serverTime: existingRow.updated_at,
          source: 'do_sqlite',
        }
      }
    }

    const inflightKey = `${clinicId}:${date}:${Boolean(params.forceRehydrate)}`
    const pending = this.inflightHydrations.get(inflightKey)
    if (pending) return pending

    const work = (async (): Promise<StoredDaySnapshot> => {
      const snapshotStartedAt = new Date().toISOString()
      const [clinic, appts] = await Promise.all([
        this.ensureClinicMeta(clinicId, Boolean(params.forceRehydrate)),
        queryDocumentsByFields('appointments', { clinic_id: clinicId, date }, 250),
      ])

      const existingRow = this.readDailyQueueRow(date)
      const revision = (existingRow?.revision || 0) + 1
      const watermark = computeQueueWatermark(appts, snapshotStartedAt)
      this.writeDailyQueueRow(date, appts, watermark, revision)

      return {
        clinicId,
        date,
        clinic: sanitizeClinicPublicSummary(clinic, clinicId),
        appointments: appts,
        queueWatermark: watermark,
        revision,
        serverTime: new Date().toISOString(),
        source: 'firestore_hydrated',
      }
    })().finally(() => {
      this.inflightHydrations.delete(inflightKey)
    })

    this.inflightHydrations.set(inflightKey, work)
    return work
  }

  async publishDaySnapshot(params: {
    clinicId: string
    date: string
    appointments: Array<Record<string, any>>
    clinic?: Record<string, any> | null
    commitIso?: string | null
    notifyChanged?: boolean
  }): Promise<StoredDaySnapshot> {
    const clinicId = params.clinicId
    const date = params.date || getTodayCairoStr()
    const serverTime = new Date().toISOString()

    if (params.clinic) {
      this.writeClinicMetaRow(clinicId, params.clinic)
    }
    const rawClinic = params.clinic || (await this.ensureClinicMeta(clinicId))

    const existingRow = this.readDailyQueueRow(date)
    const incomingWatermark = computeQueueWatermark(
      params.appointments,
      serverTime,
      params.commitIso || serverTime,
    )

    if (existingRow) {
      try {
        const existingWatermark = JSON.parse(existingRow.watermark_json) as QueueWatermark
        const existingCommit = existingWatermark.lastMutationCommitMs ?? 0
        const incomingCommit = incomingWatermark.lastMutationCommitMs ?? incomingWatermark.snapshotAtMs
        if (
          existingCommit > incomingCommit &&
          incomingWatermark.maxModifiedMs < existingWatermark.maxModifiedMs
        ) {
          return {
            clinicId,
            date,
            clinic: sanitizeClinicPublicSummary(rawClinic, clinicId),
            appointments: JSON.parse(existingRow.appointments_json),
            queueWatermark: existingWatermark,
            revision: existingRow.revision,
            serverTime: existingRow.updated_at,
            source: 'do_sqlite',
          }
        }
      } catch {}
    }

    const revision = (existingRow?.revision || 0) + 1
    this.writeDailyQueueRow(date, params.appointments, incomingWatermark, revision)
    await this.broadcastUpdate({
      clinicId,
      date,
      clinicDoc: rawClinic,
      appointments: params.appointments,
      queueWatermark: incomingWatermark,
      revision,
      serverTime,
      notifyChanged: Boolean(params.notifyChanged),
    })

    return {
      clinicId,
      date,
      clinic: sanitizeClinicPublicSummary(rawClinic, clinicId),
      appointments: params.appointments,
      queueWatermark: incomingWatermark,
      revision,
      serverTime,
      source: 'mutation',
    }
  }

  async upsertAppointment(params: {
    clinicId: string
    date?: string
    appointment: Record<string, any>
    clinic?: Record<string, any> | null
    commitIso?: string | null
    notifyChanged?: boolean
  }): Promise<StoredDaySnapshot> {
    const clinicId = params.clinicId
    const apptId = String(params.appointment.id || '')
    const date = String(params.date || params.appointment.date || getTodayCairoStr())

    if (params.clinic) {
      this.writeClinicMetaRow(clinicId, params.clinic)
    }

    const row = this.readDailyQueueRow(date)
    let baseAppointments: Array<Record<string, any>>
    if (row) {
      baseAppointments = JSON.parse(row.appointments_json) as Array<Record<string, any>>
    } else {
      const hydrated = await this.getOrHydrateDay({ clinicId, date })
      baseAppointments = hydrated.appointments
    }

    const filtered = apptId
      ? baseAppointments.filter((a) => String(a.id) !== apptId)
      : [...baseAppointments]
    filtered.push(params.appointment)

    return this.publishDaySnapshot({
      clinicId,
      date,
      appointments: filtered,
      clinic: params.clinic || undefined,
      commitIso: params.commitIso || new Date().toISOString(),
      notifyChanged: params.notifyChanged,
    })
  }

  async updateClinicMeta(params: {
    clinicId: string
    clinic: Record<string, any>
    notifyChanged?: boolean
  }): Promise<{ ok: true; closedRevokedCount: number }> {
    const clinicId = params.clinicId
    this.writeClinicMetaRow(clinicId, params.clinic)
    let closedRevokedCount = 0
    const serverTime = new Date().toISOString()

    // Check every open staff socket against updated credentials / assistant assignments
    for (const ws of this.ctx.getWebSockets()) {
      const attachment = ws.deserializeAttachment() as QueueSocketAttachment | null
      if (!attachment || attachment.clinicId !== clinicId) {
        try { ws.close(4003, 'CLINIC_MISMATCH') } catch {}
        continue
      }
      if (attachment.role === 'staff' && !isStaffSocketValid(attachment, params.clinic)) {
        try { ws.close(4001, 'SESSION_REVOKED') } catch {}
        closedRevokedCount++
        continue
      }
    }

    const today = getTodayCairoStr()
    const row = this.readDailyQueueRow(today)
    if (row) {
      const appointments = JSON.parse(row.appointments_json) as Array<Record<string, any>>
      const watermark = JSON.parse(row.watermark_json) as QueueWatermark
      const revision = row.revision + 1
      this.writeDailyQueueRow(today, appointments, watermark, revision)
      await this.broadcastUpdate({
        clinicId,
        date: today,
        clinicDoc: params.clinic,
        appointments,
        queueWatermark: watermark,
        revision,
        serverTime,
        notifyChanged: Boolean(params.notifyChanged),
      })
    }

    return { ok: true, closedRevokedCount }
  }

  private projectPayloadForAttachment(params: {
    attachment: QueueSocketAttachment
    clinicDoc: Record<string, any> | null
    appointments: Array<Record<string, any>>
    queueWatermark: QueueWatermark
    revision: number
    serverTime: string
    notifyChanged?: boolean
    messageType: 'snapshot' | 'queue_update'
  }): string {
    const { attachment, clinicDoc, appointments, queueWatermark, revision, serverTime, notifyChanged, messageType } = params
    const publicClinic = sanitizeClinicPublicSummary(clinicDoc, attachment.clinicId)

    if (attachment.role === 'staff') {
      const payload = buildStaffQueuePayload({
        clinicId: attachment.clinicId,
        date: attachment.date,
        branchId: attachment.branchId,
        appointments,
        serverTime,
        queueWatermark,
        revision,
        notificationsChanged: notifyChanged,
      })
      return JSON.stringify({ type: messageType, ...payload })
    }

    if (attachment.role === 'tv') {
      const payload = buildTvQueuePayload({
        clinicId: attachment.clinicId,
        clinic: publicClinic,
        date: attachment.date,
        branchId: attachment.branchId,
        appointments,
        serverTime,
        queueWatermark,
        revision,
      })
      return JSON.stringify({ type: messageType, ...payload })
    }

    const apptId = attachment.appointmentId || ''
    const target = appointments.find((a) => String(a.id) === apptId) || null
    const payload = buildPatientTrackPayload({
      clinicId: attachment.clinicId,
      clinic: publicClinic,
      todayStr: getTodayCairoStr(),
      branchId: attachment.branchId,
      targetAppointmentId: apptId,
      targetAppointment: target,
      appointments,
      serverTime,
      queueWatermark,
      revision,
      notificationsChanged: notifyChanged,
    })
    return JSON.stringify({ type: messageType, ...payload })
  }

  private async broadcastUpdate(params: {
    clinicId: string
    date: string
    clinicDoc: Record<string, any> | null
    appointments: Array<Record<string, any>>
    queueWatermark: QueueWatermark
    revision: number
    serverTime: string
    notifyChanged?: boolean
  }): Promise<void> {
    const sockets = this.ctx.getWebSockets()
    for (const ws of sockets) {
      const attachment = ws.deserializeAttachment() as QueueSocketAttachment | null
      if (!attachment || attachment.clinicId !== params.clinicId) {
        try { ws.close(4003, 'CLINIC_MISMATCH') } catch {}
        continue
      }
      if (attachment.role === 'staff' && !isStaffSocketValid(attachment, params.clinicDoc)) {
        try { ws.close(4001, 'SESSION_REVOKED') } catch {}
        continue
      }
      if (attachment.date !== params.date) {
        continue
      }
      if (attachment.role === 'patient' && !attachment.appointmentId) {
        continue
      }
      try {
        const message = this.projectPayloadForAttachment({
          attachment,
          clinicDoc: params.clinicDoc,
          appointments: params.appointments,
          queueWatermark: params.queueWatermark,
          revision: params.revision,
          serverTime: params.serverTime,
          notifyChanged: params.notifyChanged,
          messageType: 'queue_update',
        })
        ws.send(message)
      } catch {
        // Best-effort per-socket send; broken sockets close cleanly.
      }
    }
  }

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    // Internal WebSocket upgrade forwarded exclusively by queue-ws-gateway
    if (url.pathname === '/ws' && request.headers.get('upgrade')?.toLowerCase() === 'websocket') {
      const clinicId = request.headers.get('x-queue-clinic-id') || ''
      const role = request.headers.get('x-queue-internal-role') as 'staff' | 'tv' | 'patient' | null
      const date = request.headers.get('x-queue-date') || getTodayCairoStr()
      const branchId = request.headers.get('x-queue-branch-id') || null
      const appointmentId = request.headers.get('x-queue-appointment-id') || null
      const credentialsVersionHeader = request.headers.get('x-queue-credentials-version')
      const accountKey = request.headers.get('x-queue-account-key') || undefined

      if (!clinicId || !role || !['staff', 'tv', 'patient'].includes(role)) {
        return new Response('Forbidden', { status: 403 })
      }
      if (role === 'patient' && !appointmentId) {
        return new Response('Missing appointment scope', { status: 403 })
      }

      const hydrated = await this.getOrHydrateDay({ clinicId, date })
      const metaRow = this.readClinicMetaRow()
      const rawClinic = metaRow ? (JSON.parse(metaRow.clinic_json) as Record<string, any>) : hydrated.clinic

      const attachment: QueueSocketAttachment = {
        clinicId,
        role,
        branchId: branchId || null,
        date,
        appointmentId,
        ...(credentialsVersionHeader !== null
          ? { credentialsVersion: Number(credentialsVersionHeader) || 0 }
          : {}),
        ...(accountKey ? { accountKey } : {}),
      }

      if (role === 'staff' && !isStaffSocketValid(attachment, rawClinic)) {
        return new Response('Unauthorized', { status: 401 })
      }

      const pair = new WebSocketPair()
      const client = pair[0]
      const server = pair[1]

      const tags = [
        `clinic:${clinicId}`,
        `role:${role}`,
        `date:${date}`,
        ...(branchId ? [`branch:${branchId}`] : []),
      ]

      server.serializeAttachment(attachment)
      this.ctx.acceptWebSocket(server, tags)

      const snapshotJson = this.projectPayloadForAttachment({
        attachment,
        clinicDoc: rawClinic,
        appointments: hydrated.appointments,
        queueWatermark: hydrated.queueWatermark,
        revision: hydrated.revision,
        serverTime: hydrated.serverTime,
        messageType: 'snapshot',
      })
      server.send(snapshotJson)

      return new Response(null, { status: 101, webSocket: client })
    }

    // Internal JSON RPC dispatcher (used as fallback or for test harnesses)
    if (url.pathname === '/rpc' && request.method === 'POST') {
      const body = (await request.json().catch(() => ({}))) as {
        action?: string
        params?: any
      }
      const action = String(body.action || '')
      const params = body.params || {}
      switch (action) {
        case 'resolveClinicSlug':
          return Response.json({ clinicId: await this.resolveClinicSlug(params.slug) })
        case 'setClinicSlugMapping':
          return Response.json(await this.setClinicSlugMapping(params.slug, params.clinicId))
        case 'getClinicMeta':
          return Response.json({ clinic: await this.getClinicMeta(params) })
        case 'getCachedDayIfWarm':
          return Response.json(await this.getCachedDayIfWarm(params))
        case 'getOrHydrateDay':
          return Response.json(await this.getOrHydrateDay(params))
        case 'publishDaySnapshot':
          return Response.json(await this.publishDaySnapshot(params))
        case 'upsertAppointment':
          return Response.json(await this.upsertAppointment(params))
        case 'updateClinicMeta':
          return Response.json(await this.updateClinicMeta(params))
        default:
          return Response.json({ error: 'UNKNOWN_RPC_ACTION' }, { status: 400 })
      }
    }

    return new Response('Not Found', { status: 404 })
  }

  async webSocketMessage(ws: WebSocket, message: string | ArrayBuffer): Promise<void> {
    if (typeof message !== 'string') return
    let parsed: { type?: string } | null = null
    try {
      parsed = JSON.parse(message) as { type?: string }
    } catch {
      return
    }
    if (!parsed || typeof parsed !== 'object') return

    if (parsed.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong', serverTime: new Date().toISOString() }))
      return
    }

    // Client-initiated resync uses ONLY the server-sealed socket attachment (zero trust in message payload).
    if (parsed.type === 'resync') {
      const attachment = ws.deserializeAttachment() as QueueSocketAttachment | null
      if (!attachment) {
        try { ws.close(4003, 'MISSING_ATTACHMENT') } catch {}
        return
      }
      const hydrated = await this.getOrHydrateDay({
        clinicId: attachment.clinicId,
        date: attachment.date,
      })
      const metaRow = this.readClinicMetaRow()
      const rawClinic = metaRow ? (JSON.parse(metaRow.clinic_json) as Record<string, any>) : hydrated.clinic
      if (attachment.role === 'staff' && !isStaffSocketValid(attachment, rawClinic)) {
        try { ws.close(4001, 'SESSION_REVOKED') } catch {}
        return
      }
      ws.send(
        this.projectPayloadForAttachment({
          attachment,
          clinicDoc: rawClinic,
          appointments: hydrated.appointments,
          queueWatermark: hydrated.queueWatermark,
          revision: hydrated.revision,
          serverTime: hydrated.serverTime,
          messageType: 'snapshot',
        }),
      )
    }
  }

  async webSocketClose(ws: WebSocket, code: number, reason: string): Promise<void> {
    try {
      ws.close(code, reason)
    } catch {}
  }

  async webSocketError(ws: WebSocket): Promise<void> {
    try {
      ws.close(1011, 'WEBSOCKET_ERROR')
    } catch {}
  }
}
