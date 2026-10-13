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
  const receiptRef = useRef<HTMLDivElement>(null)
  const [isProcessing, setIsProcessing] = useState(false)

  if (!isOpen || !data) return null

  const handlePrint = () => {
    const html = generateThermalReceiptHtml(data)
    printHtmlViaIframe(html)
    toast.success('تم إرسال الفاتورة للطابعة الحرارية (80mm)')
  }

  const handleDownloadPdf = async () => {
    if (!receiptRef.current) return
    setIsProcessing(true)
    try {
      await downloadElementAsPdf(
        receiptRef.current,
        `فاتورة_${data.patientName}_${data.invoiceNumber || 'receipt'}.pdf`,
        { format: 'thermal', scale: 2.5 }
      )
      toast.success('تم تنزيل الفاتورة بصيغة PDF بنجاح')
    } catch (err) {
      console.error(err)
      toast.error('تعذر تنزيل الفاتورة بصيغة PDF')
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
        `فاتورة_${data.patientName}_${data.invoiceNumber || 'receipt'}.png`,
        { scale: 2.5 }
      )
      toast.success('تم تنزيل صورة الفاتورة (PNG) بنجاح')
    } catch (err) {
      console.error(err)
      toast.error('تعذر تنزيل صورة الفاتورة')
    } finally {
      setIsProcessing(false)
    }
  }

  const handleSendWhatsApp = async () => {
    if (!data.patientPhone) {
      toast.error('رقم هاتف المريض غير مسجل')
      return
    }

    setIsProcessing(true)
    try {
      toast.info('جاري تجهيز صورة الفاتورة ومشاركتها...')
      let blob: Blob | null = null

      if (receiptRef.current) {
        const res = await renderElementToImageBlob(receiptRef.current, { scale: 2.5 })
        blob = res.blob
      }

      const msg = `مرحباً ${data.patientName}،\nفاتورتك من عيادة ${data.clinicName} ${data.branchName ? `(فرع ${data.branchName})` : ''}:\n- رقم الفاتورة: ${data.invoiceNumber}\n- الخدمة: ${data.serviceName}\n- المبلغ المطلوب: ${data.netPrice} ج.م\n- حالة الدفع: ${data.paymentStatus === 'paid' ? 'مدفوع ومؤكد' : 'في انتظار التأكيد'}\nنتمنى لكم دوام الصحة والعافية.`

      if (blob) {
        await shareDocumentOrImage({
          blob,
          fileName: `فاتورة_${data.patientName}_${data.invoiceNumber || 'receipt'}.png`,
          fileType: 'image',
          recipientPhone: data.patientPhone,
          messageText: msg,
          documentTitle: 'فاتورة الكشف'
        })
      } else {
        // Fallback text
        window.open(`https://wa.me/2${data.patientPhone}?text=${encodeURIComponent(msg)}`, '_blank')
      }
    } catch (err) {
      console.error(err)
      toast.error('تعذر إرسال الفاتورة عبر واتساب')
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-[#15B8A6]" />
            <h3 className="font-black text-sm text-[#182230]">فاتورة كشف حرارية (80mm)</h3>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 80mm Preview Scrollable Box */}
        <div className="overflow-y-auto p-4 sm:p-5 bg-slate-100 flex justify-center flex-1">
          <div
            ref={receiptRef}
            className="w-[290px] bg-white p-4 rounded-xl shadow-md border border-slate-200 font-sans text-xs space-y-3 text-right text-black"
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
                  فرع {data.branchName}
                </span>
              )}
              {data.clinicAddress && <p className="text-[10px] text-slate-600">{data.clinicAddress}</p>}
              {data.clinicPhone && <p className="text-[10px] text-slate-600">ت: {data.clinicPhone}</p>}
            </div>

            {/* Big Queue Number */}
            {data.queueNumber !== undefined && data.queueNumber !== null && data.queueNumber !== '' && (
              <div className="border-2 border-black rounded-xl p-2.5 text-center bg-slate-50 my-1">
                <span className="text-[10px] font-bold text-slate-600 block">رقم الدور في الانتظار</span>
                <span className="text-4xl font-black block tracking-tight font-mono my-0.5">#{data.queueNumber}</span>
                <span className="text-[9px] text-slate-500 block">الرجاء متابعة شاشة النداء الآلي بالعيادة</span>
              </div>
            )}

            {/* Meta */}
            <div className="space-y-1 pb-2 border-b border-dashed border-black text-[11px]">
              <div className="flex justify-between">
                <span className="text-slate-600">رقم الفاتورة:</span>
                <span className="font-bold font-mono">{data.invoiceNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">التاريخ:</span>
                <span>{data.date} {data.time || ''}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">المريض:</span>
                <span className="font-bold">{data.patientName}</span>
              </div>
              {data.patientPhone && (
                <div className="flex justify-between">
                  <span className="text-slate-600">الهاتف:</span>
                  <span className="font-mono">{data.patientPhone}</span>
                </div>
              )}
            </div>

            {/* Item */}
            <div className="space-y-1.5 pb-2 border-b border-dashed border-black text-[11px]">
              <div className="flex justify-between font-bold">
                <span>{data.serviceName}</span>
                <span>{data.originalPrice} ج.م</span>
              </div>
              {data.discountAmount ? (
                <div className="flex justify-between text-rose-600">
                  <span>الخصم:</span>
                  <span>- {data.discountAmount} ج.م</span>
                </div>
              ) : null}
              <div className="flex justify-between text-sm font-black pt-1 border-t border-black">
                <span>الإجمالي الصافي:</span>
                <span>{data.netPrice} ج.م</span>
              </div>
            </div>

            {/* Payment Info */}
            <div className="bg-slate-50 p-2 rounded border border-slate-300 text-[11px] space-y-1">
              <div className="flex justify-between">
                <span>طريقة الدفع:</span>
                <span className="font-bold">
                  {data.paymentMethod === 'instapay'
                    ? 'InstaPay'
                    : data.paymentMethod === 'wallet'
                    ? 'محفظة إلكترونية'
                    : 'نقداً بالعيادة'}
                </span>
              </div>
              <div className="flex justify-between">
                <span>حالة الدفع:</span>
                <span className="font-bold text-emerald-700">
                  {data.paymentStatus === 'paid'
                    ? '● مدفوع ومؤكد'
                    : data.paymentStatus === 'pending_verification'
                    ? '○ بانتظار التأكيد'
                    : '○ غير محصل'}
                </span>
              </div>
              {data.transferNumber && (
                <div className="flex justify-between">
                  <span>رقم التحويل:</span>
                  <span className="font-mono">{data.transferNumber}</span>
                </div>
              )}
              {data.confirmedBy && (
                <div className="flex justify-between text-[10px] text-slate-500">
                  <span>المستلم:</span>
                  <span>{data.confirmedBy}</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="text-center pt-2 text-[10px] text-slate-500 space-y-1">
              <p className="font-bold text-black">{data.footerNote || 'نتمنى لكم دوام الصحة والعافية'}</p>
              <p>Clinic OS • نظام إدارة العيادات</p>
            </div>
          </div>
        </div>

        {/* Action Buttons Toolbar */}
        <div className="p-3 sm:p-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2 bg-white">
          <div className="flex items-center gap-1.5 flex-wrap">
            {/* WhatsApp Share as Image */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendWhatsApp}
              disabled={isProcessing}
              className="h-9 px-3 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 rounded-xl"
              title="مشاركة صورة الفاتورة عبر واتساب"
            >
              {isProcessing ? <Loader2 className="w-3.5 h-3.5 animate-spin ml-1" /> : <Share2 className="w-3.5 h-3.5 ml-1" />}
              واتساب
            </Button>

            {/* Download as Image */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadImage}
              disabled={isProcessing}
              className="h-9 px-2.5 text-xs font-bold text-slate-600 border-slate-300 hover:bg-slate-50 rounded-xl"
              title="تنزيل الفاتورة كصورة PNG"
            >
              <ImageIcon className="w-3.5 h-3.5 ml-1" />
              صورة
            </Button>

            {/* Download as PDF */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleDownloadPdf}
              disabled={isProcessing}
              className="h-9 px-2.5 text-xs font-bold text-slate-600 border-slate-300 hover:bg-slate-50 rounded-xl"
              title="تنزيل الفاتورة بصيغة PDF"
            >
              <FileText className="w-3.5 h-3.5 ml-1" />
              PDF
            </Button>
          </div>

          {/* Thermal Print xp-80 */}
          <Button
            onClick={handlePrint}
            className="h-9 px-4 bg-[#0B1F33] hover:bg-[#15B8A6] text-white font-bold rounded-xl shadow-md text-xs shrink-0"
          >
            <Printer className="w-4 h-4 ml-1.5" />
            طباعة (80mm)
          </Button>
        </div>
      </div>
    </div>
  )
}
