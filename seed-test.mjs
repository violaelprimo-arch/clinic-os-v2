import { initializeApp } from "firebase/app";
import { getFirestore, collection, addDoc } from "firebase/firestore";
import fs from "fs";

// Load environment variables from .env.local
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

async function seed() {
  const clinicId = 'demo';

  console.log("Seeding patients and appointments for", clinicId);

  const patients = [
    { name: 'محمد أحمد', phone: '01011111111', age: 30, gender: 'male' },
    { name: 'سارة محمود', phone: '01022222222', age: 25, gender: 'female' },
    { name: 'علي حسن', phone: '01033333333', age: 45, gender: 'male' },
    { name: 'فاطمة إبراهيم', phone: '01044444444', age: 22, gender: 'female' },
    { name: 'محمود سعد', phone: '01055555555', age: 50, gender: 'male' },
  ];

  const today = new Date().toISOString().split('T')[0];

  for (let i = 0; i < patients.length; i++) {
    const p = patients[i];
    
    const patientRef = await addDoc(collection(db, 'clinics', clinicId, 'patients'), {
      name: p.name,
      phone: p.phone,
      age: p.age,
      gender: p.gender,
      createdAt: new Date().toISOString(),
      visitsCount: 1,
      totalPaid: 350
    });
    
    await addDoc(collection(db, 'clinics', clinicId, 'appointments'), {
      patientId: patientRef.id,
      patientName: p.name,
      patientPhone: p.phone,
      serviceId: '1',
      serviceName: 'كشف عام',
      price: 350,
      date: today,
      status: i === 0 ? 'completed' : i === 1 ? 'in_progress' : 'waiting',
      queueNumber: i + 1,
      estimatedTime: '10:0' + i + ' AM',
      paymentMethod: 'cash',
      paymentStatus: i === 0 ? 'paid' : 'pending',
      createdAt: new Date().toISOString()
    });
    
    console.log(`Added patient ${p.name} and appointment.`);
  }

  console.log("Seeding complete!");
  process.exit(0);
}

seed().catch(console.error);
