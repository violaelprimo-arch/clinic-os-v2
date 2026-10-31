import fs from 'fs';

const content = fs.readFileSync('src/app/api/clinic/book/route.ts', 'utf8');
const lines = content.split('\n');
console.log('Total lines in api/clinic/book/route.ts:', lines.length);

lines.forEach((line, i) => {
  if (line.includes('max') || line.includes('limit') || line.includes('capacity') || line.includes('اكتمل') || line.includes('count')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
