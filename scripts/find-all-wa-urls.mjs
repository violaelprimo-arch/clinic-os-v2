import fs from 'fs';
import path from 'path';

function search(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['.git', 'node_modules', '.next', '.open-next'].includes(entry.name)) {
        search(full);
      }
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const text = fs.readFileSync(full, 'utf8');
      if (text.includes('wa.me') || text.includes('api.whatsapp.com') || text.includes('whatsapp://')) {
        console.log(`FOUND WA URL IN: ${full}`);
        const lines = text.split('\n');
        lines.forEach((l, i) => {
          if (l.includes('wa.me') || l.includes('api.whatsapp.com') || l.includes('whatsapp://')) {
            console.log(`  L${i+1}: ${l.trim().slice(0, 140)}`);
          }
        });
      }
    }
  }
}

search('src');
