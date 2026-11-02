import { db } from '@/lib/firebase'
import {
  collection,
  query,
  where,
  getDocs,
  setDoc,
  doc,
  limit,
  increment
} from 'firebase/firestore'

export type SuggestionType = 'dosage' | 'duration' | 'instruction'

export interface PrescriptionSuggestionItem {
  clinic_id: string
  doctor_email?: string
  type: SuggestionType
  text: string
  normalizedText: string
  usageCount: number
  lastUsedAt: string
  createdAt?: string
}

// Default clinical presets commonly used in Egyptian medical practice
export const DEFAULT_DOSAGE_PRESETS = [
  'قرص كل 12 ساعة بعد الأكل',
  'قرص 3 مرات يومياً قبل الأكل',
  'قرص 3 مرات يومياً بعد الأكل',
  'قرص واحد يومياً صباحاً قبل الإفطار',
  'قرص واحد يومياً مساءً قبل النوم',
  'قرص عند اللزوم (بحد أقصى مرتين يومياً)',
  'ملعقة كبيرة 3 مرات يومياً بعد الوجبات',
  'ملعقة صغيرة 3 مرات يومياً',
  'كبسولة كل 8 ساعات بعد الأكل',
  'كيس فوار على نصف كوب ماء مرتين يومياً',
  'نقط بالفم 3 مرات يومياً',
  'دهان موضعي مرتين يومياً',
  '1 tablet every 12 hours after meals',
  '1 tablet 3 times daily before meals',
  '1 tablet once daily before breakfast',
  '1 capsule every 8 hours after meals',
  '1 tablet as needed'
]

export const DEFAULT_DURATION_PRESETS = [
  'لمدة 5 أيام',
  'لمدة أسبوع متواصل',
  'لمدة 3 أيام',
  'لمدة 10 أيام',
  'لمدة أسبوعين',
  'لمدة شهر',
  'عند اللزوم',
  'علاج مستمر منتظم',
  'حتى انتهاء الأعراض',
  'لحين موعد الاستشارة القادمة',
  'For 5 days',
  'For 7 days',
  'For 10 days',
  'For 2 weeks',
  'As needed',
  'Continuous regular treatment'
]

export const DEFAULT_INSTRUCTION_PRESETS = [
  'الراحة التامة وتناول السوائل الدافئة بكثرة.',
  'تجنب الأطعمة الحارة والمقليات والمسبكات.',
  'تقليل ملح الطعام والدهون والمواظبة على قياس الضغط.',
  'شرب ما لا يقل عن 2 إلى 3 لتر ماء يومياً.',
  'العودة للاستشارة والمتابعة بعد أسبوعين بالتحاليل المطلوبة.',
  'تجنب النوم مباشرة بعد تناول الطعام (الانتظار ساعتين).',
  'الالتزام بمواعيد الجرعات وعدم إيقاف العلاج مبكراً.',
  'Rest well and drink plenty of warm fluids.',
  'Avoid spicy and fried foods.',
  'Follow up in 2 weeks with required lab tests.'
]

/**
 * Normalizes text for deduplication and fuzzy matching.
 * Collapses whitespace, strips Arabic diacritics, and normalizes letter forms.
 */
export function normalizeInstructionText(text: string): string {
  if (!text) return ''
  return text
    .trim()
    .toLowerCase()
    // Convert Arabic-Indic digits to standard Arabic digits (0-9)
    .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d).toString())
    // Remove Arabic diacritics (tashkeel)
    .replace(/[\u064B-\u065F\u0670]/g, '')
    // Normalize Alefs
    .replace(/[أإآ]/g, 'ا')
    // Normalize Yaa
    .replace(/ى/g, 'ي')
    // Normalize Taa Marbuta
    .replace(/ة/g, 'ه')
    // Collapse multiple whitespace
    .replace(/\s+/g, ' ')
    // Strip leading/trailing punctuation
    .replace(/^[.,،؛:\s]+|[.,،؛:\s]+$/g, '')
}

/**
 * Generates a deterministic document ID for a suggestion in Firestore.
 */
