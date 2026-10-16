import { toast } from 'sonner'

/**
 * Normalizes Egyptian phone number to standard international WhatsApp format:
 * e.g., '01012345678' -> '201012345678'
 */
export function formatEgyptianPhoneForWhatsApp(phone: string): string {
  let cleaned = String(phone || '').replace(/[^0-9]/g, '')
  if (cleaned.startsWith('002')) {
    cleaned = cleaned.substring(2)
  }
  if (cleaned.startsWith('+2')) {
    cleaned = cleaned.substring(1)
  }
  if (cleaned.startsWith('0')) {
    cleaned = '2' + cleaned
  }
  if (!cleaned.startsWith('2') && cleaned.length === 10) {
    cleaned = '20' + cleaned
  }
  return cleaned
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

/**
 * Opens WhatsApp Click-to-Chat directly targeting the recipient's phone number.
 * Supports:
 * - 'auto': Universal handler (api.whatsapp.com/send) which triggers WhatsApp Desktop if installed, or WhatsApp Web fallback, and native app on mobile.
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
  
  let url = ''
  if (isMobile) {
    url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
  } else if (target === 'app') {
    url = `whatsapp://send?phone=${formattedPhone}&text=${encodedText}`
  } else if (target === 'web') {
    url = `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
  } else {
    // Universal on desktop: triggers Desktop app if installed, with 1-click fallback to Web
    url = `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
  }
  
  try {
    const win = window.open(url, '_blank')
    return win
  } catch (err) {
    window.location.href = url
    return null
  }
}

/**
 * Formats a rich, professional e-prescription WhatsApp message.
 * Directly puts the entire prescription content (diagnosis, all medications with dosages,
 * duration, instructions, and certified official online link) right into the WhatsApp chat.
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
  drugs?: Array<{ name: string; dose?: string; duration?: string; notes?: string }>
  directRxUrl?: string
}): string {
  const parts: string[] = []

  parts.push(`🌿 *الروشتة الطبية الإلكترونية الرسمية*`)
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

  if (directRxUrl) {
    parts.push(`\n🔗 *رابط استعراض وتحميل الروشتة الأصلية المعتمدة:*\n${directRxUrl}`)
  }

  parts.push(`\nنتمنى لكم دوام الصحة والعافية والشفاء العاجل! 🌿`)

  return parts.join('\n')
}

/**
 * Handles professional sharing of documents and images (Prescriptions, Invoices, Reports).
 * - Opens WhatsApp chat directly targeting the recipient's phone number.
 * - Places full details inside the chat text.
 * - Copies high-res image to clipboard for instant (Ctrl + V) pasting in WhatsApp chat.
 * - Does NOT trigger browser file download unless downloadFile is explicitly set to true.
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
  // 1. Open WhatsApp directly targeting the patient's phone number (SYNCHRONOUS CALL)
  openManualWhatsAppChat({
    phone: recipientPhone,
    message: messageText,
    target
  })

  // 2. Desktop WhatsApp Web/App clipboard auto-copy:
  const clipBlob = imageBlobForClipboard || (fileType === 'image' ? blob : null)
  if (clipBlob && typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': clipBlob })
      ])
      toast.success('تم فتح المحادثة ونسخ صورة الروشتة! اضغط (Ctrl + V) في الشات لإرسال الصورة أيضاً 🚀', {
        duration: 8000
      })
    } catch (err) {
      console.warn('Clipboard write fallback/failed:', err)
      toast.success(`تم فتح محادثة المريض (${recipientPhone}) ببيانات الروشتة كاملة!`, {
        duration: 6000
      })
    }
  } else {
    toast.success(`تم فتح محادثة المريض (${recipientPhone}) ببيانات الروشتة كاملة!`, {
      duration: 6000
    })
  }

  // 3. ONLY download file if explicitly requested
  if (downloadFile && blob && fileName) {
    const downloadUrl = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = downloadUrl
    a.download = fileName
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 30000)
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
}): Promise<void> {
  return shareDocumentOrImage({
    blob: params.pdfBlob,
    fileName: params.fileName,
    fileType: 'pdf',
    recipientPhone: params.recipientPhone,
    messageText: params.messageText,
    documentTitle: params.documentTitle
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

