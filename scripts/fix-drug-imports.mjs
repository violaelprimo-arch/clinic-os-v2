import fs from 'fs'

// 1. Prescriptions page
let rx = fs.readFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', 'utf8')
rx = rx.replace(/import\s*\{\s*EGYPTIAN_DRUGS\s*\}\s*from\s*['"]@\/lib\/egyptian-drugs['"]\r?\n?/, '')
fs.writeFileSync('src/app/clinic/[slug]/admin/prescriptions/page.tsx', rx, 'utf8')

// 2. Drugs page
let drugs = fs.readFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', 'utf8')
drugs = drugs.replace(/import\s*\{\s*DrugItem\s*\}\s*from\s*['"]@\/lib\/egyptian-drugs['"]/, "import type { DrugItem } from '@/lib/egyptian-drugs'")
fs.writeFileSync('src/app/clinic/[slug]/admin/drugs/page.tsx', drugs, 'utf8')

console.log('Fixed imports in prescriptions and drugs pages!')
