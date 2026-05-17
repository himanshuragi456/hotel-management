import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  MinusIcon, PlusIcon, XMarkIcon, ShoppingBagIcon, CheckCircleIcon,
  ClockIcon, BoltIcon, FireIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { getCustomerMenu, customerPlaceOrder, getOrderStatus } from '@/services/restaurantService'
import PoweredByBanner from '@/components/shared/PoweredByBanner'

const VEG_DOT    = <span className="w-3.5 h-3.5 rounded-sm border-2 border-green-600 flex items-center justify-center flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-green-600" /></span>
const NONVEG_DOT = <span className="w-3.5 h-3.5 rounded-sm border-2 border-red-600 flex items-center justify-center flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-red-600" /></span>
const VEGAN_DOT  = <span className="w-3.5 h-3.5 rounded-sm border-2 border-emerald-600 flex items-center justify-center flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /></span>
const typeIcon = { veg: VEG_DOT, 'non-veg': NONVEG_DOT, vegan: VEGAN_DOT }

// ── Cart components ────────────────────────────────────────────────────────────

function CartBar({ cart, onOpen }) {
  const count = cart.reduce((s, x) => s + x.quantity, 0)
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)
  if (!count) return null
  return (
    <div className="fixed bottom-4 left-0 right-0 flex justify-center px-4 z-30">
      <button onClick={onOpen}
        className="w-full max-w-md bg-orange-500 text-white rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-xl">
        <span className="bg-orange-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">{count}</span>
        <span className="font-semibold">View Order</span>
        <span className="font-semibold">₹{total.toFixed(0)}</span>
      </button>
    </div>
  )
}

function CartSheet({ cart, onClose, onUpdateQty, onPlaceOrder, placing }) {
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)
  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-gray-900">Your Order</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"><XMarkIcon className="w-4 h-4" /></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {cart.map(item => (
            <div key={item.menu_item_id} className="flex items-center justify-between">
              <div className="flex-1">
                <div className="font-medium text-gray-900 text-sm">{item.name}</div>
                <div className="text-xs text-gray-400">₹{item.price} each</div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => onUpdateQty(item.menu_item_id, -1)}
                  className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition-colors"><MinusIcon className="w-3.5 h-3.5" /></button>
                <span className="font-semibold w-5 text-center">{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.menu_item_id, 1)}
                  className="w-8 h-8 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"><PlusIcon className="w-3.5 h-3.5" /></button>
              </div>
              <div className="text-sm font-semibold w-16 text-right">₹{(item.price * item.quantity).toFixed(0)}</div>
            </div>
          ))}
        </div>
        <div className="border-t pt-4">
          <div className="flex justify-between text-lg font-bold text-gray-900 mb-4">
            <span>Total</span><span>₹{total.toFixed(0)}</span>
          </div>
          <button onClick={onPlaceOrder} disabled={placing}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50">
            {placing ? 'Placing Order…' : 'Place Order'}
          </button>
          <p className="text-xs text-gray-400 text-center mt-3">Your order will go directly to the kitchen</p>
        </div>
      </div>
    </div>
  )
}

// ── Order tracker components ───────────────────────────────────────────────────

const STATUS_STEPS = ['pending', 'preparing', 'ready', 'served']

