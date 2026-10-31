import fs from 'fs';
import path from 'path';

function searchFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!['node_modules', '.git', '.next', '.open-next'].includes(entry.name)) {
        searchFiles(fullPath);
      }
    } else if (/\.(ts|tsx|js|mjs)$/.test(entry.name)) {
      const content = fs.readFileSync(fullPath, 'utf8');
      if (
        (content.includes('track') || content.includes('متابعة') || content.includes('دورك')) &&
        (content.includes('wa.me') || content.includes('whatsapp') || content.includes('WhatsApp') || content.includes('send') || content.includes('url') || content.includes('http'))
      ) {
        // Find template literals containing links
        const templateRegex = /`([^`]*?)`/gs;
        let match;
        while ((match = templateRegex.exec(content)) !== null) {
          const str = match[1];
          if ((str.includes('track') || str.includes('دورك') || str.includes('حجز')) && (str.includes('http') || str.includes('${') || str.includes('رابط'))) {
            console.log(`\nFILE: ${fullPath}`);
            console.log(str.slice(0, 300));
            console.log('---');
          }
        }
      }
    }
  }
}

searchFiles('src');
