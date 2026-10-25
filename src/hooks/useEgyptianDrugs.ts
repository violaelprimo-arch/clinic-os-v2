'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { EGYPTIAN_DRUGS_CATALOG, DrugItem } from '@/lib/egyptian-drugs'
import {
  normalizeDrugKey,
  normalizeArabicDrugKey,
  canonicalDrugIdentifier,
  matchesDrugSearch,
} from '@/lib/drugUtils'

export interface EgyptianDrug {
  id?: string
  name: string
  nameAr?: string
  commercial_name_en: string
  commercial_name_ar: string
  scientific_name: string
  activeIngredient?: string
  manufacturer: string
  company?: string
  drug_class: string
  route: string
  form?: string
  price_egp: number
  price?: number
  isMarketUpdated?: boolean
  lastMarketUpdate?: string
  oldPrice?: number
  canonicalKey?: string
  slug?: string
}

export { normalizeDrugKey, normalizeArabicDrugKey, canonicalDrugIdentifier, matchesDrugSearch }

// In-memory cache to guarantee 0ms latency across route navigations
let cachedDrugs: EgyptianDrug[] | null = null
let fetchPromise: Promise<EgyptianDrug[]> | null = null

const CACHE_STORAGE_KEY = 'egyptian_drugs_cache_v3'
const CACHE_TIMESTAMP_KEY = 'egyptian_drugs_cache_time_v3'
const CACHE_TTL_MS = 1000 * 60 * 60 * 6 // 6 hours

export function clearDrugCache() {
  cachedDrugs = null
  fetchPromise = null
  if (typeof window !== 'undefined') {
    try {
      localStorage.removeItem(CACHE_STORAGE_KEY)
      localStorage.removeItem(CACHE_TIMESTAMP_KEY)
    } catch {}
  }
}

/**
 * Loads the comprehensive Egyptian drug catalog combined with authoritative live market prices.
 * market_prices is the single source of truth for updated pricing and dates.
 * Duplicates are strictly eliminated via canonical drug keys.
 */
async function fetchAndMergeDrugs(): Promise<EgyptianDrug[]> {
  // Map keyed by canonical identifier to guarantee ZERO duplicates
  const drugMap = new Map<string, EgyptianDrug>()

  // Helper to register or update a drug entry
  const registerDrug = (drug: EgyptianDrug) => {
    const canonKey =
      canonicalDrugIdentifier(drug.commercial_name_en) ||
      canonicalDrugIdentifier(drug.commercial_name_ar) ||
      normalizeDrugKey(drug.commercial_name_en) ||
      'unknown'

    drug.canonicalKey = canonKey

    if (!drugMap.has(canonKey)) {
      drugMap.set(canonKey, drug)
      return
    }

    const existing = drugMap.get(canonKey)!

    // If new candidate has market update and existing does not, new candidate wins
    if (drug.isMarketUpdated && !existing.isMarketUpdated) {
      drugMap.set(canonKey, {
        ...existing,
        ...drug,
        // preserve Arabic/English names if one side was richer
        nameAr: drug.nameAr || existing.nameAr,
        name: drug.name || existing.name,
        commercial_name_ar: drug.commercial_name_ar || existing.commercial_name_ar,
        commercial_name_en: drug.commercial_name_en || existing.commercial_name_en,
      })
      return
    }

    // If both have market updates, keep the one with the latest update date
    if (drug.isMarketUpdated && existing.isMarketUpdated) {
      const dateA = drug.lastMarketUpdate || ''
      const dateB = existing.lastMarketUpdate || ''
      if (dateA >= dateB) {
        drugMap.set(canonKey, {
          ...existing,
          ...drug,
          nameAr: drug.nameAr || existing.nameAr,
          name: drug.name || existing.name,
          commercial_name_ar: drug.commercial_name_ar || existing.commercial_name_ar,
          commercial_name_en: drug.commercial_name_en || existing.commercial_name_en,
        })
      }
    }
  }

  // 1. Register baseline comprehensive Egyptian catalog (1,000+ curated items)
  for (const c of EGYPTIAN_DRUGS_CATALOG) {
    registerDrug({
      id: c.id,
      slug: c.slug,
      name: c.name,
      nameAr: c.nameAr || '',
      commercial_name_en: c.commercial_name_en || c.name,
      commercial_name_ar: c.commercial_name_ar || c.nameAr || '',
      scientific_name: c.activeIngredient || 'معتمد مصرياً',
      activeIngredient: c.activeIngredient || 'معتمد مصرياً',
      manufacturer: c.company || 'سوق الدواء المصري',
      company: c.company || 'سوق الدواء المصري',
      drug_class: 'دليل الأدوية المصري',
      route: c.form || 'أقراص',
      form: c.form || 'أقراص',
      price_egp: c.price,
      price: c.price,
      oldPrice: c.oldPrice,
      isMarketUpdated: c.isMarketUpdated ?? (c.price > 0),
      lastMarketUpdate: c.lastMarketUpdate || '',
    })
  }

  // 2. Fetch live market prices from Firestore (single source of truth for updated Egyptian prices)
  let liveMarketData: any[] = []
  try {
    const snap = await getDocs(collection(db, 'market_prices'))
    liveMarketData = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.warn('Could not fetch market_prices from Firestore, using baseline catalog:', err)
  }

  // Register authoritative live market prices
  for (const m of liveMarketData) {
    const price = Number(m.price)
    if (price > 0) {
      registerDrug({
        id: m.id || m.slug,
        slug: m.slug,
        name: m.name || m.commercial_name_en || m.slug?.replace(/-/g, ' ') || '',
        nameAr: m.nameAr || m.commercial_name_ar || '',
        commercial_name_en: m.name || m.commercial_name_en || m.slug?.replace(/-/g, ' ') || '',
        commercial_name_ar: m.nameAr || m.commercial_name_ar || '',
        scientific_name: m.activeIngredient || 'معتمد مصرياً',
        activeIngredient: m.activeIngredient || 'معتمد مصرياً',
        manufacturer: m.company || 'سوق الدواء المصري',
        company: m.company || 'سوق الدواء المصري',
        drug_class: 'سوق الدواء المصري',
        route: m.form || 'أقراص / شراب / حقن',
        form: m.form || 'أقراص / شراب / حقن',
        price_egp: price,
        price: price,
        isMarketUpdated: true,
        lastMarketUpdate: m.last_updated || (m.updatedAt ? m.updatedAt.split('T')[0] : ''),
        oldPrice: m.oldPrice ? Number(m.oldPrice) : undefined,
      })
    }
  }

  const result = Array.from(drugMap.values())
  cachedDrugs = result

  // Save to localStorage for instant reload on next visit
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(result))
      localStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
    } catch {}
  }

  return result
}

