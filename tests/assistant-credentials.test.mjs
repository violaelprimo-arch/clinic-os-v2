import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeAssistantAccounts } from '../src/lib/server/assistant-credentials.ts'
import { verifyPassword } from '../src/lib/auth-crypto.ts'
test('new assistant passwords are hashed and never retained as plaintext', async () => {
  const result = await normalizeAssistantAccounts([{ id:'a1', username:'reception', password:'fixture-password' }], [])
  assert.equal(result.credentialsChanged, true)
  assert.equal(result.accounts[0].password, undefined)
  assert.ok(await verifyPassword('fixture-password', result.accounts[0].passwordHash))
})
test('editing ordinary assistant data preserves private hashes omitted by safe API responses', async () => {
  const prior = [{ id:'a1', email:'a@example.test', passwordHash:'existing-private-hash', name:'Old name' }]
  const result = await normalizeAssistantAccounts([{ id:'a1', email:'a@example.test', name:'New name', password:'' }], prior)
  assert.equal(result.accounts[0].passwordHash, 'existing-private-hash')
  assert.equal(result.credentialsChanged, false)
})
test('browser-supplied hashes and duplicate identities cannot create new assistants', async () => {
  await assert.rejects(() => normalizeAssistantAccounts([{ id:'a1', username:'one', passwordHash:'forged' }], []))
  await assert.rejects(() => normalizeAssistantAccounts([{ id:'a1', username:'one', password:'secret1' }, {id:'a2', username:'one', password:'secret2'}], []))
})
