import { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  XMarkIcon, ShoppingBagIcon, ChevronRightIcon, ChevronDownIcon,
} from '@heroicons/react/24/outline'
import { BoltIcon, ClockIcon } from '@heroicons/react/24/outline'
import Pusher from 'pusher-js'
import {
  getCustomerMenu, customerPlaceOrder, getOrderStatus,
  customerRequestBill, customerCallWaiter, customerNotifyBillPaid,
} from '@/services/restaurantService'
import PoweredByBanner from '@/components/shared/PoweredByBanner'
import TenantSuspendedScreen from '@/components/shared/TenantSuspendedScreen'
import ItemCustomizeSheet from '@/components/shared/ItemCustomizeSheet'

// ── VEG dots ─────────────────────────────────────────────────────────────────
const VEG_DOT    = <span className="w-4 h-4 rounded-sm border-2 border-green-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-green-600"/></span>
const NONVEG_DOT = <span className="w-4 h-4 rounded-sm border-2 border-red-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-red-600"/></span>
const VEGAN_DOT  = <span className="w-4 h-4 rounded-sm border-2 border-emerald-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-600"/></span>
const typeIcon   = { veg: VEG_DOT, 'non-veg': NONVEG_DOT, vegan: VEGAN_DOT }

function formatPrice(p) { return `₹${Number(p).toLocaleString('en-IN')}` }

// ── Cart Bar ──────────────────────────────────────────────────────────────────
function CartBar({ cart, onOpen, onViewOrders, sessionOrders, onRequestBill, billRequestEnabled,
  billRequested, billRequesting, allServed, unpaidTotal, onCallWaiter, waiterCalled, waiterCalling }) {
  const count = cart.reduce((s, x) => s + x.quantity, 0)
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)
  const showRequestBill = sessionOrders && billRequestEnabled && allServed && unpaidTotal > 0
  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-100 via-gray-100/95 to-transparent pointer-events-none">
      <div className="pointer-events-auto space-y-2.5 max-w-md mx-auto">
        {sessionOrders && (
          <button onClick={onViewOrders}
            className="w-full bg-white border border-orange-200 text-orange-600 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-sm">
            <span className="flex items-center gap-2.5 font-semibold text-base">
              <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse inline-block"/>
              Track My Orders
            </span>
            <ChevronRightIcon className="w-5 h-5"/>
          </button>
        )}
        {sessionOrders && (
          <button onClick={onCallWaiter} disabled={waiterCalled || waiterCalling}
            className={`w-full rounded-2xl px-5 py-3.5 flex items-center justify-center gap-2 font-semibold text-base shadow-sm transition-colors ${
              waiterCalled ? 'bg-amber-50 text-amber-700 border border-amber-200' : 'bg-white border border-gray-200 text-gray-700'
            }`}>
            {waiterCalled ? <>🔔 Waiter called — on the way!</> : waiterCalling ? 'Calling…' : <>🔔 Call Waiter</>}
          </button>
        )}
        {showRequestBill && (
          <button onClick={onRequestBill} disabled={billRequested || billRequesting}
            className={`w-full rounded-2xl px-5 py-3.5 flex items-center justify-center gap-2 font-semibold text-base shadow-sm transition-colors ${
              billRequested ? 'bg-green-100 text-green-700 border border-green-200' : 'bg-white border border-gray-200 text-gray-700'
            }`}>
            {billRequested ? '✅ Bill requested — staff is on the way' : billRequesting ? 'Requesting…' : '🧾 Request Bill'}
          </button>
        )}
        {count > 0 && (
          <button onClick={onOpen}
            className="w-full bg-orange-500 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-xl shadow-orange-200/60">
            <span className="bg-orange-700 text-white text-sm font-bold px-2.5 py-1 rounded-full">{count} items</span>
            <span className="font-bold text-base">View Cart</span>
            <span className="font-bold text-base">{formatPrice(total)}</span>
          </button>
        )}
      </div>
    </div>
  )
}

// ── Cart Sheet ────────────────────────────────────────────────────────────────
function CartSheet({ cart, onClose, onUpdateQty, onPlaceOrder, placing, gstInclusive, gstRate }) {
  const subtotal = cart.reduce((s, x) => s + x.price * x.quantity, 0)
  const taxAmt   = gstInclusive ? 0 : Math.round(subtotal * (gstRate / 100) * 100) / 100
  const total    = subtotal + taxAmt
  return (
    <div className="fixed inset-0 z-50 flex flex-col items-center">
      <div className="flex-1 w-full bg-black/40" onClick={onClose}/>
      <div className="w-full max-w-md bg-white rounded-t-3xl px-5 pt-6 pb-8 max-h-[88vh] flex flex-col shadow-2xl">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold text-gray-900">Your Cart</h2>
          <button onClick={onClose} className="w-11 h-11 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><XMarkIcon className="w-5 h-5"/></button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-4 mb-5">
          {cart.map((item, idx) => (
            <div key={idx} className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{typeIcon[item.type]}</span>
                  <span className="font-semibold text-gray-900 text-base">{item.name}</span>
                </div>
                {item.variant_name && <p className="text-sm text-gray-400 ml-6">{item.variant_name}</p>}
                {item.addon_labels?.length > 0 && (
                  <p className="text-sm text-gray-400 ml-6">{item.addon_labels.join(', ')}</p>
                )}
                <p className="text-sm text-gray-400 ml-6">{formatPrice(item.price)} each</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onUpdateQty(idx, -1)}
                  className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold leading-none">−</button>
                <span className="font-bold w-6 text-center text-base">{item.quantity}</span>
                <button onClick={() => onUpdateQty(idx, 1)}
                  className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center text-xl font-bold leading-none">+</button>
              </div>
              <div className="text-base font-semibold w-16 text-right shrink-0">{formatPrice(item.price * item.quantity)}</div>
            </div>
          ))}
        </div>
        <div className="border-t pt-4 space-y-2">
          <div className="flex justify-between text-base text-gray-500">
            <span>Subtotal</span><span>{formatPrice(subtotal)}</span>
          </div>
          {!gstInclusive && gstRate > 0 && (
            <div className="flex justify-between text-base text-gray-500">
              <span>GST ({gstRate}%)</span><span>{formatPrice(taxAmt)}</span>
            </div>
          )}
          {gstInclusive && (
            <p className="text-sm text-gray-400">Prices include GST</p>
          )}
          <div className="flex justify-between text-xl font-bold text-gray-900 pt-1">
            <span>Total</span><span>{formatPrice(total)}</span>
          </div>
          <button onClick={onPlaceOrder} disabled={placing}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 mt-2">
            {placing ? 'Placing Order…' : 'Place Order'}
          </button>
          <p className="text-sm text-gray-400 text-center mt-2">Your order will go directly to the kitchen</p>
        </div>
      </div>
    </div>
  )
}

