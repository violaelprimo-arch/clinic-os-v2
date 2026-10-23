import { NextRequest, NextResponse } from 'next/server'
import { feedbackSubmissionSchema } from '@/lib/landing-config'
import {
  createDocument,
  deleteDocument,
  queryDocuments,
  writeDocument,
} from '@/lib/server/firebase-rest'
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
      { feedback: await queryDocuments('landing_feedback') },
      { headers: { 'Cache-Control': 'no-store' } },
    )
  } catch (error) {
    return apiFailure(error)
  }
}
export async function POST(request: NextRequest) {
  try {
    await requireOwner(request)
    const result = feedbackSubmissionSchema.safeParse(await readJson(request))
    if (!result.success)
      throw new ApiError(400, 'INVALID_FEEDBACK', 'بيانات الرأي غير مكتملة.')
    await createDocument('landing_feedback', {
      ...result.data,
      createdAt: new Date().toISOString(),
      approved: true,
    })
    return NextResponse.json({ success: true }, { status: 201 })
  } catch (error) {
    return apiFailure(error)
  }
}
export async function PATCH(request: NextRequest) {
  try {
    await requireOwner(request)
    const data = await readJson(request)
    if (
      typeof data.id !== 'string' ||
      !/^[\w-]{1,100}$/.test(data.id) ||
      typeof data.approved !== 'boolean'
    )
      throw new ApiError(400, 'INVALID_FEEDBACK', 'الطلب غير صالح.')
    await writeDocument(
      'landing_feedback/' + data.id,
      { approved: data.approved },
      true,
    )
    await writeDocument(
      'site_settings/landing_page',
      { updatedAt: new Date().toISOString() },
      true,
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiFailure(error)
  }
}
export async function DELETE(request: NextRequest) {
  try {
    await requireOwner(request)
    const data = await readJson(request)
    if (typeof data.id !== 'string' || !/^[\w-]{1,100}$/.test(data.id))
      throw new ApiError(400, 'INVALID_ID', 'الطلب غير صالح.')
    await deleteDocument('landing_feedback/' + data.id)
    await writeDocument(
      'site_settings/landing_page',
      { updatedAt: new Date().toISOString() },
      true,
    )
    return NextResponse.json({ success: true })
  } catch (error) {
    return apiFailure(error)
  }
}
