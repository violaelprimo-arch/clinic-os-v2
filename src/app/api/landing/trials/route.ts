import { NextRequest, NextResponse } from 'next/server'
import { trialSubmissionSchema } from '@/lib/landing-config'
import { createDocument } from '@/lib/server/firebase-rest'
import { readLandingConfig } from '@/lib/server/landing-store'
import {
  ApiError,
  apiFailure,
  assertSameOrigin,
  enforceSubmissionLimit,
  readJson,
} from '@/lib/server/owner-access'
export async function POST(request: NextRequest) {
  try {
    assertSameOrigin(request)
    const result = trialSubmissionSchema.safeParse(await readJson(request))
    if (!result.success)
      throw new ApiError(
        400,
        'INVALID_TRIAL',
        'راجع اسم الطبيب والعيادة والتخصص ورقم الهاتف والبريد.',
      )
    const config = await readLandingConfig()
    if (!config.visibility.showTrialBanner)
      throw new ApiError(403, 'TRIAL_CLOSED', 'طلبات التجربة غير متاحة حاليًا.')
    await enforceSubmissionLimit(request, 'trial')
    const data = { ...result.data }
    delete data.website
    await createDocument('trial_requests', {
      ...data,
      trialDays: config.trialDaysCount,
      createdAt: new Date().toISOString(),
      status: 'new',
    })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return apiFailure(error)
  }
}
