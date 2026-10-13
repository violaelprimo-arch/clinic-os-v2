/**
 * Universal Print Engine for Clinic OS V2
 * Isolates documents into hidden iframes before invoking the browser print dialog,
 * ensuring zero pollution from website UI (no sidebars, navbars, background colors, or buttons).
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
  paymentStatus: 'paid' | 'pending_verification' | 'unpaid'
  transferNumber?: string
  transferReference?: string
  confirmedBy?: string
  confirmedAt?: string
  footerNote?: string
}

export interface FinancialReportPrintData {
  clinicName: string
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
 * Injects HTML into an isolated invisible iframe and prints it cleanly.
 */
export function printHtmlViaIframe(htmlContent: string): void {
  // Remove existing print iframes if any
  const existingIframe = document.getElementById('clinic-print-iframe')
  if (existingIframe) {
    existingIframe.remove()
  }

  const iframe = document.createElement('iframe')
  iframe.id = 'clinic-print-iframe'
  iframe.style.position = 'fixed'
  iframe.style.right = '0'
  iframe.style.bottom = '0'
  iframe.style.width = '0'
  iframe.style.height = '0'
  iframe.style.border = 'none'
  iframe.style.visibility = 'hidden'

  document.body.appendChild(iframe)

  const doc = iframe.contentWindow?.document
  if (!doc) {
    console.error('Cannot access iframe document for printing')
    return
  }

  doc.open()
  doc.write(htmlContent)
  doc.close()

  iframe.contentWindow?.focus()
  setTimeout(() => {
    iframe.contentWindow?.print()
    setTimeout(() => {
      iframe.remove()
    }, 1500)
  }, 350)
}

/**
 * Generates high-contrast 80mm Thermal Receipt HTML
 */
