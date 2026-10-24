'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'
import { EGYPTIAN_DRUGS } from '@/lib/egyptian-drugs'
import {
  normalizeDrugKey,
  normalizeArabicDrugKey,
  canonicalDrugIdentifier,
} from '@/lib/drugUtils'

export interface EgyptianDrug {
  commercial_name_en: string
  commercial_name_ar: string
  scientific_name: string
  manufacturer: string
  drug_class: string
  route: string
  price_egp: number
  isMarketUpdated?: boolean
  lastMarketUpdate?: string
  oldPrice?: number
  canonicalKey?: string
}

export { normalizeDrugKey, normalizeArabicDrugKey, canonicalDrugIdentifier }

// In-memory cache to guarantee 0ms latency across route navigations
let cachedDrugs: EgyptianDrug[] | null = null
let fetchPromise: Promise<EgyptianDrug[]> | null = null

const CACHE_STORAGE_KEY = 'egyptian_drugs_cache_v2'
const CACHE_TIMESTAMP_KEY = 'egyptian_drugs_cache_time_v2'
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
 * Loads baseline clinical drugs combined with authoritative live market prices.
 * market_prices is the single source of truth for updated pricing and dates.
 * Duplicates are strictly eliminated via canonical drug keys.
 */
async function fetchAndMergeDrugs(): Promise<EgyptianDrug[]> {
  // 1. Fetch live market prices from Firestore (single source of truth for Egyptian prices)
  let liveMarketData: any[] = []
  try {
    const snap = await getDocs(collection(db, 'market_prices'))
    liveMarketData = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  } catch (err) {
    console.warn('Could not fetch market_prices from Firestore, using baseline catalog:', err)
  }

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
          commercial_name_ar: drug.commercial_name_ar || existing.commercial_name_ar,
          commercial_name_en: drug.commercial_name_en || existing.commercial_name_en,
        })
      }
    }
  }

  // A. Register authoritative live market prices first
  for (const m of liveMarketData) {
    const price = Number(m.price)
    if (price > 0) {
      registerDrug({
        commercial_name_en: m.name || m.commercial_name_en || m.slug?.replace(/-/g, ' ') || '',
        commercial_name_ar: m.nameAr || m.commercial_name_ar || '',
        scientific_name: m.activeIngredient || 'معتمد مصرياً',
        manufacturer: m.company || 'سوق الدواء المصري',
        drug_class: 'معتمد',
        route: m.form || 'أقراص / شراب / حقن',
        price_egp: price,
        isMarketUpdated: true,
        lastMarketUpdate: m.last_updated || (m.updatedAt ? m.updatedAt.split('T')[0] : ''),
        oldPrice: m.oldPrice ? Number(m.oldPrice) : undefined,
      })
    }
  }

  // B. Register curated baseline clinic drugs (only if not already registered with a market update)
  for (const name of EGYPTIAN_DRUGS) {
    const canonKey = canonicalDrugIdentifier(name)
    if (!drugMap.has(canonKey)) {
      registerDrug({
        commercial_name_en: name,
        commercial_name_ar: '',
        scientific_name: 'دواء مصري شائع',
        manufacturer: 'معتمد',
        drug_class: 'شائع الاستخدام',
        route: name.toLowerCase().includes('syrup')
          ? 'شراب'
          : name.toLowerCase().includes('injection')
          ? 'حقن'
          : 'أقراص / كبسولات',
        price_egp: 0,
        isMarketUpdated: false,
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
    return []
  })

  const [loading, setLoading] = useState<boolean>(!cachedDrugs || cachedDrugs.length === 0)
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

  return { drugs, loading, error, refresh: () => loadDrugs(true) }
}
