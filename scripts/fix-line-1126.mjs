import fs from 'fs';
const path = 'src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx';
let code = fs.readFileSync(path, 'utf8');
code = code.replace(
  '{tvConfig.showPatientName && p.patientName ? p.patientName : `تذكرة دور #${p.queue_number ?? p.queueNumber ?? \'-\'`}',
  "{tvConfig.showPatientName && p.patientName ? p.patientName : ('تذكرة دور #' + (p.queue_number ?? p.queueNumber ?? '-'))}"
);
fs.writeFileSync(path, code, 'utf8');
console.log('Fixed line 1126');
