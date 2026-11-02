import fs from 'fs';
const s = fs.readFileSync('src/lib/landing-config.ts', 'utf8');
const lines = s.split('\n');
lines.forEach((l, i) => {
  if (l.includes('DEFAULT_LANDING_CONFIG')) console.log(`${i+1}: ${l}`);
});
