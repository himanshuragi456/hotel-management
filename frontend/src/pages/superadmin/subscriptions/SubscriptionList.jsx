import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSubscriptions, extendSubscription, cancelSubscription } from '@/services/superadminService'
import Badge from '@/components/shared/Badge'
import Modal from '@/components/shared/Modal'
import Pagination from '@/components/shared/Pagination'

export default function SubscriptionList() {
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [extending, setExtending] = useState(null)
  const [extendMonths, setExtendMonths] = useState(1)
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['subscriptions', { status, page }],
    queryFn: () => getSubscriptions({ status, page }).then(r => r.data.data),
  })

  const extendMutation = useMutation({
    mutationFn: ({ id, months }) => extendSubscription(id, { months }),
    onSuccess: () => { setExtending(null); qc.invalidateQueries({ queryKey: ['subscriptions'] }) },
  })

  const cancelMutation = useMutation({
    mutationFn: cancelSubscription,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['subscriptions'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Subscriptions</h2>
        <select value={status} onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
          <option value="">All statuses</option>
          {['active','trial','cancelled','past_due','expired'].map(s => (
            <option key={s} value={s}>{s.replace('_',' ')}</option>
          ))}
        </select>
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Tenant</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Plan</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Billing</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Amount</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Expires</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={7} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : data?.data?.map(sub => (
              <tr key={sub.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{sub.tenant?.name}</td>
                <td className="px-4 py-3 text-gray-600">{sub.plan?.name}</td>
                <td className="px-4 py-3"><Badge value={sub.status} /></td>
                <td className="px-4 py-3"><Badge value={sub.billing_cycle} /></td>
                <td className="px-4 py-3 font-medium">₹{sub.amount}</td>
                <td className="px-4 py-3 text-gray-500 text-xs">
                  {sub.current_period_end ? new Date(sub.current_period_end).toLocaleDateString() : '—'}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button onClick={() => setExtending(sub)} className="text-blue-600 hover:underline text-xs">Extend</button>
                    {sub.status !== 'cancelled' && (
                      <button onClick={() => confirm('Cancel this subscription?') && cancelMutation.mutate(sub.id)}
                        className="text-red-500 hover:underline text-xs">Cancel</button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination meta={data} onPageChange={setPage} />

      <Modal open={!!extending} onClose={() => setExtending(null)} title="Extend Subscription" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Extend <strong>{extending?.tenant?.name}</strong>'s subscription</p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Months to add</label>
            <input type="number" min="1" value={extendMonths} onChange={e => setExtendMonths(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
          </div>
          <div className="flex justify-end">
            <button
              onClick={() => extendMutation.mutate({ id: extending.id, months: extendMonths })}
              disabled={extendMutation.isPending}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {extendMutation.isPending ? 'Extending…' : 'Extend'}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  )
}
