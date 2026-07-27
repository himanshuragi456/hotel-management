import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { XMarkIcon, ChevronRightIcon, ChevronDownIcon } from '@heroicons/react/24/outline'
import { BoltIcon, ClockIcon } from '@heroicons/react/24/outline'
import * as Ably from 'ably'
import { getCustomerRoomMenu, customerPlaceRoomOrder, getOrderStatus } from '@/services/restaurantService'
import PoweredByBanner from '@/components/shared/PoweredByBanner'
import TenantSuspendedScreen from '@/components/shared/TenantSuspendedScreen'
import ItemCustomizeSheet from '@/components/shared/ItemCustomizeSheet'

const VEG_DOT    = <span className="w-4 h-4 rounded-sm border-2 border-green-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-green-600"/></span>
const NONVEG_DOT = <span className="w-4 h-4 rounded-sm border-2 border-red-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-red-600"/></span>
const VEGAN_DOT  = <span className="w-4 h-4 rounded-sm border-2 border-emerald-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-600"/></span>
const typeIcon   = { veg: VEG_DOT, 'non-veg': NONVEG_DOT, vegan: VEGAN_DOT }

function formatPrice(p) { return `₹${Number(p).toLocaleString('en-IN')}` }

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
                {item.addon_labels?.length > 0 && <p className="text-sm text-gray-400 ml-6">{item.addon_labels.join(', ')}</p>}
                <p className="text-sm text-gray-400 ml-6">{formatPrice(item.price)} each</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button onClick={() => onUpdateQty(idx, -1)} className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center text-xl font-bold leading-none">−</button>
                <span className="font-bold w-6 text-center text-base">{item.quantity}</span>
                <button onClick={() => onUpdateQty(idx, 1)} className="w-9 h-9 rounded-full bg-orange-500 text-white flex items-center justify-center text-xl font-bold leading-none">+</button>
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
          {gstInclusive && <p className="text-sm text-gray-400">Prices include GST</p>}
          <div className="flex justify-between text-xl font-bold text-gray-900 pt-1">
            <span>Total</span><span>{formatPrice(total)}</span>
          </div>
          <button onClick={onPlaceOrder} disabled={placing}
            className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-lg disabled:opacity-50 mt-2">
            {placing ? 'Placing Order…' : 'Place Room Service Order'}
          </button>
          <p className="text-sm text-gray-400 text-center mt-2">Will be delivered to your room · Charged to room bill</p>
        </div>
      </div>
    </div>
  )
}

// ── Order tracker steps ───────────────────────────────────────────────────────
const TRACK_STEPS = [
  { key: 'pending',   emoji: '🧾', label: 'Received'  },
  { key: 'preparing', emoji: '👨‍🍳', label: 'Preparing' },
  { key: 'ready',     emoji: '🔔', label: 'Ready!'    },
  { key: 'served',    emoji: '✅', label: 'Delivered' },
]
const STATUS_CFG = {
  pending:   { heroBg: 'from-amber-400 to-orange-400',  icon: '🧾', headline: 'Order received!',   sub: 'Your order is in the kitchen queue.' },
  preparing: { heroBg: 'from-blue-500 to-indigo-500',   icon: '👨‍🍳', headline: 'Cooking now…',      sub: 'The kitchen is preparing your food.' },
  ready:     { heroBg: 'from-emerald-400 to-green-500', icon: '🔔', headline: 'On the way!',        sub: 'Room service is bringing it to you.' },
  served:    { heroBg: 'from-gray-200 to-gray-300',     icon: '✅', headline: 'Delivered',          sub: 'Enjoy your meal! Charges added to room bill.' },
}

