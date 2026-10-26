export type DemoAppointmentStatus = 'waiting' | 'in_progress' | 'completed' | 'skipped'
export type DemoPaymentStatus = 'paid' | 'pending'
export type DemoPaymentMethod = 'cash' | 'vodafone_cash' | 'card'

export interface DemoAppointment {
  id: string
  queue_number: number
  patientName: string
  patientId: string
  phone: string
  age: number
  serviceId: string
  serviceName: string
  servicePrice: number
  status: DemoAppointmentStatus
  paymentStatus: DemoPaymentStatus
  paymentMethod?: DemoPaymentMethod
  time: string
  date: string
  isUrgent?: boolean
  diagnosis?: string
  notes?: string
  examinationStartedAt?: number // timestamp in ms
}

export interface DemoPatientVisit {
  id: string
  date: string
  serviceName: string
  diagnosis: string
  notes: string
  doctorName: string
  prescriptionId?: string
}

export interface DemoPrescriptionDrug {
  name: string
  dosage: string
  duration: string
  notes?: string
}

export interface DemoPrescription {
  id: string
  patientId: string
  patientName: string
  age: number
  date: string
  diagnosis: string
  instructions: string
  drugs: DemoPrescriptionDrug[]
  appointmentId?: string
}

export interface DemoPatient {
  id: string
  name: string
  phone: string
  age: number
  gender: 'male' | 'female'
  allergies?: string
  chronicDiseases?: string
  visits: DemoPatientVisit[]
  lastVisitDate: string
}

export interface DemoService {
  id: string
  name: string
  nameEn: string
  price: number
  duration: string
  desc: string
  descEn: string
  isUrgent?: boolean
}

export interface DemoClinicInfo {
  clinicName: string
  clinicNameEn: string
  doctorName: string
  doctorNameEn: string
  specialty: string
  specialtyEn: string
  phone: string
  address: string
  addressEn: string
  primaryColor: string
  rating: number
  reviewsCount: number
}

export type DemoPlatformTab = 'doctor' | 'patient'
export type DemoDoctorSubTab = 'dashboard' | 'patients' | 'prescriptions' | 'reports'

export interface TourStep {
  id: string
  title: string
  titleEn: string
  description: string
  descriptionEn: string
  targetTab: DemoPlatformTab
  targetSubTab?: DemoDoctorSubTab
  targetElementSelector?: string
}