function makeSuggestionDocId(clinicId: string, type: SuggestionType, normalizedText: string): string {
  // Simple hash to keep ID safe and short
  let hash = 0
  for (let i = 0; i < normalizedText.length; i++) {
    hash = ((hash << 5) - hash + normalizedText.charCodeAt(i)) | 0
  }
  const cleanPrefix = normalizedText.slice(0, 16).replace(/[^a-zA-Z0-9\u0600-\u06FF]/g, '_')
  return `${clinicId}_${type}_${Math.abs(hash)}_${cleanPrefix}`.slice(0, 80)
}

// In-memory session cache to avoid repeated queries
const memoryCache: Record<string, {
  dosages: string[]
  durations: string[]
  instructions: string[]
  timestamp: number
}> = {}

/**
 * Fetches suggestions for a clinic, bootstrapping from stored records,
 * past clinic prescriptions, and baseline presets.
 */
export async function fetchPrescriptionSuggestions(
  clinicId: string,
  doctorEmail?: string
): Promise<{ dosages: string[]; durations: string[]; instructions: string[] }> {
  if (!clinicId) {
    return {
      dosages: DEFAULT_DOSAGE_PRESETS,
      durations: DEFAULT_DURATION_PRESETS,
      instructions: DEFAULT_INSTRUCTION_PRESETS
    }
  }

  // Check cache (valid for 5 minutes)
  const cached = memoryCache[clinicId]
  if (cached && Date.now() - cached.timestamp < 5 * 60 * 1000) {
    return {
      dosages: [...cached.dosages],
      durations: [...cached.durations],
      instructions: [...cached.instructions]
    }
  }

  const dosagesSet = new Map<string, string>() // normalized -> original
  const durationsSet = new Map<string, string>()
  const instructionsSet = new Map<string, string>()

  try {
    // 1. Query stored suggestions from dedicated collection
    const qSuggestions = query(
      collection(db, 'prescription_suggestions'),
      where('clinic_id', '==', clinicId),
      limit(200)
    )
    const snap = await getDocs(qSuggestions)
    const storedItems: PrescriptionSuggestionItem[] = []
    snap.forEach((d) => {
      const data = d.data() as PrescriptionSuggestionItem
      if (data && data.text) storedItems.push(data)
    })

    // Sort stored items by usageCount desc, then lastUsedAt desc
    storedItems.sort((a, b) => (b.usageCount || 0) - (a.usageCount || 0) || new Date(b.lastUsedAt || 0).getTime() - new Date(a.lastUsedAt || 0).getTime())

    for (const item of storedItems) {
      const norm = item.normalizedText || normalizeInstructionText(item.text)
      if (item.type === 'dosage' && !dosagesSet.has(norm)) {
        dosagesSet.set(norm, item.text)
      } else if (item.type === 'duration' && !durationsSet.has(norm)) {
        durationsSet.set(norm, item.text)
      } else if (item.type === 'instruction' && !instructionsSet.has(norm)) {
        instructionsSet.set(norm, item.text)
      }
    }

    // 2. If stored collection has very few items, bootstrap from past prescriptions of this clinic
    if (storedItems.length < 5) {
      try {
        const qPrescriptions = query(
          collection(db, 'prescriptions'),
          where('clinic_id', '==', clinicId),
          limit(30)
        )
        const pSnap = await getDocs(qPrescriptions)
        pSnap.forEach((docSnap) => {
          const pData = docSnap.data()
          if (Array.isArray(pData.drugs)) {
            for (const d of pData.drugs) {
              if (d.dosage && typeof d.dosage === 'string' && d.dosage.trim().length >= 2) {
                const norm = normalizeInstructionText(d.dosage)
                if (!dosagesSet.has(norm)) dosagesSet.set(norm, d.dosage.trim())
              }
              if (d.duration && typeof d.duration === 'string' && d.duration.trim().length >= 2) {
                const norm = normalizeInstructionText(d.duration)
                if (!durationsSet.has(norm)) durationsSet.set(norm, d.duration.trim())
              }
            }
          }
          if (pData.instructions && typeof pData.instructions === 'string' && pData.instructions.trim().length >= 3) {
            const norm = normalizeInstructionText(pData.instructions)
            if (!instructionsSet.has(norm)) instructionsSet.set(norm, pData.instructions.trim())
          }
        })
      } catch (err) {
        // Silently continue with presets if prescription read fails
      }
    }
  } catch (err) {
    console.warn('Could not fetch prescription suggestions from DB:', err)
  }

  // 3. Append default presets for empty or missing items
  for (const preset of DEFAULT_DOSAGE_PRESETS) {
    const norm = normalizeInstructionText(preset)
    if (!dosagesSet.has(norm)) dosagesSet.set(norm, preset)
  }
  for (const preset of DEFAULT_DURATION_PRESETS) {
    const norm = normalizeInstructionText(preset)
    if (!durationsSet.has(norm)) durationsSet.set(norm, preset)
  }
  for (const preset of DEFAULT_INSTRUCTION_PRESETS) {
    const norm = normalizeInstructionText(preset)
    if (!instructionsSet.has(norm)) instructionsSet.set(norm, preset)
  }

  const result = {
    dosages: Array.from(dosagesSet.values()),
    durations: Array.from(durationsSet.values()),
    instructions: Array.from(instructionsSet.values())
  }

  // Update memory cache
  memoryCache[clinicId] = {
    ...result,
    timestamp: Date.now()
  }

  return result
}

