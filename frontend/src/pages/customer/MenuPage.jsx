import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  MinusIcon, PlusIcon, XMarkIcon, ShoppingBagIcon, CheckCircleIcon,
  ClockIcon, BoltIcon, FireIcon, SparklesIcon, ChevronRightIcon,
} from '@heroicons/react/24/outline'
import Pusher from 'pusher-js'
import { getCustomerMenu, customerPlaceOrder, getOrderStatus, customerRequestBill, customerCallWaiter } from '@/services/restaurantService'
import PoweredByBanner from '@/components/shared/PoweredByBanner'
import TenantSuspendedScreen from '@/components/shared/TenantSuspendedScreen'

const VEG_DOT    = <span className="w-3.5 h-3.5 rounded-sm border-2 border-green-600 flex items-center justify-center flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-green-600" /></span>
const NONVEG_DOT = <span className="w-3.5 h-3.5 rounded-sm border-2 border-red-600 flex items-center justify-center flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-red-600" /></span>
const VEGAN_DOT  = <span className="w-3.5 h-3.5 rounded-sm border-2 border-emerald-600 flex items-center justify-center flex-shrink-0"><span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /></span>
const typeIcon = { veg: VEG_DOT, 'non-veg': NONVEG_DOT, vegan: VEGAN_DOT }

// ── Cart components ────────────────────────────────────────────────────────────

