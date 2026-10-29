import test from 'node:test'
import assert from 'node:assert/strict'
import {
  MAX_AVATAR_SIZE_BYTES,
  MAX_AVATAR_SIZE_ERROR,
  validateImageFile
} from '../src/lib/avatarUpload.ts'

// Polyfill File and Blob in Node environment if needed
class MockFile {
  constructor(chunks, name, options = {}) {
    this.name = name
    this.type = options.type || ''
    this.chunks = chunks
    let totalLen = 0
    for (const c of chunks) totalLen += c.byteLength || c.length || 0
    this.size = totalLen
  }

  slice(start, end) {
    const combined = new Uint8Array(this.size)
    let offset = 0
    for (const c of this.chunks) {
      const arr = c instanceof Uint8Array ? c : new Uint8Array(c)
      combined.set(arr, offset)
      offset += arr.length
    }
    const sliced = combined.slice(start, end)
    return {
      arrayBuffer: async () => sliced.buffer
    }
  }
}

test('Avatar Upload Validation: Exact 2MB size limit and error message', async () => {
  assert.equal(MAX_AVATAR_SIZE_BYTES, 2097152, 'Max size must be exactly 2,097,152 bytes (2MB)')
  assert.equal(MAX_AVATAR_SIZE_ERROR, 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت', 'Error message must match specification')

  // File 1 byte over 2MB
  const oversizeBytes = new Uint8Array(2097153)
  const oversizeFile = new MockFile([oversizeBytes], 'large.jpg', { type: 'image/jpeg' })
  const resultOver = await validateImageFile(oversizeFile)

  assert.equal(resultOver.valid, false)
  assert.equal(resultOver.error, 'حجم الصورة يجب ألا يتجاوز 2 ميجابايت')
})

test('Avatar Upload Validation: Rejects unsupported MIME types', async () => {
  const bytes = new Uint8Array(100)
  const pdfFile = new MockFile([bytes], 'doc.pdf', { type: 'application/pdf' })
  const result = await validateImageFile(pdfFile)

  assert.equal(result.valid, false)
  assert.match(result.error, /غير مدعومة/)
})

test('Avatar Upload Validation: Magic bytes verification for JPEG', async () => {
  // Valid JPEG header: FF D8 FF E0
  const jpegBytes = new Uint8Array(1024)
  jpegBytes[0] = 0xFF
  jpegBytes[1] = 0xD8
  jpegBytes[2] = 0xFF
  jpegBytes[3] = 0xE0

  const validJpeg = new MockFile([jpegBytes], 'avatar.jpg', { type: 'image/jpeg' })
  const result = await validateImageFile(validJpeg)

  assert.equal(result.valid, true)
  assert.equal(result.format, 'jpeg')
})

test('Avatar Upload Validation: Magic bytes verification for PNG', async () => {
  // Valid PNG header: 89 50 4E 47 0D 0A 1A 0A
  const pngBytes = new Uint8Array(1024)
  const header = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]
  header.forEach((b, i) => { pngBytes[i] = b })

  const validPng = new MockFile([pngBytes], 'avatar.png', { type: 'image/png' })
  const result = await validateImageFile(validPng)

  assert.equal(result.valid, true)
  assert.equal(result.format, 'png')
})

test('Avatar Upload Validation: Magic bytes verification for WebP', async () => {
  // Valid WebP header: RIFF....WEBP
  const webpBytes = new Uint8Array(1024)
  webpBytes[0] = 0x52 // R
  webpBytes[1] = 0x49 // I
  webpBytes[2] = 0x46 // F
  webpBytes[3] = 0x46 // F
  // bytes 4-7: file size
  webpBytes[8] = 0x57  // W
  webpBytes[9] = 0x45  // E
  webpBytes[10] = 0x42 // B
  webpBytes[11] = 0x50 // P

  const validWebp = new MockFile([webpBytes], 'avatar.webp', { type: 'image/webp' })
  const result = await validateImageFile(validWebp)

  assert.equal(result.valid, true)
  assert.equal(result.format, 'webp')
})

test('Avatar Upload Validation: Rejects spoofed files (wrong magic bytes despite jpg extension)', async () => {
  // Corrupted or executable renamed to jpg
  const fakeBytes = new Uint8Array(1024)
  fakeBytes[0] = 0x4D // M
  fakeBytes[1] = 0x5A // Z (MZ executable header)

  const fakeJpeg = new MockFile([fakeBytes], 'spoofed.jpg', { type: 'image/jpeg' })
  const result = await validateImageFile(fakeJpeg)

  assert.equal(result.valid, false)
  assert.match(result.error, /محتوى الملف غير صالح/)
})
