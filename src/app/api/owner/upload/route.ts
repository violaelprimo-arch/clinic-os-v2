import { NextRequest, NextResponse } from 'next/server'
import { requireOwner, apiFailure, ApiError } from '@/lib/server/owner-access'
import { googleAccessToken, getFirebaseServerCredentials } from '@/lib/server/firebase-rest'

export async function POST(request: NextRequest) {
  try {
    await requireOwner(request)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = (formData.get('folder') as string) || 'general'

    if (!file) {
      throw new ApiError(400, 'NO_FILE', 'لم يتم إرسال أي ملف صورة')
    }

    if (file.size > 10 * 1024 * 1024) {
      throw new ApiError(400, 'FILE_TOO_LARGE', 'حجم الصورة يجب ألا يتجاوز 10 ميجابايت')
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(file.type.toLowerCase())) {
      throw new ApiError(400, 'UNSUPPORTED_TYPE', 'صيغة الصورة غير مدعومة (فقط JPEG, PNG, WebP)')
    }

    const { project } = getFirebaseServerCredentials()
    const bucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${project}.appspot.com`
    const token = await googleAccessToken()

    const cleanName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '_')
      .replace(/_+/g, '_')
    const timestamp = Date.now()
    const objectName = `landing_assets/${folder}/${timestamp}_${cleanName}`

    const arrayBuffer = await file.arrayBuffer()

    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=media&name=${encodeURIComponent(objectName)}`
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': file.type || 'image/jpeg',
      },
      body: arrayBuffer,
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('Storage REST upload failed:', res.status, errText)
      throw new ApiError(500, 'UPLOAD_FAILED', 'تعذر رفع الصورة إلى خادم التخزين السحابي')
    }

    // Public Firebase Storage URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: objectName
    })
  } catch (error) {
    return apiFailure(error)
  }
}
