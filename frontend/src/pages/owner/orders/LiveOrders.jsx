import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ClockIcon, CheckCircleIcon } from '@heroicons/react/24/outline'
import { getLiveOrders } from '@/services/restaurantService'
import { billingUpdateStatus, billingMarkServed } from '@/services/restaurantService'

const STATUS_CONFIG = {
  pending:   { border: 'border-yellow-400', dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-800', label: 'Pending'   },
  preparing: { border: 'border-blue-400',   dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-800',     label: 'Preparing' },
  ready:     { border: 'border-green-500',  dot: 'bg-green-500',  badge: 'bg-green-100 text-green-800',   label: 'Ready'     },
}

function StatusTimeline({ order }) {
  const steps = [
    { key: 'pending',   label: 'Ordered',    time: order.elapsed_label },
    { key: 'preparing', label: 'In Kitchen', time: order.kitchen_label },
    { key: 'ready',     label: 'Ready',      time: null },
    { key: 'served',    label: 'Served',     time: null },
  ]
  const idx = { pending: 0, preparing: 1, ready: 2, served: 3 }
  const cur = idx[order.status] ?? 0
  return (
    <div className="flex items-center gap-1 my-2.5">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${i <= cur ? 'bg-orange-500' : 'bg-gray-200'}`} />
            <span className={`text-[10px] mt-0.5 truncate ${i <= cur ? 'text-orange-600 font-semibold' : 'text-gray-300'}`}>{s.label}</span>
            {s.time && i <= cur && <span className="text-[10px] text-gray-400">{s.time}</span>}
          </div>
          {i < steps.length - 1 && <div className={`h-px flex-1 mx-1 ${i < cur ? 'bg-orange-400' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

function OrderCard({ order, cfg }) {
  const qc = useQueryClient()

  const invalidate = () => qc.invalidateQueries({ queryKey: ['live-orders'] })

  const advance = useMutation({
    mutationFn: (status) => billingUpdateStatus(order.id, status),
    onSuccess: invalidate,
  })

  const served = useMutation({
    mutationFn: () => billingMarkServed(order.id),
    onSuccess: invalidate,
  })

  const busy = advance.isPending || served.isPending

  return (
    <div className={`bg-white rounded-2xl border-l-4 ${cfg.border} p-4 shadow-sm hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-1">
        <span className="font-bold text-gray-900 text-sm">
          {order.type === 'room-service' ? `Room ${order.room_id ?? '?'}` : `Table ${order.table?.number ?? '?'}`}
        </span>
        <span className={`text-xs font-semibold ${(order.elapsed_minutes ?? 0) > 30 ? 'text-red-500' : 'text-gray-400'}`}>
          {order.elapsed_label ?? `${order.elapsed_minutes}m`}
        </span>
      </div>
      <StatusTimeline order={order} />
      <div className="text-xs text-gray-500 mb-2.5 space-y-0.5">
        {order.items?.slice(0, 4).map((item, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="w-5 h-5 rounded-md bg-gray-100 text-gray-700 text-[10px] font-bold flex items-center justify-center shrink-0">{item.quantity}</span>
            <span className="truncate">{item.item_name}{item.notes ? ` · ${item.notes}` : ''}</span>
          </div>
        ))}
        {(order.items?.length ?? 0) > 4 && (
          <p className="text-gray-400 text-[10px]">+{order.items.length - 4} more</p>
        )}
      </div>
      <div className="flex items-center justify-between pt-2 border-t border-gray-50 mb-2.5">
        <span className="text-xs text-gray-400">{order.waiter?.name ?? 'No waiter'}</span>
        <span className="text-sm font-bold text-gray-900">₹{order.total}</span>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        {order.status === 'pending' && (
          <button
            onClick={() => advance.mutate('preparing')}
            disabled={busy}
            className="flex-1 text-xs bg-blue-500 hover:bg-blue-600 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
          >
            {advance.isPending ? '…' : '→ Preparing'}
          </button>
        )}
        {order.status === 'preparing' && (
          <button
            onClick={() => advance.mutate('ready')}
            disabled={busy}
            className="flex-1 text-xs bg-green-500 hover:bg-green-600 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
          >
            {advance.isPending ? '…' : '→ Mark Ready'}
          </button>
        )}
        {order.status === 'ready' && (
          <button
            onClick={() => served.mutate()}
            disabled={busy}
            className="flex-1 text-xs bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
          >
            {served.isPending ? '…' : 'Mark Served'}
          </button>
        )}
      </div>
    </div>
  )
}

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

  const total = orders?.length ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Live Orders</h2>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-1">
            <ClockIcon className="w-3.5 h-3.5" />
            {total} active · auto-refreshes every 8s
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {['pending', 'preparing', 'ready'].map(s => (
            <div key={s} className="space-y-3">
              <div className="h-5 w-24 bg-gray-100 rounded animate-pulse" />
              {Array.from({ length: 2 }).map((_, i) => (
                <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
              ))}
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {Object.entries(byStatus).map(([status, list]) => {
            const cfg = STATUS_CONFIG[status]
            return (
              <div key={status}>
                <div className="flex items-center gap-2 mb-3">
                  <div className={`w-2 h-2 rounded-full ${cfg.dot} ${status === 'ready' ? 'animate-pulse' : ''}`} />
                  <h3 className="font-semibold text-gray-700">{cfg.label}</h3>
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${cfg.badge}`}>{list.length}</span>
                </div>
                <div className="space-y-3">
                  {list.map(order => (
                    <OrderCard key={order.id} order={order} cfg={cfg} />
                  ))}
                  {list.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 border-2 border-dashed border-gray-100 rounded-2xl">
                      <CheckCircleIcon className="w-7 h-7 text-gray-200 mb-1.5" />
                      <p className="text-xs text-gray-300 font-medium">All clear</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
