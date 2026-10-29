'use client'

import { use, useState, useEffect, useMemo, useRef } from 'react'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Plus, Printer, Trash2, Search, FileSignature, MapPin, Globe, Loader2,
  Phone, User as UserIcon, Star, Check, MessageCircle,
  FileText, ShieldCheck, ChevronDown, Sparkles, Download, Palette, Image as ImageIcon, Lock,
  Eye, ZoomIn, ZoomOut, ExternalLink, AlertTriangle, Zap, RotateCcw, BookmarkCheck,
  HeartPulse, Activity, X, Layers, Pencil, Save
} from 'lucide-react'
import {
  PrescriptionTemplateModal,
  type PrescriptionTemplate,
  type TemplateDrugItem
} from '@/components/clinic/PrescriptionTemplateModal'
import { motion, AnimatePresence } from 'framer-motion'
import { isClinicFeatureEnabled } from '@/lib/featurePermissions'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, setDoc, query, where, getDocs, getDoc, doc, updateDoc, onSnapshot } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { EGYPTIAN_DRUGS } from '@/lib/egyptian-drugs'
import { useEgyptianDrugs, type EgyptianDrug } from '@/hooks/useEgyptianDrugs'
import { ClinicLogo } from '@/components/clinic/ClinicLogo'
import { A4Prescription } from '@/components/clinic/A4Prescription'
import { WhatsAppShareButton } from '@/components/common/WhatsAppShareButton'
import { PhoneInputWithCountry } from '@/components/ui/PhoneInputWithCountry'
import { printHtmlViaIframe, generateA4PrescriptionHtml } from '@/lib/printService'
import {
  generateCleanRxFileName,
  formatEgyptianPhoneForWhatsApp,
  openManualWhatsAppChat,
  formatPrescriptionWhatsAppMessage
} from '@/lib/whatsappShare'
import { getClinicUrl } from '@/lib/clinic-url'
import { useLanguage } from '@/context/LanguageContext'
import { VoiceDictationButton } from '@/components/clinic/VoiceDictationButton'
import { stopGlobalVoiceDictation } from '@/hooks/useVoiceDictation'
import { DictationLanguage } from '@/types/speech'

