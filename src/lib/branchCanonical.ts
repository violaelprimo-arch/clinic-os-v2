/**
 * Safe display-only de-duplication of legacy MAIN branch records.
 * Never deletes, migrates or rewrites Firestore documents or appointment IDs.
 * Physical sub-branches are never collapsed merely because they share an address.
 */
export type CanonicalBranch = {
  id: string
  name?: string
  address?: string
  clinicId?: string
  clinic_id?: string
  isMain?: boolean
  isOpen?: boolean
  isArchived?: boolean
  updatedAt?: string
}

const normalize = (value: unknown): string =>
  String(value || '').normalize('NFKC').trim().replace(/\s+/g, ' ').toLocaleLowerCase()

export function mainBranchDuplicateKey(branch: CanonicalBranch): string | null {
  const name = normalize(branch.name)
  const isMain = branch.isMain === true || name === 'الفرع الرئيسي' || name === 'main branch'
  if (!isMain) return null
  const address = normalize(branch.address)
  if (!address || address === 'عنوان الفرع' || address === 'مقر العيادة') return null
  return [normalize(branch.clinicId || branch.clinic_id), 'main', address].join('|')
}

/**
 * When conflicting duplicate MAIN records exist, the closed record wins until
 * owner archives the duplicate. This fails closed, never reopens bookings by
 * accidentally picking an outdated open document.
 */
export function canonicalizeBranches<T extends CanonicalBranch>(branches: T[]): T[] {
  const results: T[] = []
  const indexes = new Map<string, number>()
  for (const branch of branches) {
    if (branch.isArchived === true) continue
    const key = mainBranchDuplicateKey(branch)
    if (!key) {
      results.push(branch)
      continue
    }
    const index = indexes.get(key)
    if (index === undefined) {
      indexes.set(key, results.length)
      results.push(branch)
      continue
    }
    const existing = results[index]
    const chooseNew = (existing.isOpen !== false && branch.isOpen === false) ||
      (existing.isOpen === branch.isOpen &&
        String(branch.updatedAt || '') > String(existing.updatedAt || ''))
    if (chooseNew) results[index] = branch
  }
  return results
}
