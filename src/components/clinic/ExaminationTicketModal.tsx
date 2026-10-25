'use client'

import { useState } from 'react'
import {
  Printer, X, Receipt, CheckCircle2, Ticket, QrCode, Calendar, Clock, User, Phone
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { motion } from 'framer-motion'
import {
  ExaminationTicketData,
  printHtmlViaIframe,
  generateExaminationTicketHtml
} from '@/lib/printService'
import { useLanguage } from '@/context/LanguageContext'
import { toast } from 'sonner'

export interface ExaminationTicketModalProps {
  isOpen: boolean
  onClose: () => void
  appointment: any
  clinic: any
}

export function ExaminationTicketModal({
  isOpen,
  onClose,
  appointment,
  clinic
}: ExaminationTicketModalProps) {
  const { t, isRtl, dir } = useLanguage()

  if (!isOpen || !appointment) return null

  const ticketData: ExaminationTicketData = {
    clinicName: clinic?.clinicName || 'العيادة الطبية',
    branchName: appointment.branchName || clinic?.branchName,
    logoUrl: clinic?.logoUrl,
    queueNumber: appointment.queue_number || appointment.turnNumber || '1',
    effectivePosition: appointment.queue_number || '1',
    patientName: appointment.patientName || 'المريض',
    patientPhone: appointment.phone || '',
    serviceName: appointment.serviceName || appointment.service || 'كشف طبي',
    isUrgent: appointment.isUrgent || false,
    date: appointment.date || new Date().toISOString().split('T')[0],
    time: appointment.time || '',
    paymentStatus: appointment.paymentStatus || 'pending',
    appointmentId: appointment.id
  }

  const handlePrint = () => {
    const html = generateExaminationTicketHtml(ticketData)
    printHtmlViaIframe(html, '80mm')
    toast.success('تم إرسال تيكت الدور إلى الطابعة الحرارية (80mm) 🎫')
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4" dir={dir}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        className="w-full max-w-sm bg-card border border-border rounded-3xl shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="p-4 bg-secondary/50 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Ticket className="w-5 h-5 text-primary" />
            <h3 className="font-black text-sm text-foreground">
              تيكت الدور الحراري (80mm)
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visual Ticket Preview */}
        <div className="p-5 space-y-4 text-center">
          <div className="p-5 rounded-2xl bg-white text-slate-900 border border-slate-200 shadow-inner space-y-3 font-mono">
            <div className="text-sm font-black tracking-wide border-b border-dashed border-slate-300 pb-2">
              {ticketData.clinicName}
              {ticketData.branchName && <div className="text-[11px] font-normal text-slate-600">{ticketData.branchName}</div>}
            </div>

            <div className="py-2">
              <span className="text-xs uppercase text-slate-500 font-bold block">رقم الدور الحـالي</span>
              <span className="text-5xl font-black tracking-tight text-blue-600 block mt-1">
                #{ticketData.queueNumber}
              </span>
            </div>

            <div className="space-y-1 text-xs text-slate-700 border-t border-dashed border-slate-300 pt-2 text-right">
              <div><strong>المريض:</strong> {ticketData.patientName}</div>
              <div><strong>الخدمة:</strong> {ticketData.serviceName}</div>
              <div><strong>التاريخ:</strong> {ticketData.date}</div>
              {ticketData.time && <div><strong>الموعد:</strong> {ticketData.time}</div>}
              <div>
                <strong>حالة السداد:</strong>{' '}
                <span className={ticketData.paymentStatus === 'paid' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}>
                  {ticketData.paymentStatus === 'paid' ? 'تم السداد ✓' : 'غير مسدد'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-dashed border-slate-300 text-[10px] text-slate-500">
              يرجى الاحتفاظ بالتيكت حتى مناداة رقمك
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="p-4 bg-secondary/30 border-t border-border flex items-center justify-between gap-2">
          <Button
            variant="ghost"
            onClick={onClose}
            className="h-10 text-xs font-bold rounded-xl cursor-pointer"
          >
            إلغاء
          </Button>

          <Button
            onClick={handlePrint}
            className="h-10 px-5 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-md gap-1.5 cursor-pointer"
          >
            <Printer className="w-4 h-4" />
            طباعة التيكت الآن
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
