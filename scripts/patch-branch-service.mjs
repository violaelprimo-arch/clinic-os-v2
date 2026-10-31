import fs from 'fs';

const path = 'src/lib/branchService.ts';
let code = fs.readFileSync(path, 'utf8').replace(/\r\n/g, '\n');

const target1 = `    phone?: string
  }
): Promise<void> {`;

const replace1 = `    phone?: string
    maxDailyBookings?: number
  }
): Promise<void> {`;

const target2 = `        if (extraBranchData?.phone) {
          updateData.phone = extraBranchData.phone
        }`;

const replace2 = `        if (extraBranchData?.phone) {
          updateData.phone = extraBranchData.phone
        }
        if (extraBranchData?.maxDailyBookings !== undefined) {
          updateData.maxDailyBookings = Math.max(0, Number(extraBranchData.maxDailyBookings) || 0)
        }`;

if (!code.includes(target1)) {
  console.error('Target 1 not found');
  process.exit(1);
}
code = code.replace(target1, replace1);

if (!code.includes(target2)) {
  console.error('Target 2 not found');
  process.exit(1);
}
code = code.replace(target2, replace2);

fs.writeFileSync(path, code, 'utf8');
console.log('Successfully updated branchService.ts');
