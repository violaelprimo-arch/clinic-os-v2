import fs from 'fs';

const path = 'src/lib/branchService.ts';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((l, i) => {
  if (l.includes('syncClinicScheduleToMainBranch')) {
    console.log(`${i+1}: ${l}`);
  }
});
