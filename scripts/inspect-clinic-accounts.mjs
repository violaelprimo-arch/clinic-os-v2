import { initializeApp, getApps, getApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
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
  const snap = await getDocs(collection(db, 'clinics'));
  for (const d of snap.docs) {
    const c = d.data();
    console.log('CLINIC:', d.id, c.slug, c.name);
    console.log('  doctor:', c.doctorName, c.doctorEmail, c.doctorPassword ? 'pwd:yes' : (c.doctorPasswordHash ? 'hash:yes' : 'no-pwd'));
    console.log('  assistant:', c.assistantName, c.assistantEmail, c.assistantPassword ? 'pwd:yes' : (c.assistantPasswordHash ? 'hash:yes' : 'no-pwd'));
    console.log('  assistants array:', c.assistants);
    console.log('  services:', (c.services || []).map(s => s.name || s.title));
  }
  process.exit(0);
}
run();
