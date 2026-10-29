import { LandingHome } from '@/components/landing/LandingHome'
import { DEFAULT_LANDING_CONFIG } from '@/lib/landing-config'

export default function Home() {
  return <LandingHome initialConfig={DEFAULT_LANDING_CONFIG} />
}
