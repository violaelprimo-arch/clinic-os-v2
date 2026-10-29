import { Page, Route } from '@playwright/test'

/**
 * Isolated Synthetic Test Fixtures for Yalla Clinic SaaS
 * Guarantees zero modification or deletion of live/production patient records.
 * All synthetic entities are prefixed with `synth-` or `e2e-`.
 */

export interface SyntheticClinic {
  id: string
  slug: string
  clinicName: string
  doctorName: string
  doctorEmail: string
  doctorPassword: string
  doctorPasswordHash?: string
  assistantEmail: string
  assistantPassword: string
  assistantPasswordHash?: string
  specialty: string
  certificationTitle?: string
  clinicPhone: string
  clinicAddress: string
  primaryColor: string
  secondaryColor: string
  isActive: boolean
  aiEnabled: boolean
  packageName: string
  packagePrice: number
  activationDate?: string
  expirationDate?: string
  branches: Array<{
    id: string
    name: string
    address: string
    phone: string
    isMain: boolean
    weeklySchedule?: any[]
  }>
  services: Array<{
    id: string
    name: string
    price: number
    duration?: string
    isUrgent?: boolean
  }>
  weeklySchedule?: any[]
  heroImage?: string
  logoUrl?: string
}

export interface SyntheticAppointment {
  id: string
  clinic_id: string
  branch_id?: string
  branchName?: string
  patientName: string
  phone: string
  age?: string | number
  gender?: string
  serviceName: string
  servicePrice: number
  originalPrice?: number
  discountApplied?: number
  netTotal?: number
  discount?: { type: 'fixed' | 'percentage'; value: number; amount: number }
  date: string
  time?: string
  queue_number: number
  status: 'waiting' | 'in_progress' | 'completed' | 'skipped' | 'cancelled'
  paymentStatus: 'pending' | 'paid' | 'unpaid' | 'pending_verification'
  paymentMethod?: 'cash' | 'instapay' | 'wallet'
  isUrgent?: boolean
  priorityNext?: boolean
  startedAt?: string
  completedAt?: string
  skippedAt?: string
  requeuedAt?: string
  durationMinutes?: number
  diagnosis?: string
  drugs?: Array<{
    name: string
    dosage: string
    duration: string
    notes?: string
  }>
  vitalSigns?: {
    bloodPressureSystolic?: number | null
    bloodPressureDiastolic?: number | null
    heartRate?: number | null
    temperature?: number | null
    glucoseLevel?: number | null
    weightKg?: number | null
    recordedAt?: string
  }
  invoiceNumber?: string
  createdAt: string
}

const todayDate = new Date().toISOString().split('T')[0]

export const SYNTHETIC_CLINIC_ALPHA: SyntheticClinic = {
  id: 'synth-clinic-alpha',
  slug: 'e2e-clinic-alpha',
  clinicName: 'عيادة النور التخصصية (ألفا)',
  doctorName: 'د. أحمد ألفا',
  doctorEmail: 'dr.alpha@test.com',
  doctorPassword: 'TestPass123!',
  assistantEmail: 'staff.alpha@test.com',
  assistantPassword: 'StaffPass123!',
  specialty: 'استشاري الباطنة والجهاز الهضمي',
  certificationTitle: 'دكتوراه الباطنة العامة - جامعة القاهرة',
  clinicPhone: '01011112222',
  clinicAddress: '15 شارع مصطفى النحاس، مدينة نصر، القاهرة',
  primaryColor: '#087CF4',
  secondaryColor: '#02CFF3',
  isActive: true,
  aiEnabled: true,
  packageName: 'الباقة الاحترافية',
  packagePrice: 950,
  activationDate: '2026-01-01',
  expirationDate: '2030-12-31',
  branches: [
    {
      id: 'main',
      name: 'الفرع الرئيسي',
      address: '15 شارع مصطفى النحاس، مدينة نصر، القاهرة',
      phone: '01011112222',
      isMain: true,
    },
  ],
  services: [
    { id: 'srv-1', name: 'كشف عادي', price: 250, duration: '15 دقيقة' },
    { id: 'srv-2', name: 'استشارة', price: 150, duration: '10 دقائق' },
    { id: 'srv-3', name: 'كشف مستعجل / طوارئ', price: 400, duration: 'فوري مباشر', isUrgent: true },
  ],
  heroImage: 'https://images.unsplash.com/photo-1622253692010-333f2da6031d?q=80&w=1000&auto=format&fit=crop',
  logoUrl: 'https://images.example.test/clinic-alpha-logo.svg',
}

