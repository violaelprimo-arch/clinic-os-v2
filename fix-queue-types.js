const fs = require('fs');
let c = fs.readFileSync('src/lib/queueCalculations.ts', 'utf8');

c = c.replace('calculateWaitTime(aheadCount, averageServiceMins = 15)', 'calculateWaitTime(aheadCount: number, averageServiceMins = 15)');
c = c.replace('formatEstimatedTime(minutesToAdd)', 'formatEstimatedTime(minutesToAdd: number)');
c = c.replace('formatWaitDuration(mins)', 'formatWaitDuration(mins: number)');
c = c.replace('sortQueue(appointments, clinic)', 'sortQueue(appointments: any[], clinic: any)');

c = c.replace('const normalQueue = [];', 'const normalQueue: any[] = [];');
c = c.replace('const consultQueue = [];', 'const consultQueue: any[] = [];');
c = c.replace('const urgentQueue = [];', 'const urgentQueue: any[] = [];');
c = c.replace('const otherQueue = [];', 'const otherQueue: any[] = [];');

fs.writeFileSync('src/lib/queueCalculations.ts', c);
