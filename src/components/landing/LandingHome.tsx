'use client'
import { useEffect, useState } from 'react'
import {
  DEFAULT_LANDING_CONFIG,
  subscribeToLandingPageConfig,
} from '@/lib/landing-service'
import { LandingPageContent } from './LandingPageContent'
export function LandingHome() {
  const [config, setConfig] = useState(DEFAULT_LANDING_CONFIG)
  useEffect(() => subscribeToLandingPageConfig(setConfig), [])
  return <LandingPageContent config={config} />
}
