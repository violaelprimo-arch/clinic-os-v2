const fs = require('fs');

let c = fs.readFileSync('src/lib/queueCalculations.ts', 'utf8');

const oldLoop = `    for (let i = 0; i < normalCount && nIdx < normalQueue.length; i++) finalQueue.push(normalQueue[nIdx++]);
    for (let i = 0; i < consultCount && cIdx < consultQueue.length; i++) finalQueue.push(consultQueue[cIdx++]);
    for (let i = 0; i < urgentCount && uIdx < urgentQueue.length; i++) finalQueue.push(urgentQueue[uIdx++]);`;

const newLoop = `    for (let i = 0; i < urgentCount && uIdx < urgentQueue.length; i++) finalQueue.push(urgentQueue[uIdx++]);
    for (let i = 0; i < normalCount && nIdx < normalQueue.length; i++) finalQueue.push(normalQueue[nIdx++]);
    for (let i = 0; i < consultCount && cIdx < consultQueue.length; i++) finalQueue.push(consultQueue[cIdx++]);`;

c = c.replace(oldLoop, newLoop);

fs.writeFileSync('src/lib/queueCalculations.ts', c);
