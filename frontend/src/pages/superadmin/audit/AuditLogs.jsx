import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAuditLogs, purgeAuditLogs } from '@/services/superadminService'
import Pagination from '@/components/shared/Pagination'

export default function AuditLogs() {
  const [filters, setFilters] = useState({ action: '', from: '', to: '', page: 1 })
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(filters).then(r => r.data.data),
  })

  const purgeMutation = useMutation({
    mutationFn: () => purgeAuditLogs({ older_than_days: 90 }),
    onSuccess: (res) => {
      alert(res.data.message)
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }))

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
        <button
          onClick={() => confirm('Purge logs older than 90 days?') && purgeMutation.mutate()}
          disabled={purgeMutation.isPending}
          className="text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded-lg hover:bg-red-50"
        >
          Purge Old Logs
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4 flex-wrap">
        <input value={filters.action} onChange={e => set('action', e.target.value)}
          placeholder="Filter by action…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.from} onChange={e => set('from', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
        <input type="date" value={filters.to} onChange={e => set('to', e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Time</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Action</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">User</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tenant</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">IP</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">No logs found</td></tr>
            ) : data?.data?.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <code className="text-xs bg-gray-100 px-1.5 py-0.5 rounded text-gray-700">{log.action}</code>
                </td>
                <td className="px-4 py-3 text-gray-700">{log.user?.name ?? '—'}</td>
                <td className="px-4 py-3 text-gray-700">{log.tenant?.name ?? 'Platform'}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">{log.ip_address ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination meta={data} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />
    </div>
  )
}