export const SYNTHETIC_CLINIC_BETA: SyntheticClinic = {
  id: 'synth-clinic-beta',
  slug: 'e2e-clinic-beta',
  clinicName: 'عيادة الشفاء التخصصية (بيتا)',
  doctorName: 'د. باسم بيتا',
  doctorEmail: 'dr.beta@test.com',
  doctorPassword: 'TestBetaPass123!',
  assistantEmail: 'staff.beta@test.com',
  assistantPassword: 'StaffBetaPass123!',
  specialty: 'استشاري القلب والأوعية الدموية',
  clinicPhone: '01222223333',
  clinicAddress: '45 شارع جامعة الدول العربية، المهندسين، الجيزة',
  primaryColor: '#059669',
  secondaryColor: '#10B981',
  isActive: true,
  aiEnabled: true,
  packageName: 'الباقة الذهبية',
  packagePrice: 1200,
  activationDate: '2026-02-01',
  expirationDate: '2030-12-31',
  branches: [
    {
      id: 'main',
      name: 'الفرع الرئيسي',
      address: '45 شارع جامعة الدول العربية، المهندسين، الجيزة',
      phone: '01222223333',
      isMain: true,
    },
  ],
  services: [
    { id: 'srv-b1', name: 'كشف قلب', price: 350, duration: '20 دقيقة' },
  ],
}

export const SYNTHETIC_CLINIC_GAMMA: SyntheticClinic = {
  id: 'synth-clinic-gamma',
  slug: 'synth-clinic-gamma',
  clinicName: 'عيادة معلقة للاختبار (جاما)',
  doctorName: 'د. جمال جاما',
  doctorEmail: 'dr.gamma@test.com',
  doctorPassword: 'GammaPass123!',
  assistantEmail: 'staff.gamma@test.com',
  assistantPassword: 'StaffGammaPass123!',
  specialty: 'طب الأسنان وجراحة الفم',
  clinicPhone: '01555556666',
  clinicAddress: 'شارع الهرم، الجيزة',
  primaryColor: '#DC2626',
  secondaryColor: '#EF4444',
  isActive: false, // Suspended guard test
  aiEnabled: false,
  packageName: 'الباقة الأساسية',
  packagePrice: 450,
  expirationDate: '2025-01-01',
  branches: [
    {
      id: 'main',
      name: 'الفرع الرئيسي',
      address: 'شارع الهرم، الجيزة',
      phone: '01555556666',
      isMain: true,
    },
  ],
  services: [
    { id: 'srv-g1', name: 'كشف أسنان', price: 200 },
  ],
}

