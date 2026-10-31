import fs from 'fs';

const path = 'src/components/clinic/AdminDashboard.tsx';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

// 1. Add import
const oldImport = "import { useLanguage } from '@/context/LanguageContext'";
const newImport = `import { useLanguage } from '@/context/LanguageContext'
import { resolveEffectiveDailyLimit, isAppointmentActive } from '@/lib/bookingCapacity'`;

if (!code.includes(oldImport)) {
  console.error('oldImport not found in AdminDashboard.tsx');
  process.exit(1);
}
code = code.replace(oldImport, newImport);

// 2. Replace activeBookingsCount and effectiveMaxDailyBookings
const oldBlock = `  // Active daily bookings count (excluding cancelled)
  const activeBookingsCount = useMemo(() => {
    return branchFilteredAppointments.filter((d: any) => d.status !== 'cancelled').length
  }, [branchFilteredAppointments])

  // Resolve daily limit based on selected branch or clinic settings
  const effectiveMaxDailyBookings = useMemo(() => {
    if (selectedBranchId && selectedBranchId !== 'all') {
      const bObj = branches.find(b => b.id === selectedBranchId)
      if (bObj && bObj.maxDailyBookings) return Number(bObj.maxDailyBookings) || 0
    }
    return Number(clinic?.maxDailyBookings) || 0
  }, [selectedBranchId, branches, clinic?.maxDailyBookings])`;

const newBlock = `  // Active daily bookings count (excluding cancelled)
  const activeBookingsCount = useMemo(() => {
    return branchFilteredAppointments.filter((d: any) => isAppointmentActive(d.status)).length
  }, [branchFilteredAppointments])

  // Resolve daily limit based on selected branch or clinic settings (unified resolution)
  const effectiveMaxDailyBookings = useMemo(() => {
    const selectedBranch = selectedBranchId && selectedBranchId !== 'all'
      ? branches.find(b => b.id === selectedBranchId)
      : undefined
    return resolveEffectiveDailyLimit(clinic, selectedBranch, branches.length > 1)
  }, [selectedBranchId, branches, clinic])`;

if (!code.includes(oldBlock)) {
  console.error('oldBlock not found in AdminDashboard.tsx');
  process.exit(1);
}
code = code.replace(oldBlock, newBlock);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully updated AdminDashboard.tsx');
