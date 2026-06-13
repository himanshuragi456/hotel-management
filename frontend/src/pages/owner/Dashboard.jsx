import { useQuery } from '@tanstack/react-query'
import {
  BanknotesIcon, ShoppingBagIcon, ReceiptPercentIcon, ArrowTrendingUpIcon,
  BuildingOfficeIcon, UsersIcon, ArrowDownTrayIcon, ArrowUpTrayIcon,
  ClockIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { getTodayRevenue, getLiveOrders } from '@/services/restaurantService'
import Badge from '@/components/shared/Badge'
import useAuthStore from '@/store/authStore'

const CARD_CONFIGS = {
  revenue:    { icon: BanknotesIcon,        gradient: 'from-emerald-500 to-teal-600',   bg: 'bg-emerald-50',  text: 'text-emerald-700' },
  orders:     { icon: ShoppingBagIcon,      gradient: 'from-blue-500 to-indigo-600',    bg: 'bg-blue-50',     text: 'text-blue-700'    },
  expenses:   { icon: ReceiptPercentIcon,   gradient: 'from-rose-500 to-red-600',       bg: 'bg-rose-50',     text: 'text-rose-700'    },
  profit:     { icon: ArrowTrendingUpIcon,  gradient: 'from-violet-500 to-purple-600',  bg: 'bg-violet-50',   text: 'text-violet-700'  },
  rooms:      { icon: BuildingOfficeIcon,   gradient: 'from-sky-500 to-blue-600',       bg: 'bg-sky-50',      text: 'text-sky-700'     },
  guests:     { icon: UsersIcon,            gradient: 'from-amber-500 to-orange-600',   bg: 'bg-amber-50',    text: 'text-amber-700'   },
  checkin:    { icon: ArrowDownTrayIcon,    gradient: 'from-green-500 to-emerald-600',  bg: 'bg-green-50',    text: 'text-green-700'   },
  checkout:   { icon: ArrowUpTrayIcon,      gradient: 'from-gray-400 to-gray-600',      bg: 'bg-gray-100',    text: 'text-gray-600'    },
  outstanding:{ icon: ClockIcon,            gradient: 'from-orange-500 to-amber-600',   bg: 'bg-orange-50',   text: 'text-orange-700'  },
}

function StatCard({ label, value, sub, type = 'revenue' }) {
  const cfg = CARD_CONFIGS[type] ?? CARD_CONFIGS.revenue
  const Icon = cfg.icon
  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <div className={`w-10 h-10 rounded-xl ${cfg.bg} flex items-center justify-center`}>
          <Icon className={`w-5 h-5 ${cfg.text}`} />
        </div>
      </div>
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  )
}

function SectionLabel({ children }) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className="h-px flex-1 bg-gray-100" />
      <p className="text-xs font-bold text-gray-400 uppercase tracking-widest whitespace-nowrap">{children}</p>
      <div className="h-px flex-1 bg-gray-100" />
    </div>
  )
}

const STATUS_DOT = {
  pending:   'bg-amber-400',
  preparing: 'bg-blue-500',
  ready:     'bg-emerald-500',
  served:    'bg-gray-300',
}

function OrderCard({ order, label, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-2.5">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{label}</p>
          {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
        </div>
        <div className="flex items-center gap-2">
          <span className={`w-2 h-2 rounded-full ${STATUS_DOT[order.status] ?? 'bg-gray-200'}`} />
          <Badge value={order.status} />
        </div>
      </div>
      <div className="space-y-1 mb-3">
        {order.items?.slice(0, 3).map((item, i) => (
          <div key={i} className="flex items-center gap-2 text-xs text-gray-500">
            <span className="w-5 h-5 rounded-md bg-gray-100 flex items-center justify-center font-bold text-gray-700 text-[10px] flex-shrink-0">{item.quantity}</span>
            <span className="truncate">{item.item_name}</span>
          </div>
        ))}
        {(order.items?.length ?? 0) > 3 && (
          <p className="text-xs text-gray-400">+{order.items.length - 3} more items</p>
        )}
      </div>
      <div className="flex items-center justify-between pt-2.5 border-t border-gray-50">
        <span className="text-xs text-gray-400 flex items-center gap-1">
          <ClockIcon className="w-3.5 h-3.5" />{order.elapsed_label ?? '—'}
        </span>
        <span className="text-sm font-bold text-gray-900">₹{order.total}</span>
      </div>
    </div>
  )
}

function LiveSection({ title, orders, labelFn, subFn }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-800">{title}</h3>
        <span className="text-xs font-semibold text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{orders.length}</span>
      </div>
      {orders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-2xl border border-dashed border-gray-200">
          <CheckCircleIcon className="w-8 h-8 text-gray-200 mb-2" />
          <p className="text-sm text-gray-400">No active orders right now</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {orders.map(o => (
            <OrderCard key={o.id} order={o} label={labelFn(o)} sub={subFn?.(o)} />
          ))}
        </div>
      )}
    </div>
  )
}