export function generateThermalReceiptHtml(data: ThermalReceiptData): string {
  const methodLabel =
    data.paymentMethod === 'instapay'
      ? 'InstaPay (انستاباي)'
      : data.paymentMethod === 'wallet'
      ? 'محفظة إلكترونية'
      : 'نقداً بالعيادة (كاش)'

  const statusLabel =
    data.paymentStatus === 'paid'
      ? '● مسدد ومؤكد'
      : data.paymentStatus === 'pending_verification'
      ? '○ في انتظار تأكيد التحويل'
      : '○ غير محصل'

  const formattedDate = data.date || new Date().toISOString().split('T')[0]
  const formattedTime =
    data.time ||
    new Date().toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' })

  return `
    <!DOCTYPE html>
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
          body {
            margin: 0;
            padding: 4mm 3mm;
          }
        }
        * {
          box-sizing: border-box;
          margin: 0;
          padding: 0;
        }
        body {
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          width: 76mm;
          margin: 0 auto;
          padding: 6mm 4mm;
          color: #000000;
          background: #ffffff;
          font-size: 12px;
          line-height: 1.4;
          text-align: right;
        }
        .text-center { text-align: center; }
        .text-left { text-align: left; }
        .font-bold { font-weight: bold; }
        .font-black { font-weight: 900; }
        
        .header {
          text-align: center;
          padding-bottom: 6px;
          border-bottom: 1.5px dashed #000000;
          margin-bottom: 8px;
        }
        .clinic-logo {
          max-width: 45mm;
          max-height: 18mm;
          margin: 0 auto 4px auto;
          display: block;
          filter: grayscale(100%) contrast(150%);
        }
        .clinic-title {
          font-size: 16px;
          font-weight: 900;
          letter-spacing: -0.5px;
        }
        .branch-badge {
          display: inline-block;
          font-size: 11px;
          font-weight: bold;
          border: 1px solid #000;
          padding: 1px 6px;
          border-radius: 4px;
          margin: 3px 0;
        }
        .contact-info {
          font-size: 10px;
          color: #222;
        }
        
        .meta-box {
          border-bottom: 1px dashed #000000;
          padding-bottom: 6px;
          margin-bottom: 6px;
          font-size: 11px;
        }
        .meta-row {
          display: flex;
          justify-content: space-between;
          padding: 1.5px 0;
        }
        
        .table {
          width: 100%;
          border-collapse: collapse;
          margin: 6px 0;
          font-size: 11px;
        }
        .table th {
          border-bottom: 1.5px solid #000;
          padding: 3px 0;
          text-align: right;
        }
        .table td {
          padding: 4px 0;
          border-bottom: 1px dotted #ccc;
        }
        
        .totals-box {
          border-top: 1.5px dashed #000;
          padding-top: 5px;
          margin-top: 5px;
          font-size: 11.5px;
        }
        .total-row {
          display: flex;
          justify-content: space-between;
          padding: 2px 0;
        }
        .grand-total {
          font-size: 15px;
          font-weight: 900;
          border-top: 1px solid #000;
          border-bottom: 1px solid #000;
          padding: 4px 0;
          margin-top: 3px;
        }
        
        .payment-box {
          background: #f4f4f4;
          border: 1px solid #000;
          padding: 5px;
          border-radius: 4px;
          margin: 8px 0;
          font-size: 11px;
        }
        
        .footer {
          text-align: center;
          font-size: 10px;
          border-top: 1.5px dashed #000;
          padding-top: 6px;
          margin-top: 8px;
        }
        .qr-placeholder {
          font-family: monospace;
          font-size: 9px;
          letter-spacing: 2px;
          margin-top: 4px;
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

      <div class="meta-box">
        <div class="meta-row">
          <span>رقم الفاتورة:</span>
          <span class="font-bold">${data.invoiceNumber}</span>
        </div>
        <div class="meta-row">
          <span>التاريخ والوقت:</span>
          <span>${formattedDate} • ${formattedTime}</span>
        </div>
        <div class="meta-row">
          <span>المريض:</span>
          <span class="font-bold">${data.patientName}</span>
        </div>
        ${data.patientPhone ? `<div class="meta-row"><span>الهاتف:</span><span>${data.patientPhone}</span></div>` : ''}
      </div>

      <table class="table">
        <thead>
          <tr>
            <th>الخدمة / الكشف</th>
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
          <span>المبلغ الأصلي:</span>
          <span>${data.originalPrice} ج.م</span>
        </div>
        ${
          (data.discountAmount || 0) > 0
            ? `<div class="total-row" style="color:#000;">
                <span>الخصم الممنوح:</span>
                <span>- ${data.discountAmount} ج.م</span>
              </div>`
            : ''
        }
        <div class="total-row grand-total">
          <span>الإجمالي النهائي:</span>
          <span>${data.netPrice} ج.م</span>
        </div>
      </div>

      <div class="payment-box">
        <div class="meta-row">
          <span>طريقة الدفع:</span>
          <span class="font-bold">${methodLabel}</span>
        </div>
        <div class="meta-row">
          <span>حالة الدفع:</span>
          <span class="font-bold">${statusLabel}</span>
        </div>
        ${
          data.transferNumber
            ? `<div class="meta-row"><span>رقم التحويل:</span><span class="font-bold">${data.transferNumber}</span></div>`
            : ''
        }
        ${
          data.confirmedBy
            ? `<div class="meta-row" style="font-size:10px;"><span>تم التأكيد بواسطة:</span><span>${data.confirmedBy}</span></div>`
            : ''
        }
      </div>

      <div class="footer">
        <p class="font-bold">${data.footerNote || 'نتمنى لكم دوام الصحة والعافية'}</p>
        <p style="margin-top:2px;">Clinic OS • نظام إدارة العيادات الذكي</p>
        <div class="qr-placeholder">* ${data.invoiceNumber} *</div>
      </div>
    </body>
    </html>
  `
}

/**
 * Generates clean, multi-page A4 Financial Report HTML
 */
