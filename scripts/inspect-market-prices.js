const fs = require('fs')
const path = require('path')

const envContent = fs.readFileSync(path.join(__dirname, '..', '.env.local'), 'utf8')
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
const { getFirestore, collection, getDocs } = require('firebase/firestore')

const app = initializeApp({
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID
})

const db = getFirestore(app)

async function inspect() {
  const snap = await getDocs(collection(db, 'market_prices'))
  console.log('Total documents in market_prices:', snap.size)
  const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  
  // Check duplicates in market_prices
  const byKey = new Map()
  let duplicates = 0
  for (const doc of docs) {
    const key = (doc.normalizedKey || doc.id || '').toLowerCase()
    if (byKey.has(key)) {
      duplicates++
    } else {
      byKey.set(key, doc)
    }
  }
  console.log('Unique normalized keys:', byKey.size)
  console.log('Duplicate entries in market_prices:', duplicates)

  if (docs.length > 0) {
    console.log('Sample 3 docs:', JSON.stringify(docs.slice(0, 3), null, 2))
  }
}

inspect().then(() => process.exit(0)).catch(e => {
  console.error(e)
  process.exit(1)
})
