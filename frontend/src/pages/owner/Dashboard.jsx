import { useQuery } from '@tanstack/react-query'
import { getTodayRevenue, getLiveOrders } from '@/services/restaurantService'
import Badge from '@/components/shared/Badge'

function StatCard({ label, value, sub, color = 'gray' }) {
  const colors = { green: 'text-green-600', blue: 'text-blue-600', red: 'text-red-500', gray: 'text-gray-900' }
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-xs text-gray-500 mb-1">{label}</p>
      <p className={`text-3xl font-bold ${colors[color]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

export default function OwnerDashboard() {
  const { data: rev } = useQuery({ queryKey: ['today-revenue'], queryFn: () => getTodayRevenue().then(r => r.data.data), refetchInterval: 30000 })
  const { data: orders } = useQuery({ queryKey: ['live-orders'], queryFn: () => getLiveOrders().then(r => r.data.data), refetchInterval: 10000 })

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Today's Overview</h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard label="Revenue"     value={`₹${(rev?.revenue ?? 0).toLocaleString()}`}   color="green" />
        <StatCard label="Orders"      value={rev?.order_count ?? 0}                        color="blue" />
        <StatCard label="Expenses"    value={`₹${(rev?.expenses ?? 0).toLocaleString()}`}  color="red" />
        <StatCard label="Net Profit"  value={`₹${(rev?.net ?? 0).toLocaleString()}`}       color={rev?.net >= 0 ? 'green' : 'red'} />
      </div>

      <h3 className="font-medium text-gray-800 mb-3">Live Orders ({orders?.length ?? 0})</h3>
      {orders?.length === 0 && <p className="text-gray-400 text-sm">No active orders right now.</p>}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {orders?.map(order => (
          <div key={order.id} className={`bg-white rounded-xl border p-4 ${
            order.status === 'pending' ? 'border-yellow-300' :
            order.status === 'preparing' ? 'border-blue-300' :
            order.status === 'ready' ? 'border-green-400' : 'border-gray-200'}`}>
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-sm">Table {order.table?.number ?? 'Room'}</span>
              <div className="flex items-center gap-2">
                <Badge value={order.status} />
                <span className="text-xs text-gray-400">{order.elapsed_minutes}m</span>
              </div>
            </div>
            <div className="text-xs text-gray-500 space-y-0.5">
              {order.items?.map((item, i) => (
                <div key={i}>{item.quantity}× {item.item_name}</div>
              ))}
            </div>
            <div className="mt-2 text-xs font-medium text-gray-700">₹{order.total}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
