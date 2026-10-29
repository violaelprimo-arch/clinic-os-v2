'use client'

import React from 'react'
import {
  X,
  Calendar,
  Clock,
  User,
  Stethoscope,
  Building2,
  Activity,
  FileText,
  Receipt,
  Heart,
  Thermometer,
  Weight,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
  AlertCircle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

interface VisitDetailsModalProps {
  visit: any | null
  clinic: any
  linkedPrescription?: any | null
  onClose: () => void
  onOpenPrescription?: (rx: any) => void
  onOpenInvoice?: (visit: any) => void
}

export function VisitDetailsModal({
  visit,
  clinic,
  linkedPrescription,
  onClose,
  onOpenPrescription,
  onOpenInvoice
}: VisitDetailsModalProps) {
  if (!visit) return null

  const isCompleted = visit.status === 'completed'
  const isCancelled = visit.status === 'cancelled'
  const isWaiting = visit.status === 'waiting' || !visit.status
  const isInProgress = visit.status === 'in_progress'

  const vitals = visit.vitalSigns || {}
  const hasVitals =
    vitals.bloodPressureSystolic ||
    vitals.heartRate ||
    vitals.temperature ||
    vitals.glucoseLevel ||
    vitals.weightKg

  return (
    <div dir="rtl" className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-4 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 12 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-xl bg-white dark:bg-[#081526] rounded-3xl p-6 shadow-2xl border border-sky-100 dark:border-slate-800 space-y-5 my-auto max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
              <Stethoscope className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-base">
                تفاصيل الزيارة الطبية
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                {visit.date} {visit.time ? `• ${visit.time}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 hover:bg-rose-50 hover:text-rose-500 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Visit Key Facts */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-bold">حالة الكشف</span>
            <span
              className={`inline-flex items-center gap-1 mt-1 px-2.5 py-0.5 rounded-full text-xs font-black ${
                isCompleted
                  ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300'
                  : isInProgress
                  ? 'bg-emerald-500 text-white animate-pulse'
                  : isCancelled
                  ? 'bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300'
                  : 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
              }`}
            >
              {isCompleted ? 'تم الكشف' : isInProgress ? 'دورك الآن' : isCancelled ? 'ملغي' : 'في الانتظار'}
            </span>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60">
            <span className="text-[10px] text-slate-400 block font-bold">الطبيب المعالج</span>
            <strong className="text-xs text-slate-800 dark:text-slate-100 block mt-1 truncate">
              {visit.doctorName ? `د. ${visit.doctorName}` : clinic?.doctorName ? `د. ${clinic.doctorName}` : 'طبيب العيادة'}
            </strong>
          </div>

          <div className="bg-slate-50 dark:bg-slate-800/60 p-3 rounded-2xl border border-slate-100 dark:border-slate-700/60 col-span-2 sm:col-span-1">
            <span className="text-[10px] text-slate-400 block font-bold">الفرع والخدمة</span>
            <strong className="text-xs text-slate-800 dark:text-slate-100 block mt-1 truncate">
              {visit.serviceName || 'كشف'} • {visit.branchName || 'الفرع الرئيسي'}
            </strong>
          </div>
        </div>

        {/* Diagnosis if available */}
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
            <Activity className="w-3.5 h-3.5 text-sky-600" />
            <span>التشخيص الطبي</span>
          </label>
          <div className="p-3.5 rounded-2xl bg-sky-50/70 dark:bg-sky-950/40 border border-sky-100 dark:border-sky-800/60">
            <p className="text-xs font-bold text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
              {visit.diagnosis || linkedPrescription?.diagnosis || 'لم يُسجل تشخيص محدد لهذه الزيارة أو قيد المتابعة.'}
            </p>
          </div>
        </div>

        {/* Doctor Instructions & Recommendations (Only public instructions, strictly NO private notes!) */}
        {(visit.doctorInstructions || linkedPrescription?.instructions) && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>تعليمات وإرشادات الطبيب للمريض</span>
            </label>
            <div className="p-3.5 rounded-2xl bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/50">
              <p className="text-xs text-slate-700 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                {visit.doctorInstructions || linkedPrescription?.instructions}
              </p>
            </div>
          </div>
        )}

        {/* Vital Signs (if recorded during visit) */}
        {hasVitals && (
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-500 dark:text-slate-400 flex items-center gap-1.5">
              <Heart className="w-3.5 h-3.5 text-rose-500" />
              <span>العلامات الحيوية المسجلة بالزيارة</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {vitals.bloodPressureSystolic && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">ضغط الدم</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {vitals.bloodPressureSystolic} / {vitals.bloodPressureDiastolic || '—'}
                  </span>
                </div>
              )}
              {vitals.heartRate && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">نبض القلب</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {vitals.heartRate} bpm
                  </span>
                </div>
              )}
              {vitals.temperature && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">حرارة الجسم</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {vitals.temperature}°C
                  </span>
                </div>
              )}
              {vitals.glucoseLevel && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">سكر الدم</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {vitals.glucoseLevel} mg/dL
                  </span>
                </div>
              )}
              {vitals.weightKg && (
                <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800 text-center">
                  <span className="text-[10px] text-slate-400 block">الوزن</span>
                  <span className="text-xs font-bold text-slate-800 dark:text-slate-200 font-mono">
                    {vitals.weightKg} كجم
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Linked Rx and Invoice Action Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100 dark:border-slate-800">
          {linkedPrescription ? (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenPrescription?.(linkedPrescription)
              }}
              className="p-3 rounded-2xl bg-sky-50 dark:bg-sky-950/40 hover:bg-sky-100 dark:hover:bg-sky-900/50 border border-sky-200 dark:border-sky-800 text-sky-700 dark:text-sky-300 font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-sky-600" />
                <div className="text-right">
                  <span className="block font-black">الروشتة الطبية</span>
                  <span className="text-[10px] text-slate-500 font-normal">
                    {linkedPrescription.drugs?.length || 0} أدوية موصوفة
                  </span>
                </div>
              </div>
              <span className="text-[11px] underline">فتح PDF</span>
            </button>
          ) : (
            <div className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-100 dark:border-slate-800 text-slate-400 text-xs flex items-center gap-2">
              <FileText className="w-4 h-4 opacity-40" />
              <span>لا توجد روشتة صادرة لهذه الزيارة</span>
            </div>
          )}

          {visit.status !== 'cancelled' && onOpenInvoice && (
            <button
              type="button"
              onClick={() => {
                onClose()
                onOpenInvoice(visit)
              }}
              className="p-3 rounded-2xl bg-slate-50 dark:bg-slate-800/60 hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-between transition-all cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Receipt className="w-4 h-4 text-emerald-600" />
                <div className="text-right">
                  <span className="block font-black">فاتورة الكشف</span>
                  <span className="text-[10px] text-slate-500 font-normal font-mono">
                    {visit.netTotal || visit.servicePrice || 250} ج.م
                  </span>
                </div>
              </div>
              <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-bold underline">
                عرض الفاتورة
              </span>
            </button>
          )}
        </div>

        {/* Close Button */}
        <div className="pt-2">
          <button
            type="button"
            onClick={onClose}
            className="w-full py-2.5 rounded-2xl bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 font-bold text-xs hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors cursor-pointer text-center"
          >
            إغلاق
          </button>
        </div>
      </motion.div>
    </div>
  )
}
