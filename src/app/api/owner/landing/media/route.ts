import { NextRequest, NextResponse } from 'next/server'
import { googleAccessToken } from '@/lib/server/firebase-rest'
import { ApiError, apiFailure, requireOwner } from '@/lib/server/owner-access'
export async function POST(request: NextRequest) {
  try {
    await requireOwner(request)
    const bucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
    if (!bucket)
      throw new ApiError(
        503,
        'STORAGE_SETUP_REQUIRED',
        'إعداد تخزين الصور غير مكتمل.',
      )
    if (Number(request.headers.get('content-length') || 0) > 6 * 1024 * 1024)
      throw new ApiError(
        413,
        'IMAGE_TOO_LARGE',
        'الحد الأقصى للصورة ٥ ميجابايت.',
      )
    const form = await request.formData(),
      file = form.get('file')
    if (
      !(file instanceof File) ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type) ||
      file.size > 5 * 1024 * 1024 ||
      file.size === 0
    )
      throw new ApiError(
        400,
        'INVALID_IMAGE',
        'اختر صورة JPG أو PNG أو WebP حتى ٥ ميجابايت.',
      )
    const bytes = new Uint8Array(await file.arrayBuffer())
    const jpeg = bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255,
      png =
        bytes[0] === 137 &&
        bytes[1] === 80 &&
        bytes[2] === 78 &&
        bytes[3] === 71,
      webp =
        String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' &&
        String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
    if (
      !(
        (file.type === 'image/jpeg' && jpeg) ||
        (file.type === 'image/png' && png) ||
        (file.type === 'image/webp' && webp)
      )
    )
      throw new ApiError(
        400,
        'INVALID_IMAGE',
        'محتوى الملف لا يطابق نوع الصورة.',
      )
    const name =
        'landing/' +
        crypto.randomUUID() +
        '.' +
        (jpeg ? 'jpg' : png ? 'png' : 'webp'),
      token = crypto.randomUUID(),
      boundary = 'yalla-' + crypto.randomUUID()
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name, contentType: file.type, metadata: { firebaseStorageDownloadTokens: token } })}\r\n--${boundary}\r\nContent-Type: ${file.type}\r\n\r\n`,
      bytes,
      `\r\n--${boundary}--`,
    ])
    const response = await fetch(
      `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(bucket)}/o?uploadType=multipart`,
      {
        method: 'POST',
        headers: {
          Authorization: 'Bearer ' + (await googleAccessToken()),
          'Content-Type': 'multipart/related; boundary=' + boundary,
        },
        body,
      },
    )
    if (!response.ok) throw new Error('STORAGE_UPLOAD_FAILED')
    return NextResponse.json(
      {
        url: `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(bucket)}/o/${encodeURIComponent(name)}?alt=media&token=${token}`,
      },
      { status: 201 },
    )
  } catch (error) {
    return apiFailure(error)
  }
}
