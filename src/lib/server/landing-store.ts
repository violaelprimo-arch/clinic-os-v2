import 'server-only'
import { mergeLandingConfig, type FeedbackItem } from '@/lib/landing-config'
import { readDocument, queryDocuments } from './firebase-rest'
export async function readLandingConfig() {
  return mergeLandingConfig(await readDocument('site_settings/landing_page'))
}
export async function publicLandingConfig() {
  const config = await readLandingConfig()
  const reviews = await queryDocuments('landing_feedback', true).catch(() => {
    console.error('LANDING_FEEDBACK_QUERY_FAILED')
    return []
  })
  config.feedbacks = [
    ...config.feedbacks.filter((item) => item.approved),
    ...reviews.map(
      (item) =>
        ({
          id: item.id,
          authorName: String(item.authorName || ''),
          clinicName: String(item.clinicName || ''),
          specialty: String(item.specialty || ''),
          rating: Number(item.rating),
          comment: String(item.comment || ''),
          approved: true,
          createdAt: String(item.createdAt || ''),
        }) satisfies FeedbackItem,
    ),
  ]
  return config
}
