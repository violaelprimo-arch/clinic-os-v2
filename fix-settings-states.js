const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', 'utf8');

c = c.replace(
  "const [averageVisitTime, setAverageVisitTime] = useState<number>(15)",
  `const [averageVisitTime, setAverageVisitTime] = useState<number>(15)
  const [allowPatientMedicalView, setAllowPatientMedicalView] = useState(false)
  const [hidePrices, setHidePrices] = useState(false)
  const [workingDays, setWorkingDays] = useState<string[]>([])
  const [workingHoursStart, setWorkingHoursStart] = useState('09:00')
  const [workingHoursEnd, setWorkingHoursEnd] = useState('22:00')
  const [queueNormal, setQueueNormal] = useState(2)
  const [queueConsult, setQueueConsult] = useState(1)
  const [queueUrgent, setQueueUrgent] = useState(0)`
);

fs.writeFileSync('src/app/clinic/[slug]/admin/settings/page.tsx', c);