export function generateFinancialReportHtml(data: FinancialReportPrintData): string {
  const totalExpenses = data.totals.expenses || 0
  const netProfit = data.totals.collected - totalExpenses

  return `
    <!DOCTYPE html>
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
          font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
          color: #1e293b;
          background: #ffffff;
          font-size: 11pt;
          line-height: 1.5;
        }
        .header-table {
          width: 100%;
          border-bottom: 2px solid #0f766e;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .header-title { font-size: 20pt; font-weight: 900; color: #0f766e; }
        .header-subtitle { font-size: 11pt; color: #64748b; font-weight: 600; margin-top: 4px; }
        .badge {
          display: inline-block;
          background: #f0fdf4;
          color: #166534;
          border: 1px solid #bbf7d0;
          padding: 3px 10px;
          border-radius: 9999px;
          font-size: 9pt;
          font-weight: bold;
        }
        
        .kpi-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 10px;
          margin-bottom: 20px;
        }
        .kpi-card {
          border: 1px solid #e2e8f0;
          background: #f8fafc;
          border-radius: 8px;
          padding: 10px 12px;
          text-align: right;
        }
        .kpi-card.highlight {
          background: #f0fdfa;
          border-color: #99f6e4;
        }
        .kpi-title { font-size: 9pt; font-weight: bold; color: #64748b; margin-bottom: 4px; }
        .kpi-val { font-size: 15pt; font-weight: 900; color: #0f172a; }
        .kpi-val.green { color: #059669; }
        .kpi-val.red { color: #dc2626; }
        
        .section-title {
          font-size: 13pt;
          font-weight: 900;
          color: #0f172a;
          margin: 18px 0 8px 0;
          border-right: 4px solid #0f766e;
          padding-right: 8px;
        }
        
        .data-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 9.5pt;
          margin-bottom: 16px;
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
          padding: 8px 6px;
          font-weight: bold;
          text-align: right;
          border: 1px solid #0f766e;
        }
        .data-table td {
          padding: 6px;
          border: 1px solid #e2e8f0;
        }
        .data-table tr:nth-child(even) {
          background-color: #f8fafc;
        }
        
        .footer {
          border-top: 1px solid #cbd5e1;
          padding-top: 10px;
          margin-top: 24px;
          font-size: 8.5pt;
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
            <div class="header-subtitle">التقرير المالي التفصيلي • ${data.branchLabel || 'جميع الفروع'}</div>
            <div style="font-size:9.5pt; color:#475569; margin-top:4px;">
              الفترة: من <strong>${data.fromDate}</strong> إلى <strong>${data.toDate}</strong>
            </div>
          </td>
          <td style="text-align:left; vertical-align:top;">
            <div class="badge">تقرير محاسبي معتمد</div>
            <div style="font-size:8.5pt; color:#64748b; margin-top:6px;">
              تاريخ الطباعة: ${data.generatedAtCairo}<br />
              المُعد بواسطة: ${data.generatedBy || 'إدارة العيادة'}
            </div>
          </td>
        </tr>
      </table>

      <!-- Executive KPI Cards -->
      <div class="kpi-grid">
        <div class="kpi-card">
          <div class="kpi-title">إجمالي المبيعات (Billed)</div>
          <div class="kpi-val">${data.totals.revenue.toLocaleString()} <span style="font-size:9pt;">ج.م</span></div>
        </div>
        <div class="kpi-card highlight">
          <div class="kpi-title">المحصل الفعلي (Collected)</div>
          <div class="kpi-val green">${data.totals.collected.toLocaleString()} <span style="font-size:9pt;">ج.م</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">المبالغ الآجلة (Due)</div>
          <div class="kpi-val red">${data.totals.due.toLocaleString()} <span style="font-size:9pt;">ج.م</span></div>
        </div>
        <div class="kpi-card">
          <div class="kpi-title">الخصومات الممنوحة</div>
          <div class="kpi-val">${(data.totals.discounts || 0).toLocaleString()} <span style="font-size:9pt;">ج.م</span></div>
        </div>
      </div>

      <div class="kpi-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom:12px;">
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
      <div class="section-title">بيان المعاملات والمدفوعات (${data.transactions.length} معاملة)</div>
      <table class="data-table">
        <thead>
          <tr>
            <th style="width:40px;">#</th>
            <th>المريض</th>
            <th>الفرع</th>
            <th>نوع الكشف</th>
            <th>المبلغ الأصلي</th>
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
              ? `<tr><td colspan="10" style="text-align:center; padding:16px;">لا توجد معاملات مسجلة في هذه الفترة</td></tr>`
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
                      <td>${t.date}</td>
                    </tr>
                  `
                  )
                  .join('')
          }
        </tbody>
      </table>

      <!-- Branch Breakdown if available -->
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
        <div>تم استخراج هذا التقرير آلياً بواسطة نظام Clinic OS V2 • جميع الحقوق محفوظة</div>
        <div>صفحة 1 من 1</div>
      </div>
    </body>
    </html>
  `
}
