import { readFileSync, writeFileSync } from 'fs';

const filePath = 'src/app/clinic/[slug]/admin/patients/[patientId]/PatientProfileClient.tsx';
let content = readFileSync(filePath, 'utf8');

// Normalize line endings to \n first
content = content.replace(/\r\n/g, '\n');

const targetOld = `        if (!phone) {
          setAppointments([])
          setLoading(false)
          return
        }

        const searchPhones = getPhoneSearchVariants(phone).slice(0, 10)
        const phoneVariants = searchPhones.length > 0 ? searchPhones : [phone]

        const qAppt = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', cData.id),
          where('phone', 'in', phoneVariants)
        )
        unsub = onSnapshot(qAppt, (snap) => {
          if (cancelled) return
          if (!snap.empty) {
            const appts = snap.docs
              .map(d => ({ id: d.id, ...d.data() } as any))
              .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())
            setAppointments(appts)

            const latest = appts[0]
            setPatientData({
              name: latest.patientName || 'مريض بدون اسم',
              age: latest.age || '',
              dob: latest.dob || '',
              phone: latest.phone || phone,
              residence: latest.patientResidenceSnapshot || latest.residence || null
            })
          } else {
            setAppointments([])
            setPatientData({
              name: 'سجل جديد',
              age: '',
              dob: '',
              phone
            })
          }
          setLoading(false)
        })
      } catch (err) {
        console.error('Error loading patient profile:', err)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [slug, phone])`;

const replacementNew = `        let resolvedPhone = rawDecodedId
        let resolvedName = targetNameParam
        let specificAppointment: any = null

        // Support opening by appointmentId directly or resolving family member
        const candidateApptId = appointmentIdParam || (rawDecodedId && !rawDecodedId.startsWith('+') && !/^\\d{8,15}$/.test(rawDecodedId) ? rawDecodedId : null)

        if (candidateApptId) {
          try {
            const aSnap = await getDoc(doc(db, 'appointments', candidateApptId))
            if (aSnap.exists()) {
              specificAppointment = { id: aSnap.id, ...aSnap.data() }
              if (specificAppointment.phone) resolvedPhone = specificAppointment.phone
              if (specificAppointment.patientName) resolvedName = specificAppointment.patientName
            }
          } catch (e) {
            console.error('Error fetching specific appointment:', e)
          }
        }

        if (!resolvedPhone && phoneParam) {
          resolvedPhone = phoneParam
        }

        if (!resolvedPhone) {
          setAppointments([])
          setLoading(false)
          return
        }

        const searchPhones = getPhoneSearchVariants(resolvedPhone).slice(0, 10)
        const phoneVariants = searchPhones.length > 0 ? searchPhones : [resolvedPhone]

        const qAppt = query(
          collection(db, 'appointments'),
          where('clinic_id', '==', cData.id),
          where('phone', 'in', phoneVariants)
        )
        unsub = onSnapshot(qAppt, (snap) => {
          if (cancelled) return
          if (!snap.empty) {
            let appts = snap.docs
              .map(d => ({ id: d.id, ...d.data() } as any))
              .sort((a: any, b: any) => new Date(b.date || b.createdAt).getTime() - new Date(a.date || a.createdAt).getTime())

            // Disambiguate patients who share the same phone number
            if (resolvedName) {
              const normTarget = resolvedName.trim().toLowerCase()
              const nameFiltered = appts.filter(a => (a.patientName || '').trim().toLowerCase() === normTarget)
              if (nameFiltered.length > 0) {
                appts = nameFiltered
              }
            }

            setAppointments(appts)

            const target = specificAppointment || appts[0]
            setPatientData({
              name: target.patientName || resolvedName || 'مريض بدون اسم',
              age: target.age || '',
              dob: target.dob || '',
              phone: target.phone || resolvedPhone,
              residence: target.patientResidenceSnapshot || target.residence || null
            })
          } else {
            setAppointments([])
            setPatientData({
              name: resolvedName || 'سجل جديد',
              age: '',
              dob: '',
              phone: resolvedPhone
            })
          }
          setLoading(false)
        })
      } catch (err) {
        console.error('Error loading patient profile:', err)
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
      if (unsub) unsub()
    }
  }, [slug, rawDecodedId, appointmentIdParam, targetNameParam])`;

if (!content.includes(targetOld)) {
  console.error('Target old not found in content!');
  process.exit(1);
}

content = content.replace(targetOld, replacementNew);
writeFileSync(filePath, content, 'utf8');
console.log('Successfully patched PatientProfileClient.tsx!');
