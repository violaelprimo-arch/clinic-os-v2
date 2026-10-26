'use client'

import { useState, useCallback, useMemo } from 'react'
import {
  DemoAppointment,
  DemoPatient,
  DemoPrescription,
  DemoService,
  DemoClinicInfo,
  DemoPlatformTab,
  DemoDoctorSubTab,
  DemoPaymentMethod,
} from './types'

export const DEMO_CLINIC_INFO: DemoClinicInfo = {
  clinicName: 'عيادة د. سارة الأحمدي',
  clinicNameEn: 'Dr. Sarah Al-Ahmadi Eye Clinic',
  doctorName: 'د. سارة الأحمدي',
  doctorNameEn: 'Dr. Sarah Al-Ahmadi',
  specialty: 'استشاري طب وجراحة العيون والليزك وزراعة العدسات',
  specialtyEn: 'Consultant Ophthalmologist, LASIK & Refractive Surgery',
  phone: '01001234567',
  address: 'شارع الثورة، مصر الجديدة، القاهرة (بجوار محطة الأهرام)',
  addressEn: 'Al-Thawra St., Heliopolis, Cairo (Near Al-Ahram Station)',
  primaryColor: '#087CF4',
  rating: 4.9,
  reviewsCount: 184,
}

export const DEMO_SERVICES: DemoService[] = [
  {
    id: 'srv-1',
    name: 'كشف عيون عادي وتحديد مقاس نظارة',
    nameEn: 'Comprehensive Eye Exam & Refraction',
    price: 250,
    duration: '15 دقيقة',
    desc: 'فحص حدة الإبصار وقاع العين وقياس ضغط العين والعدسات',
    descEn: 'Visual acuity, fundus, intraocular pressure & lens prescription',
  },
  {
    id: 'srv-2',
    name: 'فحص قاع عين وكشف كونسلتو',
    nameEn: 'Fundus Exam & Consultative Visit',
    price: 400,
    duration: '25 دقيقة',
    desc: 'فحص ميكروسكوبي دقيق للشبكية والعصب البصري',
    descEn: 'Microscopic evaluation of retina and optic nerve',
  },
  {
    id: 'srv-3',
    name: 'فحص ليزك وتصحيح إبصار',
    nameEn: 'Femto-LASIK Vision Correction Assessment',
    price: 500,
    duration: '30 دقيقة',
    desc: 'طبوجرافيا القرنية وتحديد أحدث تقنية مناسبة للعين',
    descEn: 'Corneal topography and personalized laser mapping',
  },
  {
    id: 'srv-4',
    name: 'استشارة ومتابعة بعد العملية',
    nameEn: 'Post-op Follow-up & Review',
    price: 150,
    duration: '10 دقائق',
    desc: 'متابعة استقرار النظر وضبط العلاجات الدوائية',
    descEn: 'Vision stability assessment and medication adjustments',
  },
]

const INITIAL_PATIENTS: DemoPatient[] = [
  {
    id: 'pat-1',
    name: 'أحمد محمود إبراهيم',
    phone: '01011223344',
    age: 42,
    gender: 'male',
    allergies: 'لا توجد حساسية دوائية معروفة',
    chronicDiseases: 'إجهاد بصري رقمي مزمن وجفاف العين',
    lastVisitDate: '2026-10-26',
    visits: [
      {
        id: 'vis-1',
        date: '2026-08-14',
        serviceName: 'كشف عيون عادي',
        diagnosis: 'قصر نظر خفيف مع استجماتيزم وجفاف القرنية',
        notes: 'تم وصف نظارة للقراءة وقطرات ترطيب، استجابة جيدة',
        doctorName: 'د. سارة الأحمدي',
        prescriptionId: 'rx-init-1',
      },
    ],
  },
  {
    id: 'pat-2',
    name: 'مريم مصطفى كمال',
    phone: '01122334455',
    age: 28,
    gender: 'female',
    allergies: 'حساسية من مركبات البنسلين',
    chronicDiseases: 'جفاف قرنية موسمي',
    lastVisitDate: '2026-10-26',
    visits: [
      {
        id: 'vis-2',
        date: '2026-09-02',
        serviceName: 'استشارة فحص ليزك',
        diagnosis: 'سمك القرنية مناسب لإجراء الفيمتو ليزك',
        notes: 'تم تحديد موعد الإجراء والتأكد من استقرار المقاسات',
        doctorName: 'د. سارة الأحمدي',
      },
    ],
  },
  {
    id: 'pat-3',
    name: 'عصام عبد الله علي',
    phone: '01233445566',
    age: 56,
    gender: 'male',
    allergies: 'لا توجد',
    chronicDiseases: 'ضغط عين مرتفع (مستقر تحت العلاج)',
    lastVisitDate: '2026-07-10',
    visits: [
      {
        id: 'vis-3',
        date: '2026-07-10',
        serviceName: 'فحص قاع عين',
        diagnosis: 'متابعة دورية للشبكية وضغط العين',
        notes: 'ضغط العين 15 مم زئبق، الحالة مستقرة',
        doctorName: 'د. سارة الأحمدي',
      },
    ],
  },
  {
    id: 'pat-4',
    name: 'هدى سعيد حسنين',
    phone: '01555667788',
    age: 35,
    gender: 'female',
    allergies: 'حساسية السلفا',
    chronicDiseases: 'صداع نصفي متكرر',
    lastVisitDate: '2026-06-20',
    visits: [],
  },
]