/**
 * Saves new or updated instruction suggestions to Firestore upon prescription save.
 * Increments usage count and updates lastUsedAt without saving private patient data.
 */
export async function savePrescriptionSuggestions(
  clinicId: string,
  items: Array<{ type: SuggestionType; text: string }>,
  doctorEmail?: string
): Promise<void> {
  if (!clinicId || !Array.isArray(items) || items.length === 0) return

  const nowIso = new Date().toISOString()
  const cached = memoryCache[clinicId]

  for (const item of items) {
    const raw = (item.text || '').trim()
    if (raw.length < 2) continue

    const normalized = normalizeInstructionText(raw)
    if (!normalized) continue

    // Update in-memory cache immediately so UI has it
    if (cached) {
      const list = item.type === 'dosage'
        ? cached.dosages
        : item.type === 'duration'
        ? cached.durations
        : cached.instructions
      const existingIdx = list.findIndex((t) => normalizeInstructionText(t) === normalized)
      if (existingIdx >= 0) {
        // Move to front
        const [found] = list.splice(existingIdx, 1)
        list.unshift(found)
      } else {
        list.unshift(raw)
      }
    }

    // Persist to Firestore asynchronously
    try {
      const docId = makeSuggestionDocId(clinicId, item.type, normalized)
      const docRef = doc(db, 'prescription_suggestions', docId)
      await setDoc(
        docRef,
        {
          clinic_id: clinicId,
          doctor_email: doctorEmail || '',
          type: item.type,
          text: raw,
          normalizedText: normalized,
          usageCount: increment(1),
          lastUsedAt: nowIso
        },
        { merge: true }
      )
    } catch (err) {
      console.warn('Failed to persist suggestion:', err)
    }
  }
}

/**
 * Filters suggestions by typed query with case-insensitive and Arabic-tolerant matching.
 */
export function filterSuggestions(suggestions: string[], queryText: string, maxResults: number = 8): string[] {
  if (!Array.isArray(suggestions)) return []
  if (!queryText || !queryText.trim()) {
    return suggestions.slice(0, maxResults)
  }

  const normQuery = normalizeInstructionText(queryText)
  if (!normQuery) return suggestions.slice(0, maxResults)

  const matched: string[] = []
  const startsWithMatches: string[] = []
  const containsMatches: string[] = []

  for (const item of suggestions) {
    const normItem = normalizeInstructionText(item)
    if (normItem.startsWith(normQuery)) {
      startsWithMatches.push(item)
    } else if (normItem.includes(normQuery)) {
      containsMatches.push(item)
    }
  }

  return [...startsWithMatches, ...containsMatches].slice(0, maxResults)
}
