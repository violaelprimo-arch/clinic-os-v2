'use client'

import { ResidentialAreaSelector, ResidentialAreaValue } from '@/components/common/ResidentialAreaSelector'
import { use, useEffect, useState, useMemo, useRef } from 'react'
import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  updateDoc,
  doc,
  onSnapshot
} from 'firebase/firestore'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Clock, Phone, ArrowRight, User, Calendar, Pill, DollarSign, Printer,
  Activity, ChevronDown, ChevronUp, Stethoscope, CheckCircle, Save,
  MessageCircle, FileText, Download, MapPin, AlertTriangle, ShieldAlert,
  HeartPulse, Plus, X, Eye, Trash2, Upload, Camera, Edit2, Search,
  Filter, Share2, Sparkles, FileCheck, ExternalLink, CalendarClock,
  CreditCard, CheckCircle2, FolderOpen, AlertCircle, FileX, Paperclip,
  Check, Play
} from 'lucide-react'
import Link from 'next/link'
import { toast } from 'sonner'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { downloadElementAsPdf, renderElementToPdfBlob, renderElementToImageBlob } from '@/lib/pdfGenerator'
import { printHtmlViaIframe, generateA4PrescriptionHtml } from '@/lib/printService'
import {
  sharePdfDocument,
  generateCleanRxFileName,
  formatPrescriptionWhatsAppMessage,
  openManualWhatsAppChat,
  getSavedWhatsAppTarget
} from '@/lib/whatsappShare'
import { WhatsAppShareButton } from '@/components/common/WhatsAppShareButton'
import { useLanguage } from '@/context/LanguageContext'

// Common Drug Allergies & Chronic Conditions presets
const COMMON_ALLERGIES = ['بنسلين (Penicillin)', 'سلفا (Sulfa)', 'أسبرين (Aspirin)', 'مضادات الالتهاب (NSAIDs)', 'صبغات الأشعة (Contrast Dye)']
const COMMON_CHRONIC = ['ارتفاع ضغط الدم (Hypertension)', 'السكري النوع الثاني (Type 2 Diabetes)', 'حساسية الصدر والربو (Asthma)', 'أمراض القلب (Heart Disease)', 'قصور الكلى (Renal Disease)', 'خمول الغدة الدرقية (Hypothyroidism)']

