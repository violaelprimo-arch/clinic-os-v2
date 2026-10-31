import fs from 'fs';
const logPath = 'C:/Users/Elmaher/.gemini/antigravity/brain/b464471d-9aec-490d-9a87-73b5907aed7b/.system_generated/logs/transcript.jsonl';
const content = fs.readFileSync(logPath, 'utf8');
const lines = content.split('\n');
console.log(lines[32137]);
