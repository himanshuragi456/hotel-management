import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  DocumentTextIcon, FunnelIcon, TrashIcon, ClockIcon, UserCircleIcon,
  BuildingStorefrontIcon, ComputerDesktopIcon,
} from '@heroicons/react/24/outline'
import { getAuditLogs, purgeAuditLogs } from '@/services/superadminService'
import Pagination from '@/components/shared/Pagination'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const today = new Date().toISOString().split('T')[0]

export default function AuditLogs() {
  const [filters, setFilters] = useState({ action: '', from: '', to: '', page: 1 })
  const [showPurgeConfirm, setShowPurgeConfirm] = useState(false)
  const [purgeSuccess, setPurgeSuccess] = useState('')
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['audit-logs', filters],
    queryFn: () => getAuditLogs(filters).then(r => r.data.data),
  })

  const purgeMutation = useMutation({
    mutationFn: () => purgeAuditLogs({ older_than_days: 90 }),
    onSuccess: (res) => {
      setShowPurgeConfirm(false)
      setPurgeSuccess(res.data.message ?? 'Old logs purged successfully')
      setTimeout(() => setPurgeSuccess(''), 4000)
      qc.invalidateQueries({ queryKey: ['audit-logs'] })
    },
  })

  const set = (k, v) => setFilters(f => ({ ...f, [k]: v, page: 1 }))
  const inp = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white'

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Audit Logs</h2>
          <p className="text-sm text-gray-400 mt-0.5">Platform-wide activity trail</p>
        </div>
        <button
          onClick={() => setShowPurgeConfirm(true)}
          disabled={purgeMutation.isPending}
          className="inline-flex items-center gap-1.5 text-sm text-red-600 border border-red-200 px-3 py-1.5 rounded-xl hover:bg-red-50 transition-colors disabled:opacity-50"
        >
          <TrashIcon className="w-4 h-4" />
          Purge Old Logs
        </button>
      </div>

      {purgeSuccess && (
        <div className="mb-4 bg-green-50 border border-green-200 text-green-700 text-sm px-4 py-3 rounded-xl">
          {purgeSuccess}
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">Filters</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:flex-wrap sm:items-center">
          <input id="audit-logs-action" name="action" aria-label="Filter by action" value={filters.action} onChange={e => set('action', e.target.value)}
            placeholder="Filter by action…"
            className={`${inp} w-full sm:w-auto`} />
          <div className="flex items-center gap-2">
            <label htmlFor="audit-logs-from" className="text-xs font-medium text-gray-500 whitespace-nowrap">From</label>
            <input id="audit-logs-from" name="from" type="date" value={filters.from}
              max={filters.to || today}
              onChange={e => set('from', e.target.value)}
              className={inp} />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="audit-logs-to" className="text-xs font-medium text-gray-500 whitespace-nowrap">To</label>
            <input id="audit-logs-to" name="to" type="date" value={filters.to}
              min={filters.from || undefined}
              max={today}
              onChange={e => set('to', e.target.value)}
              className={inp} />
          </div>
          {(filters.from || filters.to || filters.action) && (
            <button onClick={() => setFilters({ action: '', from: '', to: '', page: 1 })} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['Time', 'Action', 'User', 'Tenant', 'IP'].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 8 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + Math.random() * 50}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <DocumentTextIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No logs found</p>
                </td>
              </tr>
            ) : data?.data?.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500">
                    <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <code className="text-xs bg-slate-100 text-slate-700 px-2 py-1 rounded-lg font-mono">{log.action}</code>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <UserCircleIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 text-xs">{log.user?.name ?? '—'}</span>
                    {log.user?.role && (
                      <span className="text-xs text-gray-400 capitalize">({log.user.role})</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <BuildingStorefrontIcon className="w-4 h-4 text-gray-400" />
                    <span className="text-gray-700 text-xs">{log.tenant?.name ?? 'Platform'}</span>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <ComputerDesktopIcon className="w-3.5 h-3.5 text-gray-400" />
                    <span className="text-gray-500 text-xs font-mono">{log.ip_address ?? '—'}</span>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination meta={data} onPageChange={p => setFilters(f => ({ ...f, page: p }))} />

      <ConfirmDialog
        open={showPurgeConfirm}
        title="Purge Old Audit Logs?"
        message="This will permanently delete all audit logs older than 90 days. This action cannot be undone."
        confirmLabel={purgeMutation.isPending ? 'Purging…' : 'Purge'}
        loading={purgeMutation.isPending}
        confirmClass="bg-red-500 hover:bg-red-600 text-white"
        onConfirm={() => purgeMutation.mutate()}
        onCancel={() => setShowPurgeConfirm(false)}
      />
    </div>
  )
}
