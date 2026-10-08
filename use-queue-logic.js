const fs = require('fs');
let c = fs.readFileSync('src/components/clinic/AdminDashboard.tsx', 'utf8');

if (!c.includes('sortQueue')) {
  c = c.replace(
    "import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'",
    "import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'\nimport { sortQueue } from '@/lib/queueCalculations'"
  );
}

const findSort = `      const regularQueue = waiting.filter((d: any) => !d.isUrgent)
      const urgentQueue = waiting.filter((d: any) => d.isUrgent)
      
      let orderedWaiting: any[] = []
      let rIndex = 0, uIndex = 0;
      const rRatio = clinic.regularPerUrgent || 2;
      const uRatio = clinic.urgentPerRegular || 1;
      
      while(rIndex < regularQueue.length || uIndex < urgentQueue.length) {
         for(let i=0; i<rRatio && rIndex < regularQueue.length; i++) orderedWaiting.push(regularQueue[rIndex++]);
         for(let i=0; i<uRatio && uIndex < urgentQueue.length; i++) orderedWaiting.push(urgentQueue[uIndex++]);
      }`;

const replaceSort = `      let orderedWaiting = sortQueue(waiting, clinic);`;

c = c.replace(findSort, replaceSort);

fs.writeFileSync('src/components/clinic/AdminDashboard.tsx', c);
