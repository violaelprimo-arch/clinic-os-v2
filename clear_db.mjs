import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs, deleteDoc, doc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const collections = [
  'clinics', 'appointments', 'prescriptions', 'patient_accounts', 'platformSettings', 'system'
];

async function clearDb() {
  console.log('Starting DB wipe...');
  for (const collName of collections) {
    const snap = await getDocs(collection(db, collName));
    console.log(`Found ${snap.size} documents in ${collName}. Deleting...`);
    for (const d of snap.docs) {
      await deleteDoc(doc(db, collName, d.id));
    }
  }
  console.log('Finished DB wipe.');
}

clearDb().catch(console.error);
