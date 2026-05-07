import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOccupancyReport, getBookings } from '@/services/restaurantService'

export default function HotelReports() {
  const today = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const [from, setFrom] = useState(thirtyDaysAgo)
  const [to, setTo] = useState(today)

  const { data: report, isLoading } = useQuery({
    queryKey: ['occupancy-report', from, to],
    queryFn: () => getOccupancyReport({ from, to }).then(r => r.data.data),
    enabled: !!(from && to),
  })

  const { data: outstandingPage } = useQuery({
    queryKey: ['outstanding-bookings'],
    queryFn: () => getBookings({ status: 'checked_in' }).then(r => r.data.data),
  })
  const outstanding = outstandingPage?.data ?? outstandingPage ?? []

  const inp = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Hotel Reports</h2>

      {/* Date range */}
      <div className="flex gap-3 items-center">
        <label className="text-sm text-gray-600">From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} />
        <label className="text-sm text-gray-600">To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} />
      </div>

      {/* Summary */}
      {isLoading ? <div className="text-gray-400 text-sm">Loading…</div> : report && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Total Rooms</p>
              <p className="text-2xl font-bold text-gray-900">{report.total_rooms}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Bookings</p>
              <p className="text-2xl font-bold text-blue-600">{report.total_bookings}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Nights Sold</p>
              <p className="text-2xl font-bold text-orange-600">{report.total_nights}</p>
            </div>
            <div className="bg-white rounded-xl border p-4">
              <p className="text-xs text-gray-500 mb-1">Revenue</p>
              <p className="text-2xl font-bold text-green-600">₹{(report.total_revenue ?? 0).toLocaleString()}</p>
            </div>
          </div>

          {/* Revenue by type */}
          {report.by_type?.length > 0 && (
            <div className="bg-white rounded-xl border overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50 font-medium text-gray-800 text-sm">Revenue by Room Type</div>
              <table className="w-full text-sm">
                <thead className="border-b">
                  <tr>
                    <th className="text-left px-4 py-2 text-gray-600 font-medium">Type</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Bookings</th>
                    <th className="text-right px-4 py-2 text-gray-600 font-medium">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {report.by_type.map(t => (
                    <tr key={t.type}>
                      <td className="px-4 py-3 capitalize font-medium text-gray-800">{t.type}</td>
                      <td className="px-4 py-3 text-right text-gray-600">{t.bookings}</td>
                      <td className="px-4 py-3 text-right font-semibold">₹{(t.revenue ?? 0).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {/* Outstanding payments */}
      {outstanding.length > 0 && (
        <div className="bg-white rounded-xl border overflow-hidden">
          <div className="px-4 py-3 border-b bg-yellow-50 font-medium text-yellow-800 text-sm">
            Outstanding — Currently Checked In ({outstanding.length})
          </div>
          <table className="w-full text-sm">
            <thead className="border-b bg-gray-50">
              <tr>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Guest</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Room</th>
                <th className="text-left px-4 py-2 text-gray-600 font-medium">Check-out</th>
                <th className="text-right px-4 py-2 text-gray-600 font-medium">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {outstanding.map(b => (
                <tr key={b.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{b.guest?.name}</td>
                  <td className="px-4 py-3 text-gray-600">Room {b.room?.number}</td>
                  <td className="px-4 py-3 text-gray-500">{new Date(b.check_out_date).toLocaleDateString()}</td>
                  <td className="px-4 py-3 text-right font-semibold text-red-600">₹{(b.balance_due ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
