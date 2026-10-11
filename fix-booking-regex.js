const fs = require('fs');

let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

c = c.replace(
  /const q = query\([\s\S]*?where\('date', '==', selectedDate\)\s*\)/,
  `const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinic.id || clinic.slug))`
);

c = c.replace(
  /const currentQueueLength = querySnapshot\.size/,
  `const todaysAppts = querySnapshot.docs.filter(d => d.data().date === selectedDate)\n      const currentQueueLength = todaysAppts.length`
);

c = c.replace(
  /querySnapshot\.docs\.forEach\(docSnap => {/g,
  `todaysAppts.forEach(docSnap => {`
);

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
