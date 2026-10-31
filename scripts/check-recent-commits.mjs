import { execSync } from 'child_process';

const commits = execSync('git log --format="%H %s" -n 50', { encoding: 'utf8' }).trim().split('\n');

for (const line of commits) {
  const [hash, ...rest] = line.split(' ');
  const subject = rest.join(' ');
  try {
    const diff = execSync(`git show ${hash}`, { encoding: 'utf8' });
    if (diff.includes('لمتابعة') || diff.includes('دورك') || diff.includes('whatsapp') || diff.includes('WhatsApp')) {
      const match = diff.match(/[^\n]*(?:لمتابعة دورك|موقع العيادة|متابعة دورك)[^\n]*/g);
      if (match) {
        console.log(`Commit ${hash.slice(0, 7)}: ${subject}`);
        match.slice(0, 5).forEach(m => console.log('  ' + m.trim()));
      }
    }
  } catch (e) {}
}
