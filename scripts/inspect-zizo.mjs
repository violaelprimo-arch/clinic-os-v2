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
  const apptSnap = await getDocs(collection(db, 'appointments'));
  const serviceNames = new Set();
  const matched = [];
  apptSnap.docs.forEach(d => {
    const data = d.data();
    if (data.serviceName) serviceNames.add(data.serviceName);
    if (
      String(data.serviceName).toLowerCase().includes('emerg') ||
      String(data.serviceName).includes('طوارئ') ||
      String(data.serviceName).includes('طارئ') ||
      !data.queue_number ||
      isNaN(Number(data.queue_number))
    ) {
      matched.push({ id: d.id, ...data });
    }
  });

  console.log('All unique serviceNames:', Array.from(serviceNames));
  console.log('Matched count:', matched.length);
  for (const m of matched) {
    console.log({
      id: m.id,
      clinic_id: m.clinic_id,
      patientName: m.patientName,
      serviceName: m.serviceName,
      status: m.status,
      date: m.date,
      queue_number: m.queue_number
    });
  }
  process.exit(0);
}
run().catch(console.error);
