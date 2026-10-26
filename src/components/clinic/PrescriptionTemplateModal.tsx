'use client'

import React, { useState, useEffect, useRef } from 'react'
import {
  X, Plus, Trash2, BookmarkCheck, Sparkles, AlertCircle,
  FileText, Pill, Stethoscope, Check, Search, AlertTriangle
} from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { toast } from 'sonner'
import { db } from '@/lib/firebase'
import { collection, addDoc, updateDoc, doc, arrayUnion } from 'firebase/firestore'
import { useEgyptianDrugs } from '@/hooks/useEgyptianDrugs'

export interface TemplateDrugItem {
  id?: string | number
  name: string
  dosage: string
  duration: string
  notes?: string
}

export interface PrescriptionTemplate {
  id: string
  clinic_id?: string
  name: string
  category?: string
  diagnosis?: string
  instructions?: string
  drugs: TemplateDrugItem[]
  isBuiltin?: boolean
  baseBuiltinId?: string
  icon?: string
  createdAt?: string
  updatedAt?: string
}

interface PrescriptionTemplateModalProps {
  isOpen: boolean
  onClose: () => void
  clinicId: string
  templateToEdit?: PrescriptionTemplate | null
  initialDraftData?: {
    diagnosis?: string
    instructions?: string
    drugs?: TemplateDrugItem[]
  } | null
  onSaved?: (savedTemplate: PrescriptionTemplate) => void
  onHideBuiltin?: (builtinId: string) => void
}

