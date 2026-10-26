/**
 * Analytics Export Engine
 * Generates structured, multi-worksheet Excel workbooks and print-ready A4 HTML reports
 * for the Clinic Analytics & Statistics dashboard.
 */

import { printHtmlViaIframe } from './printService'
import { AgeAnalysisResult, DiagnosisItem, AttendanceMetrics, TimingMetrics } from './analyticsService'
import { AreaDataPoint } from '@/components/clinic/analytics/GeographicDistributionCard'
import { PaymentMethodItem } from '@/components/clinic/analytics/PaymentAnalyticsCard'
import { ServicePerformanceItem } from '@/components/clinic/analytics/ServicesPerformanceCard'
import { FinancialAnalysisData } from '@/components/clinic/analytics/FinancialAnalysisCard'

export interface AnalyticsExportPayload {
  clinic: any
  branchName: string
  dateRange: { from: string; to: string }
  comparisonRange?: { from: string; to: string } | null
  exportTime: string
  kpis: {
    uniquePatients: number
    completedVisits: number
    attendanceRate: number
    netCollections: number
    meanWaitMins: number | null
    meanConsultMins: number | null
    completenessScore: number
  }
  ageAnalysis: AgeAnalysisResult
  geographicData: AreaDataPoint[]
  unrecordedAreaCount: number
  paymentMethods: PaymentMethodItem[]
  financialSummary: FinancialAnalysisData
  diagnoses: DiagnosisItem[]
  services: ServicePerformanceItem[]
  attendanceMetrics: AttendanceMetrics
  timingMetrics: TimingMetrics
  canViewFinance: boolean
}

/**
 * Generates and downloads a multi-sheet, beautifully styled Excel file using exceljs
 */
