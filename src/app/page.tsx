import { LandingHome } from '@/components/landing/LandingHome'
import { publicLandingConfig } from '@/lib/server/landing-store'
import { DEFAULT_LANDING_CONFIG } from '@/lib/landing-config'

export const dynamic = 'force-dynamic'

export default async function Home() {
  let initialConfig = DEFAULT_LANDING_CONFIG
  try {
    initialConfig = await publicLandingConfig()
  } catch {
    // Fall back to default config if store is temporarily unreachable
  }

  return <LandingHome initialConfig={initialConfig} />
}
