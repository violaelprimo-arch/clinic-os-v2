import fs from 'fs';

const logPath = 'C:/Users/Elmaher/.gemini/antigravity/brain/b464471d-9aec-490d-9a87-73b5907aed7b/.system_generated/logs/transcript.jsonl';
if (!fs.existsSync(logPath)) {
  console.log('Log not found');
  process.exit(0);
}

const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');
console.log('Total transcript lines:', lines.length);

for (let i = 0; i < lines.length; i++) {
  const line = lines[i];
  if (line.includes('wrangler deploy') || line.includes('CLOUDFLARE_API_TOKEN')) {
    console.log(`Line ${i}:`, line.substring(0, 200));
  }
}