const INITIAL_APPOINTMENTS: DemoAppointment[] = [
  {
    id: 'apt-101',
    queue_number: 101,
    patientId: 'pat-1',
    patientName: 'أحمد محمود إبراهيم',
    phone: '01011223344',
    age: 42,
    serviceId: 'srv-1',
    serviceName: 'كشف عيون عادي وتحديد مقاس نظارة',
    servicePrice: 250,
    status: 'completed',
    paymentStatus: 'paid',
    paymentMethod: 'cash',
    time: '04:30 م',
    date: '2026-10-26',
    diagnosis: 'قصر نظر خفيف (-1.5) مع إجهاد بصري وجفاف',
    notes: 'تم فحص قاع العين ووصف قطرات الترطيب ونظارة الحماية',
  },
  {
    id: 'apt-102',
    queue_number: 102,
    patientId: 'pat-2',
    patientName: 'مريم مصطفى كمال',
    phone: '01122334455',
    age: 28,
    serviceId: 'srv-3',
    serviceName: 'فحص ليزك وتصحيح إبصار',
    servicePrice: 500,
    status: 'in_progress',
    paymentStatus: 'paid',
    paymentMethod: 'vodafone_cash',
    time: '05:00 م',
    date: '2026-10-26',
    examinationStartedAt: Date.now() - 8 * 60 * 1000, // 8 minutes ago
  },
  {
    id: 'apt-103',
    queue_number: 103,
    patientId: 'pat-3',
    patientName: 'عصام عبد الله علي',
    phone: '01233445566',
    age: 56,
    serviceId: 'srv-2',
    serviceName: 'فحص قاع عين وكشف كونسلتو',
    servicePrice: 400,
    status: 'waiting',
    paymentStatus: 'pending',
    time: '05:30 م',
    date: '2026-10-26',
  },
  {
    id: 'apt-104',
    queue_number: 104,
    patientId: 'pat-4',
    patientName: 'هدى سعيد حسنين',
    phone: '01555667788',
    age: 35,
    serviceId: 'srv-4',
    serviceName: 'استشارة ومتابعة بعد العملية',
    servicePrice: 150,
    status: 'waiting',
    paymentStatus: 'pending',
    time: '06:00 م',
    date: '2026-10-26',
  },
]

const INITIAL_PRESCRIPTIONS: DemoPrescription[] = [
  {
    id: 'rx-init-1',
    appointmentId: 'apt-101',
    patientId: 'pat-1',
    patientName: 'أحمد محمود إبراهيم',
    age: 42,
    date: '2026-10-26',
    diagnosis: 'جفاف القرنية المزمن وإجهاد بصري رقمي',
    instructions: 'تجنب شاشات الهاتف في الظلام، واستخدام قطرة الترطيب بانتظام',
    drugs: [
      {
        name: 'Systane Ultra Eye Drops',
        dosage: 'نقطة واحدة في كل عين 3 مرات يومياً',
        duration: 'شهر كامل',
        notes: 'قطرة ترطيب خالية من المواد الحافظة',
      },
      {
        name: 'Nevanac 0.1% Eye Drops',
        dosage: 'نقطة واحدة مرتين يومياً',
        duration: '5 أيام فقط',
        notes: 'مضاد للالتهاب والتهيج السطحي',
      },
    ],
  },
]

