'use client'

import { use, useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Save, Plus, Trash2, Palette, ShieldAlert, Phone, MapPin, Bot, Wallet, Users, Printer } from 'lucide-react'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'

export default function ClinicSettings({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [photoUrl, setPhotoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#0ea5e9')
  const [assistantPermissions, setAssistantPermissions] = useState<string[]>(['appointments'])
  const [averageVisitTime, setAverageVisitTime] = useState<number>(15)
  const [patternNormalCount, setPatternNormalCount] = useState<number>(2)
  const [patternConsultCount, setPatternConsultCount] = useState<number>(1)
  
  // New Info
  const [address, setAddress] = useState('')
  const [phones, setPhones] = useState<string[]>([''])

  const [doctorTitle, setDoctorTitle] = useState('د.')
  const [specialtySubtitle, setSpecialtySubtitle] = useState('مستشار الطب المتخصص والعلاج المتقدم')
  const [clinicName, setClinicName] = useState('')

  // AI Config
  const [aiInstructions, setAiInstructions] = useState('أنت مساعد ذكي لعيادة طبية. مهمتك الإجابة على استفسارات المرضى باختصار ولطف بناءً على معلومات العيادة.')
  
  
  const [isLoading, setIsLoading] = useState(true)
  const [services, setServices] = useState<any[]>([])
  const [onlinePaymentEnabled, setOnlinePaymentEnabled] = useState(false)
  const [walletNumber, setWalletNumber] = useState('')
  const [instapayHandle, setInstapayHandle] = useState('')
  const [assistants, setAssistants] = useState<any[]>([])

  // Rx Settings
  const [rxLogo, setRxLogo] = useState('')
  const [rxDoctorName, setRxDoctorName] = useState('')
  const [rxSpecialty, setRxSpecialty] = useState('')
  const [rxFooterText, setRxFooterText] = useState('')
  const [rxColor, setRxColor] = useState('#1e3a8a')

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const cDoc = snapshot.docs[0]
          setClinicId(cDoc.id)
          const data = cDoc.data()
          setPhotoUrl(data.heroImage || '')
          setPrimaryColor(data.primaryColor || '#0ea5e9')
          setAssistantPermissions(data.assistantPermissions || ['appointments', 'accounts', 'finance'])
          setAverageVisitTime(data.averageVisitTime || 15)
          setPatternNormalCount(data.patternNormalCount || 2)
          setPatternConsultCount(data.patternConsultCount || 1)
          setAddress(data.clinicAddress || '')
          setPhones(data.clinicPhones?.length ? data.clinicPhones : [data.clinicPhone || ''])
          setDoctorTitle(data.doctorTitle || 'د.')
          setSpecialtySubtitle(data.specialtySubtitle || 'مستشار الطب المتخصص والعلاج المتقدم')
          setClinicName(data.clinicName || '')
          setAiInstructions(data.aiInstructions || 'أنت مساعد ذكي لعيادة طبية. مهمتك الإجابة على استفسارات المرضى باختصار ولطف بناءً على معلومات العيادة.')
          
          setOnlinePaymentEnabled(data.onlinePaymentEnabled || false)
          setWalletNumber(data.walletNumber || '')
          setInstapayHandle(data.instapayHandle || '')
          setAssistants(data.assistants || [])
          
          setRxLogo(data.rxLogo || '')
          setRxDoctorName(data.rxDoctorName || '')
          setRxSpecialty(data.rxSpecialty || '')
          setRxFooterText(data.rxFooterText || '')
          setRxColor(data.rxColor || '#1e3a8a')

          setServices(data.services || [
            { id: '1', name: 'كشف عادي', price: 200, type: 'normal' },
            { id: '2', name: 'استشارة', price: 100, type: 'consult' },
            { id: '3', name: 'كشف مستعجل', price: 350, type: 'urgent' },
          ])
        }
      } catch (err) {
        toast.error('حدث خطأ أثناء تحميل الإعدادات')
      } finally {
        setIsLoading(false)
      }
    }
    fetchSettings()
  }, [slug])

  const handleSave = async () => {
    if (!clinicId) return
    setIsLoading(true)
    try {
      await updateDoc(doc(db, 'clinics', clinicId), {
        heroImage: photoUrl,
        services,
        primaryColor,
        assistantPermissions,
        averageVisitTime: Number(averageVisitTime),
        patternNormalCount: Number(patternNormalCount),
        patternConsultCount: Number(patternConsultCount),
        clinicAddress: address,
        clinicPhones: phones.filter(p => p.trim() !== ''),
        doctorTitle,
        specialtySubtitle,
        clinicName,
        aiInstructions,
        onlinePaymentEnabled,
        walletNumber,
        instapayHandle,
        rxLogo,
        rxDoctorName,
        rxSpecialty,
        rxFooterText,
        rxColor
        })
      toast.success('تم حفظ كافة الإعدادات بنجاح')
    } catch (err) {
      toast.error('حدث خطأ أثناء الحفظ')
    } finally {
      setIsLoading(false)
    }
  }

  const togglePermission = (permId: string) => {
    if (assistantPermissions.includes(permId)) {
      setAssistantPermissions(assistantPermissions.filter(p => p !== permId))
    } else {
      setAssistantPermissions([...assistantPermissions, permId])
    }
  }

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-8" dir="rtl">
      <div>
        <h1 className="text-3xl font-bold text-primary">إعدادات العيادة المتقدمة</h1>
        <p className="text-gray-500">تحكم في الهوية، أرقام التواصل، والخدمات</p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-1 space-y-6">
          <Card className="shadow-lg border-t-4 border-t-primary">
            <CardHeader>
              <CardTitle>الهوية البصرية</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col items-center space-y-6">
              <Avatar className="w-40 h-40 border-4 border-slate-100 shadow-xl">
                <AvatarImage src={photoUrl} alt="Doctor Photo" className="object-cover" />
                <AvatarFallback className="text-4xl bg-primary/10 text-primary">صورة</AvatarFallback>
              </Avatar>
              <div className="w-full space-y-2">
                <Label>رابط الصورة المباشر (URL)</Label>
                <Input value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} dir="ltr" className="text-right" placeholder="https://..." />
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-t-purple-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Palette className="w-5 h-5 text-purple-500"/> الألوان</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-4">
                <Input 
                  type="color" 
                  value={primaryColor} 
                  onChange={e => setPrimaryColor(e.target.value)} 
                  className="w-16 h-16 p-1 rounded-xl cursor-pointer"
                />
                <div className="space-y-1">
                  <Label>اللون الرئيسي</Label>
                  <p className="text-sm text-gray-500">{primaryColor}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-t-4 border-t-orange-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><MapPin className="w-5 h-5 text-orange-500"/> بيانات الروشتة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>اللقب (د. - أ.د)</Label>
                <Input value={doctorTitle} onChange={e => setDoctorTitle(e.target.value)} placeholder="مثال: د. أو أ.د" />
              </div>
              <div className="space-y-2">
                <Label>اسم العيادة</Label>
                <Input value={clinicName} onChange={e => setClinicName(e.target.value)} placeholder="مثال: عيادة النور التخصصية" />
              </div>
              <div className="space-y-2">
                <Label>التخصص الدقيق (الوصف أسفل الاسم)</Label>
                <Input value={specialtySubtitle} onChange={e => setSpecialtySubtitle(e.target.value)} placeholder="مثال: استشاري جراحة القلب والصدر" />
              </div>
              <div className="space-y-2">
                <Label>عنوان العيادة</Label>
                <Input value={address} onChange={e => setAddress(e.target.value)} placeholder="مثال: شارع التسعين، التجمع الخامس..." />
              </div>
              <div className="space-y-2">
                <Label>أرقام الهواتف</Label>
                {phones.map((phone, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input value={phone} onChange={e => {
                      const newP = [...phones]
                      newP[idx] = e.target.value
                      setPhones(newP)
                    }} dir="ltr" className="text-right" placeholder="01xxxxxxxxx" />
                    <Button variant="ghost" className="text-red-500 px-2" onClick={() => setPhones(phones.filter((_, i) => i !== idx))}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                ))}
                <Button variant="outline" size="sm" onClick={() => setPhones([...phones, ''])} className="w-full mt-2">
                  <Phone className="w-4 h-4 ml-2" /> إضافة رقم آخر
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="md:col-span-2 space-y-8">
          
          <Card className="shadow-lg border-t-4 border-t-indigo-500">
            <CardHeader>
              <CardTitle>إعدادات الكشف والدور</CardTitle>
              <CardDescription>قم بتحديد نمط دخول المرضى (كم كشف ثم كم استشارة) وسيتم التبديل تلقائياً، مع إعطاء الأولوية القصوى للمستعجل.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>عدد الكشوفات المتتالية</Label>
                  <Input 
                    type="number" 
                    value={patternNormalCount} 
                    onChange={e => setPatternNormalCount(Number(e.target.value))} 
                    min={1} 
                    className="h-12 text-lg font-bold text-center"
                    dir="ltr"
                  />
                  <p className="text-xs text-slate-500 text-right">مثال: 2 (يعني يدخل 2 كشف)</p>
                </div>
                <div className="space-y-2">
                  <Label>عدد الاستشارات المتتالية</Label>
                  <Input 
                    type="number" 
                    value={patternConsultCount} 
                    onChange={e => setPatternConsultCount(Number(e.target.value))} 
                    min={1} 
                    className="h-12 text-lg font-bold text-center"
                    dir="ltr"
                  />
                  <p className="text-xs text-slate-500 text-right">مثال: 1 (ثم يدخل 1 استشارة)</p>
                </div>
              </div>
              <div className="space-y-2 max-w-sm pt-4 border-t">
                <Label>متوسط وقت الكشف الافتراضي (بالدقائق)</Label>
                <Input 
                  type="number" 
                  value={averageVisitTime} 
                  onChange={e => setAverageVisitTime(Number(e.target.value))} 
                  min={1} 
                  max={60}
                  className="text-right h-12 text-lg font-bold"
                  dir="ltr"
                />
              </div>
            </CardContent>
          </Card>

          {/* New AI Card */}
          <Card className="shadow-lg border-t-4 border-t-teal-600 bg-teal-50/30">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-teal-700"><Bot className="w-5 h-5"/> المساعد الذكي (AI Chatbot)</CardTitle>
              <CardDescription>قم بتهيئة روبوت المحادثة الذي سيجيب على أسئلة المرضى في الصفحة الرئيسية.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label className="text-teal-800 font-bold">معلومات العيادة الأساسية (للذكاء الاصطناعي)</Label>
                <Textarea 
                  value={aiInstructions}
                  onChange={e => setAiInstructions(e.target.value)}
                  placeholder="اكتب هنا مواعيد العمل، الأسعار، وأي معلومات تهمه."
                  className="min-h-[120px] bg-white text-right leading-relaxed"
                />
                <p className="text-xs text-slate-500">لتدريب الذكاء الاصطناعي بشكل تفاعلي، استخدم شاشة "تدريب الذكاء الاصطناعي" من القائمة الجانبية.</p>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-t-blue-500">
            <CardHeader>
              <CardTitle>الخدمات والأسعار</CardTitle>
              <CardDescription>أضف خدماتك وحدد نوع كل خدمة ليتمكن النظام من تنظيم الطابور بدقة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {services.map((service, index) => (
                <div key={service.id} className="flex flex-col md:flex-row items-end gap-4 p-4 bg-slate-50 border rounded-xl">
                  <div className="flex-1 space-y-2 w-full">
                    <Label>اسم الخدمة</Label>
                    <Input 
                      value={service.name} 
                      onChange={e => {
                        const newS = [...services];
                        newS[index].name = e.target.value;
                        setServices(newS);
                      }} 
                    />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <Label>نوع الخدمة (لتنظيم الدور)</Label>
                    <select 
                      className="flex h-10 w-full items-center justify-between rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={service.type || 'normal'}
                      onChange={e => {
                        const newS = [...services];
                        newS[index].type = e.target.value;
                        setServices(newS);
                      }}
                    >
                      <option value="normal">كشف عادي</option>
                      <option value="consult">استشارة</option>
                      <option value="urgent">كشف مستعجل (أولوية قصوى)</option>
                    </select>
                  </div>
                  <div className="w-32 space-y-2">
                    <Label>السعر (ج.م)</Label>
                    <Input 
                      type="number" 
                      value={service.price} 
                      onChange={e => {
                        const newS = [...services];
                        newS[index].price = Number(e.target.value);
                        setServices(newS);
                      }} 
                    />
                  </div>
                  <Button variant="ghost" className="text-red-500 hover:bg-red-100 mb-1" onClick={() => {
                    setServices(services.filter((_, i) => i !== index));
                  }}>
                    <Trash2 className="w-5 h-5" />
                  </Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => {
                setServices([...services, { id: Date.now().toString(), name: '', price: 0 }])
              }} className="w-full border-dashed border-2">
                <Plus className="w-4 h-4 ml-2" /> إضافة خدمة جديدة
              </Button>
            </CardContent>
          </Card>

          
          
          


          {/* Payment Settings */}
          <Card className="shadow-lg border-t-4 border-t-green-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Wallet className="w-5 h-5 text-green-500"/> إعدادات الدفع</CardTitle>
              <CardDescription>فعل الدفع الإلكتروني ليتمكن المريض من الدفع أثناء الحجز.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center gap-3 p-4 border rounded-xl bg-slate-50">
                <Switch checked={onlinePaymentEnabled} onCheckedChange={setOnlinePaymentEnabled} />
                <Label className="font-bold cursor-pointer">تفعيل خدمة الدفع الإلكتروني (فودافون كاش - انستاباي)</Label>
              </div>
              {onlinePaymentEnabled && (
                <div className="grid md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>رقم الكاش (محفظة إلكترونية)</Label>
                    <Input value={walletNumber} onChange={e => setWalletNumber(e.target.value)} dir="ltr" className="text-right" placeholder="01xxxxxxxxx" />
                  </div>
                  <div className="space-y-2">
                    <Label>حساب انستاباي (InstaPay Handle)</Label>
                    <Input value={instapayHandle} onChange={e => setInstapayHandle(e.target.value)} dir="ltr" className="text-right" placeholder="username@instapay" />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assistants Settings */}
          <Card className="shadow-lg border-t-4 border-t-purple-600">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><Users className="w-5 h-5 text-purple-600"/> حسابات المساعدين</CardTitle>
              <CardDescription>قم بإنشاء حسابات لمساعديك للدخول إلى لوحة التحكم بصلاحيات محددة.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assistants.map((assistant, index) => (
                <div key={index} className="flex flex-col md:flex-row items-end gap-4 p-4 bg-slate-50 border rounded-xl">
                  <div className="flex-1 space-y-2 w-full">
                    <Label>اسم المساعد</Label>
                    <Input value={assistant.name} onChange={e => {
                      const newA = [...assistants]; newA[index].name = e.target.value; setAssistants(newA);
                    }} />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <Label>البريد الإلكتروني</Label>
                    <Input value={assistant.email} onChange={e => {
                      const newA = [...assistants]; newA[index].email = e.target.value; setAssistants(newA);
                    }} dir="ltr" className="text-right" />
                  </div>
                  <div className="flex-1 space-y-2 w-full">
                    <Label>كلمة المرور</Label>
                    <Input value={assistant.password} onChange={e => {
                      const newA = [...assistants]; newA[index].password = e.target.value; setAssistants(newA);
                    }} dir="ltr" className="text-right" />
                  </div>
                  <Button variant="ghost" className="text-red-500 hover:bg-red-100 mb-1" onClick={() => {
                    setAssistants(assistants.filter((_, i) => i !== index));
                  }}><Trash2 className="w-5 h-5" /></Button>
                </div>
              ))}
              <Button variant="outline" onClick={() => {
                setAssistants([...assistants, { name: '', email: '', password: '' }])
              }} className="w-full border-dashed border-2">
                <Plus className="w-4 h-4 ml-2" /> إضافة مساعد جديد
              </Button>
            </CardContent>
          </Card>

          <Card className="shadow-lg border-t-4 border-t-teal-500">
            <CardHeader>
              <CardTitle className="flex items-center gap-2"><ShieldAlert className="w-5 h-5 text-teal-500"/> صلاحيات المساعد</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid md:grid-cols-2 gap-4">
                <div className="flex items-center gap-3 p-3 border rounded-xl bg-slate-50">
                  <Switch checked={true} disabled />
                  <Label className="font-bold opacity-70">الدور والمواعيد (إجباري)</Label>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 transition-colors">
                  <Switch checked={assistantPermissions.includes('patients')} onCheckedChange={() => togglePermission('patients')} />
                  <Label className="font-bold cursor-pointer" onClick={() => togglePermission('patients')}>سجل المرضى</Label>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 transition-colors">
                  <Switch checked={assistantPermissions.includes('prescriptions')} onCheckedChange={() => togglePermission('prescriptions')} />
                  <Label className="font-bold cursor-pointer" onClick={() => togglePermission('prescriptions')}>الروشتات الطبية</Label>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 transition-colors">
                  <Switch checked={assistantPermissions.includes('accounts')} onCheckedChange={() => togglePermission('accounts')} />
                  <Label className="font-bold cursor-pointer" onClick={() => togglePermission('accounts')}>إدارة الحسابات وتأكيد الدفع</Label>
                </div>
                <div className="flex items-center gap-3 p-3 border rounded-xl hover:bg-slate-50 transition-colors">
                  <Switch checked={assistantPermissions.includes('finance')} onCheckedChange={() => togglePermission('finance')} />
                  <Label className="font-bold cursor-pointer" onClick={() => togglePermission('finance')}>التقارير المالية</Label>
                </div>
              </div>
            </CardContent>
          </Card>
          
          <Card className="shadow-lg border-t-4" style={{ borderTopColor: rxColor || primaryColor }}>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Printer className="w-5 h-5" style={{ color: rxColor || primaryColor }} /> إعدادات طباعة الروشتة (تصميم A4)
              </CardTitle>
              <CardDescription>قم بتخصيص تصميم الروشتة المطبوعة (اللوجو، الألوان، والتذييل)</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>رابط لوجو العيادة (للهيدر والعلامة المائية)</Label>
                  <Input 
                    placeholder="https://example.com/logo.png" 
                    value={rxLogo} 
                    onChange={e => setRxLogo(e.target.value)} 
                    dir="ltr"
                    className="text-left"
                  />
                </div>
                <div className="space-y-2">
                  <Label>لون تصميم الروشتة (Hex)</Label>
                  <div className="flex gap-2">
                    <Input 
                      type="color" 
                      value={rxColor} 
                      onChange={e => setRxColor(e.target.value)} 
                      className="w-16 h-10 p-1 cursor-pointer"
                    />
                    <Input 
                      value={rxColor} 
                      onChange={e => setRxColor(e.target.value)} 
                      dir="ltr"
                      className="flex-1 font-mono uppercase"
                    />
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <Label>اسم الطبيب في الهيدر (مثل: د. شهاب كشاف)</Label>
                  <Input 
                    value={rxDoctorName} 
                    onChange={e => setRxDoctorName(e.target.value)} 
                    placeholder="اسم الطبيب"
                  />
                </div>
                <div className="space-y-2">
                  <Label>تخصص الطبيب في الهيدر (مثل: ماجستير في طب الأسنان)</Label>
                  <Input 
                    value={rxSpecialty} 
                    onChange={e => setRxSpecialty(e.target.value)} 
                    placeholder="التخصص"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>النص في تذييل الروشتة (العنوان والهواتف)</Label>
                <Input 
                  value={rxFooterText} 
                  onChange={e => setRxFooterText(e.target.value)} 
                  placeholder="مثال: العنوان: الحي ١٢ شارع كان كان - موبايل العيادة: ٠١٠٠٠٠٠٠٠٠٠"
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={isLoading} className="h-14 px-12 text-lg font-bold rounded-full shadow-lg hover:scale-105 transition-transform">
              <Save className="w-5 h-5 ml-2" /> {isLoading ? 'جاري الحفظ...' : 'حفظ كافة التعديلات'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
