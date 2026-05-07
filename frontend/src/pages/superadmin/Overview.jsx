import { useQuery } from '@tanstack/react-query'
import { getDbOverview } from '@/services/superadminService'

function StatCard({ label, value, color = 'blue' }) {
  const colors = { blue: 'bg-blue-50 text-blue-700', green: 'bg-green-50 text-green-700', red: 'bg-red-50 text-red-700', yellow: 'bg-yellow-50 text-yellow-700' }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
      <p className="text-sm text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]?.split(' ')[1] ?? 'text-gray-900'}`}>{value ?? '—'}</p>
    </div>
  )
}

export default function Overview() {
  const { data, isLoading } = useQuery({
    queryKey: ['db-overview'],
    queryFn: () => getDbOverview().then(r => r.data.data),
  })

  if (isLoading) return <div className="text-gray-400 text-sm">Loading…</div>

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Platform Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        <StatCard label="Total Tenants"     value={data?.total_tenants}     color="blue" />
        <StatCard label="Active Tenants"    value={data?.active_tenants}    color="green" />
        <StatCard label="Trial Tenants"     value={data?.trial_tenants}     color="yellow" />
        <StatCard label="Suspended"         value={data?.suspended_tenants} color="red" />
        <StatCard label="Total Users"       value={data?.total_users}       color="blue" />
        <StatCard label="Audit Log Entries" value={data?.total_audit_logs}  color="blue" />
      </div>
    </div>
  )
}
