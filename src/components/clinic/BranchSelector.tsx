'use client'

import { useEffect, useState } from 'react'
import { Building2, ChevronDown, Check, Plus } from 'lucide-react'
import { Branch } from '@/types/clinic'
import { getClinicBranches, ensureClinicHasMainBranch } from '@/lib/branchService'
import { sanitizeAddress } from '@/lib/mapsHelper'
import Link from 'next/link'
import { useLanguage } from '@/context/LanguageContext'

export function BranchSelector({
  clinic,
  selectedBranchId,
  onSelectBranch
}: {
  clinic: any
  selectedBranchId: string // 'all' or branch id
  onSelectBranch: (branchId: string) => void
}) {
  const { t, dir, isRtl } = useLanguage()
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
    <div className="relative inline-block" dir={dir}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="h-10 px-3.5 rounded-xl bg-card border border-border text-foreground hover:border-primary flex items-center gap-2.5 shadow-2xs transition-all cursor-pointer font-bold text-xs"
      >
        <div className="w-6 h-6 rounded-lg bg-blue-500/10 text-primary flex items-center justify-center shrink-0">
          <Building2 className="w-3.5 h-3.5" />
        </div>
        <div className="text-start">
          <span className="text-[10px] text-muted-foreground block leading-tight font-medium">
            {t('select_branch', 'الفرع المحدد')}
          </span>
          <span className="text-xs text-foreground font-black truncate max-w-[130px] block">
            {selectedBranchId === 'all'
              ? `${t('all_branches', 'جميع الفروع')} (${branches.length})`
              : (currentBranch?.name === 'الفرع الرئيسي' || !currentBranch?.name ? t('main_branch', 'الفرع الرئيسي') : currentBranch.name)}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-muted-foreground transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <>
          <div className="fixed inset-0 z-40 bg-transparent" onClick={() => setIsOpen(false)} />
          <div className={`absolute ${isRtl ? 'right-0' : 'left-0'} mt-2 w-64 bg-card border border-border rounded-2xl shadow-xl z-50 p-2 space-y-1 animate-in fade-in-50 text-foreground`}>
            <div className="px-3 py-2 text-[10px] font-bold text-muted-foreground border-b border-border uppercase tracking-wider text-start">
              {t('select_branch', 'تبديل نطاق عرض الفروع')}
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
                  ? 'bg-primary/10 text-primary'
                  : 'text-foreground hover:bg-secondary'
              }`}
            >
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-muted-foreground" />
                <span>{t('all_branches', 'جميع الفروع (تقرير مجمع)')}</span>
              </div>
              {selectedBranchId === 'all' && <Check className="w-4 h-4 text-primary" />}
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
                    ? 'bg-primary/10 text-primary'
                    : 'text-foreground hover:bg-secondary'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0 text-start">
                  <span className={`w-2 h-2 rounded-full shrink-0 ${b.isOpen ? 'bg-emerald-500' : 'bg-rose-400'}`} />
                  <div className="truncate">
                    <p className="truncate">{b.name}</p>
                    <p className="text-[10px] text-muted-foreground font-normal truncate">{sanitizeAddress(b.address || clinic?.clinicAddress || b.city || '')}</p>
                  </div>
                </div>
                {selectedBranchId === b.id && <Check className="w-4 h-4 text-primary shrink-0" />}
              </button>
            ))}

            <div className="pt-2 border-t border-border">
              <Link
                href={`/clinic/${clinic.slug}/admin/branches`}
                onClick={() => setIsOpen(false)}
                className="w-full flex items-center justify-center gap-1.5 py-2 text-xs font-bold text-primary hover:bg-primary/10 rounded-xl transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>{t('branches_management', 'إدارة وإضافة الفروع')}</span>
              </Link>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
