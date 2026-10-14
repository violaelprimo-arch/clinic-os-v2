import type ExcelJS from 'exceljs'

async function createWorkbook(creator: string = 'Yalla Clinic'): Promise<any> {
  const { default: ExcelJSClass } = await import('exceljs')
  const workbook = new ExcelJSClass.Workbook()
  workbook.creator = creator
  workbook.created = new Date()
  return workbook
}

/**
 * Sanitizes values to prevent Excel Formula Injection (CSV/Formula injection attacks).
 * If a string begins with =, +, -, @, prepend a single quote '.
 */
export function sanitizeExcelValue(value: any): any {
  if (typeof value === 'string') {
    const trimmed = value.trim()
    if (/^[=+\-@]/.test(trimmed)) {
      return `'${trimmed}`
    }
  }
  return value
}

/**
 * Helper to download an Excel workbook in the browser.
 */
export async function downloadWorkbook(workbook: ExcelJS.Workbook, filename: string): Promise<void> {
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = window.URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(anchor)
  anchor.click()
  document.body.removeChild(anchor)
  window.URL.revokeObjectURL(url)
}

/**
 * Applies unified luxury styling to a worksheet:
 * - RTL orientation
 * - Dark teal header row with white bold text
 * - Alternating zebra stripes
 * - Thin light borders
 * - Auto-adjusted column widths
 */
function styleWorksheet(worksheet: ExcelJS.Worksheet) {
  worksheet.views = [{ rightToLeft: true }]

  // Style Header Row (Row 1)
  const headerRow = worksheet.getRow(1)
  headerRow.height = 28
  headerRow.eachCell((cell) => {
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0F766E' } // Teal 700
    }
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF0D9488' } },
      left: { style: 'thin', color: { argb: 'FF0D9488' } },
      bottom: { style: 'medium', color: { argb: 'FF115E59' } },
      right: { style: 'thin', color: { argb: 'FF0D9488' } }
    }
  })

  // Style data rows
  worksheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return
    row.height = 22
    const isEven = rowNumber % 2 === 0
    row.eachCell((cell) => {
      cell.font = { name: 'Arial', size: 10, color: { argb: 'FF1F2937' } }
      if (!cell.fill) {
        cell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' }
        }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
      if (!cell.alignment) {
        cell.alignment = { vertical: 'middle', horizontal: 'right' }
      }
    })
  })

  // Auto-fit column widths (minimum 14, padding 3)
  worksheet.columns.forEach((col) => {
    let maxLen = 14
    if (col.header) {
      maxLen = Math.max(maxLen, String(col.header).length + 3)
    }
    col.eachCell?.({ includeEmpty: false }, (cell) => {
      const valStr = cell.value ? String(cell.value) : ''
      if (valStr.length + 2 > maxLen) {
        maxLen = Math.min(valStr.length + 3, 40)
      }
    })
    col.width = maxLen
  })
}

/**
 * 1. Export Patients List
 */
export async function exportPatientsToExcel(
  patients: any[],
  clinicName: string = 'العيادة',
  dateRange?: { fromDate?: string; toDate?: string }
): Promise<void> {
  const workbook = await createWorkbook('Yalla Clinic')

  const worksheet = workbook.addWorksheet('سجل المرضى')
  worksheet.columns = [
    { header: '#', key: 'index', width: 8 },
    { header: 'اسم المريض', key: 'name', width: 25 },
    { header: 'رقم الهاتف', key: 'phone', width: 18 },
    { header: 'السن / تاريخ الميلاد', key: 'age', width: 18 },
    { header: 'عدد الزيارات', key: 'visits', width: 14 },
    { header: 'آخر كشف / خدمة', key: 'lastService', width: 22 },
    { header: 'تاريخ آخر زيارة', key: 'lastVisit', width: 18 },
    { header: 'الحالة', key: 'status', width: 14 }
  ]

  patients.forEach((p, idx) => {
    worksheet.addRow({
      index: idx + 1,
      name: sanitizeExcelValue(p.name || p.patientName || 'بدون اسم'),
      phone: sanitizeExcelValue(p.phone ? `'${p.phone}` : '—'),
      age: sanitizeExcelValue(p.age || p.dob || '—'),
      visits: Number(p.visitsCount || 1),
      lastService: sanitizeExcelValue(p.lastService || p.serviceName || 'كشف'),
      lastVisit: sanitizeExcelValue(p.lastVisit || p.date || '—'),
      status: sanitizeExcelValue(p.status || 'نشط')
    })
  })

  styleWorksheet(worksheet)
  const today = new Date().toISOString().split('T')[0]
  const dateSuffix = dateRange?.fromDate || dateRange?.toDate
    ? `${dateRange.fromDate ? `_من_${dateRange.fromDate}` : ''}${dateRange.toDate ? `_إلى_${dateRange.toDate}` : ''}`
    : `_${today}`
  await downloadWorkbook(workbook, `مرضى_${clinicName}${dateSuffix}.xlsx`)
}

/**
 * 2. Export Appointments / Queue
 */
