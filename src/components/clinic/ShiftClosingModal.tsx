'use client'

import { useState, useMemo } from 'react'
import {
  X, Printer, MessageCircle, DollarSign, Wallet, CreditCard,
  Banknote, Receipt, CheckCircle2, ShieldCheck, FileSpreadsheet,
  AlertCircle, Calendar, Building2, User, ArrowDownRight, ArrowUpRight
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'
import { printHtmlViaIframe } from '@/lib/printService'
import { openManualWhatsAppChat, getSavedWhatsAppTarget } from '@/lib/whatsappShare'
import { useLanguage } from '@/context/LanguageContext'
import { toast } from 'sonner'

export interface ShiftClosingModalProps {
  isOpen: boolean
  onClose: () => void
  clinic: any
  appointments: any[]
  selectedBranchId?: string
}

export function ShiftClosingModal({
  isOpen,
  onClose,
  clinic,
  appointments = [],
  selectedBranchId = 'all'
}: ShiftClosingModalProps) {
  const { t, tDynamic, language, isRtl, dir } = useLanguage()

  // Cairo today date
  const cairoTodayDate = useMemo(() => {
    try {
      return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
    } catch (e) {
      const d = new Date()
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    }
  }, [])

  const [staffName, setStaffName] = useState(
    typeof window !== 'undefined' ? localStorage.getItem('clinic_staff_name') || 'سكرتارية العيادة' : 'سكرتارية العيادة'
  )
  const [pettyExpenses, setPettyExpenses] = useState<string>('0')
  const [expenseNotes, setExpenseNotes] = useState<string>('')
  const [closingNotes, setClosingNotes] = useState<string>('')

  // Filter today's appointments for active branch
  const todayAppts = useMemo(() => {
    return appointments.filter(a => {
      const isToday = (a.date || a.createdAt?.split('T')[0]) === cairoTodayDate
      if (!isToday) return false
      if (selectedBranchId && selectedBranchId !== 'all') {
        const apptBranch = a.branch_id || a.branchId
        const isMain = selectedBranchId === 'main' || clinic?.branches?.find((b: any) => b.isMain)?.id === selectedBranchId
        return apptBranch ? apptBranch === selectedBranchId : isMain
      }
      return true
    })
  }, [appointments, cairoTodayDate, selectedBranchId, clinic])

  // Calculations
  const metrics = useMemo(() => {
    let cash = 0
    let instapay = 0
    let wallet = 0
    let card = 0
    let totalCollected = 0
    let totalDue = 0
    let completedCount = 0
    let waitingCount = 0
    let cancelledCount = 0

    todayAppts.forEach(a => {
      if (a.status === 'cancelled') {
        cancelledCount++
        return
      }
      if (a.status === 'completed') completedCount++
      if (a.status === 'waiting' || a.status === 'in_progress') waitingCount++

      const price = Number(a.finalPrice ?? a.price ?? 0)
      const paid = a.paymentStatus === 'paid' ? (Number(a.paidAmount) || price) : (Number(a.paidAmount) || 0)
      const due = Math.max(0, price - paid)

      totalCollected += paid
      totalDue += due

      const method = (a.paymentMethod || 'cash').toLowerCase()
      if (method === 'instapay') {
        instapay += paid
      } else if (method === 'wallet' || method === 'vodafone_cash') {
        wallet += paid
      } else if (method === 'visa' || method === 'card' || method === 'pos') {
        card += paid
      } else {
        // default cash
        cash += paid
      }
    })

    const expensesNum = Math.max(0, parseFloat(pettyExpenses) || 0)
    const netCashHandover = Math.max(0, cash - expensesNum)
    const grossRevenue = totalCollected

    return {
      cash,
      instapay,
      wallet,
      card,
      totalCollected,
      totalDue,
      expensesNum,
      netCashHandover,
      grossRevenue,
      totalCount: todayAppts.length,
      completedCount,
      waitingCount,
      cancelledCount
    }
  }, [todayAppts, pettyExpenses])

  if (!isOpen) return null

  // Active branch name
  const branchName = selectedBranchId && selectedBranchId !== 'all'
    ? clinic?.branches?.find((b: any) => b.id === selectedBranchId)?.name || 'الفرع المحدد'
    : 'كافة الفروع'

  // Generate 80mm Shift Reconciliation Slip HTML
  const generateShiftPrintHtml = () => {
    const formattedTime = new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Cairo'
    }).format(new Date())

    return `<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="utf-8">
  <title>تقفيل الخزينة والوردية - ${cairoTodayDate}</title>
  <style>
    @page { size: 80mm auto; margin: 0; }
    @media print {
      html, body { width: 80mm !important; margin: 0 !important; padding: 0 !important; background: #fff !important; }
    }
    body {
      width: 72mm;
      margin: 0 auto;
      padding: 10px 4px;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Cairo", Tahoma, sans-serif;
      font-size: 11px;
      line-height: 1.35;
      color: #000;
    }
    .text-center { text-align: center; }
    .text-right { text-align: right; }
    .bold { font-weight: bold; }
    .title { font-size: 14px; font-weight: 900; margin: 4px 0; }
    .subtitle { font-size: 11px; font-weight: 700; color: #333; margin-bottom: 6px; }
    .divider { border-top: 1px dashed #333; margin: 6px 0; }
    .double-divider { border-top: 2px solid #000; margin: 8px 0; }
    .row { display: flex; justify-content: space-between; margin: 3px 0; }
    .highlight-box {
      border: 1.5px solid #000;
      padding: 6px;
      margin: 6px 0;
      text-align: center;
      background: #f7f7f7;
    }
    .big-number { font-size: 16px; font-weight: 900; }
    .sig-area { margin-top: 15px; }
  </style>
</head>
<body>
  <div class="text-center">
    <div class="title">${clinic?.clinicName || 'العيادة الطبية'}</div>
    <div class="subtitle">تقرير تقفيل الخزينة وإغلاق الوردية</div>
    <div>د. ${clinic?.doctorName || 'العيادة'} ${clinic?.specialty ? '• ' + clinic.specialty : ''}</div>
    <div>الفرع: ${branchName}</div>
    <div>التاريخ: ${cairoTodayDate} • الساعة: ${formattedTime}</div>
    <div>مسؤول الوردية: ${staffName}</div>
  </div>

  <div class="divider"></div>

  <div class="bold" style="margin-bottom: 4px;">📊 حركة الكشوفات اليوم:</div>
  <div class="row"><span>إجمالي الكشوفات والزيارات:</span><span class="bold">${metrics.totalCount} كشف</span></div>
  <div class="row"><span>كشوفات مكتملة تم إنهاؤها:</span><span class="bold">${metrics.completedCount}</span></div>
  <div class="row"><span>مرضى في الانتظار:</span><span class="bold">${metrics.waitingCount}</span></div>
  <div class="row"><span>كشوفات ملغاة:</span><span class="bold">${metrics.cancelledCount}</span></div>

  <div class="divider"></div>

  <div class="bold" style="margin-bottom: 4px;">💰 تفصيل المتحصلات:</div>
  <div class="row"><span>💵 كاش نقدي في الدرج:</span><span class="bold">${metrics.cash.toLocaleString()} ج.م</span></div>
  <div class="row"><span>📱 إنستاباي (InstaPay):</span><span class="bold">${metrics.instapay.toLocaleString()} ج.م</span></div>
  <div class="row"><span>💳 محافظ إلكترونية وفودافون كاش:</span><span class="bold">${metrics.wallet.toLocaleString()} ج.م</span></div>
  <div class="row"><span>💳 فيزا / بطاقات دفع (POS):</span><span class="bold">${metrics.card.toLocaleString()} ج.م</span></div>
  <div class="row"><span>💸 مصروفات ونثريات الدرج:</span><span class="bold">-${metrics.expensesNum.toLocaleString()} ج.م</span></div>

  <div class="double-divider"></div>

  <div class="highlight-box">
    <div>🟢 صافي الكاش المطلوب تسليمه للدكتور:</div>
    <div class="big-number">${metrics.netCashHandover.toLocaleString()} ج.م</div>
    <div style="font-size: 9px; color: #555;">(كاش الدرج - المصروفات النثرية)</div>
  </div>

  <div class="row bold"><span>إجمالي دخل اليوم الكامل:</span><span>${metrics.grossRevenue.toLocaleString()} ج.م</span></div>
  ${metrics.totalDue > 0 ? `<div class="row" style="color:#666;"><span>مبالغ متبقية غير محصلة:</span><span>${metrics.totalDue.toLocaleString()} ج.م</span></div>` : ''}

  ${expenseNotes ? `<div class="divider"></div><div><strong>ملاحظات المصروفات:</strong> ${expenseNotes}</div>` : ''}
  ${closingNotes ? `<div><strong>ملاحظات الإغلاق:</strong> ${closingNotes}</div>` : ''}

  <div class="sig-area">
    <div class="divider"></div>
    <div class="row" style="margin-top: 10px;">
      <div>توقيع السكرتارية:<br><br>......................</div>
      <div style="text-align: left;">توقيع الطبيب المستلم:<br><br>......................</div>
    </div>
  </div>

  <div class="divider"></div>
  <div class="text-center" style="font-size: 9px; color: #777;">
    تم تقفيل الخزينة واعتماد التقرير عبر نظام Yalla Clinic OS
  </div>
</body>
</html>`
  }

  // Print Action
  const handlePrint = () => {
    const html = generateShiftPrintHtml()
    printHtmlViaIframe(html, '80mm')
    toast.success('تم إرسال تقرير تقفيل الخزينة إلى الطابعة بنجاح 🖨️')
  }

  // Send WhatsApp Action
  const handleSendWhatsApp = () => {
    const doctorPhone = clinic?.phone || clinic?.whatsappNumber || clinic?.clinicPhone || ''
    const targetMode = getSavedWhatsAppTarget()

    const formattedTime = new Intl.DateTimeFormat('ar-EG', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
      timeZone: 'Africa/Cairo'
    }).format(new Date())

    const message = `📊 *تقرير تقفيل الخزينة وإغلاق الوردية*
🏥 *${clinic?.clinicName || 'العيادة الطبية'}*
🏢 الفرع: ${branchName}
📅 التاريخ: ${cairoTodayDate} (الساعة: ${formattedTime})
👤 مسؤول الوردية: ${staffName}
----------------------------------
👥 *حركة الكشوفات:*
• إجمالي الكشوفات: ${metrics.totalCount} كشف
• كشوفات مكتملة: ${metrics.completedCount}
• في الانتظار: ${metrics.waitingCount}
• كشوفات ملغاة: ${metrics.cancelledCount}
----------------------------------
💰 *تفصيل الإيراد والمتحصلات:*
💵 كاش نقدي بالدرج: *${metrics.cash.toLocaleString()} ج.م*
📱 إنستاباي (InstaPay): *${metrics.instapay.toLocaleString()} ج.م*
💳 محافظ إلكترونية (فودافون كاش): *${metrics.wallet.toLocaleString()} ج.م*
💳 فيزا وبطاقات دفع (POS): *${metrics.card.toLocaleString()} ج.م*
💸 مصروفات ونثريات: *${metrics.expensesNum.toLocaleString()} ج.م*
----------------------------------
🟢 *صافي الكاش الفعلي للتسليم:*
👉 *${metrics.netCashHandover.toLocaleString()} ج.م* 👈
(كاش الدرج بعد خصم المصروفات)

💰 *إجمالي الإيراد الكلي لليوم:* *${metrics.grossRevenue.toLocaleString()} ج.م*
${metrics.totalDue > 0 ? `⚠️ مبالغ آجلة متبقية: ${metrics.totalDue.toLocaleString()} ج.م\n` : ''}${expenseNotes ? `📝 بيان المصروفات: ${expenseNotes}\n` : ''}${closingNotes ? `📌 ملاحظات: ${closingNotes}\n` : ''}----------------------------------
تم التقفيل والمراجعة بنجاح عبر Yalla Clinic OS ✓`

    openManualWhatsAppChat({
      phone: doctorPhone,
      message,
      target: targetMode
    })

    toast.success('تم فتح واتساب وتعبئة تقرير تقفيل الوردية في الشات! اضغط Enter للإرسال 🚀', {
      duration: 5000
    })
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-md flex items-center justify-center p-3 sm:p-4 overflow-y-auto" dir={dir}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 15 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl overflow-hidden my-auto"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-primary/15 text-primary flex items-center justify-center shadow-xs">
              <DollarSign className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-lg font-black text-foreground">
                  تقفيل الخزينة اليومي وتقرير الوردية
                </h2>
                <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 text-[10px] font-bold">
                  {cairoTodayDate}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                مراجعة كاش الدرج، المحافظ الإلكترونية، النثريات، وصافي التسليم للدكتور ({branchName})
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 max-h-[75vh] overflow-y-auto">
          
          {/* Staff & Shift Input */}
          <div className="grid sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-secondary/30 border border-border">
            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                مسؤول الوردية / السكرتارية
              </Label>
              <Input
                value={staffName}
                onChange={e => {
                  setStaffName(e.target.value)
                  if (typeof window !== 'undefined') localStorage.setItem('clinic_staff_name', e.target.value)
                }}
                placeholder="اسم موظف الاستقبال"
                className="h-9 text-xs rounded-xl bg-background border-border font-bold"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1.5">
                <ArrowDownRight className="w-3.5 h-3.5" />
                مصروفات ونثريات الدرج اليوم (ج.م)
              </Label>
              <Input
                type="number"
                min="0"
                value={pettyExpenses}
                onChange={e => setPettyExpenses(e.target.value)}
                placeholder="0"
                className="h-9 text-xs rounded-xl bg-background border-rose-500/30 font-bold"
              />
            </div>

            <div className="sm:col-span-2 space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">بيان وتفاصيل المصروفات النثرية إن وجدت</Label>
              <Input
                value={expenseNotes}
                onChange={e => setExpenseNotes(e.target.value)}
                placeholder="مثال: شراء أدوات نظافة 50 ج، ضيافة شاي وماء 100 ج..."
                className="h-9 text-xs rounded-xl bg-background border-border text-foreground"
              />
            </div>
          </div>

          {/* Hero Handover Card */}
          <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-500/15 via-emerald-500/5 to-teal-500/10 border-2 border-emerald-500/30 shadow-lg text-center space-y-2 relative overflow-hidden">
            <div className="text-xs font-black text-emerald-700 dark:text-emerald-300 uppercase tracking-wider flex items-center justify-center gap-1.5">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              الصافي الفعلي المطلوب تسليمه للدكتور (كاش الدرج)
            </div>
            <div className="text-4xl font-black text-foreground font-mono">
              {metrics.netCashHandover.toLocaleString()} <span className="text-lg font-bold text-emerald-600 dark:text-emerald-400">ج.م</span>
            </div>
            <p className="text-xs text-muted-foreground">
              (إجمالي الكاش في الدرج {metrics.cash.toLocaleString()} ج.م - المصروفات النثرية {metrics.expensesNum.toLocaleString()} ج.م)
            </p>
          </div>

          {/* Breakdown Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {/* Cash */}
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <Banknote className="w-3.5 h-3.5 text-emerald-500" />
                كاش الدرج
              </span>
              <div className="text-lg font-black text-foreground font-mono">
                {metrics.cash.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">ج.م</span>
              </div>
            </div>

            {/* InstaPay */}
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <Wallet className="w-3.5 h-3.5 text-cyan-500" />
                إنستاباي
              </span>
              <div className="text-lg font-black text-cyan-600 dark:text-cyan-400 font-mono">
                {metrics.instapay.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">ج.م</span>
              </div>
            </div>

            {/* Smart Wallets */}
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-purple-500" />
                محافظ إلكترونية
              </span>
              <div className="text-lg font-black text-purple-600 dark:text-purple-400 font-mono">
                {metrics.wallet.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">ج.م</span>
              </div>
            </div>

            {/* POS Card */}
            <div className="p-3.5 rounded-2xl bg-card border border-border shadow-2xs space-y-1">
              <span className="text-[11px] font-bold text-muted-foreground flex items-center gap-1">
                <CreditCard className="w-3.5 h-3.5 text-blue-500" />
                فيزا / POS
              </span>
              <div className="text-lg font-black text-blue-600 dark:text-blue-400 font-mono">
                {metrics.card.toLocaleString()} <span className="text-xs text-muted-foreground font-normal">ج.م</span>
              </div>
            </div>
          </div>

          {/* Visits & Total Revenue Bar */}
          <div className="p-4 rounded-2xl bg-secondary/40 border border-border flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex items-center gap-4">
              <div>
                <span className="text-muted-foreground">إجمالي الكشوفات: </span>
                <strong className="text-foreground">{metrics.totalCount}</strong>
              </div>
              <div className="text-emerald-600 dark:text-emerald-400">
                <span>مكتملة: </span>
                <strong>{metrics.completedCount}</strong>
              </div>
              <div className="text-amber-600 dark:text-amber-400">
                <span>في الانتظار: </span>
                <strong>{metrics.waitingCount}</strong>
              </div>
              {metrics.cancelledCount > 0 && (
                <div className="text-rose-600 dark:text-rose-400">
                  <span>ملغاة: </span>
                  <strong>{metrics.cancelledCount}</strong>
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-muted-foreground font-bold">إجمالي دخل اليوم الكامل:</span>
              <span className="font-mono font-black text-primary text-sm">
                {metrics.grossRevenue.toLocaleString()} ج.م
              </span>
            </div>
          </div>

          {/* Closing Notes */}
          <div className="space-y-1">
            <Label className="text-xs font-bold text-muted-foreground">ملاحظات إضافية للدكتور على تقفيل الوردية</Label>
            <Input
              value={closingNotes}
              onChange={e => setClosingNotes(e.target.value)}
              placeholder="مثال: تم تسليم الكاش للدكتور يداً بيد، تم تأجيل كشف مريض للغد..."
              className="h-9 text-xs rounded-xl bg-background border-border text-foreground"
            />
          </div>

        </div>

        {/* Footer Actions */}
        <div className="p-4 sm:p-5 bg-secondary/30 border-t border-border flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-10 text-xs font-bold rounded-xl cursor-pointer"
          >
            إغلاق
          </Button>

          <div className="flex items-center gap-2.5">
            {/* Print Slip */}
            <Button
              onClick={handlePrint}
              variant="outline"
              className="h-10 text-xs font-bold border-primary text-primary hover:bg-primary/10 rounded-xl gap-1.5 cursor-pointer shadow-xs"
            >
              <Printer className="w-4 h-4" />
              طباعة تقرير الشيفت (80mm)
            </Button>

            {/* Send WhatsApp */}
            <Button
              onClick={handleSendWhatsApp}
              className="h-10 px-5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-md gap-1.5 cursor-pointer"
            >
              <MessageCircle className="w-4 h-4" />
              إرسال التقرير واتساب للدكتور
            </Button>
          </div>
        </div>

      </motion.div>
    </div>
  )
}
