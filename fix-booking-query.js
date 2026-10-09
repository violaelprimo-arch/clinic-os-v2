const fs = require('fs');

let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

const oldQ = `const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinic.id || clinic.slug),
        where('date', '==', selectedDate)
      )

      const querySnapshot = await getDocs(q)
      const currentQueueLength = querySnapshot.size`;

const newQ = `const q = query(
        collection(db, 'appointments'),
        where('clinic_id', '==', clinic.id || clinic.slug)
      )

      const querySnapshot = await getDocs(q)
      const todaysAppts = querySnapshot.docs.filter(d => d.data().date === selectedDate)
      const currentQueueLength = todaysAppts.length`;

c = c.replace(oldQ, newQ);

const oldCount = `querySnapshot.docs.forEach(docSnap => {
        if (docSnap.data().status === 'waiting') waitingCount++
      })`;

const newCount = `todaysAppts.forEach(docSnap => {
        if (docSnap.data().status === 'waiting') waitingCount++
      })`;

c = c.replace(oldCount, newCount);

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
