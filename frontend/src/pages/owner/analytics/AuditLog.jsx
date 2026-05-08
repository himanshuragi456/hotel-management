import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOwnerAuditLog } from '@/services/restaurantService'

const ACTION_COLOR = (action = '') => {
  if (action.includes('delete') || action.includes('destroy')) return 'bg-red-100 text-red-700'
  if (action.includes('create') || action.includes('store'))   return 'bg-green-100 text-green-700'
  if (action.includes('update'))                                return 'bg-blue-100 text-blue-700'
  return 'bg-gray-100 text-gray-600'
}

export default function AuditLog() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [action, setAction] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['owner-audit-log', from, to, action],
    queryFn: () => getOwnerAuditLog({ from: from || undefined, to: to || undefined, action: action || undefined }).then(r => r.data.data),
  })

  const logs = data?.data ?? []
  const inp = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Audit Log</h2>

      <div className="flex flex-wrap gap-3 mb-4">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} placeholder="From" />
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} placeholder="To" />
        <input value={action} onChange={e => setAction(e.target.value)} placeholder="Filter by action…" className={`${inp} w-48`} />
        {(from || to || action) && (
          <button onClick={() => { setFrom(''); setTo(''); setAction('') }} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
        )}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Time</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">User</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Action</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Model</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Changes</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={5} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : logs.length === 0 ? (
              <tr><td colSpan={5} className="text-center py-10 text-gray-400">No audit logs found</td></tr>
            ) : logs.map(log => (
              <tr key={log.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                  {new Date(log.created_at).toLocaleString()}
                </td>
                <td className="px-4 py-3">
                  <div className="font-medium text-gray-800 text-xs">{log.user?.name ?? 'System'}</div>
                  <div className="text-gray-400 text-xs capitalize">{log.user?.role}</div>
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ACTION_COLOR(log.action)}`}>
                    {log.action}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {log.model_type ? log.model_type.split('\\').pop() : '—'}
                  {log.model_id ? ` #${log.model_id}` : ''}
                </td>
                <td className="px-4 py-3 text-xs text-gray-400 max-w-xs truncate">
                  {log.new_values ? JSON.stringify(log.new_values).slice(0, 80) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
