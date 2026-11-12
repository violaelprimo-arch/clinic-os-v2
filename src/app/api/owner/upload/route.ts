import { NextRequest, NextResponse } from 'next/server'
import { requireOwner, apiFailure, ApiError } from '@/lib/server/owner-access'
import { googleAccessToken, getFirebaseServerCredentials } from '@/lib/server/firebase-rest'

export async function POST(request: NextRequest) {
  try {
    await requireOwner(request)

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const folder = formData.get('folder') || 'general'
    if (typeof folder !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(folder) || folder.length > 160) {
      throw new ApiError(400, 'INVALID_FOLDER', 'مسار رفع الصورة غير صالح')
    }

    if (!(file instanceof File) || file.size === 0) {
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
    const bucket = process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || `${project}.firebasestorage.app`
    const token = await googleAccessToken('storage')

    const cleanName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '_')
      .replace(/_+/g, '_')
    const objectName = `landing_assets/${folder}/${crypto.randomUUID()}_${cleanName}`
    const downloadToken = crypto.randomUUID()
    const boundary = crypto.randomUUID()
    const metadata = JSON.stringify({
      name: objectName,
      contentType: file.type,
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    })
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
      file,
      `\r\n--${boundary}--\r\n`,
    ])
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=multipart&ifGenerationMatch=0`
    const res = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
      signal: AbortSignal.timeout(15000),
    })

    if (!res.ok) {
      const errText = await res.text().catch(() => '')
      console.error('Storage REST upload failed:', res.status, errText)
      throw new ApiError(500, 'UPLOAD_FAILED', 'تعذر رفع الصورة إلى خادم التخزين السحابي')
    }

    // Public Firebase Storage URL
    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: objectName
    })
  } catch (error) {
    return apiFailure(error)
  }
}
