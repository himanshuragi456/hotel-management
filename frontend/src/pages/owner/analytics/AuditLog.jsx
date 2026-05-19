import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  DocumentTextIcon, FunnelIcon, ClockIcon, UserCircleIcon,
} from '@heroicons/react/24/outline'
import { getOwnerAuditLog } from '@/services/restaurantService'

const ACTION_BADGE = (action = '') => {
  if (action.includes('delete') || action.includes('destroy')) return 'bg-red-100 text-red-700'
  if (action.includes('create') || action.includes('store'))   return 'bg-green-100 text-green-700'
  if (action.includes('update'))                                return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

const today = new Date().toISOString().split('T')[0]

export default function AuditLog() {
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [action, setAction] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['owner-audit-log', from, to, action],
    queryFn: () => getOwnerAuditLog({ from: from || undefined, to: to || undefined, action: action || undefined }).then(r => r.data.data),
  })

  const logs = data?.data ?? []
  const inp = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white'

  return (
    <div className="max-w-4xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Audit Log</h2>
        <p className="text-sm text-gray-400 mt-0.5">Activity history for your account</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">Filters</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:flex-wrap sm:items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">From</label>
            <input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} className={`${inp} flex-1 sm:flex-none`} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500 whitespace-nowrap">To</label>
            <input type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} className={`${inp} flex-1 sm:flex-none`} />
          </div>
          <input value={action} onChange={e => setAction(e.target.value)} placeholder="Filter by action…" className={`${inp} w-full sm:w-48`} />
          {(from || to || action) && (
            <button onClick={() => { setFrom(''); setTo(''); setAction('') }} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[640px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['Time', 'User', 'Action', 'Model', 'Changes'].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 5 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${50 + Math.random() * 50}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <DocumentTextIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No audit logs found</p>
                </td>
              </tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5 text-xs text-gray-500 whitespace-nowrap">
                    <ClockIcon className="w-3.5 h-3.5 text-gray-400" />
                    {new Date(log.created_at).toLocaleString()}
                  </div>
                </td>
                <td className="px-5 py-4">
                  <div className="flex items-center gap-1.5">
                    <UserCircleIcon className="w-4 h-4 text-gray-400" />
                    <div>
                      <p className="font-medium text-gray-800 text-xs">{log.user?.name ?? 'System'}</p>
                      {log.user?.role && <p className="text-gray-400 text-[10px] capitalize">{log.user.role}</p>}
                    </div>
                  </div>
                </td>
                <td className="px-5 py-4">
                  <span className={`text-xs px-2.5 py-1 rounded-full font-semibold ${ACTION_BADGE(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-5 py-4 text-gray-500 text-xs font-mono">
                  {log.model_type ? log.model_type.split('\\').pop() : '—'}
                  {log.model_id ? ` #${log.model_id}` : ''}
                </td>
                <td className="px-5 py-4 text-xs text-gray-400 max-w-xs truncate font-mono">
                  {log.new_values ? JSON.stringify(log.new_values).slice(0, 80) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