function CartBar({ cart, onOpen, onViewOrders, sessionOrders, onRequestBill, billRequestEnabled, billRequested, billRequesting, allServed, unpaidTotal, onCallWaiter, waiterCalled, waiterCalling }) {
  const count = cart.reduce((s, x) => s + x.quantity, 0)
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)
  const showRequestBill = sessionOrders && billRequestEnabled && allServed && unpaidTotal > 0
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-5 pt-2 bg-gradient-to-t from-gray-100 via-gray-100/90 to-transparent pointer-events-none">
      <div className="pointer-events-auto space-y-2 max-w-md mx-auto">
        {sessionOrders && (
          <button onClick={onViewOrders}
            className="w-full bg-white border border-orange-200 text-orange-600 rounded-2xl px-5 py-3 flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-2 font-semibold text-sm">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
              Track My Orders
            </span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        )}
        {/* Call Waiter — always when session active */}
        {sessionOrders && (
          <button onClick={onCallWaiter} disabled={waiterCalled || waiterCalling}
            className={`w-full rounded-2xl px-5 py-3 flex items-center justify-center gap-2 font-semibold text-sm shadow-sm transition-colors ${
              waiterCalled
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}>
            {waiterCalled ? <>🔔 Waiter called — on the way!</> : waiterCalling ? <>Calling…</> : <>🔔 Call Waiter</>}
          </button>
        )}
        {showRequestBill && (
          <button onClick={onRequestBill} disabled={billRequested || billRequesting}
            className={`w-full rounded-2xl px-5 py-3 flex items-center justify-center gap-2 font-semibold text-sm shadow-sm transition-colors ${
              billRequested
                ? 'bg-green-100 text-green-700 border border-green-200'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}>
            {billRequested ? <>✅ Bill requested — staff is on the way</> : billRequesting ? <>Requesting…</> : <>🧾 Request Bill</>}
          </button>
        )}
        {count > 0 && (
          <button onClick={onOpen}
            className="w-full bg-orange-500 text-white rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-xl">
            <span className="bg-orange-700 text-white text-xs font-bold px-2 py-0.5 rounded-full">{count} items</span>
            <span className="font-semibold">View Cart</span>
            <span className="font-semibold">₹{total.toFixed(0)}</span>
          </button>
        )}
      </div>
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
          <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
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

const TRACK_STEPS = [
  { key: 'pending',   emoji: '🧾', label: 'Received'  },
  { key: 'preparing', emoji: '👨‍🍳', label: 'Preparing' },
  { key: 'ready',     emoji: '🔔', label: 'Ready!'    },
  { key: 'served',    emoji: '✅', label: 'Served'    },
]

const STATUS_CONFIG = {
  pending: {
    heroBg:   'from-amber-400 to-orange-400',
    heroText: 'text-white',
    pill:     'bg-amber-100 text-amber-700',
    icon:     '🧾',
    headline: 'Order received!',
    sub:      'Your order is in the kitchen queue.',
  },
  preparing: {
    heroBg:   'from-blue-500 to-indigo-500',
    heroText: 'text-white',
    pill:     'bg-blue-100 text-blue-700',
    icon:     '👨‍🍳',
    headline: 'Cooking now…',
    sub:      'The kitchen is preparing your food.',
  },
  ready: {
    heroBg:   'from-emerald-400 to-green-500',
    heroText: 'text-white',
    pill:     'bg-green-100 text-green-700',
    icon:     '🔔',
    headline: 'Ready to serve!',
    sub:      'Your food is on its way to the table.',
  },
  served: {
    heroBg:   'from-gray-200 to-gray-300',
    heroText: 'text-gray-600',
    pill:     'bg-gray-100 text-gray-500',
    icon:     '✅',
    headline: 'Served',
    sub:      'Enjoy your meal!',
  },
}

function ProgressBar({ status }) {
  const idx = TRACK_STEPS.findIndex(s => s.key === status)
  return (
    <div className="flex items-start gap-0 w-full">
      {TRACK_STEPS.map((step, i) => {
        const done    = i < idx
        const active  = i === idx
        const future  = i > idx
        const isLast  = i === TRACK_STEPS.length - 1
        return (
          <div key={step.key} className="flex flex-col items-center flex-1">
            {/* connector + dot row */}
            <div className="flex items-center w-full">
              {/* left line */}
              <div className={`flex-1 h-0.5 ${i === 0 ? 'invisible' : done || active ? 'bg-white/70' : 'bg-white/20'}`} />
              {/* dot */}
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 transition-all ${
                done   ? 'bg-white/30 text-white'
                : active ? 'bg-white shadow-lg scale-110'
                : 'bg-white/15 text-white/50'
              }`}>
                {done ? '✓' : step.emoji}
              </div>
              {/* right line */}
              <div className={`flex-1 h-0.5 ${isLast ? 'invisible' : done ? 'bg-white/70' : 'bg-white/20'}`} />
            </div>
            <span className={`text-[10px] mt-1 font-semibold ${active ? 'text-white' : done ? 'text-white/70' : 'text-white/35'}`}>
              {step.label}
            </span>
          </div>
        )
      })}
    </div>
  )
}

function BatchCard({ batch, batchNum, totalBatches }) {
  const isReadyMade = batch.is_ready_made
  const cfg = STATUS_CONFIG[batch.status] ?? STATUS_CONFIG.pending
  const isServed = batch.status === 'served'
  const isPaid = batch.payment_status === 'paid'

  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm mb-4">
      {/* Hero gradient */}
      <div className={`bg-gradient-to-br ${cfg.heroBg} px-5 pt-5 pb-6`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            {totalBatches > 1 && (
              <p className="text-white/70 text-xs font-semibold uppercase tracking-widest mb-0.5">
                Order {batchNum} of {totalBatches}
              </p>
            )}
            <p className={`text-lg font-bold ${cfg.heroText}`}>{cfg.headline}</p>
            <p className={`text-sm ${cfg.heroText} opacity-80`}>{cfg.sub}</p>
          </div>
          {isPaid ? (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-emerald-500 text-white shadow-sm">
              ✓ Paid
            </span>
          ) : (
            <span className="text-xs font-bold px-3 py-1.5 rounded-full bg-rose-500 text-white shadow-sm">
              Unpaid
            </span>
          )}
        </div>

        {/* Queue position badge */}
        {batch.status === 'pending' && batch.queue_position != null && (
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 mb-3">
            <span className="text-white font-bold text-sm">#{batch.queue_position}</span>
            <span className="text-white/80 text-xs">in queue</span>
          </div>
        )}

        {/* Progress bar — not for ready-made */}
        {!isReadyMade && (
          <div className="mt-3">
            <ProgressBar status={batch.status} />
          </div>
        )}

        {isReadyMade && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1">
            <BoltIcon className="w-3.5 h-3.5 text-white" />
            <span className="text-white text-xs font-semibold">Instant item · {isServed ? 'Served' : 'Ready'}</span>
          </div>
        )}
      </div>

      {/* Items list */}
      <div className="px-5 py-4">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">Items</p>
        <div className="space-y-2">
          {batch.items?.map((item, i) => (
            <div key={i} className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-lg bg-orange-50 text-orange-500 text-xs font-bold flex items-center justify-center shrink-0">
                  {item.quantity}
                </span>
                <span className="text-sm text-gray-800 font-medium">{item.name}</span>
              </div>
              <span className="text-sm text-gray-500 font-medium tabular-nums">₹{Number(item.subtotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
          <span className="text-sm font-semibold text-gray-500">Subtotal</span>
          <span className="text-base font-bold text-gray-900 tabular-nums">₹{Number(batch.total).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
        </div>
      </div>

      {/* Order number footer */}
      <div className="px-5 pb-4">
        <p className="text-[10px] text-gray-300 font-mono">{batch.order_number}</p>
      </div>
    </div>
  )
}

function OrdersView({ sessionOrders, onOrderMore, onRequestBill, billRequestEnabled, billRequested, billRequesting, onAllServedChange, onUnpaidTotalChange, tenantId, tableId, onCallWaiter, waiterCalled, waiterCalling }) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['order-tracker', sessionOrders],
    queryFn: () => getOrderStatus(sessionOrders).then(r => r.data.data),
    enabled: !!sessionOrders,
  })

  // Pusher: subscribe to this table's channel and refetch on any order update
  useEffect(() => {
    if (!tenantId || !tableId) return
    const pusherConfig = { cluster: import.meta.env.VITE_PUSHER_CLUSTER ?? 'mt1' }
    if (import.meta.env.VITE_PUSHER_HOST) {
      pusherConfig.wsHost = import.meta.env.VITE_PUSHER_HOST
      pusherConfig.wsPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      pusherConfig.wssPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      pusherConfig.forceTLS = (import.meta.env.VITE_PUSHER_SCHEME ?? 'http') === 'https'
      pusherConfig.disableStats = true
      pusherConfig.enabledTransports = ['ws']
    }
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, pusherConfig)
    const channel = pusher.subscribe(`tenant.${tenantId}.table.${tableId}`)
    channel.bind('order.updated', () => refetch())
    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`tenant.${tenantId}.table.${tableId}`)
      pusher.disconnect()
    }
  }, [tenantId, tableId, refetch])

  const batches = data?.batches ?? []
  const allDone = batches.length > 0 && batches.every(b => b.status === 'served')
  const unpaidTotal = batches.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + Number(b.total), 0)

  useEffect(() => { onAllServedChange?.(allDone) }, [allDone])
  useEffect(() => { onUnpaidTotalChange?.(unpaidTotal) }, [unpaidTotal])
  const hasReady = batches.some(b => b.status === 'ready')

  if (!sessionOrders) return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="text-6xl mb-4">🍽️</div>
      <p className="font-bold text-gray-800 text-lg">Nothing ordered yet</p>
      <p className="text-sm text-gray-400 mt-1 mb-6">Head to the menu and place your first order.</p>
      <button onClick={onOrderMore}
        className="bg-orange-500 text-white font-bold px-8 py-3.5 rounded-2xl text-sm shadow-lg shadow-orange-200">
        Browse Menu
      </button>
    </div>
  )

  return (
    <div className="pb-28">
      {/* Status banner */}
      {allDone ? (
        <div className="mx-4 mt-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3 mb-4">
          <span className="text-3xl">🎉</span>
          <div>
            <p className="font-bold text-green-800">All served — enjoy!</p>
            <p className="text-xs text-green-600 mt-0.5">Everything has been brought to your table.</p>
          </div>
        </div>
      ) : hasReady ? (
        <div className="mx-4 mt-4 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl px-5 py-3 flex items-center gap-3 mb-4 shadow-lg shadow-green-200">
          <span className="text-2xl animate-bounce">🔔</span>
          <div>
            <p className="font-bold text-white text-sm">Your food is ready!</p>
            <p className="text-xs text-white/80">A waiter is bringing it to your table.</p>
          </div>
        </div>
      ) : !isLoading && batches.length > 0 ? (
        <div className="mx-4 mt-4 mb-2">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block" />
            {isFetching ? 'Updating…' : 'Live updates'}
          </p>
        </div>
      ) : null}

      {/* Loading skeleton */}
      {isLoading && batches.length === 0 ? (
        <div className="px-4 mt-4 space-y-4">
          {[1, 2].map(i => (
            <div key={i} className="rounded-3xl overflow-hidden">
              <div className="h-36 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse" />
              <div className="bg-white p-5 space-y-3">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4" />
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 mt-2">
          {batches.map((batch, i) => (
            <BatchCard key={batch.order_number} batch={batch} batchNum={i + 1} totalBatches={batches.length} />
          ))}
        </div>
      )}

      {/* Grand total */}
      {batches.length > 0 && (() => {
        const paidTotal   = batches.filter(b => b.payment_status === 'paid').reduce((s, b) => s + Number(b.total), 0)
        const unpaidTotal = batches.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + Number(b.total), 0)
        return (
          <div className="mx-4 bg-gray-900 text-white rounded-2xl px-5 py-4 mb-4 space-y-2">
            {paidTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">Paid online</span>
                <span className="text-emerald-400 font-semibold tabular-nums">₹{paidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            {unpaidTotal > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-400">To pay at counter</span>
                <span className="text-rose-400 font-semibold tabular-nums">₹{unpaidTotal.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            )}
            <div className="flex justify-between items-center pt-2 border-t border-white/10">
              <span className="text-sm font-semibold text-gray-300">Total this visit</span>
              <span className="text-xl font-bold tabular-nums">₹{(paidTotal + unpaidTotal).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
            </div>
          </div>
        )
      })()}

      {/* Call Waiter — always when there are orders */}
      {batches.length > 0 && (
        <div className="px-4 mb-3">
          <button onClick={onCallWaiter} disabled={waiterCalled || waiterCalling}
            className={`w-full font-bold py-4 rounded-2xl text-sm transition-colors ${
              waiterCalled
                ? 'bg-amber-50 border-2 border-amber-300 text-amber-700'
                : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}>
            {waiterCalled ? '🔔 Waiter called — on the way!' : waiterCalling ? 'Calling…' : '🔔 Call Waiter'}
          </button>
        </div>
      )}

      {/* Request Bill — only once everything is served AND unpaid balance > 0 */}
      {billRequestEnabled && allDone && unpaidTotal > 0 && (
        <div className="px-4 mb-3">
          <button onClick={onRequestBill} disabled={billRequested || billRequesting}
            className={`w-full font-bold py-4 rounded-2xl text-sm transition-colors ${
              billRequested
                ? 'bg-green-50 border-2 border-green-300 text-green-700'
                : 'bg-gray-900 text-white hover:bg-gray-800'
            }`}>
            {billRequested ? '✅ Bill requested — staff is on the way' : billRequesting ? 'Requesting…' : '🧾 Request Bill'}
          </button>
        </div>
      )}

      {/* Order more */}
      <div className="px-4">
        <button onClick={onOrderMore}
          className="w-full border-2 border-orange-400 text-orange-500 font-bold py-4 rounded-2xl text-sm hover:bg-orange-50 transition-colors">
          + Add More Items
        </button>
      </div>
    </div>
  )
}

// ── Main page ──────────────────────────────────────────────────────────────────

export default function CustomerMenuPage() {
  const { slug, token } = useParams()
  const [view, setView] = useState('menu') // 'menu' | 'orders'
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [activeCat, setActiveCat] = useState(null)
  const [menuSearch, setMenuSearch] = useState('')
  const [debouncedMenuSearch, setDebouncedMenuSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedMenuSearch(menuSearch), 250)
    return () => clearTimeout(t)
  }, [menuSearch])
  const [sessionOrders, setSessionOrders] = useState(null)
  const [billRequested, setBillRequested] = useState(false)
  const [waiterCalled, setWaiterCalled] = useState(false)
  const [tableCleared, setTableCleared] = useState(false)
  const [allServed, setAllServed] = useState(false)
  const [unpaidTotal, setUnpaidTotal] = useState(0)

  const { data, isLoading, error, refetch: refetchMenu } = useQuery({
    queryKey: ['customer-menu', slug, token],
    queryFn: () => getCustomerMenu(slug, token).then(r => r.data.data),
  })

  // Listen on the table channel to also detect table-cleared (billing closed)
  useEffect(() => {
    const tenantId = data?.tenant_id
    const tableId  = data?.table?.id
    if (!tenantId || !tableId || !sessionOrders) return
    const pusherConfig = { cluster: import.meta.env.VITE_PUSHER_CLUSTER ?? 'mt1' }
    if (import.meta.env.VITE_PUSHER_HOST) {
      pusherConfig.wsHost = import.meta.env.VITE_PUSHER_HOST
      pusherConfig.wsPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      pusherConfig.wssPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      pusherConfig.forceTLS = (import.meta.env.VITE_PUSHER_SCHEME ?? 'http') === 'https'
      pusherConfig.disableStats = true
      pusherConfig.enabledTransports = ['ws']
    }
    const pusher = new Pusher(import.meta.env.VITE_PUSHER_KEY, pusherConfig)
    const channel = pusher.subscribe(`tenant.${tenantId}.table.${tableId}`)
    channel.bind('order.updated', () => refetchMenu())
    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`tenant.${tenantId}.table.${tableId}`)
      pusher.disconnect()
    }
  }, [data?.tenant_id, data?.table?.id, sessionOrders, refetchMenu])

  useEffect(() => {
    if (!data) return
    if (data.table?.status === 'free' && sessionOrders) {
      // Table was closed by billing — show thank-you screen then reset
      setTableCleared(true)
      setBillRequested(false)
      setTimeout(() => {
        setSessionOrders(null)
        setView('menu')
        setTableCleared(false)
        setCart([])
        setAllServed(false)
      }, 4000)
    } else if (data.active_order_numbers) {
      setSessionOrders(prev => {
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
      setView('orders')
    },
  })

  const requestBill = useMutation({
    mutationFn: () => customerRequestBill(slug, token),
    onSuccess: () => setBillRequested(true),
  })

  const callWaiter = useMutation({
    mutationFn: () => customerCallWaiter(slug, token),
    onSuccess: () => {
      setWaiterCalled(true)
      // Reset after 60 seconds so customer can call again if needed
      setTimeout(() => setWaiterCalled(false), 60_000)
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

  if (error) {
    const errData = error?.response?.data
    if (errData?.message === 'tenant_suspended') {
      return <TenantSuspendedScreen tenantName={errData.tenant_name} branding={errData.branding} />
    }
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <div>
          <div className="text-4xl mb-4">😕</div>
          <p className="font-semibold text-gray-800">Menu unavailable</p>
          <p className="text-sm text-gray-400 mt-1">This QR code may be invalid or expired.</p>
        </div>
      </div>
    )
  }

  const { tenant, table, categories } = data ?? {}
  const activeCatId = activeCat ?? categories?.[0]?.id
  const activeCatData = categories?.find(c => c.id === activeCatId)
  const allMenuItems = categories?.flatMap(c => c.items ?? []) ?? []
  const searchedItems = debouncedMenuSearch.trim()
    ? allMenuItems.filter(i => i.name.toLowerCase().includes(debouncedMenuSearch.toLowerCase()))
    : activeCatData?.items ?? []
  const orderingEnabled = tenant?.qr_ordering_enabled !== false
  const billRequestEnabled = tenant?.customer_bill_request_enabled !== false
  const cartCount = cart.reduce((s, x) => s + x.quantity, 0)

  if (tableCleared) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center max-w-lg mx-auto px-6 text-center">
      <div className="animate-bounce text-7xl mb-6">🙏</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank you for visiting!</h2>
      <p className="text-gray-500 text-sm mb-8">Your bill has been settled. We hope to see you again soon.</p>
      <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
        <p className="text-sm font-semibold text-gray-700">{tenant?.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">Table {table?.number}{table?.section ? ` · ${table.section}` : ''}</p>
      </div>
      <p className="text-xs text-gray-400 mt-6">Returning to menu in a moment…</p>
      <PoweredByBanner />
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col max-w-lg mx-auto">

      {/* ── Header ── */}
      <div className="bg-white px-5 pt-5 pb-0 shadow-sm sticky top-0 z-20">
        <div className="flex items-start justify-between mb-1">
          <div>
            <h1 className="text-lg font-bold text-gray-900 leading-tight">{tenant?.name}</h1>
            <p className="text-xs text-gray-400">Table {table?.number}{table?.section ? ` · ${table.section}` : ''}</p>
          </div>
          {/* My Orders pill — always visible in header */}
          {sessionOrders && (
            <button
              onClick={() => setView(v => v === 'orders' ? 'menu' : 'orders')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition-colors ${
                view === 'orders'
                  ? 'bg-orange-500 text-white border-orange-500'
                  : 'bg-orange-50 text-orange-600 border-orange-200'
              }`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {view === 'orders' ? '← Menu' : 'My Orders'}
            </button>
          )}
        </div>

        {/* ── Search + Tab strip — only show if on menu view ── */}
        {view === 'menu' && (
          <>
            <div className="relative mt-3 mb-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">🔍</span>
              <input
                type="search"
                value={menuSearch}
                onChange={e => setMenuSearch(e.target.value)}
                placeholder="Search menu…"
                className="w-full pl-9 pr-4 py-2 rounded-xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 text-sm"
              />
            </div>
            {!debouncedMenuSearch.trim() && (
              <div className="flex gap-2 pt-2 pb-0 overflow-x-auto border-b border-gray-100">
                {categories?.map(cat => (
                  <button key={cat.id} onClick={() => setActiveCat(cat.id)}
                    className={`shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                      activeCatId === cat.id
                        ? 'border-orange-500 text-orange-600 font-semibold'
                        : 'border-transparent text-gray-500'
                    }`}>
                    {cat.name}
                  </button>
                ))}
              </div>
            )}
            {debouncedMenuSearch.trim() && <div className="border-b border-gray-100" />}
          </>
        )}

        {/* ── Orders tab header ── */}
        {view === 'orders' && (
          <div className="pt-3 pb-3 flex items-center gap-2">
            <ShoppingBagIcon className="w-4 h-4 text-orange-500" />
            <span className="text-sm font-semibold text-gray-700">My Orders</span>
          </div>
        )}
      </div>

      {/* ── Content ── */}
      <div className="flex-1 overflow-y-auto">
        {view === 'menu' ? (
          <div className={!orderingEnabled ? 'pb-8' : sessionOrders && allServed && cartCount > 0 ? 'pb-48' : sessionOrders && (allServed || cartCount > 0) ? 'pb-36' : sessionOrders || cartCount > 0 ? 'pb-28' : 'pb-20'}>
            {!orderingEnabled && (
              <div className="mx-4 mt-3 bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 text-center">
                <p className="text-sm font-medium text-amber-800">Menu is view-only</p>
                <p className="text-xs text-amber-600 mt-0.5">Online ordering is not available. Please ask a staff member.</p>
              </div>
            )}

            <div className="px-4 py-4 space-y-3">
              {debouncedMenuSearch.trim() && searchedItems.length === 0 && (
                <p className="text-center text-sm text-gray-400 py-8">No items match "{debouncedMenuSearch}"</p>
              )}
              {searchedItems.map(item => {

                const inCart = cart.find(x => x.menu_item_id === item.id)
                const imgUrl = item.image_url ?? null

                return (
                  <div key={item.id} className="bg-white rounded-2xl overflow-hidden shadow-sm flex">
                    {/* Image — only renders if present */}
                    {imgUrl && (
                      <img
                        src={imgUrl}
                        className="w-28 h-28 object-cover shrink-0"
                        onError={e => { e.target.style.display = 'none' }}
                      />
                    )}
                    <div className="flex-1 p-3 flex flex-col justify-between min-w-0">
                      <div>
                        <div className="flex items-center gap-1.5 mb-0.5">
                          <span className="text-xs shrink-0">{typeIcon[item.type]}</span>
                          <span className="font-semibold text-gray-900 text-sm leading-tight">{item.name}</span>
                        </div>
                        {item.description && (
                          <p className="text-xs text-gray-400 line-clamp-2 mt-0.5">{item.description}</p>
                        )}
                      </div>
                      <div className="flex items-center justify-between mt-2">
                        <span className="font-bold text-gray-900 text-sm">₹{item.price}</span>
                        {orderingEnabled && (inCart ? (
                          <div className="flex items-center gap-2">
                            <button onClick={() => updateQty(item.id, -1)}
                              className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-base leading-none">−</button>
                            <span className="font-semibold w-4 text-center text-sm">{inCart.quantity}</span>
                            <button onClick={() => updateQty(item.id, 1)}
                              className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-base leading-none">+</button>
                          </div>
                        ) : (
                          <button onClick={() => addToCart(item)}
                            className="bg-orange-500 text-white text-xs font-semibold px-4 py-1.5 rounded-full">
                            Add
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="px-4">
              <PoweredByBanner />
            </div>
          </div>
        ) : (
          <OrdersView
            sessionOrders={sessionOrders}
            onOrderMore={() => setView('menu')}
            onRequestBill={() => requestBill.mutate()}
            billRequestEnabled={billRequestEnabled}
            billRequested={billRequested}
            billRequesting={requestBill.isPending}
            onAllServedChange={setAllServed}
            onUnpaidTotalChange={setUnpaidTotal}
            tenantId={data?.tenant_id}
            tableId={data?.table?.id}
            onCallWaiter={() => callWaiter.mutate()}
            waiterCalled={waiterCalled}
            waiterCalling={callWaiter.isPending}
          />
        )}
      </div>

      {/* ── Bottom bar ── */}
      {view === 'menu' && orderingEnabled && (
        <CartBar
          cart={cart}
          onOpen={() => setShowCart(true)}
          onViewOrders={() => setView('orders')}
          sessionOrders={sessionOrders}
          onRequestBill={() => requestBill.mutate()}
          billRequestEnabled={billRequestEnabled}
          billRequested={billRequested}
          billRequesting={requestBill.isPending}
          allServed={allServed}
          unpaidTotal={unpaidTotal}
          onCallWaiter={() => callWaiter.mutate()}
          waiterCalled={waiterCalled}
          waiterCalling={callWaiter.isPending}
        />
      )}

      {showCart && (
        <CartSheet
          cart={cart}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateQty}
          placing={placeOrder.isPending}
          onPlaceOrder={() => placeOrder.mutate({ slug, token, items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })) })}
        />
      )}

    </div>
  )
}
