import { ClinicPublicAccessGuard } from '@/components/clinic/ClinicPublicAccessGuard'

export default async function ClinicLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params

  return (
    <ClinicPublicAccessGuard slug={slug}>
      {children}
    </ClinicPublicAccessGuard>
  )
}
