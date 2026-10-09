const fs = require('fs');

const rFile = 'src/app/clinic/[slug]/admin/prescriptions/page.tsx';
let rContent = fs.readFileSync(rFile, 'utf8');

const oldHandleSave = `const handleSave = async () => {
    if (!patientName.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!patientPhone.trim()) return toast.error('يرجى إدخال رقم هاتف المريض للربط بملفه')

    setIsSaving(true)
    try {
      if (clinicId) {
        await addDoc(collection(db, 'prescriptions'), {
          clinic_id: clinicId,
          patientName,
          patientPhone,
          age,
          diagnosis,
          date: dateStr,
          drugs: drugs.filter(d => d.name.trim() !== ''),
          createdAt: new Date().toISOString()
        })
      }
      toast.success('تم حفظ الروشتة وإضافتها لملف المريض بنجاح')
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الروشتة')
    } finally {
      setIsSaving(false)
    }
  }`;

const newHandleSave = `const handleSave = async () => {
    if (!patientName.trim()) return toast.error('يرجى إدخال اسم المريض')
    if (!patientPhone.trim()) return toast.error('يرجى إدخال رقم هاتف المريض للربط بملفه')

    setIsSaving(true)
    try {
      if (clinicId) {
        const filteredDrugs = drugs.filter(d => d.name.trim() !== '');
        await addDoc(collection(db, 'prescriptions'), {
          clinic_id: clinicId,
          patientName,
          patientPhone,
          age,
          diagnosis,
          date: dateStr,
          drugs: filteredDrugs,
          createdAt: new Date().toISOString()
        })

        const apptId = searchParams?.get('appointmentId');
        if (apptId) {
          await updateDoc(doc(db, 'appointments', apptId), {
            diagnosis: diagnosis,
            drugs: filteredDrugs
          });
        }
      }
      toast.success('تم حفظ الروشتة وإضافتها لملف المريض بنجاح')
    } catch (error) {
      toast.error('حدث خطأ أثناء حفظ الروشتة')
    } finally {
      setIsSaving(false)
    }
  }`;

rContent = rContent.replace(oldHandleSave, newHandleSave);
fs.writeFileSync(rFile, rContent);
