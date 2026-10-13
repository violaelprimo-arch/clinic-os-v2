/**
 * Universal Print & Document Engine for Clinic OS V2
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

/**
 * Injects HTML into an isolated invisible iframe and triggers the native browser print dialog.
 * @param htmlContent Full standalone HTML string
 * @param pageSize '80mm' for thermal rolls, 'a4' for standard paper, 'a5' for compact prescriptions
 */
export function printHtmlViaIframe(htmlContent: string, pageSize: '80mm' | 'a4' | 'a5' = '80mm'): void {
  if (typeof document === 'undefined') return

  // Clean up any lingering print iframe
  const oldIframe = document.getElementById('clinic-print-iframe')
  if (oldIframe) {
    oldIframe.remove()
  }

  const iframe = document.createElement('iframe')
  iframe.id = 'clinic-print-iframe'
  iframe.style.position = 'fixed'
  iframe.style.left = '-9999px'
  iframe.style.top = '0'
  iframe.style.width = pageSize === '80mm' ? '80mm' : pageSize === 'a5' ? '148mm' : '210mm'
  iframe.style.minHeight = pageSize === '80mm' ? '120mm' : pageSize === 'a5' ? '210mm' : '297mm'
  iframe.style.border = 'none'
  iframe.style.visibility = 'hidden'

  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    console.error('Cannot access print iframe document')
    return
  }

  doc.open()
  doc.write(htmlContent)
  doc.close()

  iframe.contentWindow?.focus()
  setTimeout(() => {
    try {
      iframe.contentWindow?.print()
    } catch (e) {
      console.error('Print trigger failed:', e)
    } finally {
      setTimeout(() => {
        iframe.remove()
      }, 2000)
    }
  }, 400)
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
    <p class="footer-copy">Clinic OS • جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
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
    <p style="font-size:8.5px; margin-top:3px;">Clinic OS • جميع الحقوق محفوظة © ${new Date().getFullYear()}</p>
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
      <div>نظام Clinic OS لإدارة العيادات • جميع الحقوق محفوظة © ${new Date().getFullYear()}</div>
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
    <div>تم استخراج هذا التقرير آلياً بواسطة نظام Clinic OS V2 • جميع الحقوق محفوظة © ${new Date().getFullYear()}</div>
    <div>صفحة 1 من 1</div>
  </div>
