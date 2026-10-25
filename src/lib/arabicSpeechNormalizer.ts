/**
 * Arabic Speech Normalizer for Medical Prescriptions & Clinic Notes
 *
 * Converts spoken/colloquial Egyptian Arabic into clean, professional
 * Modern Standard Arabic (فصحى) for doctor instructions and diagnoses,
 * and eliminates duplicate/repeated words caused by speech recognition buffers.
 */

// Helper to create safe Arabic word boundary regex
function arabicWordRegex(pattern: string, flags = 'giu'): RegExp {
  return new RegExp(`(?<!\\p{L})${pattern}(?!\\p{L})`, flags)
}

// Common spoken-to-standard medical and conversational replacements
const PHRASE_REPLACEMENTS: Array<[RegExp, string]> = [
  // Fluids & Beverages
  [arabicWordRegex('(?:شرب\\s+)?(?:سوايل|السوايل|سوائل|السوائل)\\s+(?:كتير|كتيرة|كتيره)'), 'شرب كميات وافرة من السوائل'],
  [arabicWordRegex('(?:سوايل|السوايل)\\s+(?:دافية|دافيه|دافي)'), 'سوائل دافئة'],
  [arabicWordRegex('سوايل'), 'سوائل'],
  [arabicWordRegex('السوايل'), 'السوائل'],
  [arabicWordRegex('(?:مايه|الميه|ميه)\\s+(?:ساقعة|ساقعه|باردة|بارده)'), 'ماء بارد'],
  [arabicWordRegex('(?:مايه|الميه|ميه)\\s+(?:دافية|دافيه|دافي)'), 'ماء دافئ'],
  [arabicWordRegex('(?:مايه|ميه)'), 'ماء'],
  [arabicWordRegex('الميه'), 'الماء'],
  [arabicWordRegex('(?:دافي|دافيه)'), 'دافئ'],

  // Timing & Meals
  [arabicWordRegex('(?:ع\\s*الريق|عالريق)'), 'على الريق صباحاً'],
  [arabicWordRegex('(?:قبل\\s+الاكل|قبل\\s+الأكل)'), 'قبل الأكل'],
  [arabicWordRegex('(?:بعد\\s+الاكل|بعد\\s+الأكل)'), 'بعد الأكل'],
  [arabicWordRegex('(?:وسط\\s+الاكل|مع\\s+الاكل|وسط\\s+الأكل|مع\\s+الأكل)'), 'أثناء تناول الطعام'],
  [arabicWordRegex('قبل\\s+النوم'), 'قبل النوم مباشرة'],
  [arabicWordRegex('(?:كل\\s+يوم\\s+الصبح|الصبح\\s+بدري)'), 'صباحاً كل يوم'],
  [arabicWordRegex('(?:بالليل|بليل)'), 'مساءً'],

  // Numbers & Durations
  [arabicWordRegex('(?:مره\\s+واحده|مرة\\s+واحدة)'), 'مرة واحدة يومياً'],
  [arabicWordRegex('(?:مرتين\\s+في\\s+اليوم|مرتين\\s+فاليوم)'), 'مرتين يومياً (كل 12 ساعة)'],
  [arabicWordRegex('(?:تلات\\s+مرات|تلاتة\\s+مرات|3\\s+مرات)'), 'ثلاث مرات يومياً (كل 8 ساعات)'],
  [arabicWordRegex('(?:اربع\\s+مرات|اربعة\\s+مرات|4\\s+مرات)'), 'أربع مرات يومياً (كل 6 ساعات)'],
  [arabicWordRegex('(?:تلات|تلاته|تلاتة)\\s+(?:ايام|أيام)'), 'ثلاثة أيام'],
  [arabicWordRegex('(?:خمس|خمسه|خمسة)\\s+(?:ايام|أيام)'), 'خمسة أيام'],
  [arabicWordRegex('(?:اسبوع|أسبوع)'), 'أسبوع'],
  [arabicWordRegex('(?:اسبوعين|أسبوعين)'), 'أسبوعين'],

  // Dosages & Forms
  [arabicWordRegex('(?:معلقه|معلقة)\\s+(?:كبيره|كبيرة)'), 'ملعقة كبيرة'],
  [arabicWordRegex('(?:معلقه|معلقة)\\s+(?:صغيره|صغيرة)'), 'ملعقة صغيرة'],
  [arabicWordRegex('(?:معلقه|معلقة)'), 'ملعقة'],
  [arabicWordRegex('(?:كبسوله|كبسولة)'), 'كبسولة'],
  [arabicWordRegex('(?:قرصين)'), 'قرصين'],
  [arabicWordRegex('(?:حقنه|حقنة)\\s+عضل'), 'حقنة في العضل'],
  [arabicWordRegex('(?:حقنه|حقنة)\\s+وريد'), 'حقنة في الوريد'],
  [arabicWordRegex('(?:حقنه|حقنة)'), 'حقنة'],
  [arabicWordRegex('(?:نقط|قطره|قطرة)'), 'قطرات'],
  [arabicWordRegex('(?:بخاخ|بخه|بخة)'), 'بخة'],
  [arabicWordRegex('(?:لبوس|لبوسه|لبوسة)'), 'تحاميل'],
  [arabicWordRegex('دهان'), 'مرهم موضعي'],
  [arabicWordRegex('(?:مضمضه|مضمضة)'), 'مضمضة فموية'],
  [arabicWordRegex('(?:غرغره|غرغرة)'), 'غرغرة طبية'],

  // Dietary Restrictions
  [arabicWordRegex('(?:ممنوع\\s+الحوادق|بلاش\\s+حوادق)'), 'تجنب الأطعمة المالحة والمخللات'],
  [arabicWordRegex('(?:ممنوع\\s+المقليات|بلاش\\s+مقليات|بلاش\\s+دهون)'), 'تجنب المقليات والأطعمة الدسمة'],
  [arabicWordRegex('(?:ممنوع\\s+الحراق|بلاش\\s+حراق|ممنوع\\s+الشطة|بلاش\\s+شطة)'), 'تجنب الأطعمة الحارة والشطة'],
  [arabicWordRegex('(?:ممنوع\\s+السكريات|بلاش\\s+سكريات)'), 'تقليل السكريات والحلويات'],
  [arabicWordRegex('(?:تجنب\\s+التدخين|بلاش\\s+تدخين|وقف\\s+التدخين)'), 'الامتناع التام عن التدخين'],
  [arabicWordRegex('(?:بلاش|ماتشربش|ماتاكلش)'), 'تجنب'],

  // General Instructions
  [arabicWordRegex('(?:راحه\\s+تامه|راحة\\s+تامه|راحه\\s+تامة)'), 'الراحة التامة في الفراش'],
  [arabicWordRegex('(?:الاستشاره|الاستشارة)\\s+بعد\\s+اسبوع'), 'المتابعة والاستشارة بعد أسبوع'],
  [arabicWordRegex('(?:الاستشاره|الاستشارة)'), 'الاستشارة'],
  [arabicWordRegex('(?:كمادات\\s+مايه|كمادات\\s+ميه)'), 'عمل كمادات ماء بارد'],
  [arabicWordRegex('كمادات'), 'كمادات باردة'],
  [arabicWordRegex('(?:لو\\s+فيه\\s+سخونية|لو\\s+الحرارة\\s+عالية)'), 'في حال استمرار ارتفاع درجة الحرارة'],
  [arabicWordRegex('(?:لو\\s+الالم\\s+زاد|لو\\s+الوجع\\s+زاد)'), 'في حال ازدياد الألم'],
  [arabicWordRegex('(?:علشان|عشان)'), 'لتفادي'],

  // Medical Symptoms & Common Expressions
  [arabicWordRegex('(?:سخونية|سخونيه)'), 'ارتفاع في درجة الحرارة (حمى)'],
  [arabicWordRegex('ترجيع'), 'قيء'],
  [arabicWordRegex('(?:اسهال|إسهال)'), 'إسهال'],
  [arabicWordRegex('(?:امساك|إمساك)'), 'إمساك'],
  [arabicWordRegex('مغص'), 'مغص معوي'],
  [arabicWordRegex('نهجان'), 'ضيق في التنفس'],
  [arabicWordRegex('(?:كحه|كحة)'), 'سعال'],
  [arabicWordRegex('صداع'), 'صداع'],
  [arabicWordRegex('حرقان\\s+بول'), 'حرقان في البول']
]

