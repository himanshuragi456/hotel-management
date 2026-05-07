import { useQuery } from '@tanstack/react-query'
import { getLiveOrders } from '@/services/restaurantService'
import Badge from '@/components/shared/Badge'

export default function LiveOrders() {
  const { data: orders, isLoading } = useQuery({
    queryKey: ['live-orders'],
    queryFn: () => getLiveOrders().then(r => r.data.data),
    refetchInterval: 8000,
  })

  const byStatus = {
    pending:   orders?.filter(o => o.status === 'pending')   ?? [],
    preparing: orders?.filter(o => o.status === 'preparing') ?? [],
    ready:     orders?.filter(o => o.status === 'ready')     ?? [],
  }

  const colStyle = {
    pending:   'border-yellow-300',
    preparing: 'border-blue-300',
    ready:     'border-green-400',
  }

  if (isLoading) return <div className="text-gray-400">Loading…</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Live Orders</h2>
        <span className="text-sm text-gray-400">Auto-refreshes every 8s</span>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {Object.entries(byStatus).map(([status, list]) => (
          <div key={status}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-medium text-gray-700 capitalize">{status}</h3>
              <span className="bg-gray-100 text-gray-600 text-xs px-2 py-0.5 rounded-full">{list.length}</span>
            </div>
            <div className="space-y-3">
              {list.map(order => (
                <div key={order.id} className={`bg-white rounded-xl border-l-4 ${colStyle[status]} p-4 shadow-sm`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-semibold text-gray-900">Table {order.table?.number ?? 'Room'}</span>
                    <span className={`text-xs font-medium ${order.elapsed_minutes > 30 ? 'text-red-500' : 'text-gray-400'}`}>
                      {order.elapsed_minutes}m
                    </span>
                  </div>
                  <div className="text-xs text-gray-500 mb-2 space-y-0.5">
                    {order.items?.map((item, i) => (
                      <div key={i}>{item.quantity}× {item.item_name}{item.notes ? ` (${item.notes})` : ''}</div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-400">{order.waiter?.name}</span>
                    <span className="text-sm font-medium">₹{order.total}</span>
                  </div>
                </div>
              ))}
              {list.length === 0 && <div className="text-sm text-gray-300 text-center py-6 border-2 border-dashed border-gray-100 rounded-xl">Empty</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
