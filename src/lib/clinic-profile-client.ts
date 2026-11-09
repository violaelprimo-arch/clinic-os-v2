'use client'

export async function loadClinicProfile(slug: string): Promise<Record<string, any>> {
  const res = await fetch(`/api/clinic/${encodeURIComponent(slug)}/staff-profile`, {
    credentials: 'same-origin', cache: 'no-store',
  })
  const result = await res.json().catch(() => ({}))
  if (!res.ok || !result.clinic) throw new Error(result.error || 'تعذر تحميل بيانات العيادة')
  return result.clinic
}

export function watchClinicProfile(
  slug: string,
  onChange: (clinic: Record<string, any>) => void | Promise<void>,
  onError: (error: unknown) => void = console.error,
) {
  let cancelled = false
  let pending = false
  const update = async () => {
    if (pending) return
    pending = true
    try { const clinic = await loadClinicProfile(slug); if (!cancelled) await onChange(clinic) }
    catch (error) { if (!cancelled) onError(error) }
    finally { pending = false }
  }
  void update()
  const timer = window.setInterval(() => void update(), 60000)
  return () => { cancelled = true; window.clearInterval(timer) }
}
