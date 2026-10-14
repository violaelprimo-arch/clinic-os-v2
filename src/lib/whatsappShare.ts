import { toast } from 'sonner'

/**
 * Normalizes Egyptian phone number to standard international WhatsApp format:
 * e.g., '01012345678' -> '201012345678'
 */
export function formatEgyptianPhoneForWhatsApp(phone: string): string {
  let cleaned = phone.replace(/[^0-9]/g, '')
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
 * Opens WhatsApp Click-to-Chat with prefilled message text.
 * Requires user to press send in their WhatsApp application.
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
  const url = `https://wa.me/${formattedPhone}?text=${encodedText}`
  window.open(url, '_blank')
}

/**
 * Handles professional sharing of documents and images (Prescriptions, Invoices, Reports).
 * - On supported platforms (mobile & modern browsers): Uses Web Share API with files directly into WhatsApp.
 * - On desktop: Copies image to clipboard (for instant Ctrl+V in WhatsApp Web), downloads file, and opens chat.
 */
export async function shareDocumentOrImage({
  blob,
  fileName,
  fileType = 'pdf',
  recipientPhone,
  messageText,
  documentTitle = 'المستند'
}: {
  blob: Blob
  fileName: string
  fileType?: 'pdf' | 'image'
  recipientPhone: string
  messageText: string
  documentTitle?: string
}): Promise<void> {
  const mimeType = fileType === 'image' ? 'image/png' : 'application/pdf'
  const file = new File([blob], fileName, { type: mimeType })

  // 1. Try Native Web Share API if supported (Mobile phones / modern Web Share)
  if (
    typeof navigator !== 'undefined' &&
    navigator.canShare &&
    navigator.canShare({ files: [file] })
  ) {
    try {
      await navigator.share({
        title: documentTitle,
        text: messageText,
        files: [file]
      })
      toast.info('تم فتح خيارات المشاركة، يرجى اختيار جهة الاتصال في واتساب')
      return
    } catch (err: any) {
      if (err.name === 'AbortError') {
        return
      }
      console.warn('Web Share API failed, falling back to desktop flow:', err)
    }
  }

  // 2. Desktop WhatsApp Web helper:
  // If it is an image, copy it to the clipboard so the user can simply Ctrl + V in WhatsApp Web!
  let copiedToClipboard = false
  if (fileType === 'image' && typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
    try {
      await navigator.clipboard.write([
        new ClipboardItem({ 'image/png': blob })
      ])
      copiedToClipboard = true
    } catch (err) {
      console.warn('Clipboard copy failed:', err)
    }
  }

  // 3. Download file to user device
  const downloadUrl = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  setTimeout(() => window.URL.revokeObjectURL(downloadUrl), 30000)

  // 4. Open WhatsApp Click-to-Chat with message
  const extraNote = copiedToClipboard
    ? '\n\n(ملاحظة: تم نسخ الصورة إلى الحافظة! الصقها مباشرة في المحادثة بـ Ctrl+V)'
    : '\n\n(مرفق المستند تم تنزيله على جهازكم)'

  openManualWhatsAppChat({
    phone: recipientPhone,
    message: `${messageText}${extraNote}`
  })

  if (copiedToClipboard) {
    toast.success('تم نسخ صورة المستند للحافظة وتنزيلها! الصقها مباشرة في محادثة الواتساب (Ctrl + V)', {
      duration: 6000
    })
  } else {
    toast.info(`تم تنزيل ${documentTitle} وفتح محادثة واتساب. يمكنك إرفاق الملف بالمحادثة.`, {
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

