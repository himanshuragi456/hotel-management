import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getAnalyticsOverview } from '@/services/restaurantService'
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, Legend,
} from 'recharts'

const PERIOD_OPTIONS = [
  { label: '7 days',  value: 7  },
  { label: '30 days', value: 30 },
  { label: '90 days', value: 90 },
]

function StatCard({ label, value, sub, color = 'gray' }) {
  const colors = {
    green: 'text-green-600', blue: 'text-blue-600',
    red: 'text-red-500',     orange: 'text-orange-500', gray: 'text-gray-900',
  }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function RevenueChart({ data }) {
  if (!data?.length) return <div className="py-12 text-center text-gray-300 text-sm">No data for this period</div>
  return (
    <ResponsiveContainer width="100%" height={240}>
      <AreaChart data={data} margin={{ top: 4, right: 4, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#f97316" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="colorExpenses" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#ef4444" stopOpacity={0.15} />
            <stop offset="95%" stopColor="#ef4444" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} tickFormatter={d => d.slice(5)} />
        <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `₹${(v/1000).toFixed(0)}k`} />
        <Tooltip
          formatter={(val, name) => [`₹${val.toLocaleString()}`, name]}
          labelFormatter={l => `Date: ${l}`}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Legend wrapperStyle={{ fontSize: 12 }} />
        <Area type="monotone" dataKey="revenue"  name="Revenue"  stroke="#f97316" strokeWidth={2} fill="url(#colorRevenue)" />
        <Area type="monotone" dataKey="expenses" name="Expenses" stroke="#ef4444" strokeWidth={2} fill="url(#colorExpenses)" />
        <Area type="monotone" dataKey="profit"   name="Profit"   stroke="#22c55e" strokeWidth={2} fill="none" strokeDasharray="4 2" />
      </AreaChart>
    </ResponsiveContainer>
  )
}

function PeakHoursChart({ data }) {
  if (!data?.length) return null
  const maxCount = Math.max(...data.map(d => d.count), 1)
  return (
    <div>
      <div className="grid grid-cols-12 gap-1 items-end h-24 mb-1">
        {data.map(h => {
          const pct = Math.round((h.count / maxCount) * 100)
          const isHot = pct >= 70
          return (
            <div key={h.hour} className="flex flex-col items-center gap-0.5" title={`${h.label}: ${h.count} orders`}>
              <div
                className={`w-full rounded-t transition-all ${isHot ? 'bg-orange-500' : pct >= 40 ? 'bg-orange-300' : 'bg-gray-200'}`}
                style={{ height: `${Math.max(pct, 4)}%` }}
              />
            </div>
          )
        })}
      </div>
      <div className="grid grid-cols-12 gap-1">
        {data.map(h => (
          <div key={h.hour} className="text-center text-xs text-gray-400">{h.hour % 3 === 0 ? h.hour : ''}</div>
        ))}
      </div>
    </div>
  )
}

function TopItemsChart({ items }) {
  if (!items?.length) return <div className="py-8 text-center text-gray-300 text-sm">No orders in this period</div>
  return (
    <ResponsiveContainer width="100%" height={220}>
      <BarChart data={items} layout="vertical" margin={{ top: 0, right: 16, left: 80, bottom: 0 }}>
        <XAxis type="number" tick={{ fontSize: 11 }} />
        <YAxis type="category" dataKey="item_name" tick={{ fontSize: 11 }} width={75} />
        <Tooltip
          formatter={(val, name) => [val, name === 'total_qty' ? 'Qty sold' : 'Revenue']}
          contentStyle={{ borderRadius: 8, border: '1px solid #e5e7eb', fontSize: 12 }}
        />
        <Bar dataKey="total_qty" name="Qty sold" fill="#f97316" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  )
}

export default function Analytics() {
  const [days, setDays] = useState(30)

  const { data, isLoading } = useQuery({
    queryKey: ['analytics', days],
    queryFn: () => getAnalyticsOverview({ days }).then(r => r.data.data),
    staleTime: 60_000,
  })

  const t = data?.totals ?? {}

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-900">Analytics</h2>
        <div className="flex gap-1">
          {PERIOD_OPTIONS.map(opt => (
            <button key={opt.value} onClick={() => setDays(opt.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${days === opt.value ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-xl border p-5 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-16 mb-3" />
              <div className="h-7 bg-gray-200 rounded w-24" />
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard label="Revenue"   value={`₹${(t.revenue ?? 0).toLocaleString()}`}  color="green" sub={`${t.orders ?? 0} orders`} />
            <StatCard label="Expenses"  value={`₹${(t.expenses ?? 0).toLocaleString()}`} color="red" />
            <StatCard label="Net Profit" value={`₹${(t.profit ?? 0).toLocaleString()}`} color={(t.profit ?? 0) >= 0 ? 'green' : 'red'} />
            {data?.hotel?.total_rooms > 0 && (
              <StatCard label="Occupancy" value={`${data.hotel.occupancy_rate}%`} color="blue" sub={`${data.hotel.total_rooms} rooms`} />
            )}
          </div>

          {/* Revenue chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="font-medium text-gray-800 mb-4 text-sm">Revenue vs Expenses</h3>
            <RevenueChart data={data?.chart_data} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Top items */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-800 mb-4 text-sm">Top Selling Items</h3>
              <TopItemsChart items={data?.top_items} />
            </div>

            {/* Peak hours */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-800 mb-4 text-sm">Peak Hours</h3>
              <PeakHoursChart data={data?.peak_hours} />
              <p className="text-xs text-gray-400 mt-2 text-center">Hour of day (0–23) · Orange = busiest</p>
            </div>
          </div>

          {/* Table turnover */}
          {data?.table_stats?.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-medium text-gray-800 mb-3 text-sm">Table Turnover</h3>
              <div className="grid grid-cols-4 md:grid-cols-8 gap-3">
                {data.table_stats.map(t => (
                  <div key={t.restaurant_table_id} className="text-center bg-orange-50 rounded-xl p-3">
                    <div className="text-lg font-bold text-gray-900">T{t.table?.number ?? t.restaurant_table_id}</div>
                    <div className="text-xl font-bold text-orange-500">{t.orders}</div>
                    <div className="text-xs text-gray-400">orders</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
