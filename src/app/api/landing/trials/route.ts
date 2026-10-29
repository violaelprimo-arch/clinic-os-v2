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
    const rawBody = await readJson(request)
    const result = trialSubmissionSchema.safeParse(rawBody)
    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      for (const issue of result.error.issues) {
        const field = String(issue.path[0] || 'general')
        if (!fieldErrors[field]) {
          fieldErrors[field] = issue.message
        }
      }
      return NextResponse.json(
        {
          success: false,
          code: 'INVALID_TRIAL',
          error: 'راجع اسم الطبيب والعيادة والتخصص ورقم الهاتف والبريد.',
          fieldErrors,
        },
        { status: 400 },
      )
    }

    // Anti-spam honeypot detection
    if (result.data.website && result.data.website.length > 0) {
      throw new ApiError(400, 'SPAM_DETECTED', 'تم اكتشاف نشاط غير صالح.')
    }

    const config = await readLandingConfig().catch(
      () => ({ trialDaysCount: 14, visibility: { showTrialBanner: true } } as any),
    )
    if (
      config?.visibility?.showTrialBanner === false &&
      !result.data.governorate &&
      !result.data.address
    ) {
      throw new ApiError(403, 'TRIAL_CLOSED', 'طلبات التجربة غير متاحة حاليًا.')
    }
    await enforceSubmissionLimit(request, 'trial')

    const { website: _website, ...data } = result.data

    // Generate readable sequential request number
    const randomSuffix = Math.floor(10000 + Math.random() * 90000)
    const requestNumber = `REQ-${new Date().getFullYear()}-${randomSuffix}`
    const now = new Date().toISOString()

    const requestPayload = {
      ...data,
      requestNumber,
      trialDays: config.trialDaysCount || 14,
      status: 'new' as const,
      internalNotes: '',
      rejectionReason: '',
      createdClinicId: null,
      createdClinicSlug: null,
      createdAt: now,
      updatedAt: now,
    }

    // Save request to Firestore
    const requestId = await createDocument('trial_requests', requestPayload)

    // Create persistent owner notification
    try {
      await createDocument('notifications', {
        recipientType: 'owner',
        recipientTarget: 'owner',
        title: 'طلب عيادة جديد',
        body: `طلب عيادة جديد (${requestNumber}) من د. ${data.doctorName} - ${data.clinicName} (${data.specialty})`,
        type: 'new_clinic_request',
        requestId: requestId || requestNumber,
        requestNumber,
        doctorName: data.doctorName,
        clinicName: data.clinicName,
        phone: data.phone,
        email: data.email,
        isRead: false,
        read: false,
        createdAt: now,
      })
    } catch (notifErr) {
      console.warn('Could not persist owner notification')
    }

    return NextResponse.json(
      {
        success: true,
        requestNumber,
        requestId,
        message: 'تم إرسال طلب تسجيل العيادة بنجاح! سيتواصل معك فريقنا قريباً.',
      },
      { status: 201 },
    )
  } catch (error) {
    return apiFailure(error)
  }
}
