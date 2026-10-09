'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search, Pill, Star, Filter, Plus, FileSignature,
  Building2, Sparkles, Check, ChevronLeft, ChevronRight, CloudDownload, RefreshCw, Loader2
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { DrugItem } from '@/lib/egyptian-drugs'
import { useEgyptianDrugs } from '@/hooks/useEgyptianDrugs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export default function DrugDirectoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  // Load massive DB + daily updates instantly using our global hook
  const { drugs: apiDrugs, loading: isApiLoading } = useEgyptianDrugs()
  
  // Local custom drugs if the clinic adds manual entries
  const [customDrugs, setCustomDrugs] = useState<DrugItem[]>([])

  const [favoriteList, setFavoriteList] = useState<string[]>([])
  const [clinicId, setClinicId] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('ALL')
  const [formFilter, setFormFilter] = useState('ALL')
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // New Drug State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newDrug, setNewDrug] = useState<Partial<DrugItem>>({
    name: '', activeIngredient: '', company: '', form: 'أقراص', price: 0
  })

  // 1. Fetch clinic favorites
  useEffect(() => {
    const fetchClinicSettings = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const cId = snap.docs[0].id
          setClinicId(cId)
          const data = snap.docs[0].data()
          if (data.favorite_drugs) {
            setFavoriteList(data.favorite_drugs)
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchClinicSettings()
  }, [slug])

  // Merge the massive API db with the custom clinic drugs
  const allDrugs = useMemo(() => {
    // Map API drugs to our DrugItem UI format
    const mappedApi: DrugItem[] = apiDrugs.map((api, idx) => ({
      id: `api-${idx}`,
      name: api.commercial_name_en || api.commercial_name_ar,
      activeIngredient: api.scientific_name || 'غير متوفر',
      company: api.manufacturer || 'غير محددة',
      form: (api.route || 'غير محدد') as any,
      price: api.price_egp || 0,
      isFavorite: false
    }))
    
    return [...mappedApi, ...customDrugs]
  }, [apiDrugs, customDrugs])

  const toggleFavorite = async (drugName: string) => {
    if (!clinicId) return
    const isFav = favoriteList.includes(drugName)
    const newList = isFav
      ? favoriteList.filter(d => d !== drugName)
      : [...favoriteList, drugName]
    
    setFavoriteList(newList)
    try {
      await updateDoc(doc(db, 'clinics', clinicId), {
        favorite_drugs: newList
      })
      toast.success(isFav ? 'تم الإزالة من المفضلة' : 'تمت الإضافة للمفضلة')
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ المفضلة')
      setFavoriteList(favoriteList) // Revert
    }
  }

  const handleAddDrug = (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDrug.name || !newDrug.price) {
      toast.error('برجاء إدخال اسم الدواء والسعر')
      return
    }
    
    const drug: DrugItem = {
      id: Math.random().toString(),
      name: newDrug.name,
      activeIngredient: newDrug.activeIngredient || 'غير متوفر',
      company: newDrug.company || 'مخصصة',
      form: newDrug.form as any || 'أقراص',
      price: Number(newDrug.price),
      isFavorite: false
    }

    setCustomDrugs([...customDrugs, drug])
    setIsAddOpen(false)
    setNewDrug({ name: '', activeIngredient: '', company: '', form: 'أقراص', price: 0 })
    toast.success('تمت إضافة الدواء بنجاح لقاعدة بيانات العيادة المحلية')
  }

  const companies = useMemo(() => {
    return Array.from(new Set(allDrugs.map(d => d.company))).filter(Boolean)
  }, [allDrugs])

  const forms = useMemo(() => {
    return Array.from(new Set(allDrugs.map(d => d.form))).filter(Boolean)
  }, [allDrugs])

  const filtered = useMemo(() => {
    return allDrugs.filter(d => {
      const matchSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.activeIngredient.toLowerCase().includes(search.toLowerCase()) ||
        d.company.toLowerCase().includes(search.toLowerCase())
      const matchCompany = companyFilter === 'ALL' || d.company === companyFilter
      const matchForm = formFilter === 'ALL' || d.form === formFilter
      return matchSearch && matchCompany && matchForm
    })
  }, [allDrugs, search, companyFilter, formFilter])

  // Pagination slice
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir="rtl">
      
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#182230] flex items-center gap-2">
            <Pill className="w-6 h-6 text-[#15B8A6]" />
            دليل الأدوية المركزي
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            قاعدة بيانات الأدوية المصرية المصنفة بالمواد الفعالة والشركات وتحديث الأسعار التلقائي
          </p>
        </div>

        {/* Add Custom Drug Dialog */}
        <div className="flex gap-2">
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger>
            <Button className="bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold h-10 px-4 rounded-xl text-xs">
              <Plus className="w-4 h-4 ml-1.5" />
              إضافة دواء جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-md bg-white border-none shadow-xl rounded-2xl" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-[#182230] flex items-center gap-2">
                <Pill className="w-5 h-5 text-[#15B8A6]" />
                إضافة دواء محلي للعيادة
              </DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddDrug} className="space-y-4 py-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">الاسم التجاري للدواء *</Label>
                <Input
                  required
                  value={newDrug.name}
                  onChange={e => setNewDrug({...newDrug, name: e.target.value})}
                  placeholder="مثال: Congestal"
                  className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">المادة الفعالة</Label>
                <Input
                  value={newDrug.activeIngredient}
                  onChange={e => setNewDrug({...newDrug, activeIngredient: e.target.value})}
                  placeholder="مثال: Paracetamol"
                  className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">الشركة المصنعة</Label>
                  <Input
                    value={newDrug.company}
                    onChange={e => setNewDrug({...newDrug, company: e.target.value})}
                    placeholder="مثال: Sigma"
                    className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700">الشكل الدوائي</Label>
                  <select
                    value={newDrug.form}
                    onChange={e => setNewDrug({...newDrug, form: e.target.value as any})}
                    className="w-full h-10 px-3 rounded-xl border border-slate-200 text-sm bg-slate-50 focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20"
                  >
                    <option value="أقراص">أقراص</option>
                    <option value="كبسولات">كبسولات</option>
                    <option value="شراب">شراب</option>
                    <option value="حقن">حقن</option>
                    <option value="مرهم / دهان">مرهم / دهان</option>
                    <option value="نقط">نقط</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-700">السعر (جنيه مصري) *</Label>
                <Input
                  required
                  type="number"
                  min="0"
                  step="0.5"
                  value={newDrug.price || ''}
                  onChange={e => setNewDrug({...newDrug, price: Number(e.target.value)})}
                  placeholder="0.00"
                  className="h-10 text-sm bg-slate-50 border-slate-200 rounded-xl"
                />
              </div>

              <div className="pt-3 flex gap-2">
                <Button
                  type="submit"
                  className="flex-1 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold h-10 rounded-xl text-xs"
                >
                  حفظ الدواء
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
      </div>

      {/* 2. Search & Multi-Filters Bar (Matching Mockup) */}
      <div className="medical-card p-4 space-y-3 bg-white">
        <div className="grid sm:grid-cols-12 gap-3 items-center">
          {/* Universal Search Input */}
          <div className="sm:col-span-6 relative">
            <Search className="w-4 h-4 absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder="ابحث باسم الدواء أو المادة الفعالة أو الشركة..."
              className="pr-10 h-10 text-sm bg-[#F6F8FB] border-[#E5EAF0] rounded-xl focus:bg-white"
            />
          </div>

          {/* Company Filter */}
          <div className="sm:col-span-3">
            <select
              value={companyFilter}
              onChange={e => { setCompanyFilter(e.target.value); setCurrentPage(1); }}
              className="w-full h-10 px-3 rounded-xl border border-[#E5EAF0] text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20"
            >
              <option value="ALL">كل الشركات</option>
              {companies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Form Filter */}
          <div className="sm:col-span-3">
            <select
              value={formFilter}
              onChange={e => { setFormFilter(e.target.value); setCurrentPage(1); }}
              className="w-full h-10 px-3 rounded-xl border border-[#E5EAF0] text-xs font-bold text-slate-700 bg-white focus:outline-none focus:ring-2 focus:ring-[#15B8A6]/20"
            >
              <option value="ALL">كل الأشكال</option>
              {forms.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 3. Drug Directory Table (Columns matching Mockup) */}
      <div className="medical-card overflow-hidden relative min-h-[400px]">
        {isApiLoading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm">
            <Loader2 className="w-8 h-8 text-[#15B8A6] animate-spin" />
            <p className="mt-4 text-sm font-bold text-slate-600">جاري تحميل بيانات الأدوية وأحدث الأسعار...</p>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#F8FAFC] border-b border-[#E5EAF0] text-slate-400 text-xs font-bold select-none">
              <tr>
                <th className="py-3.5 px-3 text-center w-12">المفضلة</th>
                <th className="py-3.5 px-4">اسم الدواء</th>
                <th className="py-3.5 px-4">المادة الفعالة</th>
                <th className="py-3.5 px-4">الشركة</th>
                <th className="py-3.5 px-4">الشكل</th>
                <th className="py-3.5 px-4 text-center">السعر (ج.م)</th>
                <th className="py-3.5 px-4 text-center">إجراء</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5EAF0]">
              {paginated.length === 0 && !isApiLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    لا توجد أدوية مطابقة للبحث أو الفلتر المحدد.
                  </td>
                </tr>
              ) : (
                paginated.map((drug) => {
                  const isFav = favoriteList.includes(drug.name)
                  return (
                    <tr key={drug.id} className="hover:bg-slate-50/80 transition-colors">
                      {/* Favorite Toggle Star */}
                      <td className="py-3.5 px-3 text-center">
                        <button
                          onClick={() => toggleFavorite(drug.name)}
                          className="p-1 rounded-lg hover:bg-amber-50 text-slate-300 hover:text-amber-500 transition-colors cursor-pointer"
                        >
                          <Star
                            className={`w-4 h-4 ${
                              isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-300'
                            }`}
                          />
                        </button>
                      </td>

                      {/* Drug Name */}
                      <td className="py-3.5 px-4 font-bold text-xs text-[#182230]">
                        {drug.name}
                      </td>

                      {/* Active Ingredient */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 font-mono">
                        {drug.activeIngredient}
                      </td>

                      {/* Company */}
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-500">
                        {drug.company}
                      </td>

                      {/* Form */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700">
                          {drug.form}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-center font-bold text-xs text-emerald-600">
                        {drug.price} ج.م
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <Link href={`/clinic/${slug}/admin/prescriptions?drug=${encodeURIComponent(drug.name)}`}>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 px-2.5 text-[11px] font-bold text-[#15B8A6] border-teal-200 hover:bg-teal-50 rounded-xl"
                          >
                            <FileSignature className="w-3.5 h-3.5 ml-1" />
                            إضافة للروشتة
                          </Button>
                        </Link>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* 4. Table Pagination Footer */}
        <div className="p-4 border-t border-[#E5EAF0] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-slate-50/50">
          <div>
            عرض {paginated.length} من أصل {filtered.length} دواء
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

            <div className="flex items-center px-4 font-semibold text-slate-700 bg-white border border-slate-200 rounded-xl h-8">
              صفحة {currentPage} من {totalPages}
            </div>

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