export function getInitialSyntheticAppointments(): SyntheticAppointment[] {
  return [
    // Alpha Appointments
    {
      id: 'synth-appt-alpha-1',
      clinic_id: 'synth-clinic-alpha',
      branch_id: 'main',
      branchName: 'الفرع الرئيسي',
      patientName: 'سعيد محمد',
      phone: '01012345678',
      age: 42,
      gender: 'ذكر',
      serviceName: 'كشف عادي',
      servicePrice: 250,
      originalPrice: 250,
      discountApplied: 0,
      netTotal: 250,
      date: todayDate,
      queue_number: 1,
      status: 'waiting',
      paymentStatus: 'pending',
      paymentMethod: 'cash',
      createdAt: `${todayDate}T09:00:00.000Z`,
      invoiceNumber: 'INV-ALPHA-001',
    },
    {
      id: 'synth-appt-alpha-2',
      clinic_id: 'synth-clinic-alpha',
      branch_id: 'main',
      branchName: 'الفرع الرئيسي',
      patientName: 'حسام السيد',
      phone: '01123456789',
      age: 29,
      gender: 'ذكر',
      serviceName: 'كشف مستعجل / طوارئ',
      servicePrice: 400,
      originalPrice: 400,
      discountApplied: 0,
      netTotal: 400,
      date: todayDate,
      queue_number: 2,
      isUrgent: true,
      status: 'waiting',
      paymentStatus: 'pending',
      paymentMethod: 'cash',
      createdAt: `${todayDate}T09:15:00.000Z`,
      invoiceNumber: 'INV-ALPHA-002',
    },
    {
      id: 'synth-appt-alpha-3',
      clinic_id: 'synth-clinic-alpha',
      branch_id: 'main',
      branchName: 'الفرع الرئيسي',
      patientName: 'فاطمة إبراهيم',
      phone: '01234567890',
      age: 35,
      gender: 'أنثى',
      serviceName: 'كشف عادي',
      servicePrice: 250,
      originalPrice: 250,
      discountApplied: 0,
      netTotal: 250,
      date: todayDate,
      queue_number: 3,
      status: 'skipped',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      skippedAt: `${todayDate}T09:30:00.000Z`,
      createdAt: `${todayDate}T09:05:00.000Z`,
      invoiceNumber: 'INV-ALPHA-003',
    },
    {
      id: 'synth-appt-alpha-encoded',
      clinic_id: 'synth-clinic-alpha',
      branch_id: 'main',
      branchName: 'الفرع الرئيسي',
      patientName: 'طارق رضوان',
      phone: '+201011122334',
      age: 50,
      gender: 'ذكر',
      serviceName: 'كشف عادي',
      servicePrice: 250,
      originalPrice: 250,
      discountApplied: 0,
      netTotal: 250,
      date: todayDate,
      queue_number: 4,
      status: 'completed',
      paymentStatus: 'paid',
      paymentMethod: 'cash',
      diagnosis: 'نزلة معوية حادة (Gastroenteritis)',
      drugs: [
        { name: 'Visceralgine tab', dosage: 'قرص 3 مرات يومياً قبل الأكل', duration: 'لمدة 5 أيام', notes: 'مضاد للمغص والتقلصات' },
        { name: 'Antinal 200mg cap', dosage: 'كبسولة كل 8 ساعات بعد الأكل', duration: 'لمدة 4 أيام', notes: 'مطهر معوي واسع المجال' },
        { name: 'Gast-Reg 200mg tab', dosage: 'قرص قبل الأكل بنصف ساعة', duration: 'لمدة 5 أيام', notes: 'تنظيم حركة القناة الهضمية' },
      ],
      vitalSigns: {
        bloodPressureSystolic: 120,
        bloodPressureDiastolic: 80,
        heartRate: 72,
        temperature: 37.0,
        glucoseLevel: 95,
        weightKg: 75,
        recordedAt: `${todayDate}T09:40:00.000Z`,
      },
      createdAt: `${todayDate}T08:30:00.000Z`,
      completedAt: `${todayDate}T09:50:00.000Z`,
      durationMinutes: 15,
      invoiceNumber: 'INV-ALPHA-004',
    },

    // Beta Appointments (Tenant Beta)
    {
      id: 'synth-appt-beta-1',
      clinic_id: 'synth-clinic-beta',
      branch_id: 'main',
      branchName: 'الفرع الرئيسي',
      patientName: 'علي عمر',
      phone: '01299988877',
      age: 55,
      gender: 'ذكر',
      serviceName: 'كشف قلب',
      servicePrice: 350,
      originalPrice: 350,
      discountApplied: 0,
      netTotal: 350,
      date: todayDate,
      queue_number: 1,
      status: 'waiting',
      paymentStatus: 'paid',
      paymentMethod: 'instapay',
      diagnosis: 'قصور في الشريان التاجي ومتابعة تخطيط القلب',
      drugs: [
        { name: 'Concor 5mg tab', dosage: 'قرص صباحاً يومياً', duration: 'مستمر' },
      ],
      createdAt: `${todayDate}T08:00:00.000Z`,
      invoiceNumber: 'INV-BETA-001',
    },
  ]
}

