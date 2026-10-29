import { storage } from '@/lib/firebase'
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage'

export interface MediaValidationResult {
  valid: boolean
  error?: string
  format?: 'jpeg' | 'png' | 'webp'
}

/**
 * Validates image size and inspects file magic bytes (not just extension)
 */
export async function validateMediaFile(
  file: File,
  maxSizeBytes = 5 * 1024 * 1024 // 5MB default for marketing / screenshots
): Promise<MediaValidationResult> {
  const maxMB = (maxSizeBytes / (1024 * 1024)).toFixed(1).replace('.0', '')

  if (file.size > maxSizeBytes) {
    return {
      valid: false,
      error: `حجم الصورة يجب ألا يتجاوز ${maxMB} ميجابايت`
    }
  }

  const allowedMimes = ['image/jpeg', 'image/png', 'image/webp']
  if (!allowedMimes.includes(file.type.toLowerCase())) {
    return {
      valid: false,
      error: 'صيغة الصورة غير مدعومة، يرجى اختيار ملف JPEG أو PNG أو WebP'
    }
  }

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
      error: 'محتوى الملف غير صالح أو تالف ولا يتطابق مع نوع صورة معتمد'
    }
  } catch (err) {
    return {
      valid: false,
      error: 'تعذر فحص محتوى ملف الصورة'
    }
  }
}

/**
 * Uploads any media asset to Firebase Storage and returns public HTTPS download URL
 */
export async function uploadMediaToStorage(
  file: File,
  folder = 'general'
): Promise<string> {
  const cleanName = file.name
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '_')
    .replace(/_+/g, '_')
  const timestamp = Date.now()
  const storagePath = `landing_assets/${folder}/${timestamp}_${cleanName}`
  const storageRef = ref(storage, storagePath)

  try {
    await uploadBytes(storageRef, file, {
      contentType: file.type || 'image/jpeg',
      customMetadata: {
        folder,
        originalName: file.name,
        uploadedAt: new Date().toISOString()
      }
    })

    const downloadUrl = await getDownloadURL(storageRef)
    return downloadUrl
  } catch (clientErr) {
    console.warn('Client Storage upload failed, attempting fallback API upload:', clientErr)

    // Fallback to server-side API upload
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)

    const res = await fetch('/api/owner/upload', {
      method: 'POST',
      body: formData
    })

    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}))
      throw new Error(errJson.error || 'تعذر رفع الصورة إلى خادم التخزين')
    }

    const data = await res.json()
    return data.url
  }
}

/**
 * Best-effort deletion of media from storage
 */
export async function deleteMediaFromStorage(url: string): Promise<void> {
  if (!url || !url.includes('firebasestorage.googleapis.com')) return
  try {
    const storageRef = ref(storage, url)
    await deleteObject(storageRef)
  } catch (e) {
    console.warn('Media deletion notice:', e)
  }
}