export default function PrescriptionsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const searchParams = useSearchParams()
  const { t, tDynamic, dir, isRtl, language } = useLanguage()

  const [appointmentId, setAppointmentId] = useState(searchParams?.get('appointmentId') || '')
  const [patientName, setPatientName] = useState(searchParams?.get('patientName') || '')
  const [patientPhone, setPatientPhone] = useState(searchParams?.get('phone') || searchParams?.get('patientPhone') || '')
  const [diagnosis, setDiagnosis] = useState('')
  const [age, setAge] = useState(searchParams?.get('age') || '')
  const [instructions, setInstructions] = useState('')
  const [patientAllergies, setPatientAllergies] = useState('')
  const [patientChronicDiseases, setPatientChronicDiseases] = useState('')
  const [showAllergiesInput, setShowAllergiesInput] = useState(false)
  const [showProtocolPicker, setShowProtocolPicker] = useState(false)
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false)
  const [templateToEdit, setTemplateToEdit] = useState<PrescriptionTemplate | null>(null)
  const [templateDraftData, setTemplateDraftData] = useState<{
    diagnosis?: string
    instructions?: string
    drugs?: TemplateDrugItem[]
  } | null>(null)
  const [hiddenBuiltinIds, setHiddenBuiltinIds] = useState<string[]>([])
  const [customProtocols, setCustomProtocols] = useState<any[]>([])
  const [isDraftRestored, setIsDraftRestored] = useState(false)
  const draftStorageKey = useMemo(() => `yalla_rx_draft_${slug}`, [slug])

  const [dictationLang, setDictationLang] = useState<DictationLanguage>('ar-EG')
  const diagnosisInputRef = useRef<HTMLInputElement>(null)
  const instructionsInputRef = useRef<HTMLInputElement>(null)

  const [notes, setNotes] = useState('')
  const [includeVitals, setIncludeVitals] = useState(false)
  const [bpSys, setBpSys] = useState('')
  const [bpDia, setBpDia] = useState('')
  const [pulse, setPulse] = useState('')
  const [temp, setTemp] = useState('')
  const [glucose, setGlucose] = useState('')
  const [weight, setWeight] = useState('')
  const [selectedBranchId, setSelectedBranchId] = useState('')
  const [selectedBranchName, setSelectedBranchName] = useState('')
  const [whatsappTarget, setWhatsappTarget] = useState<'auto' | 'app' | 'web'>('auto')
  const [showWhatsappMenu, setShowWhatsappMenu] = useState(false)

  // 6 Clinical Built-in Protocols for Instant 1-Click Prescription
  const BUILTIN_PROTOCOLS = useMemo(() => [
    {
      id: 'gastroenteritis',
      name: 'نزلة معوية حادة (Gastroenteritis)',
      icon: '🦠',
      isBuiltin: true,
      diagnosis: 'نزلة معوية وتقلصات معوية حادة (Acute Gastroenteritis)',
      instructions: 'الراحة التامة، تناول سوائل دافئة وشوربة خفيفة، تجنب المقليات والمأكولات الحارة ومنتجات الألبان مؤقتاً.',
      drugs: [
        { name: 'Visceralgine tab', dosage: 'قرص 3 مرات يومياً قبل الأكل', duration: 'لمدة 5 أيام', notes: 'مضاد للمغص والتقلصات' },
        { name: 'Gast-Reg 200mg tab', dosage: 'قرص قبل الأكل بنصف ساعة', duration: 'لمدة 5 أيام', notes: 'تنظيم حركة القناة الهضمية' },
        { name: 'Antinal 200mg cap', dosage: 'كبسولة كل 8 ساعات بعد الأكل', duration: 'لمدة 4 أيام', notes: 'مطهر معوي واسع المجال' },
        { name: 'Hydrasafe sachets', dosage: 'كيس على 200 مل ماء بعد كل نوبة إسهال', duration: 'عند اللزوم', notes: 'محلول معالجة الجفاف' }
      ]
    },
    {
      id: 'tonsillitis',
      name: 'التهاب الحلق واللوزتين (Pharyngotonsillitis)',
      icon: '🗣️',
      isBuiltin: true,
      diagnosis: 'التهاب بكتيري حاد باللوزتين والحلق (Acute Bacterial Tonsillitis)',
      instructions: 'شرب مشروبات دافئة بكثرة، الغرغرة بماء دافئ وملح، تجنب المشروبات المثلجة والمجهود الشاق.',
      drugs: [
        { name: 'Augmentin 1gm tab', dosage: 'قرص كل 12 ساعة بعد الأكل مباشرة', duration: 'لمدة 7 أيام متواصلة', notes: 'مضاد حيوي واسع المجال' },
        { name: 'Cataflam 50mg tab', dosage: 'قرص بعد الأكل عند اللزوم (بحد أقصى مرتين)', duration: 'لمدة 3-5 أيام', notes: 'مسكن ومضاد للالتهاب والتورم' },
        { name: 'Larypro lozenges', dosage: 'قرص استحلاب كل 4 ساعات', duration: 'لمدة 5 أيام', notes: 'مطهر ومخفف لآلام الحلق' }
      ]
    },
    {
      id: 'bronchitis_asthma',
      name: 'حساسية الصدر ونوبات الربو (Asthma / Bronchitis)',
      icon: '🫁',
      isBuiltin: true,
      diagnosis: 'التهاب الشعب الهوائية مع أزمة حساسية صدرية (Acute Bronchitis / Asthma)',
      instructions: 'الابتعاد التام عن الأتربة والدخان، تجنب الروائح النفاذة والتكييف المباشر، تناول كميات كافية من السوائل الدافئة.',
      drugs: [
        { name: 'Farcolin syrup', dosage: 'ملعقة كبيرة 3 مرات يومياً', duration: 'لمدة 7 أيام', notes: 'موسع للشعب الهوائية' },
        { name: 'Mucopect syrup', dosage: 'ملعقة كبيرة 3 مرات يومياً بعد الوجبات', duration: 'لمدة 7 أيام', notes: 'مذيب وطارد للبلغم' },
        { name: 'Aerius 5mg tab', dosage: 'قرص واحد يومياً مساءً قبل النوم', duration: 'لمدة 10 أيام', notes: 'مضاد للهيستامين والحساسية' }
      ]
    },
    {
      id: 'hypertension',
      name: 'بروتوكول ضبط ضغط الدم (Hypertension)',
      icon: '🩸',
      isBuiltin: true,
      diagnosis: 'ارتفاع ضغط الدم الشرياني الأولي (Essential Hypertension)',
      instructions: 'تقليل ملح الطعام والمخللات تماماً، قياس ضغط الدم وتسجيله يومياً صباحاً ومساءً، المشي نصف ساعة يومياً.',
      drugs: [
        { name: 'Concor 5mg tab', dosage: 'قرص واحد صباحاً يومياً بعد الإفطار', duration: 'علاج مستمر منتظم', notes: 'لضبط معدل ضربات القلب والضغط' },
        { name: 'Natrilix SR 1.5mg tab', dosage: 'قرص واحد صباحاً على الريق', duration: 'علاج مستمر منتظم', notes: 'خافض للضغط ومدر خفيف' }
      ]
    },
    {
      id: 'flu_cold',
      name: 'نزلات البرد الحادة والإنفلونزا (Acute Flu & Cold)',
      icon: '🤒',
      isBuiltin: true,
      diagnosis: 'نزلة برد فيروسية حادة واحتقان أنفي (Common Cold & Upper RTI)',
      instructions: 'الراحة بالسرير، الإكثار من فيتامين سي وعصير الليمون والبرتقال، تغطية الفم والأنف وتجنب التيارات الهوائية.',
      drugs: [
        { name: 'Panadol Extra tab', dosage: 'قرصين كل 8 ساعات بعد الأكل عند اللزوم', duration: 'لمدة 4-5 أيام', notes: 'خافض للحرارة ومسكن للصداع' },
        { name: 'Congestal tab', dosage: 'قرص 3 مرات يومياً بعد الأكل', duration: 'لمدة 5 أيام', notes: 'لعلاج احتقان الجيوب الأنفية والرشح' },
        { name: 'C-Retard 500mg cap', dosage: 'كبسولة واحدة يومياً بعد الغداء', duration: 'لمدة 10 أيام', notes: 'فيتامين C لتقوية المناعة' }
      ]
    },
    {
      id: 'gerd_gastritis',
      name: 'التهاب المعدة وارتجاع المريء (GERD & Gastritis)',
      icon: '💊',
      isBuiltin: true,
      diagnosis: 'ارتفاع حموضة المعدة وارتجاع المريء (GERD & Hyperacidity)',
      instructions: 'تجنب النوم مباشرة بعد الأكل (الانتظار ساعتين على الأقل)، الامتناع عن المسبكات والقهوة والشوكولاتة والتدخين.',
      drugs: [
        { name: 'Nexium 40mg tab', dosage: 'قرص واحد يومياً صباحاً قبل الإفطار بنصف ساعة', duration: 'لمدة أسبوعين', notes: 'مثبط مضخة البروتون لعلاج الحموضة' },
        { name: 'Gaviscon Advance syrup', dosage: 'ملعقة كبيرة بعد الوجبات الرئيسية وقبل النوم', duration: 'عند اللزوم', notes: 'حاجز ميكانيكي لمنع ارتجاع الحمض' }
      ]
    }
  ], [])

  // Filter built-in protocols based on clinic preferences
  const visibleBuiltinProtocols = useMemo(() => {
    return BUILTIN_PROTOCOLS.filter(p => !hiddenBuiltinIds.includes(p.id))
  }, [BUILTIN_PROTOCOLS, hiddenBuiltinIds])

  // Real-time Drug Allergy Conflict Detection
  const getDrugAllergyConflict = (drugName: string, allergyString: string): string | null => {
    if (!drugName || !allergyString) return null
    const drugLower = drugName.toLowerCase()
    const allergyLower = allergyString.toLowerCase()

    // 1. Penicillin check
    const hasPenicillinAllergy =
      allergyLower.includes('بنسلين') ||
      allergyLower.includes('penicillin') ||
      allergyLower.includes('اموكسي') ||
      allergyLower.includes('amox')
    if (hasPenicillinAllergy) {
      const penicillinKeywords = [
        'penicil', 'amox', 'augmentin', 'hibiotic', 'curam', 'amoclan', 'clamoxyl', 'ampicil',
        'بنسلين', 'أوجمنتين', 'اوجمنتين', 'هاي بيوتك', 'هايبيوتك', 'كيورام', 'اموكسيسيلين', 'يوناسين', 'unasyn'
      ]
      if (penicillinKeywords.some(kw => drugLower.includes(kw))) {
        return '⚠️ تعارض حرج: هذا الدواء يحتوي على مشتقات البنسلين والمريض مسجل لديه حساسية بنسلين!'
      }
    }

    // 2. Sulfa check
    const hasSulfaAllergy = allergyLower.includes('سلفا') || allergyLower.includes('sulfa')
    if (hasSulfaAllergy) {
      const sulfaKeywords = ['sulfa', 'bactrim', 'septrin', 'سلفا', 'باكتريم', 'سبترين']
      if (sulfaKeywords.some(kw => drugLower.includes(kw))) {
        return '⚠️ تعارض حرج: هذا الدواء يحتوي على مشتقات السلفا والمريض مسجل لديه حساسية سلفا!'
      }
    }

    // 3. Aspirin & NSAIDs check
    const hasNsaidAllergy =
      allergyLower.includes('اسبرين') ||
      allergyLower.includes('aspirin') ||
      allergyLower.includes('مسكن') ||
      allergyLower.includes('nsaid')
    if (hasNsaidAllergy) {
      const nsaidKeywords = [
        'aspirin', 'aspocid', 'ketolac', 'cataflam', 'voltaren', 'brufen', 'ibuprofen', 'ketoprofen', 'felden',
        'اسبرين', 'أسبوسيد', 'كيتولاك', 'كتافلام', 'فولتارين', 'بروفين', 'ايبوبروفين'
      ]
      if (nsaidKeywords.some(kw => drugLower.includes(kw))) {
        return '⚠️ تعارض حرج: هذا الدواء من مضادات الالتهاب غير الستيرويدية (NSAIDs) والمريض مسجل لديه حساسية تجاهه!'
      }
    }

    return null
  }

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('yalla_rx_whatsapp_mode') as 'auto' | 'app' | 'web'
      if (saved) setWhatsappTarget(saved)
    }
  }, [])

  const setAndSaveWhatsappTarget = (mode: 'auto' | 'app' | 'web') => {
    setWhatsappTarget(mode)
    if (typeof window !== 'undefined') {
      localStorage.setItem('yalla_rx_whatsapp_mode', mode)
    }
  }

  const { drugs: apiDrugs, loading: apiDrugsLoading, searchDrugs, syncDrugLive } = useEgyptianDrugs()
  const [isLiveSyncing, setIsLiveSyncing] = useState(false)
    // Vital Signs State (العلامات الحيوية)
  const [vitalsBpSys, setVitalsBpSys] = useState<string>('')
  const [vitalsBpDia, setVitalsBpDia] = useState<string>('')
  const [vitalsPulse, setVitalsPulse] = useState<string>('')
  const [vitalsTemp, setVitalsTemp] = useState<string>('')
  const [vitalsGlucose, setVitalsGlucose] = useState<string>('')
  const [vitalsWeight, setVitalsWeight] = useState<string>('')
  const [isSavingVitals, setIsSavingVitals] = useState(false)

  // Save or update vital signs to active appointment
  const handleSaveVitalsOnly = async () => {
    if (!vitalsBpSys && !vitalsBpDia && !vitalsPulse && !vitalsTemp && !vitalsGlucose && !vitalsWeight) {
      toast.error('يرجى إدخال قياس واحد على الأقل من العلامات الحيوية')
      return
    }
    setIsSavingVitals(true)
    try {
      const vPayload = {
        bloodPressureSystolic: vitalsBpSys ? Number(vitalsBpSys) : null,
        bloodPressureDiastolic: vitalsBpDia ? Number(vitalsBpDia) : null,
        heartRate: vitalsPulse ? Number(vitalsPulse) : null,
        temperature: vitalsTemp ? Number(vitalsTemp) : null,
        glucoseLevel: vitalsGlucose ? Number(vitalsGlucose) : null,
        weightKg: vitalsWeight ? Number(vitalsWeight) : null,
        recordedAt: new Date().toISOString()
      }

      if (appointmentId) {
        await updateDoc(doc(db, 'appointments', appointmentId), {
          vitalSigns: vPayload
        })
        toast.success('تم حفظ وتحديث العلامات الحيوية للكشف بنجاح ✅')
      } else {
        toast.success('تم تسجيل العلامات الحيوية في مسودة الروشتة الحالية ✅')
      }
    } catch (err: any) {
      console.error(err)
      toast.error('حدث خطأ أثناء حفظ القياسات: ' + err.message)
    } finally {
      setIsSavingVitals(false)
    }
  }

  const [drugs, setDrugs] = useState<any[]>([
    { id: 1, name: searchParams?.get('drug') || '', dosage: '', duration: '', notes: '' }
  ])

  const [drugSearch, setDrugSearch] = useState('')
  const [favoriteDrugs, setFavoriteDrugs] = useState<string[]>([])
  const [clinicId, setClinicId] = useState<string | null>(null)
  const [clinic, setClinic] = useState<any>(null)
  const [templateMode, setTemplateMode] = useState<'standard' | 'custom'>('standard')
  const [pageSize, setPageSize] = useState<'a4' | 'a5'>('a4')
  const [showHeaderFooter, setShowHeaderFooter] = useState<boolean>(true)
  const [printBackground, setPrintBackground] = useState<boolean>(true)
  const [topOffset, setTopOffset] = useState<number>(25)
  const [primaryColor, setPrimaryColor] = useState('#061A38')
  const [secondaryColor, setSecondaryColor] = useState('#087CF4')

  const [isSaving, setIsSaving] = useState(false)
  const [isSharingPdf, setIsSharingPdf] = useState(false)
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false)
  const [isDownloadingImage, setIsDownloadingImage] = useState(false)
  const [todayPatients, setTodayPatients] = useState<any[]>([])
  const dateStr = new Date().toISOString().split('T')[0]

  const sheetRef = useRef<HTMLDivElement>(null)
  const previewContainerRef = useRef<HTMLDivElement>(null)
  const [zoomMode, setZoomMode] = useState<'fit' | 'custom'>('fit')
  const [manualScale, setManualScale] = useState(1)
  const [containerWidth, setContainerWidth] = useState(600)

  // Natural paper dimensions in CSS pixels (at 96 DPI: A4 is 794x1123, A5 is 560x792)
  const naturalWidth = pageSize === 'a5' ? 560 : 794
  const naturalHeight = pageSize === 'a5' ? 792 : 1123

  useEffect(() => {
    if (!previewContainerRef.current) return
    const el = previewContainerRef.current
    setContainerWidth(el.clientWidth)

    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          if (entry.contentRect.width > 0) {
            setContainerWidth(entry.contentRect.width)
          }
        }
      })
      observer.observe(el)
      return () => observer.disconnect()
    }
  }, [])

  const fitScale = useMemo(() => {
    const available = Math.max(200, containerWidth - 24)
    return Math.min(1, Number((available / naturalWidth).toFixed(3)))
  }, [containerWidth, naturalWidth])

  const currentScale = zoomMode === 'fit' ? fitScale : manualScale

  useEffect(() => {
    const q = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubClinic = onSnapshot(
      q,
      async (snapshot) => {
        if (!snapshot.empty) {
          const cDoc = snapshot.docs[0]
          const data = cDoc.data()
          setClinic({ id: cDoc.id, ...data })
          setClinicId(cDoc.id)
          if (data.hiddenProtocolIds && Array.isArray(data.hiddenProtocolIds)) {
            setHiddenBuiltinIds(data.hiddenProtocolIds)
          }
          if (data.primaryColor) setPrimaryColor(data.primaryColor)
          if (data.secondaryColor) setSecondaryColor(data.secondaryColor)
          if (data.favorite_drugs && Array.isArray(data.favorite_drugs)) {
            setFavoriteDrugs(data.favorite_drugs)
          } else if (data.favoriteDrugs && Array.isArray(data.favoriteDrugs)) {
            setFavoriteDrugs(data.favoriteDrugs)
          }

          // Fetch today's patients for quick select
          try {
            const todayQ = query(
              collection(db, 'appointments'),
              where('clinic_id', '==', cDoc.id),
              where('date', '==', dateStr)
            )
            const todaySnap = await getDocs(todayQ)
            setTodayPatients(todaySnap.docs.map(d => ({ id: d.id, ...d.data() })))
          } catch (e) {
            console.error(e)
          }
        }
      },
      (err) => {
        console.error(err)
      }
    )

    return () => unsubClinic()
  }, [slug, dateStr])

  const [activeBranchId, setActiveBranchId] = useState<string>('all')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('clinic_selected_branch') || 'all'
      setActiveBranchId(saved)

      const handleBranchChanged = (e: any) => {
        const bId = e.detail?.branchId || 'all'
        setActiveBranchId(bId)
      }
      window.addEventListener('clinic_branch_changed', handleBranchChanged)
      return () => window.removeEventListener('clinic_branch_changed', handleBranchChanged)
    }
  }, [])

  const filteredTodayPatients = useMemo(() => {
    if (!activeBranchId || activeBranchId === 'all') return todayPatients
    return todayPatients.filter(p => {
      const pBranch = p.branch_id || p.branchId
      const isMain = activeBranchId === 'main' || clinic?.branches?.find((b: any) => b.isMain)?.id === activeBranchId
      return pBranch ? pBranch === activeBranchId : isMain
    })
  }, [todayPatients, activeBranchId, clinic])

  // Stop active speech dictation if doctor leaves the prescription page
  useEffect(() => {
    return () => {
      stopGlobalVoiceDictation()
    }
  }, [])

  // Fetch custom Rx protocols for this clinic
  useEffect(() => {
    if (!clinicId) return
    const qProtocols = query(
      collection(db, 'rx_protocols'),
      where('clinic_id', '==', clinicId)
    )
    const unsub = onSnapshot(qProtocols, (snapshot) => {
      const items = snapshot.docs.map(d => ({
        id: d.id,
        isCustom: true,
        ...d.data()
      }))
      setCustomProtocols(items)
    })
    return () => unsub()
  }, [clinicId])

  // 1. Restore unsubmitted draft on mount if form is currently empty
  useEffect(() => {
    if (typeof window === 'undefined') return
    try {
      const savedStr = localStorage.getItem(draftStorageKey)
      if (savedStr) {
        const draft = JSON.parse(savedStr)
        if (!patientName && (draft.patientName || draft.diagnosis || (draft.drugs && draft.drugs.some((d: any) => d.name)))) {
          if (draft.patientName) setPatientName(draft.patientName)
          if (draft.patientPhone) setPatientPhone(draft.patientPhone)
          if (draft.age) setAge(draft.age)
          if (draft.diagnosis) setDiagnosis(draft.diagnosis)
          if (draft.instructions) setInstructions(draft.instructions)
          if (draft.patientAllergies) setPatientAllergies(draft.patientAllergies)
          if (draft.patientChronicDiseases) setPatientChronicDiseases(draft.patientChronicDiseases)
          if (draft.drugs && draft.drugs.length > 0) setDrugs(draft.drugs)
          if (draft.templateMode) setTemplateMode(draft.templateMode)
          if (draft.pageSize) setPageSize(draft.pageSize)
          if (draft.vitalsBpSys) setVitalsBpSys(draft.vitalsBpSys)
          if (draft.vitalsBpDia) setVitalsBpDia(draft.vitalsBpDia)
          if (draft.vitalsPulse) setVitalsPulse(draft.vitalsPulse)
          if (draft.vitalsTemp) setVitalsTemp(draft.vitalsTemp)
          if (draft.vitalsGlucose) setVitalsGlucose(draft.vitalsGlucose)
          if (draft.vitalsWeight) setVitalsWeight(draft.vitalsWeight)
          setIsDraftRestored(true)
          toast.info('تم استرجاع مسودة الروشتة غير المحفوظة تلقائياً بنجاح ⚡', { duration: 4500 })
        }
      }
    } catch (e) {
      console.warn('Draft restore warning:', e)
    }
  }, [draftStorageKey])

  // 2. Debounced auto-save to localStorage
  useEffect(() => {
    if (typeof window === 'undefined') return
    const hasAnyContent = patientName || patientPhone || diagnosis || instructions || drugs.some(d => d.name && d.name.trim())
    if (!hasAnyContent) return

    const timer = setTimeout(() => {
      try {
        const draftData = {
          patientName,
          patientPhone,
          age,
          diagnosis,
          instructions,
          patientAllergies,
          patientChronicDiseases,
          drugs,
          templateMode,
          pageSize,
          vitalsBpSys,
          vitalsBpDia,
          vitalsPulse,
          vitalsTemp,
          vitalsGlucose,
          vitalsWeight,
          updatedAt: Date.now()
        }
        localStorage.setItem(draftStorageKey, JSON.stringify(draftData))
      } catch (e) {}
    }, 700)

    return () => clearTimeout(timer)
  }, [patientName, patientPhone, age, diagnosis, instructions, patientAllergies, patientChronicDiseases, drugs, templateMode, pageSize, vitalsBpSys, vitalsBpDia, vitalsPulse, vitalsTemp, vitalsGlucose, vitalsWeight, draftStorageKey])

  // 3. Clear draft and start fresh
  const handleClearDraft = () => {
    if (typeof window !== 'undefined') {
      localStorage.removeItem(draftStorageKey)
    }
    setPatientName('')
    setPatientPhone('')
    setAge('')
    setDiagnosis('')
    setInstructions('')
    setPatientAllergies('')
    setPatientChronicDiseases('')
    setAppointmentId('')
    setDrugs([{ id: Date.now(), name: '', dosage: '', duration: '', notes: '' }])
    setVitalsBpSys('')
    setVitalsBpDia('')
    setVitalsPulse('')
    setVitalsTemp('')
    setVitalsGlucose('')
    setVitalsWeight('')
    setIsDraftRestored(false)
    toast.success('تم مسح المسودة والبدء بروشتة جديدة')
  }

  // 4. Automatic patient allergy & chronic disease lookup when phone is entered
  useEffect(() => {
    if (!patientPhone || patientPhone.trim().length < 10) return
    const lookupHistory = async () => {
      try {
        const qAppts = query(
          collection(db, 'appointments'),
          where('phone', '==', patientPhone.trim())
        )
        const snap = await getDocs(qAppts)
        if (!snap.empty) {
          for (const dDoc of snap.docs) {
            const data = dDoc.data()
            if (data.allergies && !patientAllergies) {
              const allg = Array.isArray(data.allergies) ? data.allergies.join('، ') : String(data.allergies)
              setPatientAllergies(allg)
              toast.warning(`⚠️ تم العثور على حساسية مسجلة للمريض (${allg})`, { duration: 5000 })
            }
            if (data.chronicDiseases && !patientChronicDiseases) {
              const chr = Array.isArray(data.chronicDiseases) ? data.chronicDiseases.join('، ') : String(data.chronicDiseases)
              setPatientChronicDiseases(chr)
            }
            if (patientAllergies && patientChronicDiseases) break
          }
        }
      } catch (e) {}
    }
    const debouncedLookup = setTimeout(lookupHistory, 900)
    return () => clearTimeout(debouncedLookup)
  }, [patientPhone])

  // Apply Protocol helper
  const handleApplyProtocol = (protocol: any) => {
    if (protocol.diagnosis) {
      setDiagnosis(protocol.diagnosis)
    }
    if (protocol.instructions) {
      setInstructions(prev => prev ? `${prev}\n${protocol.instructions}` : protocol.instructions)
    }
    if (protocol.drugs && protocol.drugs.length > 0) {
      const formatted = protocol.drugs.map((d: any, idx: number) => ({
        id: Date.now() + idx,
        name: d.name,
        dosage: d.dosage,
        duration: d.duration,
        notes: d.notes || ''
      }))
      if (drugs.length === 1 && !drugs[0].name.trim()) {
        setDrugs(formatted)
      } else {
        setDrugs(prev => [...prev, ...formatted])
      }
    }
    toast.success(`تم تطبيق بروتوكول "${protocol.name}" بنجاح ⚡`)
  }

  // Open Add Template Modal (Blank)
  const handleOpenAddTemplate = () => {
    setTemplateToEdit(null)
    setTemplateDraftData(null)
    setIsTemplateModalOpen(true)
  }

  // Open Edit Template Modal
  const handleOpenEditTemplate = (tmpl: any) => {
    setTemplateToEdit({
      id: tmpl.id,
      clinic_id: clinicId || '',
      name: tmpl.name,
      category: tmpl.category || '',
      diagnosis: tmpl.diagnosis || '',
      instructions: tmpl.instructions || '',
      drugs: (tmpl.drugs || []).map((d: any, idx: number) => ({
        id: d.id || idx + 1,
        name: d.name,
        dosage: d.dosage || '',
        duration: d.duration || '',
        notes: d.notes || ''
      })),
      isBuiltin: !!tmpl.isBuiltin
    })
    setTemplateDraftData(null)
    setIsTemplateModalOpen(true)
  }

  // Save current prescription draft as a new template
  const handleOpenSaveDraftAsTemplate = () => {
    const validDraftDrugs = drugs.filter(d => d.name && d.name.trim() !== '')
    if (validDraftDrugs.length === 0 && !diagnosis.trim()) {
      return toast.error('يرجى كتابة تشخيص أو إضافة دواء في مسودة الروشتة أولاً لحفظه كقالب')
    }
    setTemplateToEdit(null)
    setTemplateDraftData({
      diagnosis,
      instructions,
      drugs: validDraftDrugs.map((d, i) => ({
        id: d.id || i + 1,
        name: d.name,
        dosage: d.dosage || '',
        duration: d.duration || '',
        notes: d.notes || ''
      }))
    })
    setIsTemplateModalOpen(true)
  }

  // Delete template (built-in or custom) with safety confirm dialog
  const handleDeleteTemplate = async (tmpl: any) => {
    const templateName = tmpl.name ? tmpl.name.split('(')[0].trim() : 'القالب'
    const confirmed = window.confirm(`هل تريد حذف قالب «${templateName}»؟ ستبقى الروشتات السابقة محفوظة.`)
    if (!confirmed) return

    try {
      if (tmpl.isBuiltin) {
        // Built-in template: Hide it for this clinic in Firestore
        setHiddenBuiltinIds(prev => Array.from(new Set([...prev, tmpl.id])))
        if (clinicId) {
          const { arrayUnion } = await import('firebase/firestore')
          await updateDoc(doc(db, 'clinics', clinicId), {
            hiddenProtocolIds: arrayUnion(tmpl.id)
          })
        }
        toast.success(`تم حذف قالب «${templateName}» بنجاح`)
      } else {
        // Custom template: delete doc from rx_protocols
        const { deleteDoc } = await import('firebase/firestore')
        await deleteDoc(doc(db, 'rx_protocols', tmpl.id))
        setCustomProtocols(prev => prev.filter(cp => cp.id !== tmpl.id))
        toast.success(`تم حذف قالب «${templateName}» بنجاح`)
      }
    } catch (err) {
      console.error('Failed to delete template:', err)
      toast.error('حدث خطأ أثناء حذف القالب، يرجى المحاولة مرة أخرى')
    }
  }

  // Pre-load appointment details if appointmentId query parameter is provided
  useEffect(() => {
    if (!appointmentId) return
    const fetchAppt = async () => {
      try {
        const apptSnap = await getDoc(doc(db, 'appointments', appointmentId))
        if (apptSnap.exists()) {
          const data = apptSnap.data()
          if (data.patientName && !patientName) setPatientName(data.patientName)
          if (data.phone && !patientPhone) setPatientPhone(data.phone)
          if ((data.age || data.dob) && !age) setAge(data.age || data.dob)
          if (data.diagnosis && !diagnosis) setDiagnosis(data.diagnosis)
          if (data.instructions && !instructions) setInstructions(data.instructions)
          if (data.notes && !notes) setNotes(data.notes)
          if (data.branch_id && !selectedBranchId) setSelectedBranchId(data.branch_id)
          if (data.branchName && !selectedBranchName) setSelectedBranchName(data.branchName)
          if (data.vitalSigns) {
            setIncludeVitals(true)
            if (data.vitalSigns.bloodPressureSystolic) setBpSys(String(data.vitalSigns.bloodPressureSystolic))
            if (data.vitalSigns.bloodPressureDiastolic) setBpDia(String(data.vitalSigns.bloodPressureDiastolic))
            if (data.vitalSigns.heartRate) setPulse(String(data.vitalSigns.heartRate))
            if (data.vitalSigns.temperature) setTemp(String(data.vitalSigns.temperature))
            if (data.vitalSigns.glucoseLevel) setGlucose(String(data.vitalSigns.glucoseLevel))
            if (data.vitalSigns.weightKg) setWeight(String(data.vitalSigns.weightKg))
          }
          if (data.drugs && Array.isArray(data.drugs) && data.drugs.length > 0) {
            setDrugs(data.drugs.map((d: any, idx: number) => ({ id: Date.now() + idx, ...d })))
          }
        }
      } catch (e) {
        console.error('Error prefetching appointment for prescription:', e)
      }
    }
    fetchAppt()
  }, [appointmentId])

  const isCustomTemplateEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'customTemplate'), [clinic])
  const isDrugsDbEnabled = useMemo(() => isClinicFeatureEnabled(clinic, 'drugs'), [clinic])

  useEffect(() => {
    if (!isCustomTemplateEnabled && templateMode === 'custom') {
      setTemplateMode('standard')
    }
  }, [isCustomTemplateEnabled, templateMode])

  const addDrug = (name = '', dosage = '', duration = '', notes = '') => {
    setDrugs([...drugs, { id: Date.now(), name, dosage, duration, notes }])
  }

  const removeDrug = (id: number) => {
    if (drugs.length === 1) {
      setDrugs([{ id: Date.now(), name: '', dosage: '', duration: '', notes: '' }])
      return
    }
    setDrugs(drugs.filter(d => d.id !== id))
  }

  const updateDrug = (id: number, field: string, value: string) => {
    setDrugs(drugs.map(d => (d.id === id ? { ...d, [field]: value } : d)))
  }

  // TASK 6 & 7: Save Prescription without automated WhatsApp message
  const handleSave = async () => {
    stopGlobalVoiceDictation()
    if (!patientName.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!patientPhone.trim()) return toast.error('يرجى إدخال رقم هاتف المريض')

    setIsSaving(true)
    try {
      if (clinicId) {
        const vitalsData = includeVitals && (bpSys || bpDia || pulse || temp || glucose || weight) ? {
          bloodPressureSystolic: bpSys.trim() ? Number(bpSys.trim()) || bpSys.trim() : null,
          bloodPressureDiastolic: bpDia.trim() ? Number(bpDia.trim()) || bpDia.trim() : null,
          heartRate: pulse.trim() ? Number(pulse.trim()) || pulse.trim() : null,
          temperature: temp.trim() ? Number(temp.trim()) || temp.trim() : null,
          glucoseLevel: glucose.trim() ? Number(glucose.trim()) || glucose.trim() : null,
          weightKg: weight.trim() ? Number(weight.trim()) || weight.trim() : null,
          recordedAt: new Date().toISOString()
        } : null

        const docRef = await addDoc(collection(db, 'prescriptions'), {
          clinic_id: clinicId,
          branch_id: selectedBranchId || clinic?.branchId || '',
          branchName: selectedBranchName || clinic?.branchName || '',
          appointment_id: appointmentId || '',
          patientName,
          patientPhone,
          age,
          diagnosis,
          instructions,
          allergies: patientAllergies || '',
          chronicDiseases: patientChronicDiseases || '',
          notes: notes.trim(),
          vitalSigns: vitalsData,
          date: dateStr,
          status: 'approved',
          doctorName: clinic?.doctorName || 'طبيب العيادة',
          templateMode,
          topOffset,
          pageSize,
          showHeaderFooter,
          printBackground,
          primaryColor,
          secondaryColor,
          drugs: drugs.filter(d => d.name && d.name.trim() !== ''),
          createdAt: new Date().toISOString()
        })

        // Record Audit Log
        try {
          const { recordAuditLog } = await import('@/lib/audit-logger')
          recordAuditLog({
            action: 'PRESCRIPTION_CREATED',
            actorName: clinic?.doctorName || 'طبيب العيادة',
            actorRole: 'doctor',
            clinicId,
            details: { prescriptionId: docRef.id, patientName, patientPhone, appointmentId }
          })
        } catch (e) {}

        if (appointmentId) {
          try {
            await updateDoc(doc(db, 'appointments', appointmentId), {
              diagnosis,
              instructions,
              notes: notes.trim(),
              vitalSigns: vitalsData,
              drugs: drugs.filter(d => d.name && d.name.trim() !== ''),
              allergies: patientAllergies || '',
              chronicDiseases: patientChronicDiseases || '',
              prescription_id: docRef.id,
              prescriptionStatus: 'approved',
              prescription_templateMode: templateMode
            })
          } catch (e) {}
        }

        // Clear local draft on successful save
        if (typeof window !== 'undefined') {
          localStorage.removeItem(draftStorageKey)
        }
        setIsDraftRestored(false)

        if (patientPhone) {
          try {
            const { createClinicNotification } = await import('@/lib/notificationService')
            await createClinicNotification({
              clinicId,
              branchId: selectedBranchId || clinic?.branchId || undefined,
              recipientType: 'patient',
              recipientTarget: patientPhone,
              title: 'تم إصدار الروشتة الطبية 📄',
              body: `تم اعتماد الروشتة الطبية الخاصة بك بواسطة د. ${clinic?.doctorName || 'العيادة'}. يمكنك استعراضها وتحميلها عبر بوابتك الإلكترونية.`,
              type: 'prescription_ready',
              eventId: `rx_ready_${docRef.id}`,
              appointmentId: appointmentId || undefined
            })

            // Dispatch Real Web Push Notification to patient device
            const { triggerPatientEventPush } = await import('@/lib/patientNotificationHelper')
            triggerPatientEventPush({
              type: 'prescription_ready',
              appointmentId: appointmentId || undefined,
              clinicId,
              clinicSlug: slug,
              clinicName: clinic?.clinicName || 'العيادة',
              patientPhone,
              eventId: `push_rx_ready_${docRef.id}`,
            }).catch(() => {})
          } catch (e) {}
        }

        toast.success('تم حفظ واعتماد الروشتة في الملف الطبي بنجاح!')
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الروشتة')
    } finally {
      setIsSaving(false)
    }
  }

  // Real PDF WhatsApp sharing: Opens chat directly with patient's phone number, auto-populates prescription in chat input, press Enter to send
  const handleShareWhatsAppRx = (modeOverride?: 'auto' | 'app' | 'web') => {
    if (!patientPhone) return toast.error('يرجى إدخال رقم هاتف المريض أولاً')

    // 1. Ensure a prescription record ID exists synchronously (0ms) so patient has an active permanent link
    let rxTargetId = appointmentId || ''
    if (clinicId && !rxTargetId) {
      try {
        const newDocRef = doc(collection(db, 'prescriptions'))
        rxTargetId = newDocRef.id
        setDoc(newDocRef, {
          clinic_id: clinicId,
          branch_id: selectedBranchId || clinic?.branchId || '',
          branchName: selectedBranchName || clinic?.branchName || '',
          patientName,
          patientPhone,
          age,
          diagnosis,
          instructions,
          date: dateStr,
          status: 'approved',
          doctorName: clinic?.doctorName || 'طبيب العيادة',
          templateMode,
          topOffset,
          pageSize,
          showHeaderFooter,
          printBackground,
          primaryColor,
          secondaryColor,
          drugs: drugs.filter(d => d.name && d.name.trim() !== ''),
          createdAt: new Date().toISOString()
        }).catch((err) => console.warn('Auto-save prescription warning:', err))
      } catch (err) {
        console.warn('Auto-save prescription warning:', err)
      }
    }

    const host = typeof window !== 'undefined' && window.location.origin
      ? window.location.origin
      : 'https://www.yalla-clinic.com'
    const directRxUrl = rxTargetId ? `${host}/clinic/${slug}/prescription/${rxTargetId}` : ''

    const message = formatPrescriptionWhatsAppMessage({
      clinicName: clinic?.clinicName || 'العيادة الطبية',
      doctorName: clinic?.doctorName,
      specialty: clinic?.specialty,
      patientName: patientName || 'المريض',
      patientAge: age,
      date: dateStr,
      rxNumber: 1042,
      diagnosis,
      instructions,
      notes: notes.trim(),
      drugs: drugs.filter(d => d.name && d.name.trim() !== ''),
      directRxUrl
    })

    const targetMode = modeOverride || whatsappTarget || 'auto'

    // 2. OPEN WHATSAPP CHAT SYNCHRONOUSLY IN 0ms (Guarantees zero popup blocker, opens exact phone, puts Rx in chat!)
    openManualWhatsAppChat({
      phone: patientPhone,
      message,
      target: targetMode
    })

    toast.success(`تم فتح محادثة المريض (${patientPhone}) وإدراج الروشتة في الشات! اضغط Enter للإرسال 🚀`, {
      duration: 5000
    })

    // 3. Optional clipboard image copy in background for Ctrl+V (strictly WITHOUT auto-downloading to computer)
    if (sheetRef.current && typeof navigator !== 'undefined' && navigator.clipboard && window.ClipboardItem) {
      setIsSharingPdf(true)
      import('@/lib/pdfGenerator').then(async ({ renderElementToImageBlob }) => {
        if (!sheetRef.current) return
        const { blob: imgBlob } = await renderElementToImageBlob(sheetRef.current, { scale: 2.2 })
        try {
          await navigator.clipboard.write([
            new ClipboardItem({ 'image/png': imgBlob })
          ])
        } catch {}
      }).catch(() => {}).finally(() => {
        setIsSharingPdf(false)
      })
    }
  }

  // Real Image Download (PNG)
  const handleDownloadImage = async () => {
    if (!sheetRef.current) return
    setIsDownloadingImage(true)
    try {
      const { downloadElementAsImage } = await import('@/lib/pdfGenerator')
      const fileName = generateCleanRxFileName(patientName, dateStr, 'png')
      await downloadElementAsImage(
        sheetRef.current,
        fileName,
        { scale: 2.5 }
      )
      toast.success(`تم تنزيل صورة الروشتة (${fileName}) بنجاح`)
    } catch (e) {
      console.error(e)
      toast.error('تعذر تنزيل صورة الروشتة')
    } finally {
      setIsDownloadingImage(false)
    }
  }

  // Real PDF Download
  const handleDownloadPdf = async () => {
    if (!sheetRef.current) return
    setIsDownloadingPdf(true)
    try {
      const { downloadElementAsPdf } = await import('@/lib/pdfGenerator')
      const fileName = generateCleanRxFileName(patientName, dateStr, 'pdf')
      await downloadElementAsPdf(
        sheetRef.current,
        fileName,
        { format: pageSize, orientation: 'portrait' }
      )
      toast.success(`تم تنزيل ملف الروشتة PDF (${fileName}) بنجاح`)
    } catch (e) {
      console.error(e)
      toast.error('تعذر تنزيل ملف الروشتة')
    } finally {
      setIsDownloadingPdf(false)
    }
  }

  // Clean Isolated Print via iframe
  const handlePrint = () => {
    stopGlobalVoiceDictation()
    const html = generateA4PrescriptionHtml({
      clinicName: clinic?.clinicName || 'Yalla Clinic',
      doctorName: clinic?.doctorName || 'طبيب العيادة',
      specialty: clinic?.specialty,
      degreeTitle: clinic?.certificationTitle,
      branchName: selectedBranchName || clinic?.branchName,
      clinicAddress: clinic?.clinicAddress,
      clinicPhone: clinic?.clinicPhone,
      logoUrl: clinic?.logoUrl,
      patientName: patientName || 'المريض',
      patientAge: age ? String(age) : undefined,
      date: dateStr,
      diagnosis,
      instructions,
      notes,
      vitalSigns: includeVitals ? {
        bloodPressureSystolic: bpSys,
        bloodPressureDiastolic: bpDia,
        heartRate: pulse,
        temperature: temp,
        glucoseLevel: glucose,
        weightKg: weight
      } : null,
      drugs: drugs.filter(d => d.name && d.name.trim() !== ''),
      primaryColor,
      secondaryColor,
      pageSize,
      showHeaderFooter,
      printBackground,
      templateMode,
      topOffset,
      prescriptionTemplateUrl: clinic?.prescriptionTemplateUrl
    })
    printHtmlViaIframe(html, pageSize)
  }

  // Filtered drugs for quick search with bilingual matching (Arabic & English)
  const filteredSearchDrugs = useMemo(() => {
    if (!drugSearch.trim()) return []
    return searchDrugs(drugSearch, 10)
  }, [drugSearch, searchDrugs])

  const handleSelectEgyptianDrug = (d: EgyptianDrug) => {
    const tradeEn = (d.commercial_name_en || d.name || '').trim()
    const tradeAr = (d.commercial_name_ar || d.nameAr || '').trim()
    
    // Construct rich clinical prescription name
    let displayName = tradeEn
    if (tradeEn && tradeAr && tradeEn.toLowerCase() !== tradeAr.toLowerCase()) {
      displayName = `${tradeEn} (${tradeAr})`
    } else if (!displayName) {
      displayName = tradeAr || 'مستحضر دوائي'
    }

    // Smart dosage default based on form
    let defaultDosage = language === 'en' ? '1 tablet every 12 hours' : 'قرص كل 12 ساعة بعد الأكل'
    let defaultDuration = language === 'en' ? 'for 5 days' : 'لمدة 5 أيام'
    const formLower = (d.form || d.route || '').toLowerCase()
    if (formLower.includes('syrup') || formLower.includes('شراب') || formLower.includes('suspension')) {
      defaultDosage = language === 'en' ? '1 tablespoon 3 times daily' : 'ملعقة كبيرة 3 مرات يومياً'
      defaultDuration = language === 'en' ? 'for 5 days' : 'لمدة 5 أيام'
    } else if (formLower.includes('drop') || formLower.includes('نقط')) {
      defaultDosage = language === 'en' ? '3 drops 3 times daily' : '3 نقط 3 مرات يومياً'
      defaultDuration = language === 'en' ? 'for 7 days' : 'لمدة 7 أيام'
    } else if (formLower.includes('cream') || formLower.includes('ointment') || formLower.includes('مرهم') || formLower.includes('كريم') || formLower.includes('gel')) {
      defaultDosage = language === 'en' ? 'Apply twice daily' : 'دهان موضعي مرتين يومياً'
      defaultDuration = language === 'en' ? 'for 10 days' : 'لمدة 10 أيام'
    } else if (formLower.includes('amp') || formLower.includes('vial') || formLower.includes('حقن') || formLower.includes('امبول') || formLower.includes('injection')) {
      defaultDosage = language === 'en' ? '1 ampoule IM when needed' : 'أمبول عضل عند اللزوم'
      defaultDuration = language === 'en' ? 'for 3 days' : 'لمدة 3 أيام'
    }

    const priceVal = d.price_egp || d.price || 0
    const priceText = priceVal > 0 ? (language === 'en' ? `Price: ${priceVal} EGP` : `السعر: ${priceVal} ج.م`) : ''

    addDrug(displayName, defaultDosage, defaultDuration, priceText)
    setDrugSearch('')
  }

  return (
    <div className="p-4 md:p-8 space-y-6 max-w-7xl mx-auto" dir={dir}>
      
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 yalla-card p-5 border border-border shadow-xs">
        <div>
          <h1 className="text-2xl font-black text-foreground flex items-center gap-2">
            <FileSignature className="w-6 h-6 text-primary" />
            {t('issue_rx_title', 'إصدار روشتة طبية (A4 Premium)')}
          </h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            {t('issue_rx_desc', 'تعبئة بيانات الكشف والأدوية مع معاينة فورية وتصدير PDF أصلي')}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Unified Instant WhatsApp Share Button (No download, 0ms popup-free launch, full Rx in chat, Ctrl+V image, Web vs App Selector) */}
          <WhatsAppShareButton
            onSend={(target) => handleShareWhatsAppRx(target)}
            phone={patientPhone}
            loading={isSharingPdf}
            label={t('send_whatsapp_pdf', 'إرسال واتساب للمريض')}
            size="default"
          />

          {/* Real PDF Download */}
          <Button
            onClick={handleDownloadPdf}
            disabled={isDownloadingPdf}
            variant="outline"
            className="h-10 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
            title="Download PDF"
          >
            <Download className="w-4 h-4 ml-1.5" />
            {isDownloadingPdf ? t('loading', 'جاري التحميل...') : t('download_pdf', 'تحميل PDF')}
          </Button>

          {/* Real Image Download */}
          <Button
            onClick={handleDownloadImage}
            disabled={isDownloadingImage}
            variant="outline"
            className="h-10 text-xs font-bold border-border text-foreground hover:bg-secondary rounded-xl"
            title="Download PNG"
          >
            <ImageIcon className="w-4 h-4 ml-1.5" />
            {isDownloadingImage ? t('loading', 'جاري التحميل...') : t('download_img', 'تحميل صورة')}
          </Button>

          {/* Clean Isolated Print */}
          <Button
            onClick={handlePrint}
            variant="outline"
            className="h-10 text-xs font-bold border-primary text-primary hover:bg-primary/10 rounded-xl"
          >
            <Printer className="w-4 h-4 ml-1.5" />
            {t('print_size', 'طباعة')} {pageSize.toUpperCase()}
          </Button>

          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="h-10 px-5 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-md"
          >
            {isSaving ? t('saving', 'جاري الحفظ...') : t('save_rx_to_file', 'اعتماد وحفظ بالملف')}
          </Button>
        </div>
      </div>

      {/* 2. Main Two-Column Layout */}
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        
        {/* RIGHT COLUMN: Form Editor (7 cols) */}
        <div className="lg:col-span-7 space-y-5">

          {/* Patient Details Card */}
          <div className="yalla-card p-5 space-y-4 border border-border">
            <div className="flex items-center justify-between pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <UserIcon className="w-4 h-4 text-primary" />
                {t('patient_visit_info', 'بيانات المريض والزيارة')}
              </h3>

              {filteredTodayPatients.length > 0 && (
                <select
                  className="text-xs font-bold border border-border rounded-xl px-2.5 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20"
                  onChange={(e) => {
                    stopGlobalVoiceDictation()
                    const selected = filteredTodayPatients.find(p => p.id === e.target.value)
                    if (selected) {
                      setPatientName(selected.patientName || '')
                      setAppointmentId(selected.id)
                      setPatientPhone(selected.phone || '')
                      setAge(selected.age || selected.dob || '')
                      if (selected.allergies) {
                        setPatientAllergies(Array.isArray(selected.allergies) ? selected.allergies.join('، ') : String(selected.allergies))
                      }
                      if (selected.chronicDiseases) {
                        setPatientChronicDiseases(Array.isArray(selected.chronicDiseases) ? selected.chronicDiseases.join('، ') : String(selected.chronicDiseases))
                      }
                      if (selected.branch_id) setSelectedBranchId(selected.branch_id)
                      if (selected.branchName) setSelectedBranchName(selected.branchName)
                      if (selected.vitalSigns) {
                        setVitalsBpSys(selected.vitalSigns.bloodPressureSystolic ? String(selected.vitalSigns.bloodPressureSystolic) : '')
                        setVitalsBpDia(selected.vitalSigns.bloodPressureDiastolic ? String(selected.vitalSigns.bloodPressureDiastolic) : '')
                        setVitalsPulse(selected.vitalSigns.heartRate ? String(selected.vitalSigns.heartRate) : '')
                        setVitalsTemp(selected.vitalSigns.temperature ? String(selected.vitalSigns.temperature) : '')
                        setVitalsGlucose(selected.vitalSigns.glucoseLevel ? String(selected.vitalSigns.glucoseLevel) : (selected.vitalSigns.bloodGlucose ? String(selected.vitalSigns.bloodGlucose) : ''))
                        setVitalsWeight(selected.vitalSigns.weightKg ? String(selected.vitalSigns.weightKg) : (selected.vitalSigns.weight ? String(selected.vitalSigns.weight) : ''))
                      } else {
                        setVitalsBpSys('')
                        setVitalsBpDia('')
                        setVitalsPulse('')
                        setVitalsTemp('')
                        setVitalsGlucose('')
                        setVitalsWeight('')
                      }
                    }
                  }}
                >
                  <option value="">{t('select_from_today_patients', '-- اختر من كشوفات اليوم --')}</option>
                  {filteredTodayPatients.map(p => (
                    <option key={p.id} value={p.id}>
                      #{p.queue_number} - {p.patientName} {p.branchName ? `(${tDynamic(p.branchName)})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid sm:grid-cols-3 gap-3">
              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">{t('patient_name', 'اسم المريض')}</Label>
                <Input
                  value={patientName}
                  onChange={e => setPatientName(e.target.value)}
                  placeholder={t('patient_name', 'اسم المريض')}
                  className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">{t('phone', 'رقم الهاتف')}</Label>
                <PhoneInputWithCountry
                  value={patientPhone}
                  onChange={(fullNumber) => setPatientPhone(fullNumber)}
                  size="sm"
                />
              </div>

              <div className="sm:col-span-1 space-y-1">
                <Label className="text-xs font-bold text-muted-foreground">{t('patient_age', 'السن')}</Label>
                <Input
                  value={age}
                  onChange={e => setAge(e.target.value)}
                  placeholder={language === 'en' ? 'e.g., 32 years' : 'مثال: 32 سنة'}
                  className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
                />
              </div>
            </div>

            {/* Medical Flags: Allergies & Chronic Diseases input drawer */}
            <div className="pt-2 border-t border-border/70 space-y-2">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setShowAllergiesInput(!showAllergiesInput)}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
                >
                  <HeartPulse className="w-3.5 h-3.5 text-rose-500" />
                  <span>{patientAllergies || patientChronicDiseases ? 'تعديل الحساسية والأمراض المزمنة للمريض' : '+ تسجيل حساسية الأدوية والأمراض المزمنة'}</span>
                </button>
                {(patientAllergies || patientChronicDiseases) && (
                  <Badge variant="outline" className="text-[10px] border-rose-500/30 text-rose-600 bg-rose-500/10">
                    تم تسجيل محاذير طبية
                  </Badge>
                )}
              </div>

              {(showAllergiesInput || patientAllergies || patientChronicDiseases) && (
                <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-xl bg-secondary/40 border border-border">
                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-rose-600 dark:text-rose-400 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" />
                      <span>حساسية الأدوية (مثال: بنسلين، سلفا، أسبرين)</span>
                    </Label>
                    <Input
                      value={patientAllergies}
                      onChange={e => setPatientAllergies(e.target.value)}
                      placeholder="اكتب أي حساسية دوائية هنا..."
                      className="h-9 text-xs rounded-lg bg-background border-rose-500/30 text-foreground"
                    />
                  </div>

                  <div className="space-y-1">
                    <Label className="text-[11px] font-bold text-amber-600 dark:text-amber-400 flex items-center gap-1">
                      <Activity className="w-3 h-3" />
                      <span>أمراض مزمنة (مثال: ضغط، سكر، ربو، كلى)</span>
                    </Label>
                    <Input
                      value={patientChronicDiseases}
                      onChange={e => setPatientChronicDiseases(e.target.value)}
                      placeholder="اكتب الأمراض المزمنة إن وجدت..."
                      className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                    />
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground">{t('clinical_diagnosis', 'التشخيص الطبي')}</Label>
                <VoiceDictationButton
                  fieldId="diagnosis"
                  fieldLabel={t('clinical_diagnosis', 'التشخيص الطبي')}
                  value={diagnosis}
                  onChange={setDiagnosis}
                  inputRef={diagnosisInputRef}
                  language={dictationLang}
                  onLanguageChange={setDictationLang}
                  size="sm"
                />
              </div>
              <Input
                ref={diagnosisInputRef}
                value={diagnosis}
                onChange={e => setDiagnosis(e.target.value)}
                placeholder={t('diagnosis_placeholder', 'التشخيص الإكلينيكي للحالة')}
                className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-bold text-muted-foreground">{t('doctor_instructions', 'تعليمات وإرشادات الطبيب للمريض')}</Label>
                <VoiceDictationButton
                  fieldId="instructions"
                  fieldLabel={t('doctor_instructions', 'تعليمات وإرشادات الطبيب للمريض')}
                  value={instructions}
                  onChange={setInstructions}
                  inputRef={instructionsInputRef}
                  language={dictationLang}
                  onLanguageChange={setDictationLang}
                  size="sm"
                />
              </div>
              <Input
                ref={instructionsInputRef}
                value={instructions}
                onChange={e => setInstructions(e.target.value)}
                placeholder={t('doctor_instructions_placeholder', 'مثال: شرب سوائل دافئة، الراحة التامة، العودة للاستشارة بعد أسبوع')}
                className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-bold text-muted-foreground">{t('clinical_notes', 'خانة الملاحظات الطبية / ملاحظات إضافية')}</Label>
              <textarea
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder={t('clinical_notes_placeholder', 'ملاحظات الطبيب، المتابعة السريرية، التاريخ المرضي، أو أي ملاحظات تخص المريض...')}
                className="w-full min-h-[72px] p-3 text-xs rounded-xl bg-background border border-border text-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-y"
                rows={2}
              />
            </div>
          </div>

          {/* Vital Signs Card (العلامات الحيوية - يحدد الطبيب كتابتها من عدمه) */}
          <div className="yalla-card p-4 space-y-3 border border-border">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4 text-rose-500" />
                <h4 className="font-bold text-xs text-foreground">
                  العلامات الحيوية (Vital Signs)
                </h4>
                <Badge variant="outline" className={`text-[10px] font-bold ${includeVitals ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20' : 'bg-secondary text-muted-foreground'}`}>
                  {includeVitals ? 'مدرجة بالروشتة والملف' : 'مخفية'}
                </Badge>
              </div>

              <label className="flex items-center gap-2 cursor-pointer select-none text-xs font-bold text-foreground">
                <input
                  type="checkbox"
                  checked={includeVitals}
                  onChange={(e) => setIncludeVitals(e.target.checked)}
                  className="rounded text-primary focus:ring-primary w-4 h-4 cursor-pointer"
                />
                <span>كتابة العلامات الحيوية</span>
              </label>
            </div>

            {includeVitals ? (
              <div className="grid grid-cols-2 sm:grid-cols-6 gap-2.5 pt-1">
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-muted-foreground">ضغط (SYS)</Label>
                  <Input
                    value={bpSys}
                    onChange={e => setBpSys(e.target.value)}
                    placeholder="120"
                    className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-muted-foreground">ضغط (DIA)</Label>
                  <Input
                    value={bpDia}
                    onChange={e => setBpDia(e.target.value)}
                    placeholder="80"
                    className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-muted-foreground">نبض (HR bpm)</Label>
                  <Input
                    value={pulse}
                    onChange={e => setPulse(e.target.value)}
                    placeholder="75"
                    className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-muted-foreground">حرارة (°C)</Label>
                  <Input
                    value={temp}
                    onChange={e => setTemp(e.target.value)}
                    placeholder="37.0"
                    className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-muted-foreground">سكر (mg/dL)</Label>
                  <Input
                    value={glucose}
                    onChange={e => setGlucose(e.target.value)}
                    placeholder="100"
                    className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                    dir="ltr"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[10.5px] font-bold text-muted-foreground">وزن (kg)</Label>
                  <Input
                    value={weight}
                    onChange={e => setWeight(e.target.value)}
                    placeholder="70"
                    className="h-9 text-xs rounded-lg bg-background border-border text-foreground"
                    dir="ltr"
                  />
                </div>
              </div>
            ) : (
              <p className="text-[11px] text-muted-foreground">
                العلامات الحيوية غير مفعلة، ولن تظهر بالروشتة وتختفي تماماً من ملف المريض. فعّل الخيار أعلاه لإدخالها.
              </p>
            )}
          </div>

          {/* High-Alert Allergy Banner (Pulsing VisionOS card when patient has recorded allergies) */}
          {patientAllergies && (
            <motion.div
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-4 rounded-2xl bg-rose-500/10 border-2 border-rose-500/40 text-rose-800 dark:text-rose-200 shadow-[0_0_25px_rgba(239,68,68,0.2)] flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="w-5 h-5 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5 animate-bounce" />
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-black text-sm text-rose-700 dark:text-rose-300">
                      ⚠️ تحذير طبي مشدد: المريض لديه حساسية دوائية مسجلة
                    </span>
                    <Badge variant="destructive" className="animate-pulse text-[10px] font-bold px-1.5 py-0">High Alert</Badge>
                  </div>
                  <p className="text-xs font-bold leading-relaxed">
                    حساسية مسجلة: <span className="bg-rose-500/20 px-2 py-0.5 rounded-md text-rose-900 dark:text-rose-100 font-black">{patientAllergies}</span>
                    {patientChronicDiseases && (
                      <span className="ms-2">
                        • أمراض مزمنة: <span className="bg-amber-500/20 px-2 py-0.5 rounded-md text-amber-900 dark:text-amber-200 font-bold">{patientChronicDiseases}</span>
                      </span>
                    )}
                  </p>
                  <p className="text-[11px] text-rose-600/90 dark:text-rose-400/90">
                    سيقوم النظام تلقائياً بفحص الأدوية وتنبيهك فوراً إذا كان أي دواء يحتوي على مشتقات تتعارض مع هذه الحساسية.
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setShowAllergiesInput(true)}
                className="text-xs font-bold text-rose-700 dark:text-rose-300 hover:bg-rose-500/20 rounded-lg h-7 px-2 cursor-pointer"
              >
                تعديل
              </Button>
            </motion.div>
          )}

          {/* Medicines Prescription Section */}
          <div className="yalla-card p-5 space-y-4 border border-border">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border">
              <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
                <FileText className="w-4 h-4 text-primary" />
                {t('rx_medications', 'الأدوية والعلاج المطلوب (Rx)')}
              </h3>
              <div className="flex items-center gap-2">
                {/* Global Prescription Dictation Language Pill */}
                <div
                  className="flex items-center gap-1 bg-secondary/80 px-2 py-1 rounded-xl border border-border text-[11px]"
                  title="تغيير لغة الإملاء الصوتي لكافة الحقول (عربي / إنجليزي)"
                >
                  <span className="text-muted-foreground font-medium">الإملاء:</span>
                  <button
                    type="button"
                    onClick={() => setDictationLang('ar-EG')}
                    className={`px-1.5 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                      dictationLang === 'ar-EG'
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    عربي
                  </button>
                  <span className="text-border">|</span>
                  <button
                    type="button"
                    onClick={() => setDictationLang('en-US')}
                    className={`px-1.5 py-0.5 rounded-md font-bold transition-colors cursor-pointer ${
                      dictationLang === 'en-US'
                        ? 'bg-primary text-primary-foreground shadow-2xs'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    EN
                  </button>
                </div>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => addDrug()}
                  className="h-8 text-xs font-bold border-primary text-primary hover:bg-primary/10 rounded-lg gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('add_new_drug', 'إضافة دواء جديد')}
                </Button>
              </div>
            </div>

            {/* Doctor's Starred Favorite Drugs from Drug Directory */}
            {isDrugsDbEnabled ? (
              <>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-foreground flex items-center gap-1.5">
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
                      {t('favorite_drugs', 'الأدوية المفضلة (دليل الأدوية):')}
                      {favoriteDrugs.length > 0 && (
                        <span className="text-[10px] bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.2 rounded-md font-bold">
                          {favoriteDrugs.length}
                        </span>
                      )}
                    </span>
                    <Link
                      href={`/clinic/${slug}/admin/drugs`}
                      className="text-[11px] text-primary hover:underline font-bold flex items-center gap-1"
                      title={language === 'en' ? 'Manage favorite drugs in Directory' : 'إدارة وتحديد الأدوية المفضلة من دليل الأدوية'}
                    >
                      <span>{language === 'en' ? 'Drug Directory' : 'دليل الأدوية'}</span>
                      <ExternalLink className="w-3 h-3" />
                    </Link>
                  </div>

                  {favoriteDrugs.length > 0 ? (
                    <div className="flex flex-wrap gap-1.5">
                      {favoriteDrugs.map((fav, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => addDrug(fav, language === 'en' ? '1 tablet q12h' : 'قرص كل 12 ساعة', language === 'en' ? 'for 5 days' : 'لمدة 5 أيام')}
                          className="px-2.5 py-1 text-[11px] font-bold bg-amber-500/10 hover:bg-amber-500/20 text-amber-800 dark:text-amber-300 border border-amber-500/20 hover:border-amber-500/40 rounded-lg transition-colors cursor-pointer flex items-center gap-1 active:scale-95"
                          title={language === 'en' ? `Add ${fav} to prescription` : `إضافة ${fav} إلى الروشتة`}
                        >
                          <Plus className="w-3 h-3 text-amber-600 dark:text-amber-400" />
                          <span>{fav}</span>
                        </button>
                      ))}
                    </div>
                  ) : (
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground bg-muted/30 px-3 py-2 rounded-xl border border-dashed border-border">
                      <div className="flex items-center gap-2">
                        <Star className="w-3.5 h-3.5 text-amber-500/60" />
                        <span>{language === 'en' ? 'No favorite drugs selected yet.' : 'لم تقم بتحديد أدوية مفضلة بعد.'}</span>
                      </div>
                      <Link
                        href={`/clinic/${slug}/admin/drugs`}
                        className="text-primary hover:underline font-bold text-[11px] flex items-center gap-1"
                      >
                        <span>{language === 'en' ? 'Add favorites with ⭐ in Drug Directory' : 'حدد أدويتك المفضلة بنجمة ⭐ من دليل الأدوية'}</span>
                        <ExternalLink className="w-3 h-3" />
                      </Link>
                    </div>
                  )}
                </div>

                {/* Drug Search Input with Voice & Autocomplete */}
                <div className="relative">
                  <div className="relative flex items-center">
                    <Search className="w-4 h-4 absolute end-3 top-3 text-muted-foreground pointer-events-none" />
                    <Input
                      value={drugSearch}
                      onChange={e => setDrugSearch(e.target.value)}
                      placeholder={t('search_egyptian_drugs', 'ابحث باسم الدواء (عربي أو إنجليزي)...')}
                      className="h-10 pe-16 text-xs rounded-xl bg-background border-border text-foreground"
                    />
                    <div className="absolute end-8 flex items-center">
                      <VoiceDictationButton
                        fieldId="drug-search"
                        fieldLabel="البحث في الأدوية"
                        value={drugSearch}
                        onChange={setDrugSearch}
                        language={dictationLang}
                        onLanguageChange={setDictationLang}
                        size="sm"
                        showLanguagePill={false}
                        showStatusBadge={false}
                      />
                    </div>
                  </div>

                  {/* Bilingual Autocomplete Dropdown */}
                  {drugSearch.trim().length > 0 && (
                    <div className="absolute top-full start-0 w-full mt-1 bg-card border border-border shadow-2xl rounded-2xl z-50 overflow-hidden divide-y divide-border">
                      {filteredSearchDrugs.length > 0 ? (
                        <>
                          <div className="p-2 bg-secondary/50 text-[11px] font-bold text-muted-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1.5">
                              <Sparkles className="w-3.5 h-3.5 text-primary" />
                              {language === 'en' ? 'Egyptian Drug Database Matches' : 'الأدوية المطابقة (دليل دواء مصر)'}
                            </span>
                            <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-black">
                              {filteredSearchDrugs.length} {language === 'en' ? 'results' : 'نتائج'}
                            </span>
                          </div>
                          <div className="max-h-64 overflow-y-auto divide-y divide-border">
                            {filteredSearchDrugs.map((d, idx) => {
                              const tradeAr = d.commercial_name_ar || d.nameAr || ''
                              const tradeEn = d.commercial_name_en || d.name || ''
                              const priceVal = d.price_egp || d.price || 0
                              return (
                                <button
                                  key={d.id || idx}
                                  type="button"
                                  onClick={() => handleSelectEgyptianDrug(d)}
                                  className="w-full text-start p-2.5 hover:bg-primary/5 transition-colors cursor-pointer flex items-center justify-between gap-3 group"
                                >
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      <span className="font-black text-xs text-foreground group-hover:text-primary transition-colors">
                                        {tradeAr || tradeEn}
                                      </span>
                                      {tradeAr && tradeEn && (
                                        <span className="text-[11px] font-mono text-muted-foreground">
                                          ({tradeEn})
                                        </span>
                                      )}
                                    </div>
                                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground flex-wrap">
                                      {d.form && (
                                        <span className="bg-secondary px-1.5 py-0.5 rounded text-[10px] font-semibold text-foreground/80">
                                          {tDynamic(d.form)}
                                        </span>
                                      )}
                                      {(d.activeIngredient || d.scientific_name) && (
                                        <span className="truncate max-w-[170px] font-mono">
                                          {d.activeIngredient || d.scientific_name}
                                        </span>
                                      )}
                                      {(d.company || d.manufacturer) && (
                                        <span className="truncate max-w-[110px]">
                                          • {d.company || d.manufacturer}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  <div className="shrink-0 flex flex-col items-end gap-1">
                                    {priceVal > 0 ? (
                                      <span className="px-2 py-0.5 rounded-lg text-[11px] font-black bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                                        {priceVal} {language === 'en' ? 'EGP' : 'ج.م'}
                                      </span>
                                    ) : (
                                      <span className="text-[10px] text-muted-foreground">
                                        {language === 'en' ? 'Official' : 'تسعيرة معتمدة'}
                                      </span>
                                    )}
                                    <span className="text-[9px] font-bold text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                                      + {language === 'en' ? 'Add' : 'إضافة للروشتة'}
                                    </span>
                                  </div>
                                </button>
                              )
                            })}
                          </div>

                          {/* National Directory Direct Live Query Option */}
                          <div className="p-2 bg-secondary/30 flex items-center justify-between gap-2 border-t border-border">
                            <span className="text-[10px] text-muted-foreground flex items-center gap-1">
                              <Globe className="w-3 h-3 text-primary shrink-0" />
                              <span>{language === 'en' ? 'Official Drug Directory Search (27,600+ drugs)' : 'بحث مباشر في دليل الأدوية المصرية (27,600+ دواء)'}</span>
                            </span>
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              disabled={isLiveSyncing}
                              onClick={async (e) => {
                                e.preventDefault()
                                e.stopPropagation()
                                setIsLiveSyncing(true)
                                try {
                                  await syncDrugLive(drugSearch)
                                  toast.success(language === 'en' ? 'Catalog updated with official market prices' : 'تم تحديث البيانات بالأسعار الرسمية المعتمدة')
                                } finally {
                                  setIsLiveSyncing(false)
                                }
                              }}
                              className="h-6 text-[10px] font-black px-2 bg-primary/10 hover:bg-primary text-primary hover:text-white border-primary/20 rounded-lg cursor-pointer"
                            >
                              {isLiveSyncing ? (
                                <>
                                  <Loader2 className="w-2.5 h-2.5 animate-spin me-1" />
                                  <span>{language === 'en' ? 'Syncing...' : 'جاري الفحص...'}</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-2.5 h-2.5 me-1" />
                                  <span>{language === 'en' ? 'Sync live' : 'فحص ومطابقة'}</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <div className="p-4 text-center space-y-2.5">
                          <p className="text-xs text-muted-foreground font-semibold">
                            {language === 'en'
                              ? `No local matches found for "${drugSearch}"`
                              : `لم يتم العثور على دواء محلي مطابق لـ «${drugSearch}»`}
                          </p>
                          <Button
                            type="button"
                            size="sm"
                            disabled={isLiveSyncing}
                            onClick={async () => {
                              setIsLiveSyncing(true)
                              try {
                                const found = await syncDrugLive(drugSearch)
                                if (found && found.length > 0) {
                                  toast.success(language === 'en' ? `Found ${found.length} medications` : `تم العثور على ${found.length} مستحضر دوائي`)
                                } else {
                                  toast.info(language === 'en' ? 'No medications found for this search' : 'لم يتم العثور على أدوية مطابقة بهذا الاسم')
                                }
                              } finally {
                                setIsLiveSyncing(false)
                              }
                            }}
                            className="h-8 text-xs font-black yalla-gradient-btn text-white rounded-xl shadow-md cursor-pointer mx-auto"
                          >
                            {isLiveSyncing ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin me-1.5" />
                                <span>{language === 'en' ? 'Searching national directory...' : 'جارٍ البحث في دليل الأدوية المعتمدة (27,600+)...'}</span>
                              </>
                            ) : (
                              <>
                                <Sparkles className="w-3.5 h-3.5 me-1.5" />
                                <span>{language === 'en' ? `Search national directory for "${drugSearch}"` : `بحث مباشر في سجل الأدوية عن «${drugSearch}»`}</span>
                              </>
                            )}
                          </Button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-400 flex items-center gap-2">
                <Lock className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
                <span>{language === 'en' ? 'Egyptian Drug Database is not activated on your current subscription plan. You can type medication names and dosages manually below.' : 'دليل وقاعدة الأدوية المصرية غير مفعلة في باقة اشتراكك الحالية. يمكنك كتابة أسماء الأدوية والجرعات يدوياً بالأسفل.'}</span>
              </div>
            )}

            {/* Drugs List Rows */}
            <div className="space-y-3 pt-2">
              {drugs.map((drug, index) => {
                const conflictWarning = getDrugAllergyConflict(drug.name, patientAllergies)
                return (
                  <div
                    key={drug.id}
                    className={`p-3.5 rounded-xl border transition-all space-y-2.5 ${
                      conflictWarning
                        ? 'border-rose-500/70 bg-rose-500/10 shadow-[0_0_18px_rgba(239,68,68,0.25)]'
                        : 'border-border bg-secondary/30'
                    }`}
                  >
                    {conflictWarning && (
                      <div className="flex items-center gap-2 p-2.5 rounded-lg bg-rose-500/20 border border-rose-500/40 text-rose-700 dark:text-rose-300 text-xs font-bold animate-pulse">
                        <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600 dark:text-rose-400" />
                        <span>{conflictWarning}</span>
                      </div>
                    )}

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-black text-muted-foreground">{t('drug_num', 'دواء')} #{index + 1}</span>
                        <VoiceDictationButton
                          fieldId={`drug-row-${drug.id}`}
                          fieldLabel={`الدواء #${index + 1}`}
                          value={drug.name}
                          onChange={val => updateDrug(drug.id, 'name', val)}
                          language={dictationLang}
                          onLanguageChange={setDictationLang}
                          size="sm"
                          showLanguagePill={true}
                          showStatusBadge={true}
                        />
                      </div>
                      <button
                        onClick={() => removeDrug(drug.id)}
                        className="text-muted-foreground hover:text-rose-500 transition-colors cursor-pointer"
                        title={t('delete', 'حذف')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                  <div className="grid sm:grid-cols-12 gap-2">
                    <div className="sm:col-span-5">
                      <div className="relative flex items-center">
                        <Input
                          value={drug.name}
                          onChange={e => updateDrug(drug.id, 'name', e.target.value)}
                          placeholder={t('trade_drug_name', 'اسم الدواء التجاري')}
                          className="h-9 pe-8 text-xs rounded-lg bg-background border-border text-foreground"
                        />
                        <div className="absolute end-1 flex items-center">
                          <VoiceDictationButton
                            fieldId={`drug-name-${drug.id}`}
                            fieldLabel={`${t('trade_drug_name', 'اسم الدواء')} #${index + 1}`}
                            value={drug.name}
                            onChange={val => updateDrug(drug.id, 'name', val)}
                            language={dictationLang}
                            onLanguageChange={setDictationLang}
                            size="sm"
                            showLanguagePill={false}
                            showStatusBadge={false}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-4">
                      <div className="relative flex items-center">
                        <Input
                          value={drug.dosage}
                          onChange={e => updateDrug(drug.id, 'dosage', e.target.value)}
                          placeholder={t('dosage_label', 'الجرعة (مثال: قرص كل 12 ساعة)')}
                          className="h-9 pe-8 text-xs rounded-lg bg-background border-border text-foreground"
                        />
                        <div className="absolute end-1 flex items-center">
                          <VoiceDictationButton
                            fieldId={`drug-dosage-${drug.id}`}
                            fieldLabel={`${t('dosage_label', 'الجرعة')} #${index + 1}`}
                            value={drug.dosage}
                            onChange={val => updateDrug(drug.id, 'dosage', val)}
                            language={dictationLang}
                            onLanguageChange={setDictationLang}
                            size="sm"
                            showLanguagePill={false}
                            showStatusBadge={false}
                          />
                        </div>
                      </div>
                    </div>
                    <div className="sm:col-span-3">
                      <div className="relative flex items-center">
                        <Input
                          value={drug.duration}
                          onChange={e => updateDrug(drug.id, 'duration', e.target.value)}
                          placeholder={t('duration_label', 'المدة (مثال: 5 أيام)')}
                          className="h-9 pe-8 text-xs rounded-lg bg-background border-border text-foreground"
                        />
                        <div className="absolute end-1 flex items-center">
                          <VoiceDictationButton
                            fieldId={`drug-duration-${drug.id}`}
                            fieldLabel={`${t('duration_label', 'المدة')} #${index + 1}`}
                            value={drug.duration}
                            onChange={val => updateDrug(drug.id, 'duration', val)}
                            language={dictationLang}
                            onLanguageChange={setDictationLang}
                            size="sm"
                            showLanguagePill={false}
                            showStatusBadge={false}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
            </div>

            {/* Medical Review Disclaimer / Reminder Banner */}
            <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5">
              <ShieldCheck className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="font-bold">تنبيه طبي لمراجعة الأدوية والجرعات:</p>
                <p className="text-[11px] opacity-90 leading-relaxed">
                  يتم تحويل الصوت كما نُطق تماماً دون اختراع أو تعديل تلقائي للجرعات أو الأسماء. يُرجى دائمًا مراجعة وتدقيق أسماء الأدوية والجرعات والتأكد منها قبل اعتماد الروشتة وحفظها.
                </p>
              </div>
            </div>
          </div>

          </div>

        {/* LEFT COLUMN: Live A4 Prescription Preview (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          
          {/* Template & Paper Size Designer Controls */}
          <div className="p-3.5 yalla-card rounded-2xl border border-border space-y-3 shadow-2xs">
            {/* Row 1: Option A vs Option B */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-border">
              <span className="text-xs font-black text-foreground">{t('rx_template', 'قالب الروشتة:')}</span>
              <div className="flex items-center gap-1.5 bg-secondary p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setTemplateMode('standard')}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                    templateMode === 'standard'
                      ? 'bg-card text-primary shadow-xs ring-1 ring-primary/30'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <span>{t('template_luxury_b', 'Option B (النموذج الفاخر)')}</span>
                  {templateMode === 'standard' && <Check className="w-3.5 h-3.5 text-primary" />}
                </button>
                {isCustomTemplateEnabled ? (
                  <button
                    type="button"
                    onClick={() => {
                      if (!clinic?.prescriptionTemplateUrl) {
                        toast.info(language === 'en' ? 'No custom prescription design uploaded for this clinic yet from Owner Dashboard' : 'لم يتم رفع تصميم روشتة مخصص لهذه العيادة من لوحة المالك بعد')
                      } else {
                        setTemplateMode('custom')
                      }
                    }}
                    className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 ${
                      templateMode === 'custom'
                        ? 'bg-card text-primary shadow-xs ring-1 ring-primary/30'
                        : 'text-muted-foreground hover:text-foreground'
                    }`}
                  >
                    <span>{t('template_clinic_a', 'Option A (تصميم العيادة)')}</span>
                    {templateMode === 'custom' ? (
                      <Check className="w-3.5 h-3.5 text-primary" />
                    ) : clinic?.prescriptionTemplateUrl ? (
                      <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 rounded-md font-normal">
                        {language === 'en' ? 'Available' : 'متاح'}
                      </span>
                    ) : null}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      toast.error(language === 'en' ? 'Custom template (Option A) is locked in your plan. Please upgrade to unlock.' : 'ميزة قالب الروشتة المخصص (Option A) مقفولة في باقة اشتراكك الحالية. يرجى الترقية لتفعيلها.')
                    }}
                    className="px-3 py-1.5 text-xs font-bold rounded-lg transition-all cursor-not-allowed opacity-60 flex items-center gap-1 text-muted-foreground bg-secondary/50"
                    title={language === 'en' ? 'Feature locked on your plan' : 'ميزة مقفولة في باقتك الحالية'}
                  >
                    <Lock className="w-3 h-3 text-amber-600" />
                    {language === 'en' ? 'Option A (Locked)' : 'Option A (مقفول)'}
                  </button>
                )}
              </div>
            </div>

            {/* Row 2: Paper Size A4 vs A5 */}
            <div className="flex items-center justify-between text-xs pb-2.5 border-b border-border">
              <span className="font-bold text-foreground">{t('paper_size', 'مقاس الورق:')}</span>
              <div className="flex items-center gap-1.5 bg-secondary p-1 rounded-lg">
                <button
                  type="button"
                  onClick={() => setPageSize('a4')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    pageSize === 'a4'
                      ? 'bg-card text-primary shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('paper_a4', 'A4 (ورق كامل)')}
                </button>
                <button
                  type="button"
                  onClick={() => setPageSize('a5')}
                  className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${
                    pageSize === 'a5'
                      ? 'bg-card text-primary shadow-xs'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  {t('paper_a5', 'A5 (نصف ورقة)')}
                </button>
              </div>
            </div>

            {/* Row 3: Printing Toggles */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs pt-0.5">
              <label className="flex items-center gap-2 cursor-pointer font-bold text-muted-foreground select-none">
                <input
                  type="checkbox"
                  checked={showHeaderFooter}
                  onChange={(e) => setShowHeaderFooter(e.target.checked)}
                  className="rounded text-primary focus:ring-primary"
                />
                <span>{t('show_header_footer', 'إظهار الترويسة والفوتر (تعطيل للورق الجاهز)')}</span>
              </label>

              {templateMode === 'custom' && (
                <label className="flex items-center gap-2 cursor-pointer font-bold text-muted-foreground select-none">
                  <input
                    type="checkbox"
                    checked={printBackground}
                    onChange={(e) => setPrintBackground(e.target.checked)}
                    className="rounded text-primary focus:ring-primary"
                  />
                  <span>{t('print_bg_image', 'طباعة صورة الخلفية (تفعيل للـ PDF)')}</span>
                </label>
              )}
            </div>

            {/* Custom Template Top Offset Slider */}
            {templateMode === 'custom' && clinic?.prescriptionTemplateUrl && (
              <div className="pt-2 border-t border-border flex items-center justify-between text-xs text-muted-foreground">
                <span className="font-medium text-[11px]">{t('top_offset', 'إزاحة البداية من أعلى:')}</span>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min="5"
                    max="55"
                    step="1"
                    value={topOffset}
                    onChange={e => setTopOffset(Number(e.target.value))}
                    className="w-28 accent-primary"
                  />
                  <span className="font-mono text-[11px] text-primary font-bold">{topOffset}%</span>
                </div>
              </div>
            )}
          </div>

          {/* Prescription Preview Zoom & Scale Bar */}
          <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 rounded-xl border border-border bg-card shadow-2xs text-xs">
            <div className="flex items-center gap-2 font-bold text-foreground">
              <Eye className="w-4 h-4 text-primary" />
              <span>{t('preview_scaling', 'معاينة الروشتة:')}</span>
              <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">
                {pageSize.toUpperCase()} ({naturalWidth}×{naturalHeight}px)
              </Badge>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setZoomMode('fit')}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  zoomMode === 'fit'
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                }`}
                title={t('fit_width_tooltip', 'ملاءمة العرض بنسبة وتناسب مع الشاشة')}
              >
                {t('fit_width', 'ملاءمة العرض')}
              </button>

              <button
                type="button"
                onClick={() => {
                  setZoomMode('custom')
                  setManualScale(1)
                }}
                className={`px-2.5 py-1 text-xs font-bold rounded-lg transition-all cursor-pointer ${
                  zoomMode === 'custom' && manualScale === 1
                    ? 'bg-primary text-primary-foreground shadow-xs'
                    : 'bg-secondary hover:bg-secondary/80 text-muted-foreground'
                }`}
                title={t('actual_size_tooltip', 'الحجم الطبيعي الأصلي 100%')}
              >
                100%
              </button>

              <div className="flex items-center bg-secondary rounded-lg p-0.5">
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode('custom')
                    setManualScale(prev => Math.max(0.3, Number((prev - 0.1).toFixed(2))))
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title={t('zoom_out', 'تصغير')}
                  aria-label={t('zoom_out', 'تصغير')}
                >
                  <ZoomOut className="w-3.5 h-3.5" />
                </button>
                <span className="font-mono text-[11px] font-bold text-foreground px-1.5 min-w-[42px] text-center">
                  {Math.round(currentScale * 100)}%
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setZoomMode('custom')
                    setManualScale(prev => Math.min(1.5, Number((prev + 0.1).toFixed(2))))
                  }}
                  className="p-1 rounded-md text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
                  title={t('zoom_in', 'تكبير')}
                  aria-label={t('zoom_in', 'تكبير')}
                >
                  <ZoomIn className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          {/* Scaled Preview Viewport */}
          <div
            ref={previewContainerRef}
            className="w-full rounded-2xl border border-border bg-slate-100/70 dark:bg-slate-900/40 p-2 sm:p-3 overflow-auto flex justify-center transition-all shadow-inner"
          >
            <div
              style={{
                width: `${Math.round(naturalWidth * currentScale)}px`,
                height: `${Math.round(naturalHeight * currentScale)}px`,
                position: 'relative',
                overflow: 'hidden',
                flexShrink: 0,
                transition: 'width 0.12s ease-out, height 0.12s ease-out',
              }}
              className="rounded-xl shadow-xl border border-border/80 bg-white"
            >
              <div
                style={{
                  width: `${naturalWidth}px`,
                  minHeight: `${naturalHeight}px`,
                  transform: `scale(${currentScale})`,
                  transformOrigin: 'top left',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                <div ref={sheetRef} className="bg-white">
                  <A4Prescription
                    clinic={clinic}
                    patientName={patientName || t('patient_name', 'اسم المريض')}
                    age={age ? String(age) : ''}
                    date={dateStr}
                    diagnosis={diagnosis}
                    drugs={drugs.filter(d => d.name && d.name.trim() !== '')}
                    instructions={instructions}
                    notes={notes}
                    vitalSigns={includeVitals ? {
                      bloodPressureSystolic: bpSys,
                      bloodPressureDiastolic: bpDia,
                      heartRate: pulse,
                      temperature: temp,
                      glucoseLevel: glucose,
                      weightKg: weight
                    } : null}
                    templateMode={templateMode}
                    topOffset={topOffset}
                    primaryColor={primaryColor}
                    secondaryColor={secondaryColor}
                    branchName={selectedBranchName || clinic?.branchName}
                    pageSize={pageSize}
                    showHeaderFooter={showHeaderFooter}
                    printBackground={printBackground}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Quick Protocols & Draft Bar */}
          <div className="p-4 yalla-card rounded-2xl border border-border shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Zap className="w-4 h-4 fill-amber-400 text-amber-500" />
                </div>
                <div>
                  <h4 className="font-black text-xs text-foreground flex items-center gap-1.5">
                    <span>قوالب الروشتات الجاهزة بنقرة واحدة (Rx Protocols)</span>
                    <Badge variant="secondary" className="text-[10px] bg-primary/10 text-primary border-primary/20">سريع ⚡</Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    تعبئة أدوية وجرعات وإرشادات الحالات الطبية المتكررة بنقرة واحدة
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  size="sm"
                  variant="default"
                  onClick={handleOpenAddTemplate}
                  className="h-8 text-xs font-bold yalla-gradient-btn text-white hover:opacity-95 rounded-xl gap-1.5 shadow-2xs cursor-pointer"
                  title="إضافة قالب روشتة جديد للعيادة"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>إضافة قالب</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleOpenSaveDraftAsTemplate}
                  className="h-8 text-xs font-bold border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 rounded-xl gap-1 cursor-pointer"
                  title="حفظ الأدوية والتشخيص الحالي كقالب جاهز للعيادة"
                >
                  <BookmarkCheck className="w-3.5 h-3.5" />
                  <span>حفظ كقالب</span>
                </Button>

                <Button
                  size="sm"
                  variant="ghost"
                  onClick={handleClearDraft}
                  className="h-8 text-xs font-bold text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 rounded-xl gap-1 cursor-pointer"
                  title="مسح المسودة والبدء بروشتة فارغة"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>مسح المسودة</span>
                </Button>
              </div>
            </div>

            {/* Protocols Chips */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              {visibleBuiltinProtocols.map((p) => (
                <div
                  key={p.id}
                  className="inline-flex items-center rounded-xl bg-secondary/80 hover:bg-secondary border border-border hover:border-primary/40 transition-all shadow-2xs overflow-hidden group/tmpl max-w-full"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyProtocol(p)}
                    className="px-2.5 py-1.5 text-xs font-bold text-foreground hover:text-primary transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                    title={`تطبيق بروتوكول: ${p.name}`}
                  >
                    <span>{p.icon}</span>
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">{p.name.split('(')[0].trim()}</span>
                    <span className="text-[10px] text-muted-foreground font-normal shrink-0">({p.drugs.length})</span>
                  </button>

                  <div className="flex items-center pe-1 ps-0.5 border-s border-border/60 gap-0.5 shrink-0 bg-background/50">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleOpenEditTemplate(p)
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-500/15 transition-colors cursor-pointer"
                      title={`تعديل قالب ${p.name}`}
                      aria-label={`تعديل قالب ${p.name}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteTemplate(p)
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/15 transition-colors cursor-pointer"
                      title={`حذف قالب ${p.name}`}
                      aria-label={`حذف قالب ${p.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {customProtocols.map((cp) => (
                <div
                  key={cp.id}
                  className="inline-flex items-center rounded-xl bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs font-bold shadow-2xs overflow-hidden group/tmpl max-w-full"
                >
                  <button
                    type="button"
                    onClick={() => handleApplyProtocol(cp)}
                    className="px-2.5 py-1.5 hover:bg-amber-500/20 transition-colors cursor-pointer flex items-center gap-1.5 active:scale-95"
                    title={`تطبيق بروتوكول: ${cp.name}`}
                  >
                    <Star className="w-3 h-3 fill-amber-400 text-amber-500 shrink-0" />
                    <span className="truncate max-w-[120px] sm:max-w-[180px]">{cp.name}</span>
                    <span className="text-[10px] opacity-75 shrink-0">({cp.drugs?.length || 0})</span>
                  </button>

                  <div className="flex items-center pe-1 ps-0.5 border-s border-amber-500/20 gap-0.5 shrink-0 bg-background/50">
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleOpenEditTemplate(cp)
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-amber-600 hover:bg-amber-500/20 transition-colors cursor-pointer"
                      title={`تعديل قالب ${cp.name}`}
                      aria-label={`تعديل قالب ${cp.name}`}
                    >
                      <Pencil className="w-3 h-3" />
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault()
                        e.stopPropagation()
                        handleDeleteTemplate(cp)
                      }}
                      className="p-1 rounded-md text-muted-foreground hover:text-rose-500 hover:bg-rose-500/20 transition-colors cursor-pointer"
                      title={`حذف قالب ${cp.name}`}
                      aria-label={`حذف قالب ${cp.name}`}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}

              {visibleBuiltinProtocols.length === 0 && customProtocols.length === 0 && (
                <div className="py-2 px-3 text-xs text-muted-foreground rounded-xl bg-muted/30 border border-dashed border-border w-full text-center">
                  لا توجد قوالب روشتات حالياً. اضغط على «إضافة قالب» لإنشاء أول قالب خاص بالعيادة!
                </div>
              )}
            </div>
          </div>

          {/* Vital Signs Card (العلامات الحيوية) */}
          <div className="p-4 yalla-card rounded-2xl border border-border shadow-xs space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-rose-500/10 text-rose-500 flex items-center justify-center">
                  <Activity className="w-4 h-4 text-rose-500" />
                </div>
                <div>
                  <h4 className="font-black text-xs text-foreground flex items-center gap-1.5">
                    <span>العلامات الحيوية (Vital Signs)</span>
                    <Badge variant="secondary" className="text-[10px] bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20">فحص سريري</Badge>
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    ضغط الدم، النبض، الحرارة، السكر العشوائي، والوزن
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  size="sm"
                  type="button"
                  variant="outline"
                  onClick={handleSaveVitalsOnly}
                  disabled={isSavingVitals}
                  className="h-7 text-[11px] font-bold border-rose-500/30 text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 rounded-xl gap-1 cursor-pointer"
                  title="حفظ وتحديث العلامات الحيوية للكشف"
                >
                  <Save className="w-3 h-3" />
                  <span>{isSavingVitals ? 'جاري الحفظ...' : 'حفظ القياسات'}</span>
                </Button>
              </div>
            </div>

            {/* Inputs Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
              {/* BP Systolic */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>ضغط انقباضي (SYS)</span>
                  <span className="text-[9.5px] text-slate-400">mmHg</span>
                </label>
                <Input
                  type="number"
                  value={vitalsBpSys}
                  onChange={e => setVitalsBpSys(e.target.value)}
                  placeholder="120"
                  className="h-8 text-xs bg-background border-border text-foreground"
                />
              </div>

              {/* BP Diastolic */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>ضغط انبساطي (DIA)</span>
                  <span className="text-[9.5px] text-slate-400">mmHg</span>
                </label>
                <Input
                  type="number"
                  value={vitalsBpDia}
                  onChange={e => setVitalsBpDia(e.target.value)}
                  placeholder="80"
                  className="h-8 text-xs bg-background border-border text-foreground"
                />
              </div>

              {/* Heart Rate / Pulse */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>نبض القلب (HR)</span>
                  <span className="text-[9.5px] text-slate-400">bpm</span>
                </label>
                <Input
                  type="number"
                  value={vitalsPulse}
                  onChange={e => setVitalsPulse(e.target.value)}
                  placeholder="75"
                  className="h-8 text-xs bg-background border-border text-foreground"
                />
              </div>

              {/* Temperature */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>حرارة الجسم (Temp)</span>
                  <span className="text-[9.5px] text-slate-400">°C</span>
                </label>
                <Input
                  type="number"
                  step="0.1"
                  value={vitalsTemp}
                  onChange={e => setVitalsTemp(e.target.value)}
                  placeholder="37.0"
                  className="h-8 text-xs bg-background border-border text-foreground"
                />
              </div>

              {/* Glucose Level */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>السكر العشوائي</span>
                  <span className="text-[9.5px] text-slate-400">mg/dL</span>
                </label>
                <Input
                  type="number"
                  value={vitalsGlucose}
                  onChange={e => setVitalsGlucose(e.target.value)}
                  placeholder="110"
                  className="h-8 text-xs bg-background border-border text-foreground"
                />
              </div>

              {/* Weight */}
              <div className="space-y-1">
                <label className="text-[10.5px] font-bold text-muted-foreground flex items-center justify-between">
                  <span>الوزن (Weight)</span>
                  <span className="text-[9.5px] text-slate-400">kg</span>
                </label>
                <Input
                  type="number"
                  step="0.5"
                  value={vitalsWeight}
                  onChange={e => setVitalsWeight(e.target.value)}
                  placeholder="70"
                  className="h-8 text-xs bg-background border-border text-foreground"
                />
              </div>
            </div>

            {/* Quick Summary Strip if any vital is entered */}
            {(vitalsBpSys || vitalsBpDia || vitalsPulse || vitalsTemp || vitalsGlucose || vitalsWeight) && (
              <div className="pt-2 border-t border-border/70 flex flex-wrap items-center gap-1.5 text-[11px]">
                <span className="text-[10px] font-bold text-muted-foreground">القياسات المسجلة:</span>
                {(vitalsBpSys || vitalsBpDia) && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-700 dark:text-blue-400 border border-blue-500/20 font-bold font-mono">
                    BP {vitalsBpSys || '--'}/{vitalsBpDia || '--'}
                  </span>
                )}
                {vitalsPulse && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-rose-500/10 text-rose-700 dark:text-rose-400 border border-rose-500/20 font-bold font-mono">
                    HR {vitalsPulse} bpm
                  </span>
                )}
                {vitalsTemp && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20 font-bold font-mono">
                    {vitalsTemp}°C
                  </span>
                )}
                {vitalsGlucose && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-700 dark:text-purple-400 border border-purple-500/20 font-bold font-mono">
                    GLU {vitalsGlucose} mg/dL
                  </span>
                )}
                {vitalsWeight && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-teal-500/10 text-teal-700 dark:text-teal-400 border border-teal-500/20 font-bold font-mono">
                    WT {vitalsWeight} kg
                  </span>
                )}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* Add / Edit Prescription Template Modal */}
      <PrescriptionTemplateModal
        isOpen={isTemplateModalOpen}
        onClose={() => {
          setIsTemplateModalOpen(false)
          setTemplateToEdit(null)
          setTemplateDraftData(null)
        }}
        clinicId={clinicId || ''}
        templateToEdit={templateToEdit}
        initialDraftData={templateDraftData}
        onHideBuiltin={(id) => {
          setHiddenBuiltinIds(prev => Array.from(new Set([...prev, id])))
        }}
        onSaved={(savedTmpl) => {
          // If was an update to an existing custom protocol in state, update it
          setCustomProtocols(prev => {
            const idx = prev.findIndex(p => p.id === savedTmpl.id)
            if (idx >= 0) {
              const copy = [...prev]
              copy[idx] = savedTmpl
              return copy
            }
            return [savedTmpl, ...prev]
          })
        }}
      />
    </div>
  )
}
