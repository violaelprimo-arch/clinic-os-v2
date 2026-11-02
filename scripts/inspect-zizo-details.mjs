import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs, query, where } from 'firebase/firestore';
import { readFileSync } from 'fs';

const envLocal = readFileSync('.env.local', 'utf8');
const env = {};
for (const line of envLocal.split('\n')) {
  const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
  if (match) {
    let value = match[2] || '';
    value = value.trim().replace(/^['"](.*)['"]$/, '$1');
    env[match[1]] = value;
  }
}

const firebaseConfig = {
  apiKey: env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
const db = getFirestore(app);

async function run() {
  const cSnap = await getDocs(query(collection(db, 'clinics'), where('slug', '==', 'zizo')));
  const cDoc = cSnap.docs[0];
  const apptSnap = await getDocs(query(collection(db, 'appointments'), where('clinic_id', '==', cDoc.id)));
  
  for (const d of apptSnap.docs) {
    const data = d.data();
    if (data.date === '2026-10-31' || data.date === '2026-11-01') {
      console.log('ID:', d.id);
      console.log(JSON.stringify(data, null, 2));
      console.log('---------------------------');
    }
  }
  process.exit(0);
}
run().catch(console.error);
