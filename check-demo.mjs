
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs } from 'firebase/firestore';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const app = initializeApp({
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID
});
const db = getFirestore(app);
async function run() {
  const q = query(collection(db, 'clinics'), where('slug', '==', 'demo'));
  const snap = await getDocs(q);
  console.log('Exists?', !snap.empty, 'Docs:', snap.size);
  process.exit(0);
}
run();

