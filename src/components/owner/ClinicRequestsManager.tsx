'use client'

import React, { useState, useEffect, useMemo } from 'react'
import {
  Inbox,
  Search,
  Filter,
  CheckCircle2,
  Clock,
  XCircle,
  Building,
  User,
  Phone,
  Mail,
  MapPin,
  Calendar,
  Eye,
  PlusCircle,
  MessageSquare,
  FileText,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Check,
  RefreshCw,
  Sparkles
} from 'lucide-react'
import { collection, onSnapshot, query, orderBy, doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog'
import { toast } from 'sonner'
import { useLanguage } from '@/context/LanguageContext'

export interface ClinicRegistrationRequest {
  id: string
  requestNumber?: string
  doctorName: string
  clinicName: string
  specialty?: string
  phone: string
  email: string
  governorate?: string
  city?: string
  address?: string
  expectedPatientsPerDay?: string
  notes?: string
  status: 'new' | 'reviewing' | 'approved' | 'rejected' | 'clinic_created'
  internalNotes?: string
  rejectionReason?: string
  createdClinicId?: string | null
  createdClinicSlug?: string | null
  createdAt?: string
  updatedAt?: string
}

interface ClinicRequestsManagerProps {
  onCreateClinicFromRequest: (request: ClinicRegistrationRequest) => void
}

export function ClinicRequestsManager({
  onCreateClinicFromRequest,
}: ClinicRequestsManagerProps) {
  const { isRtl } = useLanguage()
  const [requests, setRequests] = useState<ClinicRegistrationRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'new' | 'reviewing' | 'approved' | 'rejected' | 'clinic_created'>('all')
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'week' | 'month'>('all')

  // Selected request for details modal
  const [selectedRequest, setSelectedRequest] = useState<ClinicRegistrationRequest | null>(null)
  const [isDetailsOpen, setIsDetailsOpen] = useState(false)
  const [internalNotesInput, setInternalNotesInput] = useState('')
  const [rejectionReasonInput, setRejectionReasonInput] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const pageSize = 10

  const fetchFallback = async () => {
    try {
      setLoading(true)
      setErrorMessage(null)
      const res = await fetch('/api/owner/landing/trials', {
        credentials: 'same-origin',
        cache: 'no-store',
      })
      if (!res.ok) {
        throw new Error(`تعذر الاتصال بالخادم (${res.status})`)
      }
      const data = await res.json()
      if (data.requests && Array.isArray(data.requests)) {
        const list: ClinicRegistrationRequest[] = data.requests.map((r: any) => ({
          id: r.id,
          requestNumber: r.requestNumber || `REQ-${(r.id || '').slice(0, 6)}`,
          doctorName: r.doctorName || 'غير محدد',
          clinicName: r.clinicName || 'غير محدد',
          specialty: r.specialty || '',
          phone: r.phone || '',
          email: r.email || '',
          governorate: r.governorate || '',
          city: r.city || '',
          address: r.address || '',
          expectedPatientsPerDay: r.expectedPatientsPerDay || '',
          notes: r.notes || '',
          status: r.status || 'new',
          internalNotes: r.internalNotes || '',
          rejectionReason: r.rejectionReason || '',
          createdClinicId: r.createdClinicId || null,
          createdClinicSlug: r.createdClinicSlug || null,
          createdAt: r.createdAt || new Date().toISOString(),
          updatedAt: r.updatedAt || new Date().toISOString(),
        }))
        setRequests(list)
      }
    } catch (e: any) {
      setErrorMessage(e.message || 'تعذر جلب طلبات تسجيل العيادات')
    } finally {
      setLoading(false)
    }
  }

  // Real-time listener on trial_requests with fallback
  useEffect(() => {
    setLoading(true)
    setErrorMessage(null)
    const q = query(collection(db, 'trial_requests'), orderBy('createdAt', 'desc'))
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const list: ClinicRegistrationRequest[] = snapshot.docs.map((d) => {
          const data = d.data()
          return {
            id: d.id,
            requestNumber: data.requestNumber || `REQ-${d.id.slice(0, 6)}`,
            doctorName: data.doctorName || 'غير محدد',
            clinicName: data.clinicName || 'غير محدد',
            specialty: data.specialty || '',
            phone: data.phone || '',
            email: data.email || '',
            governorate: data.governorate || '',
            city: data.city || '',
            address: data.address || '',
            expectedPatientsPerDay: data.expectedPatientsPerDay || '',
            notes: data.notes || '',
            status: data.status || 'new',
            internalNotes: data.internalNotes || '',
            rejectionReason: data.rejectionReason || '',
            createdClinicId: data.createdClinicId || null,
            createdClinicSlug: data.createdClinicSlug || null,
            createdAt: data.createdAt || new Date().toISOString(),
            updatedAt: data.updatedAt || new Date().toISOString(),
          }
        })
        setRequests(list)
        setLoading(false)
      },
      (err) => {
        console.warn('Direct Firestore trial_requests listener failed, falling back to server API:', err)
        fetchFallback()
      }
    )

    return () => unsubscribe()
  }, [])

  // Filtered requests
  const filteredRequests = useMemo(() => {
    return requests.filter((req) => {
      // Status filter
      if (statusFilter !== 'all' && req.status !== statusFilter) {
        return false
      }

      // Date filter
      if (dateFilter !== 'all' && req.createdAt) {
        const createdDate = new Date(req.createdAt)
        const now = new Date()
        const diffMs = now.getTime() - createdDate.getTime()
        const diffDays = diffMs / (1000 * 60 * 60 * 24)

        if (dateFilter === 'today' && diffDays > 1) return false
        if (dateFilter === 'week' && diffDays > 7) return false
        if (dateFilter === 'month' && diffDays > 30) return false
      }

      // Search query (name, clinic, phone, email, request number)
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase()
        const matchName = req.doctorName.toLowerCase().includes(q)
        const matchClinic = req.clinicName.toLowerCase().includes(q)
        const matchPhone = req.phone.includes(q)
        const matchEmail = req.email.toLowerCase().includes(q)
        const matchReqNum = (req.requestNumber || '').toLowerCase().includes(q)
        const matchSpecialty = (req.specialty || '').toLowerCase().includes(q)
        if (!matchName && !matchClinic && !matchPhone && !matchEmail && !matchReqNum && !matchSpecialty) {
          return false
        }
      }

      return true
    })
  }, [requests, statusFilter, dateFilter, searchQuery])

  // Paginated requests
  const paginatedRequests = useMemo(() => {
    const startIndex = (currentPage - 1) * pageSize
    return filteredRequests.slice(startIndex, startIndex + pageSize)
  }, [filteredRequests, currentPage, pageSize])

  const totalPages = Math.max(1, Math.ceil(filteredRequests.length / pageSize))

  // Open details modal
  const handleOpenDetails = (req: ClinicRegistrationRequest) => {
    setSelectedRequest(req)
    setInternalNotesInput(req.internalNotes || '')
    setRejectionReasonInput(req.rejectionReason || '')
    setIsDetailsOpen(true)
  }

  // Update status directly
  const handleUpdateStatus = async (
    reqId: string,
    newStatus: ClinicRegistrationRequest['status'],
    rejectionReason?: string
  ) => {
    try {
      // 1. Try server PATCH API
      await fetch('/api/owner/landing/trials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: reqId,
          status: newStatus,
          ...(rejectionReason !== undefined ? { rejectionReason } : {}),
        }),
      }).catch(() => {})

      // 2. Update Firestore client doc
      await updateDoc(doc(db, 'trial_requests', reqId), {
        status: newStatus,
        ...(rejectionReason !== undefined ? { rejectionReason } : {}),
        updatedAt: new Date().toISOString(),
      }).catch(() => {})

      // 3. Update local state
      setRequests((prev) =>
        prev.map((r) =>
          r.id === reqId
            ? { ...r, status: newStatus, rejectionReason: rejectionReason ?? r.rejectionReason }
            : r
        )
      )

      if (selectedRequest && selectedRequest.id === reqId) {
        setSelectedRequest((prev) =>
          prev ? { ...prev, status: newStatus, rejectionReason: rejectionReason ?? prev.rejectionReason } : null
        )
      }

      toast.success('تم تحديث حالة الطلب بنجاح!')
    } catch (err: any) {
      console.error('Update status error:', err)
      toast.error('تعذر تحديث حالة الطلب: ' + (err?.message || 'خطأ غير معروف'))
    }
  }

  // Save internal notes
  const handleSaveInternalNotes = async () => {
    if (!selectedRequest) return
    setIsSavingNotes(true)
    try {
      // 1. Try server PATCH API
      await fetch('/api/owner/landing/trials', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: selectedRequest.id,
          internalNotes: internalNotesInput.trim(),
          rejectionReason: rejectionReasonInput.trim(),
        }),
      }).catch(() => {})

      // 2. Update Firestore client doc
      await updateDoc(doc(db, 'trial_requests', selectedRequest.id), {
        internalNotes: internalNotesInput.trim(),
        rejectionReason: rejectionReasonInput.trim(),
        updatedAt: new Date().toISOString(),
      }).catch(() => {})

      setSelectedRequest((prev) =>
        prev
          ? {
              ...prev,
              internalNotes: internalNotesInput.trim(),
              rejectionReason: rejectionReasonInput.trim(),
            }
          : null
      )

      setRequests((prev) =>
        prev.map((r) =>
          r.id === selectedRequest.id
            ? {
                ...r,
                internalNotes: internalNotesInput.trim(),
                rejectionReason: rejectionReasonInput.trim(),
              }
            : r
        )
      )

      toast.success('تم حفظ ملاحظات المالك بنجاح!')
    } catch (err: any) {
      console.error('Save notes error:', err)
      toast.error('تعذر حفظ الملاحظات: ' + (err?.message || 'خطأ غير معروف'))
    } finally {
      setIsSavingNotes(false)
    }
  }

  const getStatusBadge = (status: ClinicRegistrationRequest['status']) => {
    switch (status) {
      case 'new':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-800 text-[11px] font-black">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>طلب جديد</span>
          </span>
        )
      case 'reviewing':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-50 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-[11px] font-black">
            <Clock className="w-3 h-3 text-amber-500" />
            <span>قيد المراجعة</span>
          </span>
        )
      case 'approved':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-50 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800 text-[11px] font-black">
            <CheckCircle2 className="w-3 h-3 text-emerald-500" />
            <span>تم القبول</span>
          </span>
        )
      case 'clinic_created':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-purple-50 dark:bg-purple-950/60 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-[11px] font-black">
            <Building className="w-3 h-3 text-purple-500" />
            <span>تم إنشاء العيادة</span>
          </span>
        )
      case 'rejected':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-rose-50 dark:bg-rose-950/60 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800 text-[11px] font-black">
            <XCircle className="w-3 h-3 text-rose-500" />
            <span>مرفوض</span>
          </span>
        )
      default:
        return null
    }
  }

  // Count by status
  const counts = useMemo(() => {
    return {
      all: requests.length,
      new: requests.filter((r) => r.status === 'new').length,
      reviewing: requests.filter((r) => r.status === 'reviewing').length,
      approved: requests.filter((r) => r.status === 'approved').length,
      rejected: requests.filter((r) => r.status === 'rejected').length,
      clinic_created: requests.filter((r) => r.status === 'clinic_created').length,
    }
  }, [requests])

  return (
    <div className="space-y-6">
      {/* Top Header & Overview */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 rounded-3xl bg-white dark:bg-[#081526] border border-sky-100 dark:border-slate-800 shadow-sm">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 rounded-2xl bg-sky-50 dark:bg-sky-950/60 text-sky-600 dark:text-sky-400 flex items-center justify-center font-bold">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-black text-slate-900 dark:text-white">
                طلبات تسجيل العيادات الجديدة
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                متابعة وإدارة طلبات الأطباء المسجلة عبر الصفحة الرئيسية وتحويلها لعيادات نشطة
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant="outline" className="text-xs font-bold px-3 py-1 bg-sky-50/50 dark:bg-slate-800">
            إجمالي الطلبات: <strong className="mx-1 text-sky-600">{requests.length}</strong>
          </Badge>
          {counts.new > 0 && (
            <Badge className="text-xs font-black px-3 py-1 bg-rose-500 text-white animate-pulse">
              {counts.new} طلب جديد بحاجة للمراجعة
            </Badge>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-2xl bg-white dark:bg-[#081526] border border-slate-200 dark:border-slate-800 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Search Input */}
          <div className="md:col-span-2 relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                setCurrentPage(1)
              }}
              placeholder="بحث باسم الدكتور، العيادة، الهاتف، الإيميل، أو رقم الطلب..."
              className="w-full pl-4 pr-10 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white focus:outline-none focus:border-sky-500"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 hover:text-slate-600 font-bold"
              >
                مسح
              </button>
            )}
          </div>

          {/* Date Range Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e: any) => {
                setDateFilter(e.target.value)
                setCurrentPage(1)
              }}
              className="w-full px-3 py-2.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white font-bold focus:outline-none"
            >
              <option value="all">جميع التواريخ</option>
              <option value="today">طلبات اليوم</option>
              <option value="week">آخر 7 أيام</option>
              <option value="month">آخر 30 يوماً</option>
            </select>
          </div>
        </div>

        {/* Status Filter Tabs */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-slate-100 dark:border-slate-800/80">
          {[
            { id: 'all', label: 'الكل', count: counts.all },
            { id: 'new', label: 'جديد', count: counts.new, alert: counts.new > 0 },
            { id: 'reviewing', label: 'قيد المراجعة', count: counts.reviewing },
            { id: 'approved', label: 'تم القبول', count: counts.approved },
            { id: 'clinic_created', label: 'تم إنشاء عيادة', count: counts.clinic_created },
            { id: 'rejected', label: 'مرفوض', count: counts.rejected },
          ].map((tab) => {
            const isActive = statusFilter === tab.id
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  setStatusFilter(tab.id as any)
                  setCurrentPage(1)
                }}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'bg-slate-100 dark:bg-slate-800/60 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'
                }`}
              >
                <span>{tab.label}</span>
                <span
                  className={`text-[10px] font-black px-1.5 py-0.2 rounded-full ${
                    isActive
                      ? 'bg-white/25 text-white'
                      : tab.alert
                      ? 'bg-rose-500 text-white'
                      : 'bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300'
                  }`}
                >
                  {tab.count}
                </span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Requests Table */}
      <div className="rounded-3xl bg-white dark:bg-[#081526] border border-slate-200 dark:border-slate-800 shadow-sm overflow-hidden">
        {loading && requests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto text-sky-600" />
            <p className="text-xs text-slate-500 font-bold">جاري تحميل طلبات العيادات...</p>
          </div>
        ) : errorMessage && requests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <AlertCircle className="w-10 h-10 text-rose-500 mx-auto" />
            <p className="text-sm font-bold text-rose-600 dark:text-rose-400">
              تعذر تحميل طلبات تسجيل العيادات
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              {errorMessage}
            </p>
            <Button
              size="sm"
              onClick={() => fetchFallback()}
              className="mt-2 text-xs font-bold bg-sky-600 hover:bg-sky-700 text-white"
            >
              <RefreshCw className="w-3.5 h-3.5 ml-1.5" />
              إعادة المحاولة
            </Button>
          </div>
        ) : paginatedRequests.length === 0 ? (
          <div className="p-12 text-center space-y-3">
            <Inbox className="w-10 h-10 text-slate-300 dark:text-slate-700 mx-auto" />
            <p className="text-sm font-bold text-slate-700 dark:text-slate-300">
              لا توجد طلبات مطابقة للمعايير المحددة
            </p>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              عندما يسجل أي طبيب عبر نموذج الموقع، ستظهر بيانات الطلب هنا لحظياً مع إشعار للمالك.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-slate-100 dark:border-slate-800 bg-slate-50/70 dark:bg-slate-900/40 text-slate-500 dark:text-slate-400 font-bold">
                  <th className="py-3 px-4">رقم الطلب</th>
                  <th className="py-3 px-4">الطبيب والعيادة</th>
                  <th className="py-3 px-4">التخصص والموقع</th>
                  <th className="py-3 px-4">بيانات التواصل</th>
                  <th className="py-3 px-4 text-center">الحالة</th>
                  <th className="py-3 px-4">التاريخ</th>
                  <th className="py-3 px-4 text-center">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800/80">
                {paginatedRequests.map((req) => {
                  const cleanPhone = req.phone.replace(/\D/g, '')
                  const waHref = cleanPhone ? `https://wa.me/${cleanPhone.startsWith('2') ? cleanPhone : '2' + cleanPhone}` : '#'

                  return (
                    <tr
                      key={req.id}
                      className="hover:bg-sky-50/40 dark:hover:bg-slate-800/30 transition-colors"
                    >
                      {/* Request Number */}
                      <td className="py-3.5 px-4 font-mono font-bold text-sky-600 dark:text-sky-400">
                        {req.requestNumber}
                      </td>

                      {/* Doctor and Clinic */}
                      <td className="py-3.5 px-4">
                        <div className="font-black text-slate-900 dark:text-white text-xs">
                          {req.doctorName}
                        </div>
                        <div className="text-[11px] text-slate-500 font-medium flex items-center gap-1 mt-0.5">
                          <Building className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>{req.clinicName}</span>
                        </div>
                      </td>

                      {/* Specialty and Location */}
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800 dark:text-slate-200">
                          {req.specialty || 'تخصص عام'}
                        </div>
                        <div className="text-[11px] text-slate-400 flex items-center gap-1 mt-0.5">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span>
                            {req.governorate ? `${req.governorate} ${req.city ? '- ' + req.city : ''}` : 'مصر'}
                          </span>
                        </div>
                      </td>

                      {/* Contact Info */}
                      <td className="py-3.5 px-4 space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-800 dark:text-slate-200" dir="ltr">
                            {req.phone}
                          </span>
                          <a
                            href={waHref}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 hover:bg-emerald-100 transition-colors inline-flex items-center gap-0.5"
                            title="مراسلة عبر واتساب"
                          >
                            <span>واتساب</span>
                          </a>
                        </div>
                        <div className="text-[11px] text-slate-400 font-mono" dir="ltr">
                          {req.email}
                        </div>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        {getStatusBadge(req.status)}
                      </td>

                      {/* Created At */}
                      <td className="py-3.5 px-4 text-slate-500 text-[11px]">
                        {req.createdAt ? new Date(req.createdAt).toLocaleDateString('ar-EG', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        }) : '—'}
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleOpenDetails(req)}
                            className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 dark:bg-slate-800 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 font-bold transition-colors cursor-pointer"
                            title="عرض تفاصيل الطلب والملاحظات"
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </button>

                          {req.status !== 'clinic_created' ? (
                            <button
                              type="button"
                              onClick={() => onCreateClinicFromRequest(req)}
                              className="px-2.5 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-[11px] transition-all cursor-pointer shadow-xs flex items-center gap-1"
                              title="تحويل لعيادة وتعبئة النموذج آلياً"
                            >
                              <PlusCircle className="w-3.5 h-3.5" />
                              <span>إنشاء عيادة</span>
                            </button>
                          ) : (
                            <span className="text-[11px] font-bold text-purple-600 dark:text-purple-400">
                              تم الإنشاء
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination footer */}
        {totalPages > 1 && (
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between text-xs text-slate-500">
            <div>
              صفحة {currentPage} من {totalPages} (إجمالي {filteredRequests.length} طلب)
            </div>
            <div className="flex items-center gap-1">
              <button
                type="button"
                disabled={currentPage <= 1}
                onClick={() => setCurrentPage((p) => p - 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                disabled={currentPage >= totalPages}
                onClick={() => setCurrentPage((p) => p + 1)}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 disabled:opacity-30 cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Details & Action Modal */}
      <Dialog open={isDetailsOpen} onOpenChange={setIsDetailsOpen}>
        <DialogContent className="max-w-2xl bg-white dark:bg-[#081526] text-right" dir="rtl">
          {selectedRequest && (
            <div className="space-y-5">
              <DialogHeader className="text-right">
                <div className="flex items-center justify-between gap-2">
                  <DialogTitle className="text-base sm:text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                    <span>تفاصيل طلب العيادة:</span>
                    <span className="text-sky-600 font-mono">{selectedRequest.requestNumber}</span>
                  </DialogTitle>
                  <div>{getStatusBadge(selectedRequest.status)}</div>
                </div>
                <DialogDescription className="text-xs text-slate-500">
                  تاريخ التسجيل:{' '}
                  {selectedRequest.createdAt ? new Date(selectedRequest.createdAt).toLocaleString('ar-EG') : '—'}
                </DialogDescription>
              </DialogHeader>

              {/* Data Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-100 dark:border-slate-800 text-xs">
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">اسم الطبيب</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm">{selectedRequest.doctorName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">اسم العيادة</span>
                  <span className="font-black text-slate-900 dark:text-white text-sm">{selectedRequest.clinicName}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">التخصص الطبي</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRequest.specialty || 'تخصص عام'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">عدد الكشوفات المتوقعة يومياً</span>
                  <span className="font-bold text-slate-800 dark:text-slate-200">{selectedRequest.expectedPatientsPerDay || 'غير محدد'}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">رقم الهاتف</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">{selectedRequest.phone}</span>
                </div>
                <div>
                  <span className="text-slate-400 block text-[11px] font-bold">البريد الإلكتروني</span>
                  <span className="font-mono font-bold text-slate-900 dark:text-white" dir="ltr">{selectedRequest.email}</span>
                </div>
                <div className="sm:col-span-2">
                  <span className="text-slate-400 block text-[11px] font-bold">العنوان والمحافظة</span>
                  <span className="font-medium text-slate-800 dark:text-slate-200">
                    {[selectedRequest.governorate, selectedRequest.city, selectedRequest.address].filter(Boolean).join(' - ') || 'لم يُحدد'}
                  </span>
                </div>
                {selectedRequest.notes && (
                  <div className="sm:col-span-2 pt-2 border-t border-slate-200 dark:border-slate-800">
                    <span className="text-slate-400 block text-[11px] font-bold">ملاحظات الطبيب عند الطلب</span>
                    <p className="text-slate-700 dark:text-slate-300 font-medium leading-relaxed mt-0.5">
                      {selectedRequest.notes}
                    </p>
                  </div>
                )}
              </div>

              {/* Status Update Quick Bar */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  تغيير حالة الطلب:
                </label>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedRequest.id, 'reviewing')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedRequest.status === 'reviewing'
                        ? 'bg-amber-600 text-white shadow-xs'
                        : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 hover:bg-amber-100'
                    }`}
                  >
                    قيد المراجعة والتواصل
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedRequest.id, 'approved')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedRequest.status === 'approved'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    قبول الطلب
                  </button>
                  <button
                    type="button"
                    onClick={() => handleUpdateStatus(selectedRequest.id, 'rejected')}
                    className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                      selectedRequest.status === 'rejected'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 hover:bg-rose-100'
                    }`}
                  >
                    رفض الطلب
                  </button>
                </div>
              </div>

              {/* Rejection Reason (if rejected) */}
              {selectedRequest.status === 'rejected' && (
                <div className="space-y-1.5">
                  <label className="block text-xs font-bold text-rose-600 dark:text-rose-400">
                    سبب الرفض (داخلي أو للمتابعة):
                  </label>
                  <input
                    type="text"
                    value={rejectionReasonInput}
                    onChange={(e) => setRejectionReasonInput(e.target.value)}
                    placeholder="بيانات غير مكتملة / رقم غير صحيح..."
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 dark:bg-slate-900 border border-rose-200 dark:border-rose-900 text-xs text-slate-900 dark:text-white"
                  />
                </div>
              )}

              {/* Internal Owner Notes */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-slate-700 dark:text-slate-300">
                  ملاحظات المالك الداخلية (لا تظهر للطبيب):
                </label>
                <textarea
                  rows={3}
                  value={internalNotesInput}
                  onChange={(e) => setInternalNotesInput(e.target.value)}
                  placeholder="تم التواصل مع الطبيب وتم الاتفاق على باقة العيادة الفردية..."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs text-slate-900 dark:text-white resize-none"
                />
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleSaveInternalNotes}
                    disabled={isSavingNotes}
                    className="text-xs h-8"
                  >
                    {isSavingNotes ? 'جاري الحفظ...' : 'حفظ الملاحظات'}
                  </Button>
                </div>
              </div>

              {/* Bottom Action: Create Clinic from Request */}
              <div className="pt-3 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setIsDetailsOpen(false)}
                  className="text-xs"
                >
                  إغلاق
                </Button>

                {selectedRequest.status !== 'clinic_created' ? (
                  <Button
                    size="sm"
                    onClick={() => {
                      setIsDetailsOpen(false)
                      onCreateClinicFromRequest(selectedRequest)
                    }}
                    className="bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5"
                  >
                    <PlusCircle className="w-4 h-4" />
                    <span>إنشاء عيادة من بيانات هذا الطلب</span>
                  </Button>
                ) : (
                  <div className="text-xs font-bold text-purple-600 dark:text-purple-400">
                    تم إنشاء العيادة لهذا الطلب مسبقاً ({selectedRequest.createdClinicSlug || selectedRequest.createdClinicId})
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
