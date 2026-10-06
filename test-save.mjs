
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, addDoc } from 'firebase/firestore';
import fs from 'fs';
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
    const payload = {
        clinicName: '',
        doctorName: '',
        specialty: '',
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
        clinicAddress: '',
        clinicPhone: '',
        doctorPhone: '',
        mapsLink: '',
        clinicPhones: ['01012345678'],
        aiEnabled: true,
        aiInstructions: '...',
        onlinePaymentEnabled: false,
        walletNumber: '',
        instapayHandle: '',
        assistants: [],
        updatedAt: new Date().toISOString()
      }
      await addDoc(collection(db, 'clinics'), {
          slug: 'demo',
          ...payload,
          isActive: true,
          createdAt: new Date().toISOString()
      })
      console.log('SUCCESS');
  } catch(err) {
      console.error('ERROR', err);
  }
  process.exit(0);
}
run();

