import fs from 'fs';

const path = 'src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('queue_number') || l.includes('queueNumber')) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
