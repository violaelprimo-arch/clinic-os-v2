'use client'

import { useState, useRef } from 'react'
import {
  Printer, X, Receipt, CheckCircle2, ShieldCheck, Download, Share2, Image as ImageIcon, FileText, Loader2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ThermalReceiptData,
  printHtmlViaIframe,
  generateThermalReceiptHtml
} from '@/lib/printService'
import { shareDocumentOrImage } from '@/lib/whatsappShare'
import { downloadElementAsPdf, downloadElementAsImage, renderElementToImageBlob } from '@/lib/pdfGenerator'
import { useLanguage } from '@/context/LanguageContext'
import { toast } from 'sonner'

export function ThermalReceiptModal({
  data,
  isOpen,
  onClose
}: {
  data: ThermalReceiptData | null
  isOpen: boolean
  onClose: () => void
}) {
  const { t, isRtl, dir } = useLanguage()
  const receiptRef = useRef<HTMLDivElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen || !data) return null

  const handlePrint = () => {
    const html = generateThermalReceiptHtml(data)
    printHtmlViaIframe(html)
    toast.success(isRtl ? 'تم إرسال الفاتورة للطابعة الحرارية (80mm)' : 'Thermal receipt sent to printer (80mm)')
  }

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return
    setIsProcessing(true)
    try {
      await downloadElementAsPdf(
        receiptRef.current,
        `Invoice_${data.patientName}_${data.invoiceNumber || 'receipt'}.pdf`,
        { format: 'thermal', scale: 2.5 }
      )
      toast.success(isRtl ? 'تم تنزيل الفاتورة بصيغة PDF بنجاح' : 'Invoice downloaded as PDF')
    } catch (err) {
      console.error(err)
      toast.error(isRtl ? 'تعذر تنزيل الفاتورة بصيغة PDF' : 'Failed to download PDF')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleDownloadImage = async () => {
    if (!receiptRef.current) return
    setIsProcessing(true)
    try {
      await downloadElementAsImage(
        receiptRef.current,
        `Invoice_${data.patientName}_${data.invoiceNumber || 'receipt'}.png`,
        { scale: 2.5 }
      )
      toast.success(isRtl ? 'تم تنزيل صورة الفاتورة (PNG) بنجاح' : 'Invoice downloaded as PNG')
    } catch (err) {
      console.error(err)
      toast.error(isRtl ? 'تعذر تنزيل صورة الفاتورة' : 'Failed to download image')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSendWhatsApp = async () => {
    if (!data.patientPhone) {
      toast.error(isRtl ? 'رقم هاتف المريض غير مسجل' : 'Patient phone number is not available')
      return
    }

    setIsProcessing(true)
    try {
      toast.info(isRtl ? 'جاري تجهيز صورة الفاتورة ومشاركتها...' : 'Preparing invoice image for sharing...')
      let blob: Blob | null = null

      if (receiptRef.current) {
        const res = await renderElementToImageBlob(receiptRef.current, { scale: 2.5 })
        blob = res.blob
      }

      const msg = isRtl
        ? `مرحباً ${data.patientName}،\nفاتورتك من عيادة ${data.clinicName} ${data.branchName ? `(فرع ${data.branchName})` : ''}:\n- رقم الفاتورة: ${data.invoiceNumber}\n- الخدمة: ${data.serviceName}\n- المبلغ المطلوب: ${data.netPrice} ج.م\n- حالة الدفع: ${data.paymentStatus === 'paid' ? 'مدفوع ومؤكد' : 'في انتظار التأكيد'}\nنتمنى لكم دوام الصحة والعافية.`
        : `Hello ${data.patientName},\nYour invoice from ${data.clinicName} ${data.branchName ? `(Branch ${data.branchName})` : ''}:\n- Invoice No: ${data.invoiceNumber}\n- Service: ${data.serviceName}\n- Amount: ${data.netPrice} EGP\n- Payment: ${data.paymentStatus === 'paid' ? 'Paid & Confirmed' : 'Pending Confirmation'}\nWishing you good health.`

      if (blob) {
        await shareDocumentOrImage({
          blob,
          fileName: `Invoice_${data.patientName}_${data.invoiceNumber || 'receipt'}.png`,
          fileType: 'image',
          recipientPhone: data.patientPhone,
          messageText: msg,
          documentTitle: isRtl ? 'فاتورة الكشف' : 'Medical Invoice'
        })
      } else {
        // Fallback text
        window.open(`https://wa.me/2${data.patientPhone}?text=${encodeURIComponent(msg)}`, '_blank')
      }
    } catch (err) {
      console.error(err)
      toast.error(isRtl ? 'تعذر إرسال الفاتورة عبر واتساب' : 'Failed to share invoice via WhatsApp')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir={dir}>
      <div className="bg-card text-card-foreground rounded-3xl shadow-2xl border border-border w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-primary" />
            <h3 className="font-black text-sm text-foreground">
              {t('thermal_receipt_title', isRtl ? 'فاتورة كشف حرارية (80mm)' : 'Thermal Receipt (80mm)')}
            </h3>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg hover:bg-muted transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 80mm Preview Scrollable Box */}
        <div className="overflow-y-auto p-4 sm:p-5 bg-muted/20 flex justify-center flex-1">
          <div
            ref={receiptRef}
            className={`w-[290px] bg-white p-4 rounded-xl shadow-md border border-slate-200 font-sans text-xs space-y-3 ${isRtl ? 'text-right' : 'text-left'} text-black`}
          >
            {/* Clinic Name & Branch */}
            <div className="text-center pb-2 border-b border-dashed border-black">
              {data.logoUrl && (
                <img
                  src={data.logoUrl}
                  alt="Logo"
                  className="max-h-12 mx-auto mb-1 filter grayscale"
                />
              )}
              <h4 className="font-black text-base">{data.clinicName}</h4>
              {data.branchName && (
                <span className="inline-block px-2 py-0.5 rounded text-[10px] font-bold border border-black my-1">
                  {isRtl ? 'فرع ' : 'Branch '}{data.branchName}
                </span>
              )}
              {data.clinicAddress && <p className="text-[10px] text-slate-600">{data.clinicAddress}</p>}
              {data.clinicPhone && <p className="text-[10px] text-slate-600">Tel: {data.clinicPhone}</p>}
            </div>

            {/* Big Queue Number */}
            {data.queueNumber !== undefined && data.queueNumber !== null && data.queueNumber !== '' && (
              <div className="border-2 border-black rounded-xl p-2.5 text-center bg-slate-50 my-1">
                <span className="text-[10px] font-bold text-slate-600 block">
                  {isRtl ? 'رقم الدور في الانتظار' : 'Queue Turn Number'}
                </span>
                <span className="text-4xl font-black block tracking-tight font-mono my-0.5">#{data.queueNumber}</span>
                <span className="text-[9px] text-slate-500 block">
                  {isRtl ? 'الرجاء متابعة شاشة النداء الآلي بالعيادة' : 'Please follow the automated queue calling screen'}
                </span>
              </div>
            )}

            {/* Meta */}
            <div className="space-y-1 pb-2 border-b border-dashed border-black text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-600">{t('invoice_no', isRtl ? 'رقم الفاتورة:' : 'Invoice No:')}</span>
                <span className="font-bold font-mono">{data.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('date', isRtl ? 'التاريخ:' : 'Date:')}</span>
                <span>{data.date} {data.time || ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">{t('patient', isRtl ? 'المريض:' : 'Patient:')}</span>
                <span className="font-bold">{data.patientName}</span>
              </div>
              {data.patientPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-600">{t('phone', isRtl ? 'الهاتف:' : 'Phone:')}</span>
                  <span className="font-mono">{data.patientPhone}</span>
                </div>
              )}
            </div>

            {/* Item */}
            <div className="space-y-1.5 pb-2 border-b border-dashed border-black text-[11px]">
              <div className="flex justify-between font-bold">
                <span>{data.serviceName}</span>
                <span>{data.originalPrice} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
              {data.discountAmount ? (
                <div className="flex justify-between text-rose-600">
                  <span>{t('discount', isRtl ? 'الخصم:' : 'Discount:')}</span>
                  <span>- {data.discountAmount} {isRtl ? 'ج.م' : 'EGP'}</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-black">
                <span>{t('net_total', isRtl ? 'الإجمالي الصافي:' : 'Net Total:')}</span>
                <span>{data.netPrice} {isRtl ? 'ج.م' : 'EGP'}</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-slate-50 p-2 rounded border border-slate-300 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>{t('payment_method', isRtl ? 'طريقة الدفع:' : 'Payment Method:')}</span>
                <span className="font-bold">
                  {data.paymentMethod === 'instapay'
                    ? 'InstaPay'
                    : data.paymentMethod === 'wallet'
                    ? (isRtl ? 'محفظة إلكترونية' : 'Smart Wallet')
                    : (isRtl ? 'نقداً بالعيادة' : 'Cash')}
                </span>
              </div>
              <div className="flex justify-between">
                <span>{t('payment_status', isRtl ? 'حالة الدفع:' : 'Payment Status:')}</span>
                <span className="font-bold text-emerald-700">
                  {data.paymentStatus === 'paid'
                    ? (isRtl ? '● مدفوع ومؤكد' : '● Paid & Confirmed')
                    : data.paymentStatus === 'pending_verification'
                    ? (isRtl ? '○ بانتظار التأكيد' : '○ Pending Confirmation')
                    : (isRtl ? '○ غير محصل' : '○ Unpaid')}
                </span>
              </div>
              {data.transferNumber && (
                <div className="flex justify-between">
                  <span>{isRtl ? 'رقم التحويل:' : 'Ref No:'}</span>
                  <span className="font-mono">{data.transferNumber}</span>
                </div>
              )}
              {data.confirmedBy && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>{isRtl ? 'المستلم:' : 'Receiver:'}</span>
                  <span>{data.confirmedBy}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-2 text-[10px] text-slate-500 space-y-1">
              <p className="font-bold text-black">{data.footerNote || (isRtl ? 'نتمنى لكم دوام الصحة والعافية' : 'Wishing you good health')}</p>
              <p>Yalla Clinic • {t('copyright_text', 'جميع الحقوق محفوظة YallaCodeX 2026')}</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="p-3 sm:p-4 border-t border-border flex flex-wrap items-center justify-between gap-2 bg-card">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* WhatsApp Share as Image */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={isProcessing}
              className="h-9 px-3 text-xs font-bold text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/10 rounded-xl"
              title={isRtl ? 'مشاركة صورة الفاتورة عبر واتساب' : 'Share receipt image on WhatsApp'}
            >
              {isProcessing ? <Loader2 className={`w-3.5 h-3.5 animate-spin ${isRtl ? 'ml-1' : 'mr-1'}`} /> : <Share2 className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />}
              {t('send_whatsapp_btn', isRtl ? 'واتساب' : 'WhatsApp')}
            </Button>

            {/* Download as Image */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadImage}
              disabled={isProcessing}
              className="h-9 px-2.5 text-xs font-bold text-foreground border-border hover:bg-muted/40 rounded-xl"
              title={isRtl ? 'تنزيل الفاتورة كصورة PNG' : 'Download receipt as PNG'}
            >
              <ImageIcon className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
              {t('image_btn', isRtl ? 'صورة' : 'Image')}
            </Button>

            {/* Download as PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isProcessing}
              className="h-9 px-2.5 text-xs font-bold text-foreground border-border hover:bg-muted/40 rounded-xl"
              title={isRtl ? 'تنزيل الفاتورة بصيغة PDF' : 'Download receipt as PDF'}
            >
              <FileText className={`w-3.5 h-3.5 ${isRtl ? 'ml-1' : 'mr-1'}`} />
              PDF
            </Button>
          </div>

          {/* Thermal Print xp-80 */}
          <Button
            onClick={handlePrint}
            className="h-9 px-4 yalla-gradient-btn text-white font-bold rounded-xl shadow-md text-xs shrink-0 transition-colors"
          >
            <Printer className={`w-4 h-4 ${isRtl ? 'ml-1.5' : 'mr-1.5'}`} />
            {t('print_80mm', isRtl ? 'طباعة (80mm)' : 'Print (80mm)')}
          </Button>
        </div>
      </div>
    </div>
  )
}
