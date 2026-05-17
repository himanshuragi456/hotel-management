import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getOccupancyReport, getBookings } from '@/services/restaurantService'
import {
  BuildingOfficeIcon, CalendarDaysIcon, MoonIcon, BanknotesIcon, ExclamationCircleIcon,
} from '@heroicons/react/24/outline'

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

  const inp = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white'

  const STAT_CARDS = report ? [
    { label: 'Total Rooms',  value: report.total_rooms,    Icon: BuildingOfficeIcon, color: 'text-gray-900',   bg: 'bg-gray-100'   },
    { label: 'Bookings',     value: report.total_bookings, Icon: CalendarDaysIcon,   color: 'text-blue-600',   bg: 'bg-blue-50'    },
    { label: 'Nights Sold',  value: report.total_nights,   Icon: MoonIcon,           color: 'text-orange-600', bg: 'bg-orange-50'  },
    { label: 'Revenue',      value: `₹${(report.total_revenue ?? 0).toLocaleString()}`, Icon: BanknotesIcon, color: 'text-green-600', bg: 'bg-green-50' },
  ] : []

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Hotel Reports</h2>
        <p className="text-sm text-gray-400 mt-0.5">Occupancy, revenue, and outstanding payments</p>
      </div>

      {/* Date range */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex gap-3 items-center flex-wrap">
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} />
          <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} />
        </div>
      </div>

      {/* Summary */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 animate-pulse">
              <div className="w-9 h-9 bg-gray-100 rounded-xl mb-3" />
              <div className="h-3 bg-gray-200 rounded w-16 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      ) : STAT_CARDS.length > 0 && (
        <>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {STAT_CARDS.map(({ label, value, Icon, color, bg }) => (
              <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
                <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                  <Icon className={`w-4.5 h-4.5 ${color}`} />
                </div>
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
                <p className={`text-2xl font-bold ${color}`}>{value}</p>
              </div>
            ))}
          </div>

          {/* Revenue by type */}
          {report.by_type?.length > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
              <div className="px-5 py-3.5 border-b border-gray-100 bg-gray-50/60">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue by Room Type</h3>
              </div>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Type</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Bookings</th>
                    <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {report.by_type.map(t => (
                    <tr key={t.type} className="hover:bg-gray-50/80 transition-colors">
                      <td className="px-5 py-4 capitalize font-semibold text-gray-800">{t.type}</td>
                      <td className="px-5 py-4 text-right text-gray-600">{t.bookings}</td>
                      <td className="px-5 py-4 text-right font-bold text-gray-900">₹{(t.revenue ?? 0).toLocaleString()}</td>
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
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="px-5 py-3.5 border-b border-amber-200 bg-amber-50 flex items-center gap-2">
            <ExclamationCircleIcon className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-amber-800">Outstanding — Currently Checked In ({outstanding.length})</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Guest</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Room</th>
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Check-out</th>
                <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {outstanding.map(b => (
                <tr key={b.id} className="hover:bg-gray-50/80 transition-colors">
                  <td className="px-5 py-4 font-semibold text-gray-900">{b.guest?.name}</td>
                  <td className="px-5 py-4 text-gray-600">Room {b.room?.number}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs">{new Date(b.check_out_date).toLocaleDateString()}</td>
                  <td className="px-5 py-4 text-right font-bold text-red-600">₹{(b.balance_due ?? 0).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
