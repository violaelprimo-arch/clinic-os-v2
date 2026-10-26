'use client'

import React, { useState } from 'react'
import {
  Search,
  User,
  Users,
  Calendar,
  FileSignature,
  FileText,
  Clock,
  HeartPulse,
  AlertCircle,
  Plus,
  Phone,
  Eye,
  Check,
  ChevronRight,
  ChevronLeft,
  X,
  Stethoscope,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DemoPatient } from './types'
import { DemoClinicHookReturn } from './useDemoClinic'
import { useLanguage } from '@/context/LanguageContext'
import { toast } from 'sonner'

interface DemoPatientRecordsProps {
  demo: DemoClinicHookReturn
  onOpenPrescription: (patientName: string) => void
}

export function DemoPatientRecords({
  demo,
  onOpenPrescription,
}: DemoPatientRecordsProps) {
  const { isRtl } = useLanguage()
  const copy = (ar: string, en: string) => (isRtl ? ar : en)

  const [search, setSearch] = useState('')
  const [selectedPatient, setSelectedPatient] = useState<DemoPatient | null>(null)

  const filteredPatients = demo.patients.filter((p) => {
    if (!search.trim()) return true
    const q = search.trim().toLowerCase()
    return p.name.toLowerCase().includes(q) || p.phone.includes(q)
  })

  const handleBookNewVisit = (patient: DemoPatient) => {
    demo.bookAppointment({
      patientName: patient.name,
      phone: patient.phone,
      age: patient.age,
      serviceId: 'srv-1',
      notes: 'حجز مباشر من الملف الطبي',
    })
    toast.success(
      copy(
        `تم إضافة موعد جديد للمريض (${patient.name}) في قائمة اليوم 📅`,
        `New visit added for (${patient.name}) in today's queue 📅`,
      ),
    )
    setSelectedPatient(null)
    demo.setDoctorSubTab('dashboard')
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      {/* Header & Search */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h3 className="text-base font-black text-foreground">
            {copy('سجل ملفات المرضى والتاريخ الطبي', 'Patient Records & Medical History')}
          </h3>
          <p className="text-xs text-muted-foreground">
            {copy(
              'أرشيف رقمي يجمع الزيارات السابقة، والتشخيص، والروشتات، والحساسية الدوائية',
              'Digital archive connecting previous visits, diagnoses, prescriptions and drug allergies',
            )}
          </p>
        </div>

        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute start-3 top-2.5 size-3.5 text-muted-foreground" />
          <Input
            type="text"
            placeholder={copy('بحث باسم المريض أو الهاتف...', 'Search by patient name or phone...')}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 rounded-xl ps-9 text-xs"
          />
        </div>
      </div>

      {/* Patient Cards / Table */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
        {filteredPatients.length === 0 ? (
          <div className="col-span-2 py-12 text-center text-xs text-muted-foreground">
            {copy('لا توجد ملفات مطابقة للبحث', 'No patients matching search query')}
          </div>
        ) : (
          filteredPatients.map((patient) => {
            const hasAllergies =
              patient.allergies && !patient.allergies.includes('لا توجد')
            const patientPrescriptions = demo.prescriptions.filter(
              (rx) => rx.patientId === patient.id || rx.patientName === patient.name,
            )

            return (
              <div
                key={patient.id}
                onClick={() => setSelectedPatient(patient)}
                className="group relative cursor-pointer rounded-3xl border border-border/80 bg-card p-5 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary font-black text-base transition-transform group-hover:scale-105">
                      <User className="size-6" />
                    </span>
                    <div>
                      <h4 className="text-sm font-black text-foreground group-hover:text-primary transition-colors">
                        {patient.name}
                      </h4>
                      <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                        {patient.phone} • {patient.age} {copy('سنة', 'yrs')}
                      </p>
                    </div>
                  </div>

                  <Badge variant="outline" className="border-border text-[10px]">
                    {patient.visits.length + 1} {copy('زيارات', 'visits')}
                  </Badge>
                </div>

                {/* Tags */}
                <div className="mt-4 flex flex-wrap items-center gap-1.5">
                  {hasAllergies && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-rose-500/10 px-2 py-0.5 text-[10px] font-bold text-rose-600 dark:text-rose-400">
                      <AlertCircle className="size-3" />
                      {patient.allergies}
                    </span>
                  )}
                  {patient.chronicDiseases && (
                    <span className="inline-flex items-center gap-1 rounded-md bg-blue-500/10 px-2 py-0.5 text-[10px] font-bold text-blue-600 dark:text-blue-400">
                      <HeartPulse className="size-3" />
                      {patient.chronicDiseases}
                    </span>
                  )}
                </div>

                {/* Footer preview */}
                <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-3 text-[11px] text-muted-foreground">
                  <span>
                    {copy('آخر كشف:', 'Last visit:')} {patient.lastVisitDate}
                  </span>
                  <span className="inline-flex items-center gap-1 font-bold text-primary group-hover:translate-x-[-2px] transition-transform">
                    {copy('فتح الملف الطبي', 'Open Record')}
                    {isRtl ? <ChevronLeft className="size-3.5" /> : <ChevronRight className="size-3.5" />}
                  </span>
                </div>
              </div>
            )
          })
        )}
      </div>

      {/* Patient Medical Record Detail Modal */}
      <Dialog open={!!selectedPatient} onOpenChange={(open) => !open && setSelectedPatient(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto rounded-3xl p-6">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-black">
              <User className="size-5 text-primary" />
              <span>{copy('الملف الطبي المتكامل للمريض', 'Comprehensive Medical Record')}</span>
            </DialogTitle>
          </DialogHeader>

          {selectedPatient && (
            <div className="space-y-6 pt-2">
              {/* Profile Card */}
              <div className="rounded-2xl border border-border bg-muted/30 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-lg font-black text-foreground">
                      {selectedPatient.name}
                    </h3>
                    <p className="mt-0.5 text-xs text-muted-foreground font-mono">
                      {selectedPatient.phone} • {selectedPatient.age} {copy('سنة', 'years old')}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => {
                        onOpenPrescription(selectedPatient.name)
                        setSelectedPatient(null)
                      }}
                      className="gap-1.5 rounded-xl bg-primary font-bold text-white shadow-xs"
                    >
                      <FileSignature className="size-3.5" />
                      {copy('إصدار روشتة', 'New Rx')}
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => handleBookNewVisit(selectedPatient)}
                      className="gap-1.5 rounded-xl border-border"
                    >
                      <Plus className="size-3.5" />
                      {copy('حجز موعد', 'New Visit')}
                    </Button>
                  </div>
                </div>

                {/* Medical Alerts */}
                <div className="mt-4 grid gap-2 sm:grid-cols-2 text-xs">
                  <div className="rounded-xl border border-border/80 bg-background/60 p-2.5">
                    <span className="block font-bold text-rose-500">
                      {copy('الحساسية الدوائية:', 'Drug Allergies:')}
                    </span>
                    <span className="text-muted-foreground">
                      {selectedPatient.allergies || copy('لا توجد حساسية مسجلة', 'None recorded')}
                    </span>
                  </div>
                  <div className="rounded-xl border border-border/80 bg-background/60 p-2.5">
                    <span className="block font-bold text-blue-500">
                      {copy('الأمراض المزمنة:', 'Chronic Conditions:')}
                    </span>
                    <span className="text-muted-foreground">
                      {selectedPatient.chronicDiseases || copy('لا توجد', 'None')}
                    </span>
                  </div>
                </div>
              </div>

              {/* Past Visits History */}
              <div>
                <h4 className="text-sm font-black text-foreground">
                  {copy('سجل الزيارات والتشخيص السابق', 'Visit History & Diagnoses')}
                </h4>

                <div className="mt-3 space-y-3">
                  {selectedPatient.visits.length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-6 text-center text-xs text-muted-foreground">
                      {copy(
                        'لا توجد زيارات سابقة مسجلة لهذا المريض (أول زيارة اليوم)',
                        'No previous archived visits (First visit today)',
                      )}
                    </div>
                  ) : (
                    selectedPatient.visits.map((vis) => (
                      <div
                        key={vis.id}
                        className="rounded-2xl border border-border/70 bg-card p-4 text-xs space-y-1.5"
                      >
                        <div className="flex items-center justify-between text-muted-foreground">
                          <span className="font-bold text-foreground">{vis.serviceName}</span>
                          <span className="font-mono">{vis.date}</span>
                        </div>
                        <div className="text-foreground">
                          <strong className="text-primary">{copy('التشخيص: ', 'Diagnosis: ')}</strong>
                          {vis.diagnosis}
                        </div>
                        {vis.notes && (
                          <div className="text-muted-foreground">
                            <strong>{copy('الإرشادات: ', 'Instructions: ')}</strong>
                            {vis.notes}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Prescriptions issued to this patient */}
              <div>
                <h4 className="text-sm font-black text-foreground">
                  {copy('الروشتات الطبية الصادرة', 'Prescriptions Issued')}
                </h4>

                <div className="mt-3 space-y-3">
                  {demo.prescriptions.filter(
                    (rx) =>
                      rx.patientId === selectedPatient.id ||
                      rx.patientName === selectedPatient.name,
                  ).length === 0 ? (
                    <div className="rounded-2xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                      {copy('لم تصدر روشتات إلكترونية بعد', 'No prescriptions issued yet')}
                    </div>
                  ) : (
                    demo.prescriptions
                      .filter(
                        (rx) =>
                          rx.patientId === selectedPatient.id ||
                          rx.patientName === selectedPatient.name,
                      )
                      .map((rx) => (
                        <div
                          key={rx.id}
                          className="rounded-2xl border border-primary/20 bg-primary/5 p-4 text-xs space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-primary">
                              {copy('روشتة طبية', 'Prescription')} • {rx.date}
                            </span>
                            <span className="font-mono text-muted-foreground">
                              {rx.drugs.length} {copy('أصناف علاجية', 'medications')}
                            </span>
                          </div>
                          <p className="text-foreground">
                            <strong>{copy('التشخيص: ', 'Diagnosis: ')}</strong> {rx.diagnosis}
                          </p>
                          <ul className="list-disc ps-4 space-y-1 text-muted-foreground">
                            {rx.drugs.map((d, i) => (
                              <li key={i}>
                                <strong className="text-foreground">{d.name}</strong> — {d.dosage}{' '}
                                ({d.duration})
                              </li>
                            ))}
                          </ul>
                        </div>
                      ))
                  )}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
