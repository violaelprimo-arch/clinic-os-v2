import fs from 'fs';

function searchInDir(dir) {
  const files = fs.readdirSync(dir);
  for (const f of files) {
    const full = dir + '/' + f;
    const stat = fs.statSync(full);
    if (stat.isDirectory() && f !== 'node_modules' && f !== '.next' && f !== '.git') {
      searchInDir(full);
    } else if (stat.isFile() && (f.endsWith('.tsx') || f.endsWith('.ts'))) {
      const code = fs.readFileSync(full, 'utf8');
      if (code.includes('BookingModal') || code.includes('BookingForm')) {
        console.log(full);
      }
    }
  }
}

searchInDir('src');
