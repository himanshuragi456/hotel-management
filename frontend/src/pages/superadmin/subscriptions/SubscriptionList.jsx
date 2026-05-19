import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { CalendarDaysIcon, ArrowPathIcon, XCircleIcon } from '@heroicons/react/24/outline'
import { getSubscriptions, extendSubscription, cancelSubscription } from '@/services/superadminService'
import Badge from '@/components/shared/Badge'
import Modal from '@/components/shared/Modal'
import Pagination from '@/components/shared/Pagination'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const STATUSES = ['active', 'trial', 'cancelled', 'past_due', 'expired']

export default function SubscriptionList() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [extending, setExtending] = useState(null)
  const [extendMonths, setExtendMonths] = useState(1)
  const [cancelTarget, setCancelTarget] = useState(null)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', { status, page }],
    queryFn: () => getSubscriptions({ status, page }).then(r => r.data.data),
  })

  const extendMutation = useMutation({
    mutationFn: ({ id, months }) => extendSubscription(id, { months }),
    onSuccess: (res, { id, months }) => {
      qc.setQueryData(['subscriptions', { status, page }], (old) => {
        if (!old?.data) return old
        const updated = old.data.data.map(s => s.id === id ? { ...s, ...res.data?.data } : s)
        return { ...old, data: { ...old.data, data: updated } }
      })
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
      setExtending(null)
    },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: (_, id) => {
      qc.setQueryData(['subscriptions', { status, page }], (old) => {
        if (!old?.data) return old
        const updated = old.data.data.map(s => s.id === id ? { ...s, status: 'cancelled' } : s)
        return { ...old, data: { ...old.data, data: updated } }
      })
      qc.invalidateQueries({ queryKey: ['subscriptions'] })
      setCancelTarget(null)
    },
  })

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Subscriptions</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage tenant plans and billing cycles</p>
        </div>
        <div className="flex items-center gap-2">
          <label className="text-xs font-medium text-gray-500">Status</label>
          <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
            className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white">
            <option value="">All</option>
            {STATUSES.map(s => <option key={s} value={s}>{s.replace('_', ' ')}</option>)}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['Tenant', 'Plan', 'Status', 'Billing', 'Amount', 'Expires', ''].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.data?.map(sub => {
              const expDate = sub.current_period_end ? new Date(sub.current_period_end) : null
              const isExpired = expDate && expDate < new Date()
              return (
                <tr key={sub.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-900">{sub.tenant?.name}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{sub.tenant?.email}</p>
                  </td>
                  <td className="px-5 py-4 text-gray-700">{sub.plan?.name ?? '—'}</td>
                  <td className="px-5 py-4"><Badge value={sub.status} /></td>
                  <td className="px-5 py-4"><Badge value={sub.billing_cycle} /></td>
                  <td className="px-5 py-4 font-semibold text-gray-900">₹{sub.amount}</td>
                  <td className="px-5 py-4">
                    {expDate ? (
                      <span className={`text-xs font-medium ${isExpired ? 'text-red-500' : 'text-gray-500'}`}>
                        {expDate.toLocaleDateString()}
                        {isExpired && <span className="ml-1 text-red-400">(expired)</span>}
                      </span>
                    ) : <span className="text-gray-300">—</span>}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => setExtending(sub)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-blue-600 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                        <ArrowPathIcon className="w-3.5 h-3.5" />Extend
                      </button>
                      {sub.status !== 'cancelled' && (
                        <button onClick={() => setCancelTarget(sub)}
                          className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-red-500 bg-red-50 hover:bg-red-100 rounded-lg transition-colors">
                          <XCircleIcon className="w-3.5 h-3.5" />Cancel
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination meta={data} onPageChange={setPage} />

      {/* Extend modal */}
      <Modal open={!!extending} onClose={() => setExtending(null)} title="Extend Subscription" size="sm">
        <div className="space-y-5">
          <div className="bg-gray-50 rounded-xl p-4">
            <p className="text-sm font-medium text-gray-900">{extending?.tenant?.name}</p>
            <p className="text-xs text-gray-500 mt-0.5">{extending?.plan?.name} · expires {extending?.current_period_end ? new Date(extending.current_period_end).toLocaleDateString() : 'N/A'}</p>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wide mb-2">Months to add</label>
            <div className="flex flex-wrap gap-2 mb-3">
              {[1, 2, 3, 6, 12].map(m => (
                <button key={m} type="button" onClick={() => setExtendMonths(m)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${extendMonths === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  {m} mo
                </button>
              ))}
            </div>
            <input type="number" min="1" value={extendMonths} onChange={e => setExtendMonths(Number(e.target.value))}
              className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex items-center gap-2 pt-1">
            <button onClick={() => setExtending(null)}
              className="flex-1 py-2.5 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
              Cancel
            </button>
            <button onClick={() => extendMutation.mutate({ id: extending.id, months: extendMonths })}
              disabled={extendMutation.isPending}
              className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              <CalendarDaysIcon className="w-4 h-4" />
              {extendMutation.isPending ? 'Extending…' : 'Add Time'}
            </button>
          </div>
        </div>
      </Modal>

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Subscription?"
        message={`This will cancel the subscription for "${cancelTarget?.tenant?.name}". They will lose access when their current period ends.`}
        confirmLabel={cancelMutation.isPending ? 'Cancelling…' : 'Cancel Subscription'}
        confirmClass="bg-red-500 hover:bg-red-600 text-white"
        onConfirm={() => cancelMutation.mutate(cancelTarget?.id)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}
