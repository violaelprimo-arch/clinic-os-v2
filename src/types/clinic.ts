export interface BranchScheduleDay {
  id: string // 'saturday', 'sunday', ...
  day: string // 'السبت', 'الأحد', ...
  isOpen: boolean
  start: string // '09:00'
  end: string // '22:00'
}

export interface BranchService {
  id: string
  name: string
  price: number
  duration?: string
  description?: string
}

export interface Branch {
  id: string
  clinicId: string
  name: string
  governorate?: string
  city?: string
  area?: string
  address: string
  mapsLink?: string
  latitude?: number
  longitude?: number
  phone: string
  whatsapp?: string
  image?: string
  workingHours?: string
  weeklySchedule: BranchScheduleDay[]
  vacations?: string[] // list of ISO dates YYYY-MM-DD
  slotDuration?: number // default 15 mins
  maxDailyBookings?: number
  services?: BranchService[]
  assignedStaffIds?: string[]
  isOpen: boolean
  isArchived?: boolean
  isMain?: boolean
  createdAt: string
  updatedAt?: string
}

export interface ClinicBranding {
  clinicName: string
  doctorName: string
  doctorTitle?: string
  specialty?: string
  slogan?: string
  logoUrl?: string
  thermalLogoUrl?: string
  primaryColor?: string
  secondaryColor?: string
  textColor?: string
  heroImage?: string
  doctorImage?: string
  documentHeader?: string
  documentFooter?: string
}

export interface StaffMember {
  id: string
  clinicId: string
  name: string
  email: string
  phone?: string
  role: 'doctor' | 'branch_manager' | 'receptionist' | 'accountant' | 'medical_assistant'
  assignedBranchIds: string[] // specific branch IDs or ['all']
  permissions: string[]
  isActive: boolean
  createdAt: string
}

export interface Appointment {
  id: string
  clinic_id: string
  branch_id?: string
  branchName?: string
  patientName: string
  phone: string
  age?: string | null
  dob?: string | null
  serviceId?: string
  serviceName: string
  servicePrice: number
  discountAmount?: number
  discountPercent?: number
  discountReason?: string
  discountedBy?: string
  netPrice?: number
  isUrgent?: boolean
  date: string // YYYY-MM-DD
  queue_number: number
  status: 'waiting' | 'in_progress' | 'completed' | 'skipped' | 'no_show' | 'cancelled'
  priorityNext?: boolean
  requeuedAt?: string
  skippedAt?: string
  paymentMethod: 'cash' | 'instapay' | 'wallet'
  paymentStatus: 'unpaid' | 'pending_verification' | 'paid' | 'refunded'
  transferNumber?: string
  transferReference?: string
  transferProofUrl?: string
  paymentConfirmedBy?: string
  paymentConfirmedAt?: string
  rejectionReason?: string
  startedAt?: string
  completedAt?: string
  notes?: string
  diagnosis?: string
  drugs?: any[]
  createdAt: string
  updatedAt?: string
}

export interface VitalSigns {
  id?: string
  appointmentId?: string
  patientPhone: string
  bloodPressureSystolic?: number
  bloodPressureDiastolic?: number
  heartRate?: number
  temperature?: number
  weight?: number
  bloodGlucose?: number
  notes?: string
  recordedAt: string
  recordedBy?: string
}

export interface PatientMedicalRecord {
  id: string
  clinicId: string
  patientName: string
  phone: string
  age?: string
  gender?: 'male' | 'female'
  bloodType?: string
  allergies?: string[]
  chronicDiseases?: string[]
  surgicalHistory?: string[]
  familyHistory?: string
  vitalsHistory?: VitalSigns[]
  emergencyContactName?: string
  emergencyContactPhone?: string
  notes?: string
  createdAt: string
  updatedAt?: string
}

export interface ClinicNotification {
  id: string
  clinicId: string
  branchId?: string
  recipientType: 'patient' | 'staff' | 'doctor'
  recipientTarget: string // patient phone, staff user id, or 'all_staff'
  title: string
  body: string
  type: 'approaching_turn' | 'turn_ready' | 'booking_confirmed' | 'payment_confirmed' | 'payment_pending' | 'new_booking' | 'prescription_ready' | 'system'
  eventId?: string // Deduplication key
  appointmentId?: string
  isRead: boolean
  createdAt: string
}

export interface Expense {
  id: string
  clinicId: string
  branchId?: string
  branchName?: string
  title: string
  category: 'rent' | 'salaries' | 'supplies' | 'utilities' | 'maintenance' | 'other'
  amount: number
  paidAt: string // YYYY-MM-DD
  recordedBy?: string
  notes?: string
  createdAt: string
}

export interface InventoryItem {
  id: string
  clinicId: string
  branchId?: string
  name: string
  category: 'medicine' | 'consumable' | 'equipment' | 'other'
  quantity: number
  minAlertThreshold: number
  unit: string
  expiryDate?: string
  costPrice?: number
  supplierName?: string
  supplierPhone?: string
  lastRestockedAt?: string
  createdAt: string
}
