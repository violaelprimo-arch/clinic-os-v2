'use client'

import React, { useState } from 'react'
import { useRouter, useParams } from 'next/navigation'
import Link from 'next/link'

export default function PatientLoginPage() {
  const router = useRouter()
  const params = useParams()
  const slug = (params?.slug as string) || 'zizo'
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [name, setName] = useState('')
  const [age, setAge] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    try {
      const endpoint = mode === 'login' ? '/api/patient/login' : '/api/patient/register'
      await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, name, age, phone, password })
      })
    } catch {
      // Fallback navigation
    } finally {
      setLoading(false)
      router.push(`/clinic/${slug}/patient`)
    }
  }

  return (
    <div dir="rtl" className="min-h-screen bg-[#f4f9ff] dark:bg-[#050d1a] flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#081526] rounded-[32px] p-6 shadow-xl border border-sky-100 dark:border-slate-800 space-y-5">
        <div className="text-center space-y-1">
          <Link href={`/clinic/${slug}`} className="inline-block text-2xl font-extrabold tracking-tight mb-2" dir="ltr">
            <span className="text-sky-600">yalla</span>
            <span className="text-slate-400 font-semibold">clinic</span>
          </Link>
          <h1 className="text-xl font-black text-slate-900 dark:text-white">بوابة المريض المعتمدة</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            الاطلاع على الكشوفات والروشتات السابقة وتتبع الدور المباشر
          </p>
        </div>

        <div className="grid grid-cols-2 gap-1.5 bg-slate-100 dark:bg-slate-800 p-1 rounded-2xl text-xs font-bold">
          <button
            type="button"
            onClick={() => setMode('login')}
            className={`py-2.5 rounded-xl transition-all ${
              mode === 'login' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-white shadow-sm font-extrabold' : 'text-slate-500'
            }`}
          >
            تسجيل الدخول
          </button>
          <button
            type="button"
            onClick={() => setMode('register')}
            className={`py-2.5 rounded-xl transition-all ${
              mode === 'register' ? 'bg-white dark:bg-slate-700 text-sky-600 dark:text-white shadow-sm font-extrabold' : 'text-slate-500'
            }`}
          >
            حساب مريض جديد
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          {mode === 'register' && (
            <>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">الاسم بالكامل *</label>
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>
              <div>
                <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">السن (بالسنوات - إجباري للروشتة) *</label>
                <input
                  type="number"
                  required
                  value={age}
                  onChange={(e) => setAge(e.target.value)}
                  placeholder="28"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
                />
              </div>
            </>
          )}

          <div>
            <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">رقم التليفون المحمول *</label>
            <input
              type="tel"
              required
              dir="ltr"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="01012345678"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
            />
          </div>

          <div>
            <label className="block text-xs font-bold mb-1 text-slate-700 dark:text-slate-200">كلمة المرور *</label>
            <input
              type="password"
              required
              dir="ltr"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="w-full px-4 py-3 rounded-2xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm font-bold"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3.5 rounded-2xl bg-gradient-to-r from-[#0066dc] to-[#00a8e8] text-white font-extrabold text-sm shadow-lg"
          >
            {loading ? 'جاري التحقق...' : mode === 'login' ? 'تسجيل الدخول للملف الطبي' : 'إنشاء حساب والدخول'}
          </button>
        </form>
      </div>
    </div>
  )
}
