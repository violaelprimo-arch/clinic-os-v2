'use client'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  mergeLandingConfig,
  type LandingPageConfig,
  type FeedbackItem,
  type TrialRequestItem,
} from './landing-config'
export * from './landing-config'
export async function landingApi<T>(
  path: string,
  method = 'GET',
  body?: unknown,
): Promise<T> {
  const response = await fetch(path, {
    method,
    credentials: 'same-origin',
    cache: 'no-store',
    ...(body === undefined
      ? {}
      : {
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        }),
  })
  const data = await response.json()
  if (!response.ok)
    throw new Error(
      (data.error || 'تعذر إتمام الطلب.') +
        (data.code ? ` [${data.code}]` : ''),
    )
  return data as T
}
export function subscribeToLandingPageConfig(
  callback: (config: LandingPageConfig) => void,
) {
  let cancelled = false
  const refresh = async () => {
    try {
      const data = await landingApi<{ config: LandingPageConfig }>(
        '/api/landing',
      )
      if (!cancelled) callback(mergeLandingConfig(data.config))
    } catch {
      /* Keep the last known public content when temporarily offline. */
    }
  }
  void refresh()
  const unsubscribe = onSnapshot(
    doc(db, 'site_settings', 'landing_page'),
    () => {
      void refresh()
    },
    () => {
      /* The HTTP endpoint remains available when direct Firestore reads are disabled. */
    },
  )
  const timer = window.setInterval(() => {
    if (!document.hidden) void refresh()
  }, 45000)
  const onVisible = () => {
    if (!document.hidden) void refresh()
  }
  document.addEventListener('visibilitychange', onVisible)
  return () => {
    cancelled = true
    unsubscribe()
    clearInterval(timer)
    document.removeEventListener('visibilitychange', onVisible)
  }
}
export async function getLandingPageConfig() {
  return (await landingApi<{ config: LandingPageConfig }>('/api/owner/landing'))
    .config
}
export async function saveLandingPageConfig(config: LandingPageConfig) {
  await landingApi('/api/owner/landing', 'PUT', config)
}
export async function submitClientFeedback(
  data: Omit<FeedbackItem, 'id' | 'createdAt' | 'approved'> & {
    website?: string
  },
) {
  await landingApi('/api/landing/feedback', 'POST', data)
}
export async function submitFreeTrialRequest(
  data: Omit<TrialRequestItem, 'id' | 'createdAt' | 'status'> & {
    website?: string
  },
) {
  await landingApi('/api/landing/trials', 'POST', data)
}
export async function getFreeTrialRequests() {
  return (
    await landingApi<{ requests: TrialRequestItem[] }>(
      '/api/owner/landing/trials',
    )
  ).requests
}
export async function getClientFeedback() {
  return (
    await landingApi<{ feedback: FeedbackItem[] }>(
      '/api/owner/landing/feedback',
    )
  ).feedback
}
