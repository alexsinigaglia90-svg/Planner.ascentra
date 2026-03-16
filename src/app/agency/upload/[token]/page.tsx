import { prisma } from '@/lib/db/client'
import AgencyUploadForm from './AgencyUploadForm'

interface Props {
  params: Promise<{ token: string }>
}

export default async function AgencyUploadPage({ params }: Props) {
  const { token } = await params

  const record = await prisma.agencyUploadToken.findUnique({
    where: { token },
    include: { organization: { select: { name: true } } },
  })

  if (!record) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-red-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Ongeldige link</h1>
          <p className="text-sm text-gray-500">Deze upload link bestaat niet of is ongeldig.</p>
        </div>
      </div>
    )
  }

  if (record.expiresAt < new Date()) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-amber-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Link verlopen</h1>
          <p className="text-sm text-gray-500">Deze upload link is verlopen. Neem contact op met {record.organization.name} voor een nieuwe link.</p>
        </div>
      </div>
    )
  }

  if (record.usedAt) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="w-14 h-14 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth="2" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </div>
          <h1 className="text-xl font-bold text-gray-900 mb-2">Al gebruikt</h1>
          <p className="text-sm text-gray-500">Deze upload link is al eerder gebruikt op {new Date(record.usedAt).toLocaleDateString('nl-NL')}. Neem contact op met {record.organization.name} voor een nieuwe link.</p>
        </div>
      </div>
    )
  }

  return (
    <AgencyUploadForm
      token={token}
      agencyName={record.agencyName}
      orgName={record.organization.name}
      notes={record.notes}
    />
  )
}
