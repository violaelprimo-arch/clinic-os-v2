import { NextRequest, NextResponse } from 'next/server'
import { feedbackSubmissionSchema } from '@/lib/landing-config'
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
    const result = feedbackSubmissionSchema.safeParse(await readJson(request))
    if (!result.success)
      throw new ApiError(
        400,
        'INVALID_FEEDBACK',
        'راجع الاسم واسم العيادة والتقييم والرأي.',
      )
    const config = await readLandingConfig()
    if (
      !config.visibility.showFeedback ||
      !config.visibility.allowClientFeedbackSubmission
    )
      throw new ApiError(
        403,
        'FEEDBACK_CLOSED',
        'إرسال الآراء غير متاح حاليًا.',
      )
    await enforceSubmissionLimit(request, 'feedback')
    const data = { ...result.data }
    delete data.website
    await createDocument('landing_feedback', {
      ...data,
      createdAt: new Date().toISOString(),
      approved: false,
    })
    return NextResponse.json({ success: true, pending: true }, { status: 201 })
  } catch (error) {
    return apiFailure(error)
  }
}
