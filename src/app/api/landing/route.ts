import { NextResponse } from 'next/server'
import { DEFAULT_LANDING_CONFIG } from '@/lib/landing-config'
import { publicLandingConfig } from '@/lib/server/landing-store'
export async function GET() {
  try {
    return NextResponse.json(
      { config: await publicLandingConfig() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch {
    return NextResponse.json(
      {
        config: DEFAULT_LANDING_CONFIG,
        configured: false,
        error: 'الخدمة غير متاحة مؤقتًا.',
      },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    )
  }
}
