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
 * - On desktop: Opens web.whatsapp.com directly (skipping the intermediate landing page).
 * - On mobile: Opens the native WhatsApp app via api.whatsapp.com/send.
 */
export function openManualWhatsAppChat({
  phone,
  message
}: {
  phone: string
  message: string
}): void {
  if (!phone) {
    toast.error('رقم هاتف المريض غير متوفر')
    return
  }
  const formattedPhone = formatEgyptianPhoneForWhatsApp(phone)
  const encodedText = encodeURIComponent(message)
  
  const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  const url = isMobile
    ? `https://api.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
    : `https://web.whatsapp.com/send?phone=${formattedPhone}&text=${encodedText}`
  
  window.open(url, '_blank')
}

/**
 * Handles professional sharing of documents and images (Prescriptions, Invoices, Reports).
 * - Directly targets recipient WhatsApp chat with their phone number.
 * - Copies high-res image to clipboard for instant (Ctrl + V) pasting in WhatsApp chat.
 * - Automatically downloads the file with the clean 'Rx_...' filename.
 */
export async function shareDocumentOrImage({
  blob,
  fileName,
  fileType = 'pdf',
  recipientPhone,
  messageText,
  documentTitle = 'المستند',
  imageBlobForClipboard
}: {
  blob: Blob
  fileName: string
  fileType?: 'pdf' | 'image'
  recipientPhone: string
  messageText: string
  documentTitle?: string
  imageBlobForClipboard?: Blob
}): Promise<void> {
  const mimeType = fileType === 'image' ? 'image/png' : 'application/pdf'
  const file = new File([blob], fileName, { type: mimeType })

  // 1. Desktop WhatsApp Web clipboard auto-copy:
  // If an image blob is provided or the file is an image, write to system clipboard!
  let copiedToClipboard = false
  const clipBlob = imageBlobForClipboard || (fileType === 'image' ? blob : null)
  
  if (clipBlob && typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': clipBlob })
      ])
      copiedToClipboard = true
    } catch (err) {
      console.warn('Clipboard write fallback/failed:', err)
    }
  }

  // 2. Download file directly with clean non-mojibake filename
  const downloadUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 30000)

  // 3. Open WhatsApp directly targeting the patient's phone number
  const extraNote = copiedToClipboard
    ? '\n\n(📋 تم نسخ صورة الروشتة للحافظة! الصقها مباشرة في المحادثة بـ Ctrl+V)'
    : '\n\n(📄 مرفق ملف الروشتة الرسمية تم تنزيله على جهازكم)'

  openManualWhatsAppChat({
    phone: recipientPhone,
    message: `${messageText}${extraNote}`
  })

  // 4. Show friendly guidance toast
  if (copiedToClipboard) {
    toast.success('تم فتح محادثة المريض وتنزيل الملف! اضغط (Ctrl + V) في الشات لإرسال صورة الروشتة فوراً 🚀', {
      duration: 8000
    })
  } else {
    toast.success(`تم فتح محادثة المريض (${recipientPhone}) وتنزيل ${fileName}! يمكنك سحب الملف للشات لإرساله.`, {
      duration: 8000
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

