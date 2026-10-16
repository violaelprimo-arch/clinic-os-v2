'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { PatientLiveTurn } from '@/components/clinic/PatientLiveTurn'
import {
  CalendarCheck,
  FileText,
  Receipt,
  ClipboardList,
  Phone,
  Hourglass,
  MessageCircle,
  Menu,
  Pill
} from 'lucide-react'

export default function PatientPortalPage() {
  const params = useParams()
  const slug = (params?.slug as string) || 'zizo'
  const [activeTab, setActiveTab] = useState<'appointments' | 'prescriptions' | 'invoices' | 'medical'>('appointments')
  const [liveTurnOpen, setLiveTurnOpen] = useState<boolean>(false)

  return (
    <div dir="rtl" className="min-h-screen bg-[#f5f9ff] dark:bg-[#050d1a] text-slate-900 dark:text-white py-8 px-4">
      <div className="max-w-md mx-auto bg-[#f5f9ff] dark:bg-[#081526] rounded-[36px] p-5 shadow-xl border border-sky-100 dark:border-slate-800 space-y-4">
        {/* Top Header */}
        <div className="flex items-center justify-between">
          <a
            href="https://wa.me/201551007018"
            target="_blank"
            rel="noreferrer"
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm text-slate-600 dark:text-slate-300 flex items-center justify-center"
          >
            <MessageCircle className="w-4 h-4" />
          </a>
          <Link href={`/clinic/${slug}`} className="text-xl font-extrabold tracking-tight" dir="ltr">
            <span className="text-sky-600">yalla</span>
            <span className="text-slate-400 font-semibold">clinic</span>
          </Link>
          <Link
            href={`/clinic/${slug}/patient/login`}
            className="w-9 h-9 rounded-xl bg-white dark:bg-slate-800 shadow-sm text-slate-600 dark:text-slate-300 flex items-center justify-center"
          >
            <Menu className="w-4 h-4" />
          </Link>
        </div>

        {/* Patient Profile Card */}
        <div className="bg-white dark:bg-slate-800/90 rounded-2xl p-3.5 shadow-sm border border-sky-100 dark:border-slate-700 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-full bg-sky-100 dark:bg-sky-900/60 border-2 border-sky-500 flex items-center justify-center font-black text-sky-600">
              م
            </div>
            <div>
              <h3 className="font-black text-slate-900 dark:text-white text-sm">محمد علي</h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1" dir="ltr">
                <Phone className="w-3 h-3 text-sky-500" />
                <span>01012345678</span>
              </p>
            </div>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-sky-50 dark:bg-sky-950 text-sky-600 dark:text-sky-400 text-[10px] font-bold">
            ملف موثق
          </span>
        </div>

        {/* 4 Navigation Tabs (مواعيدي | روشتاتي | فواتيري | ملفي الطبي) */}
        <div className="grid grid-cols-4 gap-1.5 bg-white dark:bg-slate-800 p-1.5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 text-center">
          {[
            { id: 'appointments', label: 'مواعيدي', Icon: CalendarCheck },
            { id: 'prescriptions', label: 'روشتاتي', Icon: FileText },
            { id: 'invoices', label: 'فواتيري', Icon: Receipt },
            { id: 'medical', label: 'ملفي الطبي', Icon: ClipboardList }
          ].map(({ id, label, Icon }) => {
            const active = activeTab === id
            return (
              <button
                key={id}
                onClick={() => setActiveTab(id as any)}
                className={`py-2 px-1 rounded-xl text-[11px] flex flex-col items-center gap-1 transition-all ${
                  active
                    ? 'bg-sky-50 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300 font-extrabold'
                    : 'text-slate-500 dark:text-slate-400 font-bold hover:bg-slate-50'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            )
          })}
        </div>

        {/* Upcoming Appointments Section */}
        {(activeTab === 'appointments' || activeTab === 'medical') && (
          <div className="bg-white dark:bg-slate-800/90 rounded-[24px] p-4 shadow-sm border border-sky-100 dark:border-slate-700 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="font-black text-slate-900 dark:text-white text-sm">مواعيدي القادمة</h4>
              <Link href={`/clinic/${slug}`} className="text-[11px] font-bold text-sky-600 hover:underline">
                + حجز جديد
              </Link>
            </div>

            <div className="p-3.5 rounded-2xl bg-sky-50/60 dark:bg-slate-900/60 border border-sky-100 dark:border-slate-700 space-y-3">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-black text-slate-900 dark:text-white text-xs sm:text-sm">السبت 13 أكتوبر 2026</div>
                  <div className="text-xs font-bold text-slate-600 dark:text-slate-300 mt-1">10:30 ص • كشف عادي</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">الفرع الرئيسي</div>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/60 text-sky-600 dark:text-sky-400 flex items-center justify-center shrink-0">
                  <Hourglass className="w-5 h-5" />
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="px-3 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-300 text-[11px] font-extrabold">
                  تم الحجز
                </span>
                <span className="text-[11px] text-slate-400">رقم الدور: #6</span>
              </div>

              <div className="space-y-2 pt-1">
                <button
                  onClick={() => setLiveTurnOpen(true)}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-xs shadow"
                >
                  متابعة الدور
                </button>
                <button className="w-full py-2 rounded-xl bg-rose-50 hover:bg-rose-100 dark:bg-rose-950/40 text-rose-600 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-bold text-xs transition-colors">
                  إلغاء الحجز
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Medical Prescriptions Section */}
        {(activeTab === 'appointments' || activeTab === 'prescriptions') && (
          <div className="bg-white dark:bg-slate-800/90 rounded-[24px] p-4 shadow-sm border border-sky-100 dark:border-slate-700 space-y-3">
            <h4 className="font-black text-slate-900 dark:text-white text-sm">الروشتات الطبية</h4>
            <div className="p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-900/60 border border-slate-100 dark:border-slate-700 space-y-3">
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-extrabold text-slate-900 dark:text-white text-xs">13 أكتوبر 2026</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">كشف عادي • د. أحمد عبد العزيز</div>
                </div>
                <div className="w-10 h-10 rounded-2xl bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-400 flex items-center justify-center">
                  <Pill className="w-5 h-5" />
                </div>
              </div>
              <button
                onClick={() => window.print()}
                className="w-full py-2.5 rounded-xl bg-white dark:bg-slate-800 hover:bg-sky-50 text-sky-700 dark:text-sky-300 border border-sky-200 dark:border-slate-600 font-extrabold text-xs transition-all shadow-sm"
              >
                عرض الروشتة PDF
              </button>
            </div>
          </div>
        )}
      </div>

      {liveTurnOpen && <PatientLiveTurn clinic={{ slug }} onClose={() => setLiveTurnOpen(false)} />}
    </div>
  )
}
