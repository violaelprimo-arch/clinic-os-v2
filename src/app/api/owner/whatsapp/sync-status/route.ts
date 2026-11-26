import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, readJson, apiFailure } from '@/lib/server/owner-access'
import { readDocument, writeDocument } from '@/lib/server/firebase-rest'
import { checkWpSenderSessionHealth } from '@/lib/server/wp-sender'
import { requeueWaitingJobsForClinic } from '@/lib/server/whatsapp-scheduler'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json',
}

export async function POST(req: NextRequest) {
  try {
    // 1. Authenticate Platform Owner
    await authenticateOwnerRequest(req)

    const body = await readJson(req)
    const clinicId = String(body?.clinicId || '').trim()

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId مطلوب' }, { status: 400, headers: noStore })
    }

    const config = await readDocument(`clinic_whatsapp_configs/${clinicId}`)
    const clinic = await readDocument(`clinics/${clinicId}`)

    if (!config && !clinic) {
      return NextResponse.json({ error: 'العيادة غير موجودة' }, { status: 404, headers: noStore })
    }

    const health = await checkWpSenderSessionHealth(clinicId, {
      persistedStatus: typeof config?.sessionStatus === 'string' ? config.sessionStatus : undefined,
    })

    const now = new Date().toISOString()
    const sessionStatus = health.connected ? 'connected' : 'disconnected'
    const status = health.connected ? 'connected' : config?.status || 'disconnected'

    await writeDocument(
      `clinic_whatsapp_configs/${clinicId}`,
      {
        sessionStatus,
        status,
        connected: health.connected,
        sessionId: health.sessionId || config?.sessionId || null,
        senderNumber: health.senderNumber || config?.senderNumber || null,
        lastSyncAt: now,
        lastError: health.connected ? null : health.reason || 'DISCONNECTED',
      },
      true,
    )

    let resumedJobs: any = null
    if (health.connected) {
      resumedJobs = await requeueWaitingJobsForClinic(clinicId, { drainImmediately: true }).catch(() => null)
    }

    return NextResponse.json(
      {
        success: true,
        clinicId,
        sessionStatus,
        status,
        connected: health.connected,
        sessionId: health.sessionId,
        senderNumber: health.senderNumber,
        resumedJobs,
      },
      { status: 200, headers: noStore },
    )
  } catch (err) {
    return apiFailure(err)
  }
}