/**
 * In-memory synthetic state store for E2E tests
 */
export class SyntheticStore {
  clinics: Map<string, SyntheticClinic> = new Map()
  appointments: Map<string, SyntheticAppointment> = new Map()
  patientAccounts: Map<string, any> = new Map()
  branches: Map<string, any> = new Map()

  constructor() {
    this.reset()
  }

  reset() {
    this.clinics.clear()
    this.appointments.clear()
    this.patientAccounts.clear()
    this.branches.clear()

    // Seed clinics
    this.clinics.set(SYNTHETIC_CLINIC_ALPHA.id, structuredClone(SYNTHETIC_CLINIC_ALPHA))
    this.clinics.set(SYNTHETIC_CLINIC_BETA.id, structuredClone(SYNTHETIC_CLINIC_BETA))
    this.clinics.set(SYNTHETIC_CLINIC_GAMMA.id, structuredClone(SYNTHETIC_CLINIC_GAMMA))

    // Seed branches
    for (const b of SYNTHETIC_CLINIC_ALPHA.branches) {
      this.branches.set(b.id, { ...b, clinicId: SYNTHETIC_CLINIC_ALPHA.id })
    }
    for (const b of SYNTHETIC_CLINIC_BETA.branches) {
      this.branches.set(b.id, { ...b, clinicId: SYNTHETIC_CLINIC_BETA.id })
    }

    // Seed appointments
    const initialAppts = getInitialSyntheticAppointments()
    for (const appt of initialAppts) {
      this.appointments.set(appt.id, structuredClone(appt))
    }

    // Seed patient account for auth portal
    this.patientAccounts.set('synth-patient-1', {
      id: 'synth-patient-1',
      clinic_id: SYNTHETIC_CLINIC_ALPHA.id,
      name: 'سعيد محمد',
      phone: '01012345678',
      password: 'PatientPass123!',
      age: 42,
    })
  }

  findClinicBySlug(slug: string): SyntheticClinic | undefined {
    for (const c of this.clinics.values()) {
      if (c.slug === slug) return c
    }
    return undefined
  }

  getAppointmentsForClinic(clinicId: string, date?: string): SyntheticAppointment[] {
    const list: SyntheticAppointment[] = []
    for (const appt of this.appointments.values()) {
      if (appt.clinic_id === clinicId) {
        if (!date || appt.date === date) {
          list.push(appt)
        }
      }
    }
    return list
  }
}

/**
 * Sets up Playwright page route interceptors to provide a self-contained, reactive
 * synthetic test harness. Handles auth tokens, Firebase identity endpoints, and API calls.
 */
