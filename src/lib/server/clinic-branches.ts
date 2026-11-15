import type { Branch } from '@/types/clinic'
import { queryDocumentsByField } from '@/lib/server/firebase-rest'

/**
 * Helper to fetch all branches for a clinic doc ID.
 * Looks for both clinicId and clinic_id fields for complete compatibility.
 */
export async function fetchBranchesForClinic(clinicId: string, slug?: string, includeArchived = false): Promise<Branch[]> {
  // Server credentials are required after client Firestore access was restricted.
  // Never silently return an empty list if the database is unavailable.
  const groups = await Promise.all([
    queryDocumentsByField('branches', 'clinicId', clinicId),
    queryDocumentsByField('branches', 'clinic_id', clinicId),
    ...(slug && slug !== clinicId ? [queryDocumentsByField('branches', 'clinicId', slug),
      queryDocumentsByField('branches', 'clinic_id', slug)] : []),
  ])
  const matches = [...new Map(groups.flat().map(b => [b.id, b])).values()]

  return matches.filter((b: any) => includeArchived || b.isArchived !== true) as unknown as Branch[]
}
