'use client'

import {
  createContext,
  useContext,
  type Dispatch,
  type SetStateAction,
} from 'react'

export type OwnerTab =
  | 'clinics'
  | 'doctors'
  | 'packages'
  | 'add'
  | 'settings'
  | 'landing'
  | 'clinic-requests'
  | 'whatsapp'

export interface OwnerNavigationContextType {
  activeTab: OwnerTab
  setActiveTab: Dispatch<SetStateAction<OwnerTab>>
  newRequestsCount: number
  setNewRequestsCount: Dispatch<SetStateAction<number>>
  triggerExportBackup: () => void
  registerExportBackup: (fn: (() => void | Promise<void>) | null) => void
  triggerEditClinic: () => void
  registerEditClinic: (fn: (() => void) | null) => void
}

export const OwnerNavigationContext = createContext<OwnerNavigationContextType | null>(null)

export function useOwnerNavigation() {
  const navigation = useContext(OwnerNavigationContext)
  if (!navigation) throw new Error('Owner navigation provider is missing')
  return navigation
}
