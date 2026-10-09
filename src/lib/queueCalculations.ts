export function calculateWaitTime(aheadCount: number, averageServiceMins = 15) {
  return aheadCount * averageServiceMins;
}

export function formatEstimatedTime(minutesToAdd: number) {
  const future = new Date(Date.now() + minutesToAdd * 60000);
  return new Intl.DateTimeFormat('ar-EG', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Africa/Cairo'
  }).format(future);
}

export function formatWaitDuration(mins: number) {
  if (mins <= 0) return 'دورك الآن';
  if (mins < 60) return `حوالي ${mins} دقيقة`;
  const hours = Math.floor(mins / 60);
  const remMins = mins % 60;
  if (hours < 24) {
    return `حوالي ${hours} ساعة و ${remMins} دقيقة`;
  }
  const days = Math.floor(hours / 24);
  const remHours = hours % 24;
  return `حوالي ${days} يوم و ${remHours} ساعة`;
}

export function sortQueue(appointments: any[], clinic: any) {
  const normalCount = clinic?.queueNormal || 3;
  const consultCount = clinic?.queueConsult || 2;
  const urgentCount = clinic?.queueUrgent !== undefined ? clinic.queueUrgent : 1;

  const normalQueue: any[] = [];
  const consultQueue: any[] = [];
  const urgentQueue: any[] = [];
  const otherQueue: any[] = [];

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
    for (let i = 0; i < urgentCount && uIdx < urgentQueue.length; i++) finalQueue.push(urgentQueue[uIdx++]);
    for (let i = 0; i < normalCount && nIdx < normalQueue.length; i++) finalQueue.push(normalQueue[nIdx++]);
    for (let i = 0; i < consultCount && cIdx < consultQueue.length; i++) finalQueue.push(consultQueue[cIdx++]);
    if (oIdx < otherQueue.length) finalQueue.push(otherQueue[oIdx++]);
  }

  return finalQueue;
}
