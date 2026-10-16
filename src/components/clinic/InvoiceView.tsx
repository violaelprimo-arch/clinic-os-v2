'use client'

import React, { useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, Download, Receipt, CheckCircle2, Clock, MapPin, Phone, Building, Share2, MessageCircle, Image as ImageIcon } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { printHtmlViaIframe, generateThermalReceiptHtml } from '@/lib/printService'
import { downloadElementAsPdf, downloadElementAsImage, renderElementToImageBlob } from '@/lib/pdfGenerator'
import { shareDocumentOrImage } from '@/lib/whatsappShare'
import { useLanguage } from '@/context/LanguageContext'
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
  queueNumber?: number | string
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
  const { t, isRtl, dir } = useLanguage()
  const printableRef = useRef<HTMLDivElement>(null)
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false)
  const [isGeneratingImage, setIsGeneratingImage] = useState(false)

  // Isolated 80mm Thermal Receipt Print (For XP-80C)
  const handlePrintThermal = () => {
    try {
      const html = generateThermalReceiptHtml({
        clinicName: invoice.clinicName,
        branchName: invoice.branchName,
        clinicAddress: invoice.clinicAddress,
        clinicPhone: invoice.clinicPhone,
        invoiceNumber: invoice.invoiceNumber,
        queueNumber: invoice.queueNumber,
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
        footerNote: isRtl ? 'نتمنى لكم الشفاء العاجل' : 'Wishing you a speedy recovery'
      })
      printHtmlViaIframe(html, '80mm')
      toast.success(isRtl ? 'تم إرسال الفاتورة للطباعة الحرارية (80mm)' : 'Thermal receipt sent to printer (80mm)')
    } catch (e) {
      toast.error(isRtl ? 'تعذر تشغيل أمر الطباعة' : 'Failed to start print job')
    }
  }

  // Real PDF Download
  const handleDownloadPdf = async () => {
    if (!printableRef.current) return
    setIsGeneratingPdf(true)
    try {
      await downloadElementAsPdf(
        printableRef.current,
        `Invoice_${invoice.invoiceNumber}.pdf`,
        { format: 'a4', orientation: 'portrait' }
      )
      toast.success(isRtl ? 'تم تحميل الفاتورة بصيغة PDF بنجاح' : 'Invoice downloaded as PDF')
    } catch (e) {
      toast.error(isRtl ? 'حدث خطأ أثناء إنشاء ملف PDF' : 'Error generating PDF file')
    } finally {
      setIsGeneratingPdf(false)
    }
  }

  // Real Image Download (PNG)
  const handleDownloadImage = async () => {
    if (!printableRef.current) return
    setIsGeneratingImage(true)
    try {
      await downloadElementAsImage(
        printableRef.current,
        `Invoice_${invoice.invoiceNumber}.png`,
        { scale: 2.5 }
      )
      toast.success(isRtl ? 'تم تنزيل الفاتورة كصورة PNG بنجاح' : 'Invoice downloaded as PNG')
    } catch (e) {
      console.error(e)
      toast.error(isRtl ? 'حدث خطأ أثناء إنشاء صورة الفاتورة' : 'Error creating invoice image')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  // WhatsApp Share with Image (Desktop clipboard + auto download + wa.me)
  const handleShareWhatsApp = async () => {
    if (!invoice.patientPhone) return toast.error(isRtl ? 'رقم هاتف المريض غير مسجل' : 'Patient phone number not found')
    if (!printableRef.current) return
    setIsGeneratingImage(true)
    try {
      toast.info(isRtl ? 'جاري تجهيز صورة الفاتورة للمشاركة...' : 'Preparing invoice image for sharing...')
      const { blob } = await renderElementToImageBlob(printableRef.current, { scale: 2.5 })

      const msg = isRtl
        ? `مرحباً ${invoice.patientName}،\nفاتورتك من عيادة ${invoice.clinicName} ${invoice.branchName ? `(فرع ${invoice.branchName})` : ''}:\n- رقم الفاتورة: ${invoice.invoiceNumber}\n- الخدمة: ${invoice.serviceName}\n- المبلغ الصافي: ${invoice.netTotal} ج.م\n- حالة الدفع: ${invoice.paymentStatus === 'paid' ? 'مدفوع ومؤكد' : 'في انتظار التأكيد'}\nنتمنى لكم دوام الصحة والعافية.`
        : `Hello ${invoice.patientName},\nYour invoice from ${invoice.clinicName} ${invoice.branchName ? `(Branch ${invoice.branchName})` : ''}:\n- Invoice No: ${invoice.invoiceNumber}\n- Service: ${invoice.serviceName}\n- Net Total: ${invoice.netTotal} EGP\n- Payment: ${invoice.paymentStatus === 'paid' ? 'Paid & Confirmed' : 'Pending Confirmation'}\nWishing you good health.`

      await shareDocumentOrImage({
        blob,
        fileName: `Invoice_${invoice.invoiceNumber}.png`,
        fileType: 'image',
        recipientPhone: invoice.patientPhone,
        messageText: msg,
        documentTitle: isRtl ? 'فاتورة الكشف' : 'Medical Invoice'
      })
    } catch (e) {
      console.error(e)
      toast.error(isRtl ? 'تعذر مشاركة الفاتورة عبر واتساب' : 'Failed to share invoice via WhatsApp')
    } finally {
      setIsGeneratingImage(false)
    }
  }

  const isPaid = invoice.paymentStatus === 'paid'

  const methodLabel =
    invoice.paymentMethod === 'instapay'
      ? (isRtl ? 'انستاباي (InstaPay)' : 'InstaPay')
      : invoice.paymentMethod === 'wallet'
      ? (isRtl ? 'محفظة إلكترونية (Smart Wallet)' : 'Smart Wallet')
      : (isRtl ? 'كاش بالعيادة (Cash)' : 'Cash at Clinic')

  return (
    <div className={`space-y-4 font-sans ${isRtl ? 'text-right' : 'text-left'}`} dir={dir}>
      {/* Control Actions Header (Excluded from any print) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E5EAF0]">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-[#087CF4]" />
          <h3 className="font-black text-sm text-[#182230]">
            {t('invoice_number_title', isRtl ? 'فاتورة رقم:' : 'Invoice No:')}{' '}
            <span className="font-mono text-[#087CF4]">{invoice.invoiceNumber}</span>
          </h3>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* WhatsApp Share as Image */}
          <Button
            size="sm"
            onClick={handleShareWhatsApp}
            disabled={isGeneratingImage}
            className="h-9 px-3 text-xs font-bold bg-[#25D366] hover:bg-[#128C7E] text-white rounded-xl shadow-xs flex items-center gap-1.5"
            title={isRtl ? 'مشاركة الفاتورة عبر واتساب كصورة' : 'Share invoice as image via WhatsApp'}
          >
            <MessageCircle className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
            {isGeneratingImage ? (isRtl ? 'جاري التجهيز...' : 'Preparing...') : t('send_whatsapp_btn', isRtl ? 'إرسال واتساب' : 'Send WhatsApp')}
          </Button>

          {/* Download as Image */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadImage}
            disabled={isGeneratingImage}
            className="h-9 px-3 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:text-[#087CF4] rounded-xl flex items-center gap-1.5"
            title={isRtl ? 'تنزيل الفاتورة كصورة عالية الدقة' : 'Download invoice as high-res PNG'}
          >
            <ImageIcon className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
            {t('image_btn', isRtl ? 'صورة' : 'Image')}
          </Button>

          {/* Download as PDF */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
            className="h-9 px-3 text-xs font-bold border-[#E5EAF0] text-slate-700 hover:text-[#087CF4] rounded-xl flex items-center gap-1.5"
          >
            <Download className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
            {isGeneratingPdf ? (isRtl ? 'جاري إنشاء PDF...' : 'Creating PDF...') : t('download_pdf', isRtl ? 'تحميل PDF' : 'Download PDF')}
          </Button>

          {/* TASK 5: Only clinic staff can print thermal receipt directly; patient view has ONLY PDF Download */}
          {!isPatientView && (
            <Button
              size="sm"
              onClick={handlePrintThermal}
              className="h-9 px-3.5 text-xs font-bold bg-[#087CF4] hover:bg-[#0769D1] text-white rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Printer className={`w-4 h-4 ${isRtl ? 'ml-1' : 'mr-1'}`} />
              {t('print_80mm', isRtl ? 'طباعة (80mm)' : 'Print (80mm)')}
            </Button>
          )}

          {onClose && (
            <Button
              size="sm"
              variant="outline"
              onClick={onClose}
              className="h-9 px-3 text-xs font-bold border-[#E5EAF0] text-slate-600 rounded-xl"
            >
              {t('close', isRtl ? 'إغلاق' : 'Close')}
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
              <p className="text-xs font-bold text-[#087CF4] mt-1">
                {isRtl ? 'د. ' : 'Dr. '}{invoice.doctorName}
              </p>
            )}
            {invoice.branchName && (
              <span className="inline-block mt-1 text-[11px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                {isRtl ? 'فرع: ' : 'Branch: '}{invoice.branchName}
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

          <div className={isRtl ? 'text-left' : 'text-right'} dir="ltr">
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
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-slate-50 border border-slate-100 text-xs items-center">
          <div>
            <span className="text-slate-400 font-bold block mb-1">
              {t('patient_data_label', isRtl ? 'بيانات المريض:' : 'Patient Details:')}
            </span>
            <p className="font-black text-[#182230] text-sm">{invoice.patientName}</p>
            <p className="text-slate-500 font-mono mt-0.5" dir="ltr">{invoice.patientPhone}</p>
          </div>

          {invoice.queueNumber !== undefined && invoice.queueNumber !== null && invoice.queueNumber !== '' && (
            <div className="text-center p-2 rounded-xl bg-blue-50 border border-blue-200">
              <span className="text-[10px] font-bold text-blue-800 block">
                {t('queue_turn_in_waiting', isRtl ? 'رقم الدور في الانتظار' : 'Queue Turn Number')}
              </span>
              <span className="text-2xl font-black text-[#087CF4] font-mono block">#{invoice.queueNumber}</span>
            </div>
          )}

          <div className={`${isRtl ? 'text-left items-end' : 'text-right items-start'} flex flex-col justify-center`}>
            <span className="text-slate-400 font-bold block mb-1">
              {t('payment_status_label', isRtl ? 'حالة السداد:' : 'Payment Status:')}
            </span>
            <Badge
              className={`text-xs font-black px-3 py-1 border-none ${
                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isPaid
                ? (isRtl ? '✓ تم السداد بالكامل' : '✓ Paid in Full')
                : (isRtl ? '⏳ في انتظار تأكيد السداد' : '⏳ Pending Payment')}
            </Badge>
          </div>
        </div>

        {/* Invoice Items Table */}
        <div className="overflow-hidden rounded-xl border border-[#E5EAF0]">
          <table className={`w-full text-xs ${isRtl ? 'text-right' : 'text-left'}`}>
            <thead className="bg-slate-50 border-b border-[#E5EAF0] text-slate-500 font-black">
              <tr>
                <th className="py-3 px-4">#</th>
                <th className="py-3 px-4">{t('medical_service', isRtl ? 'الخدمة الطبية' : 'Medical Service')}</th>
                <th className="py-3 px-4 text-center">{t('price', isRtl ? 'السعر' : 'Price')}</th>
                <th className="py-3 px-4 text-center">{t('discount', isRtl ? 'الخصم' : 'Discount')}</th>
                <th className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'}`}>{t('total', isRtl ? 'الإجمالي' : 'Total')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF0]">
              <tr>
                <td className="py-3 px-4 font-mono text-slate-400">1</td>
                <td className="py-3 px-4 font-black text-[#182230]">{invoice.serviceName}</td>
                <td className="py-3 px-4 text-center font-bold text-slate-600">
                  {invoice.servicePrice} {isRtl ? 'ج.م' : 'EGP'}
                </td>
                <td className="py-3 px-4 text-center font-bold text-rose-500">
                  {invoice.discount ? `-${invoice.discount} ${isRtl ? 'ج.م' : 'EGP'}` : (isRtl ? '0 ج.م' : '0 EGP')}
                </td>
                <td className={`py-3 px-4 ${isRtl ? 'text-left' : 'text-right'} font-black text-[#182230]`}>
                  {invoice.netTotal} {isRtl ? 'ج.م' : 'EGP'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Totals & Payment Summary */}
        <div className="grid grid-cols-2 gap-4 items-center pt-2">
          <div className="space-y-1.5 text-xs text-slate-500">
            <p>
              <span className="font-bold">{t('payment_method_label', isRtl ? 'طريقة الدفع:' : 'Payment Method:')}</span> {methodLabel}
            </p>
            {invoice.transferNumber && (
              <p>
                <span className="font-bold">{t('transfer_number_label', isRtl ? 'رقم العملية / التحويل:' : 'Transaction No:')}</span>{' '}
                <span className="font-mono text-[#182230]">{invoice.transferNumber}</span>
              </p>
            )}
            <p className="text-[11px] text-slate-400 mt-2">
              {t('invoice_health_wish', isRtl ? 'نتمنى لكم دوام الصحة والعافية ونتشرف دائماً بخدمتكم.' : 'Wishing you good health. It is always our pleasure to serve you.')}
            </p>
          </div>

          <div className="bg-slate-50 p-4 rounded-xl border border-slate-100 space-y-2 text-xs">
            <div className="flex justify-between text-slate-500">
              <span>{t('subtotal', isRtl ? 'المجموع الفرعي:' : 'Subtotal:')}</span>
              <span className="font-bold">{invoice.servicePrice} {isRtl ? 'ج.م' : 'EGP'}</span>
            </div>
            {invoice.discount ? (
              <div className="flex justify-between text-rose-600 font-bold">
                <span>{t('discount_applied_label', isRtl ? 'الخصم المطبق:' : 'Discount Applied:')}</span>
                <span>-{invoice.discount} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
            ) : null}
            <div className="flex justify-between text-sm font-black text-[#182230] border-t border-slate-200 pt-2">
              <span>{t('net_total_due', isRtl ? 'الإجمالي المستحق:' : 'Total Due:')}</span>
              <span className="text-[#087CF4]">{invoice.netTotal} {isRtl ? 'ج.م' : 'EGP'}</span>
            </div>
          </div>
        </div>

        {/* Standard Platform Footer */}
        <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400">
          <span>{t('certified_invoice_notice', isRtl ? 'فاتورة معتمدة صادرة من نظام Yalla Clinic' : 'Certified invoice issued by Yalla Clinic')}</span>
          <span>{t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}</span>
        </div>
      </div>
    </div>
  )
}
