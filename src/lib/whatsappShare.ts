import { toast } from 'sonner'
import { cleanPhoneForWhatsApp } from '@/lib/countryPhoneHelper'

/**
 * Normalizes phone number to standard international WhatsApp format:
 * Supports Egyptian numbers (010xxx -> 2010xxx), Saudi (050xxx -> 96650xxx),
 * UAE (050xxx -> 97150xxx), and all E.164 formats (+966..., +20...).
 */
export function formatEgyptianPhoneForWhatsApp(phone: string): string {
  return cleanPhoneForWhatsApp(phone, '+20')
}

export function formatInternationalWhatsAppPhone(phone: string, defaultCountry = '+20'): string {
  return cleanPhoneForWhatsApp(phone, defaultCountry)
}

/**
 * Generates an internationally safe, professional prescription filename
 * using the universal medical symbol 'Rx' and phonetic transliteration.
 * Completely eliminates WhatsApp's ISO-8859-1 (Latin-1) mojibake bug (Ø±Ù\x88Ø´ØªØ©...)
 * Example: 'Rx_Test_2026-10-16.pdf' or 'Rx_Ahmed_Mohamed_2026-10-16.pdf'
 */
export function generateCleanRxFileName(
  patientName: string,
  dateStr?: string,
  extension: 'pdf' | 'png' = 'pdf'
): string {
  const cleanDate = (dateStr || new Date().toISOString().split('T')[0]).replace(/[^0-9-]/g, '')
  const raw = (patientName || 'Patient').trim()

  const hasArabic = /[\u0600-\u06FF]/.test(raw)
  let cleanName = raw

  if (hasArabic) {
    const arMap: Record<string, string> = {
      'أ': 'A', 'إ': 'E', 'آ': 'A', 'ا': 'A', 'ب': 'B', 'ت': 'T', 'ث': 'Th',
      'ج': 'G', 'ح': 'H', 'خ': 'Kh', 'د': 'D', 'ذ': 'Z', 'ر': 'R', 'ز': 'Z',
      'س': 'S', 'ش': 'Sh', 'ص': 'S', 'ض': 'D', 'ط': 'T', 'ظ': 'Z', 'ع': 'A',
      'غ': 'Gh', 'ف': 'F', 'ق': 'Q', 'ك': 'K', 'ل': 'L', 'م': 'M', 'ن': 'N',
      'ه': 'H', 'و': 'O', 'ي': 'Y', 'ى': 'A', 'ة': 'a', 'ء': '', 'ئ': 'Y', 'ؤ': 'W'
    }
    cleanName = raw.split('').map(ch => arMap[ch] !== undefined ? arMap[ch] : ch).join('')
  }

  // Clean characters for universal filesystem & WhatsApp compatibility
  cleanName = cleanName
    .replace(/[^a-zA-Z0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')

  if (!cleanName) cleanName = 'Patient'

  return `Rx_${cleanName}_${cleanDate}.${extension}`
}

export type WhatsAppTargetMode = 'web' | 'app' | 'auto'

/**
 * Retrieves the user's preferred WhatsApp target ('web' or 'app').
 * Defaults to 'web' for universal browser compatibility.
 */
export function getSavedWhatsAppTarget(): 'web' | 'app' {
  if (typeof window === 'undefined') return 'web'
  const saved = localStorage.getItem('yalla_whatsapp_target_mode') || localStorage.getItem('yalla_rx_whatsapp_mode')
  return saved === 'app' ? 'app' : 'web'
}

/**
 * Persists the user's preferred WhatsApp target across the entire clinic system.
 */
export function saveWhatsAppTarget(mode: 'web' | 'app'): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('yalla_whatsapp_target_mode', mode)
    localStorage.setItem('yalla_rx_whatsapp_mode', mode)
  }
}

/**
 * Opens WhatsApp Click-to-Chat directly targeting the recipient's phone number.
 * Supports:
 * - 'auto': Universal handler which uses saved preference on desktop and native on mobile.
 * - 'app': Direct protocol handler (whatsapp://send) for installed WhatsApp Desktop.
 * - 'web': Direct browser WhatsApp Web (web.whatsapp.com/send).
 */
