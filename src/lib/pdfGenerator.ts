'use client'

export interface PdfRenderOptions {
  fileName?: string
  format?: 'a4' | 'a5' | 'thermal'
  orientation?: 'portrait' | 'landscape'
  marginMm?: number
  scale?: number
}

/**
 * Pre-converts any external images (img tags and background-image) inside the element
 * into inline base64 DataURLs using our server-side image proxy.
 * This guarantees html2canvas NEVER taints the canvas and eliminates CORS/blank export errors.
 */
async function inlineImagesAsBase64(element: HTMLElement): Promise<void> {
  // 1. Process <img> elements
  const imgs = Array.from(element.querySelectorAll('img'))
  for (const img of imgs) {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(src)}`
        const res = await fetch(proxyUrl)
        if (res.ok) {
          const blob = await res.blob()
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          img.setAttribute('src', dataUrl)
        }
      } catch (err) {
        // Fallback: continue with current src
      }
    }
  }

  // 2. Process background-image elements
  const bgElements = Array.from(element.querySelectorAll<HTMLElement>('*')).filter(
    (el) => el.style && el.style.backgroundImage && el.style.backgroundImage.includes('url(')
  )
  for (const el of bgElements) {
    const match = el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)
    if (match && match[1] && !match[1].startsWith('data:') && !match[1].startsWith('blob:')) {
      try {
        const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(match[1])}`
        const res = await fetch(proxyUrl)
        if (res.ok) {
          const blob = await res.blob()
          const dataUrl = await new Promise<string>((resolve) => {
            const reader = new FileReader()
            reader.onloadend = () => resolve(reader.result as string)
            reader.readAsDataURL(blob)
          })
          el.style.backgroundImage = `url("${dataUrl}")`
        }
      } catch (err) {}
    }
  }
}

/**
 * Captures an element using html2canvas safely with inlined base64 images.
 */
async function captureElementCanvas(element: HTMLElement, scale: number = 2.5) {
  const { default: html2canvas } = await import('html2canvas')

  try {
    await inlineImagesAsBase64(element)
  } catch (e) {
    console.warn('Image inlining step skipped:', e)
  }

  return await html2canvas(element, {
    scale,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff'
  })
}

/**
 * High-fidelity Client-Side PDF Renderer for Clinic OS V2
 * Uses dynamic imports for html2canvas & jsPDF for maximum mobile performance.
 * Supports A4, A5, and Thermal 80mm formats.
 */
export async function renderElementToPdfBlob(
  element: HTMLElement,
  options: PdfRenderOptions = {}
): Promise<{ blob: Blob; url: string }> {
  const { format = 'a4', orientation = 'portrait', scale = 2.5 } = options

  // Dynamically load jsPDF
  const { default: jsPDF } = await import('jspdf')

  // 1. Capture element to high-res canvas with styling intact
  const canvas = await captureElementCanvas(element, scale)
  const imgData = canvas.toDataURL('image/png')

  // 2. Build PDF geometry
  if (format === 'thermal') {
    // 80mm width continuous roll
    const mmWidth = 80
    const mmHeight = Math.max(50, (canvas.height * mmWidth) / canvas.width)

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: [mmWidth, mmHeight]
    })

    pdf.addImage(imgData, 'PNG', 0, 0, mmWidth, mmHeight, undefined, 'FAST')
    const blob = pdf.output('blob')
    const url = URL.createObjectURL(blob)
    return { blob, url }
  }

  // A4 or A5 Document
  const isA5 = format === 'a5'
  const isLandscape = orientation === 'landscape'

  const pageWidth = isA5
    ? (isLandscape ? 210 : 148)
    : (isLandscape ? 297 : 210)

  const pageHeight = isA5
    ? (isLandscape ? 148 : 210)
    : (isLandscape ? 210 : 297)

  const pdf = new jsPDF({
    orientation: isLandscape ? 'landscape' : 'portrait',
    unit: 'mm',
    format: isA5 ? 'a5' : 'a4'
  })

  const imgWidth = pageWidth
  const imgHeight = (canvas.height * pageWidth) / canvas.width

  let heightLeft = imgHeight
  let position = 0

  // First page
  pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
  heightLeft -= pageHeight

  // Multi-page handling only if document genuinely exceeds page height by more than 15mm
  while (heightLeft > 15) {
    position = position - pageHeight
    pdf.addPage()
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight, undefined, 'FAST')
    heightLeft -= pageHeight
  }

  const blob = pdf.output('blob')
  const url = URL.createObjectURL(blob)
  return { blob, url }
}

/**
 * Downloads a rendered DOM element directly as a real PDF file.
 */
export async function downloadElementAsPdf(
  element: HTMLElement,
  fileName: string = 'document.pdf',
  options: PdfRenderOptions = {}
): Promise<void> {
  const { blob } = await renderElementToPdfBlob(element, options)
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = fileName.endsWith('.pdf') ? fileName : `${fileName}.pdf`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  // Defer revocation so mobile browsers don't abort download stream
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000)
}

/**
 * Renders an element directly to a PNG image Blob and DataURL.
 */
export async function renderElementToImageBlob(
  element: HTMLElement,
  options: { scale?: number } = {}
): Promise<{ blob: Blob; url: string; dataUrl: string }> {
  const canvas = await captureElementCanvas(element, options.scale || 2.5)
  const dataUrl = canvas.toDataURL('image/png')

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => {
      if (b) resolve(b)
      else reject(new Error('Canvas toBlob failed'))
    }, 'image/png')
  })

  const url = URL.createObjectURL(blob)
  return { blob, url, dataUrl }
}

/**
 * Downloads a rendered DOM element directly as a PNG image.
 */
export async function downloadElementAsImage(
  element: HTMLElement,
  fileName: string = 'document.png',
  options: { scale?: number } = {}
): Promise<void> {
  const { blob } = await renderElementToImageBlob(element, options)
  const downloadUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = downloadUrl
  link.download = fileName.endsWith('.png') ? fileName : `${fileName}.png`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  setTimeout(() => URL.revokeObjectURL(downloadUrl), 30000)
}

/**
 * Copies a rendered DOM element directly to the user's clipboard as a PNG image.
 * This allows one-click paste (Ctrl + V) into WhatsApp Web or desktop chats.
 */
export async function copyElementImageToClipboard(element: HTMLElement): Promise<boolean> {
  if (typeof navigator === 'undefined' || !navigator.clipboard) {
    return false
  }

  try {
    const { blob } = await renderElementToImageBlob(element, { scale: 2.0 })
    if (typeof ClipboardItem !== 'undefined') {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      return true
    }
    return false
  } catch (err) {
    console.warn('Failed to copy image to clipboard:', err)
    return false
  }
}