export function useEgyptianDrugs() {
  const [drugs, setDrugs] = useState<EgyptianDrug[]>(() => {
    if (cachedDrugs) return cachedDrugs
    // Try localStorage on initial mount
    if (typeof window !== 'undefined') {
      try {
        const stored = localStorage.getItem(CACHE_STORAGE_KEY)
        const time = localStorage.getItem(CACHE_TIMESTAMP_KEY)
        if (stored && time && Date.now() - Number(time) < CACHE_TTL_MS) {
          const parsed = JSON.parse(stored)
          if (Array.isArray(parsed) && parsed.length > 0) {
            cachedDrugs = parsed
            return parsed
          }
        }
      } catch {}
    }
    // Fallback immediately to compiled baseline catalog (0ms delay)
    return EGYPTIAN_DRUGS_CATALOG.map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      nameAr: c.nameAr || '',
      commercial_name_en: c.commercial_name_en || c.name,
      commercial_name_ar: c.commercial_name_ar || c.nameAr || '',
      scientific_name: c.activeIngredient || 'معتمد مصرياً',
      activeIngredient: c.activeIngredient || 'معتمد مصرياً',
      manufacturer: c.company || 'سوق الدواء المصري',
      company: c.company || 'سوق الدواء المصري',
      drug_class: 'دليل الأدوية المصري',
      route: c.form || 'أقراص',
      form: c.form || 'أقراص',
      price_egp: c.price,
      price: c.price,
      oldPrice: c.oldPrice,
      isMarketUpdated: c.isMarketUpdated,
      lastMarketUpdate: c.lastMarketUpdate,
    }))
  })

  const [loading, setLoading] = useState<boolean>(false)
  const [error, setError] = useState<string | null>(null)

  const loadDrugs = useCallback(async (force: boolean = false) => {
    if (force) {
      clearDrugCache()
    }

    if (cachedDrugs && cachedDrugs.length > 0 && !force) {
      setDrugs(cachedDrugs)
      setLoading(false)
      return cachedDrugs
    }

    setLoading(true)
    if (!fetchPromise) {
      fetchPromise = fetchAndMergeDrugs().finally(() => {
        fetchPromise = null
      })
    }

    try {
      const data = await fetchPromise
      setDrugs(data)
      setLoading(false)
      return data
    } catch (err: any) {
      setError(err?.message || 'Error loading drug catalog')
      setLoading(false)
      throw err
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    loadDrugs(false)
      .then((data) => {
        if (isMounted) setDrugs(data)
      })
      .catch(() => {})

    return () => {
      isMounted = false
    }
  }, [loadDrugs])

  /**
   * Search drugs with bilingual matching (Arabic + English + Active Ingredient + Company)
   */
  const searchDrugs = useCallback(
    (query: string, limit = 50): EgyptianDrug[] => {
      if (!query || !query.trim()) return drugs.slice(0, limit)
      const results: EgyptianDrug[] = []
      for (let i = 0; i < drugs.length; i++) {
        if (matchesDrugSearch(drugs[i], query)) {
          results.push(drugs[i])
          if (results.length >= limit) break
        }
      }
      return results
    },
    [drugs]
  )

  /**
   * Performs an authoritative live search directly against DawaaGate and saves newly found drugs
   */
  const syncDrugLive = useCallback(
    async (query: string): Promise<EgyptianDrug[]> => {
      if (!query || !query.trim()) return []
      try {
        const res = await fetch(`/api/sync-daily-prices?q=${encodeURIComponent(query.trim())}`)
        const data = await res.json()
        if (res.ok && data.success && Array.isArray(data.records) && data.records.length > 0) {
          // Refresh catalog to incorporate newly synced items
          const refreshed = await loadDrugs(true)
          return refreshed.filter((d) => matchesDrugSearch(d, query))
        }
      } catch (err) {
        console.warn('Live sync error:', err)
      }
      return []
    },
    [loadDrugs]
  )

  return {
    drugs,
    loading,
    error,
    refresh: () => loadDrugs(true),
    searchDrugs,
    syncDrugLive,
  }
}