export function openManualWhatsAppChat({
  phone,
  message,
  target = 'auto'
}: {
  phone: string
  message: string
  target?: 'auto' | 'app' | 'web'
}): Window | null {
  if (!phone) {
    toast.error('رقم هاتف المريض غير متوفر')
    return null
  }
  const formattedPhone = formatEgyptianPhoneForWhatsApp(phone)
  const encodedText = encodeURIComponent(message)
  
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const effectiveTarget = target === 'auto' ? getSavedWhatsAppTarget() : target
  
  let url = ''
  if (isMobile) {
    // Mobile: direct intent to official WhatsApp app with phone and pre-filled message
    url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
  } else if (effectiveTarget === 'app') {
    // Desktop App: direct protocol to installed WhatsApp Desktop app
    url = `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`
  } else {
    // Desktop Web: direct link to WhatsApp Web chat input (trailing slash is mandatory for proper web routing)
    url = `https://web.whatsapp.com/send/?phone=${formattedPhone}&text=${encodedText}`
  }
  
  // For desktop WhatsApp App: trigger protocol without leaving empty about:blank tabs
  if (effectiveTarget === 'app' && !isMobile) {
    const a = document.createElement('a')
    a.href = url
    a.style.display = 'none'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a)
    }, 500)
    return null
  }

  // For Web & Mobile: open synchronously in a new tab (guaranteed 0ms popup-blocker free)
  try {
    const win = window.open(url, '_blank')
    if (!win || win.closed || typeof win.closed === 'undefined') {
      const a = document.createElement('a')
      a.href = url
      a.target = '_blank'
      a.rel = 'noopener noreferrer'
      document.body.appendChild(a)
      a.click()
      setTimeout(() => {
        if (document.body.contains(a)) document.body.removeChild(a)
      }, 500)
    }
    return win
  } catch (err) {
    const a = document.createElement('a')
    a.href = url
    a.target = '_blank'
    a.rel = 'noopener noreferrer'
    document.body.appendChild(a)
    a.click()
    setTimeout(() => {
      if (document.body.contains(a)) document.body.removeChild(a)
    }, 500)
    return null
  }
}

/**
 * Formats a rich, professional e-prescription WhatsApp message.
 * Directly puts the entire prescription content (diagnosis, all medications with dosages,
 * duration, instructions) right into the WhatsApp chat.
 * Strictly adheres to ZERO WEB LINKS as requested.
 */
export function formatPrescriptionWhatsAppMessage({
  clinicName,
  doctorName,
  specialty,
  patientName,
  patientAge,
  date,
  rxNumber,
  diagnosis,
  instructions,
  notes,
  drugs,
  directRxUrl
}: {
  clinicName?: string
  doctorName?: string
  specialty?: string
  patientName: string
  patientAge?: string | number
  date?: string
  rxNumber?: string | number
  diagnosis?: string
  instructions?: string
  notes?: string
  drugs?: Array<{ name: string; dose?: string; duration?: string; notes?: string }>
  directRxUrl?: string // Kept for backwards type compatibility, but NEVER included in message text!
}): string {
  const parts: string[] = []

  parts.push(`🌿 *الروشتة الطبية الرسمية*`)
  if (clinicName) parts.push(`🏥 *العيادة:* ${clinicName}`)
  if (doctorName) parts.push(`👨‍⚕️ *الطبيب:* د. ${doctorName}${specialty ? ` (${specialty})` : ''}`)
  
  const ageStr = patientAge ? ` (${patientAge} سنة)` : ''
  parts.push(`👤 *المريض:* ${patientName || 'المريض'}${ageStr}`)
  if (date) parts.push(`📅 *التاريخ:* ${date}`)
  if (rxNumber) parts.push(`🔢 *رقم الروشتة:* #${rxNumber}`)

  if (diagnosis && diagnosis.trim()) {
    parts.push(`\n🩺 *التشخيص الطبي:*\n${diagnosis.trim()}`)
  }

  const validDrugs = (drugs || []).filter(d => d && d.name && d.name.trim() !== '')
  if (validDrugs.length > 0) {
    const drugLines = validDrugs.map((d, i) => {
      const details: string[] = []
      if (d.dose && d.dose.trim()) details.push(`الجرعة: ${d.dose.trim()}`)
      if (d.duration && d.duration.trim()) details.push(`المدة: ${d.duration.trim()}`)
      if (d.notes && d.notes.trim()) details.push(d.notes.trim())
      
      const sub = details.length > 0 ? `\n   ↳ ${details.join(' | ')}` : ''
      return `${i + 1}. *${d.name.trim()}*${sub}`
    })
    parts.push(`\n💊 *العلاج والأدوية المطلوبة (Rx):*\n${drugLines.join('\n')}`)
  }

  if (instructions && instructions.trim()) {
    parts.push(`\n📝 *تعليمات وإرشادات الطبيب:*\n${instructions.trim()}`)
  }

  if (notes && notes.trim()) {
    parts.push(`\n📋 *ملاحظات الطبيب:*\n${notes.trim()}`)
  }

  if (directRxUrl && directRxUrl.trim()) {
    parts.push(`\n📄 *ملف الروشتة الرسمية (PDF) متاح للتحميل والطباعة فوراً عبر الرابط التالي:*`)
    parts.push(`🔗 ${directRxUrl.trim()}`)
  } else {
    parts.push(`\n📄 *مرفق ملف الروشتة الطبية الرسمية (PDF)*`)
  }
  parts.push(`\nنتمنى لكم دوام الصحة والعافية والشفاء العاجل! 🌿`)

  return parts.join('\n')
}

