import { NextRequest, NextResponse } from 'next/server'
import { unsubscribeDevice } from '@/lib/pushDispatcher'

/**
 * Unsubscribe a device from an appointment or deactivate it
 * POST /api/push/unsubscribe
 * Body: { endpoint, appointmentId? }
 */
export async function POST(req: NextRequest) {
  try {
    const payload = await req.json()
    const { endpoint, appointmentId } = payload

    if (!endpoint) {
      return NextResponse.json(
        { error: 'Endpoint is required' },
        { status: 400 }
      )
    }

    const result = await unsubscribeDevice({ endpoint, appointmentId })

    return NextResponse.json({
      success: result.success,
      message: 'Unsubscribed successfully',
    })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to unsubscribe' },
      { status: 500 }
    )
  }
}
