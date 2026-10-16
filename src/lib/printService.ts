/**
 * Universal Print & Document Engine for Yalla Clinic
 * Supports XP-80C 80mm Thermal Receipt Printers (72mm printable width) and A4 Medical Documents.
 * Isolates printed content into dedicated iframes with precise CSS media print definitions,
 * eliminating all website UI artifacts (modals, overlays, sidebars, buttons, backgrounds).
 */

export interface ThermalReceiptData {
  clinicName: string
  branchName?: string
  clinicAddress?: string
  clinicPhone?: string
  logoUrl?: string
  invoiceNumber: string
  date: string // YYYY-MM-DD
  time?: string
  patientName: string
  patientPhone?: string
  serviceName: string
  originalPrice: number
  discountAmount?: number
  netPrice: number
  paymentMethod: 'cash' | 'instapay' | 'wallet'
  paymentStatus: 'paid' | 'pending_verification' | 'pending' | 'unpaid'
  transferNumber?: string
  transferReference?: string
  confirmedBy?: string
  confirmedAt?: string
  footerNote?: string
  queueNumber?: number | string
}

export interface ExaminationTicketData {
  clinicName: string
  branchName?: string
  logoUrl?: string
  ticketNumber?: string
  queueNumber: number | string
  effectivePosition?: number | string
  patientName: string
  patientPhone?: string
  serviceName: string
  isUrgent?: boolean
  date: string
  time?: string
  paymentStatus: 'paid' | 'pending_verification' | 'pending' | 'unpaid'
  appointmentId?: string
}

export interface MedicalReportData {
  clinicName: string
  doctorName: string
  specialty?: string
  degreeTitle?: string
  branchName?: string
  clinicAddress?: string
  clinicPhone?: string
  logoUrl?: string
  patientName: string
  patientPhone?: string
  patientAge?: string
  fileNumber?: string
  visitDate: string
  diagnosis: string
  clinicalNotes?: string
  recommendations?: string
  vitalSigns?: {
    bloodPressure?: string
    heartRate?: string
    temperature?: string
    weight?: string
  }
}

export interface PrescriptionPrintData {
  clinicName: string
  doctorName: string
  specialty?: string
  degreeTitle?: string
  certificationTitle?: string
  branchName?: string
  clinicAddress?: string
  clinicPhone?: string
  logoUrl?: string
  patientName: string
  patientAge?: string
  fileNumber?: string
  date: string
  diagnosis?: string
  drugs: Array<{
    name: string
    dosage?: string
    duration?: string
    notes?: string
  }>
  instructions?: string
  primaryColor?: string
  secondaryColor?: string
  prescriptionTemplateUrl?: string
  templateMode?: 'standard' | 'custom'
  pageSize?: 'a4' | 'a5'
  showHeaderFooter?: boolean
  printBackground?: boolean
  topOffset?: number
}

export interface FinancialReportPrintData {
  clinicName: string
  doctorName?: string
  branchLabel?: string
  clinicAddress?: string
  clinicPhone?: string
  logoUrl?: string
  fromDate: string
  toDate: string
  generatedAtCairo: string
  generatedBy?: string
  totals: {
    revenue: number
    collected: number
    due: number
    discounts: number
    cash: number
    instapay: number
    wallet: number
    expenses?: number
    netProfit?: number
    patientsCount: number
  }
  transactions: Array<{
    id: string
    date: string
    patientName: string
    phone?: string
    branchName?: string
    serviceName: string
    price: number
    discount: number
    netPrice: number
    paymentMethod: string
    paymentStatus: string
  }>
  branchesBreakdown?: Array<{
    name: string
    bookingsCount: number
    revenue: number
    collected: number
    due: number
  }>
}

export interface PatientsReportPrintData {
  clinicName: string
  doctorName?: string
  branchLabel?: string
  clinicAddress?: string
  clinicPhone?: string
  logoUrl?: string
  fromDate?: string
  toDate?: string
  generatedAtCairo: string
  generatedBy?: string
  totalPatients: number
  totalVisits: number
  patients: Array<{
    name: string
    phone: string
    age?: string
    visitsCount: number
    lastVisit: string
    lastService: string
    status: string
  }>
}

/**
 * Injects HTML into an isolated invisible iframe and triggers the native browser print dialog.
 * @param htmlContent Full standalone HTML string
 * @param pageSize '80mm' for thermal rolls, 'a4' for standard paper, 'a5' for compact prescriptions
 */
export function printHtmlViaIframe(htmlContent: string, pageSize: '80mm' | 'a4' | 'a5' = '80mm'): void {
  if (typeof document === 'undefined') return

  // Clean up any lingering print iframes
  const existingIframes = document.querySelectorAll('iframe[data-clinic-print="true"]')
  existingIframes.forEach((el) => el.remove())

  const iframe = document.createElement('iframe')
  iframe.setAttribute('data-clinic-print', 'true')
  iframe.id = 'clinic-print-iframe'
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = '0'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  iframe.style.zIndex = '-9999'

  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    console.error('Cannot access print iframe document')
    return
  }

  doc.open()
  doc.write(htmlContent)
  doc.close()

  const executePrint = () => {
    try {
      iframe.contentWindow?.focus()
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Print trigger failed:', e)
    }
  }

  // Ensure iframe cleanup after print without breaking the active print preview
  if (iframe.contentWindow) {
    iframe.contentWindow.addEventListener('afterprint', () => {
      setTimeout(() => {
        try {
          iframe.remove()
        } catch (_) {}
      }, 500)
    })
  }

  // Pre-load images if any before triggering print dialog
  const imgs = Array.from(doc.images || [])
  if (imgs.length > 0) {
    let loaded = 0
    const total = imgs.length
    let triggered = false

    const checkAllLoaded = () => {
      loaded++
      if (loaded >= total && !triggered) {
        triggered = true
        setTimeout(executePrint, 150)
      }
    }

    imgs.forEach((img) => {
      if (img.complete) {
        checkAllLoaded()
      } else {
        img.onload = checkAllLoaded
        img.onerror = checkAllLoaded
      }
    })

    // Safety fallback timeout in case image events don't fire
    setTimeout(() => {
      if (!triggered) {
        triggered = true
        executePrint()
      }
    }, 1200)
  } else {
    setTimeout(executePrint, 250)
  }
}

/**
 * TASK 1 & TASK 3.B: XP-80C 80mm High-Precision Thermal Invoice
 * Formatted for standard 80mm thermal receipt rolls with 72mm safe printable width.
 * Zero margin cutoffs, compact vertical rhythm, no trailing blank roll output.
 */