const STATUS_META = {
  pending:   { label: 'In Kitchen Queue', Icon: ClockIcon,        color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  preparing: { label: 'Preparing',        Icon: FireIcon,         color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200'   },
  ready:     { label: 'Ready to Serve',   Icon: CheckCircleIcon,  color: 'text-green-600',  bg: 'bg-green-50',  border: 'border-green-200'  },
  served:    { label: 'Served',           Icon: SparklesIcon,     color: 'text-gray-500',   bg: 'bg-gray-50',   border: 'border-gray-200'   },
}

const READY_MADE_META = { label: 'Instant Item', Icon: BoltIcon, color: 'text-purple-600', bg: 'bg-purple-50', border: 'border-purple-200' }

function StatusStep({ step, active, done }) {
  return (
    <div className="flex items-center gap-2">
      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 transition-colors ${
        done ? 'bg-green-500 text-white' : active ? 'bg-orange-500 text-white' : 'bg-gray-200 text-gray-400'
      }`}>
        {done
          ? <CheckCircleIcon className="w-4 h-4" />
          : (() => { const I = STATUS_META[step]?.Icon; return I ? <I className="w-4 h-4" /> : null })()
        }
      </div>
      <span className={`text-sm ${active ? 'font-semibold text-gray-900' : done ? 'text-gray-400 line-through' : 'text-gray-400'}`}>
        {STATUS_META[step]?.label}
      </span>
    </div>
  )
}

function BatchCard({ batch, total }) {
  const isReadyMade = batch.is_ready_made
  const meta = isReadyMade ? READY_MADE_META : (STATUS_META[batch.status] ?? STATUS_META.pending)
  const currentStep = STATUS_STEPS.indexOf(batch.status)

  return (
    <div className={`rounded-2xl border ${meta.border} ${meta.bg} p-4 mb-3`}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          {meta.Icon && <meta.Icon className={`w-5 h-5 ${meta.color}`} />}
          <div>
            <p className="font-semibold text-gray-900 text-sm">
              {total > 1 ? (isReadyMade ? 'Instant Items' : 'Kitchen Order') : 'Your Order'}
            </p>
            <p className="text-xs text-gray-400 font-mono">{batch.order_number}</p>
          </div>
        </div>
        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${meta.bg} ${meta.color} border ${meta.border}`}>
          {meta.label}
        </span>
      </div>

      {batch.status === 'pending' && batch.queue_position != null && (
        <div className="bg-yellow-100 border border-yellow-300 rounded-xl px-3 py-2 mb-3 flex items-center gap-2">
          <span className="text-lg font-bold text-yellow-700">#{batch.queue_position}</span>
          <span className="text-xs text-yellow-700">in kitchen queue</span>
        </div>
      )}

      {!isReadyMade && (
        <div className="flex flex-col gap-2 mb-3 pl-1">
          {STATUS_STEPS.filter(s => s !== 'served' || batch.status === 'served').map((step, i) => (
            <StatusStep key={step} step={step} active={batch.status === step} done={i < currentStep} />
          ))}
        </div>
      )}

      <div className="border-t border-black/5 pt-3 space-y-1">
        {batch.items?.map((item, i) => (
          <div key={i} className="flex justify-between text-sm">
            <span className="text-gray-700">{item.name} <span className="text-gray-400">×{item.quantity}</span></span>
            <span className="text-gray-700 font-medium">₹{item.subtotal}</span>
          </div>
        ))}
        <div className="flex justify-between text-sm font-bold text-gray-900 pt-1 border-t border-black/5">
          <span>Batch total</span>
          <span>₹{batch.total}</span>
        </div>
      </div>
    </div>
  )
}

function OrdersTab({ sessionOrders, onOrderMore }) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-tracker', sessionOrders],
    queryFn: () => getOrderStatus(sessionOrders).then(r => r.data.data),
    enabled: !!sessionOrders,
    refetchInterval: (query) => {
      const batches = query.state.data?.batches
      return batches?.every(b => b.status === 'served') ? false : 6000
    },
  })

  const batches = data?.batches ?? []
  const allDone = batches.length > 0 && batches.every(b => b.status === 'served')

  if (!sessionOrders) return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="w-16 h-16 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
        <ShoppingBagIcon className="w-8 h-8 text-gray-300" />
      </div>
      <p className="font-semibold text-gray-700">No orders yet</p>
      <p className="text-sm text-gray-400 mt-1">Switch to Menu and place your first order.</p>
    </div>
  )

  return (
    <div className="px-4 py-5 pb-10">
      {allDone ? (
        <div className="text-center py-6">
          <div className="w-14 h-14 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
            <CheckCircleIcon className="w-8 h-8 text-green-500" />
          </div>
          <p className="font-semibold text-gray-800">Enjoy your meal!</p>
          <p className="text-sm text-gray-400 mt-1">Everything has been served.</p>
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center mb-4">Auto-refreshing every 6 seconds</p>
      )}

      {isLoading && batches.length === 0 ? (
        <div className="text-center py-10 text-gray-400 text-sm animate-pulse">Loading your orders…</div>
      ) : (
        batches.map((batch, i) => (
          <BatchCard key={batch.order_number} batch={batch} total={batches.length} />
        ))
      )}

      {data?.grand_total != null && batches.length > 1 && (
        <div className="mt-2 bg-white rounded-2xl border border-gray-200 px-4 py-3 flex justify-between text-sm font-bold text-gray-900">
          <span>Session Total</span>
          <span>₹{data.grand_total}</span>
        </div>
      )}

      <button onClick={onOrderMore}
        className="mt-4 w-full bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold py-4 rounded-2xl shadow-md transition-colors">
        + Order More Items
      </button>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CustomerMenuPage() {
  const { slug, token } = useParams()
  const [tab, setTab] = useState('menu')
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [activeCat, setActiveCat] = useState(null)
  const [sessionOrders, setSessionOrders] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-menu', slug, token],
    queryFn: () => getCustomerMenu(slug, token).then(r => r.data.data),
  })

  // Seed sessionOrders from server on load / table status change
  useEffect(() => {
    if (!data) return
    if (data.table?.status === 'free') {
      setSessionOrders(null)
    } else if (data.active_order_numbers) {
      setSessionOrders(prev => {
        // Merge any orders placed this React session with what the server knows about
        if (!prev) return data.active_order_numbers
        const merged = [...new Set([...prev.split(','), ...data.active_order_numbers.split(',')])]
        return merged.join(',')
      })
    }
  }, [data])

  const placeOrder = useMutation({
    mutationFn: ({ slug, token, items }) => customerPlaceOrder(slug, token, { items }),
    onSuccess: (res) => {
      const d = res.data.data
      const newNumbers = d?.order_numbers ?? d?.order_number
      setSessionOrders(prev => prev ? `${prev},${newNumbers}` : newNumbers)
      setCart([])
      setShowCart(false)
      setTab('orders')
    },
  })

  const addToCart = (item) => {
    setCart(c => {
      const ex = c.find(x => x.menu_item_id === item.id)
      if (ex) return c.map(x => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x)
      return [...c, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }]
    })
  }

  const updateQty = (id, delta) =>
    setCart(c => c.map(x => x.menu_item_id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center">
        <div className="text-4xl mb-4 animate-bounce">🍽</div>
        <p className="text-gray-400">Loading menu…</p>
      </div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
      <div>
        <div className="text-4xl mb-4">😕</div>
        <p className="font-semibold text-gray-800">Menu unavailable</p>
        <p className="text-sm text-gray-400 mt-1">This QR code may be invalid or expired.</p>
      </div>
    </div>
  )

  const { tenant, table, categories } = data ?? {}
  const activeCatId = activeCat ?? categories?.[0]?.id
  const activeCatData = categories?.find(c => c.id === activeCatId)
  const orderingEnabled = tenant?.qr_ordering_enabled !== false
  const cartCount = cart.reduce((s, x) => s + x.quantity, 0)

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="bg-white px-5 pt-6 pb-0 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">{tenant?.name}</h1>
        <p className="text-sm text-gray-500 mb-3">Table {table?.number}{table?.section ? ` · ${table.section}` : ''}</p>

        {/* Tab bar */}
        <div className="flex border-b border-gray-100">
          <button
            onClick={() => setTab('menu')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'menu' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400'
            }`}>
            Menu
            {orderingEnabled && cartCount > 0 && (
              <span className="ml-1.5 bg-orange-500 text-white text-xs font-bold px-1.5 py-0.5 rounded-full">{cartCount}</span>
            )}
          </button>
          <button
            onClick={() => setTab('orders')}
            className={`flex-1 py-3 text-sm font-semibold border-b-2 transition-colors ${
              tab === 'orders' ? 'border-orange-500 text-orange-500' : 'border-transparent text-gray-400'
            }`}>
            My Orders
            {sessionOrders && (
              <span className="ml-1.5 inline-block w-2 h-2 rounded-full bg-green-500" />
            )}
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto">
        {tab === 'menu' ? (
          <div className={orderingEnabled ? 'pb-24' : 'pb-6'}>
            {!orderingEnabled && (
              <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-medium text-amber-800">Menu is view-only</p>
                <p className="text-xs text-amber-600 mt-0.5">Online ordering is not available. Please ask a staff member.</p>
              </div>
            )}

            {/* Category tabs */}
            <div className="bg-white border-b sticky top-0 z-10">
              <div className="flex gap-2 px-4 py-3 overflow-x-auto">
                {categories?.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                    className={`shrink-0 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap ${
                      activeCatId === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                    }`}>
                    {cat.name}
                  </button>
                ))}
              </div>
            </div>

            {/* Items */}
            <div className="px-4 py-4 space-y-3">
              {activeCatData?.items?.map(item => {
                const inCart = cart.find(x => x.menu_item_id === item.id)
                return (
                  <div key={item.id} className="bg-white rounded-2xl overflow-hidden flex shadow-sm">
                    {item.image && <img src={`/storage/${item.image}`} className="w-24 h-24 object-cover shrink-0" />}
                    <div className="flex-1 p-3 flex flex-col justify-between">
                      <div>
                        <div className="flex items-center gap-1 mb-0.5">
                          <span className="text-xs">{typeIcon[item.type]}</span>
                          <span className="font-semibold text-gray-900">{item.name}</span>
                        </div>
                        {item.description && <p className="text-xs text-gray-400 line-clamp-2">{item.description}</p>}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-gray-900">₹{item.price}</span>
                        {orderingEnabled && (inCart ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center">−</button>
                            <span className="font-semibold w-4 text-center">{inCart.quantity}</span>
                            <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">+</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(item)} className="bg-orange-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full">
                            Add
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        ) : (
          <OrdersTab sessionOrders={sessionOrders} onOrderMore={() => setTab('menu')} />
        )}
      </div>

      {tab === 'menu' && orderingEnabled && <CartBar cart={cart} onOpen={() => setShowCart(true)} />}

      {showCart && (
        <CartSheet
          cart={cart}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateQty}
          placing={placeOrder.isPending}
          onPlaceOrder={() => placeOrder.mutate({ slug, token, items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })) })}
        />
      )}

      <div className="px-4 pb-6">
        <PoweredByBanner />
      </div>
    </div>
  )
}
