import fs from 'fs';

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = `${dir}/${entry.name}`;
    if (entry.isDirectory() && entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.open-next') {
      walk(full);
    } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
      const content = fs.readFileSync(full, 'utf8');
      if (content.includes('LandingStatsSection') || content.includes('showStats')) {
        console.log(full);
      }
    }
  }
}

walk('src');
