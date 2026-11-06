'use client'

import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { BookingPageConfig } from '@/lib/booking-page-config'
import { LayoutTemplate, Eye, Languages, MousePointerClick } from 'lucide-react'

type BookingTextKey = Exclude<keyof BookingPageConfig, `show${string}` | 'heroLayout' | 'trustAr' | 'trustEn'>
type BookingSwitchKey = Extract<keyof BookingPageConfig, `show${string}`>

const textFields: { ar: BookingTextKey; en: BookingTextKey; title: string }[] = [
  { ar: 'headlineAr', en: 'headlineEn', title: 'العنوان الرئيسي' },
  { ar: 'badgeAr', en: 'badgeEn', title: 'العبارة الصغيرة فوق العنوان' },
  { ar: 'bookLabelAr', en: 'bookLabelEn', title: 'زر الحجز الرئيسي' },
  { ar: 'trackLabelAr', en: 'trackLabelEn', title: 'زر متابعة الدور' },
  { ar: 'portalLabelAr', en: 'portalLabelEn', title: 'زر بوابة المريض' },
  { ar: 'servicesTitleAr', en: 'servicesTitleEn', title: 'عنوان الخدمات' },
  { ar: 'locationTitleAr', en: 'locationTitleEn', title: 'عنوان الخريطة' },
  { ar: 'branchesTitleAr', en: 'branchesTitleEn', title: 'عنوان الفروع' },
]

const sectionSwitches: { key: BookingSwitchKey; label: string; hint: string }[] = [
  { key: 'showDoctorPhoto', label: 'صورة الدكتور', hint: 'إظهار صورة الطبيب في واجهة الحجز' },
  { key: 'showRating', label: 'تقييم الطبيب', hint: 'إظهار تقييم الطبيب المسجل' },
  { key: 'showExperience', label: 'سنوات الخبرة', hint: 'شارة الخبرة بجانب الصورة' },
  { key: 'showTrust', label: 'مربعات المميزات', hint: 'الشارات الأربع بجانب الطبيب' },
  { key: 'showServices', label: 'قسم الخدمات والأسعار', hint: 'إخفاء العرض لا يحذف أي خدمة' },
  { key: 'showLocation', label: 'الخريطة', hint: 'إظهار خريطة العيادة' },
  { key: 'showBranches', label: 'الفروع', hint: 'إظهار بطاقات الفروع والحجز بها' },
  { key: 'showContact', label: 'معلومات التواصل والمواعيد', hint: 'إظهار بيانات الاتصال وساعات العمل' },
  { key: 'showQueueButton', label: 'زر متابعة الدور', hint: 'إظهار زر متابعة الدور للمرضى' },
  { key: 'showPatientPortal', label: 'بوابة المريض', hint: 'إظهار زر تسجيل دخول المريض' },
  { key: 'showHeaderNavigation', label: 'روابط التنقل في الهيدر', hint: 'الأقسام المعروضة فقط' },
]