export default function PatientProfilePage({
  params
}: {
  params: Promise<{ slug: string; patientId: string }>
}) {
  const resolvedParams = use(params)
  const { slug, patientId } = resolvedParams
  const { t, dir, isRtl } = useLanguage()

  const rawId = decodeURIComponent(patientId).trim()

  // Clinic & Patient State
  const [clinic, setClinic] = useState<any>(null)
  const [appointments, setAppointments] = useState<any[]>([])
  const [patientData, setPatientData] = useState<any>({
    name: 'جاري التحميل...',
    phone: rawId,
    age: '',
    dob: '',
    gender: 'unspecified',
    callNamePronunciation: '',
    photoUrl: '',
    notes: '',
    allergies: [] as string[],
    chronicDiseases: [] as string[],
    ongoingMedications: [] as any[],
    attachments: [] as any[],
    residence: null as ResidentialAreaValue | null,
    patientCode: ''
  })
  const [loading, setLoading] = useState(true)

  // Visit expansion & filtering
  const [expandedVisitId, setExpandedVisitId] = useState<string | null>(null)
  const [visitSearchQuery, setVisitSearchQuery] = useState('')
  const [visitPeriodFilter, setVisitPeriodFilter] = useState<'all' | 'month' | 'six_months' | 'year'>('all')

  // Edit Patient Info Modal
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false)
  const [editName, setEditName] = useState('')
  const [editPhone, setEditPhone] = useState('')
  const [editDob, setEditDob] = useState('')
  const [editAge, setEditAge] = useState('')
  const [editGender, setEditGender] = useState<'male' | 'female' | 'unspecified'>('unspecified')
  const [editPronunciation, setEditPronunciation] = useState('')
  const [editResidence, setEditResidence] = useState<ResidentialAreaValue | null>(null)
  const [isSavingProfile, setIsSavingProfile] = useState(false)

  // Edit Allergies & Chronic Conditions Modal
  const [isEditAllergiesOpen, setIsEditAllergiesOpen] = useState(false)
  const [tempAllergies, setTempAllergies] = useState<string[]>([])
  const [newAllergyInput, setNewAllergyInput] = useState('')
  const [noKnownAllergies, setNoKnownAllergies] = useState(false)
  const [tempChronic, setTempChronic] = useState<string[]>([])
  const [newChronicInput, setNewChronicInput] = useState('')
  const [noKnownChronic, setNoKnownChronic] = useState(false)
  const [isSavingMedicalTags, setIsSavingMedicalTags] = useState(false)

  // Record Quick Vitals Modal
  const [isVitalsModalOpen, setIsVitalsModalOpen] = useState(false)
  const [targetVitalsApptId, setTargetVitalsApptId] = useState<string | null>(null)
  const [vitalsBpSys, setVitalsBpSys] = useState('')
  const [vitalsBpDia, setVitalsBpDia] = useState('')
  const [vitalsPulse, setVitalsPulse] = useState('')
  const [vitalsTemp, setVitalsTemp] = useState('')
  const [vitalsGlucose, setVitalsGlucose] = useState('')
  const [vitalsWeight, setVitalsWeight] = useState('')
  const [vitalsHeight, setVitalsHeight] = useState('')
  const [isSavingVitals, setIsSavingVitals] = useState(false)

  // Add Ongoing Medication Modal
  const [isAddMedOpen, setIsAddMedOpen] = useState(false)
  const [newMedName, setNewMedName] = useState('')
  const [newMedDose, setNewMedDose] = useState('')
  const [newMedFrequency, setNewMedFrequency] = useState('')
  const [newMedNotes, setNewMedNotes] = useState('')
  const [isSavingMed, setIsSavingMed] = useState(false)

  // Attachments Modal & Lightbox
  const [isAddAttachmentOpen, setIsAddAttachmentOpen] = useState(false)
  const [attachmentTitle, setAttachmentTitle] = useState('')
  const [attachmentCategory, setAttachmentCategory] = useState<'تحاليل' | 'أشعة' | 'تقرير طبي' | 'أخرى'>('تحاليل')
  const [attachmentFile, setAttachmentFile] = useState<{ name: string; type: string; size: number; dataUrl: string } | null>(null)
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false)
  const [previewAttachment, setPreviewAttachment] = useState<any | null>(null)

  // Patient Notes Modal
  const [isEditNotesOpen, setIsEditNotesOpen] = useState(false)
  const [tempNotes, setTempNotes] = useState('')
  const [isSavingNotes, setIsSavingNotes] = useState(false)

  // Prescription View / Print / WhatsApp state
  const [sharingApptId, setSharingApptId] = useState<string | null>(null)
  const [downloadingApptId, setDownloadingApptId] = useState<string | null>(null)
  const [activeRxModalAppt, setActiveRxModalAppt] = useState<any | null>(null)

  // Inline Diagnosis editing
  const [editingDiagnosisFor, setEditingDiagnosisFor] = useState<string | null>(null)
  const [tempDiagnosis, setTempDiagnosis] = useState('')

  // Photo Upload Ref
  const photoInputRef = useRef<HTMLInputElement>(null)
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false)

  // Deterministic or stored Patient File Code (e.g. ملف P-00481)
  const patientFileCode = useMemo(() => {
    if (patientData?.patientCode) return patientData.patientCode
    const raw = patientData?.phone || rawId
    const digits = raw.replace(/\D/g, '')
    const hash = digits.split('').reduce((acc: number, c: string) => (acc * 33 + c.charCodeAt(0)) % 99999, 13)
    return `P-${String(hash || 481).padStart(5, '0')}`
  }, [patientData?.patientCode, patientData?.phone, rawId])

  // Real-time Data Loading
  useEffect(() => {
    let unsubAppts: any = null

    const init = async () => {
      try {
        // 1. Fetch Clinic
        const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
        const cSnap = await getDocs(qClinic)
        if (!cSnap.empty) {
          setClinic({ id: cSnap.docs[0].id, ...cSnap.docs[0].data() })
        }

        // 2. Resolve Patient Identity:
        // Try query by phone first
        let targetPhone = rawId

        // If rawId does not look like a phone (e.g. no digits or short ID), check if doc exists
        const isLikelyPhone = /^\+?[0-9]{7,15}$/.test(rawId.replace(/[\s-]/g, ''))
        if (!isLikelyPhone) {
          try {
            const docRef = doc(db, 'appointments', rawId)
            const docSnap = await getDoc(docRef)
            if (docSnap.exists() && docSnap.data().phone) {
              targetPhone = docSnap.data().phone
            }
          } catch (e) {}
        }

        // Listen to all appointments for this phone
        const qAppt = query(collection(db, 'appointments'), where('phone', '==', targetPhone))
        unsubAppts = onSnapshot(qAppt, (snap) => {
          if (!snap.empty) {
            const list = snap.docs
              .map(d => ({ id: d.id, ...d.data() } as any))
              .sort((a: any, b: any) => new Date(b.date || b.createdAt || 0).getTime() - new Date(a.date || a.createdAt || 0).getTime())
            setAppointments(list)

            const latest = list[0]

            // Aggregate allergies, chronic diseases, ongoing meds, and attachments across appointments
            const allergies = latest.patientAllergies || latest.allergies || []
            const chronic = latest.patientChronicDiseases || latest.chronicDiseases || []
            const ongoingMeds = latest.ongoingMedications || []
            const attachments = latest.attachments || []

            setPatientData({
              name: latest.patientName || 'مريض بدون اسم',
              phone: latest.phone || targetPhone,
              age: latest.age || '',
              dob: latest.dob || '',
              gender: latest.gender || latest.patientGender || 'unspecified',
              callNamePronunciation: latest.callNamePronunciation || '',
              photoUrl: latest.patientPhotoUrl || latest.photoUrl || '',
              notes: latest.patientNotes || latest.adminNotes || '',
              allergies: Array.isArray(allergies) ? allergies : [],
              chronicDiseases: Array.isArray(chronic) ? chronic : [],
              ongoingMedications: Array.isArray(ongoingMeds) ? ongoingMeds : [],
              attachments: Array.isArray(attachments) ? attachments : [],
              residence: latest.patientResidenceSnapshot || latest.residence || null,
              patientCode: latest.patientCode || latest.fileNumber || ''
            })
          } else {
            setAppointments([])
            setPatientData({
              name: 'سجل جديد',
              phone: targetPhone,
              age: '',
              dob: '',
              gender: 'unspecified',
              callNamePronunciation: '',
              photoUrl: '',
              notes: '',
              allergies: [],
              chronicDiseases: [],
              ongoingMedications: [],
              attachments: [],
              residence: null,
              patientCode: ''
            })
          }
          setLoading(false)
        })
      } catch (err) {
        console.error('Error loading patient profile:', err)
        setLoading(false)
      }
    }

    init()
    return () => {
      if (unsubAppts) unsubAppts()
    }
  }, [slug, rawId])

  // Latest Vitals across all appointments
  const latestVitals = useMemo(() => {
    for (const appt of appointments) {
      if (appt.vitalSigns && Object.keys(appt.vitalSigns).length > 0) {
        const vs = appt.vitalSigns
        if (vs.bloodPressureSystolic || vs.bloodPressureDiastolic || vs.heartRate || vs.weightKg || vs.heightCm || vs.temperature || vs.glucoseLevel) {
          return {
            ...vs,
            apptId: appt.id,
            visitDate: appt.date
          }
        }
      }
    }
    return null
  }, [appointments])

  // Next Upcoming Follow-up Appointment
  const nextFollowUpAppt = useMemo(() => {
    const todayStr = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(new Date())
    const upcoming = appointments.filter(a => {
      if (!a.date) return false
      return a.date >= todayStr && a.status !== 'completed' && a.status !== 'cancelled'
    }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
    return upcoming[0] || null
  }, [appointments])

  // Financial Accounts Summary
  const financialSummary = useMemo(() => {
    let totalFees = 0
    let totalPaid = 0
    appointments.forEach(a => {
      const price = Number(a.servicePrice) || 0
      totalFees += price
      if (a.paymentStatus === 'paid') {
        totalPaid += price
      }
    })
    return {
      totalFees,
      totalPaid,
      remaining: Math.max(0, totalFees - totalPaid)
    }
  }, [appointments])

  // Filtered Visits
  const filteredAppointments = useMemo(() => {
    let list = [...appointments]
    if (visitSearchQuery.trim()) {
      const q = visitSearchQuery.trim().toLowerCase()
      list = list.filter(a =>
        (a.diagnosis && a.diagnosis.toLowerCase().includes(q)) ||
        (a.serviceName && a.serviceName.toLowerCase().includes(q)) ||
        (a.notes && a.notes.toLowerCase().includes(q)) ||
        (a.drugs && a.drugs.some((d: any) => (d.tradeName || d.name || '').toLowerCase().includes(q)))
      )
    }
    if (visitPeriodFilter !== 'all') {
      const now = new Date()
      const days = visitPeriodFilter === 'month' ? 30 : visitPeriodFilter === 'six_months' ? 180 : 365
      const cutoff = new Date(now.getTime() - days * 24 * 60 * 60 * 1000)
      list = list.filter(a => new Date(a.date || a.createdAt || 0) >= cutoff)
    }
    return list
  }, [appointments, visitSearchQuery, visitPeriodFilter])

  // Format Age Helper (support child months & adult years)
  const formattedAge = useMemo(() => {
    if (patientData.dob) {
      const birth = new Date(patientData.dob)
      if (!isNaN(birth.getTime())) {
        const now = new Date()
        const totalMonths = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth())
        if (totalMonths >= 0 && totalMonths < 24) {
          if (totalMonths === 0) return 'أقل من شهر'
          if (totalMonths === 1) return 'شهر واحد'
          if (totalMonths === 2) return 'شهران'
          if (totalMonths <= 10) return `${totalMonths} أشهر`
          return `${totalMonths} شهراً`
        }
        const years = Math.floor(totalMonths / 12)
        const remMonths = totalMonths % 12
        if (years > 0) {
          return remMonths === 0 ? `${years} سنة` : `${years} سنة و${remMonths} شهر`
        }
      }
    }
    if (patientData.age) {
      const num = Number(patientData.age)
      return !isNaN(num) ? `${num} سنة` : String(patientData.age)
    }
    return 'غير مسجّل'
  }, [patientData.age, patientData.dob])

  // Format Gender Helper
  const formattedGender = useMemo(() => {
    const g = String(patientData.gender || '').trim().toLowerCase()
    if (g === 'male' || g === 'ذكر') return 'ذكر'
    if (g === 'female' || g === 'أنثى' || g === 'انثى') return 'أنثى'
    return 'غير مسجّل'
  }, [patientData.gender])

  // Save Basic Profile Edits
  const handleOpenEditProfile = () => {
    setEditName(patientData.name || '')
    setEditPhone(patientData.phone || '')
    setEditDob(patientData.dob || '')
    setEditAge(patientData.age ? String(patientData.age) : '')
    setEditGender(patientData.gender || 'unspecified')
    setEditPronunciation(patientData.callNamePronunciation || '')
    setEditResidence(patientData.residence)
    setIsEditProfileOpen(true)
  }

  const handleSaveProfile = async () => {
    if (!editName.trim()) {
      return toast.error('يرجى كتابة اسم المريض')
    }
    setIsSavingProfile(true)
    try {
      if (appointments.length === 0) {
        toast.info('تم تحديث البيانات مؤقتًا في الصفحة')
        setIsEditProfileOpen(false)
        return
      }

      const latestAppt = appointments[0]
      const updates: any = {
        patientName: editName.trim(),
        phone: editPhone.trim() || patientData.phone,
        gender: editGender,
        patientGender: editGender,
        dob: editDob || null,
        age: editAge ? Number(editAge) || editAge : null,
        callNamePronunciation: editPronunciation.trim() || null,
        updatedAt: new Date().toISOString()
      }

      if (editResidence) {
        updates.patientResidenceSnapshot = {
          governorateId: editResidence.governorateId || '',
          governorateNameAr: editResidence.governorateNameAr || '',
          governorateNameEn: editResidence.governorateNameEn || '',
          cityId: editResidence.cityId || '',
          cityNameAr: editResidence.cityNameAr || '',
          cityNameEn: editResidence.cityNameEn || '',
          areaId: editResidence.areaId || '',
          areaNameAr: editResidence.areaNameAr || '',
          areaNameEn: editResidence.areaNameEn || '',
          customAreaName: editResidence.customAreaName || null,
          source: 'staff_override',
          recordedAt: new Date().toISOString()
        }
      }

      await updateDoc(doc(db, 'appointments', latestAppt.id), updates)
      toast.success('تم حفظ وتحديث بيانات المريض بنجاح')
      setIsEditProfileOpen(false)
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء حفظ البيانات')
    } finally {
      setIsSavingProfile(false)
    }
  }

  // Photo Upload Handler
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Type validation
    const validTypes = ['image/jpeg', 'image/png', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return toast.error('يرجى اختيار صورة صالحة (JPEG أو PNG أو WebP)')
    }
    // Size check (max 3MB)
    if (file.size > 3 * 1024 * 1024) {
      return toast.error('حجم الصورة كبير، الحد الأقصى المسموح به هو 3 ميجابايت')
    }

    setIsUploadingPhoto(true)
    try {
      const reader = new FileReader()
      reader.onload = async () => {
        const dataUrl = reader.result as string
        if (appointments.length > 0) {
          await updateDoc(doc(db, 'appointments', appointments[0].id), {
            patientPhotoUrl: dataUrl
          })
        }
        setPatientData((prev: any) => ({ ...prev, photoUrl: dataUrl }))
        toast.success('تم تحديث صورة المريض بنجاح')
        setIsUploadingPhoto(false)
      }
      reader.onerror = () => {
        toast.error('فشل في قراءة ملف الصورة')
        setIsUploadingPhoto(false)
      }
      reader.readAsDataURL(file)
    } catch (err) {
      console.error(err)
      toast.error('حدث خطأ أثناء رفع الصورة')
      setIsUploadingPhoto(false)
    }
  }

  const handleRemovePhoto = async () => {
    if (!window.confirm('هل تريد إزالة صورة المريض الحالية؟')) return
    try {
      if (appointments.length > 0) {
        await updateDoc(doc(db, 'appointments', appointments[0].id), {
          patientPhotoUrl: null
        })
      }
      setPatientData((prev: any) => ({ ...prev, photoUrl: '' }))
      toast.success('تمت إزالة صورة المريض')
    } catch (e) {
      toast.error('حدث خطأ أثناء إزالة الصورة')
    }
  }

  // Save Allergies & Chronic Conditions
  const handleOpenEditAllergies = () => {
    setTempAllergies([...(patientData.allergies || [])])
    setNoKnownAllergies(patientData.allergies?.includes('NKDA_NO_KNOWN_ALLERGIES') || false)
    setTempChronic([...(patientData.chronicDiseases || [])])
    setNoKnownChronic(patientData.chronicDiseases?.includes('NO_KNOWN_CHRONIC_CONDITIONS') || false)
    setIsEditAllergiesOpen(true)
  }

  const handleSaveMedicalTags = async () => {
    setIsSavingMedicalTags(true)
    try {
      if (appointments.length === 0) return

      let finalAllergies = [...tempAllergies.filter(a => a !== 'NKDA_NO_KNOWN_ALLERGIES')]
      if (noKnownAllergies) {
        finalAllergies = ['NKDA_NO_KNOWN_ALLERGIES']
      }

      let finalChronic = [...tempChronic.filter(c => c !== 'NO_KNOWN_CHRONIC_CONDITIONS')]
      if (noKnownChronic) {
        finalChronic = ['NO_KNOWN_CHRONIC_CONDITIONS']
      }

      await updateDoc(doc(db, 'appointments', appointments[0].id), {
        patientAllergies: finalAllergies,
        patientChronicDiseases: finalChronic
      })

      setPatientData((prev: any) => ({
        ...prev,
        allergies: finalAllergies,
        chronicDiseases: finalChronic
      }))

      toast.success('تم حفظ سجل الحساسية والأمراض المزمنة بنجاح')
      setIsEditAllergiesOpen(false)
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ المعلومات الطبية')
    } finally {
      setIsSavingMedicalTags(false)
    }
  }

  // Quick Vitals Handler
  const handleOpenQuickVitals = (apptId?: string) => {
    const targetId = apptId || appointments[0]?.id
    if (!targetId) return toast.info('لا توجد زيارات مسجلة لحفظ القياسات')
    setTargetVitalsApptId(targetId)

    const targetAppt = appointments.find(a => a.id === targetId)
    const vs = targetAppt?.vitalSigns || latestVitals || {}
    setVitalsBpSys(vs.bloodPressureSystolic ? String(vs.bloodPressureSystolic) : '')
    setVitalsBpDia(vs.bloodPressureDiastolic ? String(vs.bloodPressureDiastolic) : '')
    setVitalsPulse(vs.heartRate ? String(vs.heartRate) : '')
    setVitalsTemp(vs.temperature ? String(vs.temperature) : '')
    setVitalsGlucose(vs.glucoseLevel ? String(vs.glucoseLevel) : '')
    setVitalsWeight(vs.weightKg ? String(vs.weightKg) : '')
    setVitalsHeight(vs.heightCm ? String(vs.heightCm) : '')
    setIsVitalsModalOpen(true)
  }

  const handleSaveQuickVitals = async () => {
    if (!targetVitalsApptId) return
    setIsSavingVitals(true)
    try {
      const hasAny = vitalsBpSys.trim() || vitalsBpDia.trim() || vitalsPulse.trim() || vitalsTemp.trim() || vitalsGlucose.trim() || vitalsWeight.trim() || vitalsHeight.trim()
      const vsData = hasAny ? {
        bloodPressureSystolic: vitalsBpSys ? Number(vitalsBpSys) || vitalsBpSys : null,
        bloodPressureDiastolic: vitalsBpDia ? Number(vitalsBpDia) || vitalsBpDia : null,
        heartRate: vitalsPulse ? Number(vitalsPulse) || vitalsPulse : null,
        temperature: vitalsTemp ? Number(vitalsTemp) || vitalsTemp : null,
        glucoseLevel: vitalsGlucose ? Number(vitalsGlucose) || vitalsGlucose : null,
        weightKg: vitalsWeight ? Number(vitalsWeight) || vitalsWeight : null,
        heightCm: vitalsHeight ? Number(vitalsHeight) || vitalsHeight : null,
        recordedAt: new Date().toISOString()
      } : null

      await updateDoc(doc(db, 'appointments', targetVitalsApptId), {
        vitalSigns: vsData
      })
      toast.success('تم حفظ وتحديث القياسات الحيوية فوراً')
      setIsVitalsModalOpen(false)
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ القياسات')
    } finally {
      setIsSavingVitals(false)
    }
  }

  // Ongoing Medications Handlers
  const handleAddOngoingMed = async () => {
    if (!newMedName.trim()) return toast.error('يرجى كتابة اسم الدواء')
    if (appointments.length === 0) return
    setIsSavingMed(true)
    try {
      const newMed = {
        id: `med_${Date.now()}`,
        name: newMedName.trim(),
        dose: newMedDose.trim(),
        frequency: newMedFrequency.trim(),
        notes: newMedNotes.trim(),
        active: true,
        addedAt: new Date().toISOString()
      }
      const updated = [newMed, ...(patientData.ongoingMedications || [])]
      await updateDoc(doc(db, 'appointments', appointments[0].id), {
        ongoingMedications: updated
      })
      setPatientData((prev: any) => ({ ...prev, ongoingMedications: updated }))
      toast.success('تمت إضافة الدواء لقائمة الأدوية الحالية')
      setNewMedName('')
      setNewMedDose('')
      setNewMedFrequency('')
      setNewMedNotes('')
      setIsAddMedOpen(false)
    } catch (err) {
      toast.error('حدث خطأ أثناء إضافة الدواء')
    } finally {
      setIsSavingMed(false)
    }
  }

  const handleToggleMedStatus = async (medId: string) => {
    if (appointments.length === 0) return
    const updated = (patientData.ongoingMedications || []).map((m: any) => {
      if (m.id === medId) return { ...m, active: !m.active }
      return m
    })
    try {
      await updateDoc(doc(db, 'appointments', appointments[0].id), {
        ongoingMedications: updated
      })
      setPatientData((prev: any) => ({ ...prev, ongoingMedications: updated }))
      toast.success('تم تحديث حالة الدواء بنجاح')
    } catch (e) {
      toast.error('حدث خطأ أثناء تحديث حالة الدواء')
    }
  }

  const handleDeleteMed = async (medId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا الدواء من القائمة؟')) return
    if (appointments.length === 0) return
    const updated = (patientData.ongoingMedications || []).filter((m: any) => m.id !== medId)
    try {
      await updateDoc(doc(db, 'appointments', appointments[0].id), {
        ongoingMedications: updated
      })
      setPatientData((prev: any) => ({ ...prev, ongoingMedications: updated }))
      toast.success('تم حذف الدواء بنجاح')
    } catch (e) {
      toast.error('حدث خطأ أثناء حذف الدواء')
    }
  }

  // Attachments Upload & Handlers
  const handleAttachmentFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Strict validation: check extension and mime type
    const dangerousExts = ['.exe', '.bat', '.cmd', '.sh', '.js', '.html', '.php', '.msi', '.vbs', '.py']
    const lowerName = file.name.toLowerCase()
    if (dangerousExts.some(ext => lowerName.endsWith(ext))) {
      return toast.error('نوع الملف غير مسموح به لدواعي الأمان')
    }

    const allowedMime = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    if (!allowedMime.includes(file.type)) {
      return toast.error('يرجى اختيار ملف PDF أو صورة (JPEG, PNG, WebP)')
    }

    if (file.size > 8 * 1024 * 1024) {
      return toast.error('حجم الملف كبير، الحد الأقصى هو 8 ميجابايت')
    }

    const reader = new FileReader()
    reader.onload = () => {
      setAttachmentFile({
        name: file.name,
        type: file.type,
        size: file.size,
        dataUrl: reader.result as string
      })
      if (!attachmentTitle) {
        setAttachmentTitle(file.name.replace(/\.[^/.]+$/, ''))
      }
    }
    reader.readAsDataURL(file)
  }

  const handleSaveAttachment = async () => {
    if (!attachmentFile) return toast.error('يرجى اختيار ملف المرفق')
    if (appointments.length === 0) return
    setIsUploadingAttachment(true)
    try {
      const newAtt = {
        id: `att_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        title: attachmentTitle.trim() || attachmentFile.name,
        fileName: attachmentFile.name,
        fileType: attachmentFile.type.includes('pdf') ? 'pdf' : 'image',
        sizeFormatted: `${(attachmentFile.size / 1024 / 1024).toFixed(2)} MB`,
        category: attachmentCategory,
        dataUrl: attachmentFile.dataUrl,
        uploadedAt: new Date().toISOString()
      }
      const updated = [newAtt, ...(patientData.attachments || [])]
      await updateDoc(doc(db, 'appointments', appointments[0].id), {
        attachments: updated
      })
      setPatientData((prev: any) => ({ ...prev, attachments: updated }))
      toast.success('تم حفظ وإرفاق المستند الطبي بنجاح')
      setAttachmentFile(null)
      setAttachmentTitle('')
      setIsAddAttachmentOpen(false)
    } catch (err) {
      toast.error('حدث خطأ أثناء حفظ المرفق')
    } finally {
      setIsUploadingAttachment(false)
    }
  }

  const handleDeleteAttachment = async (attId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذا المرفق الطبي نهائياً؟')) return
    if (appointments.length === 0) return
    const updated = (patientData.attachments || []).filter((a: any) => a.id !== attId)
    try {
      await updateDoc(doc(db, 'appointments', appointments[0].id), {
        attachments: updated
      })
      setPatientData((prev: any) => ({ ...prev, attachments: updated }))
      toast.success('تم حذف المرفق الطبي')
    } catch (e) {
      toast.error('حدث خطأ أثناء الحذف')
    }
  }

  // Patient Notes
  const handleOpenEditNotes = () => {
    setTempNotes(patientData.notes || '')
    setIsEditNotesOpen(true)
  }

  const handleSaveNotes = async () => {
    if (appointments.length === 0) return
    setIsSavingNotes(true)
    try {
      await updateDoc(doc(db, 'appointments', appointments[0].id), {
        patientNotes: tempNotes.trim()
      })
      setPatientData((prev: any) => ({ ...prev, notes: tempNotes.trim() }))
      toast.success('تم حفظ ملاحظات الملف الطبي بنجاح')
      setIsEditNotesOpen(false)
    } catch (e) {
      toast.error('حدث خطأ أثناء حفظ الملاحظات')
    } finally {
      setIsSavingNotes(false)
    }
  }

  // Print & WhatsApp Prescription
  const handlePrintRx = (appt: any) => {
    const html = generateA4PrescriptionHtml({
      clinicName: clinic?.clinicName || 'العيادة الطبية',
      doctorName: clinic?.doctorName,
      specialty: clinic?.specialty,
      certificationTitle: clinic?.certificationTitle,
      clinicPhone: clinic?.clinicPhone,
      clinicAddress: clinic?.clinicAddress,
      primaryColor: clinic?.primaryColor || '#087CF4',
      logoUrl: clinic?.logoUrl,
      patientName: patientData?.name || appt?.patientName || 'المريض',
      patientAge: patientData?.age || appt?.age || patientData?.dob || appt?.dob || '',
      date: appt.date,
      diagnosis: appt.diagnosis,
      instructions: appt.instructions,
      notes: appt.notes,
      vitalSigns: appt.vitalSigns,
      drugs: appt.drugs || [],
      prescriptionTemplateUrl: clinic?.prescriptionTemplateUrl,
      templateMode: appt.prescription_templateMode || appt.templateMode || (clinic?.prescriptionTemplateUrl ? 'custom' : 'standard'),
      showHeaderFooter: true,
      printBackground: true
    })
    printHtmlViaIframe(html, 'a4')
  }

  const handleDownloadRxPdf = async (appt: any) => {
    const rxElement = document.getElementById(`rx-sheet-${appt.id}`)
    if (!rxElement) return
    setDownloadingApptId(appt.id)
    try {
      const fileName = generateCleanRxFileName(patientData.name, appt.date, 'pdf')
      await downloadElementAsPdf(rxElement, fileName, { format: 'a4', orientation: 'portrait' })
      toast.success(`تم تحميل ملف الروشتة PDF (${fileName}) بنجاح`)
    } catch (e) {
      toast.error('حدث خطأ أثناء تحميل الروشتة')
    } finally {
      setDownloadingApptId(null)
    }
  }

  const sendWhatsAppRx = async (appt: any, targetOverride?: 'web' | 'app') => {
    const phone = patientData.phone
    if (!phone) return toast.error('يرجى إدخال رقم هاتف المريض')
    setSharingApptId(appt.id)
    try {
      const host = typeof window !== 'undefined' && window.location.origin ? window.location.origin : 'https://www.yalla-clinic.com'
      const directRxUrl = `${host}/clinic/${slug}/prescription/${appt.id}`

      const message = formatPrescriptionWhatsAppMessage({
        clinicName: clinic?.clinicName || 'العيادة الطبية',
        doctorName: clinic?.doctorName,
        specialty: clinic?.specialty,
        patientName: patientData.name,
        patientAge: patientData.age || patientData.dob,
        date: appt.date,
        diagnosis: appt.diagnosis,
        drugs: appt.drugs || [],
        directRxUrl
      })

      const targetMode = targetOverride || getSavedWhatsAppTarget()
      openManualWhatsAppChat({ phone, message, target: targetMode })
      toast.success(`تم فتح محادثة المريض (${phone}) وإدراج الروشتة في الشات!`)
    } catch (err) {
      toast.error('تعذر مشاركة الروشتة عبر واتساب')
    } finally {
      setSharingApptId(null)
    }
  }

  const handleSaveDiagnosis = async (apptId: string) => {
    try {
      await updateDoc(doc(db, 'appointments', apptId), { diagnosis: tempDiagnosis })
      setEditingDiagnosisFor(null)
      toast.success('تم حفظ التشخيص بنجاح')
    } catch (error) {
      toast.error('حدث خطأ أثناء الحفظ')
    }
  }

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-12 text-center space-y-4" dir={dir}>
        <div className="w-12 h-12 rounded-full border-4 border-primary border-t-transparent animate-spin mx-auto" />
        <p className="text-foreground font-black text-base">جاري تحميل ملف المريض المتكامل...</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6 print:hidden pb-16" dir={dir}>

      {/* Hidden File Input for Avatar Photo */}
      <input
        ref={photoInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handlePhotoUpload}
        className="hidden"
      />

      {/* 1. Header Navigation & Breadcrumb */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link href={`/clinic/${slug}/admin/patients`}>
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-xl border-border text-foreground hover:bg-secondary cursor-pointer"
              title="رجوع لسجل المرضى"
            >
              <ArrowRight className="w-5 h-5" />
            </Button>
          </Link>
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
              <span>سجل المرضى</span>
              <span>/</span>
              <span className="text-foreground font-bold">ملف المريض</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground mt-0.5">ملف المريض المتكامل</h1>
          </div>
        </div>

        {/* Top Actions */}
        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            variant="outline"
            onClick={handleOpenEditProfile}
            className="h-10 px-4 rounded-xl text-xs font-bold border-border text-foreground hover:bg-secondary flex items-center gap-2 cursor-pointer shadow-2xs"
          >
            <Edit2 className="w-3.5 h-3.5 text-primary" />
            <span>تعديل البيانات</span>
          </Button>

          <Link
            href={`/clinic/${slug}/admin/prescriptions?phone=${encodeURIComponent(patientData.phone)}&patientName=${encodeURIComponent(patientData.name)}&age=${encodeURIComponent(patientData.age || patientData.dob || '')}`}
          >
            <Button className="h-10 px-4 rounded-xl text-xs font-black yalla-gradient-btn text-white flex items-center gap-2 cursor-pointer shadow-md shadow-primary/20">
              <Play className="w-3.5 h-3.5 fill-current" />
              <span>بدء زيارة / كتابة روشتة</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* 2. Top Card: Basic Patient Data Card (بطاقة البيانات الأساسية) */}
      <div className="yalla-card p-6 sm:p-7 border border-border/80 bg-card rounded-3xl shadow-xs">
        <div className="flex flex-col md:flex-row items-center md:items-start gap-6">

          {/* Patient Photo / Avatar with upload & clear controls */}
          <div className="relative group shrink-0">
            <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-3xl overflow-hidden border-2 border-primary/30 bg-primary/5 flex items-center justify-center shadow-md">
              {patientData.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={patientData.photoUrl}
                  alt={patientData.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="text-primary font-black text-3xl">
                  {patientData.name ? patientData.name.charAt(0) : <User className="w-10 h-10" />}
                </div>
              )}
            </div>

            {/* Quick Upload / Replace Button */}
            <button
              type="button"
              onClick={() => photoInputRef.current?.click()}
              disabled={isUploadingPhoto}
              title="تغيير أو رفع صورة المريض"
              className="absolute -bottom-1 -start-1 p-2 rounded-xl bg-primary text-white hover:bg-primary/90 shadow-md transition-transform hover:scale-110 active:scale-95 cursor-pointer disabled:opacity-50"
            >
              <Camera className="w-3.5 h-3.5" />
            </button>

            {patientData.photoUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                title="إزالة الصورة"
                className="absolute -top-1 -end-1 p-1.5 rounded-xl bg-destructive text-white hover:bg-destructive/90 shadow-md transition-transform hover:scale-110 cursor-pointer"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          {/* Patient Information & Meta */}
          <div className="flex-1 text-center md:text-start space-y-3.5 min-w-0 w-full">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <div className="flex items-center justify-center md:justify-start gap-3 flex-wrap">
                  <h2 className="text-2xl font-black text-foreground tracking-tight">{patientData.name}</h2>
                  <Badge className="bg-primary/10 text-primary border border-primary/20 font-black text-xs px-2.5 py-0.5 rounded-lg font-mono">
                    ملف {patientFileCode}
                  </Badge>
                </div>
                {patientData.callNamePronunciation && (
                  <p className="text-[11px] font-bold text-muted-foreground mt-1">
                    طريقة نطق النداء بالصوت: <span className="text-primary font-bold">«{patientData.callNamePronunciation}»</span>
                  </p>
                )}
              </div>

              <div className="flex items-center justify-center md:justify-end gap-2 shrink-0">
                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-bold px-3 py-1.5 text-xs rounded-xl">
                  مريض نشط
                </Badge>
              </div>
            </div>

            {/* Details Pills: Age/DOB, Gender, Phone, Residence */}
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-2.5 text-xs font-semibold">
              <span className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-3 py-1.5 rounded-xl border border-border/60">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>العمر: {formattedAge}</span>
                {patientData.dob && <span className="text-muted-foreground font-mono">({patientData.dob})</span>}
              </span>

              <span className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-3 py-1.5 rounded-xl border border-border/60">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>النوع: {formattedGender}</span>
              </span>

              <span className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-3 py-1.5 rounded-xl border border-border/60 font-mono">
                <Phone className="w-3.5 h-3.5 text-primary" />
                <span dir="ltr">{patientData.phone || 'غير مسجّل'}</span>
              </span>

              <span className="flex items-center gap-1.5 bg-secondary/60 text-foreground px-3 py-1.5 rounded-xl border border-border/60">
                <MapPin className="w-3.5 h-3.5 text-primary" />
                <span>
                  {patientData.residence?.governorateNameAr
                    ? `${patientData.residence.governorateNameAr} - ${patientData.residence.areaNameAr || patientData.residence.cityNameAr}`
                    : 'السكن: غير مسجّل'}
                </span>
              </span>
            </div>

            {/* Quick Metrics Bar: Total Visits, Last Visit, Next Follow-up */}
            <div className="grid grid-cols-3 gap-3 pt-2 border-t border-border/60">
              <div className="text-center md:text-start">
                <p className="text-[11px] font-bold text-muted-foreground">إجمالي الزيارات</p>
                <p className="text-lg font-black text-foreground mt-0.5">{appointments.length} زيارات</p>
              </div>
              <div className="text-center md:text-start">
                <p className="text-[11px] font-bold text-muted-foreground">تاريخ آخر زيارة</p>
                <p className="text-xs sm:text-sm font-bold text-primary mt-1 font-mono">{appointments[0]?.date || 'لا يوجد'}</p>
              </div>
              <div className="text-center md:text-start">
                <p className="text-[11px] font-bold text-muted-foreground">أقرب موعد متابعة</p>
                <p className="text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400 mt-1 font-mono">
                  {nextFollowUpAppt ? `${nextFollowUpAppt.date}` : 'لا يوجد موعد قائم'}
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* 3. Allergies & Chronic Diseases (الحساسية الدوائية والأمراض المزمنة) Side-by-Side */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">

        {/* Card A: Drug Allergies (الحساسية الدوائية) */}
        <div className="p-4 sm:p-5 rounded-3xl border border-rose-200/90 dark:border-rose-900/40 bg-rose-50/50 dark:bg-rose-950/20 text-rose-950 dark:text-rose-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-rose-900 dark:text-rose-200">الحساسية الدوائية (Drug Allergies)</h3>
                <p className="text-[10px] text-rose-700/80 dark:text-rose-300/80">المواد والأدوية التي يعاني المريض من تحسس تجاهها</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenEditAllergies}
              className="h-8 px-2.5 text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/15 rounded-xl cursor-pointer"
            >
              <Edit2 className="w-3 h-3 ml-1" />
              <span>تعديل</span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1 min-h-[36px] items-center">
            {patientData.allergies?.includes('NKDA_NO_KNOWN_ALLERGIES') ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>لا توجد أي حساسية دوائية معروفة (NKDA)</span>
              </span>
            ) : patientData.allergies && patientData.allergies.length > 0 ? (
              patientData.allergies.map((alg: string, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl bg-rose-500/20 text-rose-900 dark:text-rose-200 border border-rose-500/30 shadow-2xs"
                >
                  <AlertTriangle className="w-3 h-3 text-rose-600" />
                  <span>{alg}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-rose-700/70 dark:text-rose-400/70 italic">
                لم تُسجّل معلومات حساسية دوائية بعد. اضغط «تعديل» لإضافتها.
              </span>
            )}
          </div>
        </div>

        {/* Card B: Chronic Diseases (الأمراض المزمنة) */}
        <div className="p-4 sm:p-5 rounded-3xl border border-amber-200/90 dark:border-amber-900/40 bg-amber-50/50 dark:bg-amber-950/20 text-amber-950 dark:text-amber-100 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400">
                <HeartPulse className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-amber-900 dark:text-amber-200">الأمراض المزمنة (Chronic Conditions)</h3>
                <p className="text-[10px] text-amber-700/80 dark:text-amber-300/80">الحالات المرضية المزمنة المسجلة في السجل الطبي</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenEditAllergies}
              className="h-8 px-2.5 text-xs font-bold text-amber-700 dark:text-amber-300 hover:bg-amber-500/15 rounded-xl cursor-pointer"
            >
              <Edit2 className="w-3 h-3 ml-1" />
              <span>تعديل</span>
            </Button>
          </div>

          <div className="flex flex-wrap gap-1.5 pt-1 min-h-[36px] items-center">
            {patientData.chronicDiseases?.includes('NO_KNOWN_CHRONIC_CONDITIONS') ? (
              <span className="inline-flex items-center gap-1.5 text-xs font-bold px-3 py-1 rounded-xl bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>لا توجد أمراض مزمنة مسجلة</span>
              </span>
            ) : patientData.chronicDiseases && patientData.chronicDiseases.length > 0 ? (
              patientData.chronicDiseases.map((cond: string, idx: number) => (
                <span
                  key={idx}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-xl bg-amber-500/20 text-amber-900 dark:text-amber-200 border border-amber-500/30 shadow-2xs"
                >
                  <Activity className="w-3 h-3 text-amber-600" />
                  <span>{cond}</span>
                </span>
              ))
            ) : (
              <span className="text-xs text-amber-700/70 dark:text-amber-400/70 italic">
                لم تُسجّل أمراض مزمنة بعد. اضغط «تعديل» لإضافتها.
              </span>
            )}
          </div>
        </div>

      </div>

      {/* 4. Main Two-Column Layout (Desktop: 8/4 grid, Mobile: stacked) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">

        {/* Main Column (8 Cols): Visits History & Diagnosis (تاريخ الزيارات والتشخيص) */}
        <div className="lg:col-span-8 space-y-4">
          <div className="yalla-card p-5 sm:p-6 border border-border rounded-3xl bg-card shadow-xs space-y-4">
            
            {/* Header + Search & Period Filters */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-base text-foreground">تاريخ الزيارات والتشخيص</h3>
                  <p className="text-xs text-muted-foreground">السجل الزمني لكافة الفحوصات والروشتات الطبية</p>
                </div>
              </div>

              {/* Quick Period Filter Buttons */}
              <div className="flex items-center gap-1 bg-secondary/60 p-1 rounded-xl border border-border text-xs font-bold">
                {[
                  { id: 'all', label: 'الكل' },
                  { id: 'month', label: 'آخر شهر' },
                  { id: 'six_months', label: '6 أشهر' },
                  { id: 'year', label: 'سنة' }
                ].map((period) => (
                  <button
                    key={period.id}
                    type="button"
                    onClick={() => setVisitPeriodFilter(period.id as any)}
                    className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
                      visitPeriodFilter === period.id
                        ? 'bg-background text-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    {period.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Search Input in Visits */}
            <div className="relative">
              <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
              <Input
                value={visitSearchQuery}
                onChange={e => setVisitSearchQuery(e.target.value)}
                placeholder="البحث في التشخيص أو اسم الخدمة أو الأدوية..."
                className="ps-9 h-10 rounded-xl text-xs bg-secondary/30 border-border"
              />
            </div>

            {/* Visits List */}
            {filteredAppointments.length === 0 ? (
              <div className="p-10 text-center border-2 border-dashed border-border/80 rounded-2xl space-y-2">
                <FolderOpen className="w-8 h-8 text-muted-foreground/60 mx-auto" />
                <p className="text-sm font-bold text-muted-foreground">لا توجد زيارات مطابقة للبحث أو الفترة المحددة.</p>
              </div>
            ) : (
              <div className="space-y-3.5">
                {filteredAppointments.map((appt, idx) => {
                  const isExpanded = expandedVisitId === appt.id
                  const hasDrugs = Boolean(appt.drugs && appt.drugs.length > 0)

                  return (
                    <div
                      key={appt.id}
                      className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                        isExpanded
                          ? 'border-primary shadow-md bg-card'
                          : 'border-border hover:border-primary/40 bg-card'
                      }`}
                    >
                      {/* Visit Summary Row */}
                      <div
                        onClick={() => setExpandedVisitId(isExpanded ? null : appt.id)}
                        className="p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 cursor-pointer select-none"
                      >
                        <div className="flex items-center gap-3.5">
                          <div
                            className={`w-11 h-11 rounded-2xl flex items-center justify-center font-black text-sm shrink-0 transition-colors ${
                              isExpanded
                                ? 'yalla-gradient-btn text-white'
                                : 'bg-secondary text-foreground'
                            }`}
                          >
                            #{filteredAppointments.length - idx}
                          </div>
                          <div>
                            <div className="flex items-center gap-2 flex-wrap">
                              <h4 className="font-bold text-sm text-foreground">
                                {appt.serviceName || 'كشف طبي'}
                              </h4>
                              {appt.status === 'completed' && (
                                <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-[10px] px-2 py-0">
                                  تم الكشف
                                </Badge>
                              )}
                            </div>
                            <p className="text-xs text-muted-foreground font-mono mt-0.5">
                              {appt.date} {appt.time || appt.timeSlot ? `• ${appt.time || appt.timeSlot}` : ''}
                            </p>
                          </div>
                        </div>

                        {/* Right side: Diagnosis snippet, Prescription Trigger & Chevron */}
                        <div className="flex items-center gap-2 self-end sm:self-center">
                          {appt.diagnosis && (
                            <span className="hidden md:inline-block max-w-[200px] truncate text-xs font-semibold text-muted-foreground bg-secondary/60 px-2.5 py-1 rounded-lg">
                              {appt.diagnosis}
                            </span>
                          )}

                          {hasDrugs && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => {
                                e.stopPropagation()
                                setActiveRxModalAppt(appt)
                              }}
                              className="h-8 px-2.5 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 rounded-xl cursor-pointer"
                            >
                              <FileText className="w-3.5 h-3.5 ml-1" />
                              <span>الروشتة ({appt.drugs.length})</span>
                            </Button>
                          )}

                          <div className="p-1 rounded-lg text-muted-foreground">
                            {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
                          </div>
                        </div>
                      </div>

                      {/* Expanded Visit Detail View */}
                      {isExpanded && (
                        <div className="border-t border-border/70 bg-secondary/15 p-5 space-y-5 rounded-b-2xl">

                          {/* 1. Diagnosis Section */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="font-black text-xs text-foreground flex items-center gap-1.5">
                                <Stethoscope className="w-3.5 h-3.5 text-primary" />
                                <span>التشخيص والملاحظات السريرية</span>
                              </h5>
                              {editingDiagnosisFor !== appt.id && (
                                <Button
                                  variant="link"
                                  onClick={() => {
                                    setEditingDiagnosisFor(appt.id)
                                    setTempDiagnosis(appt.diagnosis || '')
                                  }}
                                  className="h-auto p-0 text-xs font-bold text-primary cursor-pointer"
                                >
                                  {appt.diagnosis ? 'تعديل التشخيص' : '+ إضافة تشخيص'}
                                </Button>
                              )}
                            </div>

                            {editingDiagnosisFor === appt.id ? (
                              <div className="space-y-2">
                                <Input
                                  value={tempDiagnosis}
                                  onChange={e => setTempDiagnosis(e.target.value)}
                                  placeholder="اكتب التشخيص الطبي هنا..."
                                  className="text-xs bg-background border-border"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    onClick={() => handleSaveDiagnosis(appt.id)}
                                    className="yalla-gradient-btn text-white text-xs h-8 font-bold"
                                  >
                                    حفظ التشخيص
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => setEditingDiagnosisFor(null)}
                                    className="text-xs h-8 font-bold border-border"
                                  >
                                    إلغاء
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <div className="p-3.5 rounded-xl bg-card border border-border/70 text-xs space-y-1.5 shadow-2xs">
                                <p className="font-bold text-foreground">
                                  {appt.diagnosis || <span className="text-muted-foreground italic">لم يتم تسجيل تشخيص في هذه الزيارة.</span>}
                                </p>
                                {appt.instructions && (
                                  <p className="text-muted-foreground pt-1 border-t border-border/50">
                                    <strong className="text-foreground">تعليمات الطبيب: </strong>
                                    {appt.instructions}
                                  </p>
                                )}
                                {appt.notes && (
                                  <p className="text-sky-700 dark:text-sky-300 bg-sky-50 dark:bg-sky-950/20 p-2 rounded-lg mt-1 font-medium">
                                    <strong className="font-bold">ملاحظة: </strong> {appt.notes}
                                  </p>
                                )}
                              </div>
                            )}
                          </div>

                          {/* 2. Vital Signs for this visit (if any) */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="font-black text-xs text-foreground flex items-center gap-1.5">
                                <Activity className="w-3.5 h-3.5 text-rose-500" />
                                <span>القياسات الحيوية للزيارة</span>
                              </h5>
                              <Button
                                variant="link"
                                onClick={() => handleOpenQuickVitals(appt.id)}
                                className="h-auto p-0 text-xs font-bold text-primary cursor-pointer"
                              >
                                {appt.vitalSigns ? 'تعديل القياسات' : '+ تسجيل قياسات'}
                              </Button>
                            </div>

                            {appt.vitalSigns && Object.keys(appt.vitalSigns).length > 0 ? (
                              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                                {(appt.vitalSigns.bloodPressureSystolic || appt.vitalSigns.bloodPressureDiastolic) && (
                                  <div className="p-2.5 rounded-xl bg-card border border-border/70 shadow-2xs">
                                    <span className="text-[10px] text-muted-foreground font-bold block">ضغط الدم</span>
                                    <span className="text-sm font-black text-foreground font-mono">
                                      {appt.vitalSigns.bloodPressureSystolic || '--'}/{appt.vitalSigns.bloodPressureDiastolic || '--'}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground block">mmHg</span>
                                  </div>
                                )}
                                {appt.vitalSigns.heartRate && (
                                  <div className="p-2.5 rounded-xl bg-card border border-border/70 shadow-2xs">
                                    <span className="text-[10px] text-muted-foreground font-bold block">النبض</span>
                                    <span className="text-sm font-black text-rose-600 font-mono">
                                      {appt.vitalSigns.heartRate}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground block">bpm</span>
                                  </div>
                                )}
                                {appt.vitalSigns.weightKg && (
                                  <div className="p-2.5 rounded-xl bg-card border border-border/70 shadow-2xs">
                                    <span className="text-[10px] text-muted-foreground font-bold block">الوزن</span>
                                    <span className="text-sm font-black text-teal-600 font-mono">
                                      {appt.vitalSigns.weightKg}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground block">kg</span>
                                  </div>
                                )}
                                {appt.vitalSigns.glucoseLevel && (
                                  <div className="p-2.5 rounded-xl bg-card border border-border/70 shadow-2xs">
                                    <span className="text-[10px] text-muted-foreground font-bold block">السكر</span>
                                    <span className="text-sm font-black text-primary font-mono">
                                      {appt.vitalSigns.glucoseLevel}
                                    </span>
                                    <span className="text-[9px] text-muted-foreground block">mg/dL</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">لم يتم تسجيل قياسات حيوية لهذه الزيارة.</p>
                            )}
                          </div>

                          {/* 3. Prescription & Medications Section */}
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <h5 className="font-black text-xs text-foreground flex items-center gap-1.5">
                                <Pill className="w-3.5 h-3.5 text-primary" />
                                <span>الأدوية الموصوفة في الزيارة</span>
                              </h5>
                              <Link
                                href={`/clinic/${slug}/admin/prescriptions?appointmentId=${appt.id}&phone=${encodeURIComponent(patientData.phone)}&patientName=${encodeURIComponent(patientData.name)}&age=${encodeURIComponent(patientData.age || patientData.dob || '')}`}
                              >
                                <Button
                                  variant="link"
                                  className="h-auto p-0 text-xs font-bold text-primary cursor-pointer"
                                >
                                  {hasDrugs ? 'تعديل الروشتة في الشاشة' : '+ كتابة روشتة جديدة'}
                                </Button>
                              </Link>
                            </div>

                            {hasDrugs ? (
                              <div className="space-y-2">
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {appt.drugs.map((drug: any, dIdx: number) => (
                                    <div
                                      key={dIdx}
                                      className="p-3 rounded-xl bg-card border border-border/80 shadow-2xs text-xs space-y-0.5"
                                    >
                                      <div className="flex items-center justify-between">
                                        <p className="font-black text-foreground">{drug.tradeName || drug.name}</p>
                                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary">
                                          {drug.form || 'علاج'}
                                        </span>
                                      </div>
                                      <p className="text-[11px] text-muted-foreground">
                                        الجرعة: {drug.dose || drug.dosage || 'حسب الإرشادات'} • {drug.frequency || 'يومياً'}
                                      </p>
                                      {drug.instructions && (
                                        <p className="text-[10px] text-sky-700 dark:text-sky-300">{drug.instructions}</p>
                                      )}
                                    </div>
                                  ))}
                                </div>

                                {/* Full Action Bar for Prescription */}
                                <div className="flex flex-wrap items-center gap-2 pt-2">
                                  <Button
                                    size="sm"
                                    onClick={() => setActiveRxModalAppt(appt)}
                                    className="h-9 px-3 text-xs font-bold yalla-gradient-btn text-white rounded-xl cursor-pointer"
                                  >
                                    <FileText className="w-3.5 h-3.5 ml-1.5" />
                                    <span>معاينة الروشتة A4</span>
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    onClick={() => handlePrintRx(appt)}
                                    className="h-9 px-3 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl cursor-pointer"
                                  >
                                    <Printer className="w-3.5 h-3.5 ml-1.5" />
                                    <span>طباعة سريعة</span>
                                  </Button>
                                  <WhatsAppShareButton
                                    onSend={(target) => sendWhatsAppRx(appt, target)}
                                    phone={patientData.phone}
                                    loading={sharingApptId === appt.id}
                                    label="إرسال واتساب"
                                    size="sm"
                                    showPhoneBadge={false}
                                  />
                                </div>
                              </div>
                            ) : (
                              <p className="text-xs text-muted-foreground italic">لم يتم صرف أدوية في هذه الزيارة.</p>
                            )}
                          </div>

                        </div>
                      )}

                    </div>
                  )
                })}
              </div>
            )}

          </div>
        </div>

        {/* Sidebar Column (4 Cols): Latest Vitals & Current Medications */}
        <div className="lg:col-span-4 space-y-4">

          {/* Sidebar Card 1: Latest Vitals (آخر القياسات) */}
          <div className="yalla-card p-5 border border-border rounded-3xl bg-card shadow-xs space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-rose-500/10 text-rose-600">
                  <Activity className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="font-black text-sm text-foreground">آخر القياسات الحيوية</h3>
                  <p className="text-[10px] text-muted-foreground font-mono">
                    {latestVitals?.recordedAt || latestVitals?.visitDate
                      ? `تم التسجيل: ${latestVitals.visitDate || ''}`
                      : 'سجل القياسات'}
                  </p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleOpenQuickVitals()}
                className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
              >
                <Plus className="w-3 h-3 ml-1" />
                <span>قياس جديد</span>
              </Button>
            </div>

            {latestVitals ? (
              <div className="grid grid-cols-2 gap-2 text-center">
                {/* Blood Pressure */}
                <div className="p-3 rounded-2xl bg-secondary/40 border border-border/80">
                  <span className="text-[10px] font-bold text-muted-foreground block">ضغط الدم</span>
                  <span className="text-base font-black text-foreground font-mono">
                    {latestVitals.bloodPressureSystolic || '--'}/{latestVitals.bloodPressureDiastolic || '--'}
                  </span>
                  <span className="text-[9px] text-muted-foreground block">mmHg</span>
                </div>

                {/* Pulse */}
                <div className="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20">
                  <span className="text-[10px] font-bold text-rose-600 block">النبض</span>
                  <span className="text-base font-black text-rose-700 dark:text-rose-400 font-mono">
                    {latestVitals.heartRate || '--'}
                  </span>
                  <span className="text-[9px] text-rose-500 block">bpm</span>
                </div>

                {/* Weight */}
                <div className="p-3 rounded-2xl bg-teal-500/10 border border-teal-500/20">
                  <span className="text-[10px] font-bold text-teal-600 block">الوزن</span>
                  <span className="text-base font-black text-teal-700 dark:text-teal-400 font-mono">
                    {latestVitals.weightKg || '--'}
                  </span>
                  <span className="text-[9px] text-teal-500 block">kg</span>
                </div>

                {/* Height */}
                <div className="p-3 rounded-2xl bg-blue-500/10 border border-blue-500/20">
                  <span className="text-[10px] font-bold text-blue-600 block">الطول</span>
                  <span className="text-base font-black text-blue-700 dark:text-blue-400 font-mono">
                    {latestVitals.heightCm || '--'}
                  </span>
                  <span className="text-[9px] text-blue-500 block">cm</span>
                </div>

                {/* Glucose Level */}
                {latestVitals.glucoseLevel && (
                  <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 col-span-2">
                    <span className="text-[10px] font-bold text-primary block">مستوى السكر العشوائي</span>
                    <span className="text-base font-black text-primary font-mono">{latestVitals.glucoseLevel}</span>
                    <span className="text-[9px] text-primary/70 block">mg/dL</span>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border rounded-2xl space-y-2">
                <Activity className="w-6 h-6 text-muted-foreground/50 mx-auto" />
                <p className="text-xs font-bold text-muted-foreground">لم يتم تسجيل قياسات حيوية بعد.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleOpenQuickVitals()}
                  className="h-8 text-xs font-bold rounded-xl"
                >
                  + تسجيل أول قياس
                </Button>
              </div>
            )}
          </div>

          {/* Sidebar Card 2: Current / Ongoing Medications (الأدوية الحالية) */}
          <div className="yalla-card p-5 border border-border rounded-3xl bg-card shadow-xs space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <div className="p-2 rounded-xl bg-primary/10 text-primary">
                  <Pill className="w-4 h-4" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-black text-sm text-foreground">الأدوية الحالية</h3>
                    <Badge className="bg-primary/10 text-primary border border-primary/20 text-[10px] px-1.5 py-0 font-mono font-bold">
                      {(patientData.ongoingMedications || []).filter((m: any) => m.active !== false).length} نشط
                    </Badge>
                  </div>
                  <p className="text-[10px] text-muted-foreground">الأدوية المستمرة أو الموصوفة حديثاً</p>
                </div>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsAddMedOpen(true)}
                className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
              >
                <Plus className="w-3 h-3 ml-1" />
                <span>إضافة دواء</span>
              </Button>
            </div>

            {patientData.ongoingMedications && patientData.ongoingMedications.length > 0 ? (
              <div className="space-y-2 max-h-[280px] overflow-y-auto pe-1">
                {patientData.ongoingMedications.map((med: any) => {
                  const isActive = med.active !== false
                  return (
                    <div
                      key={med.id}
                      className={`p-3 rounded-2xl border transition-all text-xs space-y-1 ${
                        isActive
                          ? 'bg-secondary/40 border-border/80'
                          : 'bg-muted/40 border-border/40 opacity-70'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <p className={`font-black ${isActive ? 'text-foreground' : 'text-muted-foreground line-through'}`}>
                          {med.name}
                        </p>
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => handleToggleMedStatus(med.id)}
                            className={`text-[9px] font-bold px-2 py-0.5 rounded-md cursor-pointer ${
                              isActive
                                ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                                : 'bg-muted text-muted-foreground'
                            }`}
                          >
                            {isActive ? 'مستمر' : 'متوقف'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteMed(med.id)}
                            className="p-1 text-muted-foreground hover:text-destructive cursor-pointer"
                            title="حذف"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {med.dose ? `${med.dose} • ` : ''}{med.frequency || 'يومياً'}
                      </p>
                      {med.notes && (
                        <p className="text-[10px] text-primary">{med.notes}</p>
                      )}
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="p-6 text-center border border-dashed border-border rounded-2xl space-y-2">
                <Pill className="w-6 h-6 text-muted-foreground/50 mx-auto" />
                <p className="text-xs font-bold text-muted-foreground">لا توجد أدوية مستمرة مسجلة.</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setIsAddMedOpen(true)}
                  className="h-8 text-xs font-bold rounded-xl"
                >
                  + إضافة دواء مستمر
                </Button>
              </div>
            )}
          </div>

        </div>

      </div>

      {/* 5. Bottom Grid (2 Cards): Follow-up & Accounts + Lab Tests & Attachments */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

        {/* Bottom Card 1: Follow-up & Accounts (المتابعة والحسابات والملاحظات) */}
        <div className="yalla-card p-5 sm:p-6 border border-border rounded-3xl bg-card shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600">
                <CreditCard className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-foreground">المتابعة والحسابات والملاحظات</h3>
                <p className="text-[10px] text-muted-foreground">حالة الحجز القادم والملخص المالي وملاحظات الملف</p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={handleOpenEditNotes}
              className="h-7 px-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-lg cursor-pointer"
            >
              <Edit2 className="w-3 h-3 ml-1" />
              <span>تعديل الملاحظات</span>
            </Button>
          </div>

          {/* Follow-up Section */}
          <div className="p-3.5 rounded-2xl bg-secondary/40 border border-border/80 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <CalendarClock className="w-4 h-4 text-primary" />
              <div>
                <span className="text-[10px] font-bold text-muted-foreground block">أقرب موعد متابعة</span>
                <span className="text-xs font-black text-foreground">
                  {nextFollowUpAppt
                    ? `${nextFollowUpAppt.date} (${nextFollowUpAppt.serviceName || 'متابعة'})`
                    : 'لا توجد مواعيد متابعة مجدولة حالياً'}
                </span>
              </div>
            </div>
            {nextFollowUpAppt && (
              <Badge className="bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 text-[10px] font-bold">
                مؤكد
              </Badge>
            )}
          </div>

          {/* Financial Metrics */}
          <div className="grid grid-cols-3 gap-2.5 text-center">
            <div className="p-3 rounded-2xl bg-secondary/30 border border-border/60">
              <span className="text-[10px] font-bold text-muted-foreground block">إجمالي الرسوم</span>
              <span className="text-sm font-black text-foreground font-mono">{financialSummary.totalFees} ج.م</span>
            </div>
            <div className="p-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/20">
              <span className="text-[10px] font-bold text-emerald-600 block">المدفوع</span>
              <span className="text-sm font-black text-emerald-700 dark:text-emerald-400 font-mono">{financialSummary.totalPaid} ج.م</span>
            </div>
            <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/20">
              <span className="text-[10px] font-bold text-amber-600 block">المتبقي</span>
              <span className="text-sm font-black text-amber-700 dark:text-amber-400 font-mono">
                {financialSummary.remaining === 0 ? '0 ج.م (مسدد)' : `${financialSummary.remaining} ج.م`}
              </span>
            </div>
          </div>

          {/* Patient Profile Notes */}
          <div className="p-3.5 rounded-2xl bg-card border border-border/80 space-y-1">
            <p className="text-[11px] font-black text-foreground">ملاحظات الطبيب والإدارة للملف:</p>
            <p className="text-xs text-muted-foreground leading-relaxed whitespace-pre-wrap">
              {patientData.notes || 'لا توجد ملاحظات إدارية أو عامة مسجلة في ملف المريض.'}
            </p>
          </div>
        </div>

        {/* Bottom Card 2: Lab Tests & Attachments (التحاليل والمرفقات الطبية) */}
        <div className="yalla-card p-5 sm:p-6 border border-border rounded-3xl bg-card shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-border">
            <div className="flex items-center gap-2">
              <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600">
                <Paperclip className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-black text-sm text-foreground">التحاليل والمرفقات الطبية</h3>
                <p className="text-[10px] text-muted-foreground">مستندات التحاليل والأشعة والتقارير الطبية</p>
              </div>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddAttachmentOpen(true)}
              className="h-8 px-2.5 text-xs font-bold border-primary/30 text-primary hover:bg-primary/10 rounded-xl cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5 ml-1" />
              <span>إضافة مرفق</span>
            </Button>
          </div>

          {/* Attachments List */}
          {patientData.attachments && patientData.attachments.length > 0 ? (
            <div className="space-y-2.5 max-h-[300px] overflow-y-auto pe-1">
              {patientData.attachments.map((att: any) => (
                <div
                  key={att.id}
                  className="p-3 rounded-2xl bg-secondary/30 border border-border/70 flex items-center justify-between gap-3 text-xs"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 font-bold ${
                      att.fileType === 'pdf' ? 'bg-rose-500/15 text-rose-600' : 'bg-blue-500/15 text-blue-600'
                    }`}>
                      {att.fileType === 'pdf' ? <FileText className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="font-bold text-foreground truncate">{att.title || att.fileName}</p>
                      <p className="text-[10px] text-muted-foreground font-mono">
                        {att.category || 'مرفق'} • {att.sizeFormatted || ''} • {att.uploadedAt ? new Date(att.uploadedAt).toLocaleDateString('ar-EG') : ''}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => setPreviewAttachment(att)}
                      title="معاينة المرفق"
                      className="h-8 w-8 rounded-lg text-primary hover:bg-primary/10 cursor-pointer"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                    <a
                      href={att.dataUrl}
                      download={att.fileName || `${att.title}.pdf`}
                      title="تحميل الملف"
                      className="h-8 w-8 rounded-lg flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer"
                    >
                      <Download className="w-4 h-4" />
                    </a>
                    <Button
                      size="icon"
                      variant="ghost"
                      onClick={() => handleDeleteAttachment(att.id)}
                      title="حذف المرفق"
                      className="h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10 cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-8 text-center border border-dashed border-border rounded-2xl space-y-2">
              <FolderOpen className="w-7 h-7 text-muted-foreground/50 mx-auto" />
              <p className="text-xs font-bold text-muted-foreground">لا توجد تحاليل أو مستندات مرفوعة بعد.</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setIsAddAttachmentOpen(true)}
                className="h-8 text-xs font-bold rounded-xl"
              >
                + رفع أول مستند طبي (PDF / صور)
              </Button>
            </div>
          )}
        </div>

      </div>

      {/* ===================== MODALS & DIALOGS ===================== */}

      {/* MODAL 1: Edit Basic Patient Profile */}
      <Dialog open={isEditProfileOpen} onOpenChange={setIsEditProfileOpen}>
        <DialogContent className="sm:max-w-xl bg-card border border-border" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Edit2 className="w-4 h-4 text-primary" />
              <span>تعديل بيانات المريض والملف</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">الاسم الكامل *</label>
                <Input
                  value={editName}
                  onChange={e => setEditName(e.target.value)}
                  placeholder="اسم المريض"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">رقم الهاتف</label>
                <Input
                  value={editPhone}
                  onChange={e => setEditPhone(e.target.value)}
                  placeholder="01xxxxxxxxx"
                  dir="ltr"
                  className="h-9 text-xs text-end"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">النوع</label>
                <select
                  value={editGender}
                  onChange={(e) => setEditGender(e.target.value as any)}
                  className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-bold text-foreground"
                >
                  <option value="unspecified">غير محدد</option>
                  <option value="male">ذكر</option>
                  <option value="female">أنثى</option>
                </select>
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">العمر (بالسنوات)</label>
                <Input
                  value={editAge}
                  onChange={e => setEditAge(e.target.value)}
                  placeholder="مثال: 35"
                  className="h-9 text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">تاريخ الميلاد</label>
                <Input
                  type="date"
                  value={editDob}
                  onChange={e => setEditDob(e.target.value)}
                  className="h-9 text-xs"
                />
              </div>
            </div>

            {/* TV Voice Call Pronunciation override */}
            <div className="p-3 rounded-2xl bg-secondary/40 border border-border/80 space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                <span>طريقة نطق اسم النداء (للشاشة الذكية اختياري):</span>
              </label>
              <Input
                value={editPronunciation}
                onChange={e => setEditPronunciation(e.target.value)}
                placeholder="مثال: أستاذ جون حنا (اكتبه كما ترغب أن ينطقه النظام المصري بطلاقة)"
                className="h-9 text-xs bg-background"
              />
              <p className="text-[10px] text-muted-foreground">
                إذا كان الاسم أجنبيًا أو مركبًا، يمكنك كتابة صيغة النطق هنا بالعامية المصرية لنداء المريض بدقة على الشاشة.
              </p>
            </div>

            {/* Residence Selector */}
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">منطقة السكن والمحافظة:</label>
              <ResidentialAreaSelector
                value={editResidence}
                onChange={setEditResidence}
                showLocationButton={false}
                compact={false}
                defaultSource="staff_override"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditProfileOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSaveProfile}
                disabled={isSavingProfile}
                className="yalla-gradient-btn text-white rounded-xl text-xs font-bold"
              >
                {isSavingProfile ? 'جاري الحفظ...' : 'حفظ البيانات'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 2: Edit Allergies & Chronic Conditions */}
      <Dialog open={isEditAllergiesOpen} onOpenChange={setIsEditAllergiesOpen}>
        <DialogContent className="sm:max-w-lg bg-card border border-border" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rose-500" />
              <span>تعديل الحساسية الدوائية والأمراض المزمنة</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 pt-2">

            {/* Section A: Allergies */}
            <div className="space-y-2">
              <label className="text-xs font-black text-rose-800 dark:text-rose-200 block">الحساسية الدوائية:</label>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={noKnownAllergies}
                  onChange={(e) => setNoKnownAllergies(e.target.checked)}
                  className="rounded text-rose-600 focus:ring-rose-500"
                />
                <span>تأكيد: لا توجد أي حساسية دوائية معروفة للمريض (NKDA)</span>
              </label>

              {!noKnownAllergies && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newAllergyInput}
                      onChange={e => setNewAllergyInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (newAllergyInput.trim()) {
                            setTempAllergies(prev => [...prev, newAllergyInput.trim()])
                            setNewAllergyInput('')
                          }
                        }
                      }}
                      placeholder="اكتب اسم الدواء/المادة واضغط إضافة..."
                      className="h-8 text-xs bg-background"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (newAllergyInput.trim()) {
                          setTempAllergies(prev => [...prev, newAllergyInput.trim()])
                          setNewAllergyInput('')
                        }
                      }}
                      className="h-8 text-xs font-bold bg-rose-600 hover:bg-rose-700 text-white"
                    >
                      إضافة
                    </Button>
                  </div>

                  {/* Suggestions */}
                  <div className="flex flex-wrap gap-1">
                    {COMMON_ALLERGIES.map((sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => {
                          if (!tempAllergies.includes(sugg)) {
                            setTempAllergies(prev => [...prev, sugg])
                          }
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                      >
                        + {sugg}
                      </button>
                    ))}
                  </div>

                  {/* Active allergy tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tempAllergies.filter(a => a !== 'NKDA_NO_KNOWN_ALLERGIES').map((alg, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-rose-500/20 text-rose-800 dark:text-rose-200"
                      >
                        <span>{alg}</span>
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-rose-600"
                          onClick={() => setTempAllergies(prev => prev.filter((_, i) => i !== idx))}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Section B: Chronic Diseases */}
            <div className="space-y-2 pt-3 border-t border-border">
              <label className="text-xs font-black text-amber-800 dark:text-amber-200 block">الأمراض المزمنة:</label>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={noKnownChronic}
                  onChange={(e) => setNoKnownChronic(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500"
                />
                <span>تأكيد: لا توجد أمراض مزمنة مسجلة</span>
              </label>

              {!noKnownChronic && (
                <div className="space-y-2">
                  <div className="flex gap-2">
                    <Input
                      value={newChronicInput}
                      onChange={e => setNewChronicInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          if (newChronicInput.trim()) {
                            setTempChronic(prev => [...prev, newChronicInput.trim()])
                            setNewChronicInput('')
                          }
                        }
                      }}
                      placeholder="اكتب الحالة المزمنة واضغط إضافة..."
                      className="h-8 text-xs bg-background"
                    />
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        if (newChronicInput.trim()) {
                          setTempChronic(prev => [...prev, newChronicInput.trim()])
                          setNewChronicInput('')
                        }
                      }}
                      className="h-8 text-xs font-bold bg-amber-600 hover:bg-amber-700 text-white"
                    >
                      إضافة
                    </Button>
                  </div>

                  {/* Suggestions */}
                  <div className="flex flex-wrap gap-1">
                    {COMMON_CHRONIC.map((sugg) => (
                      <button
                        key={sugg}
                        type="button"
                        onClick={() => {
                          if (!tempChronic.includes(sugg)) {
                            setTempChronic(prev => [...prev, sugg])
                          }
                        }}
                        className="text-[10px] font-bold px-2 py-0.5 rounded-md bg-secondary hover:bg-secondary/80 text-foreground cursor-pointer"
                      >
                        + {sugg}
                      </button>
                    ))}
                  </div>

                  {/* Active chronic tags */}
                  <div className="flex flex-wrap gap-1.5 pt-1">
                    {tempChronic.filter(c => c !== 'NO_KNOWN_CHRONIC_CONDITIONS').map((cond, idx) => (
                      <span
                        key={idx}
                        className="inline-flex items-center gap-1 text-xs font-bold px-2 py-0.5 rounded-lg bg-amber-500/20 text-amber-800 dark:text-amber-200"
                      >
                        <span>{cond}</span>
                        <X
                          className="w-3 h-3 cursor-pointer hover:text-amber-600"
                          onClick={() => setTempChronic(prev => prev.filter((_, i) => i !== idx))}
                        />
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditAllergiesOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSaveMedicalTags}
                disabled={isSavingMedicalTags}
                className="yalla-gradient-btn text-white rounded-xl text-xs font-bold"
              >
                {isSavingMedicalTags ? 'جاري الحفظ...' : 'حفظ المعلومات الطبية'}
              </Button>
            </div>

          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 3: Quick Vitals Recording */}
      <Dialog open={isVitalsModalOpen} onOpenChange={setIsVitalsModalOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Activity className="w-4 h-4 text-rose-500" />
              <span>تسجيل قياسات حيوية (Vital Signs)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">ضغط الدم الانقباضي (SYS)</label>
                <Input
                  value={vitalsBpSys}
                  onChange={e => setVitalsBpSys(e.target.value)}
                  placeholder="120"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">ضغط الدم الانبساطي (DIA)</label>
                <Input
                  value={vitalsBpDia}
                  onChange={e => setVitalsBpDia(e.target.value)}
                  placeholder="80"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">النبض (HR bpm)</label>
                <Input
                  value={vitalsPulse}
                  onChange={e => setVitalsPulse(e.target.value)}
                  placeholder="72"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[11px] font-bold text-muted-foreground">الوزن (Weight kg)</label>
                <Input
                  value={vitalsWeight}
                  onChange={e => setVitalsWeight(e.target.value)}
                  placeholder="75"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2">
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">الطول (cm)</label>
                <Input
                  value={vitalsHeight}
                  onChange={e => setVitalsHeight(e.target.value)}
                  placeholder="175"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">الحرارة (°C)</label>
                <Input
                  value={vitalsTemp}
                  onChange={e => setVitalsTemp(e.target.value)}
                  placeholder="37.0"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[10px] font-bold text-muted-foreground">السكر (mg/dL)</label>
                <Input
                  value={vitalsGlucose}
                  onChange={e => setVitalsGlucose(e.target.value)}
                  placeholder="100"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsVitalsModalOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSaveQuickVitals}
                disabled={isSavingVitals}
                className="yalla-gradient-btn text-white rounded-xl text-xs font-bold"
              >
                {isSavingVitals ? 'جاري الحفظ...' : 'حفظ القياسات'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 4: Add Ongoing Medication */}
      <Dialog open={isAddMedOpen} onOpenChange={setIsAddMedOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Pill className="w-4 h-4 text-primary" />
              <span>إضافة دواء مستمر للمريض</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">اسم الدواء والتركيز *</label>
              <Input
                value={newMedName}
                onChange={e => setNewMedName(e.target.value)}
                placeholder="مثال: Concor 5mg أو أوجمنتين 1 جم"
                className="h-9 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">الجرعة</label>
                <Input
                  value={newMedDose}
                  onChange={e => setNewMedDose(e.target.value)}
                  placeholder="مثال: قرص واحد"
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-foreground">التكرار</label>
                <Input
                  value={newMedFrequency}
                  onChange={e => setNewMedFrequency(e.target.value)}
                  placeholder="مثال: يومياً صباحاً"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">ملاحظات الطبيب / سبب الاستخدام</label>
              <Input
                value={newMedNotes}
                onChange={e => setNewMedNotes(e.target.value)}
                placeholder="مثال: لعلاج ضغط الدم"
                className="h-9 text-xs"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddMedOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleAddOngoingMed}
                disabled={isSavingMed}
                className="yalla-gradient-btn text-white rounded-xl text-xs font-bold"
              >
                {isSavingMed ? 'جاري الحفظ...' : 'إضافة الدواء'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 5: Add Medical Attachment */}
      <Dialog open={isAddAttachmentOpen} onOpenChange={setIsAddAttachmentOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <Paperclip className="w-4 h-4 text-purple-600" />
              <span>إضافة مرفق طبي للملف (تحاليل / أشعة / تقارير)</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">عنوان أو اسم المرفق *</label>
              <Input
                value={attachmentTitle}
                onChange={e => setAttachmentTitle(e.target.value)}
                placeholder="مثال: تحليل دم شامل CBC أو أشعة سينية للصدر"
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">نوع المرفق</label>
              <select
                value={attachmentCategory}
                onChange={(e) => setAttachmentCategory(e.target.value as any)}
                className="w-full h-9 px-3 rounded-md border border-input bg-background text-xs font-bold text-foreground"
              >
                <option value="تحاليل">تحاليل مخبرية</option>
                <option value="أشعة">أشعة وتصوير طبي</option>
                <option value="تقرير طبي">تقرير طبي استشاري</option>
                <option value="أخرى">أخرى</option>
              </select>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold text-foreground">اختر الملف (PDF أو صور JPEG/PNG):</label>
              <input
                type="file"
                accept="image/jpeg,image/png,image/webp,application/pdf"
                onChange={handleAttachmentFileSelect}
                className="w-full text-xs file:mr-2 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-primary/10 file:text-primary hover:file:bg-primary/20 cursor-pointer"
              />
              {attachmentFile && (
                <p className="text-[11px] font-bold text-emerald-600 mt-1">
                  ✓ تم تجهيز: {attachmentFile.name} ({(attachmentFile.size / 1024 / 1024).toFixed(2)} MB)
                </p>
              )}
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddAttachmentOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSaveAttachment}
                disabled={isUploadingAttachment || !attachmentFile}
                className="yalla-gradient-btn text-white rounded-xl text-xs font-bold"
              >
                {isUploadingAttachment ? 'جاري الحفظ...' : 'حفظ المرفق'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 6: Attachment Preview Lightbox */}
      <Dialog open={Boolean(previewAttachment)} onOpenChange={() => setPreviewAttachment(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden p-0 bg-black/95 text-white border-white/20 flex flex-col" dir={dir}>
          <div className="p-4 border-b border-white/10 flex items-center justify-between shrink-0 bg-black/60">
            <h3 className="text-sm font-bold truncate">{previewAttachment?.title}</h3>
            <div className="flex items-center gap-2">
              <a
                href={previewAttachment?.dataUrl}
                download={previewAttachment?.fileName || `${previewAttachment?.title}.pdf`}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-xs font-bold flex items-center gap-1.5 text-white"
              >
                <Download className="w-3.5 h-3.5" />
                <span>تحميل</span>
              </a>
              <Button
                size="icon"
                variant="ghost"
                onClick={() => setPreviewAttachment(null)}
                className="h-8 w-8 text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <div className="flex-1 overflow-auto p-4 flex items-center justify-center">
            {previewAttachment?.fileType === 'pdf' ? (
              <iframe
                src={previewAttachment.dataUrl}
                title={previewAttachment.title}
                className="w-full h-[70vh] rounded-lg border-0 bg-white"
              />
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={previewAttachment?.dataUrl}
                alt={previewAttachment?.title}
                className="max-h-[75vh] max-w-full object-contain rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 7: Edit Patient Notes */}
      <Dialog open={isEditNotesOpen} onOpenChange={setIsEditNotesOpen}>
        <DialogContent className="sm:max-w-md bg-card border border-border" dir={dir}>
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2">
              <FileText className="w-4 h-4 text-primary" />
              <span>تعديل ملاحظات الملف الطبي</span>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 pt-2">
            <textarea
              rows={5}
              value={tempNotes}
              onChange={e => setTempNotes(e.target.value)}
              placeholder="اكتب أي ملاحظات إدارية، سريرية، أو تذكيرات خاصة بالمريض..."
              className="w-full p-3 rounded-2xl border text-xs bg-background leading-relaxed"
            />

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-border">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsEditNotesOpen(false)}
                className="rounded-xl text-xs font-bold"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                onClick={handleSaveNotes}
                disabled={isSavingNotes}
                className="yalla-gradient-btn text-white rounded-xl text-xs font-bold"
              >
                {isSavingNotes ? 'جاري الحفظ...' : 'حفظ الملاحظات'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL 8: Full A4 Prescription Sheet Modal with Print, PDF & WhatsApp */}
      {activeRxModalAppt && (
        <Dialog open={Boolean(activeRxModalAppt)} onOpenChange={() => setActiveRxModalAppt(null)}>
          <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto bg-card border border-border print:max-w-none print:w-full print:h-auto print:max-h-none print:overflow-visible print:border-none print:shadow-none print:bg-transparent print:p-0 print:m-0" dir={dir}>
            <DialogHeader className="print:hidden">
              <DialogTitle className="text-foreground text-sm font-black">
                الروشتة الطبية المعتمدة - زيارة {activeRxModalAppt.date}
              </DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 mb-3 print:hidden">
              <Button
                onClick={() => handlePrintRx(activeRxModalAppt)}
                className="h-9 px-3.5 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-xs cursor-pointer"
              >
                <Printer className="w-4 h-4 ml-1.5" />
                <span>طباعة الروشتة A4</span>
              </Button>

              <Button
                onClick={() => handleDownloadRxPdf(activeRxModalAppt)}
                disabled={downloadingApptId === activeRxModalAppt.id}
                variant="outline"
                className="h-9 px-3.5 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl cursor-pointer"
              >
                <Download className="w-4 h-4 ml-1.5" />
                <span>{downloadingApptId === activeRxModalAppt.id ? 'جاري التحميل...' : 'تحميل PDF'}</span>
              </Button>

              <WhatsAppShareButton
                onSend={(target) => sendWhatsAppRx(activeRxModalAppt, target)}
                phone={patientData.phone}
                loading={sharingApptId === activeRxModalAppt.id}
                label="إرسال واتساب للمريض"
                size="sm"
                showPhoneBadge={false}
              />

              <Link
                href={`/clinic/${slug}/admin/prescriptions?appointmentId=${activeRxModalAppt.id}&phone=${encodeURIComponent(patientData.phone)}&patientName=${encodeURIComponent(patientData.name)}&age=${encodeURIComponent(patientData.age || patientData.dob || '')}`}
              >
                <Button variant="outline" className="h-9 px-3.5 text-xs font-bold rounded-xl border-border cursor-pointer">
                  تعديل الروشتة
                </Button>
              </Link>
            </div>

            {/* Render A4 Prescription */}
            <div
              id={`rx-sheet-${activeRxModalAppt.id}`}
              className="bg-white rounded-xl border border-border overflow-hidden print:overflow-visible print:border-0 print:m-0 print:p-0 print:w-[100vw] print:h-[100vh]"
            >
              <A4Prescription
                clinic={clinic}
                patientName={patientData?.name || activeRxModalAppt?.patientName || 'المريض'}
                age={patientData?.age || activeRxModalAppt?.age || patientData?.dob || activeRxModalAppt?.dob || ''}
                date={activeRxModalAppt.date}
                diagnosis={activeRxModalAppt.diagnosis}
                instructions={activeRxModalAppt.instructions}
                notes={activeRxModalAppt.notes}
                vitalSigns={activeRxModalAppt.vitalSigns}
                drugs={activeRxModalAppt.drugs}
                templateMode={activeRxModalAppt.prescription_templateMode || activeRxModalAppt.templateMode || (clinic?.prescriptionTemplateUrl ? 'custom' : 'standard')}
                topOffset={25}
              />
            </div>
          </DialogContent>
        </Dialog>
      )}

    </div>
  )
}
