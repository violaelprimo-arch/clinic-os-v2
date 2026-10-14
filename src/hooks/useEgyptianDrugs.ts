'use client'

import { useState, useEffect, useCallback } from 'react'
import { db } from '@/lib/firebase'
import { collection, getDocs } from 'firebase/firestore'

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
}

import { normalizeDrugKey, normalizeArabicDrugKey } from '@/lib/drugUtils'
export { normalizeDrugKey, normalizeArabicDrugKey }

// Global cache outside the hook so it persists across component mounts
let cachedDrugs: EgyptianDrug[] | null = null
let fetchPromise: Promise<EgyptianDrug[]> | null = null

export function clearDrugCache() {
  cachedDrugs = null
  fetchPromise = null
}

export function useEgyptianDrugs() {
  const [drugs, setDrugs] = useState<EgyptianDrug[]>(cachedDrugs || [])
  const [loading, setLoading] = useState<boolean>(!cachedDrugs)
  const [error, setError] = useState<string | null>(null)

  const loadDrugs = useCallback(async (force: boolean = false) => {
    if (force) {
      clearDrugCache()
    }

    if (cachedDrugs && !force) {
      setDrugs(cachedDrugs)
      setLoading(false)
      return cachedDrugs
    }

    setLoading(true)
    if (!fetchPromise) {
      fetchPromise = Promise.all([
        fetch('https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json').then(res => res.json()),
        getDocs(collection(db, 'market_prices')).then(snap => snap.docs.map(d => d.data())).catch(() => [])
      ]).then(([staticData, liveMarketData]) => {
        // Build robust multi-key market price map
        const marketMap = new Map<string, any>()
        liveMarketData.forEach((m: any) => {
          const price = Number(m.price)
          if (price > 0) {
            if (m.normalizedKey) marketMap.set(m.normalizedKey, m)
            if (m.name) marketMap.set(normalizeDrugKey(m.name), m)
            if (m.commercial_name_en) marketMap.set(normalizeDrugKey(m.commercial_name_en), m)
            if (m.slug) marketMap.set(normalizeDrugKey(m.slug.replace(/-/g, ' ')), m)
            if (m.nameAr) marketMap.set(normalizeArabicDrugKey(m.nameAr), m)
            if (m.commercial_name_ar) marketMap.set(normalizeArabicDrugKey(m.commercial_name_ar), m)
          }
        })

        const merged: EgyptianDrug[] = staticData.map((d: EgyptianDrug) => {
          const normEn = normalizeDrugKey(d.commercial_name_en || '')
          const normAr = normalizeArabicDrugKey(d.commercial_name_ar || '')
          const live = marketMap.get(normEn) || marketMap.get(normAr)
          if (live && Number(live.price) > 0) {
            return {
              ...d,
              price_egp: Number(live.price),
              isMarketUpdated: true,
              lastMarketUpdate: live.last_updated || live.updatedAt,
              oldPrice: live.oldPrice || (Number(live.price) !== d.price_egp ? d.price_egp : undefined)
            }
          }
          return d
        })

        // Add newly discovered drugs from DawaaGate that aren't in the static DB
        liveMarketData.forEach((m: any) => {
          const normEn = normalizeDrugKey(m.name || m.commercial_name_en || m.slug?.replace(/-/g, ' ') || '')
          const exists = staticData.some((sd: any) => normalizeDrugKey(sd.commercial_name_en || '') === normEn)
          if (!exists && m.price) {
            merged.push({
              commercial_name_en: m.name || m.slug?.replace(/-/g, ' ') || 'New Drug',
              commercial_name_ar: m.nameAr || m.name || '',
              scientific_name: m.activeIngredient || 'Market Updated',
              manufacturer: m.company || 'معتمد مصرياً',
              drug_class: 'N/A',
              route: 'N/A',
              price_egp: Number(m.price),
              isMarketUpdated: true,
              lastMarketUpdate: m.last_updated || m.updatedAt,
              oldPrice: m.oldPrice
            })
          }
        })

        cachedDrugs = merged
        return merged
      }).catch(err => {
        console.error('Error loading Egyptian drugs:', err)
        fetchPromise = null
        throw err
      })
    }

    try {
      const data = await fetchPromise
      setDrugs(data)
      setLoading(false)
      return data
    } catch (err: any) {
      setError(err.message)
      setLoading(false)
      throw err
    }
  }, [])

  useEffect(() => {
    let isMounted = true
    loadDrugs(false).then((data) => {
      if (isMounted) setDrugs(data)
    }).catch(() => {})

    return () => {
      isMounted = false
    }
  }, [loadDrugs])

  return { drugs, loading, error, refresh: () => loadDrugs(true) }
}
