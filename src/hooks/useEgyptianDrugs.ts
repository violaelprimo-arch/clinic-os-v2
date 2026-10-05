'use client'

import { useState, useEffect } from 'react'

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
        fetchPromise = fetch('https://raw.githubusercontent.com/karem505/egyptian-drug-database/main/data/egyptian-drugs.json')
          .then(res => {
            if (!res.ok) throw new Error('Failed to fetch drugs data')
            return res.json()
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