export function generateThermalReceiptHtml(data: ThermalReceiptData): string {
  const methodLabel =
    data.paymentMethod === 'instapay'
      ? 'InstaPay (انستاباي)'
      : data.paymentMethod === 'wallet'
      ? 'محفظة إلكترونية'
      : 'نقداً بالعيادة (كاش)'

  const isPaid = data.paymentStatus === 'paid'
  const isPending = data.paymentStatus === 'pending_verification' || data.paymentStatus === 'pending'
  const statusLabel = isPaid
    ? '● مسدد ومؤكد'
    : isPending
    ? '○ في انتظار تأكيد التحويل'
    : '○ غير محصل'

  const formattedDate = data.date || new Date().toISOString().split('T')[0]
  const formattedTime =
    data.time ||
    new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Cairo'
    }).format(new Date())

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>فاتورة - ${data.invoiceNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      html {
        width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      body {
        width: 70mm !important;
        max-width: 70mm !important;
        margin-left: 5mm !important;
        margin-right: auto !important;
        padding: 2mm 2mm 2mm 5mm !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, -apple-system, Roboto, Arial, sans-serif;
      width: 70mm;
      max-width: 70mm;
      margin-left: 5mm;
      margin-right: auto;
      padding: 2mm 2mm 2mm 5mm;
      color: #000000;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.35;
      text-align: right;
      direction: rtl;
      overflow: hidden;
      word-wrap: break-word;
    }
    .text-center { text-align: center; }
    .text-left { text-align: left; direction: ltr; }
    .font-bold { font-weight: bold; }
    .font-black { font-weight: 900; }
    
    .header {
      text-align: center;
      padding-bottom: 5px;
      border-bottom: 1px dashed #000;
      margin-bottom: 5px;
    }
    .clinic-logo {
      max-width: 38mm;
      max-height: 16mm;
      margin: 0 auto 3px auto;
      display: block;
      filter: grayscale(100%) contrast(200%);
    }
    .clinic-title {
      font-size: 14px;
      font-weight: 900;
      line-height: 1.2;
    }
    .branch-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      border: 1px solid #000;
      padding: 1px 5px;
      border-radius: 3px;
      margin: 2px 0;
    }
    .contact-info {
      font-size: 9.5px;
      color: #111;
      line-height: 1.25;
    }
    
    .meta-box {
      border-bottom: 1px dashed #000;
      padding-bottom: 4px;
      margin-bottom: 4px;
      font-size: 10.5px;
    }
    .meta-row {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      padding: 1px 0;
    }
    
    .table {
      width: 100%;
      border-collapse: collapse;
      margin: 4px 0;
      font-size: 10.5px;
    }
    .table th {
      border-bottom: 1px solid #000;
      padding: 3px 0;
      text-align: right;
      font-weight: 900;
    }
    .table td {
      padding: 3px 0;
      border-bottom: 1px dotted #888;
    }
    
    .totals-box {
      border-top: 1px dashed #000;
      padding-top: 4px;
      margin-top: 4px;
      font-size: 11px;
    }
    .total-row {
      display: flex;
      justify-content: space-between;
      padding: 1.5px 0;
    }
    .grand-total {
      font-size: 13.5px;
      font-weight: 900;
      border-top: 1.5px solid #000;
      border-bottom: 1.5px solid #000;
      padding: 3px 0;
      margin-top: 3px;
    }
    
    .payment-box {
      background: #f7f7f7;
      border: 1px solid #000;
      padding: 4px;
      border-radius: 4px;
      margin: 6px 0;
      font-size: 10px;
    }
    
    .footer {
      text-align: center;
      font-size: 9.5px;
      border-top: 1px dashed #000;
      padding-top: 5px;
      margin-top: 6px;
      line-height: 1.3;
    }
    .footer-copy {
      font-size: 8.5px;
      margin-top: 3px;
      font-weight: bold;
    }
    .receipt-id {
      font-family: monospace;
      font-size: 9px;
      letter-spacing: 1.5px;
      margin-top: 3px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${data.logoUrl ? `<img src="${data.logoUrl}" class="clinic-logo" alt="Logo" />` : ''}
    <div class="clinic-title">${data.clinicName}</div>
    ${data.branchName ? `<div class="branch-badge">فرع: ${data.branchName}</div>` : ''}
    ${data.clinicAddress ? `<div class="contact-info">${data.clinicAddress}</div>` : ''}
    ${data.clinicPhone ? `<div class="contact-info">ت: ${data.clinicPhone}</div>` : ''}
  </div>

  ${data.queueNumber !== undefined && data.queueNumber !== null && data.queueNumber !== '' ? `
  <div style="border: 2px solid #000; border-radius: 6px; padding: 5px 4px; text-align: center; margin: 6px 0; background: #fff;">
    <div style="font-size: 11px; font-weight: bold; letter-spacing: 0.5px;">رقم الدور في الانتظار</div>
    <div style="font-size: 42px; font-weight: 900; line-height: 1; margin: 3px 0; font-family: monospace;">#${data.queueNumber}</div>
    <div style="font-size: 9.5px; color: #222;">الرجاء متابعة شاشة النداء الآلي بالعيادة</div>
  </div>
  ` : ''}

  <div class="meta-box">
    <div class="meta-row">
      <span>رقم الفاتورة:</span>
      <span class="font-bold" dir="ltr">${data.invoiceNumber}</span>
    </div>
    <div class="meta-row">
      <span>التاريخ والوقت:</span>
      <span>${formattedDate} • ${formattedTime}</span>
    </div>
    <div class="meta-row">
      <span>اسم المريض:</span>
      <span class="font-bold">${data.patientName}</span>
    </div>
    ${data.patientPhone ? `<div class="meta-row"><span>رقم الهاتف:</span><span dir="ltr">${data.patientPhone}</span></div>` : ''}
  </div>

  <table class="table">
    <thead>
      <tr>
        <th>الخدمة الطبية</th>
        <th class="text-left">القيمة</th>
      </tr>
    </thead>
    <tbody>
      <tr>
        <td>
          <div class="font-bold">${data.serviceName}</div>
        </td>
        <td class="text-left font-bold">${data.originalPrice} ج.م</td>
      </tr>
    </tbody>
  </table>

  <div class="totals-box">
    <div class="total-row">
      <span>المبلغ الإجمالي:</span>
      <span>${data.originalPrice} ج.م</span>
    </div>
    ${
      (data.discountAmount || 0) > 0
        ? `<div class="total-row">
            <span>الخصم المعتمد:</span>
            <span>- ${data.discountAmount} ج.م</span>
          </div>`
        : ''
    }
    <div class="total-row grand-total">
      <span>الصافي المطلوب:</span>
      <span>${data.netPrice} ج.م</span>
    </div>
  </div>

  <div class="payment-box">
    <div class="meta-row">
      <span>طريقة السداد:</span>
      <span class="font-bold">${methodLabel}</span>
    </div>
    <div class="meta-row">
      <span>حالة الدفع:</span>
      <span class="font-bold">${statusLabel}</span>
    </div>
    ${
      data.transferNumber
        ? `<div class="meta-row"><span>رقم التحويل:</span><span class="font-bold" dir="ltr">${data.transferNumber}</span></div>`
        : ''
    }
    ${
      data.confirmedBy
        ? `<div class="meta-row"><span>التأكيد بواسطة:</span><span>${data.confirmedBy}</span></div>`
        : ''
    }
  </div>

  <div class="footer">
    <p class="font-bold">${data.footerNote || 'يرجى الاحتفاظ بالإيصال • نتمنى لكم الشفاء العاجل'}</p>
    <p class="footer-copy">Yalla Clinic • جميع الحقوق محفوظة YallaCodeX 2026</p>
    <div class="receipt-id">* ${data.invoiceNumber} *</div>
  </div>
</body>
</html>`
}

/**
 * TASK 3.A: Examination Ticket (80mm Thermal Paper)
 * Clean, high-impact admission slip for the patient showing queue number prominently.
 */
export function generateExaminationTicketHtml(data: ExaminationTicketData): string {
  const isPaid = data.paymentStatus === 'paid'
  const isPending = data.paymentStatus === 'pending_verification' || data.paymentStatus === 'pending'
  const statusLabel = isPaid ? 'تم السداد' : isPending ? 'بانتظار تأكيد السداد' : 'غير مسدد'

  const formattedDate = data.date || new Date().toISOString().split('T')[0]
  const formattedTime =
    data.time ||
    new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Cairo'
    }).format(new Date())

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تذكرة كشف - #${data.queueNumber}</title>
  <style>
    @page {
      size: 80mm auto;
      margin: 0;
    }
    @media print {
      html {
        width: 80mm !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      body {
        width: 70mm !important;
        max-width: 70mm !important;
        margin-left: 5mm !important;
        margin-right: auto !important;
        padding: 2mm 2mm 2mm 5mm !important;
      }
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }
    body {
      font-family: 'Segoe UI', Tahoma, -apple-system, Roboto, Arial, sans-serif;
      width: 70mm;
      max-width: 70mm;
      margin-left: 5mm;
      margin-right: auto;
      padding: 2mm 2mm 2mm 5mm;
      color: #000000;
      background: #ffffff;
      font-size: 11px;
      line-height: 1.35;
      text-align: right;
      direction: rtl;
      overflow: hidden;
    }
    .text-center { text-align: center; }
    .header {
      text-align: center;
      padding-bottom: 5px;
      border-bottom: 1px dashed #000;
      margin-bottom: 6px;
    }
    .clinic-logo {
      max-width: 35mm;
      max-height: 15mm;
      margin: 0 auto 3px auto;
      display: block;
      filter: grayscale(100%) contrast(200%);
    }
    .clinic-title { font-size: 14px; font-weight: 900; }
    .branch-badge {
      display: inline-block;
      font-size: 10px;
      font-weight: bold;
      border: 1px solid #000;
      padding: 1px 5px;
      border-radius: 3px;
      margin-top: 2px;
    }
    
    .ticket-box {
      border: 2px solid #000;
      border-radius: 6px;
      padding: 8px 4px;
      text-align: center;
      margin: 8px 0;
      background: #fff;
    }
    .ticket-label {
      font-size: 11px;
      font-weight: bold;
      letter-spacing: 0.5px;
    }
    .queue-num {
      font-size: 38px;
      font-weight: 900;
      line-height: 1.1;
      margin: 2px 0;
    }
    .service-badge {
      display: inline-block;
      font-size: 11px;
      font-weight: 900;
      padding: 2px 8px;
      border: 1px solid #000;
      border-radius: 12px;
      margin-top: 2px;
    }
    
    .info-box {
      border-bottom: 1px dashed #000;
      padding-bottom: 5px;
      margin-bottom: 6px;
      font-size: 11px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
    }
    
    .footer {
      text-align: center;
      font-size: 9.5px;
      line-height: 1.35;
      padding-top: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    ${data.logoUrl ? `<img src="${data.logoUrl}" class="clinic-logo" alt="Logo" />` : ''}
    <div class="clinic-title">${data.clinicName}</div>
    ${data.branchName ? `<div class="branch-badge">فرع: ${data.branchName}</div>` : ''}
  </div>

  <div class="ticket-box">
    <div class="ticket-label">تذكرة دخول العيادة</div>
    <div class="queue-num">#${data.queueNumber}</div>
    <div class="service-badge">${data.serviceName} ${data.isUrgent ? '• طوارئ' : ''}</div>
  </div>

  <div class="info-box">
    <div class="info-row">
      <span>اسم المريض:</span>
      <strong style="font-size:12px;">${data.patientName}</strong>
    </div>
    ${data.patientPhone ? `<div class="info-row"><span>رقم الهاتف:</span><span dir="ltr">${data.patientPhone}</span></div>` : ''}
    <div class="info-row">
      <span>تاريخ الحجز:</span>
      <span>${formattedDate}</span>
    </div>
    <div class="info-row">
      <span>وقت الاستخراج:</span>
      <span>${formattedTime}</span>
    </div>
    <div class="info-row">
      <span>حالة الرسوم:</span>
      <strong>${statusLabel}</strong>
    </div>
  </div>

  <div class="footer">
    <p style="font-weight:bold;">يرجى التواجد في استراحة الانتظار حتى استدعاء رقم دورك.</p>
    <p style="font-size:8.5px; margin-top:3px;">Yalla Clinic • جميع الحقوق محفوظة YallaCodeX 2026</p>
  </div>
</body>
</html>`
}

/**
 * TASK 3.C: Medical Examination Report (A4 Document)
 * Official clinical report for medical records, patient history, and referrals.
 */
export function generateMedicalReportHtml(data: MedicalReportData): string {
  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقرير كشف طبي - ${data.patientName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 15mm 12mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, -apple-system, Roboto, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 11pt;
      line-height: 1.5;
      padding: 10px;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 12px;
      margin-bottom: 16px;
    }
    .doctor-title { font-size: 18pt; font-weight: 900; color: #0f766e; }
    .doctor-sub { font-size: 11pt; color: #475569; font-weight: 600; margin-top: 2px; }
    .clinic-meta { text-align: left; direction: ltr; font-size: 9.5pt; color: #64748b; }
    
    .report-title-banner {
      background: #f0fdfa;
      border: 1px solid #99f6e4;
      border-radius: 8px;
      text-align: center;
      padding: 8px;
      font-size: 14pt;
      font-weight: 900;
      color: #0f766e;
      margin-bottom: 16px;
    }
    
    .patient-strip {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 10px 14px;
      font-size: 10pt;
      margin-bottom: 20px;
    }
    .patient-strip div span { color: #64748b; font-size: 9pt; display: block; }
    .patient-strip div strong { color: #0f172a; font-size: 11pt; }
    
    .section {
      margin-bottom: 18px;
    }
    .section-title {
      font-size: 12pt;
      font-weight: 900;
      color: #0f172a;
      border-right: 4px solid #0f766e;
      padding-right: 8px;
      margin-bottom: 8px;
    }
    .section-content {
      background: #ffffff;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 12px 14px;
      font-size: 11pt;
      line-height: 1.6;
      white-space: pre-wrap;
    }
    
    .vitals-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .vital-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 6px;
      padding: 8px;
      text-align: center;
    }
    .vital-card span { font-size: 8.5pt; color: #64748b; display: block; }
    .vital-card strong { font-size: 11pt; color: #0f172a; }
    
    .footer {
      border-top: 1.5px solid #cbd5e1;
      padding-top: 16px;
      margin-top: 36px;
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
    }
    .signature-box {
      text-align: center;
      width: 160px;
    }
    .signature-line {
      border-bottom: 1px solid #000;
      height: 45px;
      margin-bottom: 4px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="doctor-title">د. ${data.doctorName}</div>
      <div class="doctor-sub">${data.degreeTitle || 'استشاري أول'} • ${data.specialty || 'العيادة الطبية'}</div>
      <div style="font-size:9.5pt; color:#64748b; margin-top:2px;">${data.clinicName} ${data.branchName ? `(فرع ${data.branchName})` : ''}</div>
    </div>
    <div class="clinic-meta">
      ${data.logoUrl ? `<img src="${data.logoUrl}" style="max-height:50px; margin-bottom:4px;" alt="Logo" />` : ''}
      <div>${data.clinicAddress || ''}</div>
      <div>${data.clinicPhone || ''}</div>
    </div>
  </div>

  <div class="report-title-banner">تقرير كشف طبي واستشارة</div>

  <div class="patient-strip">
    <div>
      <span>اسم المريض:</span>
      <strong>${data.patientName}</strong>
    </div>
    <div>
      <span>السن:</span>
      <strong>${data.patientAge || 'غير مسجل'}</strong>
    </div>
    <div>
      <span>رقم الملف:</span>
      <strong dir="ltr">${data.fileNumber || '—'}</strong>
    </div>
    <div>
      <span>تاريخ الزيارة:</span>
      <strong dir="ltr">${data.visitDate}</strong>
    </div>
  </div>

  ${
    data.vitalSigns && (data.vitalSigns.bloodPressure || data.vitalSigns.heartRate)
      ? `<div class="vitals-grid">
          ${data.vitalSigns.bloodPressure ? `<div class="vital-card"><span>ضغط الدم</span><strong>${data.vitalSigns.bloodPressure}</strong></div>` : ''}
          ${data.vitalSigns.heartRate ? `<div class="vital-card"><span>النبض</span><strong>${data.vitalSigns.heartRate} bpm</strong></div>` : ''}
          ${data.vitalSigns.temperature ? `<div class="vital-card"><span>حرارة الجسم</span><strong>${data.vitalSigns.temperature} °C</strong></div>` : ''}
          ${data.vitalSigns.weight ? `<div class="vital-card"><span>الوزن</span><strong>${data.vitalSigns.weight} kg</strong></div>` : ''}
        </div>`
      : ''
  }

  <div class="section">
    <div class="section-title">التشخيص الطبي والتقييم الإكلينيكي</div>
    <div class="section-content">${data.diagnosis || 'لم يُسجل تشخيص محدد'}</div>
  </div>

  ${
    data.clinicalNotes
      ? `<div class="section">
          <div class="section-title">الملاحظات الطبية ونتائج الفحص</div>
          <div class="section-content">${data.clinicalNotes}</div>
        </div>`
      : ''
  }

  ${
    data.recommendations
      ? `<div class="section">
          <div class="section-title">التوصيات والتعليمات الطبية للمريض</div>
          <div class="section-content">${data.recommendations}</div>
        </div>`
      : ''
  }

  <div class="footer">
    <div style="font-size:8.5pt; color:#64748b;">
      <div>صدر هذا التقرير رسمياً من عيادة د. ${data.doctorName}</div>
      <div>نظام Yalla Clinic لإدارة العيادات • جميع الحقوق محفوظة YallaCodeX 2026</div>
    </div>

    <div class="signature-box">
      <div class="signature-line"></div>
      <div style="font-size:9pt; font-weight:bold;">توقيع وختم الطبيب</div>
    </div>
  </div>
</body>
</html>`
}

/**
 * TASK 3.D & TASK 13: Clean, multi-page A4 Financial Report HTML
 * Isolated table styling with repeating headers and executive KPIs.
 */
export function generateFinancialReportHtml(data: FinancialReportPrintData): string {
  const totalExpenses = data.totals.expenses || 0
  const netProfit = data.totals.collected - totalExpenses

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>التقرير المالي - ${data.clinicName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, -apple-system, Roboto, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 10.5pt;
      line-height: 1.45;
      padding: 8px;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header-title { font-size: 18pt; font-weight: 900; color: #0f766e; }
    .header-subtitle { font-size: 10.5pt; color: #64748b; font-weight: 600; margin-top: 3px; }
    .badge {
      display: inline-block;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 8.5pt;
      font-weight: bold;
    }
    
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 8px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 8px;
      padding: 8px 10px;
      text-align: right;
    }
    .kpi-card.highlight {
      background: #f0fdfa;
      border-color: #99f6e4;
    }
    .kpi-title { font-size: 8.5pt; font-weight: bold; color: #64748b; margin-bottom: 3px; }
    .kpi-val { font-size: 13.5pt; font-weight: 900; color: #0f172a; }
    .kpi-val.green { color: #059669; }
    .kpi-val.red { color: #dc2626; }
    
    .section-title {
      font-size: 11.5pt;
      font-weight: 900;
      color: #0f172a;
      margin: 14px 0 6px 0;
      border-right: 4px solid #0f766e;
      padding-right: 8px;
    }
    
    .data-table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      margin-bottom: 14px;
    }
    .data-table thead {
      display: table-header-group;
    }
    .data-table tr {
      page-break-inside: avoid;
    }
    .data-table th {
      background: #0f766e;
      color: #ffffff;
      padding: 6px 5px;
      font-weight: bold;
      text-align: right;
      border: 1px solid #0f766e;
    }
    .data-table td {
      padding: 5px;
      border: 1px solid #e2e8f0;
    }
    .data-table tr:nth-child(even) {
      background-color: #f8fafc;
    }
    
    .footer {
      border-top: 1px solid #cbd5e1;
      padding-top: 8px;
      margin-top: 20px;
      font-size: 8pt;
      color: #64748b;
      display: flex;
      justify-content: space-between;
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td>
        <div class="header-title">${data.clinicName}</div>
        <div class="header-subtitle">التقرير المالي وكشف الحساب • ${data.branchLabel || 'جميع الفروع'}</div>
        <div style="font-size:9pt; color:#475569; margin-top:3px;">
          الفترة: من <strong>${data.fromDate}</strong> إلى <strong>${data.toDate}</strong>
        </div>
      </td>
      <td style="text-align:left; vertical-align:top;" dir="ltr">
        <div class="badge">Financial Statement</div>
        <div style="font-size:8pt; color:#64748b; margin-top:5px;">
          Issued: ${data.generatedAtCairo}<br />
          By: ${data.generatedBy || 'Clinic Admin'}
        </div>
      </td>
    </tr>
  </table>

  <!-- Executive KPI Cards -->
  <div class="kpi-grid">
    <div class="kpi-card">
      <div class="kpi-title">إجمالي المبيعات</div>
      <div class="kpi-val">${data.totals.revenue.toLocaleString()} <span style="font-size:8pt;">ج.م</span></div>
    </div>
    <div class="kpi-card highlight">
      <div class="kpi-title">المحصل الفعلي</div>
      <div class="kpi-val green">${data.totals.collected.toLocaleString()} <span style="font-size:8pt;">ج.م</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">المبالغ الآجلة</div>
      <div class="kpi-val red">${data.totals.due.toLocaleString()} <span style="font-size:8pt;">ج.م</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">الخصومات الممنوحة</div>
      <div class="kpi-val">${(data.totals.discounts || 0).toLocaleString()} <span style="font-size:8pt;">ج.م</span></div>
    </div>
  </div>

  <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:10px;">
    <div class="kpi-card">
      <div class="kpi-title">كاش بالعيادة</div>
      <div class="kpi-val">${data.totals.cash.toLocaleString()} ج.م</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">InstaPay</div>
      <div class="kpi-val">${data.totals.instapay.toLocaleString()} ج.م</div>
    </div>
    <div class="kpi-card">
      <div class="kpi-title">محافظ إلكترونية</div>
      <div class="kpi-val">${data.totals.wallet.toLocaleString()} ج.م</div>
    </div>
  </div>

  <!-- Transactions Details -->
  <div class="section-title">بيان المعاملات والمدفوعات (${data.transactions.length} عملية)</div>
  <table class="data-table">
    <thead>
      <tr>
        <th style="width:30px; text-align:center;">#</th>
        <th>المريض</th>
        <th>الفرع</th>
        <th>نوع الكشف</th>
        <th>المبلغ</th>
        <th>الخصم</th>
        <th>الصافي</th>
        <th>طريقة السداد</th>
        <th>حالة الدفع</th>
        <th>التاريخ</th>
      </tr>
    </thead>
    <tbody>
      ${
        data.transactions.length === 0
          ? `<tr><td colspan="10" style="text-align:center; padding:12px;">لا توجد معاملات مسجلة في هذه الفترة</td></tr>`
          : data.transactions
              .map(
                (t, i) => `
                <tr>
                  <td style="text-align:center;">${i + 1}</td>
                  <td><strong>${t.patientName}</strong></td>
                  <td>${t.branchName || 'الرئيسي'}</td>
                  <td>${t.serviceName}</td>
                  <td>${t.price} ج.م</td>
                  <td>${t.discount > 0 ? `-${t.discount}` : '0'}</td>
                  <td><strong>${t.netPrice} ج.م</strong></td>
                  <td>${t.paymentMethod}</td>
                  <td>${t.paymentStatus === 'paid' ? 'مدفوع' : 'بانتظار التأكيد'}</td>
                  <td dir="ltr">${t.date}</td>
                </tr>
              `
              )
              .join('')
      }
    </tbody>
  </table>

  ${
    data.branchesBreakdown && data.branchesBreakdown.length > 0
      ? `
      <div class="section-title">مقارنة أداء الفروع</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>الفرع</th>
            <th>عدد الحجوزات</th>
            <th>إجمالي المبيعات</th>
            <th>المحصل</th>
            <th>المتبقي</th>
          </tr>
        </thead>
        <tbody>
          ${data.branchesBreakdown
            .map(
              (b) => `
            <tr>
              <td><strong>${b.name}</strong></td>
              <td>${b.bookingsCount}</td>
              <td>${b.revenue.toLocaleString()} ج.م</td>
              <td><strong>${b.collected.toLocaleString()} ج.م</strong></td>
              <td>${b.due.toLocaleString()} ج.م</td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `
      : ''
  }

  <div class="footer">
    <div>تم استخراج هذا التقرير آلياً بواسطة نظام Yalla Clinic • جميع الحقوق محفوظة YallaCodeX 2026</div>
    <div>صفحة 1 من 1</div>
  </div>
</body>
</html>`
}

/**
 * TASK 8 & PHASE 3: Modern Premium Medical Prescription A4 & A5 HTML
 */
export function generateA4PrescriptionHtml(data: PrescriptionPrintData): string {
  const pColor = data.primaryColor || '#061A38'
  const sColor = data.secondaryColor || '#087CF4'
  const isA5 = data.pageSize === 'a5'
  const showHeaderFooter = data.showHeaderFooter !== false
  const isCustom = data.templateMode === 'custom' && !!data.prescriptionTemplateUrl
  const safeOffset = typeof data.topOffset === 'number' && data.topOffset <= 60 && data.topOffset >= 0 ? data.topOffset : 25
  const shouldPrintBg = isCustom && data.printBackground !== false

  const doctorName = data.doctorName || 'أحمد عبد العزيز'
  const doctorTitle = 'د.'
  const specialty = data.specialty || 'استشاري العيادة الطبية'
  const degree = data.degreeTitle || data.certificationTitle || 'عضو الجمعية الطبية المصرية'
  const syndicate = 'نقابة الأطباء'
  const validDrugs = (data.drugs || []).filter((d) => d.name && d.name.trim())

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>الروشتة الطبية - ${data.patientName || 'المريض'}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      letter-spacing: 0px !important;
      word-spacing: 0px !important;
    }
    @page {
      size: ${isA5 ? 'A5' : 'A4'} portrait;
      margin: 0 !important;
    }
    html, body {
      width: ${isA5 ? '148mm' : '210mm'};
      height: ${isA5 ? '210mm' : '297mm'};
      margin: 0 !important;
      padding: 0 !important;
      background: #ffffff;
      color: #0f172a;
      font-family: 'Cairo', 'Segoe UI', Tahoma, -apple-system, Arial, sans-serif;
      direction: rtl;
      text-align: right;
      overflow: hidden;
      font-feature-settings: "liga" 1, "calt" 1, "dlig" 1 !important;
    }
    .prescription-sheet {
      position: relative;
      width: ${isA5 ? '148mm' : '210mm'};
      height: ${isA5 ? '210mm' : '297mm'};
      max-height: ${isA5 ? '210mm' : '297mm'};
      box-sizing: border-box;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      padding: ${isA5 ? '8mm 10mm' : '12mm 15mm'};
      overflow: hidden;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      page-break-after: avoid !important;
      break-after: avoid !important;
      ${shouldPrintBg ? `background-image: url('${data.prescriptionTemplateUrl}'); background-size: 100% 100%; background-repeat: no-repeat; background-position: center;` : ''}
      ${isCustom && !showHeaderFooter ? `padding-top: ${safeOffset}%;` : ''}
    }

    /* Vector Corner Brackets */
    .corner-bracket {
      position: absolute;
      width: 16px;
      height: 16px;
      opacity: 0.35;
      pointer-events: none;
    }
    .corner-top-right { top: 6mm; right: 6mm; }
    .corner-top-left { top: 6mm; left: 6mm; }
    .corner-bottom-right { bottom: 6mm; right: 6mm; }
    .corner-bottom-left { bottom: 6mm; left: 6mm; }

    .main-body {
      position: relative;
      z-index: 10;
      flex: 1;
      display: flex;
      flex-direction: column;
    }

    /* Header */
    .rx-header {
      display: ${showHeaderFooter ? 'block' : 'none'};
      margin-bottom: ${isA5 ? '6px' : '10px'};
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 12px;
      padding-bottom: 8px;
    }
    .doctor-block h1 {
      font-size: ${isA5 ? '15pt' : '21pt'};
      font-weight: 900;
      color: #0f172a;
      line-height: 1.15;
    }
    .doctor-spec {
      font-size: ${isA5 ? '9pt' : '11.5pt'};
      font-weight: 800;
      color: ${sColor};
      margin-top: 2px;
    }
    .doctor-deg {
      font-size: ${isA5 ? '7pt' : '8.5pt'};
      color: #64748b;
      font-weight: 600;
      margin-top: 2px;
    }
    .clinic-brand {
      text-align: left;
      direction: ltr;
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .clinic-logo {
      height: ${isA5 ? '32px' : '42px'};
      max-width: 170px;
      object-fit: contain;
      margin-bottom: 2px;
      display: block;
    }
    .clinic-name {
      font-size: ${isA5 ? '9pt' : '11pt'};
      font-weight: 900;
      color: #1e293b;
      direction: rtl;
    }
    .branch-pill {
      font-size: ${isA5 ? '7pt' : '8pt'};
      font-weight: bold;
      color: #475569;
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      border-radius: 4px;
      padding: 1px 6px;
      margin-top: 2px;
      direction: rtl;
    }

    /* Vector Double Divider */
    .divider-rule {
      position: relative;
      height: 2px;
      background: ${sColor};
      border-radius: 2px;
      margin: 4px 0 8px 0;
    }
    .divider-diamond {
      position: absolute;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%) rotate(45deg);
      width: 8px;
      height: 8px;
      background: #ffffff;
      border: 1.5px solid ${sColor};
    }

    /* Patient Metadata Strip */
    .patient-strip {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: ${isA5 ? '5px 8px' : '8px 12px'};
      margin-bottom: ${isA5 ? '6px' : '10px'};
      display: grid;
      grid-template-columns: repeat(4, 1fr);
      gap: 6px;
      font-size: ${isA5 ? '7.5pt' : '9pt'};
    }
    .patient-cell-label {
      font-size: ${isA5 ? '6.5pt' : '7.5pt'};
      color: #64748b;
      font-weight: bold;
      display: block;
      margin-bottom: 1px;
    }
    .patient-cell-val {
      font-size: ${isA5 ? '8.5pt' : '10pt'};
      font-weight: 900;
      color: #0f172a;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }

    .diagnosis-strip {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 6px;
      padding: ${isA5 ? '3px 8px' : '5px 10px'};
      margin-bottom: ${isA5 ? '6px' : '10px'};
      font-size: ${isA5 ? '7.5pt' : '9pt'};
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .diagnosis-label {
      color: ${sColor};
      font-weight: bold;
    }
    .diagnosis-val {
      font-weight: 900;
      color: #1e3a8a;
    }

    /* Rx Symbol */
    .rx-bar {
      display: flex;
      align-items: baseline;
      gap: 8px;
      margin-bottom: 6px;
      direction: ltr;
    }
    .rx-symbol {
      font-family: Georgia, 'Times New Roman', serif;
      font-size: ${isA5 ? '24pt' : '32pt'};
      font-weight: 900;
      color: ${sColor};
      line-height: 1;
    }
    .rx-sub {
      font-size: 7.5pt;
      font-weight: 900;
      letter-spacing: 2px;
      color: #94a3b8;
      text-transform: uppercase;
    }
    .rx-line {
      flex: 1;
      border-bottom: 1px dashed #cbd5e1;
      margin-left: 8px;
    }

    /* Drugs Container & Item */
    .drugs-container {
      flex: 1;
      display: flex;
      flex-direction: column;
      gap: ${isA5 ? '6px' : '8px'};
    }
    .drug-card {
      display: flex;
      align-items: flex-start;
      gap: 8px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: ${isA5 ? '5px 8px' : '7px 10px'};
      direction: ltr;
      text-align: left;
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .drug-badge-num {
      width: ${isA5 ? '18px' : '22px'};
      height: ${isA5 ? '18px' : '22px'};
      border-radius: 6px;
      background: ${sColor};
      color: #ffffff;
      font-weight: 900;
      font-size: ${isA5 ? '8pt' : '9.5pt'};
      display: flex;
      align-items: center;
      justify-content: center;
      shrink-0;
      margin-top: 1px;
    }
    .drug-content {
      flex: 1;
      min-width: 0;
    }
    .drug-name-text {
      font-size: ${isA5 ? '10pt' : '12pt'};
      font-weight: 900;
      color: #0f172a;
      letter-spacing: -0.2px;
    }
    .drug-pills-row {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 5px;
      margin-top: 3px;
      direction: rtl;
      text-align: right;
    }
    .pill-dosage {
      font-size: ${isA5 ? '7pt' : '8.5pt'};
      font-weight: bold;
      background: #eff6ff;
      color: #1e40af;
      border: 1px solid #bfdbfe;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .pill-duration {
      font-size: ${isA5 ? '7pt' : '8.5pt'};
      font-weight: bold;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
      border-radius: 4px;
      padding: 1px 6px;
    }
    .pill-notes {
      font-size: ${isA5 ? '7pt' : '8.5pt'};
      font-weight: normal;
      font-style: italic;
      background: #fffbeb;
      color: #92400e;
      border: 1px solid #fde68a;
      border-radius: 4px;
      padding: 1px 6px;
    }

    /* Ruled guidelines for page balance when medicines are few */
    .ruled-guidelines {
      display: flex;
      flex-direction: column;
      gap: 16px;
      padding-top: 12px;
      opacity: 0.35;
    }
    .ruled-line {
      width: 100%;
      border-bottom: 1px dashed #cbd5e1;
    }

    /* Instructions Box */
    .instructions-box {
      background: #fffbeb;
      border: 1px solid #fde68a;
      border-radius: 8px;
      padding: ${isA5 ? '5px 8px' : '7px 12px'};
      margin-top: 6px;
      font-size: ${isA5 ? '7.5pt' : '9pt'};
      color: #78350f;
      page-break-inside: avoid;
    }
    .instructions-title {
      font-weight: 900;
      display: block;
      margin-bottom: 2px;
    }

    /* Footer */
    .rx-footer {
      display: ${showHeaderFooter ? 'block' : 'none'};
      border-top: 2px solid ${sColor};
      padding-top: ${isA5 ? '6px' : '10px'};
      margin-top: ${isA5 ? '8px' : '12px'};
      position: relative;
      z-index: 10;
    }
    .footer-row {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      gap: 12px;
    }
    .stamp-signature-area {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .signature-box {
      text-align: center;
      width: ${isA5 ? '85px' : '120px'};
    }
    .signature-line {
      border-bottom: 1.5px solid #334155;
      font-family: Georgia, serif;
      font-style: italic;
      font-weight: bold;
      font-size: ${isA5 ? '8pt' : '10pt'};
      padding-bottom: 2px;
      margin-bottom: 2px;
    }
    .signature-label {
      font-size: ${isA5 ? '6.5pt' : '7.5pt'};
      font-weight: bold;
      color: #64748b;
    }
    .verification-box {
      text-align: center;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      padding: 3px 8px;
    }
    .verification-label {
      font-size: ${isA5 ? '7pt' : '8pt'};
      font-weight: 900;
      color: #059669;
    }
    .verification-id {
      font-family: monospace;
      font-size: ${isA5 ? '6.5pt' : '7.5pt'};
      color: #64748b;
    }
    .clinic-meta-box {
      font-size: ${isA5 ? '7pt' : '8.5pt'};
      color: #475569;
      line-height: 1.35;
      max-width: 200px;
    }
    .meta-brand-copy {
      font-size: ${isA5 ? '6pt' : '7pt'};
      color: #94a3b8;
      margin-top: 2px;
    }
  </style>
</head>
<body>
  <div class="prescription-sheet">
    
    <!-- Vector Corner Brackets -->
    ${showHeaderFooter ? `
    <svg class="corner-bracket corner-top-right" viewBox="0 0 20 20" fill="none" style="color: ${sColor};">
      <path d="M18 2h-8M18 2v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <svg class="corner-bracket corner-top-left" viewBox="0 0 20 20" fill="none" style="color: ${sColor};">
      <path d="M2 2h8M2 2v8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <svg class="corner-bracket corner-bottom-right" viewBox="0 0 20 20" fill="none" style="color: ${sColor};">
      <path d="M18 18h-8M18 18v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    <svg class="corner-bracket corner-bottom-left" viewBox="0 0 20 20" fill="none" style="color: ${sColor};">
      <path d="M2 18h8M2 18v-8" stroke="currentColor" stroke-width="2" stroke-linecap="round" />
    </svg>
    ` : ''}

    <!-- Main Prescription Body -->
    <div class="main-body">
      
      <!-- 1. Header -->
      <div class="rx-header">
        <div class="header-row">
          <div class="doctor-block">
            <h1>${doctorTitle} ${doctorName}</h1>
            <div class="doctor-spec">${specialty}</div>
            <div class="doctor-deg">${degree} • ${syndicate}</div>
          </div>

          <div class="clinic-brand">
            <img src="${data.logoUrl || '/brand/yalla-clinic/logo-light-bg.png'}" class="clinic-logo" alt="Logo" />
            <div class="clinic-name">${data.clinicName || 'Yalla Clinic'}</div>
            ${data.branchName ? `<div class="branch-pill">فرع: ${data.branchName}</div>` : ''}
          </div>
        </div>

        <div class="divider-rule">
          <div class="divider-diamond"></div>
        </div>
      </div>

      <!-- 2. Patient Meta Strip -->
      <div class="patient-strip">
        <div>
          <span class="patient-cell-label">اسم المريض:</span>
          <span class="patient-cell-val">${data.patientName || 'المريض'}</span>
        </div>
        <div>
          <span class="patient-cell-label">السن:</span>
          <span class="patient-cell-val">${data.patientAge ? `${data.patientAge} سنة` : '—'}</span>
        </div>
        <div>
          <span class="patient-cell-label">التاريخ:</span>
          <span class="patient-cell-val" dir="ltr">${data.date}</span>
        </div>
        <div>
          <span class="patient-cell-label">رقم الروشتة:</span>
          <span class="patient-cell-val" dir="ltr">#${data.fileNumber || '1042'}</span>
        </div>
      </div>

      <!-- Diagnosis (if present) -->
      ${data.diagnosis ? `
      <div class="diagnosis-strip">
        <span class="diagnosis-label">التشخيص الطبي:</span>
        <span class="diagnosis-val">${data.diagnosis}</span>
      </div>
      ` : ''}

      <!-- 3. Rx Section -->
      <div class="rx-bar">
        <span class="rx-symbol">℞</span>
        <span class="rx-sub">Prescription</span>
        <div class="rx-line"></div>
      </div>

      <!-- Medicines List (Cohesive Unified Left-Aligned Latin with RTL Dosage) -->
      <div class="drugs-container">
        ${validDrugs.length === 0 ? `
          <div style="padding: 30px; text-align: center; color: #94a3b8; border: 1px dashed #cbd5e1; border-radius: 8px;">
            لم يتم تسجيل أدوية بالروشتة بعد
          </div>
        ` : validDrugs.map((drug, idx) => `
          <div class="drug-card">
            <div class="drug-badge-num">${idx + 1}</div>
            <div class="drug-content">
              <div class="drug-name-text">${drug.name}</div>
              ${(drug.dosage || drug.duration || drug.notes) ? `
                <div class="drug-pills-row">
                  ${drug.dosage ? `<span class="pill-dosage">الجرعة: ${drug.dosage}</span>` : ''}
                  ${drug.duration ? `<span class="pill-duration">المدة: ${drug.duration}</span>` : ''}
                  ${drug.notes ? `<span class="pill-notes">(${drug.notes})</span>` : ''}
                </div>
              ` : ''}
            </div>
          </div>
        `).join('')}

        <!-- Page Balance Guidelines -->
        ${validDrugs.length > 0 && validDrugs.length < 4 ? `
          <div class="ruled-guidelines">
            <div class="ruled-line"></div>
            <div class="ruled-line"></div>
          </div>
        ` : ''}
      </div>

      <!-- 4. Clinical Instructions Box -->
      ${data.instructions ? `
      <div class="instructions-box">
        <strong class="instructions-title">إرشادات وتعليمات الطبيب:</strong>
        <div>${data.instructions}</div>
      </div>
      ` : ''}

    </div>

    <!-- 5. Footer -->
    <div class="rx-footer">
      <div class="footer-row">
        
        <!-- Doctor Signature -->
        <div class="stamp-signature-area">
          <div class="signature-box">
            <div class="signature-line">${doctorTitle} ${doctorName}</div>
            <div class="signature-label">توقيع الطبيب</div>
          </div>
        </div>

        <!-- Electronic Verification Badge -->
        <div class="verification-box">
          <div class="verification-label">✓ روشتة موثقة إلكترونياً</div>
          <div class="verification-id">ID: RX-${data.fileNumber || '1042'}-${data.date.replace(/-/g, '')}</div>
        </div>

        <!-- Clinic Contacts -->
        <div class="clinic-meta-box">
          <div>${data.clinicAddress || 'العنوان: مسجل بالعيادة'}</div>
          <div dir="ltr">تليفون: ${data.clinicPhone || 'مسجل بالعيادة'}</div>
          <div class="meta-brand-copy">نظام تشغيل العيادات الذكي • Yalla Clinic 2026</div>
        </div>

      </div>
    </div>

  </div>
</body>
</html>`
}

/**
 * Generates an isolated, print-ready A4 HTML document for Patients Records & List.
 */
export function generatePatientsReportHtml(data: PatientsReportPrintData): string {
  const periodLabel = data.fromDate || data.toDate
    ? `من: ${data.fromDate || 'البداية'} &nbsp; إلى: ${data.toDate || 'اليوم'}`
    : 'كافة الفترات المسجلة'

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقرير سجل المرضى - ${data.clinicName}</title>
  <style>
    @page {
      size: A4 portrait;
      margin: 12mm 10mm;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, -apple-system, Roboto, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: 10pt;
      line-height: 1.45;
      padding: 8px;
    }
    .header-table {
      width: 100%;
      border-bottom: 2px solid #0f766e;
      padding-bottom: 10px;
      margin-bottom: 14px;
    }
    .header-title { font-size: 18pt; font-weight: 900; color: #0f766e; }
    .header-subtitle { font-size: 10.5pt; color: #64748b; font-weight: 600; margin-top: 3px; }
    .badge {
      display: inline-block;
      background: #f0fdf4;
      color: #166534;
      border: 1px solid #bbf7d0;
      padding: 3px 8px;
      border-radius: 9999px;
      font-size: 8.5pt;
      font-weight: bold;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 14px;
    }
    .kpi-card {
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 8px;
      padding: 8px 12px;
      text-align: right;
    }
    .kpi-card.highlight {
      background: #f0fdfa;
      border-color: #99f6e4;
    }
    .kpi-label { font-size: 8pt; color: #64748b; font-weight: bold; margin-bottom: 3px; }
    .kpi-value { font-size: 14pt; font-weight: 900; color: #0f766e; }
    .table-container { width: 100%; margin-top: 10px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 9pt;
      text-align: right;
    }
    th {
      background-color: #0f766e;
      color: #ffffff;
      padding: 8px 6px;
      font-weight: bold;
      border: 1px solid #0f766e;
      font-size: 8.5pt;
      white-space: nowrap;
    }
    td {
      padding: 6px 6px;
      border: 1px solid #e2e8f0;
      font-size: 8.5pt;
    }
    tr:nth-child(even) td { background-color: #f8fafc; }
    .footer {
      margin-top: 20px;
      padding-top: 10px;
      border-top: 1px solid #e2e8f0;
      font-size: 8pt;
      color: #94a3b8;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    @media print {
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      tr { page-break-inside: avoid; }
      thead { display: table-header-group; }
    }
  </style>
</head>
<body>
  <table class="header-table">
    <tr>
      <td style="border:none; width: 60%; vertical-align: top;">
        <div class="header-title">${data.clinicName}</div>
        <div class="header-subtitle">
          ${data.doctorName ? `د. ${data.doctorName}` : ''} 
          ${data.branchLabel ? `• فرع ${data.branchLabel}` : ''}
        </div>
        <div style="font-size: 8.5pt; color: #64748b; margin-top: 4px;">
          ${data.clinicAddress ? `العنوان: ${data.clinicAddress} | ` : ''}
          ${data.clinicPhone ? `هاتف: ${data.clinicPhone}` : ''}
        </div>
      </td>
      <td style="border:none; width: 40%; text-align: left; vertical-align: top;" dir="ltr">
        <div style="font-size: 13pt; font-weight: 800; color: #0f766e;">تقرير سجل وملفات المرضى</div>
        <div style="font-size: 8.5pt; color: #64748b; margin-top: 3px;" dir="rtl">
          الفترة: <strong>${periodLabel}</strong>
        </div>
        <div style="font-size: 8pt; color: #94a3b8; margin-top: 2px;" dir="rtl">
          تاريخ الاستخراج: ${data.generatedAtCairo}
        </div>
      </td>
    </tr>
  </table>

  <div class="kpi-grid">
    <div class="kpi-card highlight">
      <div class="kpi-label">إجمالي المرضى بالتقرير</div>
      <div class="kpi-value">${data.totalPatients} <span style="font-size: 9pt; font-weight: normal; color: #64748b;">مريض</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">إجمالي الزيارات المسجلة</div>
      <div class="kpi-value">${data.totalVisits} <span style="font-size: 9pt; font-weight: normal; color: #64748b;">زيارة</span></div>
    </div>
    <div class="kpi-card">
      <div class="kpi-label">مسؤول الاستخراج</div>
      <div class="kpi-value" style="font-size: 11pt; padding-top: 4px;">${data.generatedBy || 'إدارة العيادة'}</div>
    </div>
  </div>

  <div class="table-container">
    <table>
      <thead>
        <tr>
          <th style="width: 30px; text-align: center;">#</th>
          <th>اسم المريض</th>
          <th>رقم الهاتف</th>
          <th style="text-align: center;">السن</th>
          <th style="text-align: center;">عدد الزيارات</th>
          <th>آخر خدمة</th>
          <th>تاريخ آخر زيارة</th>
          <th style="text-align: center;">الحالة</th>
        </tr>
      </thead>
      <tbody>
        ${data.patients.map((p, idx) => `
          <tr>
            <td style="text-align: center; font-weight: bold; color: #64748b;">${idx + 1}</td>
            <td style="font-weight: bold;">${p.name}</td>
            <td dir="ltr" style="text-align: right; font-family: monospace;">${p.phone || '—'}</td>
            <td style="text-align: center;">${p.age || '—'}</td>
            <td style="text-align: center; font-weight: bold; color: #0f766e;">${p.visitsCount}</td>
            <td>${p.lastService || 'كشف'}</td>
            <td dir="ltr" style="text-align: right; font-family: monospace;">${p.lastVisit || '—'}</td>
            <td style="text-align: center;">
              <span class="badge" style="${p.status === 'نشط' ? 'background:#f0fdf4;color:#166534;' : 'background:#fef2f2;color:#991b1b;'}">
                ${p.status || 'نشط'}
              </span>
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    <div>تم استخراج هذا التقرير آلياً عبر نظام Yalla Clinic • جميع الحقوق محفوظة YallaCodeX 2026</div>
    <div>الصفحة 1 من 1</div>
  </div>
</body>
</html>`
}

