import type ExcelJS from 'exceljs'

async function createWorkbook(creator: string = 'Clinic OS V2'): Promise<any> {
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
  const workbook = await createWorkbook('Clinic OS V2')

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
  const workbook = await createWorkbook('Clinic OS V2')

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
  const workbook = await createWorkbook('Clinic OS V2 — Medical ERP')

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
 * Exports all Doctor accounts, clinic information, and working schedules to an Excel sheet.
 */
export async function exportDoctorsExcel(clinics: any[]): Promise<void> {
  const workbook = await createWorkbook('Clinic OS Owner')
  const sheet = workbook.addWorksheet('بيانات الأطباء والمواعيد')

  sheet.columns = [
    { header: '#', key: 'index', width: 8 },
    { header: 'اسم الطبيب', key: 'doctorName', width: 24 },
    { header: 'اسم العيادة', key: 'clinicName', width: 24 },
    { header: 'التخصص الطبي', key: 'specialty', width: 22 },
    { header: 'هاتف العيادة', key: 'clinicPhone', width: 18 },
    { header: 'هاتف الطبيب الشخصي', key: 'doctorPhone', width: 18 },
    { header: 'البريد الإلكتروني للطبيب', key: 'doctorEmail', width: 26 },
    { header: 'كلمة مرور الطبيب', key: 'doctorPassword', width: 18 },
    { header: 'بريد المساعد', key: 'assistantEmail', width: 24 },
    { header: 'كلمة مرور المساعد', key: 'assistantPassword', width: 18 },
    { header: 'العنوان / المحافظة', key: 'address', width: 28 },
    { header: 'رابط العيادة (Slug)', key: 'slug', width: 18 },
    { header: 'مواعيد وجدول العمل الأسبوعي', key: 'schedule', width: 45 },
    { header: 'الباقة الحالية', key: 'packageName', width: 18 },
    { header: 'تاريخ بدء الاشتراك', key: 'activationDate', width: 16 },
    { header: 'تاريخ انتهاء الاشتراك', key: 'expirationDate', width: 16 },
    { header: 'حالة الحساب والاشتراك', key: 'status', width: 18 },
    { header: 'المساعد الذكي (AI)', key: 'aiStatus', width: 16 },
    { header: 'استهلاك ردود AI', key: 'aiUsage', width: 18 },
    { header: 'الحد الأقصى للفروع', key: 'maxBranches', width: 16 }
  ]

  const now = new Date()

  clinics.forEach((c, idx) => {
    // Format working schedule into readable string
    let scheduleStr = 'غير محدد'
    if (Array.isArray(c.weeklySchedule) && c.weeklySchedule.length > 0) {
      const openDays = c.weeklySchedule
        .filter((s: any) => s.isOpen)
        .map((s: any) => `${s.day || s.id}: ${s.start || '09:00'} - ${s.end || '22:00'}`)
      if (openDays.length > 0) {
        scheduleStr = openDays.join(' | ')
      } else {
        scheduleStr = 'مغلق طوال الأسبوع'
      }
    } else if (c.workingDays && c.workingDays.length > 0) {
      scheduleStr = `${c.workingDays.join(', ')} (${c.workingHoursStart || '09:00'} - ${c.workingHoursEnd || '22:00'})`
    }

    // Determine expiration status
    let statusStr = c.isActive === false ? 'معطل' : 'نشط'
    if (c.expirationDate) {
      const exp = new Date(c.expirationDate)
      const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
      if (diffDays < 0) {
        statusStr = `منتهي الصلاحية (${Math.abs(diffDays)} يوم)`
      } else if (diffDays <= 7) {
        statusStr = `ينتهي قريباً (متبقي ${diffDays} يوم)`
      } else {
        statusStr = `ساري (متبقي ${diffDays} يوم)`
      }
    }

    // AI quota string
    const aiLimit = c.aiResponsesLimit ?? 100
    const aiCount = c.aiResponsesCount ?? 0
    const aiUsageStr = `${aiCount} / ${aiLimit}`

    sheet.addRow({
      index: idx + 1,
      doctorName: sanitizeExcelValue(c.doctorName || '—'),
      clinicName: sanitizeExcelValue(c.clinicName || '—'),
      specialty: sanitizeExcelValue(c.specialty || 'طبيب عام'),
      clinicPhone: sanitizeExcelValue(c.clinicPhone || c.clinicPhones?.[0] || '—'),
      doctorPhone: sanitizeExcelValue(c.doctorPhone || '—'),
      doctorEmail: sanitizeExcelValue(c.doctorEmail || '—'),
      doctorPassword: sanitizeExcelValue(c.doctorPassword || '—'),
      assistantEmail: sanitizeExcelValue(c.assistantEmail || '—'),
      assistantPassword: sanitizeExcelValue(c.assistantPassword || '—'),
      address: sanitizeExcelValue(c.clinicAddress || '—'),
      slug: sanitizeExcelValue(c.slug || '—'),
      schedule: sanitizeExcelValue(scheduleStr),
      packageName: sanitizeExcelValue(c.packageName || 'الأساسية'),
      activationDate: sanitizeExcelValue(c.activationDate || '—'),
      expirationDate: sanitizeExcelValue(c.expirationDate || '—'),
      status: sanitizeExcelValue(statusStr),
      aiStatus: c.aiEnabled !== false ? 'مفعل' : 'معطل',
      aiUsage: sanitizeExcelValue(aiUsageStr),
      maxBranches: c.maxBranches || 1
    })
  })

  styleWorksheet(sheet)

  const todayStr = new Date().toISOString().split('T')[0]
  await downloadWorkbook(workbook, `حسابات_الأطباء_ومواعيد_العيادات_${todayStr}.xlsx`)
}

