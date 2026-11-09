import 'server-only'
import { hashPassword } from '@/lib/auth-crypto'

export async function normalizeAssistantAccounts(value: unknown, previous: unknown) {
  if (!Array.isArray(value) || value.length > 30) throw new Error('INVALID_ASSISTANT_ACCOUNTS')
  const old = Array.isArray(previous) ? previous : []
  const ids = new Set<string>(), aliases = new Set<string>()
  const accounts = []
  for (const input of value) {
    if (!input || typeof input !== 'object') throw new Error('INVALID_ASSISTANT_ACCOUNT')
    const id = String(input.id || '')
    const email = String(input.email || '').trim().toLowerCase()
    const username = String(input.username || '').trim().toLowerCase()
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || ids.has(id) ||
        (!email && !username) || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) ||
        (username && !/^[a-z0-9._-]{3,32}$/.test(username))) throw new Error('INVALID_ASSISTANT_ACCOUNT')
    ids.add(id)
    for (const alias of [email, username].filter(Boolean)) {
      if (aliases.has(alias)) throw new Error('DUPLICATE_ASSISTANT_IDENTITY')
      aliases.add(alias)
    }
    const prior = old.find((a: any) => a.id === id)
    const password = typeof input.password === 'string' ? input.password : ''
    if (password && (password.length < 6 || password.length > 1024)) throw new Error('INVALID_ASSISTANT_PASSWORD')
    // Never trust a browser-supplied hash or erase a hash omitted by a safe GET.
    const passwordHash = password ? await hashPassword(password) : prior?.passwordHash
    if (typeof passwordHash !== 'string' || !passwordHash) throw new Error('ASSISTANT_PASSWORD_REQUIRED')
    accounts.push({ id, name: String(input.name || 'مساعد العيادة').slice(0,120),
      email, username, passwordHash, branchId: String(input.branchId || ''),
      branchName: String(input.branchName || '').slice(0,120), isActive: input.isActive !== false })
  }
  const identity = (items: any[]) => JSON.stringify(items.map(a => ({ id: a.id,
    email: String(a.email || '').toLowerCase(), username: String(a.username || '').toLowerCase(),
    passwordHash: a.passwordHash, branchId: String(a.branchId || ''), isActive: a.isActive !== false,
  })).sort((a,b) => String(a.id).localeCompare(String(b.id))))
  return { accounts, credentialsChanged: identity(accounts) !== identity(old) }
}
