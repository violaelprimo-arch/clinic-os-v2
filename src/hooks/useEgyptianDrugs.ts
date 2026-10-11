'use client'

import { useState, useEffect } from 'react'
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
}

// Global cache outside the hook so it persists across component mounts
let cachedDrugs: EgyptianDrug[] | null = null
let fetchPromise: Promise<EgyptianDrug[]> | null = null

export function useEgyptianDrugs() {
  const [drugs, setDrugs] = useState<EgyptianDrug[]>([])
  const [loading, setLoading] = useState<boolean>(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const loadDrugs = async () => {
      if (cachedDrugs) {
        if (isMounted) {
          setDrugs(cachedDrugs)
          setLoading(false)
        }
        return
      }

      if (!fetchPromise) {
        fetchPromise = Promise.all([
          fetch('https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json').then(res => res.json()),
          getDocs(collection(db, 'market_prices')).then(snap => snap.docs.map(d => d.data())).catch(() => [])
        ]).then(([staticData, liveMarketData]) => {
          // Merge live market data over static data
          const marketMap = new Map();
          liveMarketData.forEach((m: any) => {
            marketMap.set(m.name.toLowerCase(), m.price);
          });
          
          const merged = staticData.map((d: EgyptianDrug) => {
            const livePrice = marketMap.get((d.commercial_name_en || '').toLowerCase());
            if (livePrice) {
              return { ...d, price_egp: livePrice };
            }
            return d;
          });
          
          // Add newly discovered drugs that aren't in the static DB
          liveMarketData.forEach((m: any) => {
            const exists = staticData.find((sd: any) => (sd.commercial_name_en || '').toLowerCase() === m.name.toLowerCase());
            if (!exists) {
              merged.push({
                commercial_name_en: m.name,
                commercial_name_ar: m.name,
                scientific_name: 'Market Updated',
                manufacturer: 'Updated Market Price',
                drug_class: 'N/A',
                route: 'N/A',
                price_egp: m.price
              });
            }
          });

          cachedDrugs = merged;
          return merged;
        }).catch(err => {
          console.error(err);
          fetchPromise = null;
          throw err;
        })
          .then((data: EgyptianDrug[]) => {
            cachedDrugs = data
            return data
          })
          .catch(err => {
            console.error(err)
            fetchPromise = null // Reset so we can try again
            throw err
          })
      }

      try {
        const data = await fetchPromise
        if (isMounted) {
          setDrugs(data)
          setLoading(false)
        }
      } catch (err: any) {
        if (isMounted) {
          setError(err.message)
          setLoading(false)
        }
      }
    }

    loadDrugs()

    return () => {
      isMounted = false
    }
  }, [])

  return { drugs, loading, error }
}
