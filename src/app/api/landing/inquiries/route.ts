import { NextRequest, NextResponse } from 'next/server'
import { inquirySubmissionSchema } from '@/lib/landing-config'
import { createDocument } from '@/lib/server/firebase-rest'
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
    const result = inquirySubmissionSchema.safeParse(await readJson(request))
    if (!result.success) {
      throw new ApiError(
        400,
        'INVALID_INQUIRY',
        'يرجى ملء جميع الحقول المطلوبة (الاسم، وسيلة التواصل، عنوان الرسالة وتفاصيلها).'
      )
    }

    // Anti-spam honeypot
    if (result.data.website) {
      return NextResponse.json({ success: true }, { status: 201 })
    }

    await enforceSubmissionLimit(request, 'inquiry')

    const data = { ...result.data }
    delete data.website

    await createDocument('landing_inquiries', {
      ...data,
      createdAt: new Date().toISOString(),
      status: 'new',
      internalNotes: '',
    })

    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return apiFailure(error)
  }
}
