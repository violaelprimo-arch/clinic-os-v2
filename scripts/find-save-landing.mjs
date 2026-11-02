import fs from 'fs';
const s = fs.readFileSync('src/components/owner/LandingPageManager.tsx', 'utf8');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes('saveLandingPageConfig')) console.log(`${i+1}: ${l}`);
});
