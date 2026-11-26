import { NextRequest, NextResponse } from 'next/server'
import { verifySessionToken } from '@/lib/auth-crypto'
import { verifyOwnerSession, OWNER_COOKIE } from '@/lib/owner-session'
import { googleAccessToken, getFirebaseServerCredentials } from '@/lib/server/firebase-rest'

export const dynamic = 'force-dynamic'

const MAX_IMAGE_BYTES = 2 * 1024 * 1024 // 2MB strict limit (2,097,152 bytes)

export async function POST(request: NextRequest) {
  try {
    const contentType = request.headers.get('content-type') || ''
    if (contentType.includes('application/json')) {
      return NextResponse.json(
        { error: 'رفع الصور عبر روابط خارجية غير مسموح. يرجى رفع ملف الصورة مباشرة.', code: 'EXTERNAL_URL_REJECTED' },
        { status: 400 }
      )
    }

    // 1. Authenticate Requester (Owner OR Clinic Staff OR Booking Receipt)
    let isAuthorized = false
    let clinicIdForUpload = ''

    // Try owner session
    const ownerSecret = process.env.OWNER_SESSION_SECRET || process.env.AUTH_SECRET || ''
    const ownerCookie = request.cookies.get(OWNER_COOKIE)?.value || ''
    if (ownerSecret && ownerCookie) {
      try {
        const owner = await verifyOwnerSession(ownerCookie, ownerSecret)
        if (owner && (!process.env.PLATFORM_OWNER_UID || owner.uid === process.env.PLATFORM_OWNER_UID)) {
          isAuthorized = true
        }
      } catch {}
    }

    // Try clinic staff session
    if (!isAuthorized) {
      const staffToken =
        request.cookies.get('clinic_session')?.value ||
        request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ||
        ''
      if (staffToken) {
        try {
          const session = await verifySessionToken(staffToken)
          if (session.valid && session.payload?.clinicId) {
            isAuthorized = true
            clinicIdForUpload = String(session.payload.clinicId)
          }
        } catch {}
      }
    }

    const formData = await request.formData()
    if (formData.get('url') || formData.get('externalUrl')) {
      return NextResponse.json(
        { error: 'رفع الصور عبر روابط خارجية غير مسموح. يرجى رفع ملف الصورة مباشرة.', code: 'EXTERNAL_URL_REJECTED' },
        { status: 400 }
      )
    }

    const folder = String(formData.get('folder') || 'general')
    if (!/^[a-zA-Z0-9_-]+(?:\/[a-zA-Z0-9_-]+)*$/.test(folder) || folder.length > 160) {
      return NextResponse.json({ error: 'مسار رفع الصورة غير صالح', code: 'INVALID_FOLDER' }, { status: 400 })
    }

    // Booking receipts can be uploaded during booking flow
    if (!isAuthorized && (folder === 'receipts' || folder === 'patient_receipts')) {
      isAuthorized = true
    }

    if (!isAuthorized) {
      return NextResponse.json({ error: 'غير مصرح برفع الملفات', code: 'UNAUTHORIZED' }, { status: 401 })
    }

    const file = formData.get('file') as File | null
    if (!(file instanceof File) || file.size === 0) {
      return NextResponse.json({ error: 'لم يتم إرسال أي ملف صورة', code: 'NO_FILE' }, { status: 400 })
    }

    // 2. Strict 2MB Limit
    if (file.size > MAX_IMAGE_BYTES) {
      return NextResponse.json(
        {
          error: 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت (2,097,152 بايت)',
          code: 'FILE_TOO_LARGE',
          maxSizeBytes: MAX_IMAGE_BYTES,
          actualSizeBytes: file.size,
        },
        { status: 413 }
      )
    }

    const fileNameLower = (file.name || '').toLowerCase()
    const mimeType = (file.type || '').toLowerCase()

    // 3. Reject HEIC with helpful error
    if (
      mimeType === 'image/heic' ||
      mimeType === 'image/heif' ||
      fileNameLower.endsWith('.heic') ||
      fileNameLower.endsWith('.heif')
    ) {
      return NextResponse.json(
        {
          error: 'صيغة HEIC (صور iPhone) غير مدعومة مباشرة، يرجى اختيار صورة بصيغة JPEG أو PNG أو WebP',
          code: 'HEIC_NOT_SUPPORTED',
        },
        { status: 400 }
      )
    }

    const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
    if (mimeType && !allowedMimes.includes(mimeType)) {
      return NextResponse.json(
        { error: 'صيغة الصورة غير مدعومة (فقط JPEG, PNG, WebP)', code: 'UNSUPPORTED_TYPE' },
        { status: 400 }
      )
    }

    // 4. Magic Byte Verification
    const slice = file.slice(0, 16)
    const arrayBuffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // HEIC signature check (ftyp at byte 4)
    if (bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
      return NextResponse.json(
        {
          error: 'صيغة HEIC (صور iPhone) غير مدعومة مباشرة، يرجى اختيار صورة بصيغة JPEG أو PNG أو WebP',
          code: 'HEIC_NOT_SUPPORTED',
        },
        { status: 400 }
      )
    }

    const isJpeg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
    const isPng =
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4e &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0d &&
      bytes[5] === 0x0a &&
      bytes[6] === 0x1a &&
      bytes[7] === 0x0a
    const isRiff = bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
    const isWebp = bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50

    if (!isJpeg && !isPng && !(isRiff && isWebp)) {
      return NextResponse.json(
        {
          error: 'محتوى الملف تالف أو لا يتطابق مع صورة JPEG أو PNG أو WebP حقيقية',
          code: 'INVALID_IMAGE_BYTES',
        },
        { status: 400 }
      )
    }

    // 5. Upload to Firebase Storage REST
    const { project } = getFirebaseServerCredentials()
    const bucket =
      process.env.FIREBASE_STORAGE_BUCKET ||
      process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET ||
      `${project}.firebasestorage.app`
    const token = await googleAccessToken('storage')

    const cleanName = file.name
      .toLowerCase()
      .replace(/[^a-z0-9.]/g, '_')
      .replace(/_+/g, '_')
    const prefix = clinicIdForUpload ? `clinics/${clinicIdForUpload}/${folder}` : `media/${folder}`
    const objectName = `${prefix}/${crypto.randomUUID()}_${cleanName}`
    const downloadToken = crypto.randomUUID()
    const boundary = crypto.randomUUID()
    const metadata = JSON.stringify({
      name: objectName,
      contentType: file.type || 'image/jpeg',
      metadata: { firebaseStorageDownloadTokens: downloadToken },
    })
    const body = new Blob([
      `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n`,
      `--${boundary}\r\nContent-Type: ${file.type || 'image/jpeg'}\r\n\r\n`,
      file,
      `\r\n--${boundary}--\r\n`,
    ])
    const uploadUrl = `https://storage.googleapis.com/upload/storage/v1/b/${encodeURIComponent(
      bucket
    )}/o?uploadType=multipart&ifGenerationMatch=0`
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
      console.error('Media upload to Storage REST failed:', res.status, errText)
      return NextResponse.json(
        { error: 'تعذر رفع الصورة إلى خادم التخزين السحابي', code: 'STORAGE_FAILED' },
        { status: 500 }
      )
    }

    const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${encodeURIComponent(
      bucket
    )}/o/${encodeURIComponent(objectName)}?alt=media&token=${downloadToken}`

    return NextResponse.json({
      success: true,
      url: publicUrl,
      path: objectName,
    })
  } catch (err: any) {
    console.error('Media upload unhandled error:', err)
    return NextResponse.json({ error: err?.message || 'خطأ غير متوقع أثناء رفع الصورة' }, { status: 500 })
  }
}
