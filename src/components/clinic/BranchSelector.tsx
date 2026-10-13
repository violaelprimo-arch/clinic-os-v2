'use client'

import { useEffect, useState } from 'react'
import { Building2, ChevronDown, Check, Plus, MapPin } from 'lucide-react'
import { Branch } from '@/types/clinic'
import { getClinicBranches, ensureClinicHasMainBranch } from '@/lib/branchService'
import Link from 'next/link'

export function BranchSelector({
  clinic,
  selectedBranchId,
  onSelectBranch
}: {
  clinic: any
  selectedBranchId: string // 'all' or branch id
  onSelectBranch: (branchId: string) => void
}) {
  const [branches, setBranches] = useState<Branch[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!clinic?.id && !clinic?.slug) return
    const clinicId = clinic.id || clinic.slug

    const fetchBranches = async () => {
      try {
        await ensureClinicHasMainBranch(clinic)
        const list = await getClinicBranches(clinicId)
        setBranches(list.filter((b) => !b.isArchived))
      } catch (err) {
        console.error('Error fetching branches for selector:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchBranches()
  }, [clinic])

  const currentBranch = branches.find((b) => b.id === selectedBranchId)

  return (
    <div className="relative inline-block text-right" dir="rtl">
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 px-3.5 rounded-xl bg-white border border-[#E5EAF0] text-slate-700 hover:border-[#15B8A6] flex items-center gap-2.5 shadow-2xs transition-all cursor-pointer font-bold text-xs"
      >
        <div className="w-6 h-6 rounded-lg bg-teal-50 text-[#15B8A6] flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="text-right">
          <span className="text-[10px] text-slate-400 block leading-tight font-medium">الفرع المحدد</span>
          <span className="text-xs text-[#182230] font-black truncate max-w-[130px] block">
            {selectedBranchId === 'all'
              ? `جميع الفروع (${branches.length})`
              : currentBranch?.name || 'الفرع الرئيسي'}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 mt-2 w-64 bg-white border border-[#E5EAF0] rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in-50">
            <div className="px-3 py-2 text-[10px] font-bold text-slate-400 border-b border-slate-100 uppercase tracking-wider">
              تبديل نطاق عرض الفروع
            </div>

            {/* All Branches option */}
            <button
              type="button"
              onClick={() => {
                onSelectBranch('all')
                setIsOpen(false)
              }}
              className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                selectedBranchId === 'all'
                  ? 'bg-teal-50 text-[#0D9488]'
                  : 'text-slate-700 hover:bg-slate-50'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-slate-500" />
                <span>جميع الفروع (تقرير مجمع)</span>
              </div>
              {selectedBranchId === 'all' && <Check className="w-4 h-4 text-[#15B8A6]" />}
            </button>

            {/* Individual branches */}
            {branches.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => {
                  onSelectBranch(b.id)
                  setIsOpen(false)
                }}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                  selectedBranchId === b.id
                    ? 'bg-teal-50 text-[#0D9488]'
                    : 'text-slate-700 hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 text-right">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${b.isOpen ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                  <div className="truncate">
                    <p className="truncate">{b.name}</p>
                    <p className="text-[10px] text-slate-400 font-normal truncate">{b.area || b.city || b.address}</p>
                  </div>
                </div>
                {selectedBranchId === b.id && <Check className="w-4 h-4 text-[#15B8A6] shrink-0" />}
              </button>
            ))}

            <div className="pt-2 border-t border-slate-100">
              <Link
                href={`/clinic/${clinic.slug}/admin/branches`}
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-[#15B8A6] hover:bg-teal-50 rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إدارة وإضافة الفروع</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