export async function setupSyntheticHarness(
  page: Page,
  options: {
    initialRole?: 'owner' | 'doctor' | 'assistant' | 'patient'
    clinicSlug?: string
    store?: SyntheticStore
  } = {}
) {
  const store = options.store || new SyntheticStore()
  const currentSlug = options.clinicSlug || 'e2e-clinic-alpha'

  // Owner Auth Payload & Token
  const ownerPayload = Buffer.from(
    JSON.stringify({
      sub: 'fixture-owner-uid',
      user_id: 'fixture-owner-uid',
      aud: 'clinic-os-d2d1b',
      iss: 'https://securetoken.google.com/clinic-os-d2d1b',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 7200,
      auth_time: Math.floor(Date.now() / 1000),
      email: 'yallacodex@gmail.com',
      email_verified: true,
      platformOwner: true,
      ownerUid: 'fixture-owner-uid',
      ownerEmail: 'yallacodex@gmail.com',
      firebase: { sign_in_provider: 'password' },
    })
  ).toString('base64url')

  const ownerToken =
    Buffer.from(JSON.stringify({ alg: 'RS256', typ: 'JWT' })).toString('base64url') +
    '.' +
    ownerPayload +
    '.fixture-sig'

  // Intercept synthetic logo images
  await page.route('**/images.example.test/**', async (route) => {
    await route.fulfill({
      contentType: 'image/svg+xml',
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="40"><rect width="120" height="40" fill="#087CF4"/><text x="10" y="25" fill="#fff" font-size="14">Yalla Clinic</text></svg>',
    })
  })

  // Intercept Google Identity & Firebase Auth
  await page.route('https://identitytoolkit.googleapis.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        idToken: ownerToken,
        refreshToken: 'fixture-refresh-token',
        expiresIn: '3600',
        localId: 'fixture-owner-uid',
        emailVerified: true,
        registered: true,
      },
    })
  })

  await page.route('https://securetoken.googleapis.com/**', async (route) => {
    await route.fulfill({
      contentType: 'application/json',
      json: {
        access_token: ownerToken,
        expires_in: '3600',
        token_type: 'Bearer',
        refresh_token: 'fixture-refresh-token',
        id_token: ownerToken,
        user_id: 'fixture-owner-uid',
        project_id: 'clinic-os-d2d1b',
      },
    })
  })

  // Intercept Internal Application API Routes
  await page.route('**/api/**', async (route: Route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname

    // Owner Login API
    if (path === '/api/auth/owner-login') {
      const isOwner = options.initialRole === 'owner'
      await route.fulfill({
        status: isOwner ? 200 : 200, // Permit mock owner login
        json: { success: true, email: 'yallacodex@gmail.com' },
      })
      return
    }

    // Clinic Staff Login API
    if (path === '/api/auth/login') {
      let body: any = {}
      try {
        body = request.postDataJSON() || {}
      } catch {}

      const reqEmail = (body.email || '').trim().toLowerCase()
      const reqSlug = body.slug || currentSlug
      const clinic = store.findClinicBySlug(reqSlug)

      if (!clinic) {
        await route.fulfill({ status: 404, json: { error: 'العيادة غير موجودة' } })
        return
      }

      if (reqEmail === clinic.doctorEmail.toLowerCase()) {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            token: `synth-token-doctor-${clinic.id}`,
            user: {
              role: 'doctor',
              name: clinic.doctorName,
              email: clinic.doctorEmail,
              clinicId: clinic.id,
            },
          },
        })
        return
      }

      if (reqEmail === clinic.assistantEmail.toLowerCase()) {
        await route.fulfill({
          status: 200,
          json: {
            success: true,
            token: `synth-token-assistant-${clinic.id}`,
            user: {
              role: 'assistant',
              name: 'مساعد العيادة (ألفا)',
              email: clinic.assistantEmail,
              clinicId: clinic.id,
              branchId: 'main',
              branchName: 'الفرع الرئيسي',
            },
          },
        })
        return
      }

      await route.fulfill({
        status: 401,
        json: { error: 'البريد الإلكتروني أو كلمة المرور غير صحيحة' },
      })
      return
    }

    // Patient Login API
    if (path === '/api/patient/login') {
      let body: any = {}
      try {
        body = request.postDataJSON() || {}
      } catch {}

      const reqPhone = (body.phone || '').trim()
      const reqSlug = body.slug || currentSlug
      const clinic = store.findClinicBySlug(reqSlug)

      if (!clinic) {
        await route.fulfill({ status: 404, json: { error: 'العيادة غير موجودة' } })
        return
      }

      // Find or auto-create patient account
      let patient = Array.from(store.patientAccounts.values()).find(
        (p) => p.clinic_id === clinic.id && p.phone === reqPhone
      )

      if (!patient) {
        patient = {
          id: `synth-patient-${Date.now()}`,
          clinic_id: clinic.id,
          name: 'مريض تجريبي جديد',
          phone: reqPhone,
        }
        store.patientAccounts.set(patient.id, patient)
      }

      await route.fulfill({
        status: 200,
        json: { success: true, patient },
      })
      return
    }

    // Public Clinic Booking API
    if (path === '/api/clinic/book') {
      let body: any = {}
      try {
        body = request.postDataJSON() || {}
      } catch {}

      const clinic = store.findClinicBySlug(body.slug || currentSlug)
      if (!clinic) {
        await route.fulfill({ status: 404, json: { error: 'العيادة غير موجودة' } })
        return
      }

      // Check suspension guard
      if (clinic.isActive === false || (clinic.expirationDate && new Date(clinic.expirationDate) < new Date())) {
        await route.fulfill({
          status: 403,
          json: { error: 'عذراً، هذه العيادة موقوفة حالياً ولا تستقبل حجوزات جديدة' },
        })
        return
      }

      const existingInClinic = store.getAppointmentsForClinic(clinic.id, body.date || todayDate)
      const maxQueue = existingInClinic.reduce((m, a) => Math.max(m, a.queue_number || 0), 0)
      const nextQueue = maxQueue + 1

      const newAppt: SyntheticAppointment = {
        id: `synth-appt-${Date.now()}`,
        clinic_id: clinic.id,
        branch_id: body.branch_id || 'main',
        branchName: body.branchName || 'الفرع الرئيسي',
        patientName: body.patientName || 'مريض تجريبي',
        phone: body.phone,
        age: body.age,
        gender: body.gender,
        serviceName: body.serviceName || 'كشف عادي',
        servicePrice: Number(body.servicePrice) || 250,
        originalPrice: Number(body.servicePrice) || 250,
        discountApplied: 0,
        netTotal: Number(body.servicePrice) || 250,
        date: body.date || todayDate,
        queue_number: nextQueue,
        status: 'waiting',
        paymentStatus: 'pending',
        paymentMethod: body.paymentMethod || 'cash',
        createdAt: new Date().toISOString(),
        invoiceNumber: `INV-${nextQueue.toString().padStart(3, '0')}`,
      }

      store.appointments.set(newAppt.id, newAppt)

      await route.fulfill({
        status: 200,
        json: {
          success: true,
          appointmentId: newAppt.id,
          queueNumber: nextQueue,
          appointment: newAppt,
        },
      })
      return
    }

    // Pass through any other routes
    await route.continue()
  })

  // Seed initial localStorage items based on role
  await page.addInitScript(
    ({ role, slug, clinicAlphaId }) => {
      if (role === 'owner') {
        localStorage.setItem('owner_auth', 'true')
      } else if (role === 'doctor') {
        localStorage.setItem('clinic_session_token', 'synth-token-doctor')
        localStorage.setItem('clinic_role', 'doctor')
      } else if (role === 'assistant') {
        localStorage.setItem('clinic_session_token', 'synth-token-assistant')
        localStorage.setItem('clinic_role', 'assistant')
        localStorage.setItem('clinic_selected_branch', 'main')
        localStorage.setItem('clinic_locked_branch', 'main')
        localStorage.setItem('clinic_locked_branch_name', 'الفرع الرئيسي')
      } else if (role === 'patient') {
        localStorage.setItem(
          'patient_auth',
          JSON.stringify({
            phone: '01012345678',
            name: 'سعيد محمد',
            clinic_id: clinicAlphaId,
            age: 42,
          })
        )
      }
    },
    {
      role: options.initialRole,
      slug: currentSlug,
      clinicAlphaId: SYNTHETIC_CLINIC_ALPHA.id,
    }
  )

  return store
}

/**
 * Setup and Teardown helpers for isolated synthetic fixtures
 */
export async function setupSyntheticClinics(): Promise<SyntheticStore> {
  const store = new SyntheticStore()
  return store
}

export async function teardownSyntheticClinics(store?: SyntheticStore): Promise<void> {
  if (store) {
    store.reset()
  }
}