export default function OwnerDashboard() {
  const { user } = useAuthStore()
  const modules = user?.modules
  const hasRestaurant = !!modules?.restaurant
  const hasHotel = !!modules?.hotel

  const { data: rev, isLoading: revLoading } = useQuery({
    queryKey: ['today-revenue'],
    queryFn: () => getTodayRevenue().then(r => r.data.data),
    refetchInterval: 30000,
  })
  const { data: orders } = useQuery({
    queryKey: ['live-orders'],
    queryFn: () => getLiveOrders().then(r => r.data.data),
    refetchInterval: 10000,
  })

  const isOffPremise = o => o.source === 'aggregator' || o.type === 'takeaway' || o.source === 'takeaway'
  const dineIn   = (orders ?? []).filter(o => o.type !== 'room-service' && !isOffPremise(o))
  const offPrem  = (orders ?? []).filter(o => o.type !== 'room-service' && isOffPremise(o))
  const roomSvc  = (orders ?? []).filter(o => o.type === 'room-service')

  const PLATFORM_LABEL = { zomato: 'Zomato', swiggy: 'Swiggy' }
  const offPremiseLabel = o => {
    if (o.source === 'aggregator') {
      const name = PLATFORM_LABEL[o.platform] ?? 'Aggregator'
      return o.external_order_id ? `${name} · #${o.external_order_id}` : name
    }
    return o.customer_name ? `Takeaway · ${o.customer_name}` : 'Takeaway'
  }
  const net = rev?.net ?? 0
  const isProfit = net >= 0

  return (
    <div className="space-y-8">
      {/* Page header */}
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Today's Overview</h2>
        <p className="text-sm text-gray-400 mt-0.5">Live stats · refreshes every 30s</p>
      </div>

      {/* Restaurant KPIs */}
      {hasRestaurant && (
        <>
          {hasHotel && <SectionLabel>Restaurant</SectionLabel>}
          {revLoading ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[1,2,3,4].map(i => (
                <div key={i} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse">
                  <div className="h-3 w-20 bg-gray-100 rounded mb-3" />
                  <div className="h-7 w-28 bg-gray-100 rounded" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <StatCard label="Food Revenue"  value={`₹${(rev?.food_revenue ?? 0).toLocaleString()}`}  type="revenue" />
              <StatCard label="Orders"        value={rev?.order_count ?? 0}                              type="orders" />
              <StatCard label="Expenses"      value={`₹${(rev?.expenses ?? 0).toLocaleString()}`}       type="expenses" />
              <StatCard label="Net Profit"    value={`₹${Math.abs(net).toLocaleString()}`}              type={isProfit ? 'profit' : 'expenses'}
                sub={isProfit ? undefined : 'running at a loss'} />
            </div>
          )}
        </>
      )}

      {/* Hotel KPIs */}
      {hasHotel && (
        <>
          {hasRestaurant && <SectionLabel>Hotel</SectionLabel>}
          {!hasRestaurant && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard label="Room Revenue"       value={`₹${(rev?.room_revenue ?? 0).toLocaleString()}`}        type="revenue" />
              <StatCard label="Expenses"           value={`₹${(rev?.expenses ?? 0).toLocaleString()}`}            type="expenses" />
              <StatCard label="Net Profit"         value={`₹${Math.abs(net).toLocaleString()}`}                   type={isProfit ? 'profit' : 'expenses'} />
              <StatCard label="Outstanding"        value={`₹${(rev?.outstanding_balance ?? 0).toLocaleString()}`} type="outstanding" sub="from active guests" />
            </div>
          )}
          {hasRestaurant && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
              <StatCard label="Room Revenue"  value={`₹${(rev?.room_revenue ?? 0).toLocaleString()}`}        type="revenue" />
              <StatCard label="Outstanding"   value={`₹${(rev?.outstanding_balance ?? 0).toLocaleString()}`} type="outstanding" sub="from active guests" />
              <StatCard label="Check-ins"     value={rev?.checkins_today ?? 0}   type="checkin" />
              <StatCard label="Check-outs"    value={rev?.checkouts_today ?? 0}  type="checkout" />
            </div>
          )}
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            <StatCard label="Occupancy" type="rooms"
              value={`${rev?.occupied_rooms ?? 0} / ${rev?.total_rooms ?? 0}`}
              sub={`${rev?.active_guests ?? 0} active guest${(rev?.active_guests ?? 0) !== 1 ? 's' : ''}`} />
            {!hasRestaurant && <>
              <StatCard label="Check-ins Today"  value={rev?.checkins_today ?? 0}  type="checkin" />
              <StatCard label="Check-outs Today" value={rev?.checkouts_today ?? 0} type="checkout" />
            </>}
          </div>
        </>
      )}

      {/* Live orders */}
      {hasRestaurant && (
        <LiveSection title="Live Dine-in Orders" orders={dineIn}
          labelFn={o => o.table?.number ? `Table ${o.table.number}` : 'Dine-in'} />
      )}
      {hasRestaurant && offPrem.length > 0 && (
        <LiveSection title="Live Takeaway & Delivery" orders={offPrem}
          labelFn={offPremiseLabel}
          subFn={o => o.source === 'aggregator' && o.customer_name ? o.customer_name : undefined} />
      )}
      {hasHotel && (
        <LiveSection title="Live Room Service" orders={roomSvc}
          labelFn={o => `Room ${o.booking?.room?.number ?? o.room_id ?? '?'}`}
          subFn={o => o.booking?.guest?.name} />
      )}
    </div>
  )
}
