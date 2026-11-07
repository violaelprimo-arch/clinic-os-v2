'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Building2, Plus, Edit3, Trash2, MapPin, Phone, MessageCircle,
  Clock, Calendar, CheckCircle2, XCircle, AlertCircle, Save, X,
  ExternalLink, Power, Archive, ShieldCheck, Image as ImageIcon,
  Sparkles, RefreshCw, Check, Compass, Layers, Lock, Unlock, Eye, EyeOff
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  updateDoc,
  doc,
  onSnapshot
} from 'firebase/firestore'
import { Branch, BranchScheduleDay } from '@/types/clinic'
import { DEFAULT_WEEKLY_SCHEDULE, formatWeeklyScheduleSummary, checkScheduleConflicts } from '@/lib/branchService'
import { sanitizeAddress, isPlaceholderAddress, extractCoordsFromLink } from '@/lib/mapsHelper'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription
} from '@/components/ui/dialog'

export function OwnerBranchManager({
  clinics,
  initialClinicId,
  onClose
}: {
  clinics: any[]
  initialClinicId?: string
  onClose?: () => void
}) {
  const [selectedClinicId, setSelectedClinicId] = useState<string>(
    initialClinicId || clinics[0]?.id || ''
  )

  const selectedClinic = useMemo(() => {
    return clinics.find((c) => c.id === selectedClinicId || c.slug === selectedClinicId) || clinics[0] || null
  }, [clinics, selectedClinicId])

  const [branches, setBranches] = useState<Branch[]>([])
  const [isLoading, setIsLoading] = useState<boolean>(true)
  const [showArchived, setShowArchived] = useState<boolean>(false)

  // Clinic Quota & Permission Controls state
  const [branchesEnabled, setBranchesEnabled] = useState<boolean>(true)
  const [maxBranches, setMaxBranches] = useState<number>(3)
  const [allowDoctorCreateBranches, setAllowDoctorCreateBranches] = useState<boolean>(true)
  const [isUpdatingPermissions, setIsUpdatingPermissions] = useState<boolean>(false)

  // Modal State for Add / Edit
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false)
  const [editingBranch, setEditingBranch] = useState<Branch | null>(null)

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
  const [isOpen, setIsOpen] = useState<boolean>(true)
  const [isMain, setIsMain] = useState<boolean>(false)
  const [weeklySchedule, setWeeklySchedule] = useState<BranchScheduleDay[]>(DEFAULT_WEEKLY_SCHEDULE)

  // Interactive Coordinates Verification
  const [isResolvingCoords, setIsResolvingCoords] = useState(false)
  const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null)
  const [conflicts, setConflicts] = useState<string[]>([])
  const [isSavingBranch, setIsSavingBranch] = useState(false)

  // Synchronize permissions when clinic changes
  useEffect(() => {
    if (!selectedClinic) return
    setBranchesEnabled(selectedClinic.branchesEnabled !== false)
    setMaxBranches(
      typeof selectedClinic.maxBranches === 'number'
        ? selectedClinic.maxBranches
        : typeof selectedClinic.branchQuota === 'number'
        ? selectedClinic.branchQuota
        : 3
    )
    setAllowDoctorCreateBranches(
      selectedClinic.allowDoctorCreateBranches !== undefined
        ? Boolean(selectedClinic.allowDoctorCreateBranches)
        : selectedClinic.branchCreationAllowed !== false
    )
  }, [selectedClinic])

  // Real-time snapshot listener for the selected clinic's branches
  useEffect(() => {
    if (!selectedClinic?.id) return
    setIsLoading(true)

    const cId = selectedClinic.id
    const cSlug = selectedClinic.slug

    const q1 = query(collection(db, 'branches'), where('clinicId', '==', cId))
    const q2 = query(collection(db, 'branches'), where('clinic_id', '==', cId))

    const map = new Map<string, Branch>()

    const unsub1 = onSnapshot(q1, (snap) => {
      snap.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...(d.data() as any) })
      })
      setBranches(Array.from(map.values()))
      setIsLoading(false)
    }, (err) => {
      console.warn('Error in branches q1:', err)
      setIsLoading(false)
    })

    const unsub2 = onSnapshot(q2, (snap) => {
      snap.docs.forEach((d) => {
        map.set(d.id, { id: d.id, ...(d.data() as any) })
      })
      setBranches(Array.from(map.values()))
      setIsLoading(false)
    }, (err) => {
      console.warn('Error in branches q2:', err)
      setIsLoading(false)
    })

    return () => {
      unsub1()
      unsub2()
    }
  }, [selectedClinic?.id, selectedClinic?.slug])

  // Conflict detection
  useEffect(() => {
    if (!isModalOpen) return
    const candidate: Partial<Branch> = {
      id: editingBranch?.id || 'new',
      name: name || 'الفرع الجديد',
      weeklySchedule,
      isOpen
    }
    const detected = checkScheduleConflicts(branches, candidate)
    setConflicts(detected)
  }, [weeklySchedule, isOpen, name, editingBranch, branches, isModalOpen])

  const activeBranches = useMemo(() => {
    return branches.filter((b) => !b.isArchived)
  }, [branches])

  const displayedBranches = useMemo(() => {
    return showArchived ? branches : activeBranches
  }, [branches, activeBranches, showArchived])

  // Save clinic quota & doctor permission settings
  const handleSaveClinicPermissions = async () => {
    if (!selectedClinic?.id) return
    setIsUpdatingPermissions(true)
    try {
      await updateDoc(doc(db, 'clinics', selectedClinic.id), {
        branchesEnabled,
        maxBranches: Number(maxBranches) || 1,
        branchQuota: Number(maxBranches) || 1,
        allowDoctorCreateBranches,
        branchCreationAllowed: allowDoctorCreateBranches,
        updatedAt: new Date().toISOString()
      })
      toast.success('تم تحديث صلاحيات وحدود فروع العيادة بنجاح')
    } catch (e: any) {
      console.error(e)
      toast.error('فشل في حفظ صلاحيات العيادة: ' + (e.message || ''))
    } finally {
      setIsUpdatingPermissions(false)
    }
  }

  // Interactive Google Maps Link Resolver
  const handleResolveMapsLink = async () => {
    if (!mapsLink.trim() && !address.trim()) {
      toast.error('يرجى إدخال رابط خرائط جوجل أو العنوان للتحقق منه')
      return
    }

    setIsResolvingCoords(true)
    setVerifiedAddress(null)
    try {
      const param = mapsLink.trim()
        ? `url=${encodeURIComponent(mapsLink.trim())}`
        : `address=${encodeURIComponent(address.trim())}`
      const res = await fetch(`/api/resolve-maps-coords?${param}`)
      const data = await res.json()

      if (data.success && typeof data.lat === 'number' && typeof data.lng === 'number') {
        setLatitude(String(data.lat))
        setLongitude(String(data.lng))
        setVerifiedAddress(data.displayName || `إحداثيات مؤكدة (${data.lat.toFixed(5)}, ${data.lng.toFixed(5)})`)
        if (data.finalUrl && !mapsLink.includes('@')) {
          setMapsLink(data.finalUrl)
        }
        toast.success('تم استخراج الإحداثيات الدقيقة للفرع بنجاح!')
      } else {
        toast.error(data.message || 'تعذر استخراج إحداثيات دقيقة من الرابط. يمكنك كتابة خطوط الطول والعرض يدوياً.')
      }
    } catch (e: any) {
      toast.error('فشل التحقق من الرابط: ' + (e.message || ''))
    } finally {
      setIsResolvingCoords(false)
    }
  }

  const openAddModal = () => {
    setEditingBranch(null)
    setName('')
    setGovernorate(selectedClinic?.governorate || 'القاهرة')
    setCity(selectedClinic?.city || 'القاهرة')
    setArea('')
    setAddress('')
    setMapsLink('')
    setLatitude('')
    setLongitude('')
    setPhone(selectedClinic?.clinicPhone || '')
    setWhatsapp(selectedClinic?.clinicPhone || '')
    setImage('')
    setSlotDuration(15)
    setMaxDailyBookings(0)
    setIsOpen(true)
    setIsMain(activeBranches.length === 0)
    setWeeklySchedule(DEFAULT_WEEKLY_SCHEDULE)
    setVerifiedAddress(null)
    setIsModalOpen(true)
  }

  const openEditModal = (b: Branch) => {
    setEditingBranch(b)
    setName(b.name || '')
    setGovernorate(b.governorate || 'القاهرة')
    setCity(b.city || 'القاهرة')
    setArea(b.area || '')
    setAddress(b.address || '')
    setMapsLink(b.mapsLink || '')
    setLatitude(b.latitude !== undefined && b.latitude !== null ? String(b.latitude) : '')
    setLongitude(b.longitude !== undefined && b.longitude !== null ? String(b.longitude) : '')
    setPhone(b.phone || '')
    setWhatsapp(b.whatsapp || '')
    setImage(b.image || '')
    setSlotDuration(b.slotDuration || 15)
    setMaxDailyBookings(b.maxDailyBookings || 0)
    setIsOpen(b.isOpen !== false)
    setIsMain(Boolean(b.isMain))
    setWeeklySchedule(b.weeklySchedule?.length ? b.weeklySchedule : DEFAULT_WEEKLY_SCHEDULE)
    setVerifiedAddress(null)
    setIsModalOpen(true)
  }

  const handleToggleScheduleDay = (index: number) => {
    setWeeklySchedule((prev) =>
      prev.map((d, i) => (i === index ? { ...d, isOpen: !d.isOpen } : d))
    )
  }

  // Toggle open/closed status directly from the card
  const handleToggleBranchStatus = async (branch: Branch) => {
    try {
      const nextStatus = !branch.isOpen
      await updateDoc(doc(db, 'branches', branch.id), {
        isOpen: nextStatus,
        updatedAt: new Date().toISOString()
      })
      toast.success(nextStatus ? `تم تفعيل استقبال الحجوزات في «${branch.name}»` : `تم إيقاف استقبال الحجوزات مؤقتاً في «${branch.name}»`)
    } catch (e: any) {
      toast.error('فشل في تعديل حالة الفرع: ' + e.message)
    }
  }

  // Archive branch safely without deleting historical appointments
  const handleArchiveBranch = async (branch: Branch) => {
    const isCurrentlyArchived = branch.isArchived === true
    const confirmMsg = isCurrentlyArchived
      ? `هل تريد استعادة فرع «${branch.name}» إلى قائمة الفروع النشطة؟`
      : `هل تريد أرشفة فرع «${branch.name}»؟ لن يتمكن المرضى من حجزه ولكن ستبقى كافة المواعيد والتقارير المالية السابقة محفوظة تماماً.`

    if (!window.confirm(confirmMsg)) return

    try {
      await updateDoc(doc(db, 'branches', branch.id), {
        isArchived: !isCurrentlyArchived,
        updatedAt: new Date().toISOString()
      })
      toast.success(isCurrentlyArchived ? 'تمت استعادة الفرع بنجاح' : 'تمت أرشفة الفرع بأمان مع الحفاظ على سجل المواعيد')
    } catch (e: any) {
      toast.error('فشل في تغيير أرشفة الفرع: ' + e.message)
    }
  }

  // Save / Submit Branch Modal Form
  const handleSaveBranch = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!name.trim()) {
      toast.error('يرجى كتابة اسم الفرع')
      return
    }

    if (!selectedClinic?.id) {
      toast.error('لم يتم تحديد عيادة صالحة')
      return
    }

    setIsSavingBranch(true)
    try {
      const clinicId = selectedClinic.id
      const schedule = weeklySchedule && weeklySchedule.length > 0 ? weeklySchedule : DEFAULT_WEEKLY_SCHEDULE

      const branchPayload: any = {
        clinicId,
        clinic_id: clinicId,
        name: name.trim(),
        governorate: governorate.trim() || 'القاهرة',
        city: city.trim() || 'القاهرة',
        area: area.trim(),
        address: sanitizeAddress(address) || 'عنوان الفرع',
        mapsLink: mapsLink.trim(),
        latitude: latitude !== '' ? Number(latitude) : null,
        longitude: longitude !== '' ? Number(longitude) : null,
        phone: phone.trim(),
        whatsapp: whatsapp.trim() || phone.trim(),
        image: image.trim(),
        slotDuration: Number(slotDuration) || 15,
        maxDailyBookings: Number(maxDailyBookings) || 0,
        isOpen,
        isMain,
        weeklySchedule: schedule,
        workingHours: formatWeeklyScheduleSummary(schedule, true),
        updatedAt: new Date().toISOString()
      }

      if (editingBranch?.id) {
        // Update existing branch
        await updateDoc(doc(db, 'branches', editingBranch.id), branchPayload)
        toast.success(`تم تحديث بيانات «${name}» بنجاح`)
      } else {
        // Enforce quota if creating new
        if (activeBranches.length >= maxBranches) {
          toast.error(`وصلت هذه العيادة للحد الأقصى المسموح (${maxBranches} فروع). يمكنك زيادة الكوتة أولاً من الأعلى.`)
          setIsSavingBranch(false)
          return
        }
        branchPayload.isArchived = false
        branchPayload.createdAt = new Date().toISOString()
        await addDoc(collection(db, 'branches'), branchPayload)
        toast.success(`تمت إضافة فرع «${name}» بنجاح`)
      }

      setIsModalOpen(false)
    } catch (e: any) {
      console.error(e)
      toast.error('فشل في حفظ بيانات الفرع: ' + (e.message || ''))
    } finally {
      setIsSavingBranch(false)
    }
  }

  return (
    <div className="space-y-6 font-sans text-foreground" dir="rtl">
      {/* Header bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 p-5 rounded-3xl bg-card border border-border shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-black text-foreground">إدارة الفروع المركزية (Platform Owner Branches Manager)</h2>
            <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">تحكم كامل</Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            إدارة فروع العيادات، صلاحيات الأطباء في إضافة فروع، تحديد الموقع الدقيق على Google Maps، والكوتة المشروطة بالاشتراك.
          </p>
        </div>

        {/* Clinic Selector Dropdown */}
        <div className="flex items-center gap-2 w-full sm:w-auto">
          <Label className="text-xs font-bold text-muted-foreground shrink-0">اختر العيادة:</Label>
          <select
            value={selectedClinicId}
            onChange={(e) => setSelectedClinicId(e.target.value)}
            className="h-10 px-3 rounded-xl bg-background border border-border text-xs font-bold text-foreground focus:ring-2 focus:ring-primary focus:outline-none min-w-[200px]"
          >
            {clinics.map((c) => (
              <option key={c.id} value={c.id}>
                {c.clinicName || c.name || 'عيادة بدون اسم'} ({c.doctorName ? `د. ${c.doctorName}` : c.slug})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Clinic Permission & Quota Bar */}
      {selectedClinic && (
        <div className="p-5 rounded-3xl bg-muted/40 border border-border shadow-xs space-y-4">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-3 border-b border-border/80">
            <div className="space-y-0.5">
              <h3 className="text-xs font-black text-foreground flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-emerald-500" />
                صلاحيات وسياسة فروع العيادة: <span className="text-primary font-bold">{selectedClinic.clinicName}</span>
              </h3>
              <p className="text-[11px] text-muted-foreground">
                تحكم في سماح الطبيب بإضافة فروع بنفسه من لوحة تحكمه والحد الأقصى لعدد الفروع المسموح بها في الباقة.
              </p>
            </div>

            <Button
              type="button"
              size="sm"
              onClick={handleSaveClinicPermissions}
              disabled={isUpdatingPermissions}
              className="h-9 px-4 text-xs font-bold rounded-xl bg-primary text-white hover:bg-primary/90 cursor-pointer shadow-xs"
            >
              <Save className="w-3.5 h-3.5 ml-1.5" />
              {isUpdatingPermissions ? 'جاري الحفظ...' : 'حفظ صلاحيات العيادة'}
            </Button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
            {/* Toggle branchesEnabled */}
            <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground cursor-pointer">تفعيل نظام الفروع</Label>
                <p className="text-[10px] text-muted-foreground">السماح بتعدد الفروع للعيادة</p>
              </div>
              <Switch checked={branchesEnabled} onCheckedChange={setBranchesEnabled} />
            </div>

            {/* Quota Input */}
            <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground">حد الفروع (Quota)</Label>
                <p className="text-[10px] text-muted-foreground">الحد الأقصى للفروع النشطة</p>
              </div>
              <Input
                type="number"
                min={1}
                max={25}
                value={maxBranches}
                onChange={(e) => setMaxBranches(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-16 h-8 text-center text-xs font-bold rounded-lg"
              />
            </div>

            {/* Toggle allowDoctorCreateBranches */}
            <div className="p-3.5 rounded-2xl bg-card border border-border flex items-center justify-between">
              <div className="space-y-0.5">
                <Label className="text-xs font-bold text-foreground cursor-pointer">سماح الطبيب بإنشاء فروع</Label>
                <p className="text-[10px] text-muted-foreground">
                  {allowDoctorCreateBranches ? 'مسموح للطبيب ضمن الكوتة' : 'مقيد للمالك فقط (Super Admin)'}
                </p>
              </div>
              <Switch checked={allowDoctorCreateBranches} onCheckedChange={setAllowDoctorCreateBranches} />
            </div>
          </div>
        </div>
      )}

      {/* Branches List Header with Add Button */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2">
          <h3 className="font-black text-sm text-foreground flex items-center gap-1.5">
            <span>الفروع الفعلية المسجلة ({activeBranches.length} من {maxBranches})</span>
          </h3>
          {branches.length > activeBranches.length && (
            <button
              type="button"
              onClick={() => setShowArchived(!showArchived)}
              className="text-[11px] text-muted-foreground hover:text-foreground font-bold flex items-center gap-1 cursor-pointer"
            >
              {showArchived ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
              <span>{showArchived ? 'إخفاء المؤرشفة' : `عرض المؤرشفة (${branches.length - activeBranches.length})`}</span>
            </button>
          )}
        </div>

        <Button
          type="button"
          onClick={openAddModal}
          disabled={!branchesEnabled || activeBranches.length >= maxBranches}
          className="h-10 px-4 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary/90 shadow-md cursor-pointer disabled:opacity-50"
        >
          <Plus className="w-4 h-4 ml-1.5" />
          <span>إضافة فرع جديد للعيادة</span>
        </Button>
      </div>

      {/* Branches Grid */}
      {isLoading ? (
        <div className="p-12 text-center text-xs font-bold text-muted-foreground bg-card rounded-3xl border border-border">
          جاري تحميل بيانات الفروع الفعلية من قاعدة البيانات...
        </div>
      ) : displayedBranches.length === 0 ? (
        <div className="p-10 text-center rounded-3xl bg-muted/30 border border-border space-y-3">
          <Building2 className="w-10 h-10 text-muted-foreground/60 mx-auto" />
          <h4 className="font-bold text-sm text-foreground">لا توجد فروع مسجلة لهذه العيادة حتى الآن</h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            اضغط على «إضافة فرع جديد» لإضافة الفرع الرئيسي أو الفروع الإضافية للعيادة بمواقعها ومواعيد عملها.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {displayedBranches.map((b) => {
            const hasExactLocation = b.latitude !== undefined && b.latitude !== null && b.longitude !== undefined && b.longitude !== null
            return (
              <div
                key={b.id}
                className={`p-5 rounded-3xl border bg-card flex flex-col justify-between space-y-4 shadow-sm transition-all ${
                  b.isArchived
                    ? 'border-dashed border-muted-foreground/40 bg-muted/20 opacity-70'
                    : b.isOpen === false
                    ? 'border-rose-200 dark:border-rose-900/60'
                    : 'border-border hover:shadow-md'
                }`}
              >
                <div className="space-y-3">
                  {/* Top line with badges */}
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-black text-sm text-foreground">{b.name}</h4>
                        {b.isMain && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-primary/10 text-primary font-bold">
                            رئيسي
                          </span>
                        )}
                        {b.isArchived && (
                          <span className="text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600 font-bold">
                            مؤرشف
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground font-medium">
                        {b.governorate || 'القاهرة'} {b.city ? `• ${b.city}` : ''}
                      </p>
                    </div>

                    {/* Status switch */}
                    <button
                      type="button"
                      onClick={() => handleToggleBranchStatus(b)}
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border transition-all cursor-pointer ${
                        b.isOpen !== false
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/20'
                          : 'bg-rose-500/10 text-rose-600 border-rose-500/30 hover:bg-rose-500/20'
                      }`}
                      title="اضغط لتغيير حالة استقبال الحجوزات"
                    >
                      {b.isOpen !== false ? 'متاح للحجز' : 'مغلق مؤقتاً'}
                    </button>
                  </div>

                  {/* Address */}
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border/80 space-y-1.5 text-xs">
                    <div className="flex items-start gap-2 text-foreground">
                      <MapPin className="w-3.5 h-3.5 text-primary shrink-0 mt-0.5" />
                      <span className="font-bold leading-relaxed">{b.address || 'لم يتم تسجيل العنوان بالتفصيل'}</span>
                    </div>

                    {/* Maps & Coordinates status */}
                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-border/60">
                      {hasExactLocation ? (
                        <span className="inline-flex items-center gap-1 text-emerald-600 font-bold">
                          <CheckCircle2 className="w-3 h-3" />
                          GPS مؤكد ({Number(b.latitude).toFixed(3)}, {Number(b.longitude).toFixed(3)})
                        </span>
                      ) : (
                        <span className="text-amber-600 font-medium">إحداثيات GPS غير محددة بدقة</span>
                      )}

                      {b.mapsLink && (
                        <a
                          href={b.mapsLink}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline flex items-center gap-0.5 font-bold"
                        >
                          <span>الخريطة</span>
                          <ExternalLink className="w-3 h-3" />
                        </a>
                      )}
                    </div>
                  </div>

                  {/* Schedule & Working Hours */}
                  <div className="p-3 rounded-2xl bg-muted/40 border border-border/80 space-y-1 text-xs">
                    <div className="flex items-center gap-2 text-muted-foreground font-semibold">
                      <Clock className="w-3.5 h-3.5 text-sky-500 shrink-0" />
                      <span className="text-foreground">{b.workingHours || 'السبت - الخميس: 09:00 ص - 10:00 م'}</span>
                    </div>
                    <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-1 border-t border-border/60">
                      <span>مدة الكشف: {b.slotDuration || 15} دقيقة</span>
                      <span>الحد اليومي: {b.maxDailyBookings ? `${b.maxDailyBookings} حجز` : 'مفتوح'}</span>
                    </div>
                  </div>

                  {/* Contact info */}
                  {(b.phone || b.whatsapp) && (
                    <div className="flex items-center gap-3 text-xs font-mono text-muted-foreground px-1" dir="ltr">
                      {b.phone && (
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-emerald-500" />
                          <span>{b.phone}</span>
                        </span>
                      )}
                      {b.whatsapp && (
                        <span className="flex items-center gap-1">
                          <MessageCircle className="w-3 h-3 text-emerald-500" />
                          <span>{b.whatsapp}</span>
                        </span>
                      )}
                    </div>
                  )}
                </div>

                {/* Actions bottom bar */}
                <div className="pt-3 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => openEditModal(b)}
                    className="h-8 px-3 rounded-xl text-xs font-bold hover:bg-muted cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5 ml-1 text-primary" />
                    تعديل الفرع
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => handleArchiveBranch(b)}
                    className={`h-8 px-2.5 rounded-xl text-xs font-bold cursor-pointer ${
                      b.isArchived
                        ? 'text-emerald-600 hover:bg-emerald-50'
                        : 'text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/40'
                    }`}
                  >
                    <Archive className="w-3.5 h-3.5 ml-1" />
                    {b.isArchived ? 'استعادة' : 'أرشفة الفرع'}
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Add / Edit Branch Dialog */}
      {isModalOpen && (
        <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
          <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto p-6 rounded-3xl" dir="rtl">
            <DialogHeader className="text-right pb-3 border-b border-border">
              <DialogTitle className="text-base font-black text-foreground flex items-center gap-2">
                <Building2 className="w-5 h-5 text-primary" />
                <span>{editingBranch ? `تعديل بيانات «${editingBranch.name}»` : 'إضافة فرع جديد للعيادة'}</span>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                عيادة: {selectedClinic?.clinicName} — تفعيل دقيق للموقع وساعات العمل واستقبال الحجوزات.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveBranch} className="space-y-5 pt-3 text-xs">
              {/* Conflicts Warning */}
              {conflicts.length > 0 && (
                <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300 space-y-1">
                  <div className="flex items-center gap-1.5 font-bold">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span>تنبيه تعارض مواعيد بين فروع نفس الطبيب:</span>
                  </div>
                  {conflicts.map((c, idx) => (
                    <p key={idx} className="text-[11px] pr-5">• {c}</p>
                  ))}
                </div>
              )}

              {/* Basic Fields */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">اسم الفرع *</Label>
                  <Input
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="مثال: فرع مدينة نصر، فرع الشيخ زايد"
                    className="h-10 text-xs rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">المحافظة والمدينة</Label>
                  <div className="grid grid-cols-2 gap-2">
                    <Input
                      value={governorate}
                      onChange={(e) => setGovernorate(e.target.value)}
                      placeholder="المحافظة"
                      className="h-10 text-xs rounded-xl"
                    />
                    <Input
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      placeholder="المدينة / المنطقة"
                      className="h-10 text-xs rounded-xl"
                    />
                  </div>
                </div>
              </div>

              {/* Address */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">العنوان التفصيلي للفرع</Label>
                <Input
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="مثال: شارع التسعين الشمالي - مول الميديكال بارك - الدور الثالث - التجمع الخامس"
                  className="h-10 text-xs rounded-xl"
                />
              </div>

              {/* Google Maps & Verification */}
              <div className="p-4 rounded-2xl bg-muted/40 border border-border space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <MapPin className="w-4 h-4 text-primary" />
                    رابط خرائط جوجل الرسمي (Google Maps URL)
                  </Label>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={handleResolveMapsLink}
                    disabled={isResolvingCoords}
                    className="h-7 px-2.5 text-[11px] font-bold rounded-lg border-primary/30 text-primary hover:bg-primary/10 cursor-pointer"
                  >
                    <Compass className="w-3 h-3 ml-1" />
                    {isResolvingCoords ? 'جاري التحقق...' : 'التحقق واستخراج الإحداثيات'}
                  </Button>
                </div>

                <Input
                  value={mapsLink}
                  onChange={(e) => setMapsLink(e.target.value)}
                  placeholder="https://maps.app.goo.gl/... أو https://www.google.com/maps/..."
                  className="h-10 text-xs rounded-xl font-mono text-left"
                  dir="ltr"
                />

                {verifiedAddress && (
                  <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300 text-[11px] font-bold flex items-center gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    <span>تم التحقق وتثبيت الإحداثيات: {verifiedAddress}</span>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">خط العرض (Latitude)</Label>
                    <Input
                      value={latitude}
                      onChange={(e) => setLatitude(e.target.value)}
                      placeholder="مثال: 30.05214"
                      className="h-9 text-xs rounded-xl font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-muted-foreground">خط الطول (Longitude)</Label>
                    <Input
                      value={longitude}
                      onChange={(e) => setLongitude(e.target.value)}
                      placeholder="مثال: 31.34215"
                      className="h-9 text-xs rounded-xl font-mono text-left"
                      dir="ltr"
                    />
                  </div>
                </div>
              </div>

              {/* Contacts */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">هاتف الفرع (للحجز)</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="01012345678"
                    className="h-10 text-xs rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">واتساب الفرع</Label>
                  <Input
                    value={whatsapp}
                    onChange={(e) => setWhatsapp(e.target.value)}
                    placeholder="01012345678"
                    className="h-10 text-xs rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Image & Slot duration */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">رابط صورة مبنى الفرع (Photo URL)</Label>
                  <Input
                    value={image}
                    onChange={(e) => setImage(e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="h-10 text-xs rounded-xl font-mono text-left"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">مدة الكشف (بالدقائق)</Label>
                  <Input
                    type="number"
                    min={5}
                    max={120}
                    value={slotDuration}
                    onChange={(e) => setSlotDuration(parseInt(e.target.value) || 15)}
                    className="h-10 text-xs rounded-xl font-bold text-center"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground cursor-pointer">استقبال الحجوزات بالفرع</Label>
                    <p className="text-[10px] text-muted-foreground">{isOpen ? 'الفرع متاح حالياً للحجز' : 'الفرع مغلق مؤقتاً'}</p>
                  </div>
                  <Switch checked={isOpen} onCheckedChange={setIsOpen} />
                </div>

                <div className="p-3.5 rounded-2xl bg-muted/40 border border-border flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label className="text-xs font-bold text-foreground cursor-pointer">تعيين كفرع رئيسي</Label>
                    <p className="text-[10px] text-muted-foreground">يظهر كأول خيار افتراضي</p>
                  </div>
                  <Switch checked={isMain} onCheckedChange={setIsMain} />
                </div>
              </div>

              {/* 7-Day Weekly Schedule */}
              <div className="space-y-3 pt-2 border-t border-border">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-sky-500" />
                    مواعيد وساعات العمل الأسبوعية للفرع
                  </Label>
                  <span className="text-[10px] text-muted-foreground">تحديد أيام الفتح والإغلاق لكل شيفت</span>
                </div>

                <div className="space-y-2">
                  {weeklySchedule.map((day, idx) => (
                    <div
                      key={day.id || idx}
                      className={`p-2.5 rounded-xl border flex items-center justify-between gap-3 text-xs ${
                        day.isOpen ? 'bg-card border-border' : 'bg-muted/30 border-dashed border-border/70 opacity-60'
                      }`}
                    >
                      <div className="flex items-center gap-3 w-28">
                        <Switch
                          checked={day.isOpen}
                          onCheckedChange={() => handleToggleScheduleDay(idx)}
                        />
                        <span className="font-bold text-foreground">{day.day}</span>
                      </div>

                      {day.isOpen ? (
                        <div className="flex items-center gap-2" dir="ltr">
                          <Input
                            type="time"
                            value={day.start}
                            onChange={(e) => {
                              const val = e.target.value
                              setWeeklySchedule(prev => prev.map((d, i) => i === idx ? { ...d, start: val } : d))
                            }}
                            className="w-28 h-8 text-xs font-mono rounded-lg"
                          />
                          <span className="text-muted-foreground font-bold">-</span>
                          <Input
                            type="time"
                            value={day.end}
                            onChange={(e) => {
                              const val = e.target.value
                              setWeeklySchedule(prev => prev.map((d, i) => i === idx ? { ...d, end: val } : d))
                            }}
                            className="w-28 h-8 text-xs font-mono rounded-lg"
                          />
                        </div>
                      ) : (
                        <span className="text-muted-foreground font-bold text-[11px]">مغلق طوال اليوم</span>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex justify-end gap-3 pt-4 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl text-xs font-bold h-10 px-5"
                >
                  إلغاء
                </Button>
                <Button
                  type="submit"
                  disabled={isSavingBranch}
                  className="rounded-xl text-xs font-bold h-10 px-6 bg-primary text-white hover:bg-primary/90 shadow-md cursor-pointer"
                >
                  <Save className="w-4 h-4 ml-1.5" />
                  {isSavingBranch ? 'جاري الحفظ...' : editingBranch ? 'حفظ تعديلات الفرع' : 'إنشاء الفرع الآن'}
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  )
}

export default OwnerBranchManager
