const fs = require('fs');

let c = fs.readFileSync('src/components/clinic/BookingForm.tsx', 'utf8');

// 1. Add imports
if (!c.includes('queueCalculations')) {
  c = c.replace(
    "import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'",
    "import { addDoc, collection, getDocs, query, where } from 'firebase/firestore'\nimport { calculateWaitTime, formatEstimatedTime, formatWaitDuration } from '@/lib/queueCalculations'"
  );
}

// 2. Update logic to get inProgressNumber
const logicFind = `      let waitingCount = 0
      countSnap.docs.forEach(d => {
        if (d.data().status === 'waiting') waitingCount++
      })`;

const logicReplace = `      let waitingCount = 0
      let inProgressNumber = '-'
      countSnap.docs.forEach(d => {
        const data = d.data()
        if (data.status === 'waiting') waitingCount++
        if (data.status === 'in_progress') inProgressNumber = data.queue_number
      })`;

c = c.replace(logicFind, logicReplace);

// 3. Update setSuccessInfo
const setFind = `      setSuccessInfo({
        queueNumber: myQueueNumber,
        trackingId: docRef.id,
        aheadCount: waitingCount
      })`;

const setReplace = `      setSuccessInfo({
        queueNumber: myQueueNumber,
        trackingId: docRef.id,
        aheadCount: waitingCount,
        inProgress: inProgressNumber,
        service: selectedService
      })`;

c = c.replace(setFind, setReplace);

fs.writeFileSync('src/components/clinic/BookingForm.tsx', c);
