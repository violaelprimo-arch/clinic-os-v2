import fs from 'fs';
const s = fs.readFileSync('src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx', 'utf8');
const lines = s.split('\n');
for (let i = 1115; i < 1140; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
