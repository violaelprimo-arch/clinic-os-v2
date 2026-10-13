'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, Download, Receipt, CheckCircle2, Clock, MapPin, Phone, Building, Share2 } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { printHtmlViaIframe, generateThermalReceiptHtml } from '@/lib/printService'
import { downloadElementAsPdf } from '@/lib/pdfGenerator'
import { toast } from 'sonner'

export interface InvoiceData {
  invoiceNumber: string
  clinicName: string
  doctorName?: string
  branchName?: string
  clinicAddress?: string
  clinicPhone?: string
  patientName: string
  patientPhone: string
  date: string
  cairoTime?: string
  serviceName: string
  servicePrice: number
  discount?: number
  netTotal: number
  paymentMethod: 'cash' | 'instapay' | 'wallet'
  paymentStatus: 'paid' | 'pending' | 'refunded'
  transferNumber?: string
  appointmentId?: string
}

export function InvoiceView({
  invoice,
  onClose,
  isPatientView = false
}: {
  invoice: InvoiceData
  onClose?: () => void
  isPatientView?: boolean
}) {
  const printableRef = useRef<HTMLDivElement>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)

  // Isolated 80mm Thermal Receipt Print (For XP-80C)
  const handlePrintThermal = () => {
    try {
      const html = generateThermalReceiptHtml({
        clinicName: invoice.clinicName,
        branchName: invoice.branchName,
        clinicAddress: invoice.clinicAddress,
        clinicPhone: invoice.clinicPhone,
        invoiceNumber: invoice.invoiceNumber,
        date: invoice.date,
        time: invoice.cairoTime,
        patientName: invoice.patientName,
        patientPhone: invoice.patientPhone,
        serviceName: invoice.serviceName,
        originalPrice: Number(invoice.servicePrice) || 0,
        discountAmount: Number(invoice.discount) || 0,
        netPrice: Number(invoice.netTotal) || Number(invoice.servicePrice) || 0,
        paymentMethod: invoice.paymentMethod,
        paymentStatus: invoice.paymentStatus === 'paid' ? 'paid' : 'pending_verification',
        transferNumber: invoice.transferNumber,
        footerNote: 'نتمنى لكم الشفاء العاجل'
      })
      printHtmlViaIframe(html, '80mm')
      toast.success('تم إرسال الفاتورة للطباعة الحرارية (80mm)')
    } catch (e) {
      toast.error('تعذر تشغيل أمر الطباعة')
    }
  }

  // Real PDF Download
  const handleDownloadPdf = async () => {
    if (!printableRef.current) return
    setIsGeneratingPdf(true)
    try {
      await downloadElementAsPdf(
        printableRef.current,
        `فاتورة_${invoice.invoiceNumber}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success('تم تحميل الفاتورة بصيغة PDF بنجاح')
    } catch (e) {
      toast.error('حدث خطأ أثناء إنشاء ملف PDF')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  const isPaid = invoice.paymentStatus === 'paid'

  const methodLabel =
    invoice.paymentMethod === 'instapay'
      ? 'انستاباي (InstaPay)'
      : invoice.paymentMethod === 'wallet'
      ? 'محفظة إلكترونية (Smart Wallet)'
      : 'كاش بالعيادة (Cash)'

  return (
    <div className="space-y-4 font-sans text-right" dir="rtl">
      {/* Control Actions Header (Excluded from any print) */}
      <div className="flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-[#15B8A6]" />
          <h3 className="font-black text-sm text-[#182230]">
            فاتورة رقم: <span className="font-mono text-[#15B8A6]">{invoice.invoiceNumber}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          {/* TASK 5: Only clinic staff can print thermal receipt directly; patient view has ONLY PDF Download */}
          {!isPatientView && (
            <Button
              size="sm"
              onClick={handlePrintThermal}
              className="h-9 px-3.5 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4 ml-1" />
              طباعة إيصال (80mm)
            </Button>
          )}

          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="h-9 px-3 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:text-[#15B8A6] rounded-xl flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 ml-1" />
            {isGeneratingPdf ? 'جاري إنشاء PDF...' : 'تحميل PDF'}
          </Button>

          {onClose && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-9 px-3 text-xs font-bold border-[#E5EAF0] text-slate-600 rounded-xl"
            >
              إغلاق
            </Button>
          )}
        </div>
      </div>

      {/* High-Fidelity Printable Invoice Container */}
      <div
        ref={printableRef}
        id="printable-invoice"
        className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E5EAF0] shadow-sm max-w-2xl mx-auto space-y-6"
      >
        {/* Header */}
        <div className="flex justify-between items-start pb-5 border-b-2 border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <ClinicLogo size="sm" variant="light" showSubtitle={false} />
              <h2 className="text-lg font-black text-[#182230]">{invoice.clinicName}</h2>
            </div>
            {invoice.doctorName && (
              <p className="text-xs font-bold text-[#15B8A6] mt-1">د. {invoice.doctorName}</p>
            )}
            {invoice.branchName && (
              <span className="inline-block mt-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                فرع: {invoice.branchName}
              </span>
            )}
            <div className="text-[11px] text-slate-400 space-y-0.5 mt-2">
              {invoice.clinicAddress && (
                <p className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {invoice.clinicAddress}
                </p>
              )}
              {invoice.clinicPhone && (
                <p className="flex items-center gap-1" dir="ltr">
                  <Phone className="w-3 h-3 text-slate-400" />
                  {invoice.clinicPhone}
                </p>
              )}
            </div>
          </div>

          <div className="text-left" dir="ltr">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-400 block">
              Invoice No.
            </span>
            <span className="text-base font-black font-mono text-[#182230]">{invoice.invoiceNumber}</span>
            <div className="mt-2 text-[11px] text-slate-500 font-mono">
              <p>Date: {invoice.date}</p>
              {invoice.cairoTime && <p>Time: {invoice.cairoTime}</p>}
            </div>
          </div>
        </div>

        {/* Patient Details & Status Banner */}
        <div className="grid grid-cols-2 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs">
          <div>
            <span className="text-slate-400 font-bold block mb-1">بيانات المريض:</span>
            <p className="font-black text-[#182230] text-sm">{invoice.patientName}</p>
            <p className="text-slate-500 font-mono mt-0.5" dir="ltr">{invoice.patientPhone}</p>
          </div>

          <div className="text-left flex flex-col items-end justify-center">
            <span className="text-slate-400 font-bold block mb-1">حالة السداد:</span>
            <Badge
              className={`text-xs font-black px-3 py-1 border-none ${
                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isPaid ? '✓ تم السداد بالكامل' : '⏳ في انتظار تأكيد السداد'}
            </Badge>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="overflow-hidden rounded-xl border border-[#E5EAF0]">
          <table className="w-full text-xs text-right">
            <thead className="bg-slate-50 border-b border-[#E5EAF0] text-slate-500 font-black">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">الخدمة الطبية</th>
                <th className="py-3 px-4 text-center">السعر</th>
                <th className="py-3 px-4 text-center">الخصم</th>
                <th className="py-3 px-4 text-left">الإجمالي</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF0]">
              <tr>
                <td className="py-3 px-4 font-mono text-slate-400">1</td>
                <td className="py-3 px-4 font-black text-[#182230]">{invoice.serviceName}</td>
                <td className="py-3 px-4 text-center font-bold text-slate-600">{invoice.servicePrice} ج.م</td>
                <td className="py-3 px-4 text-center font-bold text-rose-500">
                  {invoice.discount ? `-${invoice.discount} ج.م` : '0 ج.م'}
                </td>
                <td className="py-3 px-4 text-left font-black text-[#182230]">{invoice.netTotal} ج.م</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals & Payment Summary */}
        <div className="grid grid-cols-2 gap-4 items-center pt-2">
          <div className="space-y-1.5 text-xs text-slate-500">
            <p>
              <span className="font-bold">طريقة الدفع:</span> {methodLabel}
            </p>
            {invoice.transferNumber && (
              <p>
                <span className="font-bold">رقم العملية / التحويل:</span>{' '}
                <span className="font-mono text-[#182230]">{invoice.transferNumber}</span>
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              نتمنى لكم دوام الصحة والعافية ونتشرف دائماً بخدمتكم.
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>المجموع الفرعي:</span>
              <span className="font-bold">{invoice.servicePrice} ج.م</span>
            </div>
            {invoice.discount ? (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>الخصم المطبق:</span>
                <span>-{invoice.discount} ج.م</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm font-black text-[#182230] border-t border-slate-200 pt-2">
              <span>الإجمالي المستحق:</span>
              <span className="text-[#15B8A6]">{invoice.netTotal} ج.م</span>
            </div>
          </div>
        </div>

        {/* Standard Platform Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>فاتورة معتمدة صادرة من نظام Clinic OS</span>
          <span>جميع الحقوق محفوظة © {new Date().getFullYear()} Clinic OS</span>
        </div>
      </div>
    </div>
  )
}
