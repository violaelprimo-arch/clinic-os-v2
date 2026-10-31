import fs from 'fs';

const path = 'src/app/clinic/[slug]/tv/WaitingRoomTvClient.tsx';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Fix imports
const oldImport = "import { collection, query, where, onSnapshot, doc, updateDoc } from 'firebase/firestore'";
const newImport = `import { collection, query, where, onSnapshot, doc, getDoc, updateDoc } from 'firebase/firestore'
import { useSearchParams } from 'next/navigation'
import { getCairoDateString } from '@/lib/bookingCapacity'`;

if (!code.includes(oldImport)) {
  console.error('oldImport not found in WaitingRoomTvClient.tsx');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Fix numberToArabicWords safe fallback
const oldNumberToArabicWords = `function numberToArabicWords(num: number | string): string {
  const clean = String(num).replace(/[^0-9]/g, '')
  const n = parseInt(clean, 10)
  if (isNaN(n) || n <= 0) return String(num)`;

const newNumberToArabicWords = `function numberToArabicWords(num: number | string | undefined | null): string {
  if (num === undefined || num === null) return 'واحد'
  const clean = String(num).replace(/[^0-9]/g, '')
  const n = parseInt(clean, 10)
  if (isNaN(n) || n <= 0) return 'واحد'`;

if (!code.includes(oldNumberToArabicWords)) {
  console.error('oldNumberToArabicWords not found in WaitingRoomTvClient.tsx');
  process.exit(1);
}
code = code.replace(oldNumberToArabicWords, newNumberToArabicWords);

// 3. Add useSearchParams and branches state
const oldStateAnchor = "  const [clinic, setClinic] = useState<any>(null)\n  const [appointments, setAppointments] = useState<any[]>([])\n  const [selectedBranchId, setSelectedBranchId] = useState<string>('all')";
const newStateAnchor = `  const searchParams = useSearchParams()
  const branchFromUrl = searchParams.get('branch')

  const [clinic, setClinic] = useState<any>(null)
  const [branches, setBranches] = useState<any[]>([])
  const [appointments, setAppointments] = useState<any[]>([])
  const [selectedBranchId, setSelectedBranchId] = useState<string>(branchFromUrl || 'all')`;

if (!code.includes(oldStateAnchor)) {
  console.error('oldStateAnchor not found in WaitingRoomTvClient.tsx');
  process.exit(1);
}
code = code.replace(oldStateAnchor, newStateAnchor);

// 4. Fix Clock Ticker to update cairoTodayDate across midnight
const oldClockAnchor = `      setCurrentTime(timeStr)
      setCurrentDateStr(dateText)
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])`;

const newClockAnchor = `      setCurrentTime(timeStr)
      setCurrentDateStr(dateText)

      try {
        const todayCairo = new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Cairo' }).format(now)
        setCairoTodayDate(prev => prev !== todayCairo ? todayCairo : prev)
      } catch (e) {}
    }

    updateClock()
    const interval = setInterval(updateClock, 1000)
    return () => clearInterval(interval)
  }, [])`;

if (!code.includes(oldClockAnchor)) {
  console.error('oldClockAnchor not found in WaitingRoomTvClient.tsx');
  process.exit(1);
}
code = code.replace(oldClockAnchor, newClockAnchor);

// 5. Replace broken Clinic & Appointments listener
const oldListenerChunkStart = "  // Real-time Clinic Listener\n  useEffect(() => {\n    const q = query(collection(db, 'clinics'), where('slug', '==', slug))";
const oldListenerChunkEnd = "  // Trigger Voice Call when serving patient changes, enters, or is recalled (A10 Fix)";

const startIndex = code.indexOf(oldListenerChunkStart);
const endIndex = code.indexOf(oldListenerChunkEnd);

if (startIndex === -1 || endIndex === -1) {
  console.error('Could not find listener chunk in WaitingRoomTvClient.tsx', { startIndex, endIndex });
  process.exit(1);
}

const newListenerChunk = `  // 1. Real-time Clinic Document Listener
  useEffect(() => {
    if (!slug) return
    const qClinic = query(collection(db, 'clinics'), where('slug', '==', slug))
    const unsubClinic = onSnapshot(
      qClinic,
      (snapshot) => {
        if (!snapshot.empty) {
          const clinicDoc = snapshot.docs[0]
          setClinic({ id: clinicDoc.id, ...(clinicDoc.data() as any) })
        } else {
          // Fallback check directly by doc ID if slug is doc ID
          getDoc(doc(db, 'clinics', slug)).then((dSnap) => {
            if (dSnap.exists()) {
              setClinic({ id: dSnap.id, ...(dSnap.data() as any) })
            }
          }).catch((err) => console.warn('Direct doc fallback error:', err))
        }
      },
      (err) => {
        console.error('TV Screen clinic listener error:', err)
      }
    )
    return () => unsubClinic()
  }, [slug])

  // 2. Real-time Clinic Branches Listener
  useEffect(() => {
    if (!clinic?.id) return
    const qB = query(collection(db, 'branches'), where('clinicId', '==', clinic.id))
    const unsubB = onSnapshot(qB, (snap) => {
      setBranches(snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
    }, (err) => {
      console.warn('TV branches listener error:', err)
    })
    return () => unsubB()
  }, [clinic?.id])

  // 3. Real-time Appointments Listener for Today's Queue
  useEffect(() => {
    if (!clinic?.id && !slug) return
    const clinicId = clinic?.id || slug
    const targetClinicIds = Array.from(new Set([clinicId, clinic?.id, slug].filter(Boolean)))
    const todayDate = cairoTodayDate || getCairoDateString()

    const qAppts = query(
      collection(db, 'appointments'),
      where('clinic_id', 'in', targetClinicIds),
      where('date', '==', todayDate)
    )

    const unsubAppts = onSnapshot(
      qAppts,
      (snapshot) => {
        const list: any[] = snapshot.docs.map(d => ({ id: d.id, ...(d.data() as any) }))
        setAppointments(list)

        // Mark initial snapshot complete; only suppress if patient was already in_progress on page mount
        if (isFirstDataLoadRef.current) {
          isFirstDataLoadRef.current = false
          const initialActive = list.find(a => a.status === 'in_progress' || a.status === 'examining')
          if (initialActive) {
            const qNum = initialActive.queue_number ?? initialActive.queueNumber ?? ''
            lastAnnouncedCallKeyRef.current = \`\${initialActive.id}_\${initialActive.calledAt || initialActive.startedAt || qNum}\`
          }
        }
      },
      (err) => {
        console.warn('TV Screen in-query error, trying single clinic_id query:', err)
        try {
          const fallbackQ = query(
            collection(db, 'appointments'),
            where('clinic_id', '==', clinicId),
            where('date', '==', todayDate)
          )
          onSnapshot(fallbackQ, (s) => {
            setAppointments(s.docs.map(d => ({ id: d.id, ...(d.data() as any) })))
          })
        } catch (e) {
          console.error('TV appointments fallback error:', e)
        }
      }
    )

    return () => unsubAppts()
  }, [clinic?.id, slug, cairoTodayDate])

  // Filter for Active Branch
  const branchAppointments = useMemo(() => {
    return appointments.filter(a => {
      if (selectedBranchId && selectedBranchId !== 'all') {
        const apptBranch = a.branch_id || a.branchId
        const isMain = selectedBranchId === 'main' || branches?.find((b: any) => b.isMain)?.id === selectedBranchId || clinic?.branches?.find((b: any) => b.isMain)?.id === selectedBranchId
        return apptBranch ? apptBranch === selectedBranchId : isMain
      }
      return true
    })
  }, [appointments, selectedBranchId, clinic, branches])

  // Current Patient (Status: in_progress or examining)
  const currentPatient = useMemo(() => {
    return branchAppointments.find(a => a.status === 'in_progress' || a.status === 'examining') || null
  }, [branchAppointments])

  // Next Waiting Patients (use unified sortQueue clinical engine to match doctor's order)
  const nextWaitingPatients = useMemo(() => {
    return sortQueue(branchAppointments, clinic).slice(0, 5)
  }, [branchAppointments, clinic])

  `;

code = code.substring(0, startIndex) + newListenerChunk + code.substring(endIndex);

// 6. Fix voice call trigger currentCallKey to support calledAt and queueNumber
const oldVoiceTrigger = `    const currentCallKey = \`\${currentPatient.id}_\${currentPatient.startedAt || currentPatient.queue_number}\`

    // A10 Fix: When first patient enters or doctor changes turn, trigger announcement
    if (lastAnnouncedCallKeyRef.current !== currentCallKey) {
      lastAnnouncedCallKeyRef.current = currentCallKey
      if (isAudioEnabled) {
        triggerPatientVoiceCall(
          currentPatient.queue_number,
          currentPatient.patientName
        )
      }
    }`;

const newVoiceTrigger = `    const qNum = currentPatient.queue_number ?? currentPatient.queueNumber ?? '1'
    const currentCallKey = \`\${currentPatient.id}_\${currentPatient.calledAt || currentPatient.startedAt || qNum}\`

    // When first patient enters, turn changes, or patient is called/recalled, trigger announcement
    if (lastAnnouncedCallKeyRef.current !== currentCallKey) {
      lastAnnouncedCallKeyRef.current = currentCallKey
      if (isAudioEnabled) {
        triggerPatientVoiceCall(
          qNum,
          currentPatient.patientName
        )
      }
    }`;

if (!code.includes(oldVoiceTrigger)) {
  console.error('oldVoiceTrigger not found in WaitingRoomTvClient.tsx');
  process.exit(1);
}
code = code.replace(oldVoiceTrigger, newVoiceTrigger);

// 7. Fix queue number display in JSX
code = code.replace(
  '#{currentPatient.queue_number}',
  '#{currentPatient.queue_number ?? currentPatient.queueNumber ?? \'-\'}'
);

code = code.replace(
  '#{p.queue_number}',
  '#{p.queue_number ?? p.queueNumber ?? \'-\'}'
);

code = code.replace(
  '{tvConfig.showPatientName && p.patientName ? p.patientName : `تذكرة دور #${p.queue_number}`}',
  '{tvConfig.showPatientName && p.patientName ? p.patientName : `تذكرة دور #${p.queue_number ?? p.queueNumber ?? \'-\'`}'
);

code = code.replace(
  'key={currentPatient.id + currentPatient.queue_number}',
  'key={currentPatient.id + \'_\' + (currentPatient.queue_number ?? currentPatient.queueNumber ?? \'curr\')}'
);

code = code.replace(
  'currentPatient?.queue_number || \'1\',',
  'currentPatient?.queue_number || currentPatient?.queueNumber || \'1\','
);

// Branch label resolution
const oldBranchLabel = `  const activeBranchName = selectedBranchId !== 'all'
    ? clinic?.branches?.find((b: any) => b.id === selectedBranchId)?.name || 'الفرع المحدد'
    : clinic?.branchName || 'الفرع الرئيسي'`;

const newBranchLabel = `  const activeBranchName = useMemo(() => {
    if (selectedBranchId !== 'all') {
      const bObj = branches?.find((b: any) => b.id === selectedBranchId) || clinic?.branches?.find((b: any) => b.id === selectedBranchId)
      return bObj?.name || 'الفرع المحدد'
    }
    return clinic?.branchName || 'الفرع الرئيسي'
  }, [selectedBranchId, branches, clinic])`;

if (code.includes(oldBranchLabel)) {
  code = code.replace(oldBranchLabel, newBranchLabel);
}

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully updated WaitingRoomTvClient.tsx');
