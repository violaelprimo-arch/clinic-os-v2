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
import { Branch } from '@/types/clinic'

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
  const [allowDoctorCreateBranches, setAllowDoctorCreateBranches] = useState<boolean>(false)
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
  const [isMain, setIsMain] = useState<boolean>(false)

  // Interactive Coordinates Verification
  const [isResolvingCoords, setIsResolvingCoords] = useState(false)
  const [verifiedAddress, setVerifiedAddress] = useState<string | null>(null)
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
      false
    )
  }, [selectedClinic])

  // Real-time listener plus authoritative API read for accounts that cannot
  // query branches directly under client Firestore security rules.
  useEffect(() => {
    if (!selectedClinic?.id) return
    setIsLoading(true)

    let cancelled = false
    const cId = selectedClinic.id
    const cSlug = selectedClinic.slug
    if (cSlug) {
      fetch(`/api/clinic/${encodeURIComponent(cSlug)}/branches`, { cache: 'no-store', credentials: 'same-origin' })
        .then(async (res) => {
          if (!res.ok) throw new Error('Unable to load registered branches')
          return res.json()
        })
        .then((data) => {
          if (!cancelled && Array.isArray(data.branches)) {
            setBranches(data.branches)
            setIsLoading(false)
          }
        })
        .catch(() => { if (!cancelled) setIsLoading(false) })
    }

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
      cancelled = true
      unsub1()
      unsub2()
    }
  }, [selectedClinic?.id, selectedClinic?.slug])

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
        allowDoctorCreateBranches: false,
        branchCreationAllowed: false,
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
    setIsMain(activeBranches.length === 0)
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
    setIsMain(Boolean(b.isMain))
    setVerifiedAddress(null)
    setIsModalOpen(true)
  }

  // Owner operations must use the authenticated API: direct Firestore writes
  // fail for virtual legacy IDs and may bypass server-side tenant checks.
  const saveBranchViaApi = async (payload: Record<string, any>) => {
    if (!selectedClinic?.slug) throw new Error('لم يتم تحديد رابط العيادة')
    const res = await fetch(`/api/clinic/${encodeURIComponent(selectedClinic.slug)}/branches`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify(payload)
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok || !data.success) throw new Error(data.error || 'لم يتم حفظ بيانات الفرع')
    return data.branch as Branch
  }

  // Archive branch safely without deleting historical appointments
  const handleArchiveBranch = async (branch: Branch) => {
    const isCurrentlyArchived = branch.isArchived === true
    const confirmMsg = isCurrentlyArchived
      ? `هل تريد استعادة فرع «${branch.name}» إلى قائمة الفروع النشطة؟`
      : `هل تريد أرشفة فرع «${branch.name}»؟ لن يتمكن المرضى من حجزه ولكن ستبقى كافة المواعيد والتقارير المالية السابقة محفوظة تماماً.`

    if (!window.confirm(confirmMsg)) return

    try {
      if (isCurrentlyArchived) {
        const restored = await saveBranchViaApi({ id: branch.id, isArchived: false })
        setBranches((prev) => prev.map((b) => b.id === branch.id ? restored : b))
      } else {
        if (!selectedClinic?.slug) throw new Error('لم يتم تحديد عيادة')
        const res = await fetch(
          `/api/clinic/${encodeURIComponent(selectedClinic.slug)}/branches?branchId=${encodeURIComponent(branch.id)}`,
          { method: 'DELETE', credentials: 'same-origin' }
        )
        const data = await res.json().catch(() => ({}))
        if (!res.ok || !data.success) throw new Error(data.error || 'فشل أرشفة الفرع')
        setBranches((prev) => prev.map((b) => b.id === branch.id ? { ...b, isArchived: true } : b))
      }
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
        // The Platform Owner only registers the physical location and contacts.
        // Doctor manages booking state, schedules, daily limits, and visit duration.
        isMain
      }

      if (editingBranch?.id) {
        const updated = await saveBranchViaApi({ ...branchPayload, id: editingBranch.id })
        setBranches((prev) => prev.map((b) => b.id === editingBranch.id ? updated : b))
        toast.success(`تم تحديث بيانات «${name}» بنجاح`)
      } else {
        if (activeBranches.length >= maxBranches) {
          toast.error(`وصلت هذه العيادة للحد الأقصى المسموح (${maxBranches} فروع). يمكنك زيادة الكوتة أولاً من الأعلى.`)
          return
        }
        const created = await saveBranchViaApi(branchPayload)
        setBranches((prev) => [...prev, created])
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
            تسجيل مواقع الفروع وبياناتها وتحديد الحد المسموح به؛ الطبيب مسؤول عن التشغيل والمواعيد.
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
                المالك ينشئ الفروع ويحدد حصتها وبيانات مواقعها؛ الطبيب يتحكم في تشغيل كل فرع.
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

            <div className="p-3.5 rounded-2xl bg-card border border-border text-xs">
              <p className="font-bold">إنشاء الفروع: مالك المنصة فقط</p>
              <p className="mt-1 text-muted-foreground">الطبيب مسئول عن المواعيد ومدة الكشف والحد اليومي وفتح وإيقاف الحجوزات بعد إنشاء الفرع.</p>
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
            أضف اسم الفرع وموقعه وبيانات التواصل فقط؛ الطبيب يحدد المواعيد ويفعّل استقبال الحجوزات من حسابه.
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
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                        b.isOpen !== false
                          ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30'
                          : 'bg-rose-500/10 text-rose-600 border-rose-500/30'
                      }`}
                      title="الطبيب يتحكم في فتح وإغلاق الحجوزات من لوحة عيادته"
                    >
                      {b.isOpen !== false ? 'متاح للحجز' : 'مغلق مؤقتاً'}
                    </span>
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
                عيادة: {selectedClinic?.clinicName} — المالك يسجل بيانات المكان والتواصل، والطبيب يضبط المواعيد وحالة الفرع بعد ذلك.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleSaveBranch} className="space-y-5 pt-3 text-xs">
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

              {/* Owner edits location identity only. Operational branch settings belong to the doctor. */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-foreground">رابط صورة مبنى الفرع (Photo URL)</Label>
                <Input
                  value={image}
                  onChange={(e) => setImage(e.target.value)}
                  placeholder="https://images.unsplash.com/..."
                  className="h-10 text-xs rounded-xl font-mono text-left"
                  dir="ltr"
                />
              </div>
              <div className="p-3 rounded-2xl border border-sky-200 bg-sky-50/60 text-slate-700 text-xs">
                بعد حفظ اسم الفرع وعنوانه وصورته وأرقام التواصل، يدخل الطبيب إلى «إدارة الفروع» لتحديد أيام العمل ومدة الكشف والحد اليومي وفتح أو إيقاف الحجز.
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
