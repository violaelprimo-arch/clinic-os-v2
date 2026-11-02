import { execSync } from 'child_process'

execSync('git add src/ scripts/ wrangler.toml', { stdio: 'inherit' })
execSync('git commit -m "fix(prescription): patient profile button, vitals under preview, invoice in patient profile, and fix cloudflare error 1102"', { stdio: 'inherit' })
console.log('Committed successfully!')
