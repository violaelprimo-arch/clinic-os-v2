'use client'
import { useEffect, useState } from 'react'
import {
  DEFAULT_LANDING_CONFIG,
  landingConfigSchema,
} from '@/lib/landing-config'
import { LandingPageContent } from '@/components/landing/LandingPageContent'

export default function LandingPreview() {
  const [config, setConfig] = useState(DEFAULT_LANDING_CONFIG)

  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (
        event.origin !== location.origin ||
        event.source !== window.parent ||
        event.data?.type !== 'landing-draft'
      )
        return

      const result = landingConfigSchema.safeParse(event.data.config)
      if (result.success) {
        setConfig(result.data)
      } else if (event.data?.config && typeof event.data.config === 'object') {
        console.warn('Landing preview validation warning:', result.error)
        setConfig((prev) => ({ ...prev, ...event.data.config }))
      }
    }

    window.addEventListener('message', receive)
    window.parent.postMessage(
      { type: 'landing-preview-ready' },
      location.origin,
    )
    return () => window.removeEventListener('message', receive)
  }, [])

  return <LandingPageContent config={config} isPreview />
}