export async function exportAnalyticsToExcel(payload: AnalyticsExportPayload): Promise<void> {
  const { default: ExcelJS } = await import('exceljs')
  const workbook = new ExcelJS.Workbook()
  workbook.creator = `${payload.clinic?.clinicName || 'Yalla Clinic'} - Analytics`
  workbook.created = new Date()

  const headerFill: any = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF087CF4' } // Primary Blue
  }

  const subHeaderFill: any = {
    type: 'pattern',
    pattern: 'solid',
    fgColor: { argb: 'FF07162D' } // Deep Navy
  }

  const borderStyle: any = {
    top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
    right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
  }

  // ==========================================
  // SHEET 1: المؤشرات الأساسية (KPI Overview)
  // ==========================================
  const wsKpi = workbook.addWorksheet('المؤشرات العامة')
  wsKpi.views = [{ rightToLeft: true }]

  wsKpi.columns = [
    { header: 'المؤشر الإحصائي', key: 'metric', width: 35 },
    { header: 'القيمة المحسوبة', key: 'value', width: 25 },
    { header: 'الوحدة / التوضيح', key: 'desc', width: 45 }
  ]

  wsKpi.addRows([
    { metric: 'اسم العيادة', value: payload.clinic?.clinicName || 'العيادة', desc: 'المنشأة الطبية' },
    { metric: 'الطبيب المسؤول', value: payload.clinic?.doctorName ? `د. ${payload.clinic.doctorName}` : '—', desc: payload.clinic?.specialty || '' },
    { metric: 'الفرع المحدد', value: payload.branchName, desc: 'نطاق استخراج التقرير' },
    { metric: 'الفترة المعتمدة', value: `${payload.dateRange.from} إلى ${payload.dateRange.to}`, desc: 'نطاق التواريخ للحساب' },
    { metric: 'توقيت وتاريخ الاستخراج', value: payload.exportTime, desc: 'توقيت القاهرة (Africa/Cairo)' },
    { metric: '', value: '', desc: '' },
    { metric: 'إجمالي المرضى الفريدين', value: payload.kpis.uniquePatients, desc: 'مريض فريد بدون تكرار داخل الفترة' },
    { metric: 'الزيارات الطبية المكتملة', value: payload.kpis.completedVisits, desc: 'كشف طبي مكتمل وموثق' },
    { metric: 'نسبة الحضور الملتزم', value: `${payload.kpis.attendanceRate}%`, desc: 'من إجمالي المواعيد المحسومة' },
    { metric: 'صافي التحصيل المؤكد', value: payload.canViewFinance ? `${payload.kpis.netCollections.toLocaleString()} ج.م` : 'محجوب', desc: 'المحصل فعلياً بعد خصم المرتجعات' },
    { metric: 'متوسط زمن الانتظار', value: payload.kpis.meanWaitMins !== null ? `${payload.kpis.meanWaitMins} دقيقة` : '—', desc: 'من الوصول وحتى الدخول للكشف' },
    { metric: 'متوسط مدة الكشف', value: payload.kpis.meanConsultMins !== null ? `${payload.kpis.meanConsultMins} دقيقة` : '—', desc: 'مدة الفحص الفعلي مع الطبيب' },
    { metric: 'مؤشر جودة واكتمال السجلات', value: `${payload.kpis.completenessScore}%`, desc: 'استيفاء العمر والمنطقة والتشخيص والدفع' }
  ])

  // Style Header
  const row1 = wsKpi.getRow(1)
  row1.height = 26
  row1.eachCell((cell) => {
    cell.fill = headerFill
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  // ==========================================
  // SHEET 2: توزيع الأعمار (Age Distribution)
  // ==========================================
  const wsAge = workbook.addWorksheet('توزيع الأعمار')
  wsAge.views = [{ rightToLeft: true }]
  wsAge.columns = [
    { header: 'الفئة العمرية', key: 'bracket', width: 35 },
    { header: 'النطاق بالسنوات', key: 'range', width: 20 },
    { header: 'عدد المرضى', key: 'count', width: 20 },
    { header: 'النسبة المئوية', key: 'pct', width: 20 }
  ]

  payload.ageAnalysis.categories.forEach((c) => {
    wsAge.addRow({
      bracket: c.labelAr,
      range: `${c.range} سنة`,
      count: c.count,
      pct: `${c.percentage}%`
    })
  })

  wsAge.addRow({
    bracket: 'بيانات عمر غير مسجلة بالملف',
    range: '—',
    count: payload.ageAnalysis.missingAgeCount,
    pct: `${payload.ageAnalysis.missingAgePercentage}%`
  })

  wsAge.getRow(1).height = 26
  wsAge.getRow(1).eachCell((cell) => {
    cell.fill = headerFill
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  // ==========================================
  // SHEET 3: توزيع المناطق (Geographic Distribution)
  // ==========================================
  const wsGeo = workbook.addWorksheet('التوزيع الجغرافي')
  wsGeo.views = [{ rightToLeft: true }]
  wsGeo.columns = [
    { header: 'المنطقة / الحي', key: 'area', width: 30 },
    { header: 'المحافظة', key: 'gov', width: 25 },
    { header: 'عدد المرضى', key: 'count', width: 20 },
    { header: 'النسبة المئوية', key: 'pct', width: 20 }
  ]

  payload.geographicData.forEach((g) => {
    wsGeo.addRow({
      area: g.nameAr,
      gov: g.governorateAr,
      count: g.patientCount,
      pct: `${g.percentage}%`
    })
  })

  if (payload.unrecordedAreaCount > 0) {
    wsGeo.addRow({
      area: 'منطقة غير مسجلة بملف المريض',
      gov: 'غير محدد',
      count: payload.unrecordedAreaCount,
      pct: `${Math.round((payload.unrecordedAreaCount / Math.max(1, payload.kpis.uniquePatients)) * 100)}%`
    })
  }

  wsGeo.getRow(1).height = 26
  wsGeo.getRow(1).eachCell((cell) => {
    cell.fill = headerFill
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  // ==========================================
  // SHEET 4: طرق الدفع والتحصيل (Payments)
  // ==========================================
  if (payload.canViewFinance) {
    const wsPay = workbook.addWorksheet('وسائل الدفع والتحصيل')
    wsPay.views = [{ rightToLeft: true }]
    wsPay.columns = [
      { header: 'وسيلة الدفع', key: 'method', width: 25 },
      { header: 'العمليات المؤكدة', key: 'confirmedCount', width: 20 },
      { header: 'المبلغ المؤكد (ج.م)', key: 'confirmedAmount', width: 25 },
      { header: 'المرضى الفريدين', key: 'patients', width: 20 },
      { header: 'عمليات معلقة', key: 'pendingCount', width: 20 },
      { header: 'مبالغ معلقة (ج.م)', key: 'pendingAmount', width: 25 },
      { header: 'المرتجعات (ج.م)', key: 'refunds', width: 20 }
    ]

    payload.paymentMethods.forEach((m) => {
      wsPay.addRow({
        method: m.nameAr,
        confirmedCount: m.confirmedCount,
        confirmedAmount: m.confirmedAmount,
        patients: `${m.uniquePatientsCount} (${m.uniquePatientsPercentage}%)`,
        pendingCount: m.pendingCount,
        pendingAmount: m.pendingAmount,
        refunds: m.refundedAmount
      })
    })

    wsPay.getRow(1).height = 26
    wsPay.getRow(1).eachCell((cell) => {
      cell.fill = headerFill
      cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
      cell.alignment = { vertical: 'middle', horizontal: 'center' }
    })
  }

  // ==========================================
  // SHEET 5: أكثر التشخيصات (Diagnoses)
  // ==========================================
  const wsDiag = workbook.addWorksheet('أكثر التشخيصات')
  wsDiag.views = [{ rightToLeft: true }]
  wsDiag.columns = [
    { header: 'التشخيص الطبي', key: 'diag', width: 40 },
    { header: 'عدد المرضى الموثقين', key: 'count', width: 22 },
    { header: 'النسبة من الكشوفات', key: 'pct', width: 22 },
    { header: 'الحالة', key: 'status', width: 20 }
  ]

  payload.diagnoses.forEach((d) => {
    wsDiag.addRow({
      diag: d.name,
      count: d.patientCount,
      pct: `${d.percentage}%`,
      status: d.isUnclassified ? 'غير مصنف' : 'مؤكد'
    })
  })

  wsDiag.getRow(1).height = 26
  wsDiag.getRow(1).eachCell((cell) => {
    cell.fill = headerFill
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  // ==========================================
  // SHEET 6: أداء الخدمات الطبية (Services)
  // ==========================================
  const wsSvc = workbook.addWorksheet('أداء الخدمات الطبية')
  wsSvc.views = [{ rightToLeft: true }]
  wsSvc.columns = [
    { header: 'الخدمة الطبية', key: 'name', width: 35 },
    { header: 'الزيارات المكتملة', key: 'visits', width: 20 },
    { header: 'المرضى الفريدين', key: 'patients', width: 20 },
    { header: 'إجمالي الدخل (ج.م)', key: 'rev', width: 25 },
    { header: 'متوسط السعر (ج.م)', key: 'avg', width: 20 }
  ]

  payload.services.forEach((s) => {
    wsSvc.addRow({
      name: s.name + (s.isArchived ? ' (مؤرشفة)' : ''),
      visits: s.completedVisitsCount,
      patients: s.uniquePatientsCount,
      rev: s.totalRevenue,
      avg: Math.round(s.averagePrice)
    })
  })

  wsSvc.getRow(1).height = 26
  wsSvc.getRow(1).eachCell((cell) => {
    cell.fill = headerFill
    cell.font = { name: 'Arial', size: 11, bold: true, color: { argb: 'FFFFFFFF' } }
    cell.alignment = { vertical: 'middle', horizontal: 'center' }
  })

  // Trigger browser download
  const buffer = await workbook.xlsx.writeBuffer()
  const blob = new Blob([buffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  const cleanDate = payload.dateRange.from === payload.dateRange.to
    ? payload.dateRange.from
    : `${payload.dateRange.from}_to_${payload.dateRange.to}`
  a.download = `تقرير_التحليلات_الطبية_${cleanDate}.xlsx`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  window.URL.revokeObjectURL(url)
}

/**
 * Generates an isolated, ultra-clean HTML printable document and triggers print/PDF
 */
export function printAnalyticsReport(payload: AnalyticsExportPayload): void {
  const html = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="utf-8">
  <title>تقرير التحليلات والإحصائيات الطبية - ${payload.clinic?.clinicName || 'العيادة'}</title>
  <style>
    @page { size: A4 portrait; margin: 15mm; }
    body {
      font-family: 'Segoe UI', Tahoma, Arial, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      margin: 0;
      padding: 0;
      line-height: 1.5;
      font-size: 12px;
    }
    .header {
      border-bottom: 2px solid #087CF4;
      padding-bottom: 12px;
      margin-bottom: 16px;
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
    }
    .clinic-title { font-size: 20px; font-weight: 900; color: #087CF4; margin: 0; }
    .doctor-name { font-size: 13px; font-weight: 700; color: #334155; margin: 2px 0; }
    .report-badge {
      display: inline-block;
      padding: 4px 10px;
      background: #EFF6FF;
      color: #087CF4;
      border-radius: 8px;
      font-weight: 800;
      font-size: 11px;
      border: 1px solid #BFDBFE;
    }
    .meta-box {
      background: #F8FAFC;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      padding: 10px 14px;
      margin-bottom: 16px;
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      font-size: 11px;
    }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 10px;
      margin-bottom: 16px;
    }
    .kpi-card {
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      padding: 10px;
      background: #FAFAFA;
      text-align: center;
    }
    .kpi-card h4 { margin: 0; font-size: 10px; color: #64748B; font-weight: 700; }
    .kpi-card .val { font-size: 18px; font-weight: 900; margin: 4px 0 2px; color: #0F172A; }
    .kpi-card .sub { font-size: 9px; color: #64748B; }
    h3.section-title {
      font-size: 13px;
      font-weight: 800;
      color: #087CF4;
      border-right: 4px solid #087CF4;
      padding-right: 8px;
      margin: 16px 0 8px;
    }
    table { width: 100%; border-collapse: collapse; margin-bottom: 14px; font-size: 11px; }
    th, td { border: 1px solid #E2E8F0; padding: 6px 8px; text-align: right; }
    th { background: #F1F5F9; font-weight: 800; color: #1E293B; }
    .footer {
      border-top: 1px solid #E2E8F0;
      padding-top: 8px;
      font-size: 9px;
      color: #94A3B8;
      display: flex;
      justify-content: space-between;
      margin-top: 20px;
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1 class="clinic-title">${payload.clinic?.clinicName || 'العيادة الطبية'}</h1>
      <div class="doctor-name">${payload.clinic?.doctorName ? `د. ${payload.clinic.doctorName}` : ''} ${payload.clinic?.specialty ? `— ${payload.clinic.specialty}` : ''}</div>
      <div style="font-size: 11px; color: #64748B; margin-top: 2px;">فرع: ${payload.branchName}</div>
    </div>
    <div style="text-align: left;">
      <span class="report-badge">تقرير التحليلات والإحصائيات المعتمد</span>
      <div style="font-size: 10px; color: #64748B; margin-top: 4px;">تاريخ الاستخراج: ${payload.exportTime}</div>
    </div>
  </div>

  <div class="meta-box">
    <div><strong>الفترة المعتمدة:</strong> ${payload.dateRange.from} إلى ${payload.dateRange.to}</div>
    <div><strong>المنطقة الزمنية:</strong> Africa/Cairo (توقيت القاهرة)</div>
    <div><strong>اكتمال السجلات:</strong> ${payload.kpis.completenessScore}%</div>
  </div>

  <div class="kpi-grid">
    <div class="kpi-card">
      <h4>إجمالي المرضى الفريدين</h4>
      <div class="val">${payload.kpis.uniquePatients.toLocaleString()}</div>
      <div class="sub">مريض فريد داخل الفترة</div>
    </div>
    <div class="kpi-card">
      <h4>الزيارات الطبية المكتملة</h4>
      <div class="val">${payload.kpis.completedVisits.toLocaleString()}</div>
      <div class="sub">كشف طبي موثق ومكتمل</div>
    </div>
    <div class="kpi-card">
      <h4>نسبة الحضور والالتزام</h4>
      <div class="val">${payload.kpis.attendanceRate}%</div>
      <div class="sub">من الحجوزات المحسومة</div>
    </div>
    ${payload.canViewFinance ? `
    <div class="kpi-card">
      <h4>صافي التحصيل المؤكد</h4>
      <div class="val" style="color: #10B981;">${payload.kpis.netCollections.toLocaleString()} ج.م</div>
      <div class="sub">المبالغ المستلمة بعد المرتجعات</div>
    </div>` : ''}
    <div class="kpi-card">
      <h4>متوسط زمن الانتظار</h4>
      <div class="val" style="color: #06B6D4;">${payload.kpis.meanWaitMins !== null ? `${payload.kpis.meanWaitMins} د` : '—'}</div>
      <div class="sub">من الوصول إلى غرفة الكشف</div>
    </div>
    <div class="kpi-card">
      <h4>متوسط مدة الكشف الفعلي</h4>
      <div class="val" style="color: #8B5CF6;">${payload.kpis.meanConsultMins !== null ? `${payload.kpis.meanConsultMins} د` : '—'}</div>
      <div class="sub">مدة الفحص مع الطبيب</div>
    </div>
  </div>

  <h3 class="section-title">توزيع الفئات العمرية للمرضى</h3>
  <table>
    <thead>
      <tr>
        <th>الفئة العمرية</th>
        <th>نطاق السنوات</th>
        <th>عدد المرضى</th>
        <th>النسبة المئوية</th>
      </tr>
    </thead>
    <tbody>
      ${payload.ageAnalysis.categories.map(c => `
        <tr>
          <td>${c.labelAr}</td>
          <td>${c.range} سنة</td>
          <td>${c.count}</td>
          <td>${c.percentage}%</td>
        </tr>
      `).join('')}
      <tr>
        <td style="color: #D97706;">ملفات ينقصها تسجيل العمر</td>
        <td>—</td>
        <td>${payload.ageAnalysis.missingAgeCount}</td>
        <td>${payload.ageAnalysis.missingAgePercentage}%</td>
      </tr>
    </tbody>
  </table>

  <h3 class="section-title">أعلى المناطق الجغرافية كثافة للمرضى</h3>
  <table>
    <thead>
      <tr>
        <th>المنطقة / الحي</th>
        <th>المحافظة</th>
        <th>عدد المرضى</th>
        <th>النسبة من الإجمالي</th>
      </tr>
    </thead>
    <tbody>
      ${payload.geographicData.slice(0, 10).map(g => `
        <tr>
          <td>${g.nameAr}</td>
          <td>${g.governorateAr}</td>
          <td>${g.patientCount}</td>
          <td>${g.percentage}%</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <h3 class="section-title">أكثر التشخيصات الطبية تسجيلاً بالعيادة</h3>
  <table>
    <thead>
      <tr>
        <th>التشخيص الطبي المعتمد</th>
        <th>عدد الحالات الموثقة</th>
        <th>النسبة من الكشوفات</th>
        <th>الحالة</th>
      </tr>
    </thead>
    <tbody>
      ${payload.diagnoses.slice(0, 8).map(d => `
        <tr>
          <td>${d.name}</td>
          <td>${d.patientCount}</td>
          <td>${d.percentage}%</td>
          <td>${d.isUnclassified ? 'غير مصنف' : 'مؤكد'}</td>
        </tr>
      `).join('')}
    </tbody>
  </table>

  <div class="footer">
    <div>تم استخراج هذا التقرير آلياً بواسطة نظام ClinicOS • Yalla Clinic. جميع الأرقام معتمدة وفق القيود الفعلية.</div>
    <div>صفحة 1 من 1</div>
  </div>
</body>
</html>`

  printHtmlViaIframe(html, 'a4')
}
