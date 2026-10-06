const fs = require('fs');
let content = fs.readFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', 'utf8');

const logicToAdd = `
  const handleDeleteAllPatients = async () => {
    if (!confirm('هل أنت متأكد من حذف جميع المرضى من السجل بشكل نهائي؟ لا يمكن التراجع عن هذا الإجراء.')) return
    if (!confirm('تأكيد أخير: هل تريد مسح كل السجلات فعلاً؟')) return

    try {
      if (clinicId) {
        const { deleteDoc, doc } = await import('firebase/firestore')
        const q = query(collection(db, 'appointments'), where('clinic_id', '==', clinicId))
        const snap = await getDocs(q)
        for (const document of snap.docs) {
          await deleteDoc(doc(db, 'appointments', document.id))
        }
      }
      setPatients([])
      toast.success('تم مسح جميع المرضى من السجل بنجاح')
    } catch (err) {
      toast.error('حدث خطأ أثناء المسح')
    }
  }
`;

content = content.replace("const handleDeletePatient", logicToAdd + "\n  const handleDeletePatient");

const uiToReplace = `{/* Add Patient Modal */}
        <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>`;

const uiToAdd = `<div className="flex flex-wrap items-center gap-2">
          <Button 
            variant="destructive"
            onClick={handleDeleteAllPatients}
            className="h-10 px-4 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-md shadow-rose-500/20 transition-all text-xs inline-flex items-center justify-center cursor-pointer"
          >
            <Trash2 className="w-4 h-4 ml-1.5" />
            مسح جميع المرضى
          </Button>
          
          {/* Add Patient Modal */}
          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>`;

content = content.replace(uiToReplace, uiToAdd);

// Close the div we opened around the buttons:
// The original was:
//           <DialogTrigger className="...">
//             ...
//             إضافة مريض جديد
//           </DialogTrigger>
// Let's replace the </DialogTrigger> to add the closing div for `flex flex-wrap items-center gap-2`
content = content.replace("</DialogTrigger>", "</DialogTrigger>\n          </div>");

fs.writeFileSync('src/app/clinic/[slug]/admin/patients/page.tsx', content);
