'use client'

import { useState } from 'react'
import {
  Printer, X, Receipt, CheckCircle2, ShieldCheck, Download, Share2
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  ThermalReceiptData,
  printHtmlViaIframe,
  generateThermalReceiptHtml
} from '@/lib/printService'
import { openManualWhatsAppChat } from '@/lib/whatsappShare'
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
  if (!isOpen || !data) return null

  const handlePrint = () => {
    const html = generateThermalReceiptHtml(data)
    printHtmlViaIframe(html)
    toast.success('تم إرسال الفاتورة للطابعة الحرارية (80mm)')
  }

  const handleManualWhatsApp = () => {
    if (!data.patientPhone) {
      toast.error('رقم هاتف المريض غير مسجل')
      return
    }
    const msg = `مرحباً ${data.patientName}،\nفاتورتك من عيادة ${data.clinicName} ${data.branchName ? `(فرع ${data.branchName})` : ''}:\n- رقم الفاتورة: ${data.invoiceNumber}\n- الخدمة: ${data.serviceName}\n- المبلغ المطلوب: ${data.netPrice} ج.م\n- حالة الدفع: ${data.paymentStatus === 'paid' ? 'مدفوع ومؤكد' : 'في انتظار التأكيد'}\nنتمنى لكم دوام الصحة والعافية.`
    openManualWhatsAppChat({
      phone: data.patientPhone,
      message: msg
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in" dir="rtl">
      <div className="bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
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
        <div className="overflow-y-auto p-5 bg-slate-100 flex justify-center">
          <div className="w-[300px] bg-white p-4 rounded-xl shadow-md border border-slate-200 font-sans text-xs space-y-3 text-right text-black">
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

        {/* Action Buttons */}
        <div className="p-4 border-t border-slate-100 flex items-center justify-between gap-2 bg-white">
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualWhatsApp}
            className="h-10 text-xs font-bold text-emerald-700 border-emerald-300 hover:bg-emerald-50 rounded-xl"
          >
            <Share2 className="w-4 h-4 ml-1.5" />
            إرسال عبر واتساب
          </Button>

          <Button
            onClick={handlePrint}
            className="h-10 px-5 bg-[#0B1F33] hover:bg-[#15B8A6] text-white font-bold rounded-xl shadow-md text-xs"
          >
            <Printer className="w-4 h-4 ml-1.5" />
            طباعة الفاتورة (80mm)
          </Button>
        </div>
      </div>
    </div>
  )
}