export function BookingPageEditor({ value, onChange }: {
  value: BookingPageConfig
  onChange: (next: BookingPageConfig) => void
}) {
  const update = <K extends keyof BookingPageConfig>(key: K, next: BookingPageConfig[K]) => {
    onChange({ ...value, [key]: next })
  }

  return (
    <div className="space-y-6" dir="rtl">
      <div className="border-b border-border pb-4 space-y-2">
        <h2 className="font-black text-lg flex items-center gap-2"><LayoutTemplate className="h-5 w-5 text-primary" /> محرر صفحة حجز المريض</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">عدّل نصوص الصفحة وأقسامها على الكمبيوتر والموبايل. المعاينة تتحدث فورًا؛ ولن تُنشر التغييرات قبل الضغط على «حفظ التعديلات».</p>
      </div>

      {/* Hero Layout */}
      <div className="rounded-2xl border border-border bg-muted/30 p-4 space-y-3">
        <h3 className="text-sm font-bold flex gap-2 items-center"><Eye className="h-4 w-4 text-primary" /> ترتيب الجزء العلوي</h3>
        <div className="grid grid-cols-2 gap-2">
          {([
            ['doctor_first', 'الصورة أولًا'],
            ['copy_first', 'العنوان أولًا'],
          ] as const).map(([layout, label]) => (
            <button key={layout} type="button" onClick={() => update('heroLayout', layout)}
              aria-pressed={value.heroLayout === layout}
              className={`p-3 text-xs font-bold rounded-xl border transition-colors cursor-pointer ${value.heroLayout === layout ? 'border-primary text-primary bg-primary/10' : 'border-border hover:bg-muted'}`}>{label}</button>
          ))}
        </div>
      </div>

      {/* Texts in Arabic and English */}
      <details open className="rounded-2xl border border-border p-4 space-y-4">
        <summary className="font-bold text-sm cursor-pointer flex items-center gap-2 mb-4"><Languages className="h-4 w-4 text-primary" /> النصوص بالعربي والإنجليزي</summary>
        <div className="space-y-4">
          {textFields.map(({ ar, en, title }) => (
            <div className="space-y-2" key={ar}>
              <Label className="text-xs font-bold">{title}</Label>
              <div className="grid sm:grid-cols-2 gap-2">
                <Input aria-label={`${title} بالعربية`} value={value[ar] as string} maxLength={180}
                  onChange={(event) => update(ar, event.target.value)} placeholder="النص بالعربية" className="text-xs rounded-xl" dir="rtl" />
                <Input aria-label={`${title} بالإنجليزية`} value={value[en] as string} maxLength={180}
                  onChange={(event) => update(en, event.target.value)} placeholder="English text" className="text-xs rounded-xl" dir="ltr" />
              </div>
            </div>
          ))}
        </div>
      </details>

      {/* Trust Badges */}
      <details className="rounded-2xl border border-border p-4">
        <summary className="font-bold text-sm cursor-pointer flex items-center gap-2"><MousePointerClick className="h-4 w-4 text-primary" /> الأربع مميزات بجانب الدكتور</summary>
        <div className="space-y-3 mt-4">
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="grid sm:grid-cols-2 gap-2">
              <Input aria-label={`الميزة ${index + 1} بالعربية`} value={value.trustAr[index]} maxLength={100} className="text-xs rounded-xl"
                onChange={(event) => update('trustAr', value.trustAr.map((item, idx) => idx === index ? event.target.value : item))} dir="rtl" />
              <Input aria-label={`Feature ${index + 1} in English`} value={value.trustEn[index]} maxLength={100} className="text-xs rounded-xl"
                onChange={(event) => update('trustEn', value.trustEn.map((item, idx) => idx === index ? event.target.value : item))} dir="ltr" />
            </div>
          ))}
        </div>
      </details>

      {/* Visibility Switches */}
      <div className="rounded-2xl border border-border p-4 space-y-1">
        <h3 className="font-bold text-sm mb-3">إظهار وإخفاء العناصر</h3>
        {sectionSwitches.map(({ key, label, hint }) => (
          <div key={key} className="flex items-center justify-between gap-3 py-3 border-b border-border/60 last:border-0">
            <div className="min-w-0"><Label htmlFor={`booking-${key}`} className="text-xs font-bold cursor-pointer">{label}</Label>
              <p className="text-[11px] text-muted-foreground mt-1">{hint}</p></div>
            <Switch id={`booking-${key}`} checked={value[key]} onCheckedChange={(checked) => update(key, checked)} />
          </div>
        ))}
      </div>

      <p className="text-xs rounded-xl bg-sky-50 text-sky-900 dark:bg-sky-950 dark:text-sky-100 border border-sky-200 dark:border-sky-900 p-3 leading-relaxed">
        صورة الدكتور وبياناته من «الهوية والبيانات»، بينما ألوان ولوجو العيادة تُعدّل من تبويب «الهوية والألوان واللوجو» فقط، ومواعيد الحجز والأسعار من التبويبات المخصصة لها. إخفاء أي قسم لا يحذف بياناته.
      </p>
    </div>
  )
}
