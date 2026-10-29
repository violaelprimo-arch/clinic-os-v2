import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

export const MAX_AVATAR_SIZE_BYTES = 2097152 // 2 * 1024 * 1024 = 2,097,152 bytes exactly (2MB)
export const MAX_AVATAR_SIZE_ERROR = 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت'

export interface ImageValidationResult {
  valid: boolean
  error?: string
  format?: 'jpeg' | 'png' | 'webp'
}

/**
 * Validates image size and inspects file magic bytes (not just extension)
 */
export async function validateImageFile(file: File): Promise<ImageValidationResult> {
  // 1. Strict size check (2MB)
  if (file.size > MAX_AVATAR_SIZE_BYTES) {
    return {
      valid: false,
      error: MAX_AVATAR_SIZE_ERROR
    }
  }

  // 2. MIME type check
  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedMimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'صيغة الصورة غير مدعومة، يرجى اختيار ملف JPEG أو PNG أو WebP'
    }
  }

  // 3. Magic bytes inspection
  try {
    const slice = file.slice(0, 12)
    const arrayBuffer = await slice.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)

    // JPEG: FF D8 FF
    if (bytes[0] === 0xFF && bytes[1] === 0xD8 && bytes[2] === 0xFF) {
      return { valid: true, format: 'jpeg' }
    }

    // PNG: 89 50 4E 47 0D 0A 1A 0A
    if (
      bytes[0] === 0x89 &&
      bytes[1] === 0x50 &&
      bytes[2] === 0x4E &&
      bytes[3] === 0x47 &&
      bytes[4] === 0x0D &&
      bytes[5] === 0x0A &&
      bytes[6] === 0x1A &&
      bytes[7] === 0x0A
    ) {
      return { valid: true, format: 'png' }
    }

    // WebP: RIFF (0-3) ... WEBP (8-11)
    const isRiff =
      bytes[0] === 0x52 &&
      bytes[1] === 0x49 &&
      bytes[2] === 0x46 &&
      bytes[3] === 0x46
    const isWebp =
      bytes[8] === 0x57 &&
      bytes[9] === 0x45 &&
      bytes[10] === 0x42 &&
      bytes[11] === 0x50

    if (isRiff && isWebp) {
      return { valid: true, format: 'webp' }
    }

    return {
      valid: false,
      error: 'محتوى الملف غير صالح ولا يتطابق مع نوع صورة معتمد'
    }
  } catch (err) {
    return {
      valid: false,
      error: 'تعذر التحقق من محتوى ملف الصورة'
    }
  }
}

/**
 * Crops and renders an HTMLImageElement to a clean square Blob (max 480x480)
 */
export function cropImageToBlob(
  img: HTMLImageElement,
  cropArea: { x: number; y: number; size: number },
  targetSize = 400
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    canvas.width = targetSize
    canvas.height = targetSize
    const ctx = canvas.getContext('2d')
    if (!ctx) {
      return reject(new Error('Canvas 2D context not available'))
    }

    // Smooth image rendering
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'

    ctx.drawImage(
      img,
      cropArea.x,
      cropArea.y,
      cropArea.size,
      cropArea.size,
      0,
      0,
      targetSize,
      targetSize
    )

    canvas.toBlob(
      (blob) => {
        if (!blob) {
          reject(new Error('Failed to create Blob from canvas'))
        } else {
          resolve(blob)
        }
      },
      'image/jpeg',
      0.88
    )
  })
}

/**
 * Uploads avatar blob to Firebase Storage and returns the public download URL
 */
export async function uploadPatientAvatarToStorage(
  clinicId: string,
  cleanPhone: string,
  blob: Blob
): Promise<string> {
  const safeClinic = clinicId.replace(/[^a-zA-Z0-9_-]/g, '_')
  const safePhone = cleanPhone.replace(/[^0-9]/g, '')
  const timestamp = Date.now()
  const storagePath = `patient_avatars/${safeClinic}/${safePhone}_${timestamp}.jpg`
  const storageRef = ref(storage, storagePath)

  await uploadBytes(storageRef, blob, {
    contentType: 'image/jpeg',
    customMetadata: {
      clinicId: safeClinic,
      phone: safePhone,
      uploadedAt: new Date().toISOString()
    }
  })

  const downloadUrl = await getDownloadURL(storageRef)
  return downloadUrl
}

/**
 * Best-effort delete of an avatar from Firebase Storage given its URL
 */
export async function deleteAvatarFromStorage(avatarUrl: string): Promise<void> {
  if (!avatarUrl || !avatarUrl.includes('firebasestorage.googleapis.com')) {
    return
  }
  try {
    const storageRef = ref(storage, avatarUrl)
    await deleteObject(storageRef)
  } catch (err) {
    // Best-effort delete: file might already be removed or URL structure differed
    console.warn('Storage deleteObject notice:', err)
  }
}
