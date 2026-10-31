import fs from 'fs';

const path = 'src/lib/queueCalculations.ts';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const oldTarget = `  // Only patients in 'waiting' state belong in the dynamic line
  const allWaiting = [...appointments]
    .filter((d: any) => d.status === 'waiting' || !d.status)

  // 0. High priority late-arrivals: skipped patients who arrived and are queued for immediate next turn
  const priorityAppts = allWaiting
    .filter((d: any) => d.priorityNext)
    .sort((a: any, b: any) => new Date(a.requeuedAt || 0).getTime() - new Date(b.requeuedAt || 0).getTime())

  // Regular waiting line
  const waiting = allWaiting
    .filter((d: any) => !d.priorityNext)
    .sort((a: any, b: any) => (Number(a.queue_number) || 0) - (Number(b.queue_number) || 0))`;

const newTarget = `  // Only patients in 'waiting' state belong in the dynamic line
  const allWaiting = [...appointments]
    .filter((d: any) => (d.status === 'waiting' || (!d.status && (d.queue_number || d.queueNumber))) && (d.queue_number !== undefined || d.queueNumber !== undefined || d.patientName))

  // 0. High priority late-arrivals: skipped patients who arrived and are queued for immediate next turn
  const priorityAppts = allWaiting
    .filter((d: any) => d.priorityNext)
    .sort((a: any, b: any) => new Date(a.requeuedAt || 0).getTime() - new Date(b.requeuedAt || 0).getTime())

  // Regular waiting line
  const waiting = allWaiting
    .filter((d: any) => !d.priorityNext)
    .sort((a: any, b: any) => (Number(a.queue_number ?? a.queueNumber) || 0) - (Number(b.queue_number ?? b.queueNumber) || 0))`;

if (!code.includes(oldTarget)) {
  console.error('Target not found in queueCalculations.ts');
  process.exit(1);
}

code = code.replace(oldTarget, newTarget);
fs.writeFileSync(path, code, 'utf8');
console.log('Successfully updated queueCalculations.ts');
