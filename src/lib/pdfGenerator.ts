'use client'

export interface PdfRenderOptions {
  fileName?: string
  format?: 'a4' | 'a5' | 'thermal'
  orientation?: 'portrait' | 'landscape'
  marginMm?: number
  scale?: number
}

/**
 * Robustly converts any image URL (local, relative, or external CDN) to a Base64 DataURL.
 * Employs a 3-tier fallback strategy:
 * 1. Direct CORS fetch
 * 2. Server-side /api/image-proxy
 * 3. In-memory Image element + Canvas draw
 */
async function convertImageUrlToBase64(url: string): Promise<string | null> {
  if (!url) return null
  if (url.startsWith('data:')) return url

  // Resolve relative URLs to full origin URLs
  let resolvedUrl = url
  if (url.startsWith('/') && typeof window !== 'undefined') {
    resolvedUrl = new URL(url, window.location.origin).href
  }

  // Tier 1: Direct CORS fetch
  try {
    const res = await fetch(resolvedUrl, { mode: 'cors' })
    if (res.ok) {
      const blob = await res.blob()
      return await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    }
  } catch {}

  // Tier 2: Server-side proxy
  try {
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(resolvedUrl)}`
    const res = await fetch(proxyUrl)
    if (res.ok) {
      const blob = await res.blob()
      return await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => resolve(reader.result as string)
        reader.readAsDataURL(blob)
      })
    }
  } catch {}

  // Tier 3: In-memory Canvas
  if (typeof window !== 'undefined') {
    try {
      return await new Promise<string | null>((resolve) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => {
          try {
            const canvas = document.createElement('canvas')
            canvas.width = img.naturalWidth || img.width || 100
            canvas.height = img.naturalHeight || img.height || 100
            const ctx = canvas.getContext('2d')
            if (ctx) {
              ctx.drawImage(img, 0, 0)
              resolve(canvas.toDataURL('image/png'))
              return
            }
          } catch {}
          resolve(null)
        }
        img.onerror = () => resolve(null)
        img.src = resolvedUrl
      })
    } catch {}
  }

  return null
}

/**
 * Pre-converts any external images inside the target element into inline Base64 DataURLs.
 */
async function inlineImagesAsBase64(element: HTMLElement): Promise<void> {
  // 1. Process <img> elements
  const imgs = Array.from(element.querySelectorAll('img'))
  for (const img of imgs) {
    const src = img.getAttribute('src')
    if (src && !src.startsWith('data:') && !src.startsWith('blob:')) {
      const dataUrl = await convertImageUrlToBase64(src)
      if (dataUrl) {
        img.setAttribute('src', dataUrl)
      } else {
        img.crossOrigin = 'anonymous'
      }
    }
  }

  // 2. Process background-image elements
  const bgElements = Array.from(element.querySelectorAll<HTMLElement>('*')).filter(
    (el) => el.style && el.style.backgroundImage && el.style.backgroundImage.includes('url(')
  )
  if (element.style && element.style.backgroundImage && element.style.backgroundImage.includes('url(')) {
    bgElements.push(element)
  }

  for (const el of bgElements) {
    const match = el.style.backgroundImage.match(/url\(["']?(.*?)["']?\)/)
    if (match && match[1] && !match[1].startsWith('data:') && !match[1].startsWith('blob:')) {
      const dataUrl = await convertImageUrlToBase64(match[1])
      if (dataUrl) {
        el.style.backgroundImage = `url("${dataUrl}")`
      }
    }
  }
}

/**
 * Sanitizes all computed styles and element properties in clonedDoc from modern CSS
 * color spaces (lab, oklab, oklch, lch, color-mix) into standard RGBA.
 * Prevents html2canvas from throwing: Attempting to parse an unsupported color function "lab"
 */
function sanitizeColorsToRgb(clonedDoc: Document, clonedEl: HTMLElement) {
  const win = clonedDoc.defaultView || window
  let dummyCanvas: HTMLCanvasElement | null = null
  let ctx: CanvasRenderingContext2D | null = null

  function toSafeRgb(colorStr: string): string {
    if (!colorStr) return colorStr
    if (
      !colorStr.includes('lab') &&
      !colorStr.includes('oklab') &&
      !colorStr.includes('oklch') &&
      !colorStr.includes('lch') &&
      !colorStr.includes('color(') &&
      !colorStr.includes('color-mix')
    ) {
      return colorStr
    }

    try {
      if (!dummyCanvas && typeof document !== 'undefined') {
        dummyCanvas = document.createElement('canvas')
        dummyCanvas.width = 1
        dummyCanvas.height = 1
        ctx = dummyCanvas.getContext('2d', { willReadFrequently: true })
      }
      if (ctx) {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillStyle = colorStr
        ctx.fillRect(0, 0, 1, 1)
        const [r, g, b, a] = ctx.getImageData(0, 0, 1, 1).data
        return `rgba(${r}, ${g}, ${b}, ${+(a / 255).toFixed(3)})`
      }
    } catch {}
    return 'rgba(0,0,0,1)'
  }

  const colorProperties = [
    'color',
    'backgroundColor',
    'borderColor',
    'borderTopColor',
    'borderRightColor',
    'borderBottomColor',
    'borderLeftColor',
    'outlineColor',
    'textDecorationColor'
  ]

  const allNodes = [clonedEl, ...Array.from(clonedEl.querySelectorAll<HTMLElement>('*'))]
  for (const node of allNodes) {
    if (!node || !node.style) continue
    try {
      const computed = win.getComputedStyle(node)
      for (const prop of colorProperties) {
        const val = computed.getPropertyValue(prop)
        if (
          val &&
          (val.includes('lab') ||
            val.includes('oklab') ||
            val.includes('oklch') ||
            val.includes('lch') ||
            val.includes('color(') ||
            val.includes('color-mix'))
        ) {
          node.style[prop as any] = toSafeRgb(val)
        }
      }
    } catch {}
  }

  // Also wrap getComputedStyle on clonedDoc.defaultView so html2canvas color parser only receives safe RGBA
  if (win && win.getComputedStyle) {
    const origGetComputedStyle = win.getComputedStyle.bind(win)
    win.getComputedStyle = function(el: Element, pseudo?: string | null) {
      const cs = origGetComputedStyle(el, pseudo)
      return new Proxy(cs, {
        get(target, prop) {
          if (prop === 'getPropertyValue') {
            return function(propName: string) {
              const val = target.getPropertyValue(propName)
              if (
                val &&
                (val.includes('lab') ||
                  val.includes('oklab') ||
                  val.includes('oklch') ||
                  val.includes('lch') ||
                  val.includes('color(') ||
                  val.includes('color-mix'))
              ) {
                return toSafeRgb(val)
              }
              return val
            }
          }
          const val = (target as any)[prop]
          if (
            typeof val === 'string' &&
            (val.includes('lab') ||
              val.includes('oklab') ||
              val.includes('oklch') ||
              val.includes('lch') ||
              val.includes('color(') ||
              val.includes('color-mix'))
          ) {
            return toSafeRgb(val)
          }
          if (typeof val === 'function') {
            return val.bind(target)
          }
          return val
        }
      })
    }
  }
}

/**
 * Captures an element using html2canvas safely with inlined Base64 images and isolated dimensions.
 * GUARANTEES allowTaint = false so canvas.toDataURL() and canvas.toBlob() NEVER throw SecurityError.
 */
async function captureElementCanvas(element: HTMLElement, scale: number = 2.5): Promise<HTMLCanvasElement> {
  const { default: html2canvas } = await import('html2canvas')

  // Target inner sheet if element is a wrapper
  const targetSheet = (element.querySelector('#patient-a4-print-sheet') as HTMLElement) || element

  try {
    await inlineImagesAsBase64(targetSheet)
  } catch (e) {
    console.warn('Image inlining step skipped:', e)
  }

  try {
    return await html2canvas(targetSheet, {
      scale: Math.min(scale, 2.5),
      useCORS: true,
      allowTaint: false, // NEVER allow taint to ensure toDataURL & toBlob succeed
      logging: false,
      backgroundColor: '#ffffff',
      foreignObjectRendering: false,
      windowWidth: 1200,
      onclone: (clonedDoc, clonedEl) => {
        // Universal color sanitization to neutralize any Tailwind 4 lab/oklab colors
        sanitizeColorsToRgb(clonedDoc, clonedEl)

        const sheet = (clonedEl.querySelector('#patient-a4-print-sheet') || clonedEl) as HTMLElement
        const isA5 = sheet.classList?.contains('max-w-[560px]') || sheet.innerText?.includes('A5')

        const targetWidth = isA5 ? 560 : 794
        const targetHeight = isA5 ? 794 : 1123

        clonedEl.style.width = `${targetWidth}px`
        clonedEl.style.maxWidth = 'none'
        clonedEl.style.boxShadow = 'none'
        clonedEl.style.borderRadius = '0px'
        clonedEl.style.overflow = 'visible'

        if (sheet) {
          sheet.style.width = `${targetWidth}px`
          sheet.style.minHeight = `${targetHeight}px`
          sheet.style.maxWidth = 'none'
          sheet.style.aspectRatio = 'auto' // Remove aspect-[1/1.414] so height is computed accurately
          sheet.style.boxShadow = 'none'
          sheet.style.border = 'none'
          sheet.style.borderRadius = '0px'
          sheet.style.transform = 'none'
          sheet.style.margin = '0px'
        }

        // Clean out print media stylesheets that might interfere with canvas rasterization
        const styleTags = Array.from(clonedDoc.querySelectorAll('style'))
        styleTags.forEach((s) => {
          if (s.innerHTML.includes('@page') || s.innerHTML.includes('@media print')) {
            s.remove()
          }
        })

        // Safety: hide any remaining remote image that could not be inlined and might taint canvas
        const clonedImgs = Array.from(clonedEl.querySelectorAll('img'))
        clonedImgs.forEach((img) => {
          if (!img.src.startsWith('data:') && !img.src.startsWith('blob:')) {
            if (typeof window !== 'undefined' && !img.src.startsWith(window.location.origin)) {
              img.style.display = 'none'
            }
          }
        })
      }
    })
  } catch (primaryErr) {
    console.warn('Primary html2canvas capture failed, falling back to isolated clone:', primaryErr)

    // Fallback: Clone to isolated clean container
    const clone = targetSheet.cloneNode(true) as HTMLElement
    const container = document.createElement('div')
    container.style.position = 'fixed'
    container.style.top = '-9999px'
    container.style.left = '-9999px'
    container.style.width = '794px'
    container.style.background = '#ffffff'
    container.style.zIndex = '-9999'
    container.appendChild(clone)
    document.body.appendChild(container)

    try {
      sanitizeColorsToRgb(document, container)
      return await html2canvas(container, {
        scale: 2.0,
        useCORS: true,
        allowTaint: false,
        backgroundColor: '#ffffff',
        logging: false
      })
    } finally {
      if (container.parentNode) {
        document.body.removeChild(container)
      }
    }
  }
}

/**
 * High-fidelity Client-Side PDF Renderer for Yalla Clinic
 * Uses dynamic imports for html2canvas & jsPDF for maximum performance.
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
