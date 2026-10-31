import fs from 'fs';

const path = 'src/components/clinic/InClinicBookingView.tsx';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Add import
const oldImport = "import { getClinicBranches, ensureClinicHasMainBranch } from '@/lib/branchService'";
const newImport = `import { getClinicBranches, ensureClinicHasMainBranch } from '@/lib/branchService'
import { resolveEffectiveDailyLimit, isAppointmentActive, CAPACITY_FULL_MESSAGE } from '@/lib/bookingCapacity'`;

if (!code.includes(oldImport)) {
  console.error('oldImport not found in InClinicBookingView.tsx');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Add capacity state & listener
const oldStateAnchor = "  // Submission State\n  const [isSubmitting, setIsSubmitting] = useState(false)";
const newStateChunk = `  // Capacity and Daily Limits
  const maxLimit = useMemo(() => {
    return resolveEffectiveDailyLimit(clinic, selectedBranch, branches.length > 1)
  }, [clinic, selectedBranch, branches.length])

  const [dateBookingCount, setDateBookingCount] = useState<number>(0)
  const isDateFull = maxLimit > 0 && dateBookingCount >= maxLimit

  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const clinicId = clinic.id || clinic.slug
    const q = query(
      collection(db, 'appointments'),
      where('clinic_id', '==', clinicId),
      where('date', '==', bookingDate)
    )
    const unsub = onSnapshot(q, (snap) => {
      let active = snap.docs.filter((d) => isAppointmentActive(d.data().status))
      if (branches.length > 1 && selectedBranchId && selectedBranchId !== 'main') {
        active = active.filter((d) => (d.data().branch_id || d.data().branchId || null) === selectedBranchId)
      }
      setDateBookingCount(active.length)
    }, (err) => {
      console.error('Error listening to date capacity:', err)
    })
    return () => unsub()
  }, [clinic?.id, clinic?.slug, bookingDate, selectedBranchId, branches.length])

  // Submission State
  const [isSubmitting, setIsSubmitting] = useState(false)`;

if (!code.includes(oldStateAnchor)) {
  console.error('oldStateAnchor not found in InClinicBookingView.tsx');
  process.exit(1);
}
code = code.replace(oldStateAnchor, newStateChunk);

// 3. Prevent submission if full in handleConfirmBooking
const oldValidationAnchor = "    if (!selectedBranchId) {\n      return toast.error(isRtl ? 'يرجى اختيار الفرع' : 'Please select branch')\n    }";
const newValidationChunk = `    if (!selectedBranchId) {
      return toast.error(isRtl ? 'يرجى اختيار الفرع' : 'Please select branch')
    }

    if (isDateFull) {
      return toast.error(
        isRtl
          ? \`اكتمل الحد الأقصى للحجوزات لهذا اليوم (\${maxLimit} كشف)\`
          : \`Daily capacity reached (\${maxLimit} appointments)\`
      )
    }`;

if (!code.includes(oldValidationAnchor)) {
  console.error('oldValidationAnchor not found in InClinicBookingView.tsx');
  process.exit(1);
}
code = code.replace(oldValidationAnchor, newValidationChunk);

// 4. Show capacity badge in Date Selection UI
const oldDateUI = `                {/* Date Selection */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold text-foreground">
                    {isRtl ? 'تاريخ الحجز' : 'Booking Date'} *
                  </Label>`;

const newDateUI = `                {/* Date Selection */}
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-bold text-foreground">
                      {isRtl ? 'تاريخ الحجز' : 'Booking Date'} *
                    </Label>
                    {maxLimit > 0 && (
                      <Badge
                        className={\`text-[10px] font-bold \${
                          isDateFull
                            ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20'
                            : 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 font-mono'
                        }\`}
                      >
                        {isDateFull
                          ? (isRtl ? \`مكتمل العدد (\${dateBookingCount} / \${maxLimit})\` : \`Full (\${dateBookingCount}/\${maxLimit})\`)
                          : (isRtl ? \`متبقي \${maxLimit - dateBookingCount} من \${maxLimit}\` : \`\${maxLimit - dateBookingCount}/\${maxLimit} left\`)}
                      </Badge>
                    )}
                  </div>`;

if (!code.includes(oldDateUI)) {
  console.error('oldDateUI not found in InClinicBookingView.tsx');
  process.exit(1);
}
code = code.replace(oldDateUI, newDateUI);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully updated InClinicBookingView.tsx');
