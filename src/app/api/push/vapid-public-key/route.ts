import { NextResponse } from 'next/server'
import { getVapidConfig } from '@/lib/webPushServer'

export async function GET() {
  try {
    const { publicKey } = getVapidConfig()
    return NextResponse.json({ publicKey })
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || 'Failed to retrieve VAPID public key' },
      { status: 500 }
    )
  }
}
