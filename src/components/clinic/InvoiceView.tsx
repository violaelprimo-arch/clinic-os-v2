'use client'

import React from 'react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Printer, Download, Receipt, CheckCircle2, Clock, MapPin, Phone, Building } from 'lucide-react'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'

export interface InvoiceData {
  invoiceNumber: string
  clinicName: string
  doctorName?: string
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

export function InvoiceView({ invoice, onClose }: { invoice: InvoiceData; onClose?: () => void }) {
  const handlePrint = () => {
    window.print()
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
      {/* Control Actions (Hidden on Print) */}
      <div className="print:hidden flex items-center justify-between pb-3 border-b border-[#E5EAF0]">
        <div className="flex items-center gap-2">
          <Receipt className="w-5 h-5 text-[#15B8A6]" />
          <h3 className="font-black text-sm text-[#182230]">
            فاتورة رقم: <span className="font-mono text-[#15B8A6]">{invoice.invoiceNumber}</span>
          </h3>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={handlePrint}
            className="h-9 px-4 text-xs font-bold bg-[#15B8A6] hover:bg-[#0D9488] text-white rounded-xl shadow-xs flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4 ml-1" />
            طباعة الفاتورة
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

      {/* Printable Invoice Sheet */}
      <div
        id="printable-invoice"
        className="bg-white p-6 sm:p-8 rounded-2xl border border-[#E5EAF0] shadow-sm max-w-2xl mx-auto space-y-6 print:border-none print:shadow-none print:p-0"
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
            <div className="text-[11px] text-slate-400 space-y-0.5 mt-2">
              {invoice.clinicAddress && (
                <p className="flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {invoice.clinicAddress}
                </p>
              )}
              {invoice.clinicPhone && (
                <p className="flex items-center gap-1">
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
            <p className="text-slate-500 font-mono mt-0.5">{invoice.patientPhone}</p>
          </div>

          <div className="text-left flex flex-col items-end justify-center">
            <span className="text-slate-400 font-bold block mb-1">حالة السداد:</span>
            <Badge
              className={`text-xs font-black px-3 py-1 border-none ${
                isPaid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
              }`}
            >
              {isPaid ? '✓ تم السداد بالكامل' : '⏳ في انتظار السداد بالعيادة'}
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
                <td className="py-3 px-4 font-bold text-[#182230]">{invoice.serviceName}</td>
                <td className="py-3 px-4 text-center font-mono font-bold text-slate-700">
                  {invoice.servicePrice} ج.م
                </td>
                <td className="py-3 px-4 text-center font-mono text-rose-600 font-bold">
                  {invoice.discount ? `-${invoice.discount} ج.م` : '0'}
                </td>
                <td className="py-3 px-4 text-left font-mono font-black text-[#15B8A6]">
                  {invoice.netTotal} ج.م
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Financial Summary */}
        <div className="flex justify-between items-start pt-2">
          <div className="space-y-1 text-xs text-slate-500">
            <p>
              <span className="font-bold text-slate-700">طريقة الدفع: </span>
              {methodLabel}
            </p>
            {invoice.transferNumber && (
              <p>
                <span className="font-bold text-slate-700">رقم العملية/التحويل: </span>
                <span className="font-mono">{invoice.transferNumber}</span>
              </p>
            )}
            {invoice.appointmentId && (
              <p>
                <span className="font-bold text-slate-700">معرف الحجز: </span>
                <span className="font-mono text-[10px] text-slate-400">{invoice.appointmentId}</span>
              </p>
            )}
          </div>

          <div className="w-48 space-y-1.5 text-xs text-left" dir="ltr">
            <div className="flex justify-between text-slate-500">
              <span>Subtotal:</span>
              <span className="font-mono font-bold">{invoice.servicePrice} EGP</span>
            </div>
            {Boolean(invoice.discount) && (
              <div className="flex justify-between text-rose-600">
                <span>Discount:</span>
                <span className="font-mono font-bold">-{invoice.discount} EGP</span>
              </div>
            )}
            <div className="flex justify-between pt-2 border-t border-slate-200 text-sm font-black text-[#182230]">
              <span>Total:</span>
              <span className="font-mono text-[#15B8A6]">{invoice.netTotal} EGP</span>
            </div>
          </div>
        </div>

        {/* Footer Disclaimer */}
        <div className="pt-6 border-t border-slate-100 text-center text-[10px] text-slate-400 space-y-1">
          <p>هذا المستند فاتورة ومطالبة مالية صادرة من نظام Clinic OS لإدارة العيادات الطبية.</p>
          <p>نتمنى لحضراتكم دوام الصحة والشفاء العاجل.</p>
        </div>
      </div>
    </div>
  )
}