export async function exportAppointmentsToExcel(
  appointments: any[],
  branchLabel: string = 'جميع الفروع',
  clinicName: string = 'العيادة'
): Promise<void> {
  const workbook = await createWorkbook('Yalla Clinic')

  const worksheet = workbook.addWorksheet('سجل الحجوزات')
  worksheet.columns = [
    { header: 'الدور', key: 'queue', width: 10 },
    { header: 'اسم المريض', key: 'patientName', width: 24 },
    { header: 'رقم الهاتف', key: 'phone', width: 18 },
    { header: 'الفرع', key: 'branch', width: 18 },
    { header: 'نوع الخدمة', key: 'service', width: 20 },
    { header: 'السعر الأصلي (ج.م)', key: 'price', width: 18 },
    { header: 'الخصم (ج.م)', key: 'discount', width: 14 },
    { header: 'الصافي (ج.م)', key: 'netPrice', width: 16 },
    { header: 'طريقة الدفع', key: 'method', width: 16 },
    { header: 'حالة الدفع', key: 'paymentStatus', width: 18 },
    { header: 'حالة الكشف', key: 'examStatus', width: 16 },
    { header: 'التاريخ', key: 'date', width: 16 },
    { header: 'وقت التسجيل', key: 'time', width: 16 }
  ]

  const methodNames: Record<string, string> = {
    cash: 'كاش بالعيادة',
    instapay: 'انستاباي',
    wallet: 'محفظة إلكترونية'
  }
  const paymentStatusNames: Record<string, string> = {
    paid: 'مدفوع ومؤكد',
    pending_verification: 'بانتظار تأكيد التحويل',
    unpaid: 'غير محصل',
    refunded: 'مسترد'
  }
  const examStatusNames: Record<string, string> = {
    waiting: 'في الانتظار',
    in_progress: 'بالداخل',
    completed: 'تم الكشف',
    skipped: 'تخطي',
    no_show: 'لم يحضر',
    cancelled: 'ملغي'
  }

  appointments.forEach((a) => {
    const rawPrice = Number(a.servicePrice) || 0
    const rawDiscount = Number(a.discountAmount) || 0
    const rawNet = Math.max(0, rawPrice - rawDiscount)

    worksheet.addRow({
      queue: a.queue_number || '--',
      patientName: sanitizeExcelValue(a.patientName || 'بدون اسم'),
      phone: sanitizeExcelValue(a.phone ? `'${a.phone}` : '—'),
      branch: sanitizeExcelValue(a.branchName || branchLabel),
      service: sanitizeExcelValue(a.serviceName || 'كشف'),
      price: rawPrice,
      discount: rawDiscount,
      netPrice: rawNet,
      method: methodNames[a.paymentMethod] || a.paymentMethod || 'كاش',
      paymentStatus: paymentStatusNames[a.paymentStatus] || a.paymentStatus || 'غير محصل',
      examStatus: examStatusNames[a.status] || a.status || 'في الانتظار',
      date: sanitizeExcelValue(a.date || '—'),
      time: a.createdAt ? new Date(a.createdAt).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : '—'
    })
  })

  styleWorksheet(worksheet)
  const today = new Date().toISOString().split('T')[0]
  await downloadWorkbook(workbook, `حجوزات_${branchLabel}_${today}.xlsx`)
}

/**
 * 3. Master Multi-Sheet Financial Workbook
 */
