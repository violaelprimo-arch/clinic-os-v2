// Run locally. Only the salted hash is printed; no account or database is modified.
import { randomBytes, pbkdf2Sync } from 'node:crypto'
import readline from 'node:readline'
import { Writable } from 'node:stream'
let password = process.env.OWNER_INITIAL_PASSWORD
if (!password) {
  if (!process.stdin.isTTY)
    throw new Error(
      'Use an interactive terminal or supply OWNER_INITIAL_PASSWORD for this process only.',
    )
  process.stdout.write('New owner password (hidden): ')
  const muted = new Writable({
    write(_chunk, _encoding, callback) {
      callback()
    },
  })
  const terminal = readline.createInterface({
    input: process.stdin,
    output: muted,
    terminal: true,
  })
  password = await new Promise((resolve) => terminal.question('', resolve))
  terminal.close()
  process.stdout.write('\n')
}
if (password.length < 14) throw new Error('Use at least 14 characters.')
const salt = randomBytes(16),
  iterations = 210000
const digest = pbkdf2Sync(password, salt, iterations, 32, 'sha256')
console.log(
  `pbkdf2$${iterations}$${salt.toString('base64url')}$${digest.toString('base64url')}`,
)
