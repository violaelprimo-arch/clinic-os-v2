import { execSync } from 'child_process';

const diff = execSync('git show 289f1f2', { encoding: 'utf8' });
const lines = diff.split('\n');
lines.forEach((l, i) => {
  if (l.includes('لمتابعة دورك')) {
    console.log(lines.slice(Math.max(0, i - 10), Math.min(lines.length, i + 15)).join('\n'));
    console.log('======');
  }
});
