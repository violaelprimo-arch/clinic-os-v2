import 'server-only'
import { mergeLandingConfig, type FeedbackItem, type StatItem } from '@/lib/landing-config'
import { readDocument, queryDocuments, firebaseServerConfigured } from './firebase-rest'

interface AutomatedMetrics {
  clinics: number
  doctors: number
  visits: number
  prescriptions: number
  cachedAt: number
}

let metricsCache: AutomatedMetrics | null = null
const METRICS_TTL_MS = 10 * 60 * 1000 // 10 minutes cache

export async function fetchAutomatedMetrics(): Promise<AutomatedMetrics> {
  const now = Date.now()
  if (metricsCache && now - metricsCache.cachedAt < METRICS_TTL_MS) {
    return metricsCache
  }

  if (!firebaseServerConfigured()) {
    return { clinics: 1, doctors: 1, visits: 0, prescriptions: 0, cachedAt: now }
  }

  try {
    const clinics = await queryDocuments('clinics').catch(() => [])
    const appointments = await queryDocuments('appointments').catch(() => [])

    const clinicsCount = clinics.length || 1
    const doctorsCount = clinicsCount // each registered clinic represents at least 1 verified doctor
    const completedVisits = appointments.filter(
      (a: any) => a.status === 'completed' || a.status === 'done'
    ).length
    const issuedRx = appointments.filter(
      (a: any) => Boolean(a.diagnosis || a.medicines || a.prescription || a.doctorInstructions)
    ).length

    metricsCache = {
      clinics: clinicsCount,
      doctors: doctorsCount,
      visits: completedVisits,
      prescriptions: issuedRx,
      cachedAt: now,
    }
    return metricsCache
  } catch (err) {
    console.warn('[landing-store] fetchAutomatedMetrics failed, using baseline:', err)
    return { clinics: 1, doctors: 1, visits: 0, prescriptions: 0, cachedAt: now }
  }
}

export async function readLandingConfig() {
  return mergeLandingConfig(await readDocument('site_settings/landing_page'))
}

export async function publicLandingConfig() {
  const config = await readLandingConfig()
  
  // 1. Fetch real approved feedback
  const reviews = await queryDocuments('landing_feedback', true).catch(() => {
    console.error('LANDING_FEEDBACK_QUERY_FAILED')
    return []
  })

  config.feedbacks = [
    ...config.feedbacks.filter((item) => item.approved && item.visible !== false),
    ...reviews
      .filter((item) => item.approved && item.visible !== false)
      .map(
        (item) =>
          ({
            id: item.id,
            authorName: String(item.authorName || ''),
            clinicName: String(item.clinicName || ''),
            specialty: String(item.specialty || ''),
            rating: Number(item.rating) || 5,
            comment: String(item.comment || ''),
            avatarUrl: String(item.avatarUrl || ''),
            approved: true,
            visible: true,
            createdAt: String(item.createdAt || ''),
          }) satisfies FeedbackItem,
      ),
  ]

  // 2. Hydrate dual-source automated stats
  const metrics = await fetchAutomatedMetrics()
  config.stats = (config.stats || []).map((st: StatItem) => {
    if (st.sourceType === 'automated' && st.autoMetricKey) {
      let val = '0'
      if (st.autoMetricKey === 'clinics') val = String(metrics.clinics)
      else if (st.autoMetricKey === 'doctors') val = String(metrics.doctors)
      else if (st.autoMetricKey === 'visits') val = String(metrics.visits)
      else if (st.autoMetricKey === 'prescriptions') val = String(metrics.prescriptions)
      return {
        ...st,
        value: val,
        sourceNote: st.sourceNote || 'بيانات حية مباشرة من المنظومة',
      }
    }
    return st
  })

  // 3. Hydrate unified pricing plans from Firestore packages collection if present
  try {
    const pkgs = await queryDocuments('packages').catch(() => [])
    if (Array.isArray(pkgs) && pkgs.length > 0) {
      config.pricingPlans = pkgs.map((pkg: any, idx: number) => ({
        id: pkg.id || `plan_${idx}`,
        name: pkg.name || `باقة ${idx + 1}`,
        nameEn: pkg.nameEn || pkg.name || '',
        price: String(pkg.priceMonthly || pkg.price || '0'),
        priceEn: String(pkg.priceMonthly || pkg.price || '0'),
        period: pkg.period || 'شهرياً',
        periodEn: pkg.periodEn || 'monthly',
        badge: pkg.badge || (pkg.isPopular ? 'الأكثر طلباً' : ''),
        features: Array.isArray(pkg.features)
          ? pkg.features
          : typeof pkg.featuresText === 'string'
            ? pkg.featuresText.split('\n').map((s: string) => s.trim()).filter(Boolean)
            : [],
        featuresEn: Array.isArray(pkg.featuresEn) ? pkg.featuresEn : [],
        popular: Boolean(pkg.isPopular || pkg.isRecommended || pkg.popular),
        isFree: Boolean(pkg.isFree || Number(pkg.priceMonthly || pkg.price) === 0),
        visible: pkg.visible !== false,
      }))
    }
  } catch (err) {
    console.warn('[landing-store] packages query skipped:', err)
  }

  return config
}
