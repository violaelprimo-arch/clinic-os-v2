'use client'

import { useEffect, useState } from 'react'
import {
  DEFAULT_LANDING_CONFIG,
  subscribeToLandingPageConfig,
  type LandingPageConfig,
} from '@/lib/landing-service'
import { LandingPageContent } from './LandingPageContent'

export function LandingHome({
  initialConfig,
}: {
  initialConfig?: LandingPageConfig
}) {
  const [config, setConfig] = useState<LandingPageConfig>(
    initialConfig || DEFAULT_LANDING_CONFIG,
  )

  useEffect(() => subscribeToLandingPageConfig(setConfig), [])

  return <LandingPageContent config={config} />
}
