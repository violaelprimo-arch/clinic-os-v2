const fs = require('fs');
let c = fs.readFileSync('src/app/clinic/[slug]/admin/patients/[patientId]/page.tsx', 'utf8');

// 1. Remove floating tabs from the UI completely
const tabsFind = `<div className="flex overflow-x-auto hide-scrollbar gap-2 pb-2">
        {[
          { id: 'summary', label: 'ملخص الحالة', icon: Activity },
          { id: 'visits', label: 'سجل الزيارات', icon: Clock },
          { id: 'diagnoses', label: 'التشخيصات', icon: Stethoscope },
          { id: 'meds', label: 'الأدوية الحالية', icon: Pill },
          { id: 'prescriptions', label: 'الروشتات', icon: FileText },
          { id: 'payments', label: 'المدفوعات', icon: DollarSign },
          { id: 'notes', label: 'ملاحظات', icon: StickyNote },
        ].map(t => (
          <Button
            key={t.id}
            variant={activeTab === t.id ? 'default' : 'outline'}
            onClick={() => setActiveTab(t.id as any)}
            className={\`shrink-0 h-10 rounded-xl text-xs font-bold \${activeTab === t.id ? 'bg-[#182230] text-white hover:bg-[#182230]/90' : 'text-slate-600 bg-white border-[#E5EAF0]'}\`}
          >
            <t.icon className="w-4 h-4 ml-1.5" />
            {t.label}
          </Button>
        ))}
      </div>`;
      
// If 'Stethoscope' is not defined, we might need a fallback regex search. I'll just write a script that rewrites the whole tab rendering area.