export async function exportComprehensiveFinancialReportExcel({
  clinicName,
  branchLabel = 'جميع الفروع',
  fromDate,
  toDate,
  appointments = [],
  expenses = [],
  branches = [],
  totals
}: {
  clinicName: string
  branchLabel?: string
  fromDate: string
  toDate: string
  appointments: any[]
  expenses?: any[]
  branches?: any[]
  totals: {
    revenue: number
    collected: number
    due: number
    cash: number
    instapay: number
    wallet: number
    discounts: number
    patientsCount: number
    expensesTotal?: number
    netProfit?: number
  }
}): Promise<void> {
  const workbook = await createWorkbook('Yalla Clinic — Medical ERP')

  // ─────────────────────────────────────────────
  // SHEET 1: SUMMARY (الملخص التنفيذي)
  // ─────────────────────────────────────────────
  const summarySheet = workbook.addWorksheet('الملخص المالي')
  summarySheet.columns = [
    { header: 'المؤشر المالي', key: 'metric', width: 32 },
    { header: 'القيمة / الإجمالي', key: 'value', width: 24 },
    { header: 'الوحدة / الملاحظات', key: 'notes', width: 28 }
  ]

  const totalExp = totals.expensesTotal || expenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  const netProfit = totals.collected - totalExp

  summarySheet.addRow({ metric: 'اسم العيادة', value: sanitizeExcelValue(clinicName), notes: 'الجهة الطبية' })
  summarySheet.addRow({ metric: 'نطاق التقرير', value: sanitizeExcelValue(branchLabel), notes: 'الفرع أو مجمع الفروع' })
  summarySheet.addRow({ metric: 'الفترة المحاسبية', value: `${fromDate} إلى ${toDate}`, notes: 'بتوقيت القاهرة' })
  summarySheet.addRow({ metric: 'إجمالي المبيعات (Billed)', value: totals.revenue, notes: 'جنيه مصري (EGP)' })
  summarySheet.addRow({ metric: 'إجمالي المحصل الفعلي (Collected)', value: totals.collected, notes: 'جنيه مصري (EGP)' })
  summarySheet.addRow({ metric: 'إجمالي المبالغ المستحقة (Due)', value: totals.due, notes: 'جنيه مصري (EGP)' })
  summarySheet.addRow({ metric: 'إجمالي الخصومات الممنوحة', value: totals.discounts || 0, notes: 'جنيه مصري (EGP)' })
  summarySheet.addRow({ metric: 'المحصل: كاش بالعيادة', value: totals.cash, notes: 'جنيه مصري (EGP)' })
  summarySheet.addRow({ metric: 'المحصل: InstaPay', value: totals.instapay, notes: 'جنيه مصري (EGP)' })
  summarySheet.addRow({ metric: 'المحصل: محفظة إلكترونية', value: totals.wallet, notes: 'جنيه مصري (EGP)' })
  summarySheet.addRow({ metric: 'إجمالي المصروفات التشغيلية', value: totalExp, notes: 'جنيه مصري (EGP)' })
  summarySheet.addRow({ metric: 'صافي التدفق النقدي (Net Cash Flow)', value: netProfit, notes: 'المحصل ناقص المصروفات' })
  summarySheet.addRow({ metric: 'إجمالي عدد الكشوفات والحجوزات', value: totals.patientsCount, notes: 'حالة / مريض' })

  styleWorksheet(summarySheet)

  // ─────────────────────────────────────────────
  // SHEET 2: PAYMENTS (تفاصيل المعاملات والمدفوعات)
  // ─────────────────────────────────────────────
  const paymentsSheet = workbook.addWorksheet('المعاملات المالية')
  paymentsSheet.columns = [
    { header: 'رقم الفاتورة / ID', key: 'id', width: 22 },
    { header: 'المريض', key: 'patient', width: 24 },
    { header: 'الهاتف', key: 'phone', width: 18 },
    { header: 'الفرع', key: 'branch', width: 18 },
    { header: 'الخدمة', key: 'service', width: 20 },
    { header: 'المبلغ الأصلي', key: 'origPrice', width: 16 },
    { header: 'الخصم', key: 'discount', width: 14 },
    { header: 'المدفوع الفعلي', key: 'paid', width: 16 },
    { header: 'المتبقي', key: 'remaining', width: 14 },
    { header: 'طريقة الدفع', key: 'method', width: 16 },
    { header: 'حالة الدفع', key: 'status', width: 18 },
    { header: 'التاريخ', key: 'date', width: 16 }
  ]

  appointments.forEach((a) => {
    const orig = Number(a.servicePrice) || 0
    const disc = Number(a.discountAmount) || 0
    const net = Math.max(0, orig - disc)
    const isPaid = a.paymentStatus === 'paid' || a.status === 'completed'
    const paidAmt = isPaid ? net : 0
    const remAmt = isPaid ? 0 : net

    paymentsSheet.addRow({
      id: sanitizeExcelValue(a.id ? `INV-${a.id.slice(-6).toUpperCase()}` : 'INV-AUTO'),
      patient: sanitizeExcelValue(a.patientName || 'مريض'),
      phone: sanitizeExcelValue(a.phone ? `'${a.phone}` : '—'),
      branch: sanitizeExcelValue(a.branchName || branchLabel),
      service: sanitizeExcelValue(a.serviceName || 'كشف'),
      origPrice: orig,
      discount: disc,
      paid: paidAmt,
      remaining: remAmt,
      method: a.paymentMethod === 'instapay' ? 'InstaPay' : a.paymentMethod === 'wallet' ? 'محفظة' : 'كاش',
      status: a.paymentStatus === 'paid' ? 'مدفوع ومؤكد' : a.paymentStatus === 'pending_verification' ? 'بانتظار التأكيد' : 'غير محصل',
      date: sanitizeExcelValue(a.date || '—')
    })
  })

  styleWorksheet(paymentsSheet)

  // ─────────────────────────────────────────────
  // SHEET 3: EXPENSES (المصروفات)
  // ─────────────────────────────────────────────
  const expensesSheet = workbook.addWorksheet('المصروفات')
  expensesSheet.columns = [
    { header: '#', key: 'index', width: 8 },
    { header: 'بيان المصروف', key: 'title', width: 28 },
    { header: 'التصنيف', key: 'category', width: 18 },
    { header: 'الفرع', key: 'branch', width: 18 },
    { header: 'المبلغ (ج.م)', key: 'amount', width: 16 },
    { header: 'تاريخ الصرف', key: 'date', width: 16 },
    { header: 'سجل بواسطة', key: 'recordedBy', width: 20 },
    { header: 'ملاحظات', key: 'notes', width: 26 }
  ]

  const catNames: Record<string, string> = {
    rent: 'إيجار',
    salaries: 'رواتب وأجور',
    supplies: 'مستلزمات طبية',
    utilities: 'مرافق وفواتير',
    maintenance: 'صيانة',
    other: 'أخرى'
  }

  expenses.forEach((e, idx) => {
    expensesSheet.addRow({
      index: idx + 1,
      title: sanitizeExcelValue(e.title || 'مصروف عام'),
      category: catNames[e.category] || e.category || 'عام',
      branch: sanitizeExcelValue(e.branchName || branchLabel),
      amount: Number(e.amount) || 0,
      date: sanitizeExcelValue(e.paidAt || '—'),
      recordedBy: sanitizeExcelValue(e.recordedBy || 'الإدارة'),
      notes: sanitizeExcelValue(e.notes || '—')
    })
  })

  styleWorksheet(expensesSheet)

  // ─────────────────────────────────────────────
  // SHEET 4: BRANCHES BREAKDOWN (تحليل الفروع)
  // ─────────────────────────────────────────────
  if (branches.length > 0) {
    const branchesSheet = workbook.addWorksheet('تحليل الفروع')
    branchesSheet.columns = [
      { header: 'اسم الفرع', key: 'name', width: 24 },
      { header: 'المنطقة / العنوان', key: 'address', width: 28 },
      { header: 'عدد الحجوزات', key: 'bookings', width: 16 },
      { header: 'إجمالي الإيرادات (ج.م)', key: 'revenue', width: 22 },
      { header: 'المحصل (ج.م)', key: 'collected', width: 18 },
      { header: 'المستحق (ج.م)', key: 'due', width: 16 },
      { header: 'حالة الفرع', key: 'status', width: 14 }
    ]

    branches.forEach((b) => {
      const bAppts = appointments.filter((a) => a.branch_id === b.id || a.branchName === b.name)
      const bRev = bAppts.reduce((sum, a) => sum + (Number(a.servicePrice) || 0), 0)
      const bCol = bAppts
        .filter((a) => a.paymentStatus === 'paid' || a.status === 'completed')
        .reduce((sum, a) => sum + (Number(a.servicePrice) - (Number(a.discountAmount) || 0)), 0)
      const bDue = Math.max(0, bRev - bCol)

      branchesSheet.addRow({
        name: sanitizeExcelValue(b.name),
        address: sanitizeExcelValue(b.address || b.area || '—'),
        bookings: bAppts.length,
        revenue: bRev,
        collected: bCol,
        due: bDue,
        status: b.isOpen ? 'مفتوح' : 'مغلق'
      })
    })

    styleWorksheet(branchesSheet)
  }

  // ─────────────────────────────────────────────
  // SHEET 5: DISCOUNTS (سجل الخصومات)
  // ─────────────────────────────────────────────
  const discountsSheet = workbook.addWorksheet('سجل الخصومات')
  discountsSheet.columns = [
    { header: 'المريض', key: 'patient', width: 24 },
    { header: 'الفرع', key: 'branch', width: 18 },
    { header: 'الخدمة', key: 'service', width: 20 },
    { header: 'السعر الأصلي', key: 'orig', width: 16 },
    { header: 'قيمة الخصم', key: 'discount', width: 16 },
    { header: 'الصافي بعد الخصم', key: 'net', width: 18 },
    { header: 'سبب الخصم', key: 'reason', width: 24 },
    { header: 'الموظف المسؤول', key: 'staff', width: 20 },
    { header: 'التاريخ', key: 'date', width: 16 }
  ]

  appointments
    .filter((a) => Number(a.discountAmount) > 0)
    .forEach((a) => {
      const orig = Number(a.servicePrice) || 0
      const disc = Number(a.discountAmount) || 0
      discountsSheet.addRow({
        patient: sanitizeExcelValue(a.patientName),
        branch: sanitizeExcelValue(a.branchName || branchLabel),
        service: sanitizeExcelValue(a.serviceName),
        orig,
        discount: disc,
        net: Math.max(0, orig - disc),
        reason: sanitizeExcelValue(a.discountReason || 'تخفيض عيادة'),
        staff: sanitizeExcelValue(a.discountedBy || 'الطبيب / الإدارة'),
        date: sanitizeExcelValue(a.date || '—')
      })
    })

  styleWorksheet(discountsSheet)

  await downloadWorkbook(workbook, `تقرير_مالي_شامل_${clinicName}_${fromDate}_${toDate}.xlsx`)
}

