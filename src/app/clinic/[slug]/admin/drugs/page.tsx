'use client'

import { use, useState, useEffect, useMemo } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search, Pill, Star, Filter, Plus, FileSignature,
  Building2, Sparkles, Check, ChevronLeft, ChevronRight,
  RefreshCw, Loader2, Info, X
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore'
import { DrugItem } from '@/lib/egyptian-drugs'
import { useEgyptianDrugs } from '@/hooks/useEgyptianDrugs'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { useLanguage } from '@/context/LanguageContext'

export default function DrugDirectoryPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, language, isRtl, dir } = useLanguage()

  // Load massive DB + daily updates using global hook
  const { drugs: apiDrugs, loading: isApiLoading, refresh: refreshDrugs } = useEgyptianDrugs()
  
  // Custom drugs added manually by the clinic (persisted to Firestore)
  const [customDrugs, setCustomDrugs] = useState<DrugItem[]>([])
  const [favoriteList, setFavoriteList] = useState<string[]>([])
  const [clinicId, setClinicId] = useState<string | null>(null)
  
  const [search, setSearch] = useState('')
  const [companyFilter, setCompanyFilter] = useState('ALL')
  const [formFilter, setFormFilter] = useState('ALL')
  const [showOnlyFavorites, setShowOnlyFavorites] = useState(false)
  
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  // Details Modal
  const [selectedDrug, setSelectedDrug] = useState<DrugItem | null>(null)

  // New Drug State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [isSubmittingDrug, setIsSubmittingDrug] = useState(false)
  const [newDrug, setNewDrug] = useState<Partial<DrugItem>>({
    name: '', activeIngredient: '', company: '', form: 'أقراص', price: 0
  })

  // Sync state & automatic daily trigger
  const [isSyncing, setIsSyncing] = useState(false)
  const [syncingDrugName, setSyncingDrugName] = useState<string | null>(null)
  const [lastSyncDate, setLastSyncDate] = useState<string>('')

  // 1. Fetch clinic favorites & custom drugs from Firestore
  useEffect(() => {
    const fetchClinicData = async () => {
      try {
        const q = query(collection(db, 'clinics'), where('slug', '==', slug))
        const snap = await getDocs(q)
        if (!snap.empty) {
          const cId = snap.docs[0].id
          setClinicId(cId)
          const data = snap.docs[0].data()
          if (Array.isArray(data.favorite_drugs)) {
            setFavoriteList(data.favorite_drugs)
          }
          if (Array.isArray(data.custom_drugs)) {
            setCustomDrugs(data.custom_drugs)
          }
        }
      } catch (err) {
        console.error('Error fetching clinic drug settings:', err)
      }
    }
    fetchClinicData()
  }, [slug])

  // 2. Check and perform daily background price check
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedSync = localStorage.getItem('last_drug_sync') || ''
      if (savedSync) setLastSyncDate(savedSync)

      const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
      if (savedSync !== today) {
        fetch('/api/sync-daily-prices')
          .then((res) => {
            if (res.ok) {
              localStorage.setItem('last_drug_sync', today)
              setLastSyncDate(today)
              refreshDrugs()
            }
          })
          .catch(() => {})
      }
    }
  }, [refreshDrugs])

  const handleManualSync = async (customQuery?: string) => {
    setIsSyncing(true)
    const targetQ = typeof customQuery === 'string' ? customQuery : search.trim()
    const queryParam = targetQ ? `?q=${encodeURIComponent(targetQ)}` : ''
    toast.info(
      targetQ
        ? `جاري فحص وتحديث أسعار (${targetQ})...`
        : 'جاري فحص وتحديث أحدث أسعار الأدوية...'
    )
    try {
      const res = await fetch(`/api/sync-daily-prices${queryParam}`)
      const data = await res.json()
      if (res.ok && data.success) {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
        localStorage.setItem('last_drug_sync', today)
        setLastSyncDate(today)
        await refreshDrugs()
        
        toast.success(
          data.records && data.records.length > 0
            ? `تم تحديث أسعار ${data.records.length} دواء بنجاح بتاريخ اليوم!`
            : 'تم فحص أحدث الأسعار ومطابقتها بنجاح!'
        )
      } else {
        toast.error(data.error || 'تعذر إكمال التحديث حالياً.')
      }
    } catch (e: any) {
      toast.error('حدث خطأ أثناء فحص وتحديث الأسعار: ' + (e.message || ''))
    } finally {
      setIsSyncing(false)
      setSyncingDrugName(null)
    }
  }

  // Merge the massive API db with the custom clinic drugs
  const allDrugs = useMemo(() => {
    const mappedApi: DrugItem[] = apiDrugs.map((api, idx) => ({
      id: `api-${idx}`,
      name: api.commercial_name_en || api.commercial_name_ar,
      activeIngredient: api.scientific_name || 'غير متوفر',
      company: api.manufacturer || 'غير محددة',
      form: (api.route || 'غير محدد') as any,
      price: api.price_egp || 0,
      isFavorite: false,
      isMarketUpdated: api.isMarketUpdated,
      lastMarketUpdate: api.lastMarketUpdate,
      oldPrice: api.oldPrice
    }))
    
    return [...customDrugs, ...mappedApi]
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

  // Persistent manual drug addition directly saved to Firestore
  const handleAddDrug = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newDrug.name || !newDrug.price) {
      toast.error('برجاء إدخال اسم الدواء والسعر')
      return
    }

    setIsSubmittingDrug(true)
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())

    const drug: DrugItem = {
      id: `custom-${Date.now()}`,
      name: newDrug.name.trim(),
      activeIngredient: newDrug.activeIngredient?.trim() || 'غير متوفر',
      company: newDrug.company?.trim() || 'مخصصة للعيادة',
      form: (newDrug.form as any) || 'أقراص',
      price: Number(newDrug.price),
      isFavorite: false,
      isMarketUpdated: false,
      lastMarketUpdate: todayStr
    }

    const updated = [drug, ...customDrugs]
    setCustomDrugs(updated)

    if (clinicId) {
      try {
        await updateDoc(doc(db, 'clinics', clinicId), {
          custom_drugs: updated
        })
        toast.success('تم حفظ الدواء بنجاح في قاعدة بيانات العيادة الدائمة')
      } catch (err) {
        console.error('Error saving custom drug:', err)
        toast.error('تم حفظ الدواء محلياً ولكن تعذر مزامنة السحابة')
      }
    } else {
      toast.success('تمت إضافة الدواء بنجاح')
    }

    setIsSubmittingDrug(false)
    setIsAddOpen(false)
    setNewDrug({ name: '', activeIngredient: '', company: '', form: 'أقراص', price: 0 })
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
      const matchFav = !showOnlyFavorites || favoriteList.includes(d.name)
      return matchSearch && matchCompany && matchForm && matchFav
    })
  }, [allDrugs, search, companyFilter, formFilter, showOnlyFavorites, favoriteList])

  // Pagination slice
  const paginated = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* 1. Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-[#092145] dark:text-[#F3FAFF] flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#087CF4] to-[#02CFF3] text-white flex items-center justify-center shadow-md shadow-[#087CF4]/20 shrink-0">
              <Pill className="w-5 h-5" />
            </div>
            <span>{t('drug_directory', 'دليل الأدوية المركزي')}</span>
          </h1>
          <div className="flex flex-wrap items-center gap-2 mt-2">
            <p className="text-xs text-[#60758F] dark:text-[#AEC1D7]">
              قاعدة بيانات الأدوية المصرية المصنفة بالمواد الفعالة والأسعار المعتمدة
            </p>
            <span className="text-[11px] font-bold text-[#087CF4] dark:text-[#02CFF3] bg-[#EAF4FD] dark:bg-[#0E2342] border border-[#DCE9F5] dark:border-[#254565] px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <Sparkles className="w-3 h-3 text-[#02CFF3]" />
              {lastSyncDate ? `${t('last_updated_on', 'تم التحديث بتاريخ')}: ${lastSyncDate}` : 'محدث بتاريخ اليوم'}
            </span>
          </div>
        </div>

        {/* Header Actions */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Manual Sync Button */}
          <Button
            onClick={() => handleManualSync()}
            disabled={isSyncing}
            variant="outline"
            className="h-10 px-3.5 text-xs font-bold border-[#DCE9F5] dark:border-[#254565] text-[#087CF4] dark:text-[#02CFF3] bg-white dark:bg-[#0E2342] hover:bg-[#EAF4FD] dark:hover:bg-[#142D50] rounded-xl cursor-pointer shadow-xs"
            title="فحص ومزامنة أحدث أسعار الأدوية المعتمدة"
          >
            <RefreshCw className={`w-3.5 h-3.5 ml-1.5 ${isSyncing && !syncingDrugName ? 'animate-spin' : ''}`} />
            {isSyncing && !syncingDrugName ? 'جاري التحديث...' : t('manual_sync', 'تحديث يدوي للأسعار')}
          </Button>

          {/* Search-targeted instant price sync */}
          {search.trim().length >= 2 && (
            <Button
              type="button"
              onClick={() => handleManualSync(search.trim())}
              disabled={isSyncing}
              className="h-10 px-3.5 text-xs font-black yalla-gradient-btn rounded-xl shadow-xs cursor-pointer flex items-center gap-1.5"
              title={`جلب أحدث تسعيرة لـ "${search.trim()}" ومطابقتها`}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
              تحديث &quot;{search.trim()}&quot; فورياً
            </Button>
          )}

          {/* Add Custom Drug Dialog */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger className="yalla-gradient-btn font-bold h-10 px-4 rounded-xl text-xs shadow-md inline-flex items-center justify-center cursor-pointer">
              <Plus className="w-4 h-4 ml-1.5" />
              {t('add_new_drug', 'إضافة دواء جديد')}
            </DialogTrigger>
            <DialogContent className="max-w-md bg-white dark:bg-[#0E2342] border border-[#DCE9F5] dark:border-[#254565] shadow-2xl rounded-3xl" dir={dir}>
              <DialogHeader>
                <DialogTitle className="text-lg font-black text-[#092145] dark:text-[#F3FAFF] flex items-center gap-2">
                  <div className="w-8 h-8 rounded-xl bg-[#087CF4]/10 text-[#087CF4] flex items-center justify-center">
                    <Pill className="w-4 h-4" />
                  </div>
                  إضافة دواء دائم للعيادة
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddDrug} className="space-y-4 py-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">الاسم التجاري للدواء *</Label>
                  <Input
                    required
                    value={newDrug.name}
                    onChange={e => setNewDrug({...newDrug, name: e.target.value})}
                    placeholder="مثال: Congestal 500mg"
                    className="h-10 text-sm bg-[#F4FAFF] dark:bg-[#07162D] border-[#DCE9F5] dark:border-[#254565] rounded-xl"
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">المادة الفعالة</Label>
                  <Input
                    value={newDrug.activeIngredient}
                    onChange={e => setNewDrug({...newDrug, activeIngredient: e.target.value})}
                    placeholder="مثال: Paracetamol / Pseudoephedrine"
                    className="h-10 text-sm bg-[#F4FAFF] dark:bg-[#07162D] border-[#DCE9F5] dark:border-[#254565] rounded-xl"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">الشركة المصنعة</Label>
                    <Input
                      value={newDrug.company}
                      onChange={e => setNewDrug({...newDrug, company: e.target.value})}
                      placeholder="مثال: Sigma"
                      className="h-10 text-sm bg-[#F4FAFF] dark:bg-[#07162D] border-[#DCE9F5] dark:border-[#254565] rounded-xl"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">الشكل الدوائي</Label>
                    <select
                      value={newDrug.form}
                      onChange={e => setNewDrug({...newDrug, form: e.target.value as any})}
                      className="w-full h-10 px-3 rounded-xl border border-[#DCE9F5] dark:border-[#254565] text-sm bg-[#F4FAFF] dark:bg-[#07162D] text-[#092145] dark:text-[#F3FAFF] focus:outline-none focus:ring-2 focus:ring-[#087CF4]/20"
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
                  <Label className="text-xs font-bold text-slate-700 dark:text-slate-300">السعر (جنيه مصري) *</Label>
                  <Input
                    required
                    type="number"
                    min="0"
                    step="0.5"
                    value={newDrug.price || ''}
                    onChange={e => setNewDrug({...newDrug, price: Number(e.target.value)})}
                    placeholder="0.00"
                    className="h-10 text-sm bg-[#F4FAFF] dark:bg-[#07162D] border-[#DCE9F5] dark:border-[#254565] rounded-xl"
                  />
                </div>

                <div className="pt-3 flex gap-2">
                  <Button
                    type="submit"
                    disabled={isSubmittingDrug}
                    className="flex-1 yalla-gradient-btn font-bold h-10 rounded-xl text-xs cursor-pointer"
                  >
                    {isSubmittingDrug ? 'جاري الحفظ...' : 'حفظ في قاعدة بيانات العيادة'}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddOpen(false)}
                    className="h-10 text-xs font-bold rounded-xl border-[#DCE9F5] dark:border-[#254565]"
                  >
                    {t('cancel', 'إلغاء')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* 2. Search & Multi-Filters Bar */}
      <div className="medical-card p-4 space-y-3 bg-white dark:bg-[#0E2342] border-[#DCE9F5] dark:border-[#254565]">
        <div className="grid sm:grid-cols-12 gap-3 items-center">
          {/* Universal Search Input */}
          <div className="sm:col-span-5 relative">
            <Search className="w-4 h-4 absolute rtl:right-3.5 ltr:left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <Input
              value={search}
              onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
              placeholder={isRtl ? "ابحث باسم الدواء أو المادة الفعالة أو الشركة..." : "Search by drug, ingredient, or company..."}
              className="rtl:pr-10 ltr:pl-10 h-10 text-sm bg-[#F4FAFF] dark:bg-[#07162D] border-[#DCE9F5] dark:border-[#254565] rounded-xl focus:bg-white"
            />
          </div>

          {/* Company Filter */}
          <div className="sm:col-span-3">
            <select
              value={companyFilter}
              onChange={e => { setCompanyFilter(e.target.value); setCurrentPage(1); }}
              className="w-full h-10 px-3 rounded-xl border border-[#DCE9F5] dark:border-[#254565] text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#07162D] focus:outline-none focus:ring-2 focus:ring-[#087CF4]/20"
            >
              <option value="ALL">{t('all_companies', 'كل الشركات')}</option>
              {companies.map(c => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Form Filter */}
          <div className="sm:col-span-2">
            <select
              value={formFilter}
              onChange={e => { setFormFilter(e.target.value); setCurrentPage(1); }}
              className="w-full h-10 px-3 rounded-xl border border-[#DCE9F5] dark:border-[#254565] text-xs font-bold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#07162D] focus:outline-none focus:ring-2 focus:ring-[#087CF4]/20"
            >
              <option value="ALL">{t('all_forms', 'كل الأشكال')}</option>
              {forms.map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Favorites Filter Button */}
          <div className="sm:col-span-2">
            <Button
              type="button"
              variant={showOnlyFavorites ? "default" : "outline"}
              onClick={() => { setShowOnlyFavorites(!showOnlyFavorites); setCurrentPage(1); }}
              className={`w-full h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                showOnlyFavorites
                  ? 'bg-amber-500 hover:bg-amber-600 text-white border-transparent'
                  : 'border-[#DCE9F5] dark:border-[#254565] text-slate-700 dark:text-slate-200 hover:border-amber-400'
              }`}
            >
              <Star className={`w-3.5 h-3.5 ${showOnlyFavorites ? 'fill-white text-white' : 'text-amber-500'}`} />
              <span>{t('favorites', 'المفضلة')} ({favoriteList.length})</span>
            </Button>
          </div>
        </div>
      </div>

      {/* 3. Drug Directory Desktop Table */}
      <div className="medical-card overflow-hidden relative min-h-[400px] hidden md:block bg-white dark:bg-[#0E2342] border-[#DCE9F5] dark:border-[#254565]">
        {isApiLoading ? (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 dark:bg-[#0E2342]/80 backdrop-blur-xs">
            <Loader2 className="w-8 h-8 text-[#087CF4] animate-spin" />
            <p className="mt-4 text-sm font-bold text-slate-600 dark:text-slate-300">جاري تحميل بيانات الأدوية والأسعار...</p>
          </div>
        ) : null}

        <div className="overflow-x-auto">
          <table className="w-full text-right text-sm">
            <thead className="bg-[#F4FAFF] dark:bg-[#07162D] border-b border-[#DCE9F5] dark:border-[#254565] text-[#60758F] dark:text-[#AEC1D7] text-xs font-bold select-none">
              <tr>
                <th className="py-3.5 px-3 text-center w-12">{t('favorites', 'المفضلة')}</th>
                <th className="py-3.5 px-4">{t('drug_name', 'اسم الدواء')}</th>
                <th className="py-3.5 px-4">{t('active_ingredient', 'المادة الفعالة')}</th>
                <th className="py-3.5 px-4">{t('manufacturer', 'الشركة')}</th>
                <th className="py-3.5 px-4">{t('dosage_form', 'الشكل')}</th>
                <th className="py-3.5 px-4 text-center">{t('price', 'السعر')}</th>
                <th className="py-3.5 px-4 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#DCE9F5] dark:divide-[#254565]">
              {paginated.length === 0 && !isApiLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    {t('no_data', 'لا توجد أدوية مطابقة للبحث أو الفلتر المحدد.')}
                  </td>
                </tr>
              ) : (
                paginated.map((drug) => {
                  const isFav = favoriteList.includes(drug.name)
                  return (
                    <tr key={drug.id} className="hover:bg-[#EAF4FD]/50 dark:hover:bg-[#142D50]/50 transition-colors">
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

                      {/* Drug Name with click to inspect */}
                      <td className="py-3.5 px-4">
                        <button
                          onClick={() => setSelectedDrug(drug)}
                          className="text-right font-bold text-xs text-[#092145] dark:text-[#F3FAFF] hover:text-[#087CF4] dark:hover:text-[#02CFF3] transition-colors cursor-pointer flex items-center gap-1.5"
                        >
                          <span>{drug.name}</span>
                          <Info className="w-3.5 h-3.5 opacity-50 hover:opacity-100" />
                        </button>
                      </td>

                      {/* Active Ingredient */}
                      <td className="py-3.5 px-4 text-xs text-slate-600 dark:text-slate-300 font-mono">
                        {drug.activeIngredient}
                      </td>

                      {/* Company */}
                      <td className="py-3.5 px-4 text-xs font-bold text-slate-500 dark:text-slate-400">
                        {drug.company}
                      </td>

                      {/* Form */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-[#EAF4FD] dark:bg-[#142D50] text-[#087CF4] dark:text-[#02CFF3]">
                          {drug.form}
                        </span>
                      </td>

                      {/* Price */}
                      <td className="py-3.5 px-4 text-center font-bold text-xs">
                        <div className="flex flex-col items-center justify-center">
                          <div className="flex items-center gap-1.5 justify-center">
                            {drug.price && Number(drug.price) > 0 ? (
                              <span className="text-emerald-600 dark:text-emerald-400 font-black text-sm">
                                {drug.price} {t('currency_egp', 'ج.م')}
                              </span>
                            ) : (
                              <span className="text-slate-400 text-[11px]">
                                {t('price_not_available', 'السعر غير متوفر')}
                              </span>
                            )}
                            {drug.oldPrice && Number(drug.oldPrice) !== Number(drug.price) && (
                              <span className="line-through text-slate-400 text-[10px]" title="السعر السابق">
                                {drug.oldPrice} ج.م
                              </span>
                            )}
                          </div>
                          {drug.lastMarketUpdate && (
                            <span className="text-[9px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">
                              {drug.lastMarketUpdate}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link href={`/clinic/${slug}/admin/prescriptions?drug=${encodeURIComponent(drug.name)}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-2.5 text-[11px] font-bold text-[#087CF4] dark:text-[#02CFF3] border-[#DCE9F5] dark:border-[#254565] hover:bg-[#EAF4FD] dark:hover:bg-[#142D50] rounded-xl cursor-pointer"
                            >
                              <FileSignature className="w-3.5 h-3.5 ml-1" />
                              {t('add_to_prescription', 'إضافة للروشتة')}
                            </Button>
                          </Link>

                          <button
                            type="button"
                            onClick={() => {
                              setSyncingDrugName(drug.name)
                              handleManualSync(drug.name.split(' ')[0] || drug.name)
                            }}
                            disabled={isSyncing}
                            className="p-1.5 rounded-lg border border-[#DCE9F5] dark:border-[#254565] hover:border-amber-400 hover:bg-amber-50 text-slate-400 hover:text-amber-600 transition-colors cursor-pointer"
                            title="تحديث سعر هذا الدواء فورياً"
                          >
                            <RefreshCw className={`w-3.5 h-3.5 ${syncingDrugName === drug.name && isSyncing ? 'animate-spin text-amber-600' : ''}`} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Desktop Table Pagination Footer */}
        <div className="p-4 border-t border-[#DCE9F5] dark:border-[#254565] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-500 bg-[#F4FAFF]/70 dark:bg-[#07162D]/70">
          <div>
            عرض {paginated.length} من أصل {filtered.length} دواء
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 text-xs font-bold rounded-xl border-[#DCE9F5] dark:border-[#254565]"
            >
              {t('previous', 'السابق')}
            </Button>

            <div className="flex items-center px-4 font-semibold text-slate-700 dark:text-slate-200 bg-white dark:bg-[#0E2342] border border-[#DCE9F5] dark:border-[#254565] rounded-xl h-8">
              صفحة {currentPage} من {totalPages}
            </div>

            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="h-8 px-3 text-xs font-bold rounded-xl border-[#DCE9F5] dark:border-[#254565]"
            >
              {t('next', 'التالي')}
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Drug Directory Mobile Cards View */}
      <div className="block md:hidden space-y-3">
        {isApiLoading ? (
          <div className="p-8 text-center bg-white dark:bg-[#0E2342] rounded-2xl border border-[#DCE9F5] dark:border-[#254565]">
            <Loader2 className="w-7 h-7 text-[#087CF4] animate-spin mx-auto" />
            <p className="mt-2 text-xs font-bold text-slate-500">جاري تحميل بيانات الأدوية...</p>
          </div>
        ) : paginated.length === 0 ? (
          <div className="p-8 text-center bg-white dark:bg-[#0E2342] rounded-2xl border border-[#DCE9F5] dark:border-[#254565] text-slate-400 text-xs">
            {t('no_data', 'لا توجد أدوية مطابقة للبحث.')}
          </div>
        ) : (
          paginated.map((drug) => {
            const isFav = favoriteList.includes(drug.name)
            return (
              <div
                key={drug.id}
                className="medical-card p-4 space-y-2.5 bg-white dark:bg-[#0E2342] border-[#DCE9F5] dark:border-[#254565]"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h3 className="font-bold text-sm text-[#092145] dark:text-[#F3FAFF] leading-snug">
                      {drug.name}
                    </h3>
                    <p className="text-[11px] text-slate-500 font-mono mt-0.5">
                      {drug.activeIngredient}
                    </p>
                  </div>
                  <button
                    onClick={() => toggleFavorite(drug.name)}
                    className="p-1 text-slate-300 hover:text-amber-500"
                  >
                    <Star className={`w-4 h-4 ${isFav ? 'fill-amber-400 text-amber-400' : 'text-slate-300'}`} />
                  </button>
                </div>

                <div className="flex items-center justify-between text-xs pt-1 border-t border-[#DCE9F5] dark:border-[#254565]">
                  <span className="text-slate-500 text-[11px]">{drug.company} • {drug.form}</span>
                  <div>
                    {drug.price && Number(drug.price) > 0 ? (
                      <span className="font-black text-emerald-600 dark:text-emerald-400">
                        {drug.price} {t('currency_egp', 'ج.م')}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">{t('price_not_available', 'السعر غير متوفر')}</span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-1">
                  <Link
                    href={`/clinic/${slug}/admin/prescriptions?drug=${encodeURIComponent(drug.name)}`}
                    className="flex-1"
                  >
                    <Button
                      size="sm"
                      className="w-full h-8 text-[11px] font-bold yalla-gradient-btn rounded-xl"
                    >
                      <FileSignature className="w-3.5 h-3.5 ml-1" />
                      إضافة للروشتة
                    </Button>
                  </Link>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedDrug(drug)}
                    className="h-8 px-2.5 text-[11px] rounded-xl border-[#DCE9F5] dark:border-[#254565]"
                  >
                    <Info className="w-3.5 h-3.5 text-[#087CF4]" />
                  </Button>
                </div>
              </div>
            )
          })
        )}

        {/* Mobile Pagination */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-white dark:bg-[#0E2342] border border-[#DCE9F5] dark:border-[#254565] text-xs">
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
            disabled={currentPage === 1}
            className="h-8 px-3 rounded-xl border-[#DCE9F5] dark:border-[#254565]"
          >
            {t('previous', 'السابق')}
          </Button>
          <span className="font-bold text-slate-700 dark:text-slate-200">
            {currentPage} / {totalPages}
          </span>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages}
            className="h-8 px-3 rounded-xl border-[#DCE9F5] dark:border-[#254565]"
          >
            {t('next', 'التالي')}
          </Button>
        </div>
      </div>

      {/* 5. Drug Details Modal */}
      {selectedDrug && (
        <Dialog open={!!selectedDrug} onOpenChange={() => setSelectedDrug(null)}>
          <DialogContent className="max-w-md bg-white dark:bg-[#0E2342] border border-[#DCE9F5] dark:border-[#254565] shadow-2xl rounded-3xl" dir={dir}>
            <DialogHeader>
              <DialogTitle className="text-lg font-black text-[#092145] dark:text-[#F3FAFF] flex items-center justify-between">
                <span>{selectedDrug.name}</span>
              </DialogTitle>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="p-3 rounded-2xl bg-[#F4FAFF] dark:bg-[#07162D] border border-[#DCE9F5] dark:border-[#254565] space-y-2">
                <div className="flex justify-between">
                  <span className="text-slate-500">المادة الفعالة:</span>
                  <span className="font-bold text-[#092145] dark:text-[#F3FAFF] font-mono">{selectedDrug.activeIngredient}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الشركة المصنعة:</span>
                  <span className="font-bold text-[#092145] dark:text-[#F3FAFF]">{selectedDrug.company}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-500">الشكل الدوائي:</span>
                  <span className="font-bold text-[#087CF4] dark:text-[#02CFF3]">{selectedDrug.form}</span>
                </div>
                <div className="flex justify-between items-center pt-1 border-t border-[#DCE9F5] dark:border-[#254565]">
                  <span className="text-slate-500">السعر المعتمد:</span>
                  <span className="text-sm font-black text-emerald-600 dark:text-emerald-400">
                    {selectedDrug.price && Number(selectedDrug.price) > 0
                      ? `${selectedDrug.price} ${t('currency_egp', 'ج.م')}`
                      : t('price_not_available', 'السعر غير متوفر حالياً')}
                  </span>
                </div>
                {selectedDrug.lastMarketUpdate && (
                  <div className="flex justify-between text-[11px] text-slate-400 pt-1">
                    <span>تاريخ آخر تحديث:</span>
                    <span>{selectedDrug.lastMarketUpdate}</span>
                  </div>
                )}
              </div>

              <div className="flex gap-2 pt-2">
                <Link
                  href={`/clinic/${slug}/admin/prescriptions?drug=${encodeURIComponent(selectedDrug.name)}`}
                  className="flex-1"
                >
                  <Button className="w-full yalla-gradient-btn font-bold h-10 rounded-xl text-xs">
                    <FileSignature className="w-4 h-4 ml-1" />
                    استخدام في روشتة
                  </Button>
                </Link>
                <Button
                  variant="outline"
                  onClick={() => setSelectedDrug(null)}
                  className="h-10 px-4 text-xs font-bold rounded-xl border-[#DCE9F5] dark:border-[#254565]"
                >
                  إغلاق
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  )
}
