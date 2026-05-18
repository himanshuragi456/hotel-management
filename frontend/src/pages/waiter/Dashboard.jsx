import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getWaiterTables, getWaiterMenu, getWaiterTableOrders,
  placeOrder, markServed,
  getWaiterOrders, getActiveRooms, placeRoomService,
} from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'
import { useNavigate } from 'react-router-dom'
import { formatOccupied } from '@/utils/time'
import Pusher from 'pusher-js'
import {
  TableCellsIcon,
  HomeModernIcon,
  XMarkIcon,
  PlusIcon,
  MinusIcon,
  CheckCircleIcon,
  ClockIcon,
  FireIcon,
  ArrowRightOnRectangleIcon,
  BellIcon,
  SparklesIcon,
  ReceiptPercentIcon,
  CurrencyRupeeIcon,
  ListBulletIcon,
} from '@heroicons/react/24/outline'

// ─── Skeleton Shimmer ────────────────────────────────────────────────────────
function Skeleton({ className = '' }) {
  return <div className={`bg-gray-100 animate-pulse rounded-lg ${className}`} />
}

// ─── Table Grid ──────────────────────────────────────────────────────────────
function TableGrid({ onSelect }) {
  const { data: tables, isLoading } = useQuery({
    queryKey: ['waiter-tables'],
    queryFn: () => getWaiterTables().then(r => r.data.data),
    refetchInterval: 10000,
  })

  if (isLoading) return (
    <div className="space-y-6">
      {[1, 2].map(s => (
        <div key={s}>
          <Skeleton className="h-4 w-24 mb-3" />
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="h-16" />
            ))}
          </div>
        </div>
      ))}
    </div>
  )

  if (!tables?.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <TableCellsIcon className="w-12 h-12 mb-3 text-gray-300" />
      <p className="text-sm font-medium">No tables configured yet.</p>
    </div>
  )

  // Group by section
  const sections = tables.reduce((acc, t) => {
    const s = t.section || 'Other'
    if (!acc[s]) acc[s] = []
    acc[s].push(t)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {Object.entries(sections).map(([section, rows]) => (
        <div key={section}>
          <div className="flex items-center gap-2 mb-3">
            <div className="h-px flex-1 bg-gray-200" />
            <span className="text-xs font-semibold text-gray-400 uppercase tracking-widest px-2">{section}</span>
            <div className="h-px flex-1 bg-gray-200" />
          </div>
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
            {rows.map(t => (
              <button
                key={t.id}
                onClick={() => onSelect(t)}
                className={`relative rounded-xl border-l-4 bg-white p-3 text-center transition-all hover:shadow-md hover:-translate-y-0.5 active:scale-95 shadow-sm ${
                  t.bill_requested_at ? 'border-l-purple-400' :
                  t.status === 'occupied' ? 'border-l-orange-400' : 'border-l-green-400'
                }`}
              >
                {t.bill_requested_at && (
                  <span className="absolute -top-1.5 -right-1.5 bg-purple-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">BILL</span>
                )}
                <div className="flex items-center justify-center gap-1 mb-1">
                  <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${
                    t.bill_requested_at ? 'bg-purple-500 animate-pulse' :
                    t.status === 'free' ? 'bg-green-500' : 'bg-orange-500'
                  }`} />
                </div>
                <div className="text-base font-bold text-gray-900">{t.number}</div>
                <div className={`text-xs font-medium mt-0.5 ${
                  t.bill_requested_at ? 'text-purple-600' :
                  t.status === 'free' ? 'text-green-600' : 'text-orange-600'
                }`}>
                  {t.bill_requested_at ? '🧾 Bill' : t.status === 'free' ? 'Free' : (t.occupied_label ?? formatOccupied(t.occupied_minutes ?? 0))}
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Table Order Panel ────────────────────────────────────────────────────────
function TableOrderPanel({ table, onClose }) {
  const qc = useQueryClient()
  const { getTenantId } = useAuthStore()
  const tenantId = getTenantId?.()
  const [cart, setCart] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [showMenu, setShowMenu] = useState(false)

  // Load ALL open orders for this table (multiple batches)
  const { data: orders = [], isLoading: loadingOrders } = useQuery({
    queryKey: ['waiter-table-orders', table.id],
    queryFn: () => getWaiterTableOrders(table.id).then(r => r.data.data),
    refetchInterval: 8000,
  })

  // Realtime refresh via Pusher
  useEffect(() => {
    if (!tenantId) return
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
    const channel = pusher.subscribe(`tenant.${tenantId}.kitchen`)
    channel.bind('order.updated', () => {
      qc.invalidateQueries({ queryKey: ['waiter-table-orders', table.id] })
      qc.invalidateQueries({ queryKey: ['waiter-tables'] })
    })
    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`tenant.${tenantId}.kitchen`)
    }
  }, [tenantId, table.id, qc])

  const { data: menu, isLoading: menuLoading } = useQuery({
    queryKey: ['waiter-menu'],
    queryFn: () => getWaiterMenu().then(r => r.data.data),
  })
  const cats = menu ?? []
  const activeCatId = activeCat ?? cats[0]?.id
  const visibleItems = cats.find(c => c.id === activeCatId)?.items?.filter(i => i.is_available) ?? []

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['waiter-table-orders', table.id] })
    qc.invalidateQueries({ queryKey: ['waiter-tables'] })
    qc.invalidateQueries({ queryKey: ['waiter-orders'] })
  }

  const createOrder = useMutation({
    mutationFn: placeOrder,
    onSuccess: () => { invalidate(); setCart([]); setShowMenu(false) },
  })

  const served = useMutation({
    mutationFn: (orderId) => markServed(orderId),
    onSuccess: invalidate,
  })

  const addToCart = (item) => setCart(c => {
    const ex = c.find(x => x.menu_item_id === item.id)
    if (ex) return c.map(x => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x)
    return [...c, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }]
  })
  const updateQty = (id, delta) =>
    setCart(c => c.map(x => x.menu_item_id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))

  const cartTotal = cart.reduce((s, x) => s + x.price * x.quantity, 0)
  const hasOpenOrders = orders.some(o => !['served', 'cancelled'].includes(o.status))
  const unbilled = orders.filter(o => o.status !== 'cancelled' && !o.invoice)
  const billSubtotal = unbilled.reduce((s, o) => s + parseFloat(o.subtotal ?? 0), 0)
  const billTax      = unbilled.reduce((s, o) => s + parseFloat(o.tax ?? 0), 0)
  const billTotal    = billSubtotal + billTax

  const handleSendToKitchen = () => {
    if (!cart.length) return
    createOrder.mutate({
      restaurant_table_id: table.id,
      items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })),
    })
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white/95 backdrop-blur-sm w-full sm:rounded-2xl sm:max-w-2xl max-h-screen sm:max-h-[92vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-orange-50 flex items-center justify-center">
              <TableCellsIcon className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Table {table.number}</h2>
              <p className="text-xs text-gray-400">
                {table.section} · {table.capacity} seats
                {table.occupied_label ? ` · Occupied ${table.occupied_label}` : ''}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">

          {/* All order batches */}
          {loadingOrders ? (
            <div className="p-5 space-y-3">
              {[1, 2].map(i => <Skeleton key={i} className="h-24" />)}
            </div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 px-5 text-gray-400">
              <ListBulletIcon className="w-10 h-10 mb-2 text-gray-300" />
              <p className="text-sm font-medium text-gray-500">No active orders</p>
              <p className="text-xs text-gray-400 mt-1">Add items below to start a new order.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {orders.map((order, idx) => (
                <div key={order.id} className="px-5 py-4 bg-gray-50/50">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-gray-800">Batch {idx + 1}</span>
                      <span className="text-xs text-gray-400 flex items-center gap-1">
                        <ClockIcon className="w-3 h-3" />
                        {order.elapsed_label} ago
                      </span>
                    </div>
                    <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${
                      order.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                      order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                      order.status === 'ready'     ? 'bg-green-100 text-green-700' :
                      'bg-gray-100 text-gray-500'
                    }`}>{order.status}</span>
                  </div>

                  <div className="space-y-1.5 mb-3">
                    {order.items?.map((item, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="text-gray-700">
                          <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-200 text-gray-600 rounded text-xs font-bold mr-1.5">{item.quantity}</span>
                          {item.item_name}
                        </span>
                        <span className="text-gray-500">₹{item.subtotal}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-sm font-semibold text-gray-800 border-t border-gray-200 pt-2 mt-2">
                      <span>Batch Total</span>
                      <span className="flex items-center gap-0.5">
                        <CurrencyRupeeIcon className="w-3.5 h-3.5" />
                        {order.total}
                      </span>
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    {order.status === 'ready' && (
                      <button
                        onClick={() => served.mutate(order.id)}
                        disabled={served.isPending}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg font-semibold disabled:opacity-50 transition-colors"
                      >
                        <CheckCircleIcon className="w-3.5 h-3.5" />
                        Mark Served
                      </button>
                    )}
                    {order.invoice && (
                      <span className="flex-1 flex items-center justify-center gap-1.5 text-xs text-green-600 font-medium py-2">
                        <ReceiptPercentIcon className="w-3.5 h-3.5" />
                        Billed
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Cart — new batch being built */}
          {cart.length > 0 && (
            <div className="px-5 py-4 border-t border-orange-100 bg-orange-50/60">
              <div className="flex items-center gap-2 mb-3">
                <SparklesIcon className="w-4 h-4 text-orange-500" />
                <span className="text-sm font-semibold text-orange-800">New Batch</span>
                <span className="text-xs text-orange-400 ml-auto">Not sent yet</span>
              </div>
              <div className="space-y-2 mb-4">
                {cart.map(item => (
                  <div key={item.menu_item_id} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-700 flex-1 truncate">{item.name}</span>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        onClick={() => updateQty(item.menu_item_id, -1)}
                        className="w-6 h-6 rounded-full bg-white border border-gray-200 text-gray-600 flex items-center justify-center hover:bg-gray-50 transition-colors"
                      >
                        <MinusIcon className="w-3 h-3" />
                      </button>
                      <span className="text-sm w-5 text-center font-semibold text-gray-800">{item.quantity}</span>
                      <button
                        onClick={() => updateQty(item.menu_item_id, 1)}
                        className="w-6 h-6 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition-colors"
                      >
                        <PlusIcon className="w-3 h-3" />
                      </button>
                      <span className="text-sm text-gray-500 w-14 text-right font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between">
                <span className="text-base font-bold text-orange-700 flex items-center gap-0.5">
                  <CurrencyRupeeIcon className="w-4 h-4" />
                  {cartTotal.toFixed(0)}
                </span>
                <button
                  onClick={handleSendToKitchen}
                  disabled={createOrder.isPending}
                  className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-sm px-5 py-2.5 rounded-xl font-semibold disabled:opacity-50 shadow-sm shadow-orange-200 transition-all"
                >
                  <FireIcon className="w-4 h-4" />
                  {createOrder.isPending ? 'Sending…' : 'Send to Kitchen'}
                </button>
              </div>
            </div>
          )}

          {/* Add Items toggle — always available so waiter can place a new order even after all are served */}
          <div className="px-5 py-3">
            <button
              onClick={() => setShowMenu(m => !m)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-orange-200 bg-orange-50/40 hover:bg-orange-50 text-orange-600 text-sm font-medium transition-colors"
            >
              {showMenu
                ? <><MinusIcon className="w-4 h-4" /> Hide Menu</>
                : <><PlusIcon className="w-4 h-4" /> New Order / Add Items</>
              }
            </button>
          </div>

          {/* Menu */}
          {showMenu && (
            <div className="border-t border-gray-100">
              {/* Category pill tabs */}
              <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-gray-100 bg-gray-50/60 no-scrollbar">
                {menuLoading
                  ? [1,2,3].map(i => <div key={i} className="h-7 w-20 bg-gray-100 rounded-full animate-pulse shrink-0" />)
                  : cats.map(c => (
                  <button key={c.id} onClick={() => setActiveCat(c.id)}
                    className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                      activeCatId === c.id
                        ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                        : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-200 hover:text-orange-600'
                    }`}>
                    {c.name}
                  </button>
                ))}
              </div>

              {/* Menu items grid */}
              <div className="divide-y divide-gray-50">
                {menuLoading ? (
                  [1,2,3,4].map(i => (
                    <div key={i} className="flex items-center justify-between px-5 py-3 animate-pulse">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-gray-100 rounded-sm" />
                        <div>
                          <div className="h-4 w-32 bg-gray-100 rounded mb-1" />
                          <div className="h-3 w-12 bg-gray-100 rounded" />
                        </div>
                      </div>
                      <div className="h-8 w-8 bg-gray-100 rounded-full" />
                    </div>
                  ))
                ) : visibleItems.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-10 text-gray-400">
                    <SparklesIcon className="w-8 h-8 mb-2 text-gray-300" />
                    <p className="text-sm">No available items in this category.</p>
                  </div>
                ) : visibleItems.map(item => {
                  const inCart = cart.find(x => x.menu_item_id === item.id)
                  return (
                    <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className={`w-3 h-3 rounded-sm border-2 shrink-0 ${item.type === 'veg' ? 'border-green-500 bg-green-100' : 'border-red-500 bg-red-100'}`} />
                        <div className="min-w-0">
                          <div className="text-sm font-medium text-gray-900 truncate">{item.name}</div>
                          <div className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                            <CurrencyRupeeIcon className="w-3 h-3" />
                            {item.price}
                          </div>
                        </div>
                      </div>
                      {inCart ? (
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            onClick={() => updateQty(item.id, -1)}
                            className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center hover:bg-orange-200 transition-colors"
                          >
                            <MinusIcon className="w-3.5 h-3.5" />
                          </button>
                          <span className="w-6 text-center font-bold text-sm text-gray-800">{inCart.quantity}</span>
                          <button
                            onClick={() => updateQty(item.id, 1)}
                            className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
                          >
                            <PlusIcon className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => addToCart(item)}
                          className="shrink-0 flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs px-3.5 py-1.5 rounded-full font-semibold transition-colors"
                        >
                          <PlusIcon className="w-3 h-3" />
                          Add
                        </button>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Sticky bill total */}
        {orders.length > 0 && (
          <div className="border-t border-gray-100 bg-gray-50 px-5 py-3 flex items-center justify-between">
            <div className="flex items-center gap-4 text-xs text-gray-500">
              <span>Subtotal: <span className="font-semibold text-gray-700">₹{billSubtotal.toFixed(0)}</span></span>
              <span>GST: <span className="font-semibold text-gray-700">₹{billTax.toFixed(0)}</span></span>
            </div>
            <div className="text-base font-bold text-gray-900 flex items-center gap-0.5">
              Total <CurrencyRupeeIcon className="w-4 h-4 mx-0.5" /> {billTotal.toFixed(0)}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Room Service Panel ───────────────────────────────────────────────────────
function RoomServiceForm({ booking, onClose }) {
  const qc = useQueryClient()
  const [cart, setCart] = useState([])
  const [activeCat, setActiveCat] = useState(null)

  const { data: menu } = useQuery({ queryKey: ['waiter-menu'], queryFn: () => getWaiterMenu().then(r => r.data.data) })
  const cats = menu ?? []
  const allItems = cats.flatMap(c => c.items ?? [])
  const activeCatId = activeCat ?? cats[0]?.id
  const visibleItems = allItems.filter(i => i.is_available && i.menu_category_id === activeCatId)

  const create = useMutation({
    mutationFn: placeRoomService,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['waiter-orders'] }); onClose() },
  })

  const addToCart = (item) => setCart(c => {
    const ex = c.find(x => x.menu_item_id === item.id)
    if (ex) return c.map(x => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x)
    return [...c, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }]
  })
  const updateQty = (id, delta) => setCart(c =>
    c.map(x => x.menu_item_id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0)
  )
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white/95 backdrop-blur-sm w-full sm:rounded-2xl sm:max-w-xl max-h-screen sm:max-h-[90vh] flex flex-col overflow-hidden shadow-2xl">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 bg-white/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 flex items-center justify-center">
              <HomeModernIcon className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <h2 className="font-bold text-gray-900">Room {booking.room?.number} — Room Service</h2>
              <p className="text-xs text-gray-400">{booking.guest?.name}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
          >
            <XMarkIcon className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        {/* Category pill tabs */}
        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b border-gray-100 bg-gray-50/60 no-scrollbar">
          {cats.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors ${
                activeCatId === c.id
                  ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                  : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-200 hover:text-orange-600'
              }`}>
              {c.name}
            </button>
          ))}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {visibleItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-gray-400">
              <SparklesIcon className="w-8 h-8 mb-2 text-gray-300" />
              <p className="text-sm">No available items in this category.</p>
            </div>
          ) : visibleItems.map(item => {
            const inCart = cart.find(x => x.menu_item_id === item.id)
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <span className={`w-3 h-3 rounded-sm border-2 shrink-0 ${item.type === 'veg' ? 'border-green-500 bg-green-100' : 'border-red-500 bg-red-100'}`} />
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.name}</div>
                    <div className="text-xs text-gray-400 flex items-center gap-0.5 mt-0.5">
                      <CurrencyRupeeIcon className="w-3 h-3" />{item.price}
                    </div>
                  </div>
                </div>
                {inCart ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => updateQty(item.id, -1)}
                      className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center hover:bg-orange-200 transition-colors"
                    >
                      <MinusIcon className="w-3.5 h-3.5" />
                    </button>
                    <span className="w-6 text-center font-bold text-sm text-gray-800">{inCart.quantity}</span>
                    <button
                      onClick={() => updateQty(item.id, 1)}
                      className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center hover:bg-orange-600 transition-colors"
                    >
                      <PlusIcon className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => addToCart(item)}
                    className="flex items-center gap-1 bg-orange-500 hover:bg-orange-600 text-white text-xs px-3.5 py-1.5 rounded-full font-semibold transition-colors"
                  >
                    <PlusIcon className="w-3 h-3" />
                    Add
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Cart summary + send */}
        {cart.length > 0 && (
          <div className="border-t border-gray-100 px-5 py-4 bg-gray-50">
            <div className="space-y-1.5 mb-4">
              {cart.map(item => (
                <div key={item.menu_item_id} className="flex justify-between text-sm">
                  <span className="text-gray-700">
                    <span className="inline-flex items-center justify-center w-5 h-5 bg-gray-200 text-gray-600 rounded text-xs font-bold mr-1.5">{item.quantity}</span>
                    {item.name}
                  </span>
                  <span className="text-gray-700 font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>
            <div className="flex items-center justify-between">
              <span className="font-bold text-gray-900 text-base flex items-center gap-0.5">
                <CurrencyRupeeIcon className="w-4 h-4" />
                {total.toFixed(0)}
              </span>
              <button
                onClick={() => create.mutate({ booking_id: booking.id, items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })) })}
                disabled={create.isPending}
                className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white px-5 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 shadow-sm shadow-orange-200 transition-all"
              >
                <FireIcon className="w-4 h-4" />
                {create.isPending ? 'Sending…' : 'Send to Kitchen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Status Timeline ──────────────────────────────────────────────────────────
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
            <div className={`w-2.5 h-2.5 rounded-full shrink-0 border-2 ${i <= cur ? 'bg-orange-500 border-orange-500' : 'bg-white border-gray-200'}`} />
            <span className={`text-xs mt-0.5 truncate ${i <= cur ? 'text-orange-600 font-semibold' : 'text-gray-300'}`}>{s.label}</span>
            {s.time && i <= cur && <span className="text-xs text-gray-400">{s.time}</span>}
          </div>
          {i < steps.length - 1 && <div className={`h-px flex-1 mx-1 ${i < cur ? 'bg-orange-400' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

// ─── Active Orders List ───────────────────────────────────────────────────────
function ActiveOrders({ onSelectTable }) {
  const qc = useQueryClient()
  const { data: orders, isLoading } = useQuery({
    queryKey: ['waiter-orders'],
    queryFn: () => getWaiterOrders().then(r => r.data.data),
    refetchInterval: 8000,
  })

  const served = useMutation({
    mutationFn: (orderId) => markServed(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waiter-orders'] })
      qc.invalidateQueries({ queryKey: ['waiter-tables'] })
    },
  })

  if (isLoading) return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {[1,2,3].map(i => (
        <div key={i} className="bg-white rounded-xl border-l-4 border-l-gray-200 p-4 shadow-sm animate-pulse">
          <div className="flex items-center justify-between mb-2">
            <div className="h-4 w-20 bg-gray-100 rounded" />
            <div className="h-5 w-16 bg-gray-100 rounded-full" />
          </div>
          <div className="space-y-1.5 mt-3">
            <div className="h-3 w-full bg-gray-100 rounded" />
            <div className="h-3 w-4/5 bg-gray-100 rounded" />
          </div>
        </div>
      ))}
    </div>
  )

  if (!orders?.length) return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-5 py-8 flex flex-col items-center text-gray-400">
      <BellIcon className="w-10 h-10 mb-2 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">No active orders right now</p>
      <p className="text-xs text-gray-400 mt-1">Your assigned orders will appear here.</p>
    </div>
  )

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <ListBulletIcon className="w-4 h-4 text-gray-400" />
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">
          My Active Orders
        </p>
        <span className="ml-1 inline-flex items-center justify-center w-5 h-5 rounded-full bg-orange-500 text-white text-xs font-bold">
          {orders.length}
        </span>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {orders.map(order => (
          <div key={order.id} className={`bg-white rounded-xl border-l-4 p-4 shadow-sm hover:shadow-md transition-shadow ${
            order.status === 'pending'   ? 'border-l-yellow-400' :
            order.status === 'preparing' ? 'border-l-blue-400' :
            order.status === 'ready'     ? 'border-l-green-500' : 'border-l-gray-200'
          }`}>
            <div className="flex items-center justify-between mb-1">
              <span className="font-semibold text-gray-900 text-sm">
                {order.table?.number
                  ? `Table ${order.table.number}`
                  : `Room ${order.room?.number ?? order.booking?.guest?.name ?? '—'}`}
              </span>
              <span className={`text-xs px-2.5 py-1 rounded-full font-semibold capitalize ${
                order.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                order.status === 'ready'     ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>{order.status}</span>
            </div>

            <StatusTimeline order={order} />

            <div className="text-xs text-gray-500 space-y-0.5 mb-3">
              {order.items?.map((item, i) => (
                <div key={i} className="flex items-center gap-1">
                  <span className="inline-flex items-center justify-center w-4 h-4 bg-gray-100 text-gray-600 rounded text-xs font-bold">{item.quantity}</span>
                  <span>{item.item_name}</span>
                </div>
              ))}
            </div>

            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-bold text-gray-800 flex items-center gap-0.5">
                <CurrencyRupeeIcon className="w-3.5 h-3.5 text-gray-500" />
                {order.total}
              </span>
              <div className="flex gap-2">
                {order.status === 'ready' ? (
                  <button
                    onClick={() => served.mutate(order.id)}
                    disabled={served.isPending}
                    className="flex items-center gap-1 text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 transition-colors"
                  >
                    <CheckCircleIcon className="w-3.5 h-3.5" />
                    Mark Served
                  </button>
                ) : order.table ? (
                  <button
                    onClick={() => onSelectTable(order.table)}
                    className="flex items-center gap-1 text-xs text-orange-600 font-semibold hover:underline"
                  >
                    <PlusIcon className="w-3.5 h-3.5" />
                    New Order
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Active Rooms ─────────────────────────────────────────────────────────────
function ActiveRooms({ onSelect }) {
  const { data: rooms } = useQuery({
    queryKey: ['active-rooms'],
    queryFn: () => getActiveRooms().then(r => r.data.data),
    refetchInterval: 30000,
  })

  if (!rooms?.length) return (
    <div className="flex flex-col items-center justify-center py-16 text-gray-400">
      <HomeModernIcon className="w-12 h-12 mb-3 text-gray-300" />
      <p className="text-sm font-medium text-gray-500">No guests currently checked in.</p>
    </div>
  )

  return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
      {rooms.map(b => (
        <button key={b.id} onClick={() => onSelect(b)}
          className="relative rounded-xl border-l-4 border-l-blue-400 bg-white hover:shadow-md hover:-translate-y-0.5 p-3 text-center transition-all active:scale-95 shadow-sm">
          <div className="flex items-center justify-center mb-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
          </div>
          <div className="text-base font-bold text-gray-900">{b.room?.number}</div>
          <div className="text-xs text-blue-600 font-semibold mt-0.5">Service</div>
          <div className="text-xs text-gray-500 truncate">{b.guest?.name?.split(' ')[0]}</div>
        </button>
      ))}
    </div>
  )
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────
export default function WaiterDashboard() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedTable, setSelectedTable] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [tab, setTab] = useState('tables')

  const openTable = (t) => {
    qc.invalidateQueries({ queryKey: ['waiter-table-orders', t.id] })
    setSelectedTable(t)
  }

  const handleLogout = async () => {
    try { await logoutApi() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-slate-900 px-6 py-3.5 flex items-center justify-between sticky top-0 z-10 shadow-lg">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
            <span className="text-xs font-medium text-green-400">Live</span>
          </div>
          <div className="h-4 w-px bg-slate-700" />
          <h1 className="text-sm font-semibold text-white">{user?.name}</h1>
          <span className="text-xs text-slate-400 font-medium">· Waiter</span>
        </div>
        <button
          onClick={handleLogout}
          className="flex items-center gap-1.5 text-xs text-slate-400 hover:text-white transition-colors px-2 py-1.5 rounded-lg hover:bg-slate-800"
        >
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          Logout
        </button>
      </header>

      {/* My Active Orders — always visible */}
      <div className="px-6 pt-5">
        <ActiveOrders onSelectTable={t => { setSelectedTable(t); setTab('tables') }} />
      </div>

      {/* View Tabs */}
      <div className="flex gap-2 px-6 pt-5">
        {[
          { key: 'tables', label: 'Tables', icon: TableCellsIcon },
          { key: 'room service', label: 'Room Service', icon: HomeModernIcon },
        ].map(({ key, label, icon: Icon }) => (
          <button key={key} onClick={() => setTab(key)}
            className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition-colors ${
              tab === key
                ? 'bg-orange-500 text-white shadow-sm shadow-orange-200'
                : 'bg-white text-gray-600 border border-gray-200 hover:border-orange-200 hover:text-orange-600'
            }`}>
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      <div className="p-6">
        {tab === 'tables' && (
          <div className="space-y-2">
            <p className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
              <TableCellsIcon className="w-3.5 h-3.5" />
              Tap a table to view its order or start a new one.
            </p>
            <TableGrid onSelect={openTable} />
          </div>
        )}
        {tab === 'room service' && (
          <div>
            <p className="text-xs text-gray-400 mb-4 flex items-center gap-1.5">
              <HomeModernIcon className="w-3.5 h-3.5" />
              Tap a room to place a room service order.
            </p>
            <ActiveRooms onSelect={setSelectedBooking} />
          </div>
        )}
      </div>

      {selectedTable && (
        <TableOrderPanel
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
        />
      )}
      {selectedBooking && (
        <RoomServiceForm
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}
    </div>
  )
}