/**
 * Helper to determine numeric package price for a clinic
 */
function getClinicNumericPrice(c: any, packagesList: any[] = []): number {
  if (c.packagePrice !== undefined && c.packagePrice !== null && c.packagePrice !== '') {
    const num = Number(c.packagePrice)
    if (!isNaN(num) && num > 0) return num
  }
  const pkg = packagesList.find(p => p.name === c.packageName)
  if (pkg && pkg.price) {
    const num = Number(pkg.price)
    if (!isNaN(num) && num > 0) return num
  }
  const pName = (c.packageName || '').toLowerCase()
  if (pName.includes('1800') || pName.includes('ماس') || pName.includes('diamond') || pName.includes('vip')) return 1800
  if (pName.includes('950') || pName.includes('احتراف') || pName.includes('pro')) return 950
  if (pName.includes('سنو') || pName.includes('annual')) return 9500
  return 450
}

/**
 * Super-Professional Financial & Doctors Accounts Excel Export.
 * Features:
 * - Grand KPI summary cards at top (Total Due, Total Collected, Total Remaining, Unpaid count, Expiring count)
 * - Detailed financial breakdown (Price due, Collected, Remaining, Payment status)
 * - Dedicated 2nd sheet specifically for subscriptions expiring soon (or expired)
 * - Strictly NO password or sensitive credential leaks
 */
