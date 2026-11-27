import { imageLimitMB } from '@/lib/profilePhoto'
import { NextRequest, NextResponse } from 'next/server'
import { requireOwner, apiFailure, ApiError } from '@/lib/server/owner-access'
import { googleAccessToken, getFirebaseServerCredentials } from '@/lib/server/firebase-rest'

export async function POST(request: NextRequest) {
  try {
    await requireOwner(request)

    const formData = await request.formData()
    if (formData.get('url') || formData.get('externalUrl')) {
      throw new ApiError(400, 'EXTERNAL_URL_REJECTED', 'رفع الصور عبر روابط خارجية غير مسموح. يرجى رفع ملف الصورة مباشرة.')
    }

    const file = formData.get('file') as File | null
    const folder = formData.get('folder') || 'general'
    if (typeof folder !== 'string' || !/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(folder) || folder.length > 160) {
      throw new ApiError(400, 'INVALID_FOLDER', 'مسار رفع الصورة غير صالح')
    }

    if (!(file instanceof File) || file.size === 0) {
      throw new ApiError(400, 'NO_FILE', 'لم يتم إرسال أي ملف صورة')
    }

    const maxMB = imageLimitMB(folder)
    const maxBytes = maxMB * 1024 * 1024
    if (file.size > maxBytes) {
      throw new ApiError(413, 'FILE_TOO_LARGE', `حجم الصورة يجب ألا يتجاوز ${maxMB} ميجابايت`)
    }

    const fileNameLower = (file.name || '').toLowerCase()
    const mimeType = (file.type || '').toLowerCase()

    if (
      mimeType === 'image/heic' ||
      mimeType === 'image/heif' ||
      fileNameLower.endsWith('.heic') ||
      fileNameLower.endsWith('.heif')
    ) {
      throw new ApiError(400, 'HEIC_NOT_SUPPORTED', 'صيغة HEIC (صور iPhone) غير مدعومة مباشرة، يرجى اختيار صورة بصيغة JPEG أو PNG أو WebP')
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!allowedTypes.includes(mimeType)) {
      throw new ApiError(400, 'UNSUPPORTED_TYPE', 'صيغة الصورة غير مدعومة (فقط JPEG, PNG, WebP)')
    }

    // Inspect magic bytes
    const slice = file.slice(0, 16)
    const arrayBuffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // HEIC check
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      throw new ApiError(400, 'HEIC_NOT_SUPPORTED', 'صيغة HEIC غير مدعومة مباشرة')
    }

    const isJpeg = bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4E &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0D &&
      bytes[5] === 0x0A &&
      bytes[6] === 0x1A &&
      bytes[7] === 0x0A
    const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50

    if (!isJpeg && !isPng && !(isRiff && isWebp)) {
      throw new ApiError(400, 'INVALID_IMAGE_BYTES', 'محتوى الملف غير صالح أو تالف ولا يتطابق مع صورة JPEG أو PNG أو WebP')
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
