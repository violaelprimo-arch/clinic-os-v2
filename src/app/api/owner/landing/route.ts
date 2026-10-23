import { NextRequest, NextResponse } from 'next/server'
import { landingConfigSchema } from '@/lib/landing-config'
import { readLandingConfig } from '@/lib/server/landing-store'
import { writeDocument } from '@/lib/server/firebase-rest'
import {
  ApiError,
  apiFailure,
  readJson,
  requireOwner,
} from '@/lib/server/owner-access'
export async function GET(request: NextRequest) {
  try {
    await requireOwner(request)
    return NextResponse.json(
      { config: await readLandingConfig() },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return apiFailure(error)
  }
}
export async function PUT(request: NextRequest) {
  try {
    const owner = await requireOwner(request),
      result = landingConfigSchema.safeParse(await readJson(request, 400000))
    if (!result.success)
      throw new ApiError(
        400,
        'INVALID_CONFIG',
        'راجع الحقول والروابط وأحجام المحتوى قبل الحفظ.',
      )
    await writeDocument('site_settings/landing_page', {
      ...result.data,
      updatedAt: new Date().toISOString(),
      updatedBy: owner.email,
    })
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiFailure(error)
  }
}
