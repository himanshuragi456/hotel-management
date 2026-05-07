import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOrdersReport, exportOrdersPdf } from '@/services/restaurantService'

export default function Reports() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [exporting, setExporting] = useState(false)

  const { data: report, isLoading } = useQuery({
    queryKey: ['orders-report', from, to],
    queryFn: () => getOrdersReport({ from, to }).then(r => r.data.data),
    enabled: !!(from && to),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportOrdersPdf({ from, to })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-report-${from}-to-${to}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(false)
    }
  }

  const inp = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Orders Report</h2>
        <button onClick={handleExport} disabled={exporting || !report?.orders?.length}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {exporting ? 'Exporting…' : 'Export PDF'}
        </button>
      </div>

      {/* Date range */}
      <div className="flex gap-3 mb-6 items-center">
        <label className="text-sm text-gray-600">From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} />
        <label className="text-sm text-gray-600">To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} />
      </div>

      {/* Summary cards */}
      {report && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Orders</p>
            <p className="text-2xl font-bold text-blue-600">{report.summary?.order_count ?? 0}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Revenue</p>
            <p className="text-2xl font-bold text-green-600">₹{(report.summary?.revenue ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Tax Collected</p>
            <p className="text-2xl font-bold text-gray-900">₹{(report.summary?.tax ?? 0).toLocaleString()}</p>
          </div>
          <div className="bg-white rounded-xl border p-4">
            <p className="text-xs text-gray-500 mb-1">Avg. Order</p>
            <p className="text-2xl font-bold text-gray-900">₹{(report.summary?.avg_order ?? 0).toLocaleString()}</p>
          </div>
        </div>
      )}

      {/* Orders table */}
      {isLoading ? (
        <div className="text-gray-400 text-sm">Loading…</div>
      ) : (
        <div className="bg-white rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Order #</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Table</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Date</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Items</th>
                <th className="text-right px-4 py-3 text-gray-600 font-medium">Total</th>
                <th className="text-left px-4 py-3 text-gray-600 font-medium">Payment</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {report?.orders?.length === 0 ? (
                <tr><td colSpan={6} className="text-center py-10 text-gray-400">No orders in this range</td></tr>
              ) : report?.orders?.map(order => (
                <tr key={order.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{order.order_number}</td>
                  <td className="px-4 py-3 text-gray-700">Table {order.table?.number ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-gray-500">{order.items_count} items</td>
                  <td className="px-4 py-3 text-right font-medium">₹{order.total}</td>
                  <td className="px-4 py-3">
                    {order.invoice ? (
                      <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                        order.invoice.payment_method === 'cash' ? 'bg-green-100 text-green-700' :
                        order.invoice.payment_method === 'upi' ? 'bg-blue-100 text-blue-700' :
                        'bg-gray-100 text-gray-600'
                      }`}>{order.invoice.payment_method}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