// ── Pay Bill Sheet ────────────────────────────────────────────────────────────
function PayBillSheet({ upiId, unpaidTotal, tableNumber, onNotify, notifying, notifyError, onClose }) {
  const [copied, setCopied] = useState(false)
  const upiLink = `upi://pay?pa=${upiId}&am=${unpaidTotal}&cu=INR&tn=Table+${tableNumber ?? ''}`
  const deepLinks = {
    phonepe: upiLink.replace('upi://', 'phonepe://'),
    gpay:    upiLink.replace('upi://pay', 'tez://upi/pay'),
    paytm:   upiLink.replace('upi://', 'paytmmp://'),
  }
  const copy = () => { navigator.clipboard.writeText(upiId).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }) }
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose}/>
      <div className="relative w-full max-w-md bg-white rounded-t-3xl px-5 pt-5 pb-10 shadow-2xl overflow-y-auto max-h-[95dvh]">
        <div className="w-10 h-1 rounded-full bg-gray-200 mx-auto mb-5"/>
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-lg font-bold text-gray-900">💳 Pay Your Bill</h2>
            <p className="text-xs text-gray-400 mt-0.5">Scan or tap an app to pay</p>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500"><XMarkIcon className="w-4 h-4"/></button>
        </div>
        <div className="bg-orange-50 border border-orange-200 rounded-2xl px-5 py-4 flex items-center justify-between mb-4">
          <span className="text-base font-medium text-orange-700">Total to pay</span>
          <span className="text-2xl font-bold text-orange-600">{formatPrice(unpaidTotal)}</span>
        </div>
        <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
          <span className="text-lg shrink-0">⚠️</span>
          <p className="text-base text-red-700 leading-snug">After paying, <span className="font-semibold">come back here and tap "Done — Notify Counter"</span> to close your table.</p>
        </div>
        <div className="flex flex-col items-center bg-gray-50 border border-gray-100 rounded-2xl p-4 mb-4">
          <p className="text-xs text-gray-400 font-semibold mb-3 uppercase tracking-wider">Scan to Pay</p>
          <div className="bg-white p-2 rounded-xl border border-gray-200 shadow-sm mb-3">
            <img src={`https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(upiLink)}&size=176x176&margin=4`} alt="UPI QR" className="w-44 h-44 rounded"/>
          </div>
          <button onClick={copy} className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-4 py-2 text-sm font-mono text-gray-600 hover:bg-gray-50">
            {upiId} <span className="text-base">{copied ? '✅' : '📋'}</span>
          </button>
        </div>
        <p className="text-xs text-gray-400 font-semibold text-center mb-2 uppercase tracking-wider">Pay with app</p>
        <div className="grid grid-cols-3 gap-3 mb-5">
          {[
            { href: deepLinks.phonepe, src: '/phonepelogo.png', label: 'PhonePe' },
            { href: deepLinks.gpay,    src: '/gpaylogo.svg',    label: 'GPay'    },
            { href: deepLinks.paytm,   src: '/paytmlogo.webp',  label: 'Paytm'   },
          ].map(app => (
            <a key={app.label} href={app.href}
              className="flex flex-col items-center gap-2 bg-white border border-gray-200 rounded-2xl px-3 py-3 hover:border-gray-300 active:scale-95 transition-all shadow-sm">
              <img src={app.src} alt={app.label} className="w-9 h-9 object-contain"/>
              <span className="text-xs font-semibold text-gray-700">{app.label}</span>
            </a>
          ))}
        </div>
        {notifyError && <div className="flex items-center gap-2 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-3 text-sm text-red-700"><span>⚠️</span> {notifyError}</div>}
        <button onClick={onNotify} disabled={notifying}
          className="w-full bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-sm transition-colors shadow-lg shadow-orange-200">
          {notifying ? 'Notifying counter…' : '✅ Done — Notify Counter'}
        </button>
      </div>
    </div>
  )
}