export function PrescriptionTemplateModal({
  isOpen,
  onClose,
  clinicId,
  templateToEdit,
  initialDraftData,
  onSaved,
  onHideBuiltin
}: PrescriptionTemplateModalProps) {
  const isEditMode = !!templateToEdit
  const { drugs: egyptDrugs, searchDrugs } = useEgyptianDrugs()

  // Form State
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [diagnosis, setDiagnosis] = useState('')
  const [instructions, setInstructions] = useState('')
  const [drugs, setDrugs] = useState<TemplateDrugItem[]>([
    { id: 1, name: '', dosage: '', duration: '', notes: '' }
  ])

  // UI / Validation State
  const [nameError, setNameError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [activeSearchIndex, setActiveSearchIndex] = useState<number | null>(null)
  const [drugSearchResults, setDrugSearchResults] = useState<any[]>([])

  // Tracking unsaved changes
  const [initialSnapshot, setInitialSnapshot] = useState<string>('')
  const nameInputRef = useRef<HTMLInputElement>(null)

  // Initialize or reset form when modal opens
  useEffect(() => {
    if (!isOpen) return

    if (templateToEdit) {
      setName(templateToEdit.name || '')
      setCategory(templateToEdit.category || '')
      setDiagnosis(templateToEdit.diagnosis || '')
      setInstructions(templateToEdit.instructions || '')
      const mappedDrugs = (templateToEdit.drugs && templateToEdit.drugs.length > 0)
        ? templateToEdit.drugs.map((d, i) => ({
            id: d.id || Date.now() + i,
            name: d.name || '',
            dosage: d.dosage || '',
            duration: d.duration || '',
            notes: d.notes || ''
          }))
        : [{ id: Date.now(), name: '', dosage: '', duration: '', notes: '' }]
      setDrugs(mappedDrugs)
      setInitialSnapshot(JSON.stringify({
        name: templateToEdit.name || '',
        category: templateToEdit.category || '',
        diagnosis: templateToEdit.diagnosis || '',
        instructions: templateToEdit.instructions || '',
        drugs: mappedDrugs
      }))
    } else if (initialDraftData) {
      // Pre-fill from open draft (Save as Template)
      setName('')
      setCategory('')
      setDiagnosis(initialDraftData.diagnosis || '')
      setInstructions(initialDraftData.instructions || '')
      const validDraftDrugs = (initialDraftData.drugs || []).filter(d => d.name && d.name.trim() !== '')
      const mappedDrugs = validDraftDrugs.length > 0
        ? validDraftDrugs.map((d, i) => ({
            id: d.id || Date.now() + i,
            name: d.name || '',
            dosage: d.dosage || '',
            duration: d.duration || '',
            notes: d.notes || ''
          }))
        : [{ id: Date.now(), name: '', dosage: '', duration: '', notes: '' }]
      setDrugs(mappedDrugs)
      setInitialSnapshot(JSON.stringify({
        name: '',
        category: '',
        diagnosis: initialDraftData.diagnosis || '',
        instructions: initialDraftData.instructions || '',
        drugs: mappedDrugs
      }))
    } else {
      // Blank new template
      setName('')
      setCategory('')
      setDiagnosis('')
      setInstructions('')
      const defaultDrug = [{ id: Date.now(), name: '', dosage: '', duration: '', notes: '' }]
      setDrugs(defaultDrug)
      setInitialSnapshot(JSON.stringify({
        name: '',
        category: '',
        diagnosis: '',
        instructions: '',
        drugs: defaultDrug
      }))
    }

    setNameError(null)
    setActiveSearchIndex(null)
    setDrugSearchResults([])

    // Focus template name input
    const timer = setTimeout(() => {
      nameInputRef.current?.focus()
    }, 150)
    return () => clearTimeout(timer)
  }, [isOpen, templateToEdit, initialDraftData])

  // Check if dirty
  const isDirty = () => {
    const current = JSON.stringify({ name, category, diagnosis, instructions, drugs })
    return current !== initialSnapshot
  }

  const handleClose = () => {
    if (isDirty()) {
      const confirmDiscard = window.confirm('توجد تعديلات غير محفوظة على القالب، هل تريد إغلاق النافذة وتجاهلها؟')
      if (!confirmDiscard) return
    }
    onClose()
  }

  // Drug Row Manipulation
  const handleAddDrugRow = () => {
    setDrugs(prev => [
      ...prev,
      { id: Date.now(), name: '', dosage: '', duration: '', notes: '' }
    ])
  }

  const handleRemoveDrugRow = (index: number) => {
    if (drugs.length === 1) {
      setDrugs([{ id: Date.now(), name: '', dosage: '', duration: '', notes: '' }])
      return
    }
    setDrugs(prev => prev.filter((_, i) => i !== index))
  }

  const handleUpdateDrug = (index: number, field: keyof TemplateDrugItem, value: string) => {
    setDrugs(prev => {
      const copy = [...prev]
      copy[index] = { ...copy[index], [field]: value }
      return copy
    })

    // Drug Autocomplete search trigger
    if (field === 'name') {
      if (value.trim().length >= 2) {
        setActiveSearchIndex(index)
        const matches = searchDrugs(value).slice(0, 6)
        setDrugSearchResults(matches)
      } else {
        if (activeSearchIndex === index) {
          setActiveSearchIndex(null)
          setDrugSearchResults([])
        }
      }
    }
  }

  const handleSelectAutocompleteDrug = (index: number, drugItem: any) => {
    const tradeAr = drugItem.commercial_name_ar || drugItem.nameAr || ''
    const tradeEn = drugItem.commercial_name_en || drugItem.name || ''
    const chosenName = tradeAr || tradeEn || ''
    handleUpdateDrug(index, 'name', chosenName)
    setActiveSearchIndex(null)
    setDrugSearchResults([])
  }

  // Submit and Save to Firestore
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    // Validation: Template Name
    const trimmedName = name.trim()
    if (!trimmedName) {
      setNameError('يرجى إدخال اسم القالب')
      nameInputRef.current?.focus()
      toast.error('يرجى كتابة اسم القالب')
      return
    }
    setNameError(null)

    // Validation: Drugs list
    const validDrugs = drugs.filter(d => d.name && d.name.trim() !== '')
    if (validDrugs.length === 0) {
      toast.error('يرجى إضافة دواء واحد على الأقل مع جرعته للقالب')
      return
    }

    if (!clinicId) {
      toast.error('لم يتم العثور على معرف العيادة')
      return
    }

    setIsSubmitting(true)

    try {
      const cleanDrugs = validDrugs.map(d => ({
        name: d.name.trim(),
        dosage: (d.dosage || '').trim(),
        duration: (d.duration || '').trim(),
        notes: (d.notes || '').trim()
      }))

      // Handle Built-in Template Override vs Custom Template
      if (templateToEdit?.isBuiltin) {
        // 1. Hide original built-in template for this clinic in Firestore
        try {
          await updateDoc(doc(db, 'clinics', clinicId), {
            hiddenProtocolIds: arrayUnion(templateToEdit.id)
          })
          if (onHideBuiltin) {
            onHideBuiltin(templateToEdit.id)
          }
        } catch (overrideErr) {
          console.warn('Notice updating clinic hiddenProtocolIds:', overrideErr)
        }

        // 2. Create custom copy in rx_protocols for this clinic
        const docRef = await addDoc(collection(db, 'rx_protocols'), {
          clinic_id: clinicId,
          name: trimmedName,
          category: category.trim(),
          diagnosis: diagnosis.trim(),
          instructions: instructions.trim(),
          drugs: cleanDrugs,
          baseBuiltinId: templateToEdit.id,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

        const savedObj: PrescriptionTemplate = {
          id: docRef.id,
          clinic_id: clinicId,
          name: trimmedName,
          category: category.trim(),
          diagnosis: diagnosis.trim(),
          instructions: instructions.trim(),
          drugs: cleanDrugs,
          isBuiltin: false,
          baseBuiltinId: templateToEdit.id
        }

        toast.success(`تم حفظ تعديلات القالب "${trimmedName}" بنجاح ⭐`)
        if (onSaved) onSaved(savedObj)
        onClose()

      } else if (templateToEdit && !templateToEdit.isBuiltin) {
        // Updating existing custom template by ID
        const targetRef = doc(db, 'rx_protocols', templateToEdit.id)
        await updateDoc(targetRef, {
          name: trimmedName,
          category: category.trim(),
          diagnosis: diagnosis.trim(),
          instructions: instructions.trim(),
          drugs: cleanDrugs,
          updatedAt: new Date().toISOString()
        })

        const savedObj: PrescriptionTemplate = {
          ...templateToEdit,
          name: trimmedName,
          category: category.trim(),
          diagnosis: diagnosis.trim(),
          instructions: instructions.trim(),
          drugs: cleanDrugs,
          updatedAt: new Date().toISOString()
        }

        toast.success(`تم تحديث قالب "${trimmedName}" بنجاح ⭐`)
        if (onSaved) onSaved(savedObj)
        onClose()

      } else {
        // Creating brand new template
        const docRef = await addDoc(collection(db, 'rx_protocols'), {
          clinic_id: clinicId,
          name: trimmedName,
          category: category.trim(),
          diagnosis: diagnosis.trim(),
          instructions: instructions.trim(),
          drugs: cleanDrugs,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        })

        const savedObj: PrescriptionTemplate = {
          id: docRef.id,
          clinic_id: clinicId,
          name: trimmedName,
          category: category.trim(),
          diagnosis: diagnosis.trim(),
          instructions: instructions.trim(),
          drugs: cleanDrugs,
          isBuiltin: false
        }

        toast.success(`تمت إضافة قالب "${trimmedName}" إلى قائمة قوالب العيادة بنجاح ⭐`)
        if (onSaved) onSaved(savedObj)
        onClose()
      }
    } catch (err: any) {
      console.error('Failed to save prescription template:', err)
      toast.error('حدث خطأ أثناء حفظ القالب، يرجى المحاولة مرة أخرى')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 10 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 10 }}
        className="w-full max-w-2xl bg-card border border-border rounded-3xl shadow-2xl flex flex-col max-h-[92vh] overflow-hidden my-auto"
      >
        {/* Sticky Header */}
        <div className="px-6 py-4 border-b border-border flex items-center justify-between shrink-0 bg-secondary/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <BookmarkCheck className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
            <div>
              <h3 className="font-black text-sm text-foreground flex items-center gap-2">
                <span>{isEditMode ? 'تعديل قالب الروشتة' : 'إضافة قالب روشتة جديد'}</span>
                {templateToEdit?.isBuiltin && (
                  <span className="text-[10px] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                    تخصيص للعيادة
                  </span>
                )}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {isEditMode
                  ? 'تعديل الأدوية والجرعات والإرشادات الخاصة بهذا البروتوكول'
                  : 'تجهيز بروتوكول علاجي جاهز للتطبيق بنقرة واحدة داخل الروشتات'}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleClose}
            className="p-1.5 rounded-xl text-muted-foreground hover:text-foreground hover:bg-secondary cursor-pointer transition-colors"
            title="إغلاق"
            aria-label="إغلاق النافذة"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form id="template-modal-form" onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* Section: Name & Category */}
          <div className="grid sm:grid-cols-12 gap-3.5">
            <div className="sm:col-span-8 space-y-1.5">
              <Label className="text-xs font-bold text-foreground flex items-center justify-between">
                <span className="flex items-center gap-1">
                  <span>اسم القالب</span>
                  <span className="text-rose-500 font-black">*</span>
                </span>
                {nameError && (
                  <span className="text-[11px] font-bold text-rose-500 animate-pulse">
                    {nameError}
                  </span>
                )}
              </Label>
              <Input
                ref={nameInputRef}
                value={name}
                onChange={e => {
                  setName(e.target.value)
                  if (nameError) setNameError(null)
                }}
                placeholder="مثال: نزلة معوية حادة، حساسية موسمية، ارتفاع ضغط الدم..."
                className={`h-10 text-xs rounded-xl bg-background text-foreground transition-all ${
                  nameError
                    ? 'border-rose-500 ring-2 ring-rose-500/20'
                    : 'border-border focus:border-amber-500'
                }`}
              />
            </div>

            <div className="sm:col-span-4 space-y-1.5">
              <Label className="text-xs font-bold text-muted-foreground">التصنيف أو التخصص (اختياري)</Label>
              <Input
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="مثال: باطنة، أطفال، صدرية..."
                className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
              />
            </div>
          </div>

          {/* Section: Diagnosis */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Stethoscope className="w-3.5 h-3.5 text-primary" />
              <span>التشخيص الطبي المقترح (Diagnosis)</span>
            </Label>
            <Input
              value={diagnosis}
              onChange={e => setDiagnosis(e.target.value)}
              placeholder="مثال: Acute Gastroenteritis / نزلة معوية وتقلصات حادة"
              className="h-10 text-xs rounded-xl bg-background border-border text-foreground"
            />
          </div>

          {/* Section: Medical Instructions */}
          <div className="space-y-1.5">
            <Label className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-primary" />
              <span>تعليمات وإرشادات الطبيب للمريض</span>
            </Label>
            <textarea
              rows={2}
              value={instructions}
              onChange={e => setInstructions(e.target.value)}
              placeholder="مثال: الراحة التامة، تناول سوائل دافئة، تجنب المأكولات الحارة والمقليات، المتابعة بعد أسبوع..."
              className="w-full text-xs rounded-xl bg-background border border-border text-foreground p-3 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all resize-none"
            />
          </div>

          {/* Section: Drugs List */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between pb-2 border-b border-border">
              <div className="flex items-center gap-2">
                <Pill className="w-4 h-4 text-amber-500" />
                <Label className="text-xs font-black text-foreground">
                  الأدوية والعلاج المدرج بالقالب ({drugs.filter(d => d.name.trim() !== '').length})
                </Label>
              </div>

              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={handleAddDrugRow}
                className="h-8 text-xs font-bold rounded-xl border-amber-500/30 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة دواء للقالب</span>
              </Button>
            </div>

            <div className="space-y-3">
              {drugs.map((drug, index) => (
                <div
                  key={drug.id || index}
                  className="p-3.5 rounded-2xl bg-secondary/30 border border-border/80 space-y-2.5 relative group"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-black text-muted-foreground flex items-center gap-1.5">
                      <span className="w-5 h-5 rounded-md bg-secondary text-foreground text-[10px] font-mono flex items-center justify-center">
                        {index + 1}
                      </span>
                      <span>دواء #{index + 1}</span>
                    </span>

                    <button
                      type="button"
                      onClick={() => handleRemoveDrugRow(index)}
                      className="p-1 rounded-lg text-muted-foreground hover:text-rose-500 hover:bg-rose-500/10 transition-colors cursor-pointer"
                      title="حذف هذا الدواء من القالب"
                      aria-label={`حذف الدواء رقم ${index + 1}`}
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="grid sm:grid-cols-12 gap-2">
                    {/* Drug Name with Autocomplete */}
                    <div className="sm:col-span-5 relative">
                      <Input
                        value={drug.name}
                        onChange={e => handleUpdateDrug(index, 'name', e.target.value)}
                        placeholder="اسم الدواء (تجاري أو علمي) *"
                        className="h-9 text-xs rounded-xl bg-background border-border text-foreground"
                      />

                      {/* Autocomplete Dropdown */}
                      {activeSearchIndex === index && drugSearchResults.length > 0 && (
                        <div className="absolute top-full start-0 w-full mt-1 bg-card border border-border shadow-2xl rounded-2xl z-50 overflow-hidden divide-y divide-border">
                          <div className="p-1.5 bg-secondary/50 text-[10px] font-bold text-muted-foreground flex items-center justify-between">
                            <span className="flex items-center gap-1">
                              <Sparkles className="w-3 h-3 text-primary" />
                              <span>دليل الأدوية</span>
                            </span>
                            <button
                              type="button"
                              onClick={() => setActiveSearchIndex(null)}
                              className="text-muted-foreground hover:text-foreground"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          </div>
                          <div className="max-h-40 overflow-y-auto divide-y divide-border">
                            {drugSearchResults.map((m, mIdx) => {
                              const trade = m.commercial_name_ar || m.commercial_name_en || m.name || ''
                              return (
                                <button
                                  key={m.id || mIdx}
                                  type="button"
                                  onClick={() => handleSelectAutocompleteDrug(index, m)}
                                  className="w-full text-start p-2 hover:bg-primary/5 transition-colors cursor-pointer text-xs"
                                >
                                  <span className="font-bold text-foreground block truncate">{trade}</span>
                                  {m.form && (
                                    <span className="text-[10px] text-muted-foreground">{m.form}</span>
                                  )}
                                </button>
                              )
                            })}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Dosage */}
                    <div className="sm:col-span-4">
                      <Input
                        value={drug.dosage}
                        onChange={e => handleUpdateDrug(index, 'dosage', e.target.value)}
                        placeholder="الجرعة (مثال: قرص 3 مرات يومياً)"
                        className="h-9 text-xs rounded-xl bg-background border-border text-foreground"
                      />
                    </div>

                    {/* Duration */}
                    <div className="sm:col-span-3">
                      <Input
                        value={drug.duration}
                        onChange={e => handleUpdateDrug(index, 'duration', e.target.value)}
                        placeholder="المدة (مثال: 5 أيام)"
                        className="h-9 text-xs rounded-xl bg-background border-border text-foreground"
                      />
                    </div>
                  </div>

                  {/* Notes / Route */}
                  <div>
                    <Input
                      value={drug.notes || ''}
                      onChange={e => handleUpdateDrug(index, 'notes', e.target.value)}
                      placeholder="ملاحظات أو طريقة الاستخدام (مثال: بعد الأكل بساعة، قبل النوم...)"
                      className="h-8 text-[11px] rounded-lg bg-background/60 border-border text-foreground placeholder:text-muted-foreground/70"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </form>

        {/* Sticky Footer */}
        <div className="px-6 py-4 border-t border-border bg-secondary/30 flex items-center justify-between shrink-0">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isSubmitting}
            className="h-9 px-4 text-xs font-bold rounded-xl text-muted-foreground hover:text-foreground cursor-pointer"
          >
            إلغاء
          </Button>

          <Button
            type="submit"
            form="template-modal-form"
            disabled={isSubmitting || !name.trim()}
            className="h-9 px-5 text-xs font-bold yalla-gradient-btn text-white rounded-xl shadow-xs cursor-pointer gap-1.5"
          >
            {isSubmitting ? (
              <span>جارٍ الحفظ...</span>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>{isEditMode ? 'حفظ التعديلات' : 'إضافة القالب'}</span>
              </>
            )}
          </Button>
        </div>
      </motion.div>
    </div>
  )
}
