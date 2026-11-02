import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  collection,
  doc,
  getDocs,
  setDoc,
  updateDoc,
  addDoc,
  query,
  where
} from 'firebase/firestore';
import { readFileSync } from 'fs';

// Read .env.local
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

const AUTH_SALT_SECRET = process.env.AUTH_SECRET || 'clinic-os-v2-secure-cairo-salt-key-2026';
async function hashPwd(password) {
  const enc = new TextEncoder();
  const data = enc.encode(`${AUTH_SALT_SECRET}:${password}`);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

const DEFAULT_SCHEDULE = [
  { id: 'saturday', day: 'السبت', isOpen: true, start: '10:00', end: '22:00' },
  { id: 'sunday', day: 'الأحد', isOpen: true, start: '10:00', end: '22:00' },
  { id: 'monday', day: 'الاثنين', isOpen: true, start: '10:00', end: '22:00' },
  { id: 'tuesday', day: 'الثلاثاء', isOpen: true, start: '10:00', end: '22:00' },
  { id: 'wednesday', day: 'الأربعاء', isOpen: true, start: '10:00', end: '22:00' },
  { id: 'thursday', day: 'الخميس', isOpen: true, start: '10:00', end: '22:00' },
  { id: 'friday', day: 'الجمعة', isOpen: false, start: '10:00', end: '22:00' }
];

const CLINICS_DATA = [
  {
    id: 'XVU00NYtNTsXw4twxwyz',
    slug: 'zizo',
    name: 'عيادة زيزو التخصصية للأنف والأذن والباطنة',
    specialty: 'أنف وأذن وحنجرة وباطنة',
    doctorName: 'د. أحمد عبد العزيز',
    doctorEmail: 'zizo@gmail.com',
    doctorPhone: '01121320507',
    doctorPassword: 'password123',
    assistantName: 'أ. إيمان الشريف (سكرتيرة رئيسية)',
    assistantEmail: 'zizo2@gmail.com',
    assistantPhone: '01557540188',
    assistantPassword: 'password123',
    maxDailyBookings: 25,
    assistants: [
      {
        id: 'sec-zizo-2',
        name: 'أ. فاطمة خليل (سكرتيرة فرع المهندسين)',
        email: 'fatma.zizo@gmail.com',
        phone: '01011223344',
        password: 'password123',
        branchName: 'فرع المهندسين'
      }
    ],
    branches: [
      {
        id: 'XdHeNwX1abavvxVMcOjF',
        name: 'فرع شبرا الخيمة',
        address: 'شارع 15 مايو - شبرا الخيمة - القليوبية',
        phone: '01121320507',
        isMain: true,
        isOpen: true,
        coordinates: { lat: 30.128, lng: 31.242 }
      },
      {
        id: 'branch-zizo-mohandessin',
        name: 'فرع المهندسين',
        address: 'شارع جامعة الدول العربية - المهندسين - الجيزة',
        phone: '01011223344',
        isMain: false,
        isOpen: true,
        coordinates: { lat: 30.055, lng: 31.205 }
      }
    ],
    services: [
      { id: '1', name: 'كشف عادي', price: 250, duration: 20 },
      { id: '2', name: 'استشارة', price: 100, duration: 15 },
      { id: '3', name: 'كشف مستعجل / طوارئ', price: 400, duration: 20 }
    ],
    queuePattern: [
      { serviceId: '3', serviceName: 'كشف مستعجل / طوارئ', quota: 0 },
      { serviceId: '1', serviceName: 'كشف عادي', quota: 2 },
      { serviceId: '2', serviceName: 'استشارة', quota: 1 }
    ]
  },
  {
    id: 'LGAqk0w1DKIqCgKI9CE5',
    slug: 'dr-tarek-internal',
    name: 'عيادة د. طارق علام للباطنة وأمراض القلب',
    specialty: 'باطنة وقلب وأوعية دموية',
    doctorName: 'د. طارق علام',
    doctorEmail: 'dr.tarek@gmail.com',
    doctorPhone: '01099887766',
    doctorPassword: 'password123',
    assistantName: 'أ. مروة كمال (سكرتيرة رئيسية)',
    assistantEmail: 'sec.tarek@gmail.com',
    assistantPhone: '01155443322',
    assistantPassword: 'password123',
    maxDailyBookings: 25,
    assistants: [
      {
        id: 'sec-tarek-2',
        name: 'أ. نادية صبحي (سكرتيرة فرع التجمع)',
        email: 'nadia.tarek@gmail.com',
        phone: '01233445566',
        password: 'password123',
        branchName: 'فرع التجمع الخامس'
      }
    ],
    branches: [
      {
        id: 'branch-tarek-nasr',
        name: 'فرع مدينة نصر',
        address: 'شارع عباس العقاد - مدينة نصر - القاهرة',
        phone: '01099887766',
        isMain: true,
        isOpen: true,
        coordinates: { lat: 30.056, lng: 31.345 }
      },
      {
        id: 'branch-tarek-tagamoa',
        name: 'فرع التجمع الخامس',
        address: 'شارع التسعين الشمالي - التجمع الخامس - القاهرة الجديدة',
        phone: '01233445566',
        isMain: false,
        isOpen: true,
        coordinates: { lat: 30.027, lng: 31.472 }
      }
    ],
    services: [
      { id: '1', name: 'كشف استشاري باطنة', price: 350, duration: 25 },
      { id: '2', name: 'استشارة ومتابعة', price: 150, duration: 15 },
      { id: '3', name: 'رسم قلب وكشف مستعجل', price: 600, duration: 30 }
    ],
    queuePattern: [
      { serviceId: '3', serviceName: 'رسم قلب وكشف مستعجل', quota: 0 },
      { serviceId: '1', serviceName: 'كشف استشاري باطنة', quota: 2 },
      { serviceId: '2', serviceName: 'استشارة ومتابعة', quota: 1 }
    ]
  },
  {
    id: 'WRwl0gsIabDyRwVtLE61',
    slug: 'dr-sara-eyes',
    name: 'مركز د. سارة فؤاد لطب وجراحة العيون والليزر',
    specialty: 'طب وجراحة العيون',
    doctorName: 'د. سارة فؤاد',
    doctorEmail: 'dr.sara@gmail.com',
    doctorPhone: '01288776655',
    doctorPassword: 'password123',
    assistantName: 'أ. ريهام عادل (سكرتيرة رئيسية)',
    assistantEmail: 'sec.sara@gmail.com',
    assistantPhone: '01022334455',
    assistantPassword: 'password123',
    maxDailyBookings: 20,
    assistants: [
      {
        id: 'sec-sara-2',
        name: 'أ. ياسمين صلاح (سكرتيرة فرع المعادي)',
        email: 'yasmin.sara@gmail.com',
        phone: '01188990011',
        password: 'password123',
        branchName: 'فرع المعادي'
      }
    ],
    branches: [
      {
        id: 'branch-sara-dokki',
        name: 'فرع الدقي',
        address: 'ميدان المساحة - الدقي - الجيزة',
        phone: '01288776655',
        isMain: true,
        isOpen: true,
        coordinates: { lat: 30.038, lng: 31.212 }
      },
      {
        id: 'branch-sara-maadi',
        name: 'فرع المعادي',
        address: 'شارع النصر - المعادي الجديدة - القاهرة',
        phone: '01188990011',
        isMain: false,
        isOpen: true,
        coordinates: { lat: 29.973, lng: 31.278 }
      }
    ],
    services: [
      { id: '1', name: 'فحص قاع عين وكشف نظر', price: 300, duration: 20 },
      { id: '2', name: 'استشارة ومتابعة', price: 100, duration: 15 },
      { id: '3', name: 'فحص طوارئ عيون', price: 500, duration: 25 }
    ],
    queuePattern: [
      { serviceId: '3', serviceName: 'فحص طوارئ عيون', quota: 0 },
      { serviceId: '1', serviceName: 'فحص قاع عين وكشف نظر', quota: 2 },
      { serviceId: '2', serviceName: 'استشارة ومتابعة', quota: 1 }
    ]
  },
  {
    id: 'b2LvVyPnssx736ENZ7XI',
    slug: 'dr-karim-derma',
    name: 'عيادة د. كريم عبد الرحمن للجلدية والليزر والتجميل',
    specialty: 'أمراض جلدية وتناسلية وتجميل',
    doctorName: 'د. كريم عبد الرحمن',
    doctorEmail: 'dr.karim@gmail.com',
    doctorPhone: '01066554433',
    doctorPassword: 'password123',
    assistantName: 'أ. نهى إبراهيم (سكرتيرة رئيسية)',
    assistantEmail: 'sec.karim@gmail.com',
    assistantPhone: '01211223344',
    assistantPassword: 'password123',
    maxDailyBookings: 20,
    assistants: [
      {
        id: 'sec-karim-2',
        name: 'أ. شهد محمود (سكرتيرة فرع الشيخ زايد)',
        email: 'shahd.karim@gmail.com',
        phone: '01599887766',
        password: 'password123',
        branchName: 'فرع الشيخ زايد'
      }
    ],
    branches: [
      {
        id: 'branch-karim-heliopolis',
        name: 'فرع مصر الجديدة',
        address: 'شارع الأهرام - الكوربة - مصر الجديدة',
        phone: '01066554433',
        isMain: true,
        isOpen: true,
        coordinates: { lat: 30.091, lng: 31.326 }
      },
      {
        id: 'branch-karim-zayed',
        name: 'فرع الشيخ زايد',
        address: 'وصلة دهشور - بيفرلي هيلز - الشيخ زايد',
        phone: '01599887766',
        isMain: false,
        isOpen: true,
        coordinates: { lat: 30.041, lng: 30.985 }
      }
    ],
    services: [
      { id: '1', name: 'كشف جلدية وتجميل', price: 300, duration: 20 },
      { id: '2', name: 'استشارة ومتابعة', price: 100, duration: 15 },
      { id: '3', name: 'كشف طوارئ وحساسية', price: 500, duration: 25 }
    ],
    queuePattern: [
      { serviceId: '3', serviceName: 'كشف طوارئ وحساسية', quota: 0 },
      { serviceId: '1', serviceName: 'كشف جلدية وتجميل', quota: 2 },
      { serviceId: '2', serviceName: 'استشارة ومتابعة', quota: 1 }
    ]
  },
  {
    id: 'zIJH78sXOiRFtq0mscb1',
    slug: 'dr-nada-pediatrics',
    name: 'مركز د. ندى الشريف لطب الأطفال وحديثي الولادة',
    specialty: 'طب أطفال وحديثي ولادة',
    doctorName: 'د. ندى الشريف',
    doctorEmail: 'dr.nada@gmail.com',
    doctorPhone: '01144332211',
    doctorPassword: 'password123',
    assistantName: 'أ. سلمى سعيد (سكرتيرة رئيسية)',
    assistantEmail: 'sec.nada@gmail.com',
    assistantPhone: '01077889900',
    assistantPassword: 'password123',
    maxDailyBookings: 20,
    assistants: [
      {
        id: 'sec-nada-2',
        name: 'أ. هاجر مصطفى (سكرتيرة مساعدة)',
        email: 'hagar.nada@gmail.com',
        phone: '01511223355',
        password: 'password123',
        branchName: 'فرع الهرم'
      }
    ],
    branches: [
      {
        id: 'branch-nada-haram',
        name: 'فرع الهرم',
        address: 'شارع فيصل الرئيسي - تقاطع محطة العشرين - الهرم - الجيزة',
        phone: '01144332211',
        isMain: true,
        isOpen: true,
        coordinates: { lat: 30.007, lng: 31.189 }
      }
    ],
    services: [
      { id: '1', name: 'كشف أطفال دوري', price: 250, duration: 20 },
      { id: '2', name: 'متابعة تطور ونمو', price: 120, duration: 15 },
      { id: '3', name: 'كشف حمى وطوارئ', price: 450, duration: 20 }
    ],
    queuePattern: [
      { serviceId: '3', serviceName: 'كشف حمى وطوارئ', quota: 0 },
      { serviceId: '1', serviceName: 'كشف أطفال دوري', quota: 2 },
      { serviceId: '2', serviceName: 'متابعة تطور ونمو', quota: 1 }
    ]
  }
];

const PATIENTS_SEED = [
  { name: 'أحمد محمود القاضي', phone: '+201011122233', age: '34', gender: 'ذكر', city: 'القاهرة', area: 'مدينة نصر' },
  { name: 'سارة علي حسن', phone: '+201122233344', age: '28', gender: 'أنثى', city: 'الجيزة', area: 'الدقي' },
  { name: 'محمود حسن إبراهيم', phone: '+201233344455', age: '45', gender: 'ذكر', city: 'القاهرة', area: 'المعادي' },
  { name: 'فاطمة محمد خليل', phone: '+201544455566', age: '52', gender: 'أنثى', city: 'القليوبية', area: 'شبرا الخيمة' },
  { name: 'كريم سمير جابر', phone: '+201055566677', age: '23', gender: 'ذكر', city: 'الجيزة', area: 'المهندسين' },
  { name: 'نورهان مصطفى كمال', phone: '+201166677788', age: '30', gender: 'أنثى', city: 'القاهرة', area: 'مصر الجديدة' },
  { name: 'مروان يوسف عثمان', phone: '+201277788899', age: '19', gender: 'ذكر', city: 'الجيزة', area: 'الشيخ زايد' },
  { name: 'ياسمين عبد العزيز', phone: '+201588899900', age: '38', gender: 'أنثى', city: 'القاهرة', area: 'التجمع الخامس' },
  { name: 'طارق صلاح الدين', phone: '+201099900011', age: '41', gender: 'ذكر', city: 'الجيزة', area: 'الهرم' },
  { name: 'هدى إسماعيل فوزي', phone: '+201100011122', age: '60', gender: 'أنثى', city: 'القاهرة', area: 'الزيتون' }
];

async function seedMasterData() {
  console.log('🚀 Seeding Full Multi-Clinic, Staff, Branch & Patient Dataset...');

  const todayStr = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Africa/Cairo',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).format(new Date());

  console.log(`📅 Target today date in Cairo: ${todayStr}`);

  for (const c of CLINICS_DATA) {
    console.log(`\n🏥 Updating Clinic: [${c.slug}] ${c.name}`);
    
    // Hash passwords
    const doctorPasswordHash = await hashPwd(c.doctorPassword);
    const assistantPasswordHash = await hashPwd(c.assistantPassword);
    
    const hashedAssistants = [];
    for (const a of c.assistants || []) {
      const aHash = await hashPwd(a.password);
      hashedAssistants.push({
        ...a,
        passwordHash: aHash
      });
    }

    // 1. Update clinic doc in Firestore
    const clinicRef = doc(db, 'clinics', c.id);
    await updateDoc(clinicRef, {
      name: c.name,
      specialty: c.specialty,
      doctorName: c.doctorName,
      doctorEmail: c.doctorEmail,
      doctorPhone: c.doctorPhone,
      doctorPassword: c.doctorPassword,
      doctorPasswordHash,
      assistantName: c.assistantName,
      assistantEmail: c.assistantEmail,
      assistantPhone: c.assistantPhone,
      assistantPassword: c.assistantPassword,
      assistantPasswordHash,
      assistants: hashedAssistants,
      services: c.services,
      queuePattern: c.queuePattern,
      maxDailyBookings: c.maxDailyBookings,
      weeklySchedule: DEFAULT_SCHEDULE,
      isActive: true,
      subscriptionPlan: 'enterprise',
      updatedAt: new Date().toISOString()
    });
    console.log(`   ✓ Clinic doc updated with Doctor (${c.doctorEmail}) and Assistants (${c.assistantEmail})`);

    // 2. Ensure branches in `branches` collection
    for (const b of c.branches) {
      const branchRef = doc(db, 'branches', b.id);
      await setDoc(branchRef, {
        clinicId: c.id,
        name: b.name,
        address: b.address,
        phone: b.phone,
        isMain: b.isMain,
        isOpen: b.isOpen,
        isArchived: false,
        coordinates: b.coordinates,
        weeklySchedule: DEFAULT_SCHEDULE,
        updatedAt: new Date().toISOString()
      }, { merge: true });
      console.log(`   ✓ Branch synchronized: ${b.name} (${b.id})`);
    }

    // 3. Seed active appointments for today
    const mainBranch = c.branches.find(b => b.isMain) || c.branches[0];
    const statuses = ['waiting', 'waiting', 'in_progress', 'completed', 'cancelled'];
    
    for (let i = 0; i < 5; i++) {
      const p = PATIENTS_SEED[(i + c.slug.length) % PATIENTS_SEED.length];
      const status = statuses[i % statuses.length];
      const service = c.services[i % c.services.length];
      const queueNumber = i + 1;
      const isUrgent = service.name.includes('طوارئ') || service.name.includes('مستعجل');

      const apptId = `seed-${c.slug}-${todayStr}-${queueNumber}`;
      const apptRef = doc(db, 'appointments', apptId);
      
      const paymentMethod = i % 2 === 0 ? 'cash' : 'instapay';
      const paymentDetails = paymentMethod === 'instapay' ? {
        paymentMethod: 'instapay',
        senderAccount: p.name,
        receiverAccount: c.doctorPhone || '01121320507',
        expectedAmount: service.price
      } : null;

      await setDoc(apptRef, {
        clinic_id: c.id,
        branch_id: mainBranch.id,
        branchName: mainBranch.name,
        patientName: p.name,
        phone: p.phone,
        age: p.age,
        gender: p.gender,
        address: `${p.city} - ${p.area}`,
        patientResidenceSnapshot: {
          governorateNameAr: p.city,
          cityNameAr: p.area,
          recordedAt: new Date().toISOString()
        },
        date: todayStr,
        serviceId: service.id,
        serviceName: service.name,
        servicePrice: service.price,
        status,
        queue_number: queueNumber,
        isUrgent,
        paymentMethod,
        paymentStatus: status === 'completed' || paymentMethod === 'instapay' ? 'paid' : 'pending',
        paymentDetails,
        durationMinutes: service.duration,
        createdAt: new Date().toISOString(),
        arrivedAt: new Date().toISOString(),
        startedAt: status === 'in_progress' || status === 'completed' ? new Date().toISOString() : null,
        completedAt: status === 'completed' ? new Date().toISOString() : null
      }, { merge: true });

      // If completed, seed prescription
      if (status === 'completed') {
        const rxId = `rx-${apptId}`;
        const rxRef = doc(db, 'prescriptions', rxId);
        await setDoc(rxRef, {
          clinic_id: c.id,
          appointmentId: apptId,
          patientName: p.name,
          phone: p.phone,
          date: todayStr,
          doctorName: c.doctorName,
          diagnosis: 'فحص سريري دوري - استقرار المؤشرات الحيوية',
          notes: 'مراجعة العيادة بعد أسبوعين ومتابعة قياسات الضغط',
          items: [
            {
              drugName: 'Augmentin 1g Tablets',
              dosage: 'قرص واحد',
              frequency: 'مرتين يومياً بعد الأكل',
              duration: '7 أيام',
              instructions: 'الالتزام بمواعيد الجرعات وعدم إيقاف العلاج مبكراً'
            },
            {
              drugName: 'Panadol Extra Tablets',
              dosage: 'قرص عند اللزوم',
              frequency: 'كل 8 ساعات',
              duration: '3 أيام',
              instructions: 'في حالة ارتفاع درجة الحرارة أو الصداع'
            }
          ],
          createdAt: new Date().toISOString()
        }, { merge: true });
      }
    }
    console.log(`   ✓ Seeded 5 active queue appointments and prescriptions for today (${todayStr})`);
  }

  // Update clinic-mvved5s8 as well if it exists
  try {
    const extraRef = doc(db, 'clinics', 'VLK4ow55RMkkwGer6LlY');
    const extraSnap = await getDoc(extraRef);
    if (extraSnap.exists()) {
      const extraHash = await hashPwd('password123');
      await updateDoc(extraRef, {
        doctorPassword: 'password123',
        doctorPasswordHash: extraHash
      });
      console.log('   ✓ Updated extra clinic (clinic-mvved5s8) password to password123');
    }
  } catch (err) {
    console.warn('Could not update extra clinic:', err.message);
  }

  // 4. Seed & Normalize All Patient Portal Accounts (`patient_accounts`)
  console.log('\n👤 Seeding & Normalizing Patient Portal Accounts (for online patient login)...');
  const patientPasswordHash = await hashPwd('patient123');

  // Update any existing accounts that have no password or empty password
  const allAccountsSnap = await getDocs(collection(db, 'patient_accounts'));
  for (const accDoc of allAccountsSnap.docs) {
    const data = accDoc.data();
    if (!data.passwordHash && !data.password) {
      await updateDoc(doc(db, 'patient_accounts', accDoc.id), {
        password: 'patient123',
        passwordHash: patientPasswordHash
      });
    }
  }

  for (const p of PATIENTS_SEED) {
    const primaryClinic = CLINICS_DATA[0];
    const accQ = query(
      collection(db, 'patient_accounts'),
      where('phone', '==', p.phone)
    );
    const snap = await getDocs(accQ);
    if (snap.empty) {
      await addDoc(collection(db, 'patient_accounts'), {
        clinic_id: primaryClinic.id,
        name: p.name,
        phone: p.phone,
        age: p.age,
        gender: p.gender,
        password: 'patient123',
        passwordHash: patientPasswordHash,
        createdAt: new Date().toISOString()
      });
      console.log(`   ✓ Patient account created: ${p.name} (${p.phone})`);
    } else {
      await updateDoc(doc(db, 'patient_accounts', snap.docs[0].id), {
        password: 'patient123',
        passwordHash: patientPasswordHash
      });
      console.log(`   ✓ Patient account normalized: ${p.name} (${p.phone})`);
    }
  }

  console.log('\n=========================================');
  console.log('🎉 MASTER DATASET SEEDED SUCCESSFULLY!');
  console.log('=========================================');
  process.exit(0);
}

seedMasterData().catch(err => {
  console.error('Error seeding data:', err);
  process.exit(1);
});
