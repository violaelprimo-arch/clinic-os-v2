'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search, Pill, Star, Filter, Plus, FileSignature,
  Building2, Sparkles, Check, ChevronLeft, ChevronRight, CloudDownload, RefreshCw
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { STRUCTURED_DRUGS, DrugItem } from '@/lib/egyptian-drugs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'

export default function DrugDirectoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  const [drugs, setDrugs] = useState<DrugItem[]>(STRUCTURED_DRUGS)
  const [favoriteList, setFavoriteList] = useState<string[]>([])
  const [clinicId, setClinicId] = useState<string | null>(null)
  
  const [isUpdating, setIsUpdating] = useState(false)

  const handleUpdateFromAPI = async () => {
    setIsUpdating(true)
    const tid = toast.loading('جاري استيراد وتحديث قاعدة بيانات الأدوية من السيرفر المركزي...')
    try {
      const res = await fetch('https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json')
      if (!res.ok) throw new Error('فشل الاتصال بقاعدة البيانات')
      const data = await res.json()
      
      const mappedDrugs = data.map((d: any) => ({
        id: Math.random().toString(36).substr(2, 9),
        name: d.commercial_name_en || d.commercial_name_ar,
        activeIngredient: d.scientific_name || 'غير محدد',
        company: d.manufacturer || 'مجهول',
        form: d.route === 'ORAL' ? 'أقراص' : d.route === 'INJECTION' || d.route === 'INTRAMUSCULAR' || d.route === 'INTRAVENOUS' ? 'حقن' : 'أخرى',
        price: d.price_egp || 0
      }))

      const newDrugs = [...drugs]
      let added = 0
      mappedDrugs.forEach((md: any) => {
        if (!newDrugs.find(nd => nd.name.toLowerCase() === md.name.toLowerCase())) {
          newDrugs.push(md)
          added++
        }
      })
      
      setDrugs(newDrugs)
      toast.success(`تم التحديث بنجاح! تم إضافة ${added} صنف دوائي جديد للقاعدة.`, { id: tid })
    } catch (e: any) {
      toast.error(e.message || 'حدث خطأ أثناء التحديث', { id: tid })
    } finally {
      setIsUpdating(false)
    }
  }

  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('ALL')
  const [formFilter, setFormFilter] = useState('ALL')

  // Add Custom Drug modal
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newDrugName, setNewDrugName] = useState('')
  const [newActiveIngredient, setNewActiveIngredient] = useState('')
  const [newCompany, setNewCompany] = useState('')
  const [newForm, setNewForm] = useState<any>('أقراص')
  const [newPrice, setNewPrice] = useState<number>(50)

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  useEffect(() => {
    const fetchClinic = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snapshot = await getDocs(q)
        if (!snapshot.empty) {
          const cDoc = snapshot.docs[0]
          setClinicId(cDoc.id)
          const data = cDoc.data()
          if (data.favoriteDrugs) {
            setFavoriteList(data.favoriteDrugs)
          } else {
            const defaults = STRUCTURED_DRUGS.filter(d => d.isFavorite).map(d => d.name)
            setFavoriteList(defaults)
          }
          if (data.customDrugsRecords) {
            setDrugs([...data.customDrugsRecords, ...STRUCTURED_DRUGS])
          }
        }
      } catch (err) {
        console.error(err)
      }
    }
    fetchClinic()
  }, [slug])

  const toggleFavorite = async (drugName: string) => {
    let newFavs = [...favoriteList]
    if (newFavs.includes(drugName)) {
      newFavs = newFavs.filter(d => d !== drugName)
      toast.info(`تمت إزالة ${drugName} من المفضلة`)
    } else {
      newFavs.push(drugName)
      toast.success(`تمت إضافة ${drugName} إلى المفضلة`)
    }
    setFavoriteList(newFavs)

    if (clinicId) {
      try {
        await updateDoc(doc(db, 'clinics', clinicId), { favoriteDrugs: newFavs })
      } catch (err) {
        console.error(err)
      }
    }
  }

  const handleAddCustomDrug = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDrugName.trim()) return toast.error('يرجى إدخال اسم الدواء')

    const newDrug: DrugItem = {
      id: String(Date.now()),
      name: newDrugName,
      activeIngredient: newActiveIngredient || 'غير محدد',
      company: newCompany || 'محلي',
      form: newForm,
      price: Number(newPrice) || 0,
      isFavorite: true
    }

    const updated = [newDrug, ...drugs]
    setDrugs(updated)
    setFavoriteList(prev => [...prev, newDrugName])
    setIsAddOpen(false)
    setNewDrugName('')
    setNewActiveIngredient('')
    setNewCompany('')

    if (clinicId) {
      try {
        await updateDoc(doc(db, 'clinics', clinicId), {
          customDrugsRecords: updated.filter(d => Number(d.id) > 100)
        })
        toast.success('تمت إضافة الدواء لقاعدة بيانات العيادة بنجاح')
      } catch (err) {
        toast.error('حدث خطأ أثناء الحفظ')
      }
    }
  }

  // Filter options
  const companies = useMemo(() => {
    return Array.from(new Set(drugs.map(d => d.company))).filter(Boolean)
  }, [drugs])

  const forms = useMemo(() => {
    return Array.from(new Set(drugs.map(d => d.form))).filter(Boolean)
  }, [drugs])

  const filtered = useMemo(() => {
    return drugs.filter(d => {
      const matchSearch =
        d.name.toLowerCase().includes(search.toLowerCase()) ||
        d.activeIngredient.toLowerCase().includes(search.toLowerCase()) ||
        d.company.toLowerCase().includes(search.toLowerCase())
      const matchCompany = companyFilter === 'ALL' || d.company === companyFilter
      const matchForm = formFilter === 'ALL' || d.form === formFilter
      return matchSearch && matchCompany && matchForm
    })
  }, [drugs, search, companyFilter, formFilter])

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
            قاعدة بيانات الأدوية المصرية المصنفة بالمواد الفعالة والشركات والأسعار
          </p>
        </div>

        {/* Add Custom Drug Dialog */}
        <div className="flex gap-2">
          <Button 
            onClick={handleUpdateFromAPI} 
            disabled={isUpdating}
            className="h-10 bg-indigo-600 hover:bg-indigo-700 text-white font-bold rounded-xl text-xs shadow-md shadow-indigo-500/20"
          >
            {isUpdating ? <RefreshCw className="w-4 h-4 ml-1.5 animate-spin" /> : <CloudDownload className="w-4 h-4 ml-1.5" />}
            تحديث الأدوية
          </Button>
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
          <DialogTrigger className="h-10 px-4 bg-[#15B8A6] hover:bg-[#0D9488] text-white font-bold rounded-xl text-xs shadow-md shadow-[#15B8A6]/20 inline-flex items-center justify-center cursor-pointer">
            <Plus className="w-4 h-4 ml-1.5" />
            إضافة دواء جديد
          </DialogTrigger>
          <DialogContent className="sm:max-w-md" dir="rtl">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold text-[#182230]">إضافة دواء لقاعدة بيانات العيادة</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleAddCustomDrug} className="space-y-4 pt-2">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">اسم الدواء التجاري والتركيز</Label>
                <Input
                  value={newDrugName}
                  onChange={e => setNewDrugName(e.target.value)}
                  placeholder="مثال: Augmentin 1g"
                  className="h-10 text-sm rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">المادة الفعالة (Active Ingredient)</Label>
                <Input
                  value={newActiveIngredient}
                  onChange={e => setNewActiveIngredient(e.target.value)}
                  placeholder="مثال: Amoxicillin + Clavulanic Acid"
                  className="h-10 text-sm rounded-xl"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">الشركة المصنعة</Label>
                  <Input
                    value={newCompany}
                    onChange={e => setNewCompany(e.target.value)}
                    placeholder="مثال: GSK"
                    className="h-10 text-sm rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-600">الشكل الدوائي</Label>
                  <select
                    value={newForm}
                    onChange={e => setNewForm(e.target.value)}
                    className="w-full h-10 px-3 rounded-xl border border-[#E5EAF0] text-xs font-bold text-slate-700 bg-white"
                  >
                    <option value="أقراص">أقراص</option>
                    <option value="كبسولات">كبسولات</option>
                    <option value="شراب">شراب</option>
                    <option value="أكياس">أكياس</option>
                    <option value="حقن">حقن</option>
                    <option value="نقط">نقط</option>
                    <option value="دهان / مرهم">دهان / مرهم</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold text-slate-600">السعر التقديري (ج.م)</Label>
                <Input
                  type="number"
                  value={newPrice}
                  onChange={e => setNewPrice(Number(e.target.value))}
                  className="h-10 text-sm rounded-xl"
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
      <div className="medical-card overflow-hidden">
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
              {paginated.length === 0 ? (
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