// ── Order tracker ─────────────────────────────────────────────────────────────
const TRACK_STEPS = [
  { key: 'pending',   emoji: '🧾', label: 'Received'  },
  { key: 'preparing', emoji: '👨‍🍳', label: 'Preparing' },
  { key: 'ready',     emoji: '🔔', label: 'Ready!'    },
  { key: 'served',    emoji: '✅', label: 'Served'    },
]
const STATUS_CONFIG = {
  pending:   { heroBg: 'from-amber-400 to-orange-400',   heroText: 'text-white', icon: '🧾', headline: 'Order received!',   sub: 'Your order is in the kitchen queue.' },
  preparing: { heroBg: 'from-blue-500 to-indigo-500',    heroText: 'text-white', icon: '👨‍🍳', headline: 'Cooking now…',      sub: 'The kitchen is preparing your food.' },
  ready:     { heroBg: 'from-emerald-400 to-green-500',  heroText: 'text-white', icon: '🔔', headline: 'Ready to serve!',   sub: 'Your food is on its way to the table.' },
  served:    { heroBg: 'from-gray-200 to-gray-300',      heroText: 'text-gray-600', icon: '✅', headline: 'Served', sub: 'Enjoy your meal!' },
}

function ProgressBar({ status }) {
  const idx = TRACK_STEPS.findIndex(s => s.key === status)
  return (
    <div className="flex items-start gap-0 w-full">
      {TRACK_STEPS.map((step, i) => {
        const done   = i < idx
        const active = i === idx
        const isLast = i === TRACK_STEPS.length - 1
        return (
          <div key={step.key} className="flex flex-col items-center flex-1">
            <div className="flex items-center w-full">
              <div className={`flex-1 h-0.5 ${i === 0 ? 'invisible' : done || active ? 'bg-white/70' : 'bg-white/20'}`}/>
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-base shrink-0 transition-all ${done ? 'bg-white/30 text-white' : active ? 'bg-white shadow-lg scale-110' : 'bg-white/15 text-white/50'}`}>
                {done ? '✓' : step.emoji}
              </div>
              <div className={`flex-1 h-0.5 ${isLast ? 'invisible' : done ? 'bg-white/70' : 'bg-white/20'}`}/>
            </div>
            <span className={`text-[10px] mt-1 font-semibold ${active ? 'text-white' : done ? 'text-white/70' : 'text-white/35'}`}>{step.label}</span>
          </div>
        )
      })}
    </div>
  )
}

function BatchCard({ batch, batchNum, totalBatches }) {
  const cfg = STATUS_CONFIG[batch.status] ?? STATUS_CONFIG.pending
  const isReadyMade = batch.is_ready_made
  const isPaid = batch.payment_status === 'paid'
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm mb-4">
      <div className={`bg-gradient-to-br ${cfg.heroBg} px-5 pt-5 pb-6`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            {totalBatches > 1 && <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-0.5">Order {batchNum} of {totalBatches}</p>}
            <p className={`text-xl font-bold ${cfg.heroText}`}>{cfg.headline}</p>
            <p className={`text-base ${cfg.heroText} opacity-80`}>{cfg.sub}</p>
          </div>
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-3 py-1.5 rounded-full bg-white/95 shadow-sm ring-1 ${isPaid ? 'text-emerald-700 ring-emerald-200' : 'text-amber-700 ring-amber-200'}`}>
            {isPaid ? '✓ Paid' : 'Unpaid'}
          </span>
        </div>
        {batch.status === 'pending' && batch.queue_position != null && (
          <div className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-xl px-3 py-1.5 mb-3">
            <span className="text-white font-bold text-sm">#{batch.queue_position}</span>
            <span className="text-white/80 text-xs">in queue</span>
          </div>
        )}
        {!isReadyMade && <div className="mt-3"><ProgressBar status={batch.status}/></div>}
        {isReadyMade && (
          <div className="mt-2 inline-flex items-center gap-1.5 bg-white/20 rounded-xl px-3 py-1">
            <BoltIcon className="w-3.5 h-3.5 text-white"/>
            <span className="text-white text-xs font-semibold">Instant · {batch.status === 'served' ? 'Served' : 'Ready'}</span>
          </div>
        )}
      </div>
      <div className="px-5 py-4">
        <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-3">Items</p>
        <div className="space-y-3">
          {batch.items?.map((item, i) => (
            <div key={i} className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-3 flex-1 min-w-0">
                <span className="w-7 h-7 rounded-lg bg-orange-50 text-orange-500 text-sm font-bold flex items-center justify-center shrink-0 mt-0.5">{item.quantity}</span>
                <div className="min-w-0">
                  <span className="text-base text-gray-800 font-medium">{item.name}</span>
                  {item.variant_name && <p className="text-sm text-gray-400">{item.variant_name}</p>}
                  {item.addon_labels?.length > 0 && <p className="text-sm text-gray-400">{item.addon_labels.join(', ')}</p>}
                </div>
              </div>
              <span className="text-base text-gray-500 font-medium tabular-nums shrink-0">{formatPrice(item.subtotal)}</span>
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-100">
          <span className="text-base font-semibold text-gray-500">Subtotal</span>
          <span className="text-lg font-bold text-gray-900 tabular-nums">{formatPrice(batch.total)}</span>
        </div>
      </div>
      <div className="px-5 pb-4"><p className="text-[10px] text-gray-300 font-mono">{batch.order_number}</p></div>
    </div>
  )
}

function OrdersView({ sessionOrders, onOrderMore, onRequestBill, billRequestEnabled, billRequested, billRequesting, onAllServedChange, onUnpaidTotalChange, tenantId, tableId, onCallWaiter, waiterCalled, waiterCalling, upiId, onPayBill }) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['order-tracker', sessionOrders],
    queryFn: () => getOrderStatus(sessionOrders).then(r => r.data.data),
    enabled: !!sessionOrders,
  })

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
    const pusher  = new Pusher(import.meta.env.VITE_PUSHER_KEY, pusherConfig)
    const channel = pusher.subscribe(`tenant.${tenantId}.table.${tableId}`)
    channel.bind('order.updated', () => refetch())
    return () => { channel.unbind_all(); pusher.unsubscribe(`tenant.${tenantId}.table.${tableId}`); pusher.disconnect() }
  }, [tenantId, tableId, refetch])

  const batches     = data?.batches ?? []
  const allDone     = batches.length > 0 && batches.every(b => b.status === 'served')
  const unpaidTotal = batches.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + Number(b.total), 0)
  const hasReady    = batches.some(b => b.status === 'ready')

  useEffect(() => { onAllServedChange?.(allDone) }, [allDone])
  useEffect(() => { onUnpaidTotalChange?.(unpaidTotal) }, [unpaidTotal])

  if (!sessionOrders) return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="text-6xl mb-4">🍽️</div>
      <p className="font-bold text-gray-800 text-lg">Nothing ordered yet</p>
      <p className="text-sm text-gray-400 mt-1 mb-6">Head to the menu and place your first order.</p>
      <button onClick={onOrderMore} className="bg-orange-500 text-white font-bold px-8 py-3.5 rounded-2xl text-sm shadow-lg shadow-orange-200">Browse Menu</button>
    </div>
  )

  return (
    <div className="pb-28">
      {allDone ? (
        <div className="mx-4 mt-4 bg-gradient-to-r from-emerald-50 to-green-50 border border-green-200 rounded-2xl px-5 py-4 flex items-center gap-3 mb-4">
          <span className="text-3xl">🎉</span>
          <div><p className="font-bold text-green-800">All served — enjoy!</p><p className="text-xs text-green-600 mt-0.5">Everything has been brought to your table.</p></div>
        </div>
      ) : hasReady ? (
        <div className="mx-4 mt-4 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl px-5 py-3 flex items-center gap-3 mb-4 shadow-lg shadow-green-200">
          <span className="text-2xl animate-bounce">🔔</span>
          <div><p className="font-bold text-white text-sm">Your food is ready!</p><p className="text-xs text-white/80">A waiter is bringing it to your table.</p></div>
        </div>
      ) : !isLoading && batches.length > 0 ? (
        <div className="mx-4 mt-4 mb-2">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>
            {isFetching ? 'Updating…' : 'Live updates'}
          </p>
        </div>
      ) : null}

      {isLoading && batches.length === 0 ? (
        <div className="px-4 mt-4 space-y-4">
          {[1,2].map(i => (
            <div key={i} className="rounded-3xl overflow-hidden">
              <div className="h-36 bg-gradient-to-br from-gray-200 to-gray-300 animate-pulse"/>
              <div className="bg-white p-5 space-y-3">
                <div className="h-4 bg-gray-100 rounded animate-pulse w-3/4"/>
                <div className="h-4 bg-gray-100 rounded animate-pulse w-1/2"/>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="px-4 mt-2">
          {batches.map((batch, i) => <BatchCard key={batch.order_number} batch={batch} batchNum={i+1} totalBatches={batches.length}/>)}
        </div>
      )}

      {batches.length > 0 && (() => {
        const paidTotal   = batches.filter(b => b.payment_status === 'paid').reduce((s, b) => s + Number(b.total), 0)
        const unpaidTotal = batches.filter(b => b.payment_status !== 'paid').reduce((s, b) => s + Number(b.total), 0)
        return (
          <div className="mx-4 bg-gray-900 text-white rounded-2xl px-5 py-5 mb-4 space-y-2.5">
            {paidTotal   > 0 && <div className="flex justify-between text-base"><span className="text-gray-400">Paid online</span><span className="text-emerald-400 font-semibold tabular-nums">{formatPrice(paidTotal)}</span></div>}
            {unpaidTotal > 0 && <div className="flex justify-between text-base"><span className="text-gray-400">To pay at counter</span><span className="text-rose-400 font-semibold tabular-nums">{formatPrice(unpaidTotal)}</span></div>}
            <div className="flex justify-between items-center pt-2.5 border-t border-white/10">
              <span className="text-base font-semibold text-gray-300">Total this visit</span>
              <span className="text-2xl font-bold tabular-nums">{formatPrice(paidTotal + unpaidTotal)}</span>
            </div>
          </div>
        )
      })()}

      {batches.length > 0 && (
        <div className="px-4 mb-3">
          <button onClick={onCallWaiter} disabled={waiterCalled || waiterCalling}
            className={`w-full font-bold py-4 rounded-2xl text-base transition-colors ${waiterCalled ? 'bg-amber-50 border-2 border-amber-300 text-amber-700' : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {waiterCalled ? '🔔 Waiter called — on the way!' : waiterCalling ? 'Calling…' : '🔔 Call Waiter'}
          </button>
        </div>
      )}
      {allDone && unpaidTotal > 0 && upiId && (
        <div className="px-4 mb-3">
          <button onClick={onPayBill} className="w-full bg-orange-500 hover:bg-orange-600 text-white font-bold py-4 rounded-2xl text-sm transition-colors">
            💳 Pay Bill — {formatPrice(unpaidTotal)}
          </button>
        </div>
      )}
      {billRequestEnabled && allDone && unpaidTotal > 0 && (
        <div className="px-4 mb-3">
          <button onClick={onRequestBill} disabled={billRequested || billRequesting}
            className={`w-full font-bold py-4 rounded-2xl text-base transition-colors ${billRequested ? 'bg-green-50 border-2 border-green-300 text-green-700' : 'bg-white border-2 border-gray-200 text-gray-700 hover:bg-gray-50'}`}>
            {billRequested ? '✅ Bill requested — staff is on the way' : billRequesting ? 'Requesting…' : '🧾 Request Bill'}
          </button>
        </div>
      )}
      <div className="px-4">
        <button onClick={onOrderMore} className="w-full border-2 border-orange-400 text-orange-500 font-bold py-4 rounded-2xl text-base hover:bg-orange-50 transition-colors">+ Add More Items</button>
      </div>
    </div>
  )
}

// ── Menu item card ────────────────────────────────────────────────────────────
function MenuItemCard({ item, cartLine, onTap, onDirectAdd, onUpdateQty, orderingEnabled, gstInclusive }) {
  const hasCustomization = item.variants?.length > 0 || item.addon_groups?.length > 0
  const imgUrl = item.image_url ?? null
  const hasVideo = !!item.video_url
  const inCart = cartLine && cartLine.quantity > 0
  const [imgError, setImgError] = useState(false)

  const displayPrice = item.variants?.length > 0
    ? `from ${formatPrice(Math.min(...item.variants.map(v => v.price)))}`
    : formatPrice(item.price)

  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm flex cursor-pointer active:scale-[0.99] transition-transform"
      onClick={() => onTap(item)}>
      {(imgUrl && !imgError) ? (
        <div className="relative w-32 self-stretch shrink-0 overflow-hidden bg-gray-100">
          <img src={imgUrl} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgError(true)}/>
          {hasVideo && (
            <span className="absolute bottom-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/40 tracking-wide uppercase">
              ✨ Video
            </span>
          )}
        </div>
      ) : hasVideo ? (
        <div className="relative w-32 self-stretch shrink-0 overflow-hidden bg-gray-950 flex flex-col items-center justify-center gap-2 min-h-[7rem]">
          {/* animated shimmer background */}
          <div className="absolute inset-0 bg-gradient-to-br from-purple-900/60 via-pink-900/40 to-orange-900/60 animate-pulse" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.15),transparent_70%)]" />
          {/* play button */}
          <div className="relative z-10 w-12 h-12 rounded-full bg-white/15 backdrop-blur-sm border border-white/30 flex items-center justify-center shadow-lg shadow-purple-500/30">
            <span className="text-white text-xl ml-0.5">▶</span>
          </div>
          {/* pill */}
          <span className="relative z-10 text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/40 tracking-wide uppercase">
            ✨ Video
          </span>
        </div>
      ) : null}
      <div className="flex-1 p-4 flex flex-col min-w-0 min-h-[7rem]">
        <div>
          <div className="flex items-start gap-2 mb-1">
            <span className="shrink-0 mt-0.5">{typeIcon[item.type]}</span>
            <span className="font-bold text-gray-900 text-base leading-tight">{item.name}</span>
          </div>
          {item.description && <p className="text-sm text-gray-400 line-clamp-2 mt-1 ml-6">{item.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-6">
            {item.is_ready_made && (
              <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <BoltIcon className="w-3 h-3"/>Instant
              </span>
            )}
            {item.prep_time_minutes && !item.is_ready_made && (
              <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <ClockIcon className="w-3 h-3"/>~{item.prep_time_minutes}m
              </span>
            )}
            {item.meat_type && <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">{item.meat_type}</span>}
            {item.serving_info && <span className="text-xs text-gray-400">{item.serving_info}</span>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 mt-3 ml-6">
          <div className="min-w-0">
            <span className="font-bold text-gray-900 text-base">{displayPrice}</span>
            {gstInclusive
              ? <span className="text-xs text-gray-400 ml-1">incl. GST</span>
              : item.gst_slab != null
                ? <span className="text-xs text-gray-400 ml-1">+{item.gst_slab}% GST</span>
                : null
            }
            {item.packaging_charge > 0 && <span className="text-xs text-gray-400 ml-1">+{formatPrice(item.packaging_charge)} pkg</span>}
          </div>
          {orderingEnabled && (
            inCart && !hasCustomization ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => onUpdateQty(cartLine._idx, -1)}
                  className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xl leading-none">−</button>
                <span className="font-bold w-5 text-center text-base">{cartLine.quantity}</span>
                <button onClick={() => onUpdateQty(cartLine._idx, 1)}
                  className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-xl leading-none">+</button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); hasCustomization ? onTap(item) : onDirectAdd(item) }}
                className={`text-sm font-semibold px-5 py-2 rounded-full transition-colors min-h-[36px] ${
                  inCart ? 'bg-orange-100 text-orange-600' : 'bg-orange-500 text-white'
                }`}>
                {inCart ? `${cartLine.quantity} added` : hasCustomization ? 'Customize' : 'Add'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CustomerMenuPage() {
  const { slug, token } = useParams()
  const [view, setView]                 = useState('menu')
  const [cart, setCart]                 = useState([])
  const [showCart, setShowCart]         = useState(false)
  const [activeCat, setActiveCat]       = useState(null)
  const [activeSub, setActiveSub]       = useState(null)
  const [expandedCats, setExpandedCats] = useState({})
  const [menuSearch, setMenuSearch]     = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [customizeItem, setCustomizeItem] = useState(null)
  const [sessionOrders, setSessionOrders] = useState(null)
  const [billRequested, setBillRequested] = useState(false)
  const [waiterCalled, setWaiterCalled]   = useState(false)
  const [tableCleared, setTableCleared]   = useState(false)
  const [allServed, setAllServed]         = useState(false)
  const [unpaidTotal, setUnpaidTotal]     = useState(0)
  const [showPayBillSheet, setShowPayBillSheet] = useState(false)
  const [billPaidAwaiting, setBillPaidAwaiting] = useState(false)
  const [notifyError, setNotifyError]     = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebounced(menuSearch), 250)
    return () => clearTimeout(t)
  }, [menuSearch])

  const { data, isLoading, error, refetch: refetchMenu } = useQuery({
    queryKey: ['customer-menu', slug, token],
    queryFn:  () => getCustomerMenu(slug, token).then(r => r.data.data),
    refetchInterval: 8000,
    staleTime: 0,
  })

  // Pusher table channel
  useEffect(() => {
    const tenantId = data?.tenant_id
    const tableId  = data?.table?.id
    if (!tenantId || !tableId || !sessionOrders) return
    const cfg = { cluster: import.meta.env.VITE_PUSHER_CLUSTER ?? 'mt1' }
    if (import.meta.env.VITE_PUSHER_HOST) {
      cfg.wsHost = import.meta.env.VITE_PUSHER_HOST
      cfg.wsPort = cfg.wssPort = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      cfg.forceTLS = (import.meta.env.VITE_PUSHER_SCHEME ?? 'http') === 'https'
      cfg.disableStats = true; cfg.enabledTransports = ['ws']
    }
    const pusher  = new Pusher(import.meta.env.VITE_PUSHER_KEY, cfg)
    const channel = pusher.subscribe(`tenant.${tenantId}.table.${tableId}`)
    channel.bind('order.updated', () => refetchMenu())
    return () => { channel.unbind_all(); pusher.unsubscribe(`tenant.${tenantId}.table.${tableId}`); pusher.disconnect() }
  }, [data?.tenant_id, data?.table?.id, sessionOrders, refetchMenu])

  useEffect(() => {
    if (!data) return
    const tableFreed = data.table?.status === 'free'
    const noOrders   = !data.active_order_numbers
    if ((tableFreed || noOrders) && sessionOrders) {
      setTableCleared(true)
      setBillRequested(false)
      setTimeout(() => { setSessionOrders(null); setView('menu'); setTableCleared(false); setCart([]); setAllServed(false) }, 4000)
    } else if (data.active_order_numbers) {
      setSessionOrders(data.active_order_numbers)
    }
  }, [data])

  useEffect(() => {
    if (!data) return
    setBillPaidAwaiting(!!data.table?.bill_paid_at)
  }, [data])

  useEffect(() => {
    if (!billPaidAwaiting) return
    window.history.pushState({ awaitingBill: true }, '')
    const onPop = () => window.history.pushState({ awaitingBill: true }, '')
    const onBefore = (e) => { e.preventDefault() }
    window.addEventListener('popstate', onPop)
    window.addEventListener('beforeunload', onBefore)
    return () => { window.removeEventListener('popstate', onPop); window.removeEventListener('beforeunload', onBefore) }
  }, [billPaidAwaiting])

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

  const requestBill   = useMutation({ mutationFn: () => customerRequestBill(slug, token), onSuccess: () => setBillRequested(true) })
  const notifyBillPaid = useMutation({
    mutationFn: () => customerNotifyBillPaid(slug, token),
    onSuccess: () => { setShowPayBillSheet(false); setBillPaidAwaiting(true); setNotifyError('') },
    onError: (err) => setNotifyError(err?.response?.data?.message ?? 'Could not notify counter. Please call the waiter.'),
  })
  const callWaiter = useMutation({
    mutationFn: () => customerCallWaiter(slug, token),
    onSuccess: () => { setWaiterCalled(true); setTimeout(() => setWaiterCalled(false), 60_000) },
  })

  // Cart helpers — each line is unique by item+variant+addons combo
  const cartKey = (itemId, variantId, addonIds) =>
    `${itemId}:${variantId ?? ''}:${[...(addonIds ?? [])].sort().join(',')}`

  const addToCart = (line) => {
    const key = cartKey(line.menu_item_id, line.variant_id, line.addon_ids)
    setCart(c => {
      const idx = c.findIndex(x => x._key === key)
      if (idx >= 0) {
        return c.map((x, i) => i === idx ? { ...x, quantity: x.quantity + line.quantity } : x)
      }
      return [...c, { ...line, _key: key }]
    })
    setCustomizeItem(null)
  }

  const directAdd = (item) => {
    addToCart({ menu_item_id: item.id, variant_id: null, addon_ids: [], quantity: 1, name: item.name, variant_name: null, addon_labels: [], price: item.price, type: item.type, is_ready_made: item.is_ready_made })
  }

  const updateQty = (idx, delta) =>
    setCart(c => c.map((x, i) => i === idx ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))

  // Build flat item list for search
  const categories    = data?.categories ?? []
  const gstInclusive  = data?.tenant?.gst_inclusive ?? false
  const gstRate       = Number(data?.tenant?.gst_rate ?? 5)

  const allItems = categories.flatMap(c => [
    ...(c.items ?? []),
    ...(c.subcategories ?? []).flatMap(s => s.items ?? []),
  ])

  const searchedItems = debouncedSearch.trim()
    ? allItems.filter(i => i.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : null

  // Active category/subcategory items
  const activeCatData = categories.find(c => c.id === (activeCat ?? categories[0]?.id))
  const activeSubData = activeSub ? activeCatData?.subcategories?.find(s => s.id === activeSub) : null
  const displayedItems = searchedItems ?? (activeSubData ? activeSubData.items : activeCatData?.items ?? [])

  const orderingEnabled    = data?.tenant?.qr_ordering_enabled !== false
  const billRequestEnabled = data?.tenant?.customer_bill_request_enabled !== false
  const cartCount          = cart.reduce((s, x) => s + x.quantity, 0)

  // Get cart line for an item (first matching item_id for simple items)
  const getCartLine = (item) => {
    const hasCustom = item.variants?.length > 0 || item.addon_groups?.length > 0
    if (hasCustom) {
      const all = cart.filter(x => x.menu_item_id === item.id)
      if (all.length === 0) return null
      return { quantity: all.reduce((s, x) => s + x.quantity, 0), _idx: null } // summarized
    }
    const idx = cart.findIndex(x => x.menu_item_id === item.id && !x.variant_id && (!x.addon_ids?.length))
    if (idx < 0) return null
    return { ...cart[idx], _idx: idx }
  }

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-bounce">🍽</div><p className="text-gray-400">Loading menu…</p></div>
    </div>
  )

  if (error) {
    const errData = error?.response?.data
    if (errData?.message === 'tenant_suspended') return <TenantSuspendedScreen tenantName={errData.tenant_name} branding={errData.branding}/>
    return (
      <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
        <div><div className="text-4xl mb-4">😕</div><p className="font-semibold text-gray-800">Menu unavailable</p><p className="text-sm text-gray-400 mt-1">This QR code may be invalid or expired.</p></div>
      </div>
    )
  }

  const { tenant, table } = data ?? {}

  if (billPaidAwaiting) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center w-full px-6 text-center">
      <div className="animate-pulse text-7xl mb-6">⏳</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Awaiting Payment Confirmation</h2>
      <p className="text-gray-500 text-sm mb-8 max-w-xs leading-relaxed">The billing counter is verifying your payment. Please wait — your table will be closed shortly.</p>
      <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4 mb-4">
        <p className="text-sm font-semibold text-gray-700">{tenant?.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">Table {table?.number}{table?.section ? ` · ${table.section}` : ''}</p>
      </div>
      <div className="bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 w-full mb-6">
        <p className="text-xs text-amber-700">🧾 Keep your UPI payment screenshot ready in case the counter asks.</p>
      </div>
      <p className="text-xs text-gray-400 flex items-center gap-1.5"><span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>Checking every 8 seconds…</p>
      <PoweredByBanner/>
    </div>
  )

  if (tableCleared) return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center w-full px-6 text-center">
      <div className="animate-bounce text-7xl mb-6">🙏</div>
      <h2 className="text-2xl font-bold text-gray-900 mb-2">Thank you for visiting!</h2>
      <p className="text-gray-500 text-sm mb-8">Your bill has been settled. We hope to see you again soon.</p>
      <div className="w-full bg-white rounded-2xl border border-gray-100 shadow-sm px-6 py-4">
        <p className="text-sm font-semibold text-gray-700">{tenant?.name}</p>
        <p className="text-xs text-gray-400 mt-0.5">Table {table?.number}{table?.section ? ` · ${table.section}` : ''}</p>
      </div>
      <p className="text-xs text-gray-400 mt-6">Returning to menu in a moment…</p>
      <PoweredByBanner/>
    </div>
  )

  return (
    <div className="min-h-screen bg-gray-200/60 flex flex-col items-center">
     {/* Phone-frame: the whole customer app is mobile-first; cap width + center on big screens
         so images/video never spill across a wide desktop viewport. */}
     <div className="relative w-full max-w-md bg-gray-50 flex flex-col flex-1 min-h-screen shadow-xl">

      {/* Header — sticky within the phone frame */}
      <div className="bg-white px-5 pt-5 pb-0 shadow-sm sticky top-0 z-20">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-xl font-bold text-gray-900 leading-tight">{tenant?.name}</h1>
            <p className="text-sm text-gray-400 mt-0.5">Table {table?.number}{table?.section ? ` · ${table.section}` : ''}</p>
          </div>
          {sessionOrders && (
            <button onClick={() => setView(v => v === 'orders' ? 'menu' : 'orders')}
              className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold border transition-colors min-h-[36px] ${
                view === 'orders' ? 'bg-orange-500 text-white border-orange-500' : 'bg-orange-50 text-orange-600 border-orange-200'
              }`}>
              <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse"/>
              {view === 'orders' ? '← Menu' : 'My Orders'}
            </button>
          )}
        </div>

        {view === 'menu' && (
          <>
            <div className="relative mt-2 mb-0">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none text-base">🔍</span>
              <input type="search" value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
                placeholder="Search menu…"
                className="w-full pl-10 pr-4 py-3 rounded-2xl border border-gray-200 bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400 text-base"/>
            </div>
            {!debouncedSearch.trim() && (
              <div className="flex gap-0 pt-2 pb-0 overflow-x-auto border-b border-gray-100 scrollbar-hide -mx-5 px-5">
                {categories.map(cat => (
                  <button key={cat.id}
                    onClick={() => { setActiveCat(cat.id); setActiveSub(null) }}
                    className={`shrink-0 px-4 py-3 text-base font-medium whitespace-nowrap border-b-2 transition-colors ${
                      (activeCat ?? categories[0]?.id) === cat.id
                        ? 'border-orange-500 text-orange-600 font-semibold'
                        : 'border-transparent text-gray-500'
                    }`}>
                    {cat.name}
                    {cat.subcategories?.length > 0 && <ChevronDownIcon className="w-3.5 h-3.5 inline ml-1 opacity-60"/>}
                  </button>
                ))}
              </div>
            )}
            {/* Subcategory pills */}
            {!debouncedSearch.trim() && activeCatData?.subcategories?.length > 0 && (
              <div className="flex gap-2 py-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
                <button onClick={() => setActiveSub(null)}
                  className={`shrink-0 px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
                    activeSub === null ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
                  }`}>
                  All
                </button>
                {activeCatData.subcategories.map(sub => (
                  <button key={sub.id} onClick={() => setActiveSub(sub.id)}
                    className={`shrink-0 px-4 py-2 text-sm font-medium rounded-full border transition-colors ${
                      activeSub === sub.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'
                    }`}>
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
            {debouncedSearch.trim() && <div className="border-b border-gray-100 mt-2"/>}
          </>
        )}

        {view === 'orders' && (
          <div className="pt-3 pb-3 flex items-center gap-2">
            <ShoppingBagIcon className="w-5 h-5 text-orange-500"/>
            <span className="text-base font-semibold text-gray-700">My Orders</span>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        {view === 'menu' ? (
          <div className="pb-40">
            {!orderingEnabled && (
              <div className="mx-4 mt-4 bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 text-center">
                <p className="text-base font-medium text-amber-800">Menu is view-only</p>
                <p className="text-sm text-amber-600 mt-0.5">Online ordering is not available. Please ask a staff member.</p>
              </div>
            )}

            {debouncedSearch.trim() && (
              <div className="px-4 py-4 space-y-3">
                {displayedItems.length === 0 && (
                  <p className="text-center text-base text-gray-400 py-8">No items match "{debouncedSearch}"</p>
                )}
                {displayedItems.map(item => {
                  const cartLine = getCartLine(item)
                  return <MenuItemCard key={item.id} item={item} cartLine={cartLine} gstInclusive={gstInclusive}
                    orderingEnabled={orderingEnabled} onTap={setCustomizeItem}
                    onDirectAdd={directAdd} onUpdateQty={updateQty}/>
                })}
              </div>
            )}

            {!debouncedSearch.trim() && (
              <div className="px-4 py-4 space-y-3">
                {activeSub === null ? (
                  <>
                    {activeCatData?.items?.map(item => {
                      const cartLine = getCartLine(item)
                      return <MenuItemCard key={item.id} item={item} cartLine={cartLine} gstInclusive={gstInclusive}
                        orderingEnabled={orderingEnabled} onTap={setCustomizeItem}
                        onDirectAdd={directAdd} onUpdateQty={updateQty}/>
                    })}
                    {activeCatData?.subcategories?.map(sub => (
                      sub.items?.length > 0 && (
                        <div key={sub.id}>
                          <p className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3 mt-5 first:mt-0">{sub.name}</p>
                          <div className="space-y-3">
                            {sub.items.map(item => {
                              const cartLine = getCartLine(item)
                              return <MenuItemCard key={item.id} item={item} cartLine={cartLine} gstInclusive={gstInclusive}
                                orderingEnabled={orderingEnabled} onTap={setCustomizeItem}
                                onDirectAdd={directAdd} onUpdateQty={updateQty}/>
                            })}
                          </div>
                        </div>
                      )
                    ))}
                    {!activeCatData?.items?.length && !activeCatData?.subcategories?.some(s => s.items?.length) && (
                      <p className="text-center text-base text-gray-400 py-8">No items in this category</p>
                    )}
                  </>
                ) : (
                  <>
                    {displayedItems.map(item => {
                      const cartLine = getCartLine(item)
                      return <MenuItemCard key={item.id} item={item} cartLine={cartLine} gstInclusive={gstInclusive}
                        orderingEnabled={orderingEnabled} onTap={setCustomizeItem}
                        onDirectAdd={directAdd} onUpdateQty={updateQty}/>
                    })}
                    {displayedItems.length === 0 && <p className="text-center text-base text-gray-400 py-8">No items here</p>}
                  </>
                )}
              </div>
            )}

            <div className="px-4"><PoweredByBanner/></div>
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
            upiId={tenant?.upi_id ?? null}
            onPayBill={() => { setNotifyError(''); setShowPayBillSheet(true) }}
          />
        )}
      </div>

     </div>{/* /phone-frame — fixed overlays below self-center to the same max width */}

      {/* Bottom bar */}
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

      {/* Item customize sheet */}
      {customizeItem && (
        <ItemCustomizeSheet
          item={customizeItem}
          gstInclusive={gstInclusive}
          onAdd={(line) => { addToCart(line); setCustomizeItem(null) }}
          onClose={() => setCustomizeItem(null)}
        />
      )}

      {/* Cart sheet */}
      {showCart && (
        <CartSheet
          cart={cart}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateQty}
          placing={placeOrder.isPending}
          gstInclusive={gstInclusive}
          gstRate={gstRate}
          onPlaceOrder={() => placeOrder.mutate({
            slug,
            token,
            items: cart.map(({ menu_item_id, variant_id, addon_ids, quantity }) => ({
              menu_item_id,
              variant_id:  variant_id  ?? undefined,
              addon_ids:   addon_ids?.length ? addon_ids : undefined,
              quantity,
            })),
          })}
        />
      )}

      {showPayBillSheet && tenant?.upi_id && (
        <PayBillSheet
          upiId={tenant.upi_id}
          unpaidTotal={unpaidTotal}
          tableNumber={table?.number}
          onNotify={() => notifyBillPaid.mutate()}
          notifying={notifyBillPaid.isPending}
          notifyError={notifyError}
          onClose={() => setShowPayBillSheet(false)}
        />
      )}
    </div>
  )
}
