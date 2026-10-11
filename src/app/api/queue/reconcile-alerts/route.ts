import { NextRequest, NextResponse } from 'next/server'
import { checkAndSendFiveAheadAlerts } from '@/lib/queue-alerts'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clinicId, clinicSlug, clinicName, mapsLink, regularPerUrgent, urgentPerRegular } = body

    if (!clinicId) {
      return NextResponse.json({ error: 'clinicId is required' }, { status: 400 })
    }

    const result = await checkAndSendFiveAheadAlerts(
      clinicId,
      clinicSlug || 'zizo',
      clinicName || 'العيادة',
      mapsLink || '',
      regularPerUrgent || 2,
      urgentPerRegular || 1
    )

    return NextResponse.json(result)
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
