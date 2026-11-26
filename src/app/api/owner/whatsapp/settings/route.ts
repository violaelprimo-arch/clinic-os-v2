import { NextRequest, NextResponse } from 'next/server'
import { authenticateOwnerRequest, readJson, apiFailure } from '@/lib/server/owner-access'
import { writeDocument } from '@/lib/server/firebase-rest'
import {
  ClinicWhatsAppSettings,
  DEFAULT_WHATSAPP_SETTINGS
} from '@/lib/server/whatsapp-scheduler'

export const dynamic = 'force-dynamic'

const noStore = {
  'Cache-Control': 'no-store, no-cache, must-revalidate',
  'Content-Type': 'application/json'
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

    const rawSettings = body?.settings || {}

    // Validate reminders array (max 5 rules, valid positive numbers, allowed units)
    let reminders = Array.isArray(rawSettings.reminders) ? rawSettings.reminders : []
    reminders = reminders
      .slice(0, 5)
      .map((r: any, idx: number) => {
        const value = Math.max(1, Math.min(1000, Number(r.value) || 1))
        const unit = ['minute', 'hour', 'day'].includes(r.unit) ? r.unit : 'hour'
        return {
          id: r.id || `rem-${idx + 1}-${Date.now()}`,
          value,
          unit
        }
      })

    const validatedSettings: ClinicWhatsAppSettings = {
      sendBookingConfirmation: Boolean(rawSettings.sendBookingConfirmation ?? true),
      sendAppointmentReminder: Boolean(rawSettings.sendAppointmentReminder ?? rawSettings.sendReminders ?? true),
      sendReminders: Boolean(rawSettings.sendReminders ?? true),
      reminders: reminders.length > 0 ? reminders : DEFAULT_WHATSAPP_SETTINGS.reminders,
      sendRescheduledNotification: Boolean(rawSettings.sendRescheduledNotification ?? true),
      sendCancelledNotification: Boolean(rawSettings.sendCancelledNotification ?? rawSettings.sendCancellationNotification ?? true),
      sendCancellationNotification: Boolean(rawSettings.sendCancellationNotification ?? true),
      monthlyLimit: Math.max(1, Math.min(10000, Number(rawSettings.monthlyLimit) || 500))
    }

    const now = new Date().toISOString()
    await writeDocument(
      `clinic_whatsapp_configs/${clinicId}`,
      {
        settings: validatedSettings,
        lastSyncAt: now
      },
      true
    )

    return NextResponse.json(
      { success: true, settings: validatedSettings },
      { status: 200, headers: noStore }
    )
  } catch (err) {
    return apiFailure(err)
  }
}
