'use client'

import { useEffect, useState } from 'react'
import { registerServiceWorker } from '@/lib/pwaService'

export function PwaRegistrar() {
  useEffect(() => {
    registerServiceWorker()
  }, [])

  return null
}
