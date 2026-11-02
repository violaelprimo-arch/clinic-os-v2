import fs from 'fs';

const path = 'src/components/owner/LandingPageManager.tsx';
const lines = fs.readFileSync(path, 'utf8').split('\n');
lines.forEach((l, i) => {
  if (l.includes('الإحصائيات') || l.includes('stats') || l.includes('activeTab === \'stats\'')) {
    console.log(`${i + 1}: ${l.trim()}`);
  }
});