/**
 * Removes immediate consecutive duplicate words or multi-word repeated phrases.
 * Handles speech recognition stutter buffers like "شرب شرب شرب سوائل شرب سوائل".
 */
export function deduplicateRepeatedSpokenWords(text: string): string {
  if (!text) return ''

  // Split into tokens while preserving whitespace
  let tokens = text.trim().split(/\s+/)
  if (tokens.length <= 1) return text.trim()

  // 1. Remove immediate single-word duplicates ("شرب شرب شرب" -> "شرب")
  const collapsedTokens: string[] = []
  for (let i = 0; i < tokens.length; i++) {
    const current = tokens[i]
    const previous = collapsedTokens[collapsedTokens.length - 1]
    if (current && (!previous || current.toLowerCase() !== previous.toLowerCase())) {
      collapsedTokens.push(current)
    }
  }

  // 2. Remove 2-word, 3-word, and 4-word phrase stutter loops (e.g., "شرب سوائل شرب سوائل" -> "شرب سوائل")
  let resultTokens = [...collapsedTokens]
  for (let phraseLen = 4; phraseLen >= 2; phraseLen--) {
    let changed = true
    while (changed && resultTokens.length >= phraseLen * 2) {
      changed = false
      for (let i = 0; i <= resultTokens.length - phraseLen * 2; i++) {
        const firstPhrase = resultTokens.slice(i, i + phraseLen).join(' ')
        const secondPhrase = resultTokens.slice(i + phraseLen, i + phraseLen * 2).join(' ')
        if (firstPhrase === secondPhrase) {
          resultTokens.splice(i + phraseLen, phraseLen)
          changed = true
          break
        }
      }
    }
  }

  // 3. Clean incomplete trailing words (single letter stutters like "شرب د" at the very end when cut off)
  if (resultTokens.length > 1) {
    const lastWord = resultTokens[resultTokens.length - 1]
    if (lastWord.length === 1 && !['و'].includes(lastWord)) {
      resultTokens.pop()
    }
  }

  return resultTokens.join(' ')
}

/**
 * Normalizes Arabic colloquial speech into standard professional medical text.
 */
export function normalizeArabicMedicalSpeech(text: string): string {
  if (!text || !text.trim()) return ''

  // 1. First eliminate speech recognition repetition loops
  let normalized = deduplicateRepeatedSpokenWords(text)

  // 2. Apply dictionary replacements for colloquialisms
  for (const [pattern, replacement] of PHRASE_REPLACEMENTS) {
    normalized = normalized.replace(pattern, replacement)
  }

  // 3. Second pass deduplication in case replacements produced adjacent identical words
  normalized = deduplicateRepeatedSpokenWords(normalized)

  // 4. Clean extra spaces
  normalized = normalized.replace(/\s{2,}/g, ' ').trim()

  return normalized
}
