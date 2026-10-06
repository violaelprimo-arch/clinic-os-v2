
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, query, where, getDocs, updateDoc, doc } from 'firebase/firestore';
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
  try {
    const q = query(collection(db, 'clinics'), where('slug', '==', 'demo'));
    const snap = await getDocs(q);
    const clinicId = snap.docs[0].id;
    
    const payload = {
        clinicName: 'Test',
        doctorName: 'Test',
        specialty: 'Test',
        heroImage: '',
        services: [
            { id: '1', name: '??? ????', price: 250 },
            { id: '2', name: '???????', price: 150 },
            { id: '3', name: '??? ??????', price: 400 },
            { id: '4', name: '?????? ?????', price: 100 }
        ],
        primaryColor: '#15B8A6',
        assistantPermissions: ['appointments'],
        averageVisitTime: 15,
        clinicAddress: 'Test',
        clinicPhone: '010',
        doctorPhone: '',
        mapsLink: '',
        clinicPhones: ['010'],
        aiEnabled: true,
        aiInstructions: '...',
        onlinePaymentEnabled: false,
        walletNumber: '',
        instapayHandle: '',
        assistants: [],
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'clinics', clinicId), payload);
      console.log('UPDATE SUCCESS');
  } catch(err) {
      console.error('UPDATE ERROR', err);
  }
  process.exit(0);
}
run();