export async function exportDoctorsExcel(clinics: any[], packagesList: any[] = []): Promise<void> {
  const workbook = await createWorkbook('Yalla Clinic Super Admin')
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  // Calculate Global Financial KPIs
  let totalDue = 0
  let totalCollected = 0
  let unpaidCount = 0
  let expiringSoonCount = 0

  clinics.forEach(c => {
    const price = getClinicNumericPrice(c, packagesList)
    totalDue += price
    const paid = Number(c.paidAmount ?? (c.isPaid ? price : 0))
    totalCollected += paid
    if (paid < price) unpaidCount++

    if (c.expirationDate) {
      const exp = new Date(c.expirationDate)
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays <= 7) expiringSoonCount++
    }
  })

  const totalRemaining = Math.max(0, totalDue - totalCollected)

  // ==========================================
  // SHEET 1: تقرير الحسابات والتحصيل الشامل
  // ==========================================
  const sheet = workbook.addWorksheet('الحسابات والتحصيل الشامل')
  sheet.views = [{ rightToLeft: true }]

  // 1. Title Banner (Row 1)
  sheet.mergeCells('A1:N1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'تقرير الحسابات والاشتراكات المالية والتحصيل - Yalla Clinic Super Admin'
  titleCell.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } } // Teal 700
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 36

  // 2. Subtitle / Meta (Row 2)
  sheet.mergeCells('A2:N2')
  const subCell = sheet.getCell('A2')
  subCell.value = `تاريخ التصدير: ${todayStr} | إجمالي الأطباء والعيادات المسجلة: ${clinics.length} عيادة | تم التوليد آلياً من لوحة المالك`
  subCell.font = { name: 'Arial', size: 9, italic: true, color: { argb: 'FF475569' } }
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } }
  subCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 20

  // 3. Grand KPI Summary Cards (Row 3 & Row 4)
  sheet.mergeCells('B3:D3')
  const kpiDueTitle = sheet.getCell('B3')
  kpiDueTitle.value = 'إجمالي المبلغ المستحق (المطلوب)'
  kpiDueTitle.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF94A3B8' } }
  kpiDueTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  kpiDueTitle.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('B4:D4')
  const kpiDueVal = sheet.getCell('B4')
  kpiDueVal.value = `${totalDue.toLocaleString('ar-EG')} ج.م`
  kpiDueVal.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FFFBBF24' } } // Amber
  kpiDueVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F172A' } }
  kpiDueVal.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('E3:G3')
  const kpiCollTitle = sheet.getCell('E3')
  kpiCollTitle.value = 'المبلغ المحصل (اللي استلمته)'
  kpiCollTitle.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFA7F3D0' } }
  kpiCollTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }
  kpiCollTitle.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('E4:G4')
  const kpiCollVal = sheet.getCell('E4')
  kpiCollVal.value = `${totalCollected.toLocaleString('ar-EG')} ج.م`
  kpiCollVal.font = { name: 'Arial', size: 14, bold: true, color: { argb: 'FF34D399' } } // Emerald
  kpiCollVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF064E3B' } }
  kpiCollVal.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('H3:J3')
  const kpiRemTitle = sheet.getCell('H3')
  kpiRemTitle.value = 'المبلغ المتبقي (غير المسدد ⚠️)'
  kpiRemTitle.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFECDD3' } }
  kpiRemTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF881337' } }
  kpiRemTitle.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('H4:J4')
  const kpiRemVal = sheet.getCell('H4')
  kpiRemVal.value = `${totalRemaining.toLocaleString('ar-EG')} ج.م (${unpaidCount} عيادات)`
  kpiRemVal.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFF43F5E' } } // Rose
  kpiRemVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF881337' } }
  kpiRemVal.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('K3:M3')
  const kpiExpTitle = sheet.getCell('K3')
  kpiExpTitle.value = 'اشتراكات أوشكت على الانتهاء'
  kpiExpTitle.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FFFEF08A' } }
  kpiExpTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF713F12' } }
  kpiExpTitle.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.mergeCells('K4:M4')
  const kpiExpVal = sheet.getCell('K4')
  kpiExpVal.value = `${expiringSoonCount} اشتراكات تحتاج متابعة`
  kpiExpVal.font = { name: 'Arial', size: 12, bold: true, color: { argb: 'FFFACC15' } }
  kpiExpVal.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF713F12' } }
  kpiExpVal.alignment = { vertical: 'middle', horizontal: 'center' }

  sheet.getRow(3).height = 18
  sheet.getRow(4).height = 26

  // Row 5: Spacer
  sheet.getRow(5).height = 10

  // 4. Table Columns Header (Row 6)
  const headers = [
    '#',
    'اسم الطبيب المعالج',
    'رقم الهاتف للتواصل',
    'اسم العيادة',
    'تاريخ بدء الاشتراك',
    'تاريخ انتهاء الاشتراك',
    'المتبقي على الانتهاء',
    'باقة الاشتراك',
    'سعر الباقة المستحق (ج.م)',
    'المبلغ المحصل (ج.م)',
    'المبلغ المتبقي (ج.م)',
    'حالة السداد',
    'حالة الحساب',
    'مواعيد العمل الأسبوعية'
  ]

  const headerRow = sheet.getRow(6)
  headerRow.height = 26
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } } // Slate 800
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FF334155' } },
      bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
      left: { style: 'thin', color: { argb: 'FF334155' } },
      right: { style: 'thin', color: { argb: 'FF334155' } }
    }
  })

  // 5. Add Data Rows
  clinics.forEach((c, idx) => {
    const rowNum = 7 + idx
    const row = sheet.getRow(rowNum)
    row.height = 24
    const isEven = idx % 2 === 0

    const price = getClinicNumericPrice(c, packagesList)
    const paid = Number(c.paidAmount ?? (c.isPaid ? price : 0))
    const remaining = Math.max(0, price - paid)
    const isFullyPaid = paid >= price

    // Expiration
    let remainingDaysStr = 'اشتراك مفتوح'
    let statusAccountStr = c.isActive === false ? 'موقوف' : 'نشط'
    if (c.expirationDate) {
      const exp = new Date(c.expirationDate)
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) {
        remainingDaysStr = `منتهي منذ ${Math.abs(diffDays)} يوم 🛑`
        statusAccountStr = 'منتهي الصلاحية'
      } else if (diffDays <= 7) {
        remainingDaysStr = `ينتهي خلال ${diffDays} يوم ⚠️`
        statusAccountStr = 'ينتهي قريباً'
      } else {
        remainingDaysStr = `متبقي ${diffDays} يوم`
        statusAccountStr = 'ساري'
      }
    }

    // Schedule string
    let scheduleStr = 'السبت - الخميس (05:00 م - 10:00 م)'
    if (Array.isArray(c.weeklySchedule) && c.weeklySchedule.length > 0) {
      const open = c.weeklySchedule.filter((s: any) => s.isOpen !== false)
      if (open.length === 7) scheduleStr = 'طوال أيام الأسبوع'
      else if (open.length > 0) scheduleStr = `${open.length} أيام أسبوعياً`
      else scheduleStr = 'مغلق مؤقتاً'
    }

    const phoneStr = c.doctorPhone || c.clinicPhone || '—'

    row.getCell(1).value = idx + 1
    row.getCell(2).value = sanitizeExcelValue(c.doctorName ? `د. ${c.doctorName}` : 'طبيب العيادة')
    row.getCell(3).value = sanitizeExcelValue(phoneStr)
    row.getCell(4).value = sanitizeExcelValue(c.clinicName || '—')
    row.getCell(5).value = sanitizeExcelValue(c.activationDate || '—')
    row.getCell(6).value = sanitizeExcelValue(c.expirationDate || 'مفتوح')
    row.getCell(7).value = sanitizeExcelValue(remainingDaysStr)
    row.getCell(8).value = sanitizeExcelValue(c.packageName || 'الباقة الأساسية')
    row.getCell(9).value = price
    row.getCell(10).value = paid
    row.getCell(11).value = remaining
    row.getCell(12).value = isFullyPaid ? 'مسدد بالكامل ✅' : 'غير مسدد 🛑'
    row.getCell(13).value = sanitizeExcelValue(statusAccountStr)
    row.getCell(14).value = sanitizeExcelValue(scheduleStr)

    // Format Cells
    for (let colIdx = 1; colIdx <= 14; colIdx++) {
      const cell = row.getCell(colIdx)
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF1F2937' } }
      cell.alignment = { vertical: 'middle', horizontal: [1, 5, 6, 7, 9, 10, 11, 12, 13].includes(colIdx) ? 'center' : 'right' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFF8FAFC' : 'FFFFFFFF' }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
        right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
      }
    }

    // Numbers & Currency format
    row.getCell(9).numFmt = '#,##0 "ج.م"'
    row.getCell(10).numFmt = '#,##0 "ج.م"'
    row.getCell(11).numFmt = '#,##0 "ج.م"'

    // Payment Status badge highlight
    const paymentCell = row.getCell(12)
    if (isFullyPaid) {
      paymentCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF065F46' } }
      paymentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD1FAE5' } } // Light green
    } else {
      paymentCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF9F1239' } }
      paymentCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFE4E6' } } // Light rose
    }

    // Remaining days urgency highlight
    if (remainingDaysStr.includes('🛑') || remainingDaysStr.includes('⚠️')) {
      const remCell = row.getCell(7)
      remCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: remainingDaysStr.includes('🛑') ? 'FF991B1B' : 'FF92400E' } }
      remCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: remainingDaysStr.includes('🛑') ? 'FFFEE2E2' : 'FFFEF3C7' } }
    }
  })

  // Set Column Widths for Sheet 1
  const colWidths = [6, 24, 18, 26, 15, 15, 20, 20, 18, 18, 18, 18, 16, 28]
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })

  // ==========================================
  // SHEET 2: اشتراكات قاربت على الانتهاء
  // ==========================================
  const expiringClinics = clinics.filter(c => {
    if (!c.expirationDate) return false
    const exp = new Date(c.expirationDate)
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 14 // Expiring in 14 days or already expired
  })

  const sheetExp = workbook.addWorksheet('اشتراكات أوشكت على الانتهاء')
  sheetExp.views = [{ rightToLeft: true }]

  sheetExp.mergeCells('A1:J1')
  const expTitle = sheetExp.getCell('A1')
  expTitle.value = 'كشف الاشتراكات التي أوشكت على الانتهاء والمنتهية (متابعة التجديد الفوري)'
  expTitle.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
  expTitle.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFB45309' } } // Amber 700
  expTitle.alignment = { vertical: 'middle', horizontal: 'center' }
  sheetExp.getRow(1).height = 34

  sheetExp.mergeCells('A2:J2')
  const expSub = sheetExp.getCell('A2')
  expSub.value = `إجمالي الاشتراكات التي تتطلب تجديداً: ${expiringClinics.length} عيادة | يرجى التواصل مع الأطباء لتجديد الاشتراك قبل إيقاف الخدمة`
  expSub.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF78350F' } }
  expSub.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
  expSub.alignment = { vertical: 'middle', horizontal: 'center' }
  sheetExp.getRow(2).height = 22

  const expHeaders = [
    '#',
    'اسم الطبيب',
    'رقم الهاتف',
    'اسم العيادة',
    'تاريخ انتهاء الاشتراك',
    'المدة المتبقية على الانتهاء',
    'باقة الاشتراك الحالية',
    'قيمة التجديد (ج.م)',
    'حالة سداد الاشتراك الحالي',
    'رابط المتابعة واتساب'
  ]

  const expHeaderRow = sheetExp.getRow(4)
  expHeaderRow.height = 26
  expHeaders.forEach((h, i) => {
    const cell = expHeaderRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF78350F' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
    cell.border = {
      top: { style: 'thin', color: { argb: 'FFB45309' } },
      bottom: { style: 'medium', color: { argb: 'FF451A03' } },
      left: { style: 'thin', color: { argb: 'FFB45309' } },
      right: { style: 'thin', color: { argb: 'FFB45309' } }
    }
  })

  expiringClinics.forEach((c, idx) => {
    const rowNum = 5 + idx
    const row = sheetExp.getRow(rowNum)
    row.height = 24
    const isEven = idx % 2 === 0
    const price = getClinicNumericPrice(c, packagesList)
    const paid = Number(c.paidAmount ?? (c.isPaid ? price : 0))
    const isFullyPaid = paid >= price

    const exp = new Date(c.expirationDate)
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const remainingText = diffDays < 0 ? `منتهي منذ ${Math.abs(diffDays)} يوم 🛑` : diffDays === 0 ? 'ينتهي اليوم ⚠️' : `متبقي ${diffDays} يوم ⚠️`
    const phoneClean = (c.doctorPhone || c.clinicPhone || '').replace(/\D/g, '')
    const waLink = phoneClean ? `https://wa.me/2${phoneClean.replace(/^0+/, '')}` : '—'

    row.getCell(1).value = idx + 1
    row.getCell(2).value = sanitizeExcelValue(c.doctorName ? `د. ${c.doctorName}` : 'طبيب العيادة')
    row.getCell(3).value = sanitizeExcelValue(c.doctorPhone || c.clinicPhone || '—')
    row.getCell(4).value = sanitizeExcelValue(c.clinicName || '—')
    row.getCell(5).value = sanitizeExcelValue(c.expirationDate)
    row.getCell(6).value = sanitizeExcelValue(remainingText)
    row.getCell(7).value = sanitizeExcelValue(c.packageName || 'الباقة الأساسية')
    row.getCell(8).value = price
    row.getCell(9).value = isFullyPaid ? 'مسدد ✅' : 'غير مسدد 🛑'
    row.getCell(10).value = waLink

    for (let colIdx = 1; colIdx <= 10; colIdx++) {
      const cell = row.getCell(colIdx)
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF1F2937' } }
      cell.alignment = { vertical: 'middle', horizontal: [1, 5, 6, 8, 9].includes(colIdx) ? 'center' : 'right' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFBEB' : 'FFFFFFFF' }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFDE68A' } },
        bottom: { style: 'thin', color: { argb: 'FFFDE68A' } },
        left: { style: 'thin', color: { argb: 'FFFDE68A' } },
        right: { style: 'thin', color: { argb: 'FFFDE68A' } }
      }
    }

    row.getCell(8).numFmt = '#,##0 "ج.م"'
    const remCell = row.getCell(6)
    remCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: diffDays < 0 ? 'FF991B1B' : 'FF92400E' } }
    remCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: diffDays < 0 ? 'FFFEE2E2' : 'FFFEF3C7' } }
  })

  const expWidths = [6, 24, 18, 26, 18, 22, 20, 18, 16, 28]
  expWidths.forEach((w, i) => {
    sheetExp.getColumn(i + 1).width = w
  })

  await downloadWorkbook(workbook, `تقرير_الحسابات_والتحصيل_والاشتراكات_${todayStr}.xlsx`)
}

