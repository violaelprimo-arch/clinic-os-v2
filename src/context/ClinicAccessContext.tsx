'use client'

import { createContext, useContext, type ReactNode } from 'react'

const ClinicAccessContext = createContext(false)

/** A suspended tenant can inspect historic records, but no medical or financial edits. */
export function ClinicAccessProvider({
  readOnly, children,
}: { readOnly: boolean; children: ReactNode }) {
  return <ClinicAccessContext.Provider value={readOnly}>
    {children}
  </ClinicAccessContext.Provider>
}

export function useClinicReadOnly(): boolean {
  return useContext(ClinicAccessContext)
}
