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
      !/^[\w-]{1,100}$/.test(data.id)
    )
      throw new ApiError(400, 'INVALID_FEEDBACK', 'الطلب غير صالح.')

    const updates: Record<string, any> = {}
    if (typeof data.approved === 'boolean') updates.approved = data.approved
    if (typeof data.visible === 'boolean') updates.visible = data.visible
    if (typeof data.comment === 'string' && data.comment.trim()) updates.comment = data.comment.trim()
    if (typeof data.authorName === 'string' && data.authorName.trim()) updates.authorName = data.authorName.trim()
    if (typeof data.clinicName === 'string' && data.clinicName.trim()) updates.clinicName = data.clinicName.trim()
    if (typeof data.specialty === 'string') updates.specialty = data.specialty.trim()
    if (typeof data.rating === 'number' && data.rating >= 1 && data.rating <= 5) updates.rating = Math.round(data.rating)

    if (Object.keys(updates).length === 0) {
      throw new ApiError(400, 'NO_UPDATES', 'لم يتم تقديم أي تعديلات صالحة.')
    }

    await writeDocument(
      'landing_feedback/' + data.id,
      updates,
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