/**
 * Dedicated Export for Expiring and Overdue Subscriptions.
 */
export async function exportExpiringSubscriptionsExcel(clinics: any[], packagesList: any[] = []): Promise<void> {
  const workbook = await createWorkbook('Yalla Clinic Super Admin')
  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const expiringClinics = clinics.filter(c => {
    if (!c.expirationDate) return false
    const exp = new Date(c.expirationDate)
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    return diffDays <= 14 // Expiring within 14 days or expired
  })

  const sheet = workbook.addWorksheet('اشتراكات قاربت على الانتهاء')
  sheet.views = [{ rightToLeft: true }]

  sheet.mergeCells('A1:I1')
  const titleCell = sheet.getCell('A1')
  titleCell.value = 'كشف الأطباء والعيادات التي قاربت اشتراكاتهم على الانتهاء - متابعة التجديد'
  titleCell.font = { name: 'Arial', size: 13, bold: true, color: { argb: 'FFFFFFFF' } }
  titleCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFD97706' } } // Amber 600
  titleCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(1).height = 36

  sheet.mergeCells('A2:I2')
  const subCell = sheet.getCell('A2')
  subCell.value = `تاريخ التقرير: ${todayStr} | عدد العيادات المستهدفة للتجديد: ${expiringClinics.length} عيادة`
  subCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: 'FF92400E' } }
  subCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } }
  subCell.alignment = { vertical: 'middle', horizontal: 'center' }
  sheet.getRow(2).height = 22

  const headers = [
    '#',
    'اسم الطبيب',
    'رقم هاتف الطبيب',
    'اسم العيادة',
    'تاريخ انتهاء الاشتراك',
    'المدة المتبقية على الانتهاء',
    'باقة الاشتراك الحالية',
    'رسوم التجديد المستحقة (ج.م)',
    'رابط المتابعة واتساب'
  ]

  const headerRow = sheet.getRow(4)
  headerRow.height = 26
  headers.forEach((h, i) => {
    const cell = headerRow.getCell(i + 1)
    cell.value = h
    cell.font = { name: 'Arial', size: 10, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  expiringClinics.forEach((c, idx) => {
    const rowNum = 5 + idx
    const row = sheet.getRow(rowNum)
    row.height = 24
    const isEven = idx % 2 === 0
    const price = getClinicNumericPrice(c, packagesList)

    const exp = new Date(c.expirationDate)
    const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
    const remainingText = diffDays < 0 ? `منتهي منذ ${Math.abs(diffDays)} يوم 🛑` : diffDays === 0 ? 'ينتهي اليوم ⚠️' : `متبقي ${diffDays} يوم ⚠️`
    const phoneClean = (c.doctorPhone || c.clinicPhone || '').replace(/\D/g, '')
    const waLink = phoneClean ? `https://wa.me/2${phoneClean.replace(/^0+/, '')}` : '—'

    row.getCell(1).value = idx + 1
    row.getCell(2).value = sanitizeExcelValue(c.doctorName ? `د. ${c.doctorName}` : 'طبيب العيادة')
    row.getCell(3).value = sanitizeExcelValue(c.doctorPhone || c.clinicPhone || '—')
    row.getCell(4).value = sanitizeExcelValue(c.clinicName || '—')
    row.getCell(5).value = sanitizeExcelValue(c.expirationDate)
    row.getCell(6).value = sanitizeExcelValue(remainingText)
    row.getCell(7).value = sanitizeExcelValue(c.packageName || 'الباقة الأساسية')
    row.getCell(8).value = price
    row.getCell(9).value = waLink

    for (let colIdx = 1; colIdx <= 9; colIdx++) {
      const cell = row.getCell(colIdx)
      cell.font = { name: 'Arial', size: 9, color: { argb: 'FF1F2937' } }
      cell.alignment = { vertical: 'middle', horizontal: [1, 5, 6, 8].includes(colIdx) ? 'center' : 'right' }
      cell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: isEven ? 'FFFFFBEB' : 'FFFFFFFF' }
      }
      cell.border = {
        top: { style: 'thin', color: { argb: 'FFFDE68A' } },
        bottom: { style: 'thin', color: { argb: 'FFFDE68A' } },
        left: { style: 'thin', color: { argb: 'FFFDE68A' } },
        right: { style: 'thin', color: { argb: 'FFFDE68A' } }
      }
    }

    row.getCell(8).numFmt = '#,##0 "ج.م"'
    const remCell = row.getCell(6)
    remCell.font = { name: 'Arial', size: 9, bold: true, color: { argb: diffDays < 0 ? 'FF991B1B' : 'FF92400E' } }
    remCell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: diffDays < 0 ? 'FFFEE2E2' : 'FFFEF3C7' } }
  })

  const colWidths = [6, 24, 18, 26, 18, 24, 20, 20, 28]
  colWidths.forEach((w, i) => {
    sheet.getColumn(i + 1).width = w
  })

  await downloadWorkbook(workbook, `كشف_الاشتراكات_التي_قاربت_على_الانتهاء_${todayStr}.xlsx`)
}

