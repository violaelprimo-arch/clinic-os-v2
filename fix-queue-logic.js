const fs = require('fs');
let c = fs.readFileSync('src/lib/queueCalculations.ts', 'utf8');

const newCode = `
export function sortQueue(appointments, clinic) {
  const normalCount = clinic?.queueNormal || 3;
  const consultCount = clinic?.queueConsult || 2;
  const urgentCount = clinic?.queueUrgent !== undefined ? clinic.queueUrgent : 1;

  const normalQueue = [];
  const consultQueue = [];
  const urgentQueue = [];
  const otherQueue = [];

  const sorted = [...appointments].sort((a, b) => (a.queue_number || 0) - (b.queue_number || 0));

  sorted.forEach(appt => {
    const sName = appt.serviceName || appt.service?.name || '';
    if (sName.includes('مستعجل') || appt.isUrgent) {
      urgentQueue.push(appt);
    } else if (sName.includes('استشارة')) {
      consultQueue.push(appt);
    } else if (sName.includes('عادي') || sName === '') {
      normalQueue.push(appt);
    } else {
      otherQueue.push(appt);
    }
  });

  const finalQueue = [];
  
  if (urgentCount === 0) {
    finalQueue.push(...urgentQueue);
    urgentQueue.length = 0;
  }

  let nIdx = 0, cIdx = 0, uIdx = 0, oIdx = 0;
  
  while(nIdx < normalQueue.length || cIdx < consultQueue.length || uIdx < urgentQueue.length || oIdx < otherQueue.length) {
    for (let i = 0; i < normalCount && nIdx < normalQueue.length; i++) finalQueue.push(normalQueue[nIdx++]);
    for (let i = 0; i < consultCount && cIdx < consultQueue.length; i++) finalQueue.push(consultQueue[cIdx++]);
    for (let i = 0; i < urgentCount && uIdx < urgentQueue.length; i++) finalQueue.push(urgentQueue[uIdx++]);
    if (oIdx < otherQueue.length) finalQueue.push(otherQueue[oIdx++]);
  }

  return finalQueue;
}
`;

c += newCode;
fs.writeFileSync('src/lib/queueCalculations.ts', c);
