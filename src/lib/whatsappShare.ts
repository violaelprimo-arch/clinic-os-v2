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
 * Handles professional sharing of PDF documents (Prescriptions, Invoices, Reports).
 * - On supported platforms (mobile & modern browsers): Uses Web Share API with files.
 * - On unsupported platforms: Downloads PDF, opens WhatsApp chat with instructions.
 */
export async function sharePdfDocument({
  pdfBlob,
  fileName,
  recipientPhone,
  messageText,
  documentTitle = 'المستند الطبي'
}: {
  pdfBlob: Blob
  fileName: string
  recipientPhone: string
  messageText: string
  documentTitle?: string
}): Promise<void> {
  const file = new File([pdfBlob], fileName, { type: 'application/pdf' })

  // 1. Try Native Web Share API if supported
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
        // User cancelled share dialog
        return
      }
      console.warn('Web Share API failed, falling back to download + chat:', err)
    }
  }

  // 2. Fallback for Desktop / browsers without file share support:
  // Download file to user device
  const downloadUrl = window.URL.createObjectURL(pdfBlob)
  const a = document.createElement('a')
  a.href = downloadUrl
  a.download = fileName
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(downloadUrl)

  // Open WhatsApp with guided message
  openManualWhatsAppChat({
    phone: recipientPhone,
    message: `${messageText}\n\n(مرفق ملف الـ PDF تم تنزيله على جهازكم)`
  })

  toast.info(
    `تم تنزيل ${documentTitle} وفتح محادثة واتساب. يرجى إرفاق الملف الذي تم تنزيله بالمحادثة.`,
    { duration: 7000 }
  )
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

