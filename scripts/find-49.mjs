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
      if (
        code.includes('49') ||
        code.includes('50') ||
        code.includes('متبقي') ||
        code.includes('متبقية') ||
        code.includes('الحد اليومي') ||
        code.includes('السعة اليومية') ||
        code.includes('دورك المتوقع') ||
        code.includes('dailyBookingCounts')
      ) {
        const lines = code.split('\n');
        lines.forEach((line, idx) => {
          if (
            line.includes('49') ||
            line.includes('50') ||
            line.includes('متبقي') ||
            line.includes('متبقية') ||
            line.includes('الحد اليومي') ||
            line.includes('السعة اليومية') ||
            line.includes('دورك المتوقع') ||
            line.includes('dailyBookingCounts')
          ) {
            console.log(`${full}:${idx + 1}: ${line.trim()}`);
          }
        });
      }
    }
  }
}

searchInDir('src');