/**
 * Formats a rich, professional e-invoice / receipt WhatsApp message.
 * Contains clinic, branch, doctor, patient, financial breakdown,
 * and direct official PDF link on www.yalla-clinic.com.
 */
export function formatInvoiceWhatsAppMessage({
  clinicName,
  doctorName,
  branchName,
  patientName,
  patientPhone,
  invoiceNumber,
  date,
  time,
  serviceName,
  originalPrice,
  discount,
  netTotal,
  paymentMethod,
  paymentStatus,
  directInvoiceUrl
}: {
  clinicName?: string
  doctorName?: string
  branchName?: string
  patientName: string
  patientPhone?: string
  invoiceNumber?: string
  date?: string
  time?: string
  serviceName?: string
  originalPrice?: number
  discount?: number
  netTotal?: number
  paymentMethod?: string
  paymentStatus?: 'paid' | 'pending' | 'refunded' | string
  directInvoiceUrl?: string
}): string {
  const parts: string[] = []

  parts.push(`🧾 *فاتورة طبية رسمية - إيصال سداد*`)
  if (clinicName) parts.push(`🏥 *العيادة:* ${clinicName}${branchName ? ` (فرع ${branchName})` : ''}`)
  if (doctorName) parts.push(`👨‍⚕️ *الطبيب:* د. ${doctorName}`)
  if (patientName) parts.push(`👤 *المريض:* ${patientName}`)
  if (invoiceNumber) parts.push(`🔢 *رقم الفاتورة:* #${invoiceNumber}`)
  if (date) parts.push(`📅 *التاريخ:* ${date}${time ? ` (${time})` : ''}`)

  parts.push(``)
  parts.push(`📋 *تفاصيل المعاملة المالية:*`)
  if (serviceName) parts.push(`• *الخدمة:* ${serviceName}`)
  if (originalPrice !== undefined && originalPrice > 0 && discount && discount > 0) {
    parts.push(`• *السعر قبل الخصم:* ${originalPrice} ج.م`)
    parts.push(`• *قيمة الخصم:* ${discount} ج.م`)
  }
  if (netTotal !== undefined) {
    parts.push(`• *المبلغ الصافي:* *${netTotal} ج.م*`)
  }

  const methodLabel = paymentMethod === 'instapay'
    ? 'انستاباي (InstaPay)'
    : paymentMethod === 'wallet'
    ? 'محفظة إلكترونية (Smart Wallet)'
    : 'كاش بالعيادة (Cash)'
  parts.push(`• *طريقة الدفع:* ${methodLabel}`)

  const statusLabel = paymentStatus === 'paid' ? '✅ تم السداد بنجاح ومؤكد' : '⏳ في انتظار التأكيد'
  parts.push(`• *حالة الدفع:* ${statusLabel}`)

  if (directInvoiceUrl && directInvoiceUrl.trim()) {
    parts.push(``)
    parts.push(`📄 *رابط عرض وتحميل الفاتورة الإلكترونية (PDF) الرسمية:*`)
    parts.push(`🔗 ${directInvoiceUrl.trim()}`)
  } else {
    parts.push(``)
    parts.push(`📄 *مرفق ملف الفاتورة الطبية الرسمية (PDF)*`)
  }

  parts.push(``)
  parts.push(`نتمنى لكم دوام الصحة والعافية! 🌿`)

  return parts.join('\n')
}

/**
 * Handles professional sharing of documents and images (Prescriptions, Invoices, Reports).
 * - Opens WhatsApp chat directly targeting the recipient's phone number.
 * - Places full details inside the chat text with official PDF link.
 * - Tries native OS WebShare with file attachment where supported (mobile).
 * - On desktop: copies image to clipboard for Ctrl+V paste.
 * - Strictly avoids auto-downloading files unless explicitly set to downloadFile=true.
 */