export function useDemoClinic() {
  const [platformTab, setPlatformTab] = useState<DemoPlatformTab>('doctor')
  const [doctorSubTab, setDoctorSubTab] = useState<DemoDoctorSubTab>('dashboard')
  const [appointments, setAppointments] = useState<DemoAppointment[]>(INITIAL_APPOINTMENTS)
  const [patients, setPatients] = useState<DemoPatient[]>(INITIAL_PATIENTS)
  const [prescriptions, setPrescriptions] = useState<DemoPrescription[]>(INITIAL_PRESCRIPTIONS)
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null)
  const [lastBookedTicket, setLastBookedTicket] = useState<DemoAppointment | null>(null)

  // Derived state
  const currentInExam = useMemo(() => {
    return appointments.find((a) => a.status === 'in_progress') || null
  }, [appointments])

  const nextWaiting = useMemo(() => {
    const waiting = appointments
      .filter((a) => a.status === 'waiting')
      .sort((a, b) => a.queue_number - b.queue_number)
    return waiting[0] || null
  }, [appointments])

  const waitingList = useMemo(() => {
    return appointments
      .filter((a) => a.status === 'waiting')
      .sort((a, b) => a.queue_number - b.queue_number)
  }, [appointments])

  const completedList = useMemo(() => {
    return appointments.filter((a) => a.status === 'completed')
  }, [appointments])

  const skippedList = useMemo(() => {
    return appointments.filter((a) => a.status === 'skipped')
  }, [appointments])

  // Financial calculations
  const totalRevenue = useMemo(() => {
    return appointments
      .filter((a) => a.paymentStatus === 'paid')
      .reduce((sum, a) => sum + (a.servicePrice || 0), 0)
  }, [appointments])

  const pendingRevenue = useMemo(() => {
    return appointments
      .filter((a) => a.paymentStatus === 'pending')
      .reduce((sum, a) => sum + (a.servicePrice || 0), 0)
  }, [appointments])

  const cashRevenue = useMemo(() => {
    return appointments
      .filter((a) => a.paymentStatus === 'paid' && a.paymentMethod === 'cash')
      .reduce((sum, a) => sum + (a.servicePrice || 0), 0)
  }, [appointments])

  const digitalRevenue = useMemo(() => {
    return appointments
      .filter(
        (a) =>
          a.paymentStatus === 'paid' &&
          (a.paymentMethod === 'vodafone_cash' || a.paymentMethod === 'card'),
      )
      .reduce((sum, a) => sum + (a.servicePrice || 0), 0)
  }, [appointments])

  // Actions
  const bookAppointment = useCallback(
    (data: {
      patientName: string
      phone: string
      age: number
      serviceId: string
      notes?: string
    }): DemoAppointment => {
      const service =
        DEMO_SERVICES.find((s) => s.id === data.serviceId) || DEMO_SERVICES[0]
      const maxQueue = appointments.reduce(
        (max, a) => Math.max(max, a.queue_number),
        100,
      )
      const newQueueNumber = maxQueue + 1

      // Match or create patient
      let patient = patients.find(
        (p) => p.phone === data.phone || p.name.trim() === data.patientName.trim(),
      )
      const patientId = patient ? patient.id : `pat-${Date.now()}`

      if (!patient) {
        patient = {
          id: patientId,
          name: data.patientName.trim(),
          phone: data.phone.trim(),
          age: Number(data.age) || 30,
          gender: 'male',
          lastVisitDate: '2026-10-26',
          visits: [],
        }
        setPatients((prev) => [patient!, ...prev])
      }

      const now = new Date()
      const timeStr = `${String(now.getHours() % 12 || 12).padStart(2, '0')}:${String(
        now.getMinutes(),
      ).padStart(2, '0')} ${now.getHours() >= 12 ? 'م' : 'ص'}`

      const newAppt: DemoAppointment = {
        id: `apt-${Date.now()}`,
        queue_number: newQueueNumber,
        patientId,
        patientName: data.patientName.trim(),
        phone: data.phone.trim(),
        age: Number(data.age) || 30,
        serviceId: service.id,
        serviceName: service.name,
        servicePrice: service.price,
        status: 'waiting',
        paymentStatus: 'pending',
        time: timeStr,
        date: '2026-10-26',
        notes: data.notes || '',
      }

      setAppointments((prev) => [...prev, newAppt])
      setLastBookedTicket(newAppt)
      return newAppt
    },
    [appointments, patients],
  )

  const startExamination = useCallback((appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) => {
        if (a.id === appointmentId) {
          return {
            ...a,
            status: 'in_progress',
            examinationStartedAt: Date.now(),
          }
        }
        // If another was in progress, complete it or keep it
        if (a.status === 'in_progress') {
          return {
            ...a,
            status: 'completed',
            paymentStatus: 'paid',
            paymentMethod: a.paymentMethod || 'cash',
          }
        }
        return a
      }),
    )
  }, [])

  const completeExamination = useCallback(
    (appointmentId: string, paymentMethod: DemoPaymentMethod = 'cash') => {
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id === appointmentId) {
            return {
              ...a,
              status: 'completed',
              paymentStatus: 'paid',
              paymentMethod,
            }
          }
          return a
        }),
      )
    },
    [],
  )

  const skipAppointment = useCallback((appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: 'skipped' } : a)),
    )
  }, [])

  const reinstateAppointment = useCallback((appointmentId: string) => {
    setAppointments((prev) =>
      prev.map((a) => (a.id === appointmentId ? { ...a, status: 'waiting' } : a)),
    )
  }, [])

  const collectPayment = useCallback(
    (appointmentId: string, paymentMethod: DemoPaymentMethod = 'cash') => {
      setAppointments((prev) =>
        prev.map((a) => {
          if (a.id === appointmentId) {
            return {
              ...a,
              paymentStatus: 'paid',
              paymentMethod,
            }
          }
          return a
        }),
      )
    },
    [],
  )

  const savePrescription = useCallback(
    (rxData: Omit<DemoPrescription, 'id'>) => {
      const newRx: DemoPrescription = {
        ...rxData,
        id: `rx-${Date.now()}`,
      }

      setPrescriptions((prev) => [newRx, ...prev])

      // Also append visit to patient's record
      setPatients((prev) =>
        prev.map((p) => {
          if (p.id === rxData.patientId || p.name === rxData.patientName) {
            const newVisit = {
              id: `vis-${Date.now()}`,
              date: rxData.date,
              serviceName: 'كشف ومتابعة طبية',
              diagnosis: rxData.diagnosis,
              notes: rxData.instructions,
              doctorName: DEMO_CLINIC_INFO.doctorName,
              prescriptionId: newRx.id,
            }
            return {
              ...p,
              lastVisitDate: rxData.date,
              visits: [newVisit, ...p.visits],
            }
          }
          return p
        }),
      )

      return newRx
    },
    [],
  )

  const resetDemo = useCallback(() => {
    setAppointments(JSON.parse(JSON.stringify(INITIAL_APPOINTMENTS)))
    setPatients(JSON.parse(JSON.stringify(INITIAL_PATIENTS)))
    setPrescriptions(JSON.parse(JSON.stringify(INITIAL_PRESCRIPTIONS)))
    setSelectedPatientId(null)
    setLastBookedTicket(null)
    setPlatformTab('doctor')
    setDoctorSubTab('dashboard')
  }, [])

  return {
    clinicInfo: DEMO_CLINIC_INFO,
    services: DEMO_SERVICES,
    platformTab,
    setPlatformTab,
    doctorSubTab,
    setDoctorSubTab,
    appointments,
    patients,
    prescriptions,
    selectedPatientId,
    setSelectedPatientId,
    lastBookedTicket,
    currentInExam,
    nextWaiting,
    waitingList,
    completedList,
    skippedList,
    totalRevenue,
    pendingRevenue,
    cashRevenue,
    digitalRevenue,
    bookAppointment,
    startExamination,
    completeExamination,
    skipAppointment,
    reinstateAppointment,
    collectPayment,
    savePrescription,
    resetDemo,
  }
}

export type DemoClinicHookReturn = ReturnType<typeof useDemoClinic>
