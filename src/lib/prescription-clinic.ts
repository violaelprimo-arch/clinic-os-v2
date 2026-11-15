type PrescriptionBranch = {
  id: string
  name?: string
  address?: string
  phone?: string
  isMain?: boolean
  isArchived?: boolean
}

export function prescriptionClinicDetails(
  clinic: {
    clinicName?: string
    name?: string
    clinicAddress?: string
    address?: string
    clinicPhone?: string
    clinicPhones?: string[]
    phones?: string[]
  } | null | undefined,
  branches: PrescriptionBranch[] = [],
  branchId?: string,
  branchName?: string,
) {
  const namedBranches = branchName ? branches.filter(branch => branch.name === branchName) : []
  const branch = branchId && branchId !== 'main'
    ? branches.find(branch => branch.id === branchId)
    : namedBranches.length === 1 && !branchId
      ? namedBranches[0]
      : branches.find(branch => branch.isMain && !branch.isArchived)

  const address = [branch?.address, clinic?.clinicAddress, clinic?.address]
    .map(value => typeof value === 'string' ? value.trim() : '')
    .find(value => value && !['عنوان الفرع', 'العنوان: مسجل بالعيادة', 'مسجل بالعيادة'].includes(value))
  const phone = [branch?.phone, clinic?.clinicPhone, ...(Array.isArray(clinic?.clinicPhones) ? clinic.clinicPhones : []), ...(Array.isArray(clinic?.phones) ? clinic.phones : [])]
    .map(value => typeof value === 'string' ? value.trim() : '')
    .find(value => value && !['01012345678', '201012345678'].includes(value.replace(/\D/g, '')) && /\d{7,}/.test(value.replace(/\D/g, '')))

  return { clinicName: clinic?.clinicName || clinic?.name, clinicAddress: address, clinicPhone: phone, branchName: branch?.name || branchName }
}

export function formatPrescriptionDoctorName(name?: string, title?: string) {
  const doctorName = name?.trim()
  if (!doctorName) return ''
  if (/^(?:(?:أ\s*\.\s*)?د\s*\.|دكتور(?:ة)?\s|(?:prof|dr)\b)/i.test(doctorName)) return doctorName
  const doctorTitle = title?.trim()
  if (!doctorTitle || doctorName.startsWith(doctorTitle + ' ')) return doctorName
  return `${doctorTitle} ${doctorName}`
}
