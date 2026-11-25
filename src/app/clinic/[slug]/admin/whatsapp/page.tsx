'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import {
  messageDefaults,
  renderClinicMessage,
  type MessageKind,
} from '@/lib/clinic-message-templates'

const labels = {
  booking_confirmation: 'تأكيد الحجز',
  appointment_reminder: 'تذكير بالموعد',
  appointment_rescheduled: 'تعديل الموعد',
  appointment_cancelled: 'إلغاء الحجز',
  prescription: 'الروشتة',
  invoice: 'الفاتورة',
}
type Preferences = {
  templates: typeof messageDefaults
  prescription: boolean
  invoice: boolean
  qrReady: boolean
  mode: string
}
export default function ClinicWhatsApp() {
  const { slug } = useParams<{ slug: string }>()
  const url = '/api/clinic/' + encodeURIComponent(slug) + '/whatsapp'
  const [prefs, setPrefs] = useState<Preferences>()
  const [notice, setNotice] = useState('')
  const [qr, setQr] = useState('')
  const [saving, setSaving] = useState(false)
  useEffect(() => {
    let active = true
    fetch(url, { cache: 'no-store' })
      .then(async (r) => {
        const data = await r.json()
        if (!r.ok) throw Error(data.error)
        if (active) setPrefs(data)
      })
      .catch((e) => {
        if (active) setNotice(e.message)
      })
    return () => {
      active = false
    }
  }, [url])
  useEffect(
    () => () => {
      if (qr) URL.revokeObjectURL(qr)
    },
    [qr],
  )
  async function loadQr() {
    setQr('')
    setNotice('')
    try {
      const r = await fetch(url + '?qr=1', { cache: 'no-store' })
      if (!r.ok) throw Error((await r.json()).error)
      setQr(URL.createObjectURL(await r.blob()))
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر تحميل الكود')
    }
  }
  async function save() {
    setSaving(true)
    try {
      const r = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(prefs),
      })
      if (!r.ok) throw Error((await r.json()).error)
      setNotice('تم حفظ إعدادات واتساب')
    } catch (e) {
      setNotice(e instanceof Error ? e.message : 'تعذر الحفظ')
    } finally {
      setSaving(false)
    }
  }
  return (
    <main dir="rtl" className="mx-auto max-w-3xl space-y-6 p-5 text-foreground">
      <h1 className="text-2xl font-bold">ربط الواتساب</h1>
      <p role="status">{notice}</p>
      {prefs && (
        <>
          <section className="space-y-3 rounded-xl border bg-card p-5">
            <h2 className="font-bold">ربط موبايل العيادة</h2>
            <p>
              {prefs.mode === 'mock'
                ? 'وضع المحاكاة مفعّل. الرسائل التجريبية لا تصل للموبايل.'
                : prefs.mode === 'live'
                  ? 'الإرسال الفعلي مفعّل.'
                  : 'الإرسال متوقف.'}
            </p>
            <p>
              بعد تخصيص جلسة للعيادة، افتح واتساب على موبايل العيادة، ثم الأجهزة
              المرتبطة ← ربط جهاز، وامسح الكود.
            </p>
            {prefs.qrReady ? (
              <button
                className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
                onClick={loadQr}
              >
                عرض أو تحديث كود QR
              </button>
            ) : (
              <p>كود الربط متاح بعد تفعيل اشتراك Sender وتخصيص جلسة للعيادة.</p>
            )}
            {qr && (
              <img
                src={qr}
                width={220}
                height={220}
                alt="كود ربط واتساب العيادة"
              />
            )}
            <h3 className="font-bold">تقليل احتمالات الحظر</h3>
            <p>
              ابعت تحديثات الحجز للمرضى اللي وافقوا عليها، واحترم طلب إيقاف
              الرسائل. تجنب القوائم المشتراة والإرسال الجماعي المتكرر.
            </p>
          </section>
          <section className="space-y-4 rounded-xl border bg-card p-5">
            <h2 className="font-bold">محتوى رسائل WP Sender</h2>
            <p>
              استخدم {'{اسم_المريض}'} أو {'{اسم_العيادة}'} أو {'{الموعد}'} داخل
              النص. رابط المستند يُضاف تلقائيًا عند مشاركته.
            </p>
            {(Object.keys(labels) as MessageKind[]).map((k) => (
              <div key={k}>
                <label className="block font-medium">
                  {labels[k]}
                  <textarea
                    className="mt-1 block w-full rounded-lg border bg-background p-2 text-foreground"
                    maxLength={1000}
                    value={prefs.templates[k]}
                    onChange={(e) =>
                      setPrefs({
                        ...prefs,
                        templates: { ...prefs.templates, [k]: e.target.value },
                      })
                    }
                  />
                </label>
                <small>
                  {renderClinicMessage(
                    prefs.templates[k],
                    'مريم',
                    'عيادة النور',
                    'الأحد الساعة ٥ مساءً',
                  )}
                </small>
              </div>
            ))}
            {(['prescription', 'invoice'] as const).map((k) => (
              <label key={k} className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={prefs[k]}
                  onChange={(e) =>
                    setPrefs({ ...prefs, [k]: e.target.checked })
                  }
                />
                إرسال {labels[k]} عبر WP Sender عند الضغط على مشاركة
              </label>
            ))}
            <button
              disabled={saving}
              onClick={save}
              className="rounded-lg bg-primary px-4 py-2 text-primary-foreground"
            >
              {saving ? 'جارٍ الحفظ' : 'حفظ الإعدادات'}
            </button>
          </section>
        </>
      )}
    </main>
  )
}