</body>
</html>`
}

/**
 * TASK 8 & PHASE 3: Modern Premium Medical Prescription A4 & A5 HTML
 */
export function generateA4PrescriptionHtml(data: PrescriptionPrintData): string {
  const pColor = data.primaryColor || '#0B1F33'
  const sColor = data.secondaryColor || '#15B8A6'
  const isA5 = data.pageSize === 'a5'
  const showHeaderFooter = data.showHeaderFooter !== false
  const isCustom = data.templateMode === 'custom'
  const safeOffset = typeof data.topOffset === 'number' && data.topOffset <= 60 && data.topOffset >= 0 ? data.topOffset : 25

  return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>الروشتة الطبية - ${data.patientName}</title>
  <style>
    @page {
      size: ${isA5 ? 'A5' : 'A4'} portrait;
      margin: ${isA5 ? '8mm 6mm' : '12mm 10mm'};
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: 'Segoe UI', Tahoma, -apple-system, Roboto, Arial, sans-serif;
      color: #1e293b;
      background: #ffffff;
      font-size: ${isA5 ? '9.5pt' : '11pt'};
      line-height: 1.5;
      padding: ${isA5 ? '8px' : '10px'};
      ${isCustom && data.printBackground && data.prescriptionTemplateUrl ? `background-image: url('${data.prescriptionTemplateUrl}'); background-size: 100% 100%; background-repeat: no-repeat;` : ''}
      ${isCustom ? `padding-top: ${safeOffset}%;` : ''}
    }
    .header {
      display: ${showHeaderFooter && !isCustom ? 'flex' : 'none'};
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid ${sColor};
      padding-bottom: ${isA5 ? '8px' : '12px'};
      margin-bottom: ${isA5 ? '10px' : '14px'};
    }
    .doctor-name { font-size: ${isA5 ? '15pt' : '20pt'}; font-weight: 900; color: #182230; }
    .doctor-spec { font-size: ${isA5 ? '9.5pt' : '12pt'}; font-weight: bold; color: ${sColor}; margin-top: 2px; }
    .doctor-deg { font-size: ${isA5 ? '8pt' : '9.5pt'}; color: #64748b; margin-top: 2px; }
    .clinic-logo-box { text-align: left; direction: ltr; }
    .clinic-logo { max-height: ${isA5 ? '40px' : '55px'}; margin-bottom: 3px; }
    
    .patient-strip {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: ${isCustom ? 'transparent' : '#f8fafc'};
      border: ${isCustom ? 'none' : '1px solid #e2e8f0'};
      border-radius: 8px;
      padding: ${isA5 ? '6px 10px' : '8px 14px'};
      font-size: ${isA5 ? '8.5pt' : '10pt'};
      margin-bottom: ${isA5 ? '10px' : '16px'};
    }
    .patient-strip strong { color: #0f172a; font-size: ${isA5 ? '9.5pt' : '11pt'}; }
    
    .rx-title {
      font-family: Georgia, serif;
      font-size: ${isA5 ? '22pt' : '30pt'};
      font-weight: 900;
      color: ${sColor};
      margin: 4px 0 8px 0;
      line-height: 1;
      direction: ltr;
      text-align: left;
    }
    
    .drugs-list {
      margin-bottom: 20px;
      min-height: ${isA5 ? '220px' : '380px'};
    }
    .drug-item {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      padding: ${isA5 ? '6px 0' : '8px 0'};
      border-bottom: 1px dashed #e2e8f0;
    }
    .drug-num {
      font-weight: 900;
      color: ${sColor};
      font-size: ${isA5 ? '10pt' : '12pt'};
      width: 20px;
      direction: ltr;
    }
    .drug-details { flex: 1; }
    .drug-name {
      font-size: ${isA5 ? '11pt' : '13pt'};
      font-weight: 900;
      color: #0f172a;
      direction: ltr;
      text-align: left;
    }
    .drug-instruction {
      font-size: ${isA5 ? '9pt' : '10.5pt'};
      color: #334155;
      font-weight: 600;
      margin-top: 2px;
    }
    
    .footer {
      display: ${showHeaderFooter && !isCustom ? 'flex' : 'none'};
      border-top: 2px solid ${sColor};
      padding-top: ${isA5 ? '8px' : '14px'};
      margin-top: ${isA5 ? '16px' : '30px'};
      justify-content: space-between;
      align-items: flex-end;
      font-size: ${isA5 ? '7.5pt' : '9pt'};
      color: #64748b;
    }
    .signature-area {
      text-align: center;
      width: ${isA5 ? '110px' : '150px'};
    }
    .signature-line {
      border-bottom: 1px solid #000;
      height: ${isA5 ? '28px' : '40px'};
      margin-bottom: 3px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="doctor-name">د. ${data.doctorName}</div>
      <div class="doctor-spec">${data.specialty || 'استشاري العيادة الطبية'}</div>
      <div class="doctor-deg">${data.degreeTitle || data.certificationTitle || 'عضو الجمعية الطبية المصرية'}</div>
    </div>
    <div class="clinic-logo-box">
      ${data.logoUrl ? `<img src="${data.logoUrl}" class="clinic-logo" alt="Logo" />` : ''}
      <div style="font-size:10pt; font-weight:bold; color:#0f172a;">${data.clinicName}</div>
      ${data.branchName ? `<div style="font-size:9pt; color:#64748b;">فرع ${data.branchName}</div>` : ''}
    </div>
  </div>

  <div class="patient-strip">
    <div><span>الاسم:</span> <strong>${data.patientName}</strong></div>
    ${data.patientAge ? `<div><span>السن:</span> <strong>${data.patientAge} سنة</strong></div>` : ''}
    <div><span>التاريخ:</span> <strong dir="ltr">${data.date}</strong></div>
    ${data.diagnosis ? `<div><span>التشخيص:</span> <strong>${data.diagnosis}</strong></div>` : ''}
  </div>

  <div class="rx-title">R/</div>

  <div class="drugs-list">
    ${data.drugs
      .filter((d) => d.name && d.name.trim())
      .map(
        (drug, idx) => `
        <div class="drug-item">
          <div class="drug-num">${idx + 1}.</div>
          <div class="drug-details">
            <div class="drug-name">${drug.name}</div>
            <div class="drug-instruction">
              ${drug.dosage ? `<span>الجرعة: <strong>${drug.dosage}</strong></span> • ` : ''}
              ${drug.duration ? `<span>المدة: <strong>${drug.duration}</strong></span>` : ''}
              ${drug.notes ? ` • <span>ملاحظات: ${drug.notes}</span>` : ''}
            </div>
          </div>
        </div>
      `
      )
      .join('')}
  </div>

  ${
    data.instructions
      ? `<div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:6px; padding:8px 12px; margin-bottom:14px; font-size:${isA5 ? '8.5pt' : '10pt'};">
          <strong>إرشادات الطبيب:</strong> ${data.instructions}
        </div>`
      : ''
  }

  <div class="footer">
    <div>
      <div>${data.clinicAddress || 'العنوان: مسجل بالعيادة'}</div>
      <div>هاتف: ${data.clinicPhone || 'مسجل بالعيادة'}</div>
      <div style="font-size:8pt; margin-top:2px;">روشتة موثقة إلكترونياً • Clinic OS © ${new Date().getFullYear()}</div>
    </div>

    <div class="signature-area">
      <div class="signature-line"></div>
      <div style="font-weight:bold;">توقيع الطبيب</div>
    </div>
  </div>
</body>
</html>`
}
