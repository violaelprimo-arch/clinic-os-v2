'use client'

import { use, useEffect, useState } from 'react'
import {
  Building2, Plus, Edit, Trash2, MapPin, Phone, Clock,
  Calendar, CheckCircle2, XCircle, AlertCircle, Save, X,
  ExternalLink, Power, Archive, ShieldCheck
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc
} from 'firebase/firestore'
import { Branch, BranchScheduleDay } from '@/types/clinic'
import {
  DEFAULT_WEEKLY_SCHEDULE,
  ensureClinicHasMainBranch,
  getClinicBranches,
  checkScheduleConflicts
} from '@/lib/branchService'
import { useLanguage } from '@/context/LanguageContext'

export default function BranchesPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, dir } = useLanguage()

  const [clinic, setClinic] = useState<any>(null)
  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  // Edit / Add modal state
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null)

  // Form Fields
  const [name, setName] = useState('')
  const [governorate, setGovernorate] = useState('القاهرة')
  const [city, setCity] = useState('القاهرة')
  const [area, setArea] = useState('')
  const [address, setAddress] = useState('')
  const [mapsLink, setMapsLink] = useState('')
  const [latitude, setLatitude] = useState<string>('')
  const [longitude, setLongitude] = useState<string>('')
  const [phone, setPhone] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [image, setImage] = useState('')
  const [slotDuration, setSlotDuration] = useState<number>(15)
  const [maxDailyBookings, setMaxDailyBookings] = useState<number>(0)
  const [isOpen, setIsOpen] = useState(true)
  const [weeklySchedule, setWeeklySchedule] = useState<BranchScheduleDay[]>(DEFAULT_WEEKLY_SCHEDULE)
  const [conflicts, setConflicts] = useState<string[]>([])

  useEffect(() => {
    const fetchClinicAndBranches = async () => {
      try {
        const cQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(cQ)
        if (cSnap.empty) {
          setIsLoading(false)
          return
        }
        const cData = { id: cSnap.docs[0].id, ...cSnap.docs[0].data() }
        setClinic(cData)

        // Ensure main branch exists
        await ensureClinicHasMainBranch(cData)
        const branchList = await getClinicBranches(cData.id)
        setBranches(branchList)
      } catch (err) {
        console.error('Error loading branches:', err)
        toast.error('حدث خطأ أثناء تحميل الفروع')
      } finally {
        setIsLoading(false)
      }
    }
    fetchClinicAndBranches()
  }, [slug])

  // Live conflict checking whenever schedule changes
  useEffect(() => {
    if (!isModalOpen) return
    const candidate: Partial<Branch> = {
      id: editingBranchId || 'new',
      name: name || 'الفرع الجديد',
      weeklySchedule,
      isOpen
    }
    const detected = checkScheduleConflicts(branches, candidate)
    setConflicts(detected)
  }, [weeklySchedule, isOpen, name, editingBranchId, branches, isModalOpen])

  const branchesEnabled = clinic?.branchesEnabled !== false
  const maxBranches = typeof clinic?.maxBranches === 'number' ? clinic.maxBranches : 1
  const activeBranches = branches.filter((b) => !b.isArchived)
  const isLimitReached = activeBranches.length >= maxBranches
  const canAddBranch = branchesEnabled && !isLimitReached

  const openAddModal = () => {
    if (!branchesEnabled) {
      toast.error('ميزة تعدد الفروع غير مفعلة لاشتراك عيادتكم. يرجى التواصل مع إدارة Yalla Clinic.')
      return
    }
    if (isLimitReached) {
      toast.error(`لقد وصلت للحد الأقصى المسموح به من الفروع (${maxBranches} فروع). يرجى ترقية الباقة لإضافة فروع جديدة.`)
      return
    }
    setEditingBranchId(null)
    setName('')
    setGovernorate('القاهرة')
    setCity('القاهرة')
    setArea('')
    setAddress('')
    setMapsLink('')
    setLatitude('')
    setLongitude('')
    setPhone(clinic?.clinicPhone || '')
    setWhatsapp(clinic?.clinicPhone || '')
    setImage('')
    setSlotDuration(15)
    setMaxDailyBookings(0)
    setIsOpen(true)
    setWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE)
    setConflicts([])
    setIsModalOpen(true)
  }

  const openEditModal = (b: Branch) => {
    setEditingBranchId(b.id)
    setName(b.name || '')
    setGovernorate(b.governorate || 'القاهرة')
    setCity(b.city || 'القاهرة')
    setArea(b.area || '')
    setAddress(b.address || '')
    setMapsLink(b.mapsLink || '')
    setLatitude(b.latitude ? String(b.latitude) : '')
    setLongitude(b.longitude ? String(b.longitude) : '')
    setPhone(b.phone || '')
    setWhatsapp(b.whatsapp || '')
    setImage(b.image || '')
    setSlotDuration(b.slotDuration || 15)
    setMaxDailyBookings(b.maxDailyBookings || 0)
    setIsOpen(b.isOpen !== false)
    setWeeklySchedule(b.weeklySchedule?.length ? b.weeklySchedule : DEFAULT_WEEKLY_SCHEDULE)
    setConflicts([])
    setIsModalOpen(true)
  }

  const handleToggleScheduleDay = (index: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d, i) => (i === index ? { ...d, isOpen: !d.isOpen } : d))
    )
  }

  const handleScheduleTimeChange = (index: number, field: 'start' | 'end', val: string) => {
    setWeeklySchedule((prev) =>
      prev.map((d, i) => (i === index ? { ...d, [field]: val } : d))
    )
  }

  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) return toast.error('يرجى إدخال اسم الفرع')
    if (!address.trim()) return toast.error('يرجى إدخال عنوان الفرع بالتفصيل')
    if (!phone.trim()) return toast.error('يرجى إدخال رقم هاتف الفرع')

    if (!editingBranchId) {
      if (!branchesEnabled) {
        return toast.error('ميزة تعدد الفروع غير مفعلة لاشتراك عيادتكم. يرجى التواصل مع إدارة Yalla Clinic.')
      }
      if (isLimitReached) {
        return toast.error(`تم الوصول للحد الأقصى للفروع المسموح بها (${maxBranches} فروع). يرجى ترقية الباقة لإضافة فروع جديدة.`)
      }
    }

    if (conflicts.length > 0) {
      const confirmSave = confirm(
        'تنبيه: تم رصد تعارض في مواعيد عمل الطبيب بين الفروع:\n\n' +
          conflicts.join('\n') +
          '\n\nهل تريد المتابعة والحفظ بالرغم من ذلك؟'
      )
      if (!confirmSave) return
    }

    setIsSaving(true)
    const clinicId = clinic.id || clinic.slug

    try {
      const payload: Partial<Branch> = {
        clinicId,
        name,
        governorate,
        city,
        area: area || city,
        address,
        mapsLink,
        latitude: latitude ? parseFloat(latitude) : undefined,
        longitude: longitude ? parseFloat(longitude) : undefined,
        phone,
        whatsapp: whatsapp || phone,
        image,
        slotDuration: Number(slotDuration) || 15,
        maxDailyBookings: Number(maxDailyBookings) || 0,
        isOpen,
        weeklySchedule,
        updatedAt: new Date().toISOString()
      }

      if (editingBranchId) {
        await updateDoc(doc(db, 'branches', editingBranchId), payload)
        setBranches((prev) =>
          prev.map((b) => (b.id === editingBranchId ? ({ ...b, ...payload } as Branch) : b))
        )
        toast.success(`تم تحديث بيانات فرع "${name}" بنجاح!`)
      } else {
        const docRef = await addDoc(collection(db, 'branches'), {
          ...payload,
          isMain: false,
          isArchived: false,
          createdAt: new Date().toISOString()
        })
        const newBranch = { id: docRef.id, ...payload, isMain: false, isArchived: false } as Branch
        setBranches((prev) => [...prev, newBranch])
        toast.success(`تمت إضافة فرع "${name}" بنجاح!`)
      }

      setIsModalOpen(false)
    } catch (err: any) {
      console.error('Error saving branch:', err)
      toast.error('حدث خطأ أثناء حفظ الفرع: ' + err.message)
    } finally {
      setIsSaving(false)
    }
  }

  const handleToggleStatus = async (branchId: string, currentStatus: boolean) => {
    try {
      await updateDoc(doc(db, 'branches', branchId), {
        isOpen: !currentStatus,
        updatedAt: new Date().toISOString()
      })
      setBranches((prev) =>
        prev.map((b) => (b.id === branchId ? { ...b, isOpen: !currentStatus } : b))
      )
      toast.success(currentStatus ? 'تم إيقاف حجز الفرع مؤقتاً' : 'تم تفعيل حجز الفرع للعمل')
    } catch (err) {
      toast.error('حدث خطأ أثناء تعديل حالة الفرع')
    }
  }

  const handleArchiveBranch = async (branchId: string, isMain?: boolean) => {
    if (isMain) {
      return toast.error('لا يمكن أرشفة الفرع الرئيسي للعيادة')
    }
    if (!confirm('هل أنت متأكد من أرشفة هذا الفرع؟ سيتوقف استقبال الحجوزات عليه مع الاحتفاظ بسجلات المرضى والفواتير القديمة.')) {
      return
    }
    try {
      await updateDoc(doc(db, 'branches', branchId), {
        isArchived: true,
        isOpen: false,
        updatedAt: new Date().toISOString()
      })
      setBranches((prev) => prev.filter((b) => b.id !== branchId))
      toast.success('تمت أرشفة الفرع بنجاح مع الحفاظ على كافة البيانات التاريخية')
    } catch (err) {
      toast.error('حدث خطأ أثناء أرشفة الفرع')
    }
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2.5">
            <Building2 className="w-7 h-7 text-primary" />
            إدارة فروع العيادة
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            إضافة فروع متعددة للعيادة، تخصيص مواعيد عمل وجدول أسبوعي مستقل لكل فرع، وتجنب تعارض مواعيد الطبيب
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Badge
            variant="outline"
            className={`text-xs px-3 py-1.5 font-bold ${
              !branchesEnabled
                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                : isLimitReached
                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                : 'bg-primary/10 text-primary border-primary/20'
            }`}
          >
            {!branchesEnabled
              ? 'ميزة تعدد الفروع غير مفعلة'
              : `باقة الفروع: ${activeBranches.length} من ${maxBranches} فروع`}
          </Badge>

          {canAddBranch && (
            <Button
              onClick={openAddModal}
              className="h-10 px-4 yalla-gradient-btn text-white font-bold rounded-xl shadow-xs text-xs cursor-pointer"
            >
              <Plus className="w-4 h-4 ml-1.5" />
              إضافة فرع جديد
            </Button>
          )}
        </div>
      </div>

      {!branchesEnabled && (
        <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-400 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500 shrink-0" />
            <span>
              ميزة تعدد الفروع غير مفعلة في اشتراك هذه العيادة. يعمل الفرع الرئيسي حالياً بصورة طبيعية، ولطلب زيادة عدد الفروع يرجى التواصل مع إدارة Yalla Clinic.
            </span>
          </div>
        </div>
      )}

      {branchesEnabled && isLimitReached && (
        <div className="p-4 rounded-2xl bg-primary/10 border border-primary/20 text-primary text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-primary shrink-0" />
            <span>
              تم استهلاك السعة القصوى للفروع المتاحة في باقتكم ({activeBranches.length} من أصل {maxBranches} فروع). لترقية الباقة يرجى التواصل مع إدارة Yalla Clinic.
            </span>
          </div>
        </div>
      )}

      {/* Branches Cards Grid */}
      {isLoading ? (
        <div className="py-20 text-center text-muted-foreground">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2" />
          جاري تحميل الفروع...
        </div>
      ) : branches.length === 0 ? (
        <div className="yalla-card p-12 text-center space-y-3">
          <Building2 className="w-12 h-12 text-muted-foreground/40 mx-auto" />
          <h3 className="font-bold text-base text-foreground">لا توجد فروع مسجلة</h3>
          <p className="text-xs text-muted-foreground">يمكنك إضافة فروع جديدة لتمكين المرضى من اختيار الفرع الأقرب إليهم.</p>
          <Button onClick={openAddModal} size="sm" className="yalla-gradient-btn text-white rounded-xl">
            إضافة الفرع الأول
          </Button>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5">
          {branches.map((b) => (
            <div
              key={b.id}
              className={`yalla-card p-5 space-y-4 transition-all shadow-xs ${
                b.isOpen ? 'border border-border hover:border-primary/40' : 'border border-rose-500/20 bg-rose-500/5'
              }`}
            >
              {/* Branch Title & Status */}
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base text-foreground">{b.name}</h3>
                    {b.isMain && (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                        الرئيسي
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <MapPin className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                    <span>{b.area || b.city} • {b.address}</span>
                  </p>
                </div>

                <Badge
                  className={`text-[10px] font-bold px-2 py-0.5 border-none ${
                    b.isOpen ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                  }`}
                >
                  {b.isOpen ? 'مفتوح للحجز' : 'مغلق مؤقتاً'}
                </Badge>
              </div>

              {/* Contact info */}
              <div className="p-3 bg-muted/40 rounded-xl space-y-1.5 text-xs text-foreground">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">الهاتف:</span>
                  <span className="font-mono font-bold">{b.phone}</span>
                </div>
                {b.whatsapp && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">واتساب:</span>
                    <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">{b.whatsapp}</span>
                  </div>
                )}
                {b.slotDuration && (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">مدة الكشف:</span>
                    <span>{b.slotDuration} دقيقة</span>
                  </div>
                )}
                {b.maxDailyBookings ? (
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">الحد الأقصى يومياً:</span>
                    <span>{b.maxDailyBookings} كشف</span>
                  </div>
                ) : null}
              </div>

              {/* Working Days Pill Tags */}
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-muted-foreground block">أيام العمل المفتوحة:</span>
                <div className="flex flex-wrap gap-1">
                  {b.weeklySchedule?.filter((d) => d.isOpen).map((d) => (
                    <span
                      key={d.id}
                      className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20"
                    >
                      {d.day} ({d.start}-{d.end})
                    </span>
                  ))}
                </div>
              </div>

              {/* Actions Footer */}
              <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => openEditModal(b)}
                  className="h-8 px-3 text-xs font-bold text-primary border-primary/20 hover:bg-primary/5 rounded-xl"
                >
                  <Edit className="w-3.5 h-3.5 ml-1" />
                  تعديل
                </Button>

                <div className="flex items-center gap-1.5">
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleToggleStatus(b.id, b.isOpen)}
                    className={`h-8 px-2 text-xs font-bold rounded-xl ${
                      b.isOpen ? 'text-amber-600 hover:bg-amber-500/10' : 'text-emerald-600 hover:bg-emerald-500/10'
                    }`}
                    title={b.isOpen ? 'إيقاف الحجز' : 'فتح الحجز'}
                  >
                    <Power className="w-3.5 h-3.5 ml-1" />
                    {b.isOpen ? 'إيقاف' : 'تفعيل'}
                  </Button>

                  {!b.isMain && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleArchiveBranch(b.id, b.isMain)}
                      className="h-8 w-8 p-0 text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 rounded-xl"
                      title="أرشفة الفرع"
                    >
                      <Archive className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add / Edit Branch Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in" dir={dir}>
          <div className="bg-card text-card-foreground rounded-3xl shadow-2xl border border-border w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Modal Header */}
            <div className="p-4 border-b border-border flex items-center justify-between bg-muted/40">
              <div className="flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <h3 className="font-black text-sm text-foreground">
                  {editingBranchId ? 'تعديل بيانات الفرع' : 'إضافة فرع جديد للعيادة'}
                </h3>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-muted-foreground hover:text-foreground p-1.5 rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <form onSubmit={handleSaveBranch} className="overflow-y-auto p-6 space-y-6 flex-1">
              {/* Conflicts Alert Banner if any */}
              {conflicts.length > 0 && (
                <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl space-y-1 text-xs text-amber-700 dark:text-amber-400">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>تنبيه تعارض مواعيد الطبيب بين الفروع:</span>
                  </div>
                  <ul className="list-disc list-inside space-y-0.5 text-[11px] pr-2">
                    {conflicts.map((c, i) => (
                      <li key={i}>{c}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Section 1: Basic Info */}
              <div className="space-y-3">
                <h4 className="text-xs font-black text-foreground">بيانات الفرع والعنوان</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">اسم الفرع *</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="مثال: فرع التجمع الخامس"
                      className="h-10 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">المحافظة / المدينة</Label>
                    <Input
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                      placeholder="القاهرة / الجيزة"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <Label className="text-xs font-bold text-muted-foreground">العنوان بالتفصيل *</Label>
                    <Input
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                      placeholder="الشارع، المبنى، الدور، علامة مميزة"
                      className="h-10 text-xs rounded-xl"
                      required
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">رابط Google Maps</Label>
                    <Input
                      value={mapsLink}
                      onChange={(e) => setMapsLink(e.target.value)}
                      placeholder="https://maps.google.com/..."
                      className="h-10 text-xs rounded-xl"
                      dir="ltr"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Latitude (إحداثي)</Label>
                      <Input
                        value={latitude}
                        onChange={(e) => setLatitude(e.target.value)}
                        placeholder="30.0444"
                        className="h-10 text-xs rounded-xl"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-[11px] font-bold text-muted-foreground">Longitude (إحداثي)</Label>
                      <Input
                        value={longitude}
                        onChange={(e) => setLongitude(e.target.value)}
                        placeholder="31.2357"
                        className="h-10 text-xs rounded-xl"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Section 2: Contact & Operating Numbers */}
              <div className="space-y-3 pt-2 border-t border-border">
                <h4 className="text-xs font-black text-foreground">أرقام التواصل وإعدادات الكشف</h4>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">رقم هاتف الفرع *</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="01012345678"
                      className="h-10 text-xs rounded-xl"
                      required
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">رقم واتساب الفرع</Label>
                    <Input
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      placeholder="01012345678"
                      className="h-10 text-xs rounded-xl"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">متوسط مدة الكشف (بالدقائق)</Label>
                    <Input
                      type="number"
                      value={slotDuration}
                      onChange={(e) => setSlotDuration(parseInt(e.target.value) || 15)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs font-bold text-muted-foreground">الحد الأقصى للحجوزات اليومية (0 = غير محدود)</Label>
                    <Input
                      type="number"
                      value={maxDailyBookings}
                      onChange={(e) => setMaxDailyBookings(parseInt(e.target.value) || 0)}
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Section 3: Independent Weekly Schedule */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-black text-foreground">مواعيد عمل الفرع الأسبوعية</h4>
                  <span className="text-[11px] text-muted-foreground">حدد الأيام وساعات البداية والنهاية</span>
                </div>

                <div className="space-y-2 bg-muted/40 p-3 rounded-2xl border border-border">
                  {weeklySchedule.map((d, index) => (
                    <div
                      key={d.id}
                      className={`flex flex-col sm:flex-row items-start sm:items-center justify-between p-2.5 rounded-xl border gap-2 transition-all ${
                        d.isOpen ? 'bg-card border-border shadow-2xs' : 'bg-muted/30 border-border opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 w-32">
                        <Switch
                          checked={d.isOpen}
                          onCheckedChange={() => handleToggleScheduleDay(index)}
                        />
                        <span className="text-xs font-bold text-foreground">{d.day}</span>
                      </div>

                      {d.isOpen ? (
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground text-[11px]">من:</span>
                          <Input
                            type="time"
                            value={d.start}
                            onChange={(e) => handleScheduleTimeChange(index, 'start', e.target.value)}
                            className="h-8 w-28 text-xs rounded-lg bg-background text-center"
                          />
                          <span className="text-muted-foreground text-[11px]">إلى:</span>
                          <Input
                            type="time"
                            value={d.end}
                            onChange={(e) => handleScheduleTimeChange(index, 'end', e.target.value)}
                            className="h-8 w-28 text-xs rounded-lg bg-background text-center"
                          />
                        </div>
                      ) : (
                        <span className="text-[11px] font-bold text-muted-foreground">مغلق / إجازة</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit Buttons */}
              <div className="pt-4 border-t border-border flex items-center justify-end gap-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl text-xs font-bold"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSaving}
                  className="yalla-gradient-btn text-white font-bold rounded-xl text-xs px-6 shadow-xs"
                >
                  {isSaving ? 'جاري الحفظ...' : editingBranchId ? 'حفظ التعديلات' : 'إضافة الفرع'}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
