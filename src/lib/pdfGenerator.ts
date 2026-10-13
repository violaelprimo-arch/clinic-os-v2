'use client'

export interface PdfRenderOptions {
  fileName?: string
  format?: 'a4' | 'a5' | 'thermal'
  orientation?: 'portrait' | 'landscape'
  marginMm?: number
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
  const { format = 'a4', orientation = 'portrait' } = options

  // Dynamically load html2canvas and jsPDF only when actually generating PDF
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
    import('html2canvas'),
    import('jspdf')
  ])

  // 1. Capture element to high-res canvas with styling intact
  const canvas = await html2canvas(element, {
    scale: 2.5,
    useCORS: true,
    allowTaint: true,
    logging: false,
    backgroundColor: '#ffffff'
  })

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
  URL.revokeObjectURL(downloadUrl)
}
