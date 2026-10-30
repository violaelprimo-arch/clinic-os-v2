'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_LANDING_CONFIG,
  landingConfigSchema,
  type LandingPageConfig,
} from '@/lib/landing-config'
import { LandingPageContent } from '@/components/landing/LandingPageContent'

export default function LandingPreview() {
  const [config, setConfig] = useState<LandingPageConfig>(DEFAULT_LANDING_CONFIG)

  useEffect(() => {
    // 1. Immediately hydrate from localStorage if available (for new tab or reload)
    try {
      const stored = localStorage.getItem('yalla_landing_draft')
      if (stored) {
        const parsed = JSON.parse(stored)
        const result = landingConfigSchema.safeParse(parsed)
        if (result.success) {
          setConfig(result.data)
        } else if (parsed && typeof parsed === 'object') {
          setConfig((prev) => ({ ...prev, ...parsed }))
        }
      }
    } catch {
      // ignore
    }

    // 2. Real-time postMessage listener
    const receive = (event: MessageEvent) => {
      if (event.origin !== location.origin) return
      if (event.source !== window.parent && event.source !== window.opener) return
      if (event.data?.type !== 'landing-draft') return

      const result = landingConfigSchema.safeParse(event.data.config)
      if (result.success) {
        setConfig(result.data)
      } else if (event.data?.config && typeof event.data.config === 'object') {
        console.warn('Landing preview validation warning:', result.error)
        setConfig((prev) => ({ ...prev, ...event.data.config }))
      }
    }

    window.addEventListener('message', receive)

    // Notify parent or opener that preview is ready
    if (window.parent && window.parent !== window) {
      window.parent.postMessage({ type: 'landing-preview-ready' }, location.origin)
    }
    if (window.opener) {
      window.opener.postMessage({ type: 'landing-preview-ready' }, location.origin)
    }

    return () => window.removeEventListener('message', receive)
  }, [])

  return <LandingPageContent config={config} isPreview />
}
