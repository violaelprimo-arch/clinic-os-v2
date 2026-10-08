const fs = require('fs');

let c = fs.readFileSync('src/app/clinic/[slug]/track/[appointmentId]/page.tsx', 'utf8');

if (!c.includes('queueCalculations')) {
  c = c.replace(
    "import { db } from '@/lib/firebase'",
    "import { db } from '@/lib/firebase'\nimport { calculateWaitTime, formatEstimatedTime, formatWaitDuration } from '@/lib/queueCalculations'"
  );
}

// Replace hardcoded "estimatedMins" logic
c = c.replace(
  "const estimatedMins = isCompleted ? 0 : isInProgress ? 0 : peopleAhead * averageTime",
  "const estimatedMins = isCompleted ? 0 : isInProgress ? 0 : calculateWaitTime(peopleAhead, averageTime)"
);

// Replace hardcoded wait duration
c = c.replace(
  "{estimatedMins > 0 ? `حوالي ${estimatedMins} دقيقة` : 'اقترب دورك جداً'}",
  "{formatWaitDuration(estimatedMins)}"
);

fs.writeFileSync('src/app/clinic/[slug]/track/[appointmentId]/page.tsx', c);
