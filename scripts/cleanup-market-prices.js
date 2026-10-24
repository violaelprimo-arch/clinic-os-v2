/**
 * Cleanup & Deduplication Script for Firestore `market_prices` Collection
 * 
 * Usage:
 *   node scripts/cleanup-market-prices.js            # Runs in DRY-RUN mode (safe inspection)
 *   node scripts/cleanup-market-prices.js --dry-run  # Explicit dry-run
 *   node scripts/cleanup-market-prices.js --apply    # Creates automatic backup and applies changes
 */

const fs = require('fs')
const path = require('path')

// 1. Read environment variables from .env.local
const envPath = path.join(__dirname, '..', '.env.local')
if (!fs.existsSync(envPath)) {
  console.error('Error: .env.local file not found at:', envPath)
  process.exit(1)
}

const envContent = fs.readFileSync(envPath, 'utf8')
const env = {}
envContent.split('\n').forEach(line => {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) return
  const idx = trimmed.indexOf('=')
  if (idx !== -1) {
    const k = trimmed.slice(0, idx).trim()
    const v = trimmed.slice(idx + 1).trim().replace(/^["']|["']$/g, '')
    env[k] = v
  }
})

const { initializeApp } = require('firebase/app')
const {
  getFirestore,
  collection,
  getDocs,
  doc,
  deleteDoc,
  setDoc
} = require('firebase/firestore')

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID
})

const db = getFirestore(app)

function canonicalDrugIdentifier(name) {
  if (!name) return ''
  return String(name)
    .toLowerCase()
    .replace(/\([^)]*\)/g, ' ')
    .replace(/(\d+)\s*(mg|gm|g|ml|mcg|iu|iu\/ml|%)/gi, '$1$2')
    .replace(/(\d+)\s*(مجم|جم|مل|قرص|كبسولة)/gi, '$1$2')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\b\d+\s*(tabs|tab|tablets|caps|capsules|ampoules|amps|vials|vial|قرص|كبسولة|امبول)\b/gi, ' ')
    .replace(/\b(f\.c\.|fctabs|fctab|f\.c|tablets|tablet|tabs|tab|capsules|capsule|caps|cap|syrup|syp|suspension|susp|injection|inj|ampoules|ampoule|drops|ointment|oint|cream|gel|lotion|spray|effervescent|sachets|sachet)\b/gi, ' ')
    .replace(/\b(اقراص|كبسولات|شراب|معلق|حقن|امبولات|نقط|مرهم|كريم|جل|فوار|اكياس)\b/gi, ' ')
    .replace(/[^a-z0-9\u0621-\u064A]/gi, '')
    .trim()
}

async function runCleanup() {
  const isApply = process.argv.includes('--apply')
  console.log('='.repeat(70))
  console.log(`[Egyptian Drug Market Prices Cleanup] Mode: ${isApply ? '>>> APPLY (Modifying Database) <<<' : 'DRY-RUN (Safe Inspection)'}`)
  console.log('='.repeat(70))

  console.log('1. Fetching all market_prices documents from Firestore...')
  const snapshot = await getDocs(collection(db, 'market_prices'))
  const total = snapshot.size
  console.log(`   Found ${total} total records in 'market_prices'.`)

  const allRecords = snapshot.docs.map(d => ({ docId: d.id, ...d.data() }))

  // Always save full snapshot backup
  const backupDir = path.join(__dirname, '..', 'backups')
  if (!fs.existsSync(backupDir)) {
    fs.mkdirSync(backupDir, { recursive: true })
  }
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const backupFile = path.join(backupDir, `market-prices-backup-${timestamp}.json`)
  fs.writeFileSync(backupFile, JSON.stringify(allRecords, null, 2), 'utf8')
  console.log(`2. Backup snapshot written to: ${backupFile}`)

  // 3. Group by canonical key to find duplicates
  const grouped = new Map()
  for (const record of allRecords) {
    const key =
      canonicalDrugIdentifier(record.commercial_name_en) ||
      canonicalDrugIdentifier(record.name) ||
      canonicalDrugIdentifier(record.commercial_name_ar) ||
      record.docId
    
    if (!grouped.has(key)) {
      grouped.set(key, [])
    }
    grouped.get(key).push(record)
  }

  const duplicates = []
  const uniqueKeys = grouped.size

  for (const [key, records] of grouped.entries()) {
    if (records.length > 1) {
      // Sort: latest update first, highest price / oldPrice preserved
      records.sort((a, b) => {
        const dateA = a.last_updated || a.updatedAt || ''
        const dateB = b.last_updated || b.updatedAt || ''
        return dateB.localeCompare(dateA)
      })
      duplicates.push({ key, winner: records[0], losers: records.slice(1) })
    }
  }

  console.log(`\n3. Deduplication Analysis:`)
  console.log(`   - Unique Canonical Drugs: ${uniqueKeys}`)
  console.log(`   - Duplicate Groups Found: ${duplicates.length}`)

  if (duplicates.length > 0) {
    console.log(`\n   Duplicate Groups Detail:`)
    duplicates.forEach((d, idx) => {
      console.log(`   [#${idx + 1}] Canonical Key: "${d.key}"`)
      console.log(`       - WINNER to keep: ID=${d.winner.docId}, Name="${d.winner.commercial_name_en || d.winner.name}", Price=${d.winner.price} EGP, Date=${d.winner.last_updated}`)
      d.losers.forEach(l => {
        console.log(`       - LOSER to remove: ID=${l.docId}, Name="${l.commercial_name_en || l.name}", Price=${l.price} EGP, Date=${l.last_updated}`)
      })
    })

    if (isApply) {
      console.log(`\n4. Applying changes: merging and deleting redundant records...`)
      let deletedCount = 0
      for (const d of duplicates) {
        // Merge winner if loser has oldPrice
        const winner = d.winner
        const combinedOldPrice = winner.oldPrice || d.losers.find(l => l.oldPrice)?.oldPrice
        if (combinedOldPrice && combinedOldPrice !== winner.price) {
          winner.oldPrice = combinedOldPrice
          await setDoc(doc(db, 'market_prices', winner.docId), winner, { merge: true })
        }

        // Delete loser docs
        for (const loser of d.losers) {
          if (loser.docId !== winner.docId) {
            await deleteDoc(doc(db, 'market_prices', loser.docId))
            deletedCount++
          }
        }
      }
      console.log(`   Done! Deleted ${deletedCount} redundant duplicate documents.`)
    } else {
      console.log(`\n4. [DRY RUN] No database writes performed. Pass --apply to execute cleanup with automatic backup.`)
    }
  } else {
    console.log(`   All ${total} documents in market_prices already have clean unique canonical keys! No duplicates to remove.`)
  }

  console.log('\nCleanup script completed successfully.')
}

runCleanup()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('Cleanup script error:', err)
    process.exit(1)
  })
