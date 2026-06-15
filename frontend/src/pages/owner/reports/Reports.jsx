import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowDownTrayIcon, DocumentTextIcon, ShoppingBagIcon,
  BanknotesIcon, ReceiptPercentIcon, ChartBarIcon,
} from '@heroicons/react/24/outline'
import { getOrdersReport, exportOrdersPdf, exportOrdersExcel } from '@/services/restaurantService'

const PAYMENT_COLORS = {
  cash:  'bg-green-100 text-green-700',
  upi:   'bg-blue-100 text-blue-700',
  card:  'bg-purple-100 text-purple-700',
  split: 'bg-orange-100 text-orange-700',
}

export default function Reports() {
  const today = new Date().toISOString().split('T')[0]
  const [from, setFrom] = useState(today)
  const [to, setTo] = useState(today)
  const [exporting, setExporting] = useState(null) // 'pdf' | 'excel' | null

  const { data: report, isLoading } = useQuery({
    queryKey: ['orders-report', from, to],
    queryFn: () => getOrdersReport({ from, to }).then(r => r.data.data),
    enabled: !!(from && to),
  })

  const handleExport = async (format) => {
    setExporting(format)
    try {
      const res = format === 'excel'
        ? await exportOrdersExcel({ from, to })
        : await exportOrdersPdf({ from, to })
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-report-${from}-to-${to}.${format === 'excel' ? 'xlsx' : 'pdf'}`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setExporting(null)
    }
  }

  const inp = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white'

  const SUMMARY_CARDS = report ? [
    { label: 'Orders', value: report.summary?.order_count ?? 0, Icon: ShoppingBagIcon, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Revenue', value: `₹${(report.summary?.revenue ?? 0).toLocaleString()}`, Icon: BanknotesIcon, color: 'text-green-600', bg: 'bg-green-50' },
    { label: 'Tax Collected', value: `₹${(report.summary?.tax ?? 0).toLocaleString()}`, Icon: ReceiptPercentIcon, color: 'text-gray-700', bg: 'bg-gray-100' },
    { label: 'Avg. Order', value: `₹${(report.summary?.avg_order ?? 0).toLocaleString()}`, Icon: ChartBarIcon, color: 'text-violet-600', bg: 'bg-violet-50' },
  ] : []

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Orders Report</h2>
          <p className="text-sm text-gray-400 mt-0.5">Revenue and order analytics by date range</p>
        </div>
        <div className="flex gap-2 self-start sm:self-auto">
          <button onClick={() => handleExport('excel')} disabled={!!exporting || !report?.orders?.length}
            className="inline-flex items-center gap-2 bg-white border border-green-600 text-green-700 px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 hover:bg-green-50 transition-colors">
            <ArrowDownTrayIcon className="w-4 h-4" />
            {exporting === 'excel' ? 'Exporting…' : 'Export Excel'}
          </button>
          <button onClick={() => handleExport('pdf')} disabled={!!exporting || !report?.orders?.length}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow">
            <ArrowDownTrayIcon className="w-4 h-4" />
            {exporting === 'pdf' ? 'Exporting…' : 'Export PDF'}
          </button>
        </div>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-6">
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">From</label>
            <input type="date" value={from} max={to || today} onChange={e => setFrom(e.target.value)} className={`${inp} flex-1 sm:flex-none`} />
          </div>
          <div className="flex items-center gap-2">
            <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">To</label>
            <input type="date" value={to} min={from || undefined} max={today} onChange={e => setTo(e.target.value)} className={`${inp} flex-1 sm:flex-none`} />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      {SUMMARY_CARDS.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          {SUMMARY_CARDS.map(({ label, value, Icon, color, bg }) => (
            <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-4.5 h-4.5 ${color}`} />
              </div>
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
              <p className={`text-2xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Orders table */}
      {isLoading ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="px-5 py-4 flex gap-4 border-b border-gray-50">
              {Array.from({ length: 5 }).map((_, j) => (
                <div key={j} className="h-4 bg-gray-100 rounded animate-pulse flex-1" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[540px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Order #', 'Table', 'Date', 'Items', 'Total', 'Payment'].map(h => (
                  <th key={h} className={`${h === 'Total' ? 'text-right' : 'text-left'} px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {report?.orders?.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <DocumentTextIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No orders in this range</p>
                  </td>
                </tr>
              ) : report?.orders?.map(order => (
                <tr key={order.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-4 font-mono text-xs text-gray-500">{order.order_number}</td>
                  <td className="px-5 py-4 text-gray-700 text-sm">
                    {order.type === 'room-service' ? `Room ${order.room_id ?? '?'}` : `Table ${order.table?.number ?? '—'}`}
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{new Date(order.created_at).toLocaleDateString()}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{order.items_count} items</td>
                  <td className="px-5 py-4 text-right font-bold text-gray-900">₹{order.total}</td>
                  <td className="px-5 py-4">
                    {order.invoice ? (
                      <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize ${PAYMENT_COLORS[order.invoice.payment_method] ?? 'bg-gray-100 text-gray-600'}`}>
                        {order.invoice.payment_method}
                      </span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}
    </div>
  )
}
