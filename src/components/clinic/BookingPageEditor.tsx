'use client'

import React from 'react'
import { BookingPageConfig, COLOR_PALETTES } from '@/lib/booking-page-config'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import {
  Palette,
  Layout,
  Type,
  ShieldCheck,
  Eye,
  Sliders,
  CheckCircle2,
  Sparkles
} from 'lucide-react'

export interface BookingPageEditorProps {
  value: BookingPageConfig
  onChange: (value: BookingPageConfig) => void
}

export function BookingPageEditor({ value, onChange }: BookingPageEditorProps) {
  const updateField = <K extends keyof BookingPageConfig>(field: K, val: BookingPageConfig[K]) => {
    onChange({
      ...value,
      [field]: val
    })
  }

  const updateTrustAr = (index: number, text: string) => {
    const list = [...(value.trustAr || [])]
    list[index] = text
    updateField('trustAr', list)
  }

  const updateTrustEn = (index: number, text: string) => {
    const list = [...(value.trustEn || [])]
    list[index] = text
    updateField('trustEn', list)
  }

  return (
    <div className="space-y-6" dir="rtl">
      {/* 1. Header Banner */}
      <div className="yalla-card p-6 border-b border-border space-y-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-primary" />
          <h2 className="text-base font-black text-foreground">محرر صفحة حجز المريض الحية</h2>
          <Badge className="bg-primary/10 text-primary border-primary/20 text-[10px] font-bold">
            Live Preview
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">
          تحكم بالكامل في تصميم وترتيب ونصوص وألوان صفحة الحجز العامة لمرضاك. التعديلات تظهر فوراً في المعاينة الحية على اليسار.
        </p>
      </div>

      {/* 2. Color Palettes */}
      <div className="yalla-card p-6 space-y-5">
        <div className="pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">باليتات ألوان صفحة الحجز</h3>
          </div>
          <span className="text-[11px] text-muted-foreground font-medium">اختر للتطبيق الفوري</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
          {COLOR_PALETTES.map((preset) => {
            const isSelected =
              value.primaryColor?.toLowerCase() === preset.primary.toLowerCase()
            return (
              <button
                key={preset.primary}
                type="button"
                onClick={() => {
                  onChange({
                    ...value,
                    primaryColor: preset.primary,
                    secondaryColor: preset.secondary
                  })
                }}
                className={`flex items-center justify-between p-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? 'border-primary bg-primary/10 text-primary shadow-xs ring-1 ring-primary/30'
                    : 'border-border bg-card hover:bg-muted/50 text-foreground'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <div className="flex items-center -space-x-1 rtl:space-x-reverse">
                    <span
                      style={{ backgroundColor: preset.primary }}
                      className="w-5 h-5 rounded-full border-2 border-white dark:border-slate-800 shadow-2xs inline-block"
                    />
                    <span
                      style={{ backgroundColor: preset.secondary }}
                      className="w-4 h-4 rounded-full border-2 border-white dark:border-slate-800 shadow-2xs inline-block"
                    />
                  </div>
                  <span>{preset.label}</span>
                </div>
                {isSelected && <CheckCircle2 className="w-4 h-4 text-primary" />}
              </button>
            )
          })}
        </div>

        {/* Custom hex colors */}
        <div className="pt-3 border-t border-border grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground">اللون الأساسي المخصص</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value.primaryColor || '#087CF4'}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                className="w-9 h-9 rounded-xl cursor-pointer border border-border p-0.5 bg-background shrink-0"
              />
              <Input
                value={value.primaryColor || '#087CF4'}
                onChange={(e) => updateField('primaryColor', e.target.value)}
                className="h-9 text-xs rounded-xl font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground">اللون الثانوي المخصص</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value.secondaryColor || '#0284C7'}
                onChange={(e) => updateField('secondaryColor', e.target.value)}
                className="w-9 h-9 rounded-xl cursor-pointer border border-border p-0.5 bg-background shrink-0"
              />
              <Input
                value={value.secondaryColor || '#0284C7'}
                onChange={(e) => updateField('secondaryColor', e.target.value)}
                className="h-9 text-xs rounded-xl font-mono text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 3. Hero Layout (Doctor First vs Copy First) */}
      <div className="yalla-card p-6 space-y-4">
        <div className="pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layout className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">نمط عرض واجهة الهيرو (Hero Layout)</h3>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => updateField('heroLayout', 'doctor_first')}
            className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
              value.heroLayout === 'doctor_first'
                ? 'border-primary bg-primary/10 ring-1 ring-primary/30 text-primary'
                : 'border-border bg-card hover:bg-muted/40 text-foreground'
            }`}
          >
            <div className="font-black text-xs mb-1">صورة الطبيب أولاً</div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              إبراز صورة وهوية الطبيب في صدارة واجهة الموبايل والكمبيوتر لتعزيز الثقة الفورية.
            </p>
          </button>

          <button
            type="button"
            onClick={() => updateField('heroLayout', 'copy_first')}
            className={`p-3.5 rounded-2xl border text-right transition-all cursor-pointer ${
              value.heroLayout === 'copy_first'
                ? 'border-primary bg-primary/10 ring-1 ring-primary/30 text-primary'
                : 'border-border bg-card hover:bg-muted/40 text-foreground'
            }`}
          >
            <div className="font-black text-xs mb-1">عنوان العيادة والوصف أولاً</div>
            <p className="text-[11px] text-muted-foreground leading-normal">
              إبراز اسم العيادة والتخصص والخدمات مباشرة قبل بطاقة الطبيب.
            </p>
          </button>
        </div>
      </div>

      {/* 4. Headlines & Descriptions (Arabic & English) */}
      <div className="yalla-card p-6 space-y-4">
        <div className="pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Type className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">العناوين والشارات الترويجية</h3>
          </div>
        </div>

        <div className="space-y-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">العنوان الرئيسي (عربي)</Label>
              <Input
                value={value.headlineAr || ''}
                onChange={(e) => updateField('headlineAr', e.target.value)}
                placeholder="مثال: احجز موعدك الآن"
                className="h-10 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Main Headline (English)</Label>
              <Input
                value={value.headlineEn || ''}
                onChange={(e) => updateField('headlineEn', e.target.value)}
                placeholder="e.g. Book Your Appointment"
                className="h-10 text-xs rounded-xl text-left"
                dir="ltr"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">الشارة الترويجية (Badge عربي)</Label>
              <Input
                value={value.badgeAr || ''}
                onChange={(e) => updateField('badgeAr', e.target.value)}
                placeholder="رعاية صحية أفضل.. بخطوة أسهل"
                className="h-10 text-xs rounded-xl"
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold text-foreground">Hero Badge (English)</Label>
              <Input
                value={value.badgeEn || ''}
                onChange={(e) => updateField('badgeEn', e.target.value)}
                placeholder="Better Healthcare.. In One Easy Step"
                className="h-10 text-xs rounded-xl text-left"
                dir="ltr"
              />
            </div>
          </div>
        </div>
      </div>

      {/* 5. Custom Button Labels */}
      <div className="yalla-card p-6 space-y-4">
        <div className="pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sliders className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">نصوص الأزرار والتنقل (عربي وإنجليزي)</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground">زر حجز الموعد (عربي)</Label>
            <Input
              value={value.bookLabelAr || ''}
              onChange={(e) => updateField('bookLabelAr', e.target.value)}
              placeholder="حجز موعد الآن"
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground">Booking Button (English)</Label>
            <Input
              value={value.bookLabelEn || ''}
              onChange={(e) => updateField('bookLabelEn', e.target.value)}
              placeholder="Book Appointment"
              className="h-9 text-xs rounded-xl text-left"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground">زر متابعة الدور (عربي)</Label>
            <Input
              value={value.trackLabelAr || ''}
              onChange={(e) => updateField('trackLabelAr', e.target.value)}
              placeholder="تابع دورك"
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground">Track Queue (English)</Label>
            <Input
              value={value.trackLabelEn || ''}
              onChange={(e) => updateField('trackLabelEn', e.target.value)}
              placeholder="Track Queue"
              className="h-9 text-xs rounded-xl text-left"
              dir="ltr"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground">زر بوابة المريض (عربي)</Label>
            <Input
              value={value.portalLabelAr || ''}
              onChange={(e) => updateField('portalLabelAr', e.target.value)}
              placeholder="بوابة المريض"
              className="h-9 text-xs rounded-xl"
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-[11px] font-bold text-muted-foreground">Patient Portal (English)</Label>
            <Input
              value={value.portalLabelEn || ''}
              onChange={(e) => updateField('portalLabelEn', e.target.value)}
              placeholder="Patient Portal"
              className="h-9 text-xs rounded-xl text-left"
              dir="ltr"
            />
          </div>
        </div>
      </div>

      {/* 6. Section Visibility Switches */}
      <div className="yalla-card p-6 space-y-4">
        <div className="pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Eye className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">خيارات إظهار وإخفاء أقسام الصفحة</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">قسم الخدمات والأسعار</Label>
              <p className="text-[10px] text-muted-foreground">عرض بطاقات الكشوفات والأسعار</p>
            </div>
            <Switch
              checked={value.showServices !== false}
              onCheckedChange={(checked) => updateField('showServices', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">قسم الخريطة وموقع العيادة</Label>
              <p className="text-[10px] text-muted-foreground">خريطة تفاعلية وزر الاتجاهات</p>
            </div>
            <Switch
              checked={value.showLocation !== false}
              onCheckedChange={(checked) => updateField('showLocation', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">قسم فروع العيادة</Label>
              <p className="text-[10px] text-muted-foreground">عرض قائمة الفروع المتعددة</p>
            </div>
            <Switch
              checked={value.showBranches !== false}
              onCheckedChange={(checked) => updateField('showBranches', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">قسم التواصل وساعات العمل</Label>
              <p className="text-[10px] text-muted-foreground">أرقام الهواتف وأوقات الدوام</p>
            </div>
            <Switch
              checked={value.showContact !== false}
              onCheckedChange={(checked) => updateField('showContact', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">صورة الطبيب الشخصية</Label>
              <p className="text-[10px] text-muted-foreground">إظهار بطاقة صورة الطبيب في الهيرو</p>
            </div>
            <Switch
              checked={value.showDoctorPhoto !== false}
              onCheckedChange={(checked) => updateField('showDoctorPhoto', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">تقييم المرضى</Label>
              <p className="text-[10px] text-muted-foreground">عرض النجوم ومتوسط تقييم العيادة</p>
            </div>
            <Switch
              checked={value.showRating !== false}
              onCheckedChange={(checked) => updateField('showRating', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">سنوات الخبرة الطبية</Label>
              <p className="text-[10px] text-muted-foreground">شارة سنوات الممارسة في الهيرو</p>
            </div>
            <Switch
              checked={value.showExperience !== false}
              onCheckedChange={(checked) => updateField('showExperience', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">شارات الثقة والجودة (Trust Badges)</Label>
              <p className="text-[10px] text-muted-foreground">شريط مميزات العيادة تحت الهيرو</p>
            </div>
            <Switch
              checked={value.showTrust !== false}
              onCheckedChange={(checked) => updateField('showTrust', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">زر متابعة الدور السريع</Label>
              <p className="text-[10px] text-muted-foreground">إتاحة الاستعلام عن الدور المباشر</p>
            </div>
            <Switch
              checked={value.showQueueButton !== false}
              onCheckedChange={(checked) => updateField('showQueueButton', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">رابط بوابة المريض</Label>
              <p className="text-[10px] text-muted-foreground">زر الدخول لملف المريض والروشتات</p>
            </div>
            <Switch
              checked={value.showPatientPortal !== false}
              onCheckedChange={(checked) => updateField('showPatientPortal', checked)}
            />
          </div>

          <div className="flex items-center justify-between p-3 rounded-xl bg-muted/40 border border-border">
            <div className="space-y-0.5">
              <Label className="text-xs font-bold text-foreground">شريط التنقل العلوي (Header)</Label>
              <p className="text-[10px] text-muted-foreground">روابط الانتقال السريع في أعلى الصفحة</p>
            </div>
            <Switch
              checked={value.showHeaderNavigation !== false}
              onCheckedChange={(checked) => updateField('showHeaderNavigation', checked)}
            />
          </div>
        </div>
      </div>

      {/* 7. Trust Badges Customization */}
      <div className="yalla-card p-6 space-y-4">
        <div className="pb-3 border-b border-border flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            <h3 className="font-bold text-sm text-foreground">تخصيص شارات الثقة والجودة (4 شارات)</h3>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {(value.trustAr || ['دقة في المواعيد', 'تقييمات موثقة', 'خدمة متميزة', 'خصوصية وأمان']).slice(0, 4).map((badgeText, idx) => (
            <div key={idx} className="p-3.5 rounded-2xl border border-border bg-card space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-black text-primary">شارة #{idx + 1}</span>
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground font-bold">النص العربي</Label>
                <Input
                  value={badgeText || ''}
                  onChange={(e) => updateTrustAr(idx, e.target.value)}
                  placeholder="عنوان الشارة بالعربية"
                  className="h-8 text-xs rounded-lg"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-[10px] text-muted-foreground font-bold">English Text</Label>
                <Input
                  value={value.trustEn?.[idx] || ''}
                  onChange={(e) => updateTrustEn(idx, e.target.value)}
                  placeholder="Badge text in English"
                  className="h-8 text-xs rounded-lg text-left"
                  dir="ltr"
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default BookingPageEditor
