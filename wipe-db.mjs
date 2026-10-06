import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs, deleteDoc } from "firebase/firestore";
import fs from "fs";

const envFile = fs.readFileSync('.env.local', 'utf8');
const envVars = {};
envFile.split('\n').forEach(line => {
  const match = line.match(/^([^=]+)=(.*)$/);
  if (match) {
    envVars[match[1]] = match[2].trim().replace(/^"|"$/g, '');
  }
});

const firebaseConfig = {
  apiKey: envVars.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: envVars.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: envVars.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: envVars.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: envVars.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: envVars.NEXT_PUBLIC_FIREBASE_APP_ID,
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

async function wipe() {
  const clinicsSnap = await getDocs(collection(db, 'clinics'));
  for (const doc of clinicsSnap.docs) {
    const subcols = ['appointments', 'patients', 'prescriptions'];
    for (const sub of subcols) {
       const subSnap = await getDocs(collection(db, 'clinics', doc.id, sub));
       for (const subDoc of subSnap.docs) {
         await deleteDoc(subDoc.ref);
         console.log(`Deleted ${sub}/${subDoc.id}`);
       }
    }
  }
  console.log("Wipe complete!");
  process.exit(0);
}

wipe().catch(console.error);