function ProgressBar({ status }) {
  const idx = TRACK_STEPS.findIndex(s => s.key === status)
  return (
    <div className="flex items-start gap-0 w-full">
      {TRACK_STEPS.map((step, i) => {
        const done = i < idx; const active = i === idx; const isLast = i === TRACK_STEPS.length - 1
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
  const cfg = STATUS_CFG[batch.status] ?? STATUS_CFG.pending
  const isReadyMade = batch.is_ready_made
  return (
    <div className="bg-white rounded-3xl overflow-hidden shadow-sm mb-4">
      <div className={`bg-gradient-to-br ${cfg.heroBg} px-5 pt-5 pb-6`}>
        <div className="flex items-center justify-between mb-3">
          <div>
            {totalBatches > 1 && <p className="text-white/70 text-sm font-semibold uppercase tracking-widest mb-0.5">Order {batchNum} of {totalBatches}</p>}
            <p className="text-xl font-bold text-white">{cfg.headline}</p>
            <p className="text-base text-white opacity-80">{cfg.sub}</p>
          </div>
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
            <span className="text-white text-xs font-semibold">Instant · {batch.status === 'served' ? 'Delivered' : 'Ready'}</span>
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
                  {item.category_name && <p className="text-[11px] text-gray-400 uppercase tracking-wide font-semibold">{item.category_name}</p>}
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

function OrdersView({ sessionOrders, onOrderMore, tenantId, roomId }) {
  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey: ['room-order-tracker', sessionOrders],
    queryFn: () => getOrderStatus(sessionOrders).then(r => r.data.data),
    enabled: !!sessionOrders,
  })

  useEffect(() => {
    if (!tenantId || !roomId || !sessionOrders) return
    const ably = new Ably.Realtime({ key: import.meta.env.VITE_ABLY_KEY })
    const channel = ably.channels.get(`public:tenant.${tenantId}.table.${roomId}`)
    console.log(`[Ably] RoomMenuPage: connecting to tenant.${tenantId}.table.${roomId}`)
    ably.connection.on((stateChange) => console.log(`[Ably] RoomMenuPage: connection ${stateChange.current}`, stateChange.reason ?? ''))
    channel.subscribe('order.updated', (msg) => {
      console.log('[Ably] RoomMenuPage: order.updated received', msg.data)
      console.log('[Ably] RoomMenuPage: calling order status API')
      refetch()
    }).catch(() => {})
    return () => { channel.unsubscribe(); ably.close() }
  }, [tenantId, roomId, sessionOrders, refetch])

  const batches  = data?.batches ?? []
  const hasReady = batches.some(b => b.status === 'ready')
  const total    = batches.reduce((s, b) => s + Number(b.total), 0)

  if (!sessionOrders) return (
    <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
      <div className="text-6xl mb-4">🍽️</div>
      <p className="font-bold text-gray-800 text-lg">Nothing ordered yet</p>
      <p className="text-sm text-gray-400 mt-1 mb-6">Browse the menu and order room service.</p>
      <button onClick={onOrderMore} className="bg-orange-500 text-white font-bold px-8 py-3.5 rounded-2xl text-sm shadow-lg shadow-orange-200">Browse Menu</button>
    </div>
  )

  return (
    <div className="pb-28">
      {hasReady && (
        <div className="mx-4 mt-4 bg-gradient-to-r from-emerald-500 to-green-500 rounded-2xl px-5 py-3 flex items-center gap-3 mb-4 shadow-lg shadow-green-200">
          <span className="text-2xl animate-bounce">🔔</span>
          <div><p className="font-bold text-white text-sm">Your food is on the way!</p><p className="text-xs text-white/80">Room service is heading to your room.</p></div>
        </div>
      )}
      {!isLoading && batches.length > 0 && !hasReady && (
        <div className="mx-4 mt-4 mb-2">
          <p className="text-xs text-gray-400 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse inline-block"/>
            {isFetching ? 'Updating…' : 'Live updates'}
          </p>
        </div>
      )}
      {isLoading && batches.length === 0 ? (
        <div className="px-4 mt-4 space-y-4">
          {[1, 2].map(i => (
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
      {batches.length > 0 && (
        <div className="mx-4 bg-gray-900 text-white rounded-2xl px-5 py-5 mb-4">
          <div className="flex justify-between items-center">
            <span className="text-base font-semibold text-gray-300">Total this stay (room service)</span>
            <span className="text-2xl font-bold tabular-nums">{formatPrice(total)}</span>
          </div>
          <p className="text-xs text-gray-500 mt-1">Charges will be added to your room bill at checkout</p>
        </div>
      )}
      <div className="px-4">
        <button onClick={onOrderMore} className="w-full border-2 border-orange-400 text-orange-500 font-bold py-4 rounded-2xl text-base hover:bg-orange-50 transition-colors">+ Order More</button>
      </div>
    </div>
  )
}

// ── Menu Item Card ─────────────────────────────────────────────────────────────
function MenuItemCard({ item, cartLine, onTap, onDirectAdd, onUpdateQty, orderingEnabled, gstInclusive }) {
  const hasCustomization = item.variants?.length > 0 || item.addon_groups?.length > 0
  const imgUrl  = item.image_url ?? null
  const inCart  = cartLine && cartLine.quantity > 0
  const [imgErr, setImgErr] = useState(false)
  const displayPrice = item.variants?.length > 0
    ? `from ${formatPrice(Math.min(...item.variants.map(v => v.price)))}`
    : formatPrice(item.price)
  return (
    <div className="bg-white rounded-2xl overflow-hidden shadow-sm flex cursor-pointer active:scale-[0.99] transition-transform" onClick={() => onTap(item)}>
      {imgUrl && !imgErr && (
        <div className="relative w-32 self-stretch shrink-0 overflow-hidden bg-gray-100">
          <img src={imgUrl} className="absolute inset-0 w-full h-full object-cover" onError={() => setImgErr(true)}/>
        </div>
      )}
      <div className="flex-1 p-4 flex flex-col min-w-0 min-h-[7rem]">
        <div>
          <div className="flex items-start gap-2 mb-1">
            <span className="shrink-0 mt-0.5">{typeIcon[item.type]}</span>
            <span className="font-bold text-gray-900 text-base leading-tight">{item.name}</span>
          </div>
          {item.description && <p className="text-sm text-gray-400 line-clamp-2 mt-1 ml-6">{item.description}</p>}
          <div className="flex flex-wrap items-center gap-1.5 mt-1.5 ml-6">
            {item.is_ready_made && <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><BoltIcon className="w-3 h-3"/>Instant</span>}
            {item.prep_time_minutes && !item.is_ready_made && <span className="text-xs bg-amber-50 text-amber-700 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1"><ClockIcon className="w-3 h-3"/>~{item.prep_time_minutes}m</span>}
            {item.meat_type && <span className="text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full">{item.meat_type}</span>}
            {item.serving_info && <span className="text-xs text-gray-400">{item.serving_info}</span>}
          </div>
        </div>
        <div className="flex items-center justify-between gap-3 mt-3 ml-6">
          <div className="min-w-0">
            <span className="font-bold text-gray-900 text-base">{displayPrice}</span>
            {gstInclusive
              ? <span className="text-xs text-gray-400 ml-1">incl. GST</span>
              : item.gst_slab != null ? <span className="text-xs text-gray-400 ml-1">+{item.gst_slab}% GST</span> : null
            }
          </div>
          {orderingEnabled && (
            inCart && !hasCustomization ? (
              <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                <button onClick={() => onUpdateQty(cartLine._idx, -1)} className="w-9 h-9 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center text-xl leading-none">−</button>
                <span className="font-bold w-5 text-center text-base">{cartLine.quantity}</span>
                <button onClick={() => onUpdateQty(cartLine._idx, 1)} className="w-9 h-9 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center text-xl leading-none">+</button>
              </div>
            ) : (
              <button
                onClick={e => { e.stopPropagation(); hasCustomization ? onTap(item) : onDirectAdd(item) }}
                className={`text-sm font-semibold px-5 py-2 rounded-full transition-colors min-h-[36px] ${inCart ? 'bg-orange-100 text-orange-600' : 'bg-orange-500 text-white'}`}>
                {inCart ? `${cartLine.quantity} added` : hasCustomization ? 'Customize' : 'Add'}
              </button>
            )
          )}
        </div>
      </div>
    </div>
  )
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function RoomMenuPage() {
  const { slug, token } = useParams()
  const [view, setView]               = useState('menu')
  const [cart, setCart]               = useState([])
  const [showCart, setShowCart]       = useState(false)
  const [activeCat, setActiveCat]     = useState(null)
  const [activeSub, setActiveSub]     = useState(null)
  const [menuSearch, setMenuSearch]   = useState('')
  const [debouncedSearch, setDebounced] = useState('')
  const [customizeItem, setCustomizeItem] = useState(null)
  const [sessionOrders, setSessionOrders] = useState(null)

  useEffect(() => {
    const t = setTimeout(() => setDebounced(menuSearch), 250)
    return () => clearTimeout(t)
  }, [menuSearch])

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-room-menu', slug, token],
    queryFn:  () => getCustomerRoomMenu(slug, token).then(r => r.data.data),
    staleTime: 0,
  })

  // Recover session orders on mount
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!data) return
    if (data.active_order_numbers && !sessionOrders) {
      setSessionOrders(data.active_order_numbers)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data])
  /* eslint-enable react-hooks/set-state-in-effect */

  const placeOrder = useMutation({
    mutationFn: ({ slug, token, items }) => customerPlaceRoomOrder(slug, token, { items }),
    onSuccess: (res) => {
      const d = res.data.data
      const newNumbers = d?.order_numbers ?? d?.order_number
      setSessionOrders(prev => prev ? `${prev},${newNumbers}` : newNumbers)
      setCart([])
      setShowCart(false)
      setView('orders')
    },
  })

  const cartKey = (itemId, variantId, addonIds) => `${itemId}:${variantId ?? ''}:${[...(addonIds ?? [])].sort().join(',')}`

  const addToCart = (line) => {
    const key = cartKey(line.menu_item_id, line.variant_id, line.addon_ids)
    setCart(c => {
      const idx = c.findIndex(x => x._key === key)
      if (idx >= 0) return c.map((x, i) => i === idx ? { ...x, quantity: x.quantity + line.quantity } : x)
      return [...c, { ...line, _key: key }]
    })
    setCustomizeItem(null)
  }

  const directAdd = (item) => {
    addToCart({ menu_item_id: item.id, variant_id: null, addon_ids: [], quantity: 1, name: item.name, variant_name: null, addon_labels: [], price: item.price, type: item.type, is_ready_made: item.is_ready_made })
  }

  const updateQty = (idx, delta) =>
    setCart(c => c.map((x, i) => i === idx ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))

  const getCartLine = (item) => {
    const hasCustom = item.variants?.length > 0 || item.addon_groups?.length > 0
    if (hasCustom) {
      const all = cart.filter(x => x.menu_item_id === item.id)
      if (all.length === 0) return null
      return { quantity: all.reduce((s, x) => s + x.quantity, 0), _idx: null }
    }
    const idx = cart.findIndex(x => x.menu_item_id === item.id && !x.variant_id && (!x.addon_ids?.length))
    if (idx < 0) return null
    return { ...cart[idx], _idx: idx }
  }

  const categories      = data?.categories ?? []
  const gstInclusive    = data?.tenant?.gst_inclusive ?? false
  const gstRate         = Number(data?.tenant?.gst_rate ?? 5)
  const orderingEnabled = data?.tenant?.qr_ordering_enabled !== false
  const cartCount       = cart.reduce((s, x) => s + x.quantity, 0)
  const cartTotal       = cart.reduce((s, x) => s + x.price * x.quantity, 0)

  const allItems = categories.flatMap(c => [...(c.items ?? []), ...(c.subcategories ?? []).flatMap(s => s.items ?? [])])
  const searchedItems = debouncedSearch.trim()
    ? allItems.filter(i => i.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : null
  const activeCatData  = categories.find(c => c.id === (activeCat ?? categories[0]?.id))
  const activeSubData  = activeSub ? activeCatData?.subcategories?.find(s => s.id === activeSub) : null
  const displayedItems = searchedItems ?? (activeSubData ? activeSubData.items : activeCatData?.items ?? [])

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-center"><div className="text-4xl mb-4 animate-bounce">🛎️</div><p className="text-gray-400">Loading room service menu…</p></div>
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

  const { tenant, room } = data ?? {}

  return (
    <div className="min-h-screen bg-gray-200/60 flex flex-col items-center">
      <div className="relative w-full max-w-md bg-gray-50 flex flex-col flex-1 min-h-screen shadow-xl">

        {/* Header */}
        <div className="bg-white px-5 pt-5 pb-0 shadow-sm sticky top-0 z-20">
          <div className="flex items-start justify-between mb-2">
            <div>
              <h1 className="text-xl font-bold text-gray-900 leading-tight">{tenant?.name}</h1>
              <p className="text-sm text-gray-400 mt-0.5">
                🛎️ Room {room?.number}
                {room?.floor ? ` · Floor ${room.floor}` : ''}
                {room?.type ? ` · ${room.type}` : ''}
              </p>
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
                <input id="room-menu-search" name="menu_search" aria-label="Search menu" type="search" value={menuSearch} onChange={e => setMenuSearch(e.target.value)}
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
              {!debouncedSearch.trim() && activeCatData?.subcategories?.length > 0 && (
                <div className="flex gap-2 py-2.5 overflow-x-auto scrollbar-hide -mx-5 px-5">
                  <button onClick={() => setActiveSub(null)}
                    className={`shrink-0 px-4 py-2 text-sm font-medium rounded-full border transition-colors ${activeSub === null ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>All</button>
                  {activeCatData.subcategories.map(sub => (
                    <button key={sub.id} onClick={() => setActiveSub(sub.id)}
                      className={`shrink-0 px-4 py-2 text-sm font-medium rounded-full border transition-colors ${activeSub === sub.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {sub.name}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto">
          {view === 'menu' ? (
            <div className="px-4 pt-4 pb-36 space-y-3">
              {!orderingEnabled && (
                <div className="bg-amber-50 border border-amber-200 rounded-2xl px-4 py-3 text-sm text-amber-700 text-center">
                  Room service ordering is currently paused. Please call the front desk.
                </div>
              )}
              {searchedItems !== null && searchedItems.length === 0 && (
                <div className="text-center py-10 text-gray-400">
                  <div className="text-3xl mb-2">🔍</div>
                  <p>No items found for "{debouncedSearch}"</p>
                </div>
              )}
              {displayedItems.map(item => (
                <MenuItemCard key={item.id} item={item}
                  cartLine={getCartLine(item)}
                  onTap={setCustomizeItem}
                  onDirectAdd={directAdd}
                  onUpdateQty={updateQty}
                  orderingEnabled={orderingEnabled}
                  gstInclusive={gstInclusive}
                />
              ))}
            </div>
          ) : (
            <OrdersView
              sessionOrders={sessionOrders}
              onOrderMore={() => setView('menu')}
              tenantId={data?.tenant_id}
              roomId={room?.id}
            />
          )}
        </div>

        {/* Cart FAB */}
        {view === 'menu' && cartCount > 0 && (
          <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-100 via-gray-100/95 to-transparent pointer-events-none">
            <div className="pointer-events-auto max-w-md mx-auto">
              {sessionOrders && (
                <button onClick={() => setView('orders')}
                  className="w-full bg-white border border-orange-200 text-orange-600 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-sm mb-2.5">
                  <span className="flex items-center gap-2.5 font-semibold text-base">
                    <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse inline-block"/>
                    Track My Orders
                  </span>
                  <ChevronRightIcon className="w-5 h-5"/>
                </button>
              )}
              <button onClick={() => setShowCart(true)}
                className="w-full bg-orange-500 text-white rounded-2xl px-5 py-4 flex items-center justify-between shadow-xl shadow-orange-200/60">
                <span className="bg-orange-700 text-white text-sm font-bold px-2.5 py-1 rounded-full">{cartCount} items</span>
                <span className="font-bold text-base">View Cart</span>
                <span className="font-bold text-base">{formatPrice(cartTotal)}</span>
              </button>
            </div>
          </div>
        )}

        {/* Track orders button when cart is empty */}
        {view === 'menu' && cartCount === 0 && sessionOrders && (
          <div className="fixed bottom-0 left-0 right-0 z-30 px-4 pb-6 pt-3 bg-gradient-to-t from-gray-100 via-gray-100/95 to-transparent pointer-events-none">
            <div className="pointer-events-auto max-w-md mx-auto">
              <button onClick={() => setView('orders')}
                className="w-full bg-white border border-orange-200 text-orange-600 rounded-2xl px-5 py-3.5 flex items-center justify-between shadow-sm">
                <span className="flex items-center gap-2.5 font-semibold text-base">
                  <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse inline-block"/>
                  Track My Orders
                </span>
                <ChevronRightIcon className="w-5 h-5"/>
              </button>
            </div>
          </div>
        )}

        <PoweredByBanner/>
      </div>

      {showCart && (
        <CartSheet
          cart={cart}
          onClose={() => setShowCart(false)}
          onUpdateQty={updateQty}
          onPlaceOrder={() => placeOrder.mutate({ slug, token, items: cart.map(({ menu_item_id, variant_id, addon_ids, quantity }) => ({ menu_item_id, variant_id, addon_ids, quantity })) })}
          placing={placeOrder.isPending}
          gstInclusive={gstInclusive}
          gstRate={gstRate}
        />
      )}

      {customizeItem && (
        <ItemCustomizeSheet
          item={customizeItem}
          onClose={() => setCustomizeItem(null)}
          onAdd={addToCart}
        />
      )}
    </div>
  )
}
