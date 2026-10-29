'use client'

import { use } from 'react'
import dynamic from 'next/dynamic'
import { TvLoadingSkeleton } from './TvLoadingSkeleton'

// Client-only dynamic import ensures zero heavy SSR execution on Cloudflare Workers edge runtime.
// During SSR, only TvLoadingSkeleton renders (<0.2ms CPU).
// The TV screen with Web Audio APIs and Firebase listeners hydrates in the client browser.
const WaitingRoomTvClient = dynamic(() => import('./WaitingRoomTvClient'), {
  ssr: false,
  loading: () => <TvLoadingSkeleton />
})

export default function WaitingRoomTvPage({
  params
}: {
  params: Promise<{ slug: string }>
}) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug

  return <WaitingRoomTvClient slug={slug} />
}
