'use client'

import { use, useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search, UserPlus, Phone, Calendar, Clock, MessageCircle,
  FileText, ChevronLeft, ChevronRight, Filter, User, Plus,
  FileSignature, ArrowUpDown, MoreVertical, X, Trash2
} from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'

export default function PatientsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [clinicId, setClinicId] = useState<string | null>(null)
  
  // Add Patient Modal State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newService, setNewService] = useState('كشف عادي')
  const [newPrice, setNewPrice] = useState(250)
  const [isAdding, setIsAdding] = useState(false)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const clinicQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const clinicSnap = await getDocs(clinicQ)
        if (clinicSnap.empty) return
        const cId = clinicSnap.docs[0].id
        setClinicId(cId)

        // Fetch all appointments for this clinic
        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cId))
        const apptSnap = await getDocs(apptQ)
        
        // Group by phone number
        const patientMap = new Map()
        apptSnap.docs.forEach(doc => {
          const data = doc.data()
          if (!data.phone) return
          if (!patientMap.has(data.phone)) {
            patientMap.set(data.phone, {
              id: data.phone,
              name: data.patientName,
              phone: data.phone,
              visitsCount: 1,
              lastVisit: data.date,
              lastService: data.serviceName || 'كشف',
              status: data.visitsCount > 3 ? 'نشط' : (data.serviceName?.includes('مستعجل') ? 'مستعجل' : 'نشط')
            })
          } else {
            const existing = patientMap.get(data.phone)
            existing.visitsCount += 1
            if (new Date(data.date) > new Date(existing.lastVisit)) {
              existing.lastVisit = data.date
              existing.lastService = data.serviceName || 'كشف'
            }
          }
        })

        // If no records in Firebase, populate clean realistic demo patient records
        let loadedPatients = Array.from(patientMap.values())
        if (loadedPatients.length === 0) {
          loadedPatients = [
            { id: '01557540188', name: 'محمد محمود', phone: '01557540188', visitsCount: 2, lastVisit: '2026-10-05', lastService: 'كشف عادي', status: 'نشط' },
            { id: '01111111111', name: 'حسين علي', phone: '01111111111', visitsCount: 1, lastVisit: '2026-10-05', lastService: 'استشارة', status: 'نشط' },
            { id: '0123456789', name: 'أحمد محمد', phone: '0123456789', visitsCount: 2, lastVisit: '2026-10-04', lastService: 'مستعجل', status: 'مستعجل' },
            { id: '0123456798', name: 'علي السيد', phone: '0123456798', visitsCount: 1, lastVisit: '2026-10-03', lastService: 'متابعة', status: 'نشط' },
            { id: '01121320507', name: 'محمود خالد', phone: '01121320507', visitsCount: 1, lastVisit: '2026-10-01', lastService: 'كشف عادي', status: 'نشط' },
            { id: '01098765432', name: 'إسلام رمضان', phone: '01098765432', visitsCount: 3, lastVisit: '2026-09-28', lastService: 'استشارة', status: 'نشط' },
            { id: '01012345678', name: 'سارة إبراهيم', phone: '01012345678', visitsCount: 4, lastVisit: '2026-09-25', lastService: 'كشف عادي', status: 'نشط' },
            { id: '01098234711', name: 'طارق حسام', phone: '01098234711', visitsCount: 1, lastVisit: '2026-09-20', lastService: 'استشارة', status: 'خامل' }
          ]
        }

        setPatients(loadedPatients.sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [slug])

  const filtered = useMemo(() => {
    return patients.filter(p => {
      const matchSearch = p.name.includes(search) || p.phone.includes(search)
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
      return matchSearch && matchStatus
    })
  }, [patients, search, statusFilter])

  // Pagination slice
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1

  const handleAddNewPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newPhone.trim()) {
      return toast.error('يرجى كتابة الاسم ورقم الهاتف')
    }
    setIsAdding(true)
    try {
      if (clinicId) {
        const today = new Date().toISOString().split('T')[0]
        await addDoc(collection(db, 'appointments'), {
          clinic_id: clinicId,
          patientName: newName,
          phone: newPhone,
          serviceName: newService,
          servicePrice: Number(newPrice),
          date: today,
          status: 'waiting',
          createdAt: new Date().toISOString()
        })
      }

      // Add to local state immediately
      const newP = {
        id: newPhone,
        name: newName,
        phone: newPhone,
        visitsCount: 1,
        lastVisit: new Date().toISOString().split('T')[0],
        lastService: newService,
        status: 'نشط'
      }
      setPatients(prev => [newP, ...prev])
      setIsAddOpen(false)
      setNewName('')
      setNewPhone('')
      toast.success('تمت إضافة المريض بنجاح إلى السجل')
    } catch (err) {
      toast.error('حدث خطأ أثناء إضافة المريض')
    } finally {
      setIsAdding(false)
    }
  }

  const handleDeletePatient = async (phone: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المريض ${name} وجميع زياراته؟`)) return
    try {
      if (clinicId) {
        const { deleteDoc, doc } = await import('firebase/firestore')
        const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId), where('phone', '==', phone))
        const snap = await getDocs(q)
        for (const document of snap.docs) {
          await deleteDoc(doc(db, 'appointments', document.id))
        }
      }
      setPatients(prev => prev.filter(p => p.phone !== phone))
      toast.success('تم حذف المريض بنجاح')
    } catch (err) {
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  const sendWhatsApp = (phone: string, name: string) => {
    if (!phone) return
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone
    const message = encodeURIComponent(`مرحباً ${name}،\nنتمنى لك دوام الصحة والعافية من عيادتنا.`)
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Header with Title and Add Patient CTA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#182230]">سجل المرضى</h1>
          <p className="text-xs text-slate-400 mt-1">
            إدارة السجلات الطبية وملفات المرضى والمواعيد السابقة
          </p>
        </div>

        {/* Add Patient Modal */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger className="h-10 px-4 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-xl shadow-md shadow-[#15B8A6]/20 transition-all text-xs inline-flex items-center justify-center cursor-pointer">
            <Plus className="w-4 h-4 ml-1.5" />
            إضافة مريض جديد
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#182230]">إضافة مريض جديد للسجل</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddNewPatient} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">اسم المريض الثلاثي</Label>
                <Input
                  value={newName}
                  onChange={e => setNewName(e.target.value)}
                  placeholder="مثال: محمد أحمد علي"
                  className="h-10 text-sm rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">رقم الهاتف (واتساب)</Label>
                <Input
                  value={newPhone}
                  onChange={e => setNewPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  className="h-10 text-sm font-mono text-right rounded-xl"
                  dir="ltr"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">نوع الخدمة</Label>
                  <select
                    value={newService}
                    onChange={e => setNewService(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E5EAF0] text-xs font-bold text-slate-700 bg-white"
                  >
                    <option value="كشف عادي">كشف عادي</option>
                    <option value="استشارة">استشارة</option>
                    <option value="كشف مستعجل">كشف مستعجل</option>
                    <option value="متابعة">متابعة</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">القيمة (ج.م)</Label>
                  <Input
                    type="number"
                    value={newPrice}
                    onChange={e => setNewPrice(Number(e.target.value))}
                    className="h-10 text-sm rounded-xl"
                  />
                </div>
              </div>

              <div className="pt-3 flex gap-2">
                <Button
                  type="submit"
                  disabled={isAdding}
                  className="flex-1 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold h-10 rounded-xl text-xs"
                >
                  {isAdding ? 'جاري الحفظ...' : 'حفظ المريض'}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setIsAddOpen(false)}
                  className="h-10 text-xs font-bold rounded-xl"
                >
                  إلغاء
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 2. Search & Filters Bar */}
      <div className="medical-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 bg-white">
        <div className="relative w-full sm:w-96">
          <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder="ابحث بالاسم أو رقم الهاتف..."
            className="pr-10 h-10 text-sm bg-[#F6F8FB] border-[#E5EAF0] rounded-xl focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="h-10 px-4 rounded-xl border border-[#E5EAF0] text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20"
          >
            <option value="ALL">كل الحالات</option>
            <option value="نشط">نشط</option>
            <option value="مستعجل">مستعجل</option>
            <option value="خامل">خامل</option>
          </select>
        </div>
      </div>

      {/* 3. Patients Data Table */}
      <div className="medical-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#F8FAFC] border-b border-[#E5EAF0] text-slate-400 text-xs font-bold select-none">
              <tr>
                <th className="py-3.5 px-4">المريض</th>
                <th className="py-3.5 px-4">رقم الهاتف</th>
                <th className="py-3.5 px-4 text-center">عدد الزيارات</th>
                <th className="py-3.5 px-4">آخر زيارة</th>
                <th className="py-3.5 px-4">آخر خدمة</th>
                <th className="py-3.5 px-4 text-center">الحالة</th>
                <th className="py-3.5 px-4 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF0]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    <div className="w-7 h-7 border-2 border-[#15B8A6] border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    جاري تحميل سجل المرضى...
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا يوجد مرضى مطابقين للبحث.
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => {
                  return (
                    <tr key={patient.id} className="hover:bg-slate-50/80 transition-colors group">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <Link href={`/clinic/${slug}/admin/patients/${encodeURIComponent(patient.phone)}`}>
                          <div className="flex items-center gap-3 cursor-pointer">
                            <Avatar className="w-9 h-9 border border-teal-100 bg-teal-50 text-[#15B8A6] shrink-0">
                              <AvatarFallback className="font-bold text-xs bg-teal-50 text-[#15B8A6]">
                                {patient.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold text-xs text-[#182230] group-hover:text-[#15B8A6] transition-colors">
                                {patient.name}
                              </p>
                              <span className="text-[10px] text-slate-400 font-mono sm:hidden">
                                {patient.phone}
                              </span>
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono text-xs text-slate-600">
                        {patient.phone}
                      </td>

                      {/* Visits Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-slate-100 font-black text-xs text-slate-700">
                          {patient.visitsCount}
                        </span>
                      </td>

                      {/* Last Visit */}
                      <td className="py-3.5 px-4 text-xs text-slate-500 font-mono">
                        {patient.lastVisit}
                      </td>

                      {/* Last Service */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-blue-50 text-[#2F80ED] border border-blue-100">
                          {patient.lastService}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          className={`text-[10px] font-bold px-2 py-0.5 border-none ${
                            patient.status === 'مستعجل'
                              ? 'bg-rose-100 text-rose-700'
                              : patient.status === 'خامل'
                              ? 'bg-slate-100 text-slate-500'
                              : 'bg-emerald-100 text-emerald-800'
                          }`}
                        >
                          {patient.status || 'نشط'}
                        </Badge>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link href={`/clinic/${slug}/admin/patients/${encodeURIComponent(patient.phone)}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs font-bold text-[#15B8A6] border-teal-200 hover:bg-teal-50 rounded-xl"
                            >
                              ملف المريض
                            </Button>
                          </Link>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-emerald-600 hover:bg-emerald-50 rounded-xl"
                            onClick={() => sendWhatsApp(patient.phone, patient.name)}
                            title="مراسلة عبر واتساب"
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-xl transition-colors"
                            onClick={() => handleDeletePatient(patient.phone, patient.name)}
                            title="حذف المريض"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Table Pagination Footer matching Mockup */}
        <div className="p-4 border-t border-[#E5EAF0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
          <div>
            عرض {paginatedPatients.length} من أصل {filtered.length} مريض
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 text-xs font-bold rounded-xl"
            >
              السابق
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                size="sm"
                variant={currentPage === page ? 'default' : 'outline'}
                onClick={() => setCurrentPage(page)}
                className={`h-8 w-8 text-xs font-bold rounded-xl ${
                  currentPage === page ? 'bg-[#15B8A6] text-white hover:bg-[#0D9488]' : ''
                }`}
              >
                {page}
              </Button>
            ))}

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 px-3 text-xs font-bold rounded-xl"
            >
              التالي
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
