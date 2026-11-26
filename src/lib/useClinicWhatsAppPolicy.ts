'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  resolveEffectiveWhatsAppPolicy,
  type EffectiveWhatsAppPolicy,
} from '@/lib/whatsapp-policy'

export interface ClinicWhatsAppPolicyState {
  policy: EffectiveWhatsAppPolicy
  loaded: boolean
  sessionStatus: string
  wpSenderMode: string
  refresh: () => Promise<void>
}

export function useClinicWhatsAppPolicy(slug?: string | null, clinic?: any): ClinicWhatsAppPolicyState {
  const [serverPolicy, setServerPolicy] = useState<EffectiveWhatsAppPolicy | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [sessionStatus, setSessionStatus] = useState('unknown')
  const [wpSenderMode, setWpSenderMode] = useState('off')

  const refresh = useCallback(async () => {
    if (!slug) return
    try {
      const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/whatsapp/policy`, {
        cache: 'no-store',
        credentials: 'same-origin',
      })
      if (res.ok) {
        const data = await res.json()
        if (data?.policy) setServerPolicy(data.policy)
        if (data?.sessionStatus) setSessionStatus(String(data.sessionStatus))
        if (data?.wpSender?.mode) setWpSenderMode(String(data.wpSender.mode))
      }
    } catch {
      // Fall back to resolved clinic metadata cleanly
    } finally {
      setLoaded(true)
    }
  }, [slug])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const fallbackPolicy = resolveEffectiveWhatsAppPolicy({ clinic })
  return {
    policy: serverPolicy || fallbackPolicy,
    loaded,
    sessionStatus,
    wpSenderMode,
    refresh,
  }
}
