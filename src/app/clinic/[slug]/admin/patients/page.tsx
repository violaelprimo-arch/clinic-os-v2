'use client'

import { ResidentialAreaSelector, ResidentialAreaValue } from '@/components/common/ResidentialAreaSelector'

import { use, useEffect, useState, useMemo } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Search, UserPlus, Phone, Calendar, Clock, MessageCircle,
  FileText, ChevronLeft, ChevronRight, Filter, User, Plus,
  FileSignature, ArrowUpDown, MoreVertical, X, Trash2, FileSpreadsheet, Printer, MapPin, AlertCircle
} from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs, addDoc, onSnapshot, doc, deleteDoc, updateDoc } from 'firebase/firestore'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { exportPatientsToExcel } from '@/lib/excelExport'
import { printHtmlViaIframe, generatePatientsReportHtml } from '@/lib/printService'
import { useLanguage } from '@/context/LanguageContext'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import { cleanPhoneForWhatsApp, validatePhoneNumber, DEFAULT_COUNTRY, CountryInfo, getPhoneSearchVariants } from '@/lib/countryPhoneHelper'
import { openManualWhatsAppChat } from '@/lib/whatsappShare'
import { createAtomicAppointment } from '@/lib/queueService'

export default function PatientsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const { t, tDynamic, dir, isRtl } = useLanguage()
  const [clinic, setClinic] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [residenceFilter, setResidenceFilter] = useState<'ALL' | 'INCOMPLETE' | 'COMPLETED'>('ALL')
  const [newResidence, setNewResidence] = useState<ResidentialAreaValue | null>(null)
  const [editingPatientResidence, setEditingPatientResidence] = useState<any | null>(null)
  const [editResidenceValue, setEditResidenceValue] = useState<ResidentialAreaValue | null>(null)
  const [isSavingResidence, setIsSavingResidence] = useState<boolean>(false)
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [clinicId, setClinicId] = useState<string | null>(null)
  
  // Add Patient Modal State
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [newCountry, setNewCountry] = useState<CountryInfo>(DEFAULT_COUNTRY)
  const [newPhoneError, setNewPhoneError] = useState(false)
  const [newDob, setNewDob] = useState('')
  const [newAge, setNewAge] = useState('')
  const [newService, setNewService] = useState('كشف عادي')
  const [newPrice, setNewPrice] = useState(250)
  const [isAdding, setIsAdding] = useState(false)

  const todayCairoStr = useMemo(() => {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
  }, [])

  const setDatePreset = (preset: 'today' | 'week' | 'month' | 'all') => {
    setCurrentPage(1)
    if (preset === 'today') {
      setFromDate(todayCairoStr)
      setToDate(todayCairoStr)
    } else if (preset === 'week') {
      const d = new Date()
      d.setDate(d.getDate() - 7)
      const weekAgo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(d)
      setFromDate(weekAgo)
      setToDate(todayCairoStr)
    } else if (preset === 'month') {
      const d = new Date()
      const year = d.getFullYear()
      const month = String(d.getMonth() + 1).padStart(2, '0')
      setFromDate(`${year}-${month}-01`)
      setToDate(todayCairoStr)
    } else {
      setFromDate('')
      setToDate('')
    }
  }

  const handleAgeChange = (val: string) => {
    setNewAge(val)
    if (val) {
      const year = new Date().getFullYear() - parseInt(val)
      setNewDob(year + '-01-01')
    } else {
      setNewDob('')
    }
  }

  const handleDobChange = (val: string) => {
    setNewDob(val)
    if (val) {
      const birthYear = new Date(val).getFullYear()
      const currentYear = new Date().getFullYear()
      setNewAge((currentYear - birthYear).toString())
    } else {
      setNewAge('')
    }
  }

  // Pagination
  const [currentPage, setCurrentPage] = useState(1)
  const itemsPerPage = 8

  const [rawAppointments, setRawAppointments] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clinic_selected_branch') || 'all'
      setSelectedBranchId(saved)

      const handleBranchChanged = (e: any) => {
        const bId = e.detail?.branchId || 'all'
        setSelectedBranchId(bId)
      }
      window.addEventListener('clinic_branch_changed', handleBranchChanged)
      return () => window.removeEventListener('clinic_branch_changed', handleBranchChanged)
    }
  }, [])

  useEffect(() => {
    let unsubAppts: any = null;
    const fetchPatients = async () => {
      try {
        const clinicQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const clinicSnap = await getDocs(clinicQ)
        if (clinicSnap.empty) return
        const cData = { id: clinicSnap.docs[0].id, ...clinicSnap.docs[0].data() }
        setClinic(cData)
        setClinicId(cData.id)

        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', cData.id))
        unsubAppts = onSnapshot(apptQ, (apptSnap) => {
          const list = apptSnap.docs.map(doc => doc.data())
          setRawAppointments(list)
          setLoading(false)
        })
      } catch (error) {
        console.error("Error fetching patients:", error)
        setLoading(false)
      }
    }
    fetchPatients()

    return () => {
      if (unsubAppts) unsubAppts()
    }
  }, [slug])

  const patients = useMemo(() => {
    const pMap = new Map()
    rawAppointments.forEach(d => {
      if (!d.phone) return

      // Branch filter: if a specific branch is selected, ignore appointments not belonging to that branch
      if (selectedBranchId && selectedBranchId !== 'all') {
        const apptBranch = d.branch_id || d.branchId
        const isMainBranchSelected = selectedBranchId === 'main' || clinic?.branches?.find((b: any) => b.isMain)?.id === selectedBranchId
        const belongsToBranch = apptBranch ? apptBranch === selectedBranchId : isMainBranchSelected
        if (!belongsToBranch) return
      }

      const resObj = d.patientResidenceSnapshot || d.residence || null
      const hasRes = Boolean(resObj?.governorateId)

      if (!pMap.has(d.phone)) {
        pMap.set(d.phone, {
          id: d.phone,
          name: d.patientName,
          phone: d.phone,
          age: d.age || '',
          visitsCount: 1,
          lastVisit: d.date,
          allVisits: [d.date],
          lastService: d.serviceName || 'كشف',
          status: 'نشط',
          residence: resObj,
          hasResidence: hasRes,
          latestApptId: d.id
        })
      } else {
        const existing = pMap.get(d.phone)
        existing.visitsCount += 1
        if (d.date && !existing.allVisits.includes(d.date)) {
          existing.allVisits.push(d.date)
        }
        if (d.age && !existing.age) existing.age = d.age
        if (resObj && !existing.hasResidence) {
          existing.residence = resObj
          existing.hasResidence = true
        }
        if (new Date(d.date) > new Date(existing.lastVisit)) {
          existing.lastVisit = d.date
          existing.name = d.patientName
          existing.lastService = d.serviceName || existing.lastService
          existing.latestApptId = d.id || existing.latestApptId
          if (resObj) {
            existing.residence = resObj
            existing.hasResidence = true
          }
        }
      }
    })
    return Array.from(pMap.values()).sort((a: any, b: any) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime())
  }, [rawAppointments, selectedBranchId, clinic])

  const filtered = useMemo(() => {
    return patients.filter(p => {
      const matchSearch = p.name.includes(search) || p.phone.includes(search)
      const matchStatus = statusFilter === 'ALL' || p.status === statusFilter
      const matchResidence =
        residenceFilter === 'ALL'
          ? true
          : residenceFilter === 'INCOMPLETE'
          ? !p.hasResidence
          : p.hasResidence

      const hasVisitInRange = (!fromDate && !toDate) || (
        p.allVisits && p.allVisits.some((v: string) => (!fromDate || v >= fromDate) && (!toDate || v <= toDate))
      ) || ((!fromDate || p.lastVisit >= fromDate) && (!toDate || p.lastVisit <= toDate))

      return matchSearch && matchStatus && matchResidence && hasVisitInRange
    })
  }, [patients, search, statusFilter, residenceFilter, fromDate, toDate])

  // Pagination slice
  const paginatedPatients = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage
    return filtered.slice(start, start + itemsPerPage)
  }, [filtered, currentPage])

  const totalPages = Math.ceil(filtered.length / itemsPerPage) || 1


  const handleSavePatientResidence = async () => {
    if (!editingPatientResidence) return
    setIsSavingResidence(true)
    try {
      // Find appointments with this phone to update the latest snapshot and profile
      const q = query(
        collection(db, 'appointments'),
        where('phone', '==', editingPatientResidence.phone)
      )
      const snap = await getDocs(q)
      if (!snap.empty) {
        // Sort to get latest
        const docs = snap.docs.sort((a, b) => {
          const dA = a.data().date || a.data().createdAt || ''
          const dB = b.data().date || b.data().createdAt || ''
          return dB.localeCompare(dA)
        })
        const latestDoc = docs[0]
        await updateDoc(doc(db, 'appointments', latestDoc.id), {
          address: editResidenceValue?.areaNameAr || null,
          city: editResidenceValue?.cityNameAr || editResidenceValue?.governorateNameAr || null,
          patientResidenceSnapshot: editResidenceValue?.governorateId ? {
            governorateId: editResidenceValue.governorateId,
            governorateNameAr: editResidenceValue.governorateNameAr || '',
            governorateNameEn: editResidenceValue.governorateNameEn || '',
            cityId: editResidenceValue.cityId || '',
            cityNameAr: editResidenceValue.cityNameAr || '',
            cityNameEn: editResidenceValue.cityNameEn || '',
            areaId: editResidenceValue.areaId || '',
            areaNameAr: editResidenceValue.areaNameAr || '',
            areaNameEn: editResidenceValue.areaNameEn || '',
            customAreaName: editResidenceValue.customAreaName || null,
            source: 'staff_override',
            recordedAt: new Date().toISOString()
          } : null
        })
      }

      toast.success('تم حفظ وتحديث منطقة السكن للمريض بنجاح')
      setEditingPatientResidence(null)
      setEditResidenceValue(null)
    } catch (e) {
      console.error(e)
      toast.error('حدث خطأ أثناء حفظ منطقة السكن')
    } finally {
      setIsSavingResidence(false)
    }
  }

  const handleAddNewPatient = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newName.trim() || !newPhone.trim()) {
      return toast.error('يرجى كتابة الاسم ورقم الهاتف')
    }
    if (!validatePhoneNumber(newPhone, newCountry)) {
      setNewPhoneError(true)
      return toast.error(`يرجى كتابة رقم هاتف صحيح لـ ${newCountry.nameAr}`)
    }
    setNewPhoneError(false)
    setIsAdding(true)
    try {
      if (clinicId) {
        const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
        await createAtomicAppointment({
          clinic_id: clinicId,
          patientName: newName,
          phone: newPhone,
          serviceName: newService,
          servicePrice: Number(newPrice),
          date: today,
          status: 'waiting',
          age: newAge || null,
          dob: newDob || null,
          address: newResidence?.areaNameAr || null,
          city: newResidence?.cityNameAr || newResidence?.governorateNameAr || null,
          patientResidenceSnapshot: newResidence?.governorateId ? {
            governorateId: newResidence.governorateId,
            governorateNameAr: newResidence.governorateNameAr || '',
            governorateNameEn: newResidence.governorateNameEn || '',
            cityId: newResidence.cityId || '',
            cityNameAr: newResidence.cityNameAr || '',
            cityNameEn: newResidence.cityNameEn || '',
            areaId: newResidence.areaId || '',
            areaNameAr: newResidence.areaNameAr || '',
            areaNameEn: newResidence.areaNameEn || '',
            customAreaName: newResidence.customAreaName || null,
            source: 'staff_override',
            recordedAt: new Date().toISOString()
          } : null,
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
      setIsAddOpen(false)
      setNewName('')
      setNewPhone('')
      setNewResidence(null)
      toast.success('تمت إضافة المريض بنجاح إلى السجل')
    } catch (err) {
      toast.error('حدث خطأ أثناء إضافة المريض')
    } finally {
      setIsAdding(false)
    }
  }

  
  const handleDeleteAllPatients = async () => {
    if (!confirm('هل أنت متأكد من حذف جميع المرضى من السجل بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.')) return
    if (!confirm('تأكيد أخير: سيتم مسح جميع سجلات المرضى والروشتات وحسابات المرضى والزيارات بالكامل. هل تريد المتابعة؟')) return

    try {
      const targetClinicIds = Array.from(new Set([clinicId, slug].filter(Boolean) as string[]))

      for (const cId of targetClinicIds) {
        // 1. Delete all appointments
        const apptSnap = await getDocs(query(collection(db, 'appointments'), where('clinic_id', '==', cId)))
        for (const docSnap of apptSnap.docs) {
          await deleteDoc(doc(db, 'appointments', docSnap.id))
        }

        // 2. Delete all prescriptions
        const rxSnap = await getDocs(query(collection(db, 'prescriptions'), where('clinic_id', '==', cId)))
        for (const docSnap of rxSnap.docs) {
          await deleteDoc(doc(db, 'prescriptions', docSnap.id))
        }

        // 3. Delete all patient accounts
        const paSnap = await getDocs(query(collection(db, 'patient_accounts'), where('clinic_id', '==', cId)))
        for (const docSnap of paSnap.docs) {
          await deleteDoc(doc(db, 'patient_accounts', docSnap.id))
        }

        // 4. Delete patient notifications
        const notifSnap = await getDocs(query(
          collection(db, 'notifications'),
          where('clinicId', '==', cId),
          where('recipientType', '==', 'patient')
        ))
        for (const docSnap of notifSnap.docs) {
          await deleteDoc(doc(db, 'notifications', docSnap.id))
        }
      }

      setRawAppointments([])
      toast.success('تم مسح جميع المرضى وسجلات الروشتات والحسابات والزيارات بنجاح')
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء المسح')
    }
  }

  const handleDeletePatient = async (phone: string, name: string) => {
    if (!confirm(`هل أنت متأكد من حذف المريض ${name} وجميع زياراته وروشتاته وحسابه نهائياً؟`)) return
    try {
      const targetClinicIds = Array.from(new Set([clinicId, slug].filter(Boolean) as string[]))
      const phoneVariants = getPhoneSearchVariants(phone)
      const searchPhones = phoneVariants.length > 0 ? phoneVariants.slice(0, 10) : [phone]

      for (const cId of targetClinicIds) {
        // 1. Delete patient appointments
        const apptSnap = await getDocs(query(
          collection(db, 'appointments'),
          where('clinic_id', '==', cId),
          where('phone', 'in', searchPhones)
        ))
        for (const docSnap of apptSnap.docs) {
          await deleteDoc(doc(db, 'appointments', docSnap.id))
        }

        // 2. Delete patient prescriptions
        const rxSnap = await getDocs(query(
          collection(db, 'prescriptions'),
          where('clinic_id', '==', cId),
          where('patientPhone', 'in', searchPhones)
        ))
        for (const docSnap of rxSnap.docs) {
          await deleteDoc(doc(db, 'prescriptions', docSnap.id))
        }

        // 3. Delete patient account
        const paSnap = await getDocs(query(
          collection(db, 'patient_accounts'),
          where('clinic_id', '==', cId),
          where('phone', 'in', searchPhones)
        ))
        for (const docSnap of paSnap.docs) {
          await deleteDoc(doc(db, 'patient_accounts', docSnap.id))
        }

        // 4. Delete patient notifications
        for (const p of searchPhones) {
          const notifSnap = await getDocs(query(
            collection(db, 'notifications'),
            where('clinicId', '==', cId),
            where('recipientTarget', '==', p)
          ))
          for (const docSnap of notifSnap.docs) {
            await deleteDoc(doc(db, 'notifications', docSnap.id))
          }
        }
      }

      setRawAppointments((prev: any[]) => prev.filter((a: any) => a.phone !== phone))
      toast.success(`تم حذف المريض ${name} وكافة سجلاته بنجاح`)
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  const sendWhatsApp = (phone: string, name: string) => {
    if (!phone) return
    openManualWhatsAppChat({
      phone,
      message: `مرحباً ${name}،\nنتمنى لك دوام الصحة والعافية من ${clinic?.clinicName || 'عيادتنا'}.`
    })
  }

  // Export Patients List to Excel
  const handleExportExcel = async () => {
    if (filtered.length === 0) return toast.info('لا يوجد مرضى لتصديرهم في النطاق المحدد')
    await exportPatientsToExcel(filtered, clinic?.clinicName || 'العيادة', { fromDate, toDate })
    toast.success('تم تصدير سجل المرضى إلى إكسيل بنجاح')
  }

  // Print Isolated A4 Patients Report
  const handlePrintPatientsReport = () => {
    if (filtered.length === 0) {
      return toast.info('لا يوجد مرضى لتصديرهم في النطاق المحدد')
    }
    const effectiveFrom = fromDate || (filtered.length > 0 ? filtered[filtered.length - 1].lastVisit : todayCairoStr)
    const effectiveTo = toDate || todayCairoStr
    const totalVisits = filtered.reduce((s, p) => s + (Number(p.visitsCount) || 1), 0)

    const html = generatePatientsReportHtml({
      clinicName: clinic?.clinicName || 'Yalla Clinic',
      doctorName: clinic?.doctorName,
      branchLabel: 'جميع الفروع',
      clinicAddress: clinic?.clinicAddress,
      clinicPhone: clinic?.clinicPhone,
      logoUrl: clinic?.logoUrl,
      fromDate: effectiveFrom,
      toDate: effectiveTo,
      generatedAtCairo: new Intl.DateTimeFormat('ar-EG', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Africa/Cairo'
      }).format(new Date()),
      generatedBy: clinic?.doctorName || 'إدارة العيادة',
      totalPatients: filtered.length,
      totalVisits: totalVisits,
      patients: filtered.map(p => ({
        name: p.name,
        phone: p.phone,
        age: p.age,
        visitsCount: Number(p.visitsCount) || 1,
        lastVisit: p.lastVisit,
        lastService: p.lastService || 'كشف',
        status: p.status || 'نشط'
      }))
    })
    printHtmlViaIframe(html, 'a4')
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* 1. Header with Title and Add Patient CTA */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <User className="w-6 h-6 text-primary" />
            {t('nav_patients', 'سجل المرضى')}
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            {t('patients_management_desc', 'إدارة السجلات الطبية، ملفات المرضى، وتصدير السجل بالتاريخ (PDF & Excel)')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Excel Export */}
          <Button
            variant="outline"
            onClick={handleExportExcel}
            className="h-10 px-4 border-border text-foreground hover:bg-secondary font-bold rounded-xl text-xs inline-flex items-center cursor-pointer"
          >
            <FileSpreadsheet className="w-4 h-4 ml-1.5 text-emerald-500" />
            {t('export_excel', 'تصدير المرضى (Excel)')}
          </Button>

          {/* PDF Report Export */}
          <Button
            variant="outline"
            onClick={handlePrintPatientsReport}
            className="h-10 px-4 border-border text-foreground hover:bg-secondary font-bold rounded-xl text-xs inline-flex items-center cursor-pointer"
          >
            <Printer className="w-4 h-4 ml-1.5 text-primary" />
            {t('print_patients_report', 'طباعة تقرير المرضى (PDF / A4)')}
          </Button>

          <Button 
            variant="destructive"
            onClick={handleDeleteAllPatients}
            className="h-10 px-4 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-bold rounded-xl transition-all text-xs inline-flex items-center justify-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4 ml-1.5" />
            {t('clear_all_patients', 'مسح جميع المرضى')}
          </Button>
          
          {/* Add Patient Modal */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger className="h-10 px-4 yalla-gradient-btn text-white font-bold rounded-xl shadow-md transition-all text-xs inline-flex items-center justify-center cursor-pointer">
              <Plus className="w-4 h-4 ml-1.5" />
              {t('new_patient_file', 'إضافة مريض جديد +')}
            </DialogTrigger>
            <DialogContent className="sm:max-w-md bg-card border border-border" dir={dir}>
              <DialogHeader>
                <DialogTitle className="text-lg font-bold text-foreground">
                  {t('new_patient_title', 'إضافة مريض جديد للسجل')}
                </DialogTitle>
              </DialogHeader>
              <form onSubmit={handleAddNewPatient} className="space-y-4 pt-2">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    {t('patient_full_name', 'اسم المريض الثلاثي')}
                  </Label>
                  <Input
                    value={newName}
                    onChange={e => setNewName(e.target.value)}
                    placeholder={t('patient_name_placeholder', 'مثال: محمد أحمد علي')}
                    className="h-10 text-sm rounded-xl bg-background border-border text-foreground"
                    required
                  />
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-muted-foreground">
                    {t('patient_phone_whatsapp', 'رقم الهاتف (واتساب)')}
                  </Label>
                  <PhoneInputWithCountry
                    value={newPhone}
                    onChange={(fullNumber, country, localNum) => {
                      setNewPhone(fullNumber)
                      setNewCountry(country)
                      const valid = validatePhoneNumber(fullNumber, country)
                      if (valid) {
                        setNewPhoneError(false)
                      } else if (localNum.length >= (country.minLength || 9)) {
                        setNewPhoneError(true)
                      } else {
                        setNewPhoneError(false)
                      }
                    }}
                    hasError={newPhoneError}
                    size="sm"
                  />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {t('dob', 'تاريخ الميلاد')}
                    </Label>
                    <Input
                      type="date"
                      value={newDob}
                      onChange={e => handleDobChange(e.target.value)}
                      className="h-10 text-sm rounded-xl bg-background border-border text-foreground"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {t('patient_age', 'العمر')}
                    </Label>
                    <Input
                      type="number"
                      value={newAge}
                      onChange={e => handleAgeChange(e.target.value)}
                      placeholder="25"
                      className="h-10 text-sm rounded-xl bg-background border-border text-foreground"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {t('service_type', 'نوع الخدمة')}
                    </Label>
                    <select
                      value={newService}
                      onChange={e => setNewService(e.target.value)}
                      className="w-full h-10 px-3 rounded-xl border border-border text-xs font-bold text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
                    >
                      <option value="كشف عادي">{t('regular_exam', 'كشف عادي')}</option>
                      <option value="استشارة">{t('consultation', 'استشارة')}</option>
                      <option value="كشف مستعجل">{t('urgent_exam', 'كشف مستعجل')}</option>
                      <option value="متابعة">{t('follow_up', 'متابعة')}</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-bold text-muted-foreground">
                      {t('value_amount', 'القيمة')} ({t('currency_egp', 'ج.م')})
                    </Label>
                    <Input
                      type="number"
                      value={newPrice}
                      onChange={e => setNewPrice(Number(e.target.value))}
                      className="h-10 text-sm rounded-xl bg-background border-border text-foreground"
                    />
                  </div>
                </div>

                {/* Residential Area Selector */}
                <div className="pt-2 border-t border-border">
                  <ResidentialAreaSelector
                    value={newResidence}
                    onChange={setNewResidence}
                    showLocationButton={false}
                    compact={true}
                    defaultSource="staff_override"
                  />
                </div>

                <div className="pt-3 flex gap-2">
                  <Button
                    type="submit"
                    disabled={isAdding}
                    className="flex-1 yalla-gradient-btn text-white font-bold h-10 rounded-xl text-xs"
                  >
                    {isAdding ? t('saving', 'جاري الحفظ...') : t('save_patient', 'حفظ المريض')}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setIsAddOpen(false)}
                    className="h-10 text-xs font-bold rounded-xl border-border"
                  >
                    {t('cancel', 'إلغاء')}
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Date Range Filter Bar */}
      <div className="yalla-card p-4 space-y-3 border border-border">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-foreground">
            <Calendar className="w-4 h-4 text-primary" />
            <span>{t('filter_by_date_range', 'فرز سجل المرضى بالتاريخ (من / إلى):')}</span>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => setDatePreset('all')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                !fromDate && !toDate ? 'yalla-gradient-btn text-white shadow-xs' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {t('all_filter', 'الكل')}
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('today')}
              className={`px-3 py-1 text-xs font-bold rounded-lg transition-colors cursor-pointer ${
                fromDate === todayCairoStr && toDate === todayCairoStr ? 'yalla-gradient-btn text-white shadow-xs' : 'bg-secondary text-foreground hover:bg-secondary/80'
              }`}
            >
              {t('today_filter', 'اليوم')}
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('week')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              {t('last_7_days', 'آخر 7 أيام')}
            </button>
            <button
              type="button"
              onClick={() => setDatePreset('month')}
              className="px-3 py-1 text-xs font-bold rounded-lg bg-secondary text-foreground hover:bg-secondary/80 transition-colors cursor-pointer"
            >
              {t('this_month', 'هذا الشهر')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 pt-2 border-t border-border items-center">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground shrink-0">{t('from_date', 'من تاريخ:')}</span>
            <Input
              type="date"
              value={fromDate}
              onChange={e => { setFromDate(e.target.value); setCurrentPage(1); }}
              className="h-9 text-xs bg-background border-border text-foreground rounded-xl font-mono"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-muted-foreground shrink-0">{t('to_date', 'إلى تاريخ:')}</span>
            <Input
              type="date"
              value={toDate}
              onChange={e => { setToDate(e.target.value); setCurrentPage(1); }}
              className="h-9 text-xs bg-background border-border text-foreground rounded-xl font-mono"
            />
          </div>

          {(fromDate || toDate) && (
            <div className="sm:col-span-2 flex items-center justify-end gap-2">
              <span className="text-xs text-primary font-semibold bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                {t('filtered_label', 'مفلتر')}: {fromDate || t('all_filter', 'البداية')} ⬅ {toDate || t('today_filter', 'اليوم')} ({filtered.length} {t('patients_unit', 'مريض')})
              </span>
              <button
                type="button"
                onClick={() => { setFromDate(''); setToDate(''); setCurrentPage(1); }}
                className="h-9 px-3 text-xs font-bold text-rose-600 dark:text-rose-400 bg-rose-500/10 hover:bg-rose-500/20 rounded-xl transition-colors flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                {t('clear_filter', 'إلغاء الفرز')}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 2. Search & Filters Bar */}
      <div className="yalla-card p-4 flex flex-col sm:flex-row items-center justify-between gap-3 border border-border">
        <div className="relative w-full sm:w-96">
          <Search className={`w-4 h-4 absolute ${isRtl ? 'right-3.5' : 'left-3.5'} top-1/2 -translate-y-1/2 text-muted-foreground`} />
          <Input
            value={search}
            onChange={e => { setSearch(e.target.value); setCurrentPage(1); }}
            placeholder={t('search_patient_placeholder', 'ابحث بالاسم أو رقم الهاتف...')}
            className={`${isRtl ? 'pr-10' : 'pl-10'} h-10 text-sm bg-background border-border text-foreground rounded-xl`}
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto flex-wrap">
          {/* Residence Filter */}
          <select
            value={residenceFilter}
            onChange={e => { setResidenceFilter(e.target.value as any); setCurrentPage(1); }}
            className="h-10 px-3 rounded-xl border border-border text-xs font-bold text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">كل مناطق السكن</option>
            <option value="INCOMPLETE">⚠️ منطقة السكن غير مكتملة</option>
            <option value="COMPLETED">✅ منطقة السكن مكتملة</option>
          </select>

          <select
            value={statusFilter}
            onChange={e => { setStatusFilter(e.target.value); setCurrentPage(1); }}
            className="h-10 px-4 rounded-xl border border-border text-xs font-bold text-foreground bg-background focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="ALL">{t('all_statuses', 'كل الحالات')}</option>
            <option value="نشط">{t('active', 'نشط')}</option>
            <option value="مستعجل">{t('urgent', 'مستعجل')}</option>
            <option value="خامل">{t('inactive', 'خامل')}</option>
          </select>
        </div>
      </div>

      {/* 3. Patients Data Table */}
      <div className="yalla-card overflow-hidden border border-border">
        <div className="overflow-x-auto">
          <table className={`w-full ${isRtl ? 'text-right' : 'text-left'} text-sm`}>
            <thead className="bg-secondary/60 border-b border-border text-muted-foreground text-xs font-bold select-none">
              <tr>
                <th className="py-3.5 px-4">{t('patient_col', 'المريض')}</th>
                <th className="py-3.5 px-4">{t('phone_col', 'رقم الهاتف')}</th>
                <th className="py-3.5 px-4 text-center">{t('visits_col', 'عدد الزيارات')}</th>
                <th className="py-3.5 px-4">{t('last_visit_col', 'آخر زيارة')}</th>
                <th className="py-3.5 px-4">{t('last_service_col', 'آخر خدمة')}</th>
                <th className="py-3.5 px-4 text-center">{t('status_col', 'الحالة')}</th>
                <th className="py-3.5 px-4 text-center">{t('action_col', 'إجراء')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {loading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    <div className="w-7 h-7 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-2"></div>
                    {t('loading_patients', 'جاري تحميل سجل المرضى...')}
                  </td>
                </tr>
              ) : paginatedPatients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-muted-foreground">
                    {t('no_matching_patients', 'لا يوجد مرضى مطابقين للبحث.')}
                  </td>
                </tr>
              ) : (
                paginatedPatients.map((patient) => {
                  return (
                    <tr key={patient.id} className="hover:bg-secondary/40 transition-colors group">
                      {/* Name & Avatar */}
                      <td className="py-3.5 px-4">
                        <Link href={`/clinic/${slug}/admin/patients/${encodeURIComponent(patient.phone)}`}>
                          <div className="flex items-center gap-3 cursor-pointer">
                            <Avatar className="w-9 h-9 border border-primary/20 bg-primary/10 text-primary shrink-0">
                              <AvatarFallback className="font-bold text-xs bg-primary/10 text-primary">
                                {patient.name.charAt(0)}
                              </AvatarFallback>
                            </Avatar>
                            <div>
                              <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                                {patient.name}
                              </p>
                              <span className="text-[10px] text-muted-foreground font-mono sm:hidden">
                                {patient.phone}
                              </span>
                              <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                                {patient.hasResidence ? (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setEditingPatientResidence(patient)
                                      setEditResidenceValue(patient.residence)
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-sky-600 dark:text-sky-400 bg-sky-500/10 hover:bg-sky-500/20 px-2 py-0.5 rounded-md border border-sky-500/20 cursor-pointer"
                                    title="تعديل منطقة السكن"
                                  >
                                    <MapPin className="w-3 h-3 shrink-0" />
                                    <span>{patient.residence.governorateNameAr} - {patient.residence.areaNameAr || patient.residence.cityNameAr}</span>
                                  </button>
                                ) : (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.preventDefault()
                                      e.stopPropagation()
                                      setEditingPatientResidence(patient)
                                      setEditResidenceValue(null)
                                    }}
                                    className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-700 dark:text-amber-400 bg-amber-500/10 hover:bg-amber-500/20 px-2 py-0.5 rounded-md border border-amber-500/30 cursor-pointer"
                                    title="استكمال منطقة السكن"
                                  >
                                    <AlertCircle className="w-3 h-3 shrink-0" />
                                    <span>منطقة السكن غير مكتملة</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          </div>
                        </Link>
                      </td>

                      {/* Phone */}
                      <td className="py-3.5 px-4 font-mono text-xs text-muted-foreground">
                        {patient.phone}
                      </td>

                      {/* Visits Count */}
                      <td className="py-3.5 px-4 text-center">
                        <span className="inline-block px-2.5 py-0.5 rounded-full bg-secondary font-black text-xs text-foreground">
                          {patient.visitsCount}
                        </span>
                      </td>

                      {/* Last Visit */}
                      <td className="py-3.5 px-4 text-xs text-muted-foreground font-mono">
                        {patient.lastVisit}
                      </td>

                      {/* Last Service */}
                      <td className="py-3.5 px-4">
                        <span className="inline-block text-[11px] font-semibold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20">
                          {tDynamic(patient.lastService)}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="py-3.5 px-4 text-center">
                        <Badge
                          className={`text-[10px] font-bold px-2.5 py-0.5 border-none ${
                            patient.status === 'مستعجل'
                              ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                              : patient.status === 'خامل'
                              ? 'bg-secondary text-muted-foreground'
                              : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          }`}
                        >
                          {tDynamic(patient.status || 'نشط')}
                        </Badge>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 text-center">
                        <div className="flex items-center justify-center gap-1.5">
                          <Link href={`/clinic/${slug}/admin/patients/${encodeURIComponent(patient.phone)}`}>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 px-3 text-xs font-bold text-primary border-border hover:bg-primary/10 rounded-xl"
                            >
                              {t('patient_profile_btn', 'ملف المريض')}
                            </Button>
                          </Link>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 rounded-xl"
                            onClick={() => sendWhatsApp(patient.phone, patient.name)}
                            title={t('whatsapp_chat', 'مراسلة عبر واتساب')}
                          >
                            <MessageCircle className="w-4 h-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-rose-500 hover:bg-rose-500/10 rounded-xl transition-colors"
                            onClick={() => handleDeletePatient(patient.phone, patient.name)}
                            title={t('delete_patient', 'حذف المريض')}
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

        {/* 4. Table Pagination Footer */}
        <div className="p-4 border-t border-border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground bg-secondary/30">
          <div>
            {t('showing_count', 'عرض')} {paginatedPatients.length} {t('out_of', 'من أصل')} {filtered.length} {t('patients_unit', 'مريض')}
          </div>

          <div className="flex items-center gap-1.5">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="h-8 px-3 text-xs font-bold rounded-xl border-border"
            >
              {t('previous', 'السابق')}
            </Button>

            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                size="sm"
                variant={currentPage === page ? 'default' : 'outline'}
                onClick={() => setCurrentPage(page)}
                className={`h-8 w-8 text-xs font-bold rounded-xl ${
                  currentPage === page ? 'yalla-gradient-btn text-white' : 'border-border'
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
              className="h-8 px-3 text-xs font-bold rounded-xl border-border"
            >
              {t('next', 'التالي')}
            </Button>
          </div>
        </div>
      </div>

      {/* Quick Modal: Complete / Edit Patient Residence */}
      <Dialog open={editingPatientResidence !== null} onOpenChange={(open) => { if (!open) setEditingPatientResidence(null); }}>
        <DialogContent className="sm:max-w-lg bg-card border border-border" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <MapPin className="w-5 h-5 text-primary" />
              <span>استكمال وتعديل منطقة السكن للمريض</span>
            </DialogTitle>
          </DialogHeader>

          {editingPatientResidence && (
            <div className="space-y-4 pt-2">
              <div className="p-3 rounded-2xl bg-secondary/40 border border-border/80 text-xs">
                <p className="font-bold text-foreground">{editingPatientResidence.name}</p>
                <p className="text-muted-foreground font-mono mt-0.5" dir="ltr">{editingPatientResidence.phone}</p>
              </div>

              <ResidentialAreaSelector
                value={editResidenceValue}
                onChange={setEditResidenceValue}
                showLocationButton={false}
                compact={false}
                defaultSource="staff_override"
              />

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingPatientResidence(null)}
                  className="rounded-xl"
                >
                  إلغاء
                </Button>
                <Button
                  type="button"
                  onClick={handleSavePatientResidence}
                  disabled={isSavingResidence}
                  className="yalla-gradient-btn text-white rounded-xl"
                >
                  {isSavingResidence ? 'جاري الحفظ...' : 'حفظ منطقة السكن'}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

    </div>
  )
}
