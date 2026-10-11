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

export const isUrgentCase = (d: any) => Boolean(
  d?.isUrgent ||
  (d?.serviceName && (d.serviceName.includes('مستعجل') || d.serviceName.includes('طوارئ'))) ||
  String(d?.serviceId) === '3'
)

export const isConsultCase = (d: any) => Boolean(
  !isUrgentCase(d) && (
    (d?.serviceName && (d.serviceName.includes('استشارة') || d.serviceName.includes('متابعة'))) ||
    String(d?.serviceId) === '2' ||
    String(d?.serviceId) === '4'
  )
)

export const isNormalCase = (d: any) => Boolean(!isUrgentCase(d) && !isConsultCase(d))

export function sortQueue(appointments: any[], clinic: any) {
  const waiting = [...appointments]
    .filter((d: any) => d.status === 'waiting' || !d.status)
    .sort((a: any, b: any) => (a.queue_number || 0) - (b.queue_number || 0))

  const qUrgent = clinic?.queueUrgent !== undefined ? Number(clinic.queueUrgent) : 0
  const qNormal = clinic?.queueNormal !== undefined ? Number(clinic.queueNormal) : 3
  const qConsult = clinic?.queueConsult !== undefined ? Number(clinic.queueConsult) : 2

  const urgentQueue = waiting.filter(isUrgentCase)
  const normalQueue = waiting.filter(isNormalCase)
  const consultQueue = waiting.filter(isConsultCase)

  const orderedWaiting: any[] = []

  if (qUrgent === 0) {
    // 0 means: Urgent cases enter IMMEDIATELY before ANY other service!
    orderedWaiting.push(...urgentQueue)

    let nIdx = 0, cIdx = 0
    while (nIdx < normalQueue.length || cIdx < consultQueue.length) {
      const prevN = nIdx, prevC = cIdx
      for (let i = 0; i < (qNormal || 1) && nIdx < normalQueue.length; i++) {
        orderedWaiting.push(normalQueue[nIdx++])
      }
      for (let i = 0; i < (qConsult || 1) && cIdx < consultQueue.length; i++) {
        orderedWaiting.push(consultQueue[cIdx++])
      }
      if (nIdx === prevN && cIdx === prevC) {
        while (nIdx < normalQueue.length) orderedWaiting.push(normalQueue[nIdx++])
        while (cIdx < consultQueue.length) orderedWaiting.push(consultQueue[cIdx++])
        break
      }
    }
  } else {
    // Round-robin cycle according to configured ratios
    let uIdx = 0, nIdx = 0, cIdx = 0
    while (uIdx < urgentQueue.length || nIdx < normalQueue.length || cIdx < consultQueue.length) {
      const prevU = uIdx, prevN = nIdx, prevC = cIdx
      for (let i = 0; i < (qUrgent || 1) && uIdx < urgentQueue.length; i++) {
        orderedWaiting.push(urgentQueue[uIdx++])
      }
      for (let i = 0; i < (qNormal || 1) && nIdx < normalQueue.length; i++) {
        orderedWaiting.push(normalQueue[nIdx++])
      }
      for (let i = 0; i < (qConsult || 1) && cIdx < consultQueue.length; i++) {
        orderedWaiting.push(consultQueue[cIdx++])
      }
      if (uIdx === prevU && nIdx === prevN && cIdx === prevC) {
        while (uIdx < urgentQueue.length) orderedWaiting.push(urgentQueue[uIdx++])
        while (nIdx < normalQueue.length) orderedWaiting.push(normalQueue[nIdx++])
        while (cIdx < consultQueue.length) orderedWaiting.push(consultQueue[cIdx++])
        break
      }
    }
  }

  return orderedWaiting
}
