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

async function main() {
  console.log('--- Fetching all clinics ---');
  const clinicsSnap = await getDocs(collection(db, 'clinics'));
  console.log(`Total clinics in DB: ${clinicsSnap.size}`);
  
  const clinics = [];
  clinicsSnap.forEach(doc => {
    const d = doc.data();
    clinics.push({
      id: doc.id,
      name: d.name,
      slug: d.slug,
      doctorName: d.doctorName,
      doctorEmail: d.doctorEmail,
      doctorPhone: d.doctorPhone,
      assistantEmail: d.assistantEmail,
      assistantName: d.assistantName,
      assistantsCount: Array.isArray(d.assistants) ? d.assistants.length : 0,
      branchesCount: Array.isArray(d.branches) ? d.branches.length : 0,
      branches: (d.branches || []).map(b => ({ id: b.id, name: b.name })),
      servicesCount: Array.isArray(d.services) ? d.services.length : 0,
      maxDailyBookings: d.maxDailyBookings
    });
  });

  console.log(JSON.stringify(clinics, null, 2));

  const patientsSnap = await getDocs(collection(db, 'patients'));
  console.log(`Total patients in DB: ${patientsSnap.size}`);

  const apptsSnap = await getDocs(collection(db, 'appointments'));
  console.log(`Total appointments in DB: ${apptsSnap.size}`);

  const prescriptsSnap = await getDocs(collection(db, 'prescriptions'));
  console.log(`Total prescriptions in DB: ${prescriptsSnap.size}`);

  const invoicesSnap = await getDocs(collection(db, 'invoices'));
  console.log(`Total invoices in DB: ${invoicesSnap.size}`);

  process.exit(0);
}

main().catch(console.error);