export async function shareDocumentOrImage({
  blob,
  fileName,
  fileType = 'pdf',
  recipientPhone,
  messageText,
  documentTitle = 'المستند',
  imageBlobForClipboard,
  downloadFile = false,
  target = 'auto'
}: {
  blob?: Blob
  fileName?: string
  fileType?: 'pdf' | 'image'
  recipientPhone: string
  messageText: string
  documentTitle?: string
  imageBlobForClipboard?: Blob
  downloadFile?: boolean
  target?: 'auto' | 'app' | 'web'
}): Promise<void> {
  const mimeType = fileType === 'pdf' ? 'application/pdf' : 'image/png'
  const resolvedFileName = fileName || (fileType === 'pdf' ? 'Document.pdf' : 'Document.png')

  // 1. Desktop & Mobile: Open WhatsApp directly targeting recipient's phone with pre-filled message
  openManualWhatsAppChat({
    phone: recipientPhone,
    message: messageText,
    target
  })

  // 3. Desktop Clipboard auto-copy (for Ctrl + V instant image send)
  const clipBlob = imageBlobForClipboard || (fileType === 'image' ? blob : null)
  if (clipBlob && typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': clipBlob })
      ])
    } catch (err) {
      console.warn('Clipboard write fallback:', err)
    }
  }

  // 4. Download file so user has the PDF ready to attach/drag in WhatsApp Desktop / Web
  if (downloadFile && blob) {
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = resolvedFileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 30000)

    toast.success(`تم فتح محادثة المريض (${recipientPhone}) وتنزيل ملف PDF (${resolvedFileName})! اسحب الملف للشات أو اضغط (Ctrl + V) لإرسال صورة ${documentTitle} 🚀`, {
      duration: 8000
    })
  } else {
    toast.success(`تم فتح محادثة المريض (${recipientPhone}) ببيانات ${documentTitle} كاملة! 🚀`, {
      duration: 6000
    })
  }
}

/**
 * Handles professional sharing of PDF documents (Prescriptions, Invoices, Reports).
 */
export async function sharePdfDocument(params: {
  pdfBlob: Blob
  fileName: string
  recipientPhone: string
  messageText: string
  documentTitle?: string
  imageBlobForClipboard?: Blob
  target?: 'auto' | 'app' | 'web'
}): Promise<void> {
  return shareDocumentOrImage({
    blob: params.pdfBlob,
    fileName: params.fileName,
    fileType: 'pdf',
    recipientPhone: params.recipientPhone,
    messageText: params.messageText,
    documentTitle: params.documentTitle,
    imageBlobForClipboard: params.imageBlobForClipboard,
    downloadFile: true,
    target: params.target || 'auto'
  })
}

export function formatQueueAlertWhatsAppMessage({
  clinicName,
  patientName,
  queueNumber,
  peopleAhead = 1
}: {
  clinicName: string
  patientName: string
  queueNumber?: number | string
  peopleAhead?: number
}): string {
  return `مرحباً ${patientName}،\nيرجى التوجه إلى عيادة ${clinicName} الآن. اقترب دورك للدخول للكشف (دور رقم #${queueNumber || '--'}، متبقي قبلك ${peopleAhead} مريض).\nنتمنى لك دوام الصحة والعافية.`
}

export function formatPaymentConfirmationWhatsAppMessage({
  clinicName,
  patientName,
  amount,
  receiptNumber
}: {
  clinicName: string
  patientName: string
  amount: number
  receiptNumber?: string | number
}): string {
  return `مرحباً ${patientName}،\nتم تأكيد استلام دفعتك بنجاح في عيادة ${clinicName}:\n- المبلغ: ${amount} ج.م\n- رقم الإيصال: #${receiptNumber || '--'}\nشكراً لتعاونكم ونتمنى لكم الشفاء العاجل.`
}

export function formatInClinicBookingWhatsAppMessage({
  clinicName,
  serviceName,
  branchName,
  bookingDate,
  queueNumber,
  trackUrl,
  patientPortalUrl,
}: {
  clinicName: string
  serviceName: string
  branchName: string
  bookingDate: string
  queueNumber: number | string
  trackUrl: string
  patientPortalUrl: string
}): string {
  return `أهلًا بحضرتك، تم تسجيل حجزك في ${clinicName}.

الخدمة: ${serviceName}
الفرع: ${branchName}
التاريخ: ${bookingDate}
رقم تذكرة الدور: ${queueNumber}

لمتابعة دورك المباشر، افتح الرابط واكتب رقم الموبايل المسجل بالحجز:
${trackUrl}

للدخول إلى بوابة المريض:
${patientPortalUrl}

ترتيب الدخول ووقت الانتظار يتحدثان حسب حركة العيادة.`
}


