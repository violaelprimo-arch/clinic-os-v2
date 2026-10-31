import fs from 'fs';

const path = 'src/lib/queueService.ts';
const content = fs.readFileSync(path, 'utf8');
const lines = content.split('\n');

lines.forEach((line, i) => {
  if (
    line.includes('createAtomicAppointment') ||
    line.includes('QUOTA') ||
    line.includes('maxLimit') ||
    line.includes('limit') ||
    line.includes('transaction') ||
    line.includes('cancelled')
  ) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
});
