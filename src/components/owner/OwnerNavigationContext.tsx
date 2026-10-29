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
export const OwnerNavigationContext = createContext<{
  activeTab: OwnerTab
  setActiveTab: Dispatch<SetStateAction<OwnerTab>>
} | null>(null)
export function useOwnerNavigation() {
  const navigation = useContext(OwnerNavigationContext)
  if (!navigation) throw new Error('Owner navigation provider is missing')
  return navigation
}
