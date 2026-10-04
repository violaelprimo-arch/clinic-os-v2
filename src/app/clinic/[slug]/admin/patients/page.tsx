'use client'

import { use, useEffect, useState } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, UserPlus, Phone, Activity, Clock, MessageCircle } from 'lucide-react'
import Link from 'next/link'
import { db } from '@/lib/firebase'
import { collection, query, where, getDocs } from 'firebase/firestore'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'

export default function PatientsPage({ params }: { params: Promise<{ slug: string }> }) {
  const resolvedParams = use(params)
  const slug = resolvedParams.slug
  const [patients, setPatients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        // First get clinic ID
        const clinicQ = query(collection(db, 'clinics'), where('slug', '==', slug))
        const clinicSnap = await getDocs(clinicQ)
        if (clinicSnap.empty) return
        const clinicId = clinicSnap.docs[0].id

        // Then get all appointments for this clinic
        const apptQ = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId))
        const apptSnap = await getDocs(apptQ)
        
        // Group by phone number to create unique patients list
        const patientMap = new Map()
        apptSnap.docs.forEach(doc => {
          const data = doc.data()
          if (!data.phone) return
          if (!patientMap.has(data.phone)) {
            patientMap.set(data.phone, {
              id: data.phone,
              name: data.patientName,
              phone: data.phone,
              visitsCount: 1,
              lastVisit: data.date,
              lastService: data.serviceName
            })
          } else {
            const existing = patientMap.get(data.phone)
            existing.visitsCount += 1
            // update last visit if this one is newer
            if (new Date(data.date) > new Date(existing.lastVisit)) {
              existing.lastVisit = data.date
              existing.lastService = data.serviceName
            }
          }
        })

        setPatients(Array.from(patientMap.values()).sort((a, b) => new Date(b.lastVisit).getTime() - new Date(a.lastVisit).getTime()))
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }
    fetchPatients()
  }, [slug])

  const filtered = patients.filter(p => p.name.includes(search) || p.phone.includes(search))

  const sendWhatsApp = (phone: string, name: string) => {
    if (!phone) return
    let formattedPhone = phone.replace(/[^0-9]/g, '')
    if (formattedPhone.startsWith('0')) formattedPhone = '2' + formattedPhone
    const message = encodeURIComponent(`مرحباً ${name}،\nنتمنى لك دوام الصحة والعافية..`)
    window.open(`https://wa.me/${formattedPhone}?text=${message}`, '_blank')
  }

  return (
    <div className="p-6 md:p-8 space-y-6 max-w-6xl mx-auto" dir="rtl">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-primary">سجل المرضى</h1>
          <p className="text-gray-500">تم تجميع بيانات المرضى تلقائياً من حجوزات العيادة السابقة</p>
        </div>
      </div>

      <Card className="shadow-sm border-t-4 border-t-primary">
        <CardHeader className="bg-slate-50/50 border-b">
          <div className="flex flex-col md:flex-row gap-4 items-center justify-between">
            <CardTitle className="text-xl text-slate-800">قائمة المرضى ({patients.length})</CardTitle>
            <div className="relative w-full md:w-96">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
              <Input 
                className="pr-10 h-12 bg-white" 
                placeholder="ابحث بالاسم أو رقم التليفون..." 
                value={search}
                onChange={e => setSearch(e.target.value)}
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-12 text-center text-slate-500">جاري تحميل السجل...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-slate-500">لا يوجد مرضى مطابقين للبحث</div>
          ) : (
            <div className="divide-y">
              {filtered.map((patient) => (
                <div key={patient.id} className="p-4 md:p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 hover:bg-slate-50 transition-colors">
                  <Link href={`/clinic/${slug}/admin/patients/${patient.phone}`} className="flex-1 cursor-pointer">
                    <div className="flex items-center gap-4">
                      <Avatar className="w-14 h-14 bg-primary/10 text-primary border border-primary/20">
                        <AvatarFallback className="font-bold text-xl">{patient.name.charAt(0)}</AvatarFallback>
                      </Avatar>
                      <div>
                        <h3 className="font-bold text-lg text-slate-900 group-hover:text-primary transition-colors">{patient.name}</h3>
                        <div className="flex items-center gap-3 text-sm text-slate-500 mt-1">
                          <span className="flex items-center gap-1"><Phone className="w-4 h-4" /> {patient.phone}</span>
                        </div>
                      </div>
                    </div>
                  </Link>
                  
                  <div className="flex flex-wrap md:flex-nowrap items-center gap-4 md:gap-8 w-full md:w-auto">
                    <div className="text-center bg-slate-100 p-2 rounded-lg px-4 cursor-pointer" onClick={() => window.location.href=`/clinic/${slug}/admin/patients/${patient.phone}`}>
                      <p className="text-xs text-slate-500 font-bold mb-1">عدد الزيارات</p>
                      <p className="font-black text-slate-700">{patient.visitsCount}</p>
                    </div>
                    <div className="text-right cursor-pointer" onClick={() => window.location.href=`/clinic/${slug}/admin/patients/${patient.phone}`}>
                      <p className="text-xs text-slate-500 font-bold mb-1">آخر كشف</p>
                      <p className="text-sm font-semibold">{patient.lastVisit}</p>
                      <p className="text-xs text-primary">{patient.lastService}</p>
                    </div>
                    <Button variant="outline" className="text-green-600 border-green-200 hover:bg-green-50 w-full md:w-auto mt-2 md:mt-0" onClick={(e) => {
                      e.stopPropagation();
                      sendWhatsApp(patient.phone, patient.name)
                    }}>
                      <MessageCircle className="w-4 h-4 ml-2" /> مراسلة
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
