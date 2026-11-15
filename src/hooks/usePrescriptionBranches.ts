import { useEffect, useState } from 'react'
import type { Branch } from '@/types/clinic'

export function usePrescriptionBranches(slug: string, enabled = true) {
  const [result, setResult] = useState<{ slug: string; branches: Branch[] }>()
  useEffect(() => {
    if (!slug || !enabled) return
    const controller = new AbortController()
    void fetch(`/api/clinic/${encodeURIComponent(slug)}/branches`, { signal: controller.signal })
      .then(async response => {
        if (!response.ok) return
        const { branches } = await response.json()
        if (!controller.signal.aborted && Array.isArray(branches)) setResult({ slug, branches })
      })
      .catch(() => {})
    return () => controller.abort()
  }, [slug, enabled])
  return result?.slug === slug ? result.branches : undefined
}
