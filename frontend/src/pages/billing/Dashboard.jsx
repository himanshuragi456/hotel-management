import { useState, useEffect, useRef } from 'react'
import ItemCustomizeSheet from '@/components/shared/ItemCustomizeSheet'

const WAITER_CALL_WINDOW_MS  = 20_000
const BILL_REQUEST_WINDOW_MS = 30_000

function isWaiterCallActive(ts) {
  if (!ts) return false
  return Date.now() - new Date(ts).getTime() < WAITER_CALL_WINDOW_MS
}

function isBillRequestActive(ts) {
  if (!ts) return false
  return Date.now() - new Date(ts).getTime() < BILL_REQUEST_WINDOW_MS
}

// Ticks every second while any table has an active waiter call or bill request
function useAlertTicker(tables) {
  const [, setTick] = useState(0)
  useEffect(() => {
    const hasActive = tables.some(
      t => isWaiterCallActive(t.waiter_called_at) || isBillRequestActive(t.bill_requested_at)
    )
    if (!hasActive) return
    const id = setInterval(() => setTick(n => n + 1), 1000)
    return () => clearInterval(id)
  }, [tables])
}
import SubscriptionAlert from '@/components/shared/SubscriptionAlert'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Pusher from 'pusher-js'
import {
  XMarkIcon, PlusIcon, MinusIcon, PrinterIcon, ArrowDownTrayIcon,
  CheckCircleIcon, ArrowRightOnRectangleIcon, UserIcon, PhoneIcon,
  FireIcon, BanknotesIcon, DocumentTextIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline'
import {
  getBillingTables, getBillingTableOrders, getBillingTableHistory, closeBillingTable, billAllOrders,
  getBillingMenu, billingAddItems, billingNewOrder, billingMarkServed, billingUpdateStatus,
  createInvoice, downloadInvoicePdf, downloadCombinedPdf, getRecentInvoices,
  getBillingRoomStatus, getBillingActiveRooms,
  getBillingBookings, createBillingBooking, getBillingBooking,
  checkInBillingBooking, checkOutBillingBooking, cancelBillingBooking,
  getBillingBookingCheckoutSummary,
  searchBillingGuests, createBillingGuest, getBillingRooms,
  getBillingWaiters,
  billingPlaceRoomService,
  getBillingBookingOrders,
  billingMarkServedRoom,
  extendBillingBookingStay,
  getActiveOrders,
  getOwnerSettings, updateOwnerSettings,
  getTenantSettings,
  billingPlaceTakeaway,
  billingPlaceAggregator,
  getPendingMtOrders, confirmMtPayment, discardMtOrder,
  getBillPaidTables, confirmBillPaid, rejectBillPaid,
  setActiveContactPhone,
} from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'
import { useNavigate } from 'react-router-dom'
import HotelBookings, { CheckOutModal, BookingDetail } from '@/pages/owner/hotel/Bookings'
import { formatOccupied } from '@/utils/time'
import { printKot } from '@/utils/kotPrint'

const PAYMENT_METHODS = ['cash', 'upi']

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
    <div className="flex items-center gap-1 my-2">
      {steps.map((s, i) => (
        <div key={s.key} className="flex items-center flex-1 min-w-0">
          <div className="flex flex-col items-center min-w-0">
            <div className={`w-2 h-2 rounded-full shrink-0 ${i <= cur ? 'bg-orange-500' : 'bg-gray-200'}`} />
            <span className={`text-xs mt-0.5 truncate ${i <= cur ? 'text-orange-600 font-medium' : 'text-gray-300'}`}>{s.label}</span>
            {s.time && i <= cur && <span className="text-xs text-gray-400">{s.time}</span>}
          </div>
          {i < steps.length - 1 && <div className={`h-px flex-1 mx-1 ${i < cur ? 'bg-orange-400' : 'bg-gray-200'}`} />}
        </div>
      ))}
    </div>
  )
}

// ─── Invoice Form ─────────────────────────────────────────────────────────────
function InvoiceForm({ order, onClose, onDone, isLastBatch = false }) {
  const [form, setForm] = useState({
    discount_type: 'flat',
    discount_value: '',
    payment_method: 'cash',
    customer_name: '',
    customer_phone: '',
  })
  const [error, setError] = useState('')

  const discountAmt = form.discount_type === 'flat'
    ? (parseFloat(form.discount_value) || 0)
    : (order.subtotal * (parseFloat(form.discount_value) || 0) / 100)

  const taxRate = order.tax ? (order.tax / order.subtotal) : 0
  const afterDiscount = Math.max(0, order.subtotal - discountAmt)
  const taxAmt = afterDiscount * taxRate
  const total = afterDiscount + taxAmt

  const create = useMutation({
    mutationFn: createInvoice,
    onSuccess: (res) => onDone?.(res.data.data?.id),
    onError: (err) => setError(err.response?.data?.message ?? 'Error creating invoice'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    create.mutate({
      order_id: order.id,
      discount_type: form.discount_type === 'flat' ? 1 : form.discount_type === 'percent' ? 2 : 0,
      discount_value: parseFloat(form.discount_value) || 0,
      payment_method: form.payment_method,
      amount_paid: total,
      customer_name: form.customer_name || undefined,
      customer_phone: form.customer_phone || undefined,
    })
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Create Invoice</h2>
            <p className="text-xs text-gray-400">Table {order.table?.number} · {order.order_number}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <div className="px-5 py-4">
          <div className="bg-gray-50 rounded-xl p-3 mb-4 text-sm">
            <div className="font-medium text-gray-700 mb-2">Items</div>
            {order.items?.map((item, i) => (
              <div key={i} className="mb-1">
                <div className="flex justify-between text-gray-600 text-xs">
                  <span>{item.quantity}× {item.item_name}{item.variant_name ? ` (${item.variant_name})` : ''}</span>
                  <span>₹{item.subtotal}</span>
                </div>
                {item.addons?.length > 0 && (
                  <div className="text-gray-400 ml-4 text-[10px]">+ {item.addons.map(a => a.name).join(', ')}</div>
                )}
                {item.gst_rate != null && (
                  <div className="text-gray-400 ml-4 text-[10px]">
                    GST {item.gst_rate}%{item.cgst_amount > 0 ? ` · CGST ₹${item.cgst_amount} + SGST ₹${item.sgst_amount}` : ` · ₹${(item.cgst_amount + item.sgst_amount).toFixed(2)}`}
                  </div>
                )}
              </div>
            ))}
            <div className="flex justify-between text-gray-600 text-xs border-t mt-2 pt-1.5">
              <span>Subtotal</span><span>₹{order.subtotal}</span>
            </div>
            <div className="flex justify-between text-gray-600 text-xs">
              <span>GST</span><span>₹{Number(order.tax).toFixed(2)}</span>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name (opt.)" className={inp} />
              <input type="tel" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="Phone (opt.)" className={inp} />
            </div>
            <div className="flex gap-2">
              <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="flat">₹ Flat</option>
                <option value="percent">% Percent</option>
              </select>
              <input type="number" min="0" step="0.01" value={form.discount_value}
                onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                placeholder="Discount (0)" className={`${inp} flex-1`} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button type="button" key={m} onClick={() => setForm(f => ({ ...f, payment_method: m }))}
                    className={`py-2.5 rounded-lg text-sm font-semibold capitalize ${form.payment_method === m ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {m === 'cash' ? '💵 Cash' : '📱 UPI'}
                  </button>
                ))}
              </div>
            </div>
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>−₹{discountAmt.toFixed(2)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>Tax</span><span>₹{taxAmt.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5">
                <span>Total</span><span>₹{total.toFixed(2)}</span>
              </div>
            </div>
            {form.payment_method === 'upi' && (
              <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
                <p className="text-xs font-semibold text-blue-700 mb-1">Show QR to customer for payment</p>
                <div className="flex items-center justify-center gap-2 text-xs text-blue-600">
                  <span className="font-mono bg-white border border-blue-200 px-3 py-1.5 rounded-lg">₹{total.toFixed(0)}</span>
                  <span>payable via UPI</span>
                </div>
              </div>
            )}
            {form.payment_method === 'cash' && (
              <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
                <p className="text-xs font-semibold text-green-700">Collect <span className="text-base">₹{total.toFixed(0)}</span> in cash from customer</p>
              </div>
            )}
            <button type="submit" disabled={create.isPending}
              className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
              {create.isPending ? 'Creating Invoice…' : isLastBatch ? 'Create Invoice & Close Table' : 'Create Invoice'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

// ─── Add Items Panel ──────────────────────────────────────────────────────────
function AddItemsPanel({ tableId, orderId, onClose, onDone }) {
  const [cart, setCart] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [waiterId, setWaiterId] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const qc = useQueryClient()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data: menu } = useQuery({ queryKey: ['billing-menu'], queryFn: () => getBillingMenu().then(r => r.data.data) })
  const cats = menu ?? []
  const [activeSub, setActiveSub] = useState(null)
  const activeCatId = activeCat ?? cats[0]?.id
  const allItems = cats.flatMap(c => [
    ...(c.items ?? []),
    ...(c.subcategories ?? []).flatMap(s => s.items ?? []),
  ])
  const activeCatObj = cats.find(c => c.id === activeCatId)
  const subcatsOfActive = activeCatObj?.subcategories ?? []
  const visibleItems = debouncedSearch.trim()
    ? allItems.filter(i => i.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : activeSub
      ? (activeCatObj?.subcategories?.find(s => s.id === activeSub)?.items ?? [])
      : [
          ...(activeCatObj?.items ?? []),
          ...(activeCatObj?.subcategories ?? []).flatMap(s => s.items ?? []),
        ]

  // Only fetch waiters when creating a new order (not adding items to existing)
  const { data: waiters } = useQuery({
    queryKey: ['billing-waiters'],
    queryFn: () => getBillingWaiters().then(r => r.data.data),
    enabled: !orderId,
  })

  const addItems = useMutation({
    mutationFn: (items) => orderId
      ? billingAddItems(orderId, { items })
      : billingNewOrder({ restaurant_table_id: tableId, items, waiter_id: waiterId || undefined }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-tables'] })
      qc.invalidateQueries({ queryKey: ['billing-table-orders', tableId] })
      onDone?.()
      onClose()
    },
  })

  const cartKey = (itemId, variantId, addonIds) =>
    `${itemId}:${variantId ?? ''}:${[...(addonIds ?? [])].sort().join(',')}`

  const addToCart = (line) => {
    const key = cartKey(line.menu_item_id, line.variant_id, line.addon_ids)
    setCart(c => {
      const idx = c.findIndex(x => x._key === key)
      if (idx >= 0) return c.map((x, i) => i === idx ? { ...x, quantity: x.quantity + line.quantity } : x)
      return [...c, { ...line, _key: key }]
    })
    setCustomizeItem(null)
  }
  const directAdd = (item) => addToCart({ menu_item_id: item.id, variant_id: null, addon_ids: [], quantity: 1, name: item.name, variant_name: null, addon_labels: [], price: item.price })
  const updateQty = (key, delta) =>
    setCart(c => c.map(x => x._key === key ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))

  const [customizeItem, setCustomizeItem] = useState(null)

  return (
    <>
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{orderId ? 'Add Items' : 'New Order'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="px-4 pt-3 pb-2 border-b bg-gray-50">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input type="search" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search items…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          </div>
          {!debouncedSearch.trim() && (
            <div>
              <div className="flex gap-0 overflow-x-auto border-b border-gray-100 scrollbar-hide -mx-1 px-1">
                {cats.map(c => (
                  <button key={c.id} onClick={() => { setActiveCat(c.id); setActiveSub(null) }}
                    className={`shrink-0 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${activeCatId === c.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
              {subcatsOfActive.length > 0 && (
                <div className="flex gap-2 pt-2 pb-0.5 overflow-x-auto scrollbar-hide">
                  <button onClick={() => setActiveSub(null)}
                    className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSub === null ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                    All
                  </button>
                  {subcatsOfActive.map(s => (
                    <button key={s.id} onClick={() => setActiveSub(s.id)}
                      className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSub === s.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {visibleItems.length === 0 && debouncedSearch.trim() && (
            <p className="text-center text-sm text-gray-400 py-10">No items match "{debouncedSearch}"</p>
          )}
          {visibleItems.map(item => {
            const hasCustom = item.variants?.length > 0 || item.addon_groups?.length > 0
            const totalQty  = cart.filter(x => x.menu_item_id === item.id).reduce((s, x) => s + x.quantity, 0)
            const simpleCart = !hasCustom ? cart.find(x => x.menu_item_id === item.id && !x.variant_id && !x.addon_ids?.length) : null
            const displayPrice = item.variants?.length > 0 ? `from ₹${Math.min(...item.variants.map(v => v.price))}` : `₹${item.price}`
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">{displayPrice}{hasCustom ? ' · customize' : ''}</div>
                </div>
                {!hasCustom && simpleCart ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(simpleCart._key, -1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><MinusIcon className="w-3.5 h-3.5" /></button>
                    <span className="w-5 text-center font-semibold text-sm">{simpleCart.quantity}</span>
                    <button onClick={() => updateQty(simpleCart._key, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center"><PlusIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => hasCustom ? setCustomizeItem(item) : directAdd(item)}
                    className={`text-xs px-4 py-1.5 rounded-full font-medium ${totalQty > 0 ? 'bg-orange-100 text-orange-700' : 'bg-orange-500 text-white'}`}>
                    {totalQty > 0 ? `${totalQty} added` : hasCustom ? 'Customize' : 'Add'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {cart.length > 0 && (
          <div className="border-t px-5 py-4 bg-gray-50">
            {cart.map(item => (
              <div key={item._key} className="mb-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.quantity}× {item.name}{item.variant_name ? ` (${item.variant_name})` : ''}</span>
                  <span className="text-gray-600">₹{(item.price * item.quantity).toFixed(0)}</span>
                </div>
                {item.addon_labels?.length > 0 && <div className="text-xs text-gray-400 ml-4">{item.addon_labels.join(', ')}</div>}
              </div>
            ))}
            {!orderId && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <label className="block text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" />Assign Waiter</label>
                <select value={waiterId} onChange={e => setWaiterId(e.target.value)}
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-800">
                  <option value="">— Unassigned —</option>
                  {(waiters ?? []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                </select>
              </div>
            )}
            <button
              onClick={() => addItems.mutate(cart.map(({ menu_item_id, variant_id, addon_ids, quantity }) => ({
                menu_item_id,
                ...(variant_id ? { variant_id } : {}),
                ...(addon_ids?.length ? { addon_ids } : {}),
                quantity,
              })))}
              disabled={addItems.isPending}
              className="w-full mt-3 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
              {addItems.isPending ? 'Sending…' : 'Send to Kitchen'}
            </button>
          </div>
        )}
      </div>
    </div>
    {customizeItem && (
      <ItemCustomizeSheet item={customizeItem} onAdd={addToCart} onClose={() => setCustomizeItem(null)} />
    )}
    </>
  )
}

// ─── Table Panel ──────────────────────────────────────────────────────────────
function TablePanel({ table, onClose, onInvoiceDone }) {
  const qc = useQueryClient()
  const { getTenantId } = useAuthStore()
  const tenantId = getTenantId?.()
  const [invoiceOrder, setInvoiceOrder] = useState(null)
  const [addingTo, setAddingTo] = useState(null) // orderId or 'new'
  const { data: orders, isLoading } = useQuery({
    queryKey: ['billing-table-orders', table.id],
    queryFn: () => getBillingTableOrders(table.id).then(r => r.data.data),
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
      qc.invalidateQueries({ queryKey: ['billing-table-orders', table.id] })
      qc.invalidateQueries({ queryKey: ['billing-tables'] })
    })
    return () => {
      channel.unbind_all()
      pusher.unsubscribe(`tenant.${tenantId}.kitchen`)
    }
  }, [tenantId, table.id, qc])

  const closeTable = useMutation({
    mutationFn: () => closeBillingTable(table.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-tables'] })
      onClose()
    },
  })

  const markServed = useMutation({
    mutationFn: (orderId) => billingMarkServed(orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-table-orders', table.id] })
      qc.invalidateQueries({ queryKey: ['billing-tables'] })
      qc.invalidateQueries({ queryKey: ['billing-active-orders'] })
    },
  })

  const advanceStatus = useMutation({
    mutationFn: ({ orderId, status }) => billingUpdateStatus(orderId, status),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['billing-table-orders', table.id] })
      qc.invalidateQueries({ queryKey: ['billing-tables'] })
      qc.invalidateQueries({ queryKey: ['billing-active-orders'] })
    },
  })

  const allServed      = orders?.length > 0 && orders.every(o => o.status === 'served')
  const hasOpenOrders  = orders?.some(o => !['served', 'cancelled'].includes(o.status))
  // Only exclude MT orders that are actually paid — unpaid MT orders need billing
  const unbilledOrders = orders?.filter(o => o.status !== 'cancelled' && !o.invoice && !(o.source === 'magic_tables' && o.payment_status === 'paid')) ?? []
  const unbilledTotal  = unbilledOrders.reduce((s, o) => s + parseFloat(o.total ?? 0), 0)
  const [billAllForm, setBillAllForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { data: history, isLoading: historyLoading } = useQuery({
    queryKey: ['billing-table-history', table.id],
    queryFn: () => getBillingTableHistory(table.id).then(r => r.data.data),
    enabled: showHistory,
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-bold text-gray-900">Table {table.number}</h2>
              {isBillRequestActive(table.bill_requested_at) && (
                <span className="bg-purple-100 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">🧾 Bill Requested</span>
              )}
              {isWaiterCallActive(table.waiter_called_at) && !isBillRequestActive(table.bill_requested_at) && (
                <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full animate-pulse">🔔 Waiter Called</span>
              )}
              {table.magic_tables_customer && (
                <span className="bg-indigo-100 text-indigo-700 text-xs font-bold px-2 py-0.5 rounded-full">Magic Tables</span>
              )}
            </div>
            <p className="text-xs text-gray-400">
              {table.section} · {table.status === 'occupied' ? `Occupied ${table.occupied_label ?? ''}` : 'Free'}
            </p>
            {table.magic_tables_customer && (
              <div className="flex items-center gap-3 mt-1.5 bg-indigo-50 border border-indigo-100 rounded-lg px-3 py-1.5">
                <span className="text-xs text-indigo-700 font-medium">{table.magic_tables_customer.customer_name}</span>
                <span className="text-xs text-indigo-500">+91 {table.magic_tables_customer.customer_phone}</span>
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowHistory(h => !h)}
              className={`text-sm px-3 py-1.5 rounded-lg font-medium border ${showHistory ? 'bg-gray-800 text-white border-gray-800' : 'border-gray-300 text-gray-600 hover:bg-gray-50'}`}
            >
              History
            </button>
            {!showHistory && (
              <button
                onClick={() => setAddingTo('new')}
                className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
              >
                + Add Order
              </button>
            )}
            {orders?.length > 0 && unbilledOrders.length === 0 && allServed && (
              <button
                onClick={() => closeTable.mutate()}
                disabled={closeTable.isPending}
                className="bg-red-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium disabled:opacity-50"
              >
                Close Table
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
          </div>
        </div>

        {unbilledOrders.length > 1 && !showHistory && (
          <div className="px-5 py-3 bg-green-50 border-b border-green-200 flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-green-800">{unbilledOrders.length} unbilled batches</p>
              <p className="text-xs text-green-600">Collect ₹{unbilledTotal.toFixed(0)} in one payment</p>
            </div>
            <button
              onClick={() => setBillAllForm(true)}
              className="shrink-0 bg-green-600 hover:bg-green-700 text-white px-5 py-2 rounded-xl font-semibold text-sm shadow-sm"
            >
              Bill All — ₹{unbilledTotal.toFixed(0)}
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {showHistory ? (
            historyLoading ? (
              <div className="p-4 space-y-2">
                {[1,2,3].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}
              </div>
            ) : !history?.length ? (
              <div className="text-center py-12 text-gray-400">No history for this table.</div>
            ) : history.map(order => (
              <div key={order.id} className="bg-gray-50 rounded-xl p-4 border-l-4 border-gray-200">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-700">{order.order_number}</span>
                  <div className="flex items-center gap-2">
                    {order.invoice && <span className="text-xs text-green-600 font-medium">Billed ₹{order.invoice.total}</span>}
                    <span className="text-xs text-gray-400 capitalize">{order.status}</span>
                  </div>
                </div>
                <div className="text-xs text-gray-500 space-y-0.5">
                  {order.items?.map((item, i) => (
                    <div key={i}>
                      <div className="flex justify-between">
                        <span>{item.quantity}× {item.item_name}{item.variant_name ? ` (${item.variant_name})` : ''}</span>
                        <span>₹{item.subtotal}</span>
                      </div>
                      {item.addons?.length > 0 && (
                        <div className="text-gray-400 ml-4 text-[10px]">+ {item.addons.map(a => a.name).join(', ')}</div>
                      )}
                      {item.gst_rate != null && (
                        <div className="text-gray-400 ml-4 text-[10px]">GST {item.gst_rate}% · CGST ₹{item.cgst_amount} SGST ₹{item.sgst_amount}</div>
                      )}
                    </div>
                  ))}
                  <div className="flex justify-between text-gray-500 border-t pt-1 mt-1">
                    <span>Subtotal</span><span>₹{order.subtotal}</span>
                  </div>
                  <div className="flex justify-between text-gray-500">
                    <span>GST</span><span>₹{order.tax}</span>
                  </div>
                  <div className="flex justify-between font-medium text-gray-700 border-t pt-1 mt-1">
                    <span>Total</span><span>₹{order.total}</span>
                  </div>
                </div>
              </div>
            ))
          ) : isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2].map(i => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-4 w-28 bg-gray-200 rounded" />
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-full bg-gray-200 rounded" />
                    <div className="h-3 w-4/5 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : !orders?.length ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">Table is free</p>
              <button onClick={() => setAddingTo('new')} className="bg-orange-500 text-white px-5 py-2 rounded-xl text-sm font-semibold">
                + Place Order
              </button>
            </div>
          ) : (
            orders.map(order => (
              <div key={order.id} className={`bg-gray-50 rounded-xl p-4 border-l-4 ${
                order.status === 'pending'   ? 'border-yellow-400' :
                order.status === 'preparing' ? 'border-blue-400' :
                order.status === 'ready'     ? 'border-green-500' :
                order.status === 'served'    ? 'border-gray-300' : 'border-gray-200'
              }`}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-semibold text-gray-800">{order.order_number}</span>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    order.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'ready'     ? 'bg-green-100 text-green-700' :
                    order.status === 'served'    ? 'bg-gray-100 text-gray-500' : 'bg-gray-100 text-gray-600'
                  }`}>{order.status}</span>
                </div>

                <StatusTimeline order={order} />

                <div className="text-xs text-gray-600 space-y-0.5 mb-3">
                  {order.items?.map((item, i) => (
                    <div key={i} className="flex justify-between">
                      <span>{item.quantity}× {item.item_name}</span>
                      <span className="text-gray-400">₹{item.subtotal}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-semibold text-gray-800 border-t pt-1 mt-1">
                    <span>Total</span><span>₹{order.total}</span>
                  </div>
                </div>

                <div className="flex gap-2 flex-wrap">
                  {order.status === 'pending' && (
                    <>
                      <button
                        onClick={() => setAddingTo('new')}
                        className="flex-1 text-xs border border-orange-300 text-orange-600 py-1.5 rounded-lg font-medium hover:bg-orange-50"
                      >
                        + Add Items
                      </button>
                      <button
                        onClick={() => advanceStatus.mutate({ orderId: order.id, status: 'preparing' })}
                        disabled={advanceStatus.isPending}
                        className="flex-1 text-xs bg-blue-500 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50"
                      >
                        → Preparing
                      </button>
                    </>
                  )}
                  {order.status === 'preparing' && (
                    <button
                      onClick={() => advanceStatus.mutate({ orderId: order.id, status: 'ready' })}
                      disabled={advanceStatus.isPending}
                      className="flex-1 text-xs bg-green-500 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50"
                    >
                      → Mark Ready
                    </button>
                  )}
                  {order.status === 'ready' && (
                    <button
                      onClick={() => markServed.mutate(order.id)}
                      disabled={markServed.isPending}
                      className="flex-1 text-xs bg-green-600 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50"
                    >
                      Mark Served
                    </button>
                  )}
                  {['ready', 'served'].includes(order.status) && !order.invoice && !(order.source === 'magic_tables' && order.payment_status === 'paid') && (
                    <button
                      onClick={() => setInvoiceOrder(order)}
                      className={`flex-1 text-xs py-1.5 rounded-lg font-semibold ${
                        unbilledOrders.length > 1
                          ? 'border border-orange-400 text-orange-600 hover:bg-orange-50'
                          : 'bg-orange-500 text-white hover:bg-orange-600'
                      }`}
                    >
                      {unbilledOrders.length > 1 ? 'Bill separately' : 'Bill'}
                    </button>
                  )}
                  {order.source === 'magic_tables' && order.payment_status === 'paid' && (
                    <span className="flex-1 text-xs py-1.5 rounded-lg font-semibold text-center bg-indigo-50 text-indigo-600 border border-indigo-200">
                      Paid Online
                    </span>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {invoiceOrder && (
        <InvoiceForm
          order={invoiceOrder}
          isLastBatch={unbilledOrders.length === 1}
          onClose={() => setInvoiceOrder(null)}
          onDone={(id) => {
            setInvoiceOrder(null)
            onInvoiceDone?.([id])
            qc.invalidateQueries({ queryKey: ['billing-tables'] })
            qc.invalidateQueries({ queryKey: ['billing-table-orders', table.id] })
            if (unbilledOrders.length === 1) {
              closeTable.mutate()
            }
          }}
        />
      )}

      {addingTo && (
        <AddItemsPanel
          tableId={table.id}
          orderId={addingTo === 'new' ? null : addingTo}
          onClose={() => setAddingTo(null)}
          onDone={() => qc.invalidateQueries({ queryKey: ['billing-table-orders', table.id] })}
        />
      )}

      {billAllForm && (
        <BillAllModal
          table={table}
          total={unbilledTotal}
          onClose={() => setBillAllForm(false)}
          onDone={(ids) => {
            setBillAllForm(false)
            onInvoiceDone?.(ids)
            qc.invalidateQueries({ queryKey: ['billing-tables'] })
            qc.invalidateQueries({ queryKey: ['billing-table-orders', table.id] })
            onClose()
          }}
        />
      )}
    </div>
  )
}

// ─── Bill All Modal ───────────────────────────────────────────────────────────
function BillAllModal({ table, total, onClose, onDone }) {
  const [form, setForm] = useState({ payment_method: 'cash', customer_name: '', customer_phone: '' })
  const [error, setError] = useState('')

  const submit = useMutation({
    mutationFn: () => billAllOrders(table.id, {
      payment_method: form.payment_method,
      amount_paid:    total,
      customer_name:  form.customer_name || undefined,
      customer_phone: form.customer_phone || undefined,
    }),
    onSuccess: (res) => onDone?.(res.data.data?.invoice_ids ?? []),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400'

  return (
    <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Bill All & Close Table</h2>
            <p className="text-xs text-gray-400">Table {table.number} · All unbilled orders</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="px-5 py-4 space-y-3">
          {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-lg">{error}</div>}
          <div className="bg-green-50 rounded-xl p-3 text-center">
            <div className="text-xs text-gray-500 mb-1">Total across all unbilled batches</div>
            <div className="text-2xl font-bold text-gray-900">₹{total.toFixed(0)}</div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name (opt.)" className={inp} />
            <input type="tel" value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="Phone (opt.)" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
            <div className="grid grid-cols-2 gap-2">
              {['cash','upi'].map(m => (
                <button type="button" key={m} onClick={() => setForm(f => ({ ...f, payment_method: m }))}
                  className={`py-2.5 rounded-lg text-sm font-semibold capitalize ${form.payment_method === m ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {m === 'cash' ? '💵 Cash' : '📱 UPI'}
                </button>
              ))}
            </div>
          </div>
          {form.payment_method === 'upi' && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-blue-700 mb-1">Show QR to customer for payment</p>
              <div className="flex items-center justify-center gap-2 text-xs text-blue-600">
                <span className="font-mono bg-white border border-blue-200 px-3 py-1.5 rounded-lg">₹{total.toFixed(0)}</span>
                <span>payable via UPI</span>
              </div>
            </div>
          )}
          {form.payment_method === 'cash' && (
            <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
              <p className="text-xs font-semibold text-green-700">Collect <span className="text-base">₹{total.toFixed(0)}</span> in cash from customer</p>
            </div>
          )}
          <button onClick={() => submit.mutate()} disabled={submit.isPending}
            className="w-full bg-green-600 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
            {submit.isPending ? 'Processing…' : 'Confirm & Close Table'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Download Bar ─────────────────────────────────────────────────────────────
async function fetchSingleBlob(invoiceId, upiId) {
  const res = await downloadInvoicePdf(invoiceId, upiId)
  return URL.createObjectURL(res.data)
}

async function fetchCombinedBlob(ids) {
  const res = await downloadCombinedPdf(ids)
  return URL.createObjectURL(res.data)
}

function openPrintIframe(url) {
  const win = window.open(url, '_blank', 'width=800,height=600')
  if (!win) return
  win.addEventListener('load', () => {
    try {
      win.focus()
      win.print()
    } catch (_) {}
  })
}

function DownloadBar({ invoiceIds, upiId, onDismiss }) {
  const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds]
  const isMulti = ids.length > 1
  const [loading, setLoading] = useState(null) // 'download' | 'print' | null

  const handleDownload = async () => {
    setLoading('download')
    try {
      const url = isMulti ? await fetchCombinedBlob(ids) : await fetchSingleBlob(ids[0], upiId)
      const a = document.createElement('a')
      a.href = url
      a.download = isMulti ? 'combined-invoice.pdf' : `invoice-${ids[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally { setLoading(null) }
  }

  const handlePrint = async () => {
    setLoading('print')
    try {
      const url = isMulti ? await fetchCombinedBlob(ids) : await fetchSingleBlob(ids[0], upiId)
      openPrintIframe(url)
    } finally { setLoading(null) }
  }

  return (
    <div className="fixed bottom-4 right-4 bg-green-600 text-white rounded-2xl shadow-lg px-5 py-3 flex items-center gap-3 z-[70]">
      <span className="text-sm font-medium">{isMulti ? 'Combined invoice ready!' : 'Invoice created!'}</span>
      <button onClick={handlePrint} disabled={!!loading}
        className="bg-white text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
        {loading === 'print' ? 'Printing…' : 'Print'}
      </button>
      <button onClick={handleDownload} disabled={!!loading}
        className="bg-green-800 text-white text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
        {loading === 'download' ? 'Downloading…' : 'Download PDF'}
      </button>
      <button onClick={onDismiss} className="text-green-200 hover:text-white"><XMarkIcon className="w-4 h-4" /></button>
    </div>
  )
}

// ─── Active Orders Bar ────────────────────────────────────────────────────────
function ActiveOrdersBar({ onSelectTable, onSelectBooking, onSelectTakeaway, tables = [] }) {
  const qc = useQueryClient()
  const { getTenantId } = useAuthStore()
  const tenantId = getTenantId?.()
  const [open, setOpen] = useState(false)
  const prevReadyIds = useRef(new Set())

  const { data: orders = [] } = useQuery({
    queryKey: ['billing-active-orders'],
    queryFn: () => getActiveOrders().then(r => r.data.data),
    refetchInterval: 10000,
  })

  const { data: settings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => getTenantSettings().then(r => r.data.data),
    staleTime: 60000,
  })
  const kotEnabled    = settings?.kot_enabled   ?? false
  const kotAutoPrint  = settings?.kot_auto_print ?? false
  const kotPrinter    = settings?.kot_printer    ?? 'kitchen'
  const showKotButton = kotEnabled && kotPrinter === 'billing'

  const knownKotIds = useRef(new Set())

  // Auto-print KOT for new pending orders when billing is the KOT printer
  useEffect(() => {
    if (!orders.length || !kotEnabled || !kotAutoPrint || kotPrinter !== 'billing') return
    const newOrders = orders.filter(o => o.status === 'pending' && !knownKotIds.current.has(o.id))
    newOrders.forEach(o => { knownKotIds.current.add(o.id); printKot(o) })
    orders.forEach(o => knownKotIds.current.add(o.id))
  }, [orders, kotEnabled, kotAutoPrint, kotPrinter])

  // Pusher — stay up-to-date instantly
  useEffect(() => {
    if (!tenantId) return
    const cfg = { cluster: import.meta.env.VITE_PUSHER_CLUSTER ?? 'mt1' }
    if (import.meta.env.VITE_PUSHER_HOST) {
      cfg.wsHost      = import.meta.env.VITE_PUSHER_HOST
      cfg.wsPort      = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      cfg.wssPort     = Number(import.meta.env.VITE_PUSHER_PORT ?? 6001)
      cfg.forceTLS    = (import.meta.env.VITE_PUSHER_SCHEME ?? 'http') === 'https'
      cfg.disableStats = true
      cfg.enabledTransports = ['ws']
    }
    const pusher  = new Pusher(import.meta.env.VITE_PUSHER_KEY, cfg)
    const channel = pusher.subscribe(`tenant.${tenantId}.kitchen`)
    channel.bind('order.updated', () => {
      qc.invalidateQueries({ queryKey: ['billing-active-orders'] })
    })
    return () => { channel.unbind_all(); pusher.unsubscribe(`tenant.${tenantId}.kitchen`) }
  }, [tenantId, qc])

  const readyOrders = orders.filter(o => o.status === 'ready')

  // Ding when new ready orders appear
  useEffect(() => {
    if (!readyOrders.length) return
    const newlyReady = readyOrders.filter(o => !prevReadyIds.current.has(o.id))
    if (newlyReady.length) { try { new Audio('/sounds/ding.wav').play() } catch (_) {} }
    prevReadyIds.current = new Set(readyOrders.map(o => o.id))
  }, [readyOrders])

  if (!orders.length) return null

  const orderLabel = (o) => o.type === 'takeaway'
    ? `🛍️ ${o.customer_name || 'Takeaway'}`
    : o.type === 'room-service'
    ? `Room ${o.booking?.room?.number ?? o.room_id}`
    : `Table ${o.table?.number ?? '?'}`

  const handleOrderClick = (o) => {
    if (o.type === 'takeaway') {
      onSelectTakeaway?.(o)
    } else if (o.type === 'room-service' && o.booking) {
      onSelectBooking?.(o.booking)
    } else if (o.table) {
      const tableObj = tables.find(t => t.id === o.table.id) ?? o.table
      onSelectTable?.(tableObj)
    }
  }

  const statusColor = (s) =>
    s === 'ready'     ? 'bg-green-100 text-green-700 border border-green-300' :
    s === 'preparing' ? 'bg-blue-100 text-blue-700 border border-blue-300' :
                        'bg-yellow-100 text-yellow-700 border border-yellow-300'

  return (
    <div className="border-b bg-white">

      {/* Ready orders row — always visible */}
      {readyOrders.length > 0 && (
        <div className="px-6 py-2 bg-green-50 border-b border-green-200 flex items-center gap-3 flex-wrap">
          <span className="text-xs font-bold text-green-700 uppercase tracking-wide shrink-0 flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            Ready to Serve
          </span>
          {readyOrders.map(o => (
            <button
              key={o.id}
              onClick={() => handleOrderClick(o)}
              className="flex items-center gap-1 bg-green-500 hover:bg-green-600 text-white text-xs font-semibold px-2.5 py-1 rounded-full shadow-sm transition-colors"
            >
              {orderLabel(o)}
              <span className="opacity-75 font-normal">· {o.order_number}</span>
            </button>
          ))}
        </div>
      )}

      {/* Accordion — all active orders */}
      <button
        onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-6 py-2 text-xs text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span className="font-semibold text-gray-700 flex items-center gap-2">
          Active Orders
          <span className="bg-orange-100 text-orange-700 font-bold px-2 py-0.5 rounded-full">{orders.length}</span>
          {readyOrders.length > 0 && (
            <span className="bg-green-100 text-green-700 font-bold px-2 py-0.5 rounded-full">{readyOrders.length} ready</span>
          )}
        </span>
        <span className="text-gray-400 text-xs">{open ? '▲' : '▼'}</span>
      </button>

      {open && (
        <div className="px-6 pb-3 overflow-x-auto">
          <div className="flex gap-2 flex-wrap py-1">
            {orders.map(o => (
              <div key={o.id} className="flex items-center gap-1">
                <button
                  onClick={() => handleOrderClick(o)}
                  className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 ${statusColor(o.status)}`}
                >
                  <span className="font-bold">{orderLabel(o)}</span>
                  <span className="opacity-60">#{o.order_number}</span>
                  <span className="capitalize opacity-80">· {o.status}</span>
                  <span className="opacity-50">· {o.elapsed_label}</span>
                </button>
                {showKotButton && (
                  <button
                    onClick={(e) => { e.stopPropagation(); printKot(o) }}
                    title="Print KOT"
                    className="flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 font-medium transition-colors"
                  >
                    <PrinterIcon className="w-3.5 h-3.5" />KOT
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Recent Bills Drawer ──────────────────────────────────────────────────────
function RecentBillsDrawer({ onClose }) {
  const [busy, setBusy] = useState(null) // `${sessionIdx}-${invoiceId}-print|download`
  const [expanded, setExpanded] = useState({}) // sessionIdx => bool

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ['billing-recent-invoices'],
    queryFn: () => getRecentInvoices().then(r => r.data.data),
  })

  const handlePrint = async (key, ids) => {
    setBusy(key)
    try {
      const isMulti = ids.length > 1
      const url = isMulti ? await fetchCombinedBlob(ids) : await fetchSingleBlob(ids[0])
      openPrintIframe(url)
    } finally { setBusy(null) }
  }

  const handleDownload = async (key, ids, filename) => {
    setBusy(key)
    try {
      const isMulti = ids.length > 1
      const url = isMulti ? await fetchCombinedBlob(ids) : await fetchSingleBlob(ids[0])
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.click()
      URL.revokeObjectURL(url)
    } finally { setBusy(null) }
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex justify-end" onClick={onClose}>
      <div className="bg-white w-full max-w-sm flex flex-col h-full shadow-2xl" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div className="flex items-center gap-2">
            <DocumentTextIcon className="w-5 h-5 text-gray-600" />
            <h2 className="font-bold text-gray-900">Recent Bills</h2>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-500 hover:bg-gray-200">
            <XMarkIcon className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[1,2,3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-xl animate-pulse" />)}
            </div>
          ) : sessions.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 text-center px-6">
              <DocumentTextIcon className="w-10 h-10 text-gray-300 mb-2" />
              <p className="text-sm text-gray-400">No bills yet</p>
            </div>
          ) : (
            <div className="p-4 space-y-3">
              {sessions.map((session, si) => {
                const allIds = session.invoices.map(inv => inv.id)
                const isOpen = !!expanded[si]
                const time = new Date(session.closed_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                const date = new Date(session.closed_at).toLocaleDateString([], { month: 'short', day: 'numeric' })

                return (
                  <div key={si} className="border border-gray-200 rounded-2xl overflow-hidden">
                    {/* Session header */}
                    <div className="px-4 py-3 bg-gray-50">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-bold text-sm text-gray-900">{session.label}</p>
                          <p className="text-xs text-gray-400 mt-0.5">
                            {date} · {time}
                            {session.invoices.length > 1 && ` · ${session.invoices.length} bills`}
                          </p>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="font-bold text-sm text-gray-900">₹{session.session_total}</p>
                        </div>
                      </div>

                      {/* Session-level actions (print/download all as combined) */}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handlePrint(`${si}-all-print`, allIds)}
                          disabled={!!busy}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-white border border-gray-200 text-gray-700 text-xs font-semibold py-2 rounded-xl hover:bg-gray-50 disabled:opacity-50"
                        >
                          <PrinterIcon className="w-3.5 h-3.5" />
                          {busy === `${si}-all-print` ? 'Printing…' : allIds.length > 1 ? 'Print All' : 'Print'}
                        </button>
                        <button
                          onClick={() => handleDownload(`${si}-all-dl`, allIds, `${session.label.replace(/\s/g,'-')}.pdf`)}
                          disabled={!!busy}
                          className="flex-1 flex items-center justify-center gap-1.5 bg-gray-800 text-white text-xs font-semibold py-2 rounded-xl hover:bg-gray-900 disabled:opacity-50"
                        >
                          <ArrowDownTrayIcon className="w-3.5 h-3.5" />
                          {busy === `${si}-all-dl` ? 'Saving…' : allIds.length > 1 ? 'Download All' : 'Download'}
                        </button>
                      </div>

                      {/* Expand toggle when multiple invoices */}
                      {session.invoices.length > 1 && (
                        <button
                          onClick={() => setExpanded(e => ({ ...e, [si]: !e[si] }))}
                          className="w-full text-center text-xs text-orange-500 font-medium mt-2"
                        >
                          {isOpen ? 'Hide individual bills ▲' : `Show ${session.invoices.length} individual bills ▼`}
                        </button>
                      )}
                    </div>

                    {/* Individual invoices — only when expanded (multiple invoices) */}
                    {isOpen && session.invoices.length > 1 && (
                      <div className="divide-y divide-gray-100">
                        {session.invoices.map(inv => (
                          <div key={inv.id} className="px-4 py-2.5 flex items-center gap-3">
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-gray-700 truncate">{inv.invoice_number}</p>
                              <p className="text-[11px] text-gray-400 capitalize">
                                {inv.payment_method} · ₹{inv.total}
                                {inv.customer_name ? ` · ${inv.customer_name}` : ''}
                              </p>
                            </div>
                            <div className="flex gap-1.5 shrink-0">
                              <button
                                onClick={() => handlePrint(`${si}-${inv.id}-print`, [inv.id])}
                                disabled={!!busy}
                                className="flex items-center gap-1 bg-white border border-gray-200 text-gray-600 text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                              >
                                <PrinterIcon className="w-3 h-3" />
                                {busy === `${si}-${inv.id}-print` ? '…' : 'Print'}
                              </button>
                              <button
                                onClick={() => handleDownload(`${si}-${inv.id}-dl`, [inv.id], `${inv.invoice_number}.pdf`)}
                                disabled={!!busy}
                                className="flex items-center gap-1 bg-gray-700 text-white text-[11px] font-semibold px-2.5 py-1.5 rounded-lg hover:bg-gray-800 disabled:opacity-50"
                              >
                                <ArrowDownTrayIcon className="w-3 h-3" />
                                {busy === `${si}-${inv.id}-dl` ? '…' : 'Save'}
                              </button>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Channel buttons (Takeaway / Zomato / Swiggy) ───────────────────────────────
const CHANNELS = [
  { key: 'takeaway', label: 'Takeaway', icon: '🛍️', cls: 'bg-orange-500 hover:bg-orange-600 border-orange-500' },
  { key: 'zomato',   label: 'Zomato',   icon: '🔴', cls: 'bg-[#e23744] hover:bg-[#c52e3a] border-[#e23744]' },
  { key: 'swiggy',   label: 'Swiggy',   icon: '🟠', cls: 'bg-[#fc8019] hover:bg-[#e0700f] border-[#fc8019]' },
]

function ChannelButtons({ onPick }) {
  return (
    <>
      {CHANNELS.map(c => (
        <button key={c.key} onClick={() => onPick(c.key)}
          className={`inline-flex items-center gap-1.5 text-sm font-semibold text-white px-3 py-1.5 rounded-xl transition-colors shadow-sm border ${c.cls}`}>
          <span>{c.icon}</span>
          <span className="hidden sm:inline">{c.label}</span>
        </button>
      ))}
    </>
  )
}

// ─── Takeaway / Aggregator Panel ────────────────────────────────────────────────
// platform: null → takeaway; 'zomato'/'swiggy' → aggregator order tagged with platform.
function TakeawayPanel({ onClose, onDone, platform = null }) {
  const qc = useQueryClient()
  const [cart, setCart] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [customerPhone, setCustomerPhone] = useState('')
  const [notes, setNotes] = useState('')
  const [nameError, setNameError] = useState('')
  const [externalId, setExternalId] = useState('')
  const isAggregator = !!platform
  const channelMeta = CHANNELS.find(c => c.key === platform)

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data: menu } = useQuery({ queryKey: ['billing-menu'], queryFn: () => getBillingMenu().then(r => r.data.data) })
  const cats = menu ?? []
  const [activeSubTW, setActiveSubTW] = useState(null)
  const activeCatId = activeCat ?? cats[0]?.id
  const allItems2 = cats.flatMap(c => [...(c.items ?? []), ...(c.subcategories ?? []).flatMap(s => s.items ?? [])])
  const activeCatObj2 = cats.find(c => c.id === activeCatId)
  const subcatsOfActiveTW = activeCatObj2?.subcategories ?? []
  const visibleItems = debouncedSearch.trim()
    ? allItems2.filter(i => i.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : activeSubTW
      ? (activeCatObj2?.subcategories?.find(s => s.id === activeSubTW)?.items ?? [])
      : [...(activeCatObj2?.items ?? []), ...(activeCatObj2?.subcategories ?? []).flatMap(s => s.items ?? [])]

  const place = useMutation({
    mutationFn: (data) => isAggregator ? billingPlaceAggregator(data) : billingPlaceTakeaway(data),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['billing-active-orders'] })
      onDone?.(res.data.data)
      onClose()
    },
  })

  const cartKeyTW = (itemId, variantId, addonIds) =>
    `${itemId}:${variantId ?? ''}:${[...(addonIds ?? [])].sort().join(',')}`
  const [customizeItemTW, setCustomizeItemTW] = useState(null)

  const addToCart = (line) => {
    const key = cartKeyTW(line.menu_item_id, line.variant_id, line.addon_ids)
    setCart(c => {
      const idx = c.findIndex(x => x._key === key)
      if (idx >= 0) return c.map((x, i) => i === idx ? { ...x, quantity: x.quantity + line.quantity } : x)
      return [...c, { ...line, _key: key }]
    })
    setCustomizeItemTW(null)
  }
  const directAddTW = (item) => addToCart({ menu_item_id: item.id, variant_id: null, addon_ids: [], quantity: 1, name: item.name, variant_name: null, addon_labels: [], price: item.price })
  const updateQty = (key, delta) =>
    setCart(c => c.map(x => x._key === key ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))

  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)

  const handlePlace = () => {
    if (!cart.length) return
    if (!isAggregator && !customerName.trim()) { setNameError('Customer name is required'); return }
    setNameError('')
    place.mutate({
      items: cart.map(({ menu_item_id, variant_id, addon_ids, quantity }) => ({ menu_item_id, ...(variant_id ? { variant_id } : {}), ...(addon_ids?.length ? { addon_ids } : {}), quantity })),
      customer_name: customerName.trim() || undefined,
      customer_phone: customerPhone || undefined,
      notes: notes || undefined,
      ...(isAggregator ? { platform, external_order_id: externalId || undefined } : {}),
    })
  }

  return (
    <>
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[92vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <div className="flex items-center gap-2.5">
            <span className="text-lg">{isAggregator ? channelMeta?.icon : '🛍️'}</span>
            <h2 className="font-bold text-gray-900">
              {isAggregator ? `New ${channelMeta?.label} Order` : 'New Takeaway Order'}
            </h2>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        {/* Customer info */}
        <div className="px-5 py-3 border-b bg-gray-50 shrink-0">
          {isAggregator && (
            <input
              type="text"
              value={externalId}
              onChange={e => setExternalId(e.target.value)}
              placeholder={`${channelMeta?.label} order ID (optional)`}
              className="w-full mb-2 px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          )}
          <div className="flex gap-2">
            <div className="flex-1">
              <div className="relative">
                <UserIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="text"
                  value={customerName}
                  onChange={e => { setCustomerName(e.target.value); if (e.target.value.trim()) setNameError('') }}
                  placeholder={isAggregator ? 'Customer name (optional)' : 'Customer name *'}
                  className={`w-full pl-8 pr-3 py-2 text-sm border rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 ${nameError ? 'border-red-400' : 'border-gray-200'}`}
                />
              </div>
              {nameError && <p className="text-xs text-red-500 mt-1">{nameError}</p>}
            </div>
            <div className="flex-1">
              <div className="relative">
                <PhoneIcon className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
                <input
                  type="tel"
                  value={customerPhone}
                  onChange={e => setCustomerPhone(e.target.value)}
                  placeholder="Phone (optional)"
                  className="w-full pl-8 pr-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Search + Categories */}
        <div className="px-4 pt-3 pb-2 border-b bg-gray-50 shrink-0">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          {!debouncedSearch.trim() && (
            <div>
              <div className="flex gap-0 overflow-x-auto border-b border-gray-100 scrollbar-hide -mx-1 px-1">
                {cats.map(c => (
                  <button key={c.id} onClick={() => { setActiveCat(c.id); setActiveSubTW(null) }}
                    className={`shrink-0 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${activeCatId === c.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
              {subcatsOfActiveTW.length > 0 && (
                <div className="flex gap-2 pt-2 pb-0.5 overflow-x-auto scrollbar-hide">
                  <button onClick={() => setActiveSubTW(null)}
                    className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSubTW === null ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                    All
                  </button>
                  {subcatsOfActiveTW.map(s => (
                    <button key={s.id} onClick={() => setActiveSubTW(s.id)}
                      className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSubTW === s.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {visibleItems.length === 0 && debouncedSearch.trim() && (
            <p className="text-center text-sm text-gray-400 py-10">No items match "{debouncedSearch}"</p>
          )}
          {visibleItems.map(item => {
            const hasCustom  = item.variants?.length > 0 || item.addon_groups?.length > 0
            const totalQty   = cart.filter(x => x.menu_item_id === item.id).reduce((s, x) => s + x.quantity, 0)
            const simpleCart = !hasCustom ? cart.find(x => x.menu_item_id === item.id && !x.variant_id && !x.addon_ids?.length) : null
            const displayPrice = item.variants?.length > 0 ? `from ₹${Math.min(...item.variants.map(v => v.price))}` : `₹${item.price}`
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">{displayPrice}{hasCustom ? ' · customize' : ''}</div>
                </div>
                {!hasCustom && simpleCart ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(simpleCart._key, -1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><MinusIcon className="w-3.5 h-3.5" /></button>
                    <span className="w-5 text-center font-semibold text-sm">{simpleCart.quantity}</span>
                    <button onClick={() => updateQty(simpleCart._key, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center"><PlusIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => hasCustom ? setCustomizeItemTW(item) : directAddTW(item)}
                    className={`text-xs px-4 py-1.5 rounded-full font-medium ${totalQty > 0 ? 'bg-orange-100 text-orange-700' : 'bg-orange-500 text-white'}`}>
                    {totalQty > 0 ? `${totalQty} added` : hasCustom ? 'Customize' : 'Add'}
                  </button>
                )}
              </div>
            )
          })}
        </div>

        {/* Cart summary + place */}
        {cart.length > 0 && (
          <div className="border-t px-5 py-4 bg-gray-50 shrink-0">
            <div className="space-y-1 mb-3 max-h-24 overflow-y-auto">
              {cart.map(item => (
                <div key={item._key} className="mb-0.5">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.quantity}× {item.name}{item.variant_name ? ` (${item.variant_name})` : ''}</span>
                    <span className="text-gray-900 font-medium">₹{item.price * item.quantity}</span>
                  </div>
                  {item.addon_labels?.length > 0 && <div className="text-xs text-gray-400 ml-4">{item.addon_labels.join(', ')}</div>}
                </div>
              ))}
            </div>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Order notes (optional)"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-xl bg-white focus:outline-none focus:ring-2 focus:ring-orange-400 mb-3"
            />
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-base font-bold text-orange-600">₹{total}</span>
            </div>
            <button
              onClick={handlePlace}
              disabled={place.isPending}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50 hover:shadow-md transition-shadow"
            >
              {place.isPending ? 'Placing…' : `Place ${isAggregator ? channelMeta?.label : 'Takeaway'} Order · ₹${total}`}
            </button>
          </div>
        )}
      </div>
    </div>
    {customizeItemTW && (
      <ItemCustomizeSheet item={customizeItemTW} onAdd={addToCart} onClose={() => setCustomizeItemTW(null)} />
    )}
  </>
  )
}

// ─── Pending Magic Tables Orders Panel ────────────────────────────────────────
function ActivePhoneSelector({ tenantSettings }) {
  const qc = useQueryClient()
  const phones = tenantSettings?.contact_phones ?? []
  const active = tenantSettings?.active_contact_phone ?? ''

  const mutation = useMutation({
    mutationFn: (phone) => setActiveContactPhone(phone || null),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-settings'] }),
  })

  if (phones.length === 0) return null

  return (
    <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-xl px-3 py-2 mb-4">
      <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 6.75c0 8.284 6.716 15 15 15h2.25a2.25 2.25 0 0 0 2.25-2.25v-1.372c0-.516-.351-.966-.852-1.091l-4.423-1.106c-.44-.11-.902.055-1.173.417l-.97 1.293c-.282.376-.769.542-1.21.38a12.035 12.035 0 0 1-7.143-7.143c-.162-.441.004-.928.38-1.21l1.293-.97c.363-.271.527-.734.417-1.173L6.963 3.102a1.125 1.125 0 0 0-1.091-.852H4.5A2.25 2.25 0 0 0 2.25 4.5v2.25Z" />
      </svg>
      <label className="text-xs font-medium text-gray-600 shrink-0">Active call number:</label>
      <select
        value={active}
        onChange={e => mutation.mutate(e.target.value)}
        disabled={mutation.isPending}
        className="flex-1 text-sm border-none bg-transparent focus:outline-none text-gray-900 font-mono"
      >
        <option value="">— None (hide call button) —</option>
        {phones.map(p => (
          <option key={p} value={p}>+91 {p}</option>
        ))}
      </select>
      {mutation.isPending && <span className="text-xs text-gray-400">Saving…</span>}
      {!mutation.isPending && active && <span className="text-xs text-green-600 font-semibold">Active</span>}
    </div>
  )
}

function PendingMtPanel({ tenantSlug, freeTables = [], tenantSettings }) {
  const qc = useQueryClient()
  const [confirmingOrder, setConfirmingOrder] = useState(null) // order object
  const [discardingId, setDiscardingId] = useState(null)
  const [selectedTableId, setSelectedTableId] = useState('')
  const [confirmError, setConfirmError] = useState('')

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['pending-mt-orders'],
    queryFn: () => getPendingMtOrders().then(r => r.data.data),
    refetchInterval: 8000,
  })

  const confirm = useMutation({
    mutationFn: ({ orderId, tableId }) =>
      confirmMtPayment(tenantSlug, orderId, tableId ? { table_id: tableId } : {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-mt-orders'] })
      qc.invalidateQueries({ queryKey: ['billing-tables'] })
      qc.invalidateQueries({ queryKey: ['billing-active-orders'] })
      setConfirmingOrder(null)
      setSelectedTableId('')
      setConfirmError('')
    },
    onError: (err) => setConfirmError(err.response?.data?.message ?? 'Error confirming payment'),
  })

  const discard = useMutation({
    mutationFn: (orderId) => discardMtOrder(tenantSlug, orderId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['pending-mt-orders'] })
      setDiscardingId(null)
    },
  })

  if (isLoading || orders.length === 0) return null

  const tableOccupied = confirmingOrder?.table_status === 'occupied'

  return (
    <>
      <div className="mb-6">
        <ActivePhoneSelector tenantSettings={tenantSettings} />
        <div className="flex items-center gap-2 mb-3">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse inline-block" />
          <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
            Magic Tables — Awaiting Payment Confirmation
          </h3>
          <span className="bg-amber-100 text-amber-700 text-xs font-bold px-2 py-0.5 rounded-full">{orders.length}</span>
        </div>

        <div className="space-y-3">
          {orders.map(order => (
            <div key={order.id} className="bg-amber-50 border border-amber-200 rounded-2xl p-4">
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className="text-sm font-bold text-gray-900">{order.order_number}</span>
                    <span className="text-xs bg-amber-200 text-amber-800 font-semibold px-2 py-0.5 rounded-full">
                      Table {order.table_number ?? '?'}
                      {order.table_status === 'occupied' && (
                        <span className="ml-1 text-red-600">⚠ occupied</span>
                      )}
                    </span>
                    <span className="text-xs text-gray-400">{order.elapsed_label}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm text-gray-700">
                    <span className="font-medium">{order.customer_name}</span>
                    <span className="text-gray-400">+91 {order.customer_phone}</span>
                  </div>
                </div>
                <span className="text-lg font-bold text-gray-900 shrink-0">₹{order.total}</span>
              </div>

              <div className="text-xs text-gray-500 space-y-0.5 mb-3 bg-white rounded-xl px-3 py-2 border border-amber-100">
                {order.items.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}× {item.item_name}</span>
                    <span>₹{item.subtotal}</span>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => { setConfirmingOrder(order); setSelectedTableId(''); setConfirmError('') }}
                  className="flex-1 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold py-2 rounded-xl transition-colors"
                >
                  ✓ Confirm Payment
                </button>
                <button
                  onClick={() => setDiscardingId(order.id)}
                  disabled={discard.isPending && discardingId === order.id}
                  className="flex-1 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold py-2 rounded-xl transition-colors disabled:opacity-50"
                >
                  {discard.isPending && discardingId === order.id ? 'Discarding…' : '✕ Discard'}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Discard confirmation dialog */}
      {discardingId && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center">
            <div className="text-4xl mb-3">🗑️</div>
            <h3 className="font-bold text-gray-900 mb-2">Discard this order?</h3>
            <p className="text-sm text-gray-500 mb-5">
              No payment was received. The order will be cancelled and the customer will not be served.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDiscardingId(null)} className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50">
                Keep
              </button>
              <button
                onClick={() => discard.mutate(discardingId)}
                disabled={discard.isPending}
                className="flex-1 bg-red-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-red-700 disabled:opacity-50"
              >
                {discard.isPending ? 'Discarding…' : 'Yes, Discard'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm payment modal */}
      {confirmingOrder && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden">
            <div className="bg-green-600 px-5 py-4 text-white">
              <h3 className="font-bold text-lg">Confirm Payment Received</h3>
              <p className="text-green-100 text-sm">{confirmingOrder.order_number} · {confirmingOrder.customer_name}</p>
            </div>
            <div className="px-5 py-4 space-y-4">
              {confirmError && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2 rounded-xl">{confirmError}</div>
              )}

              <div className="bg-gray-50 rounded-xl p-3 text-sm">
                <div className="flex justify-between font-bold text-gray-900">
                  <span>Amount to confirm</span>
                  <span>₹{confirmingOrder.total}</span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Customer: {confirmingOrder.customer_name} (+91 {confirmingOrder.customer_phone})
                </p>
              </div>

              {tableOccupied ? (
                <div className="space-y-2">
                  <div className="bg-amber-50 border border-amber-200 rounded-xl px-3 py-2.5 text-sm text-amber-800">
                    <p className="font-semibold mb-1">⚠ Table {confirmingOrder.table_number} is now occupied</p>
                    <p className="text-xs">Select a free table to assign this customer to, or call them to coordinate.</p>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">Assign to a free table</label>
                    <select
                      value={selectedTableId}
                      onChange={e => setSelectedTableId(e.target.value)}
                      className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-400"
                    >
                      <option value="">— Select a table —</option>
                      {freeTables.filter(t => t.status === 'free').map(t => (
                        <option key={t.id} value={t.id}>Table {t.number} ({t.section})</option>
                      ))}
                    </select>
                  </div>
                </div>
              ) : (
                <div className="bg-green-50 border border-green-200 rounded-xl px-3 py-2.5 text-sm text-green-800">
                  <p className="font-semibold">✓ Table {confirmingOrder.table_number} is free</p>
                  <p className="text-xs mt-0.5">Confirming will assign the customer to this table and send the order to the kitchen.</p>
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => { setConfirmingOrder(null); setSelectedTableId(''); setConfirmError('') }}
                  className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => confirm.mutate({
                    orderId: confirmingOrder.id,
                    tableId: tableOccupied ? (selectedTableId || null) : null,
                  })}
                  disabled={confirm.isPending || (tableOccupied && !selectedTableId)}
                  className="flex-1 bg-green-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-green-700 disabled:opacity-40"
                >
                  {confirm.isPending ? 'Confirming…' : 'Confirm & Send to Kitchen'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

function BillPaidPanel() {
  const qc = useQueryClient()
  const [confirmingId, setConfirmingId] = useState(null)

  const { data: tables = [] } = useQuery({
    queryKey: ['bill-paid-tables'],
    queryFn: () => getBillPaidTables().then(r => r.data.data),
    refetchInterval: 8000,
  })

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ['bill-paid-tables'] })
    qc.invalidateQueries({ queryKey: ['billing-tables'] })
  }

  const confirm = useMutation({
    mutationFn: (tableId) => confirmBillPaid(tableId),
    onSuccess: () => { invalidate(); setConfirmingId(null) },
  })

  const reject = useMutation({
    mutationFn: (tableId) => rejectBillPaid(tableId),
    onSuccess: () => { invalidate(); setConfirmingId(null) },
  })

  if (tables.length === 0) return null

  return (
    <div className="mb-6">
      <div className="flex items-center gap-2 mb-3">
        <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
        <h3 className="text-sm font-bold text-gray-800 uppercase tracking-wide">
          Customer Paid — Ready to Close
        </h3>
        <span className="bg-emerald-100 text-emerald-700 text-xs font-bold px-2 py-0.5 rounded-full">{tables.length}</span>
      </div>

      <div className="space-y-3">
        {tables.map(table => (
          <div key={table.table_id} className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
            <div className="flex items-start justify-between gap-3 mb-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-bold text-gray-900">Table {table.table_number}</span>
                  {table.section && <span className="text-xs text-gray-400">{table.section}</span>}
                  <span className="text-xs text-gray-400">{table.elapsed_label}</span>
                </div>
                <div className="text-sm text-gray-700">
                  <span className="font-medium">{table.customer_name}</span>
                  <span className="text-gray-400 ml-2">+91 {table.customer_phone}</span>
                </div>
                <p className="text-xs text-emerald-700 font-medium mt-1">Customer says they've paid via UPI</p>
              </div>
              <span className="text-lg font-bold text-gray-900 shrink-0">₹{table.total_amount}</span>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setConfirmingId(table.table_id)}
                className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors"
              >
                ✓ Confirm & Close
              </button>
              <button
                onClick={() => reject.mutate(table.table_id)}
                disabled={reject.isPending}
                className="flex-1 bg-white border border-red-300 text-red-600 hover:bg-red-50 text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-50"
              >
                ✕ Not Paid
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Confirm dialog */}
      {confirmingId && (
        <div className="fixed inset-0 bg-black/50 z-[70] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 text-center">
            <div className="text-4xl mb-3">✅</div>
            <h3 className="font-bold text-gray-900 mb-2">Confirm & Close Table?</h3>
            <p className="text-sm text-gray-500 mb-5">
              Verify the UPI receipt with the customer, then confirm to free the table.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmingId(null)}
                className="flex-1 border border-gray-300 text-gray-700 py-2.5 rounded-xl font-semibold text-sm hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => confirm.mutate(confirmingId)}
                disabled={confirm.isPending}
                className="flex-1 bg-emerald-600 text-white py-2.5 rounded-xl font-semibold text-sm hover:bg-emerald-700 disabled:opacity-50"
              >
                {confirm.isPending ? 'Closing…' : 'Yes, Close Table'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function BillingDashboard({ embedded = false }) {
  const { user, logout: clearAuth } = useAuthStore()
  const modules = user?.modules
  const hasRestaurant = !!modules?.restaurant
  const hasHotel      = !!modules?.hotel
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedTable, setSelectedTable] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [placingOrderFor, setPlacingOrderFor] = useState(null)
  const [lastInvoiceIds, setLastInvoiceIds] = useState(null)
  const [showRecentBills, setShowRecentBills] = useState(false)
  // null | 'takeaway' | 'zomato' | 'swiggy' — which order-entry panel is open
  const [channelPanel, setChannelPanel] = useState(null)
  const [selectedTakeawayOrder, setSelectedTakeawayOrder] = useState(null)

  const { data: tenantSettings } = useQuery({
    queryKey: ['tenant-settings'],
    queryFn: () => getTenantSettings().then(r => r.data.data),
    staleTime: 60000,
  })
  const tenantUpiId  = tenantSettings?.upi_id ?? null
  const tenantSlug   = tenantSettings?.slug ?? null
  const isOpen = tenantSettings?.is_open ?? true

  const toggleOpen = useMutation({
    mutationFn: (val) => updateOwnerSettings({ is_open: val }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant-settings'] }),
  })

  const openTable = (t) => {
    qc.invalidateQueries({ queryKey: ['billing-table-orders', t.id] })
    setSelectedTable(t)
  }

  const openBooking = (b) => {
    qc.invalidateQueries({ queryKey: ['billing-booking-orders', b.id] })
    setSelectedBooking(b)
  }

  // Initialize to first available tab
  const availableTabs = [
    ...(hasRestaurant ? [['tables', 'Tables']] : []),
    ...(hasHotel      ? [['rooms',  'Rooms & Hotel']] : []),
  ]
  const [tab, setTab] = useState(availableTabs[0]?.[0] ?? 'tables')

  const { data: tables, isLoading } = useQuery({
    queryKey: ['billing-tables'],
    queryFn: () => getBillingTables().then(r => r.data.data),
    refetchInterval: 10000,
    enabled: hasRestaurant,
  })

  // Tick every second while any alert is active so badges expire client-side
  useAlertTicker(tables ?? [])

  const billAutoPrint = tenantSettings?.bill_auto_print ?? false

  const handleInvoiceDone = (ids) => {
    const idsArr = Array.isArray(ids) ? ids : [ids]
    setLastInvoiceIds(idsArr)
    if (billAutoPrint && idsArr.length > 0) {
      const printFn = idsArr.length > 1
        ? () => fetchCombinedBlob(idsArr).then(openPrintIframe)
        : () => fetchSingleBlob(idsArr[0], tenantUpiId).then(openPrintIframe)
      printFn().catch(() => {})
    }
  }

  const handleLogout = async () => {
    try { await logoutApi() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  const sections = tables?.reduce((acc, t) => {
    const s = t.section || 'Other'
    if (!acc[s]) acc[s] = []
    acc[s].push(t)
    return acc
  }, {}) ?? {}

  return (
    <div className={embedded ? '' : 'min-h-screen bg-gray-50'}>
      {!embedded && <SubscriptionAlert />}
      {!embedded && (
        <header className="bg-white border-b px-6 py-4 flex items-center justify-between sticky top-0 z-10 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-sm">
              <BanknotesIcon className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-base font-bold text-gray-900">Billing Counter</h1>
              <p className="text-xs text-gray-400">{user?.name}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Open / Closed toggle */}
            <button
              onClick={() => toggleOpen.mutate(!isOpen)}
              disabled={toggleOpen.isPending}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-xl text-sm font-semibold transition-colors border ${
                isOpen
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-red-50 text-red-600 border-red-200 hover:bg-red-100'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${isOpen ? 'bg-emerald-500' : 'bg-red-500'}`} />
              <span className="hidden sm:inline">{isOpen ? 'Open' : 'Closed'}</span>
            </button>
            {hasRestaurant && <ChannelButtons onPick={setChannelPanel} />}
            <button onClick={() => setShowRecentBills(true)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-xl transition-colors">
              <DocumentTextIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Recent Bills</span>
            </button>
            <button onClick={handleLogout}
              className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors">
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Logout</span>
            </button>
          </div>
        </header>
      )}

      {embedded && (
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Billing Counter</h2>
            <p className="text-sm text-gray-400 mt-0.5">Manage tables, orders, and invoices</p>
          </div>
          <div className="flex items-center gap-2">
            {hasRestaurant && <ChannelButtons onPick={setChannelPanel} />}
            <button onClick={() => setShowRecentBills(true)}
              className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:bg-gray-100 px-3 py-1.5 rounded-xl transition-colors border border-gray-200">
              <DocumentTextIcon className="w-4 h-4" />
              Recent Bills
            </button>
          </div>
        </div>
      )}

      <ActiveOrdersBar
        onSelectTable={openTable}
        onSelectBooking={openBooking}
        onSelectTakeaway={setSelectedTakeawayOrder}
        tables={tables ?? []}
      />

      {availableTabs.length > 1 && (
        <div className={`flex gap-2 overflow-x-auto ${embedded ? 'pt-2 pb-2' : 'px-6 pt-4'}`}>
          {availableTabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${tab === key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className={embedded ? 'pt-2' : 'p-6'}>
        {tab === 'tables' && hasRestaurant && (
          isLoading ? (
            <div className="text-gray-400 text-sm">Loading tables…</div>
          ) : (
            <div className="space-y-6">
              {tenantSlug && (
                <>
                  <BillPaidPanel />
                  <PendingMtPanel tenantSlug={tenantSlug} freeTables={tables ?? []} tenantSettings={tenantSettings} />
                </>
              )}
              {Object.entries(sections).map(([section, rows]) => (
                <div key={section}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{section}</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
                    {rows.map(t => (
                      <button
                        key={t.id}
                        onClick={() => openTable(t)}
                        className={`rounded-xl border-2 p-3 text-center transition-all hover:shadow-md active:scale-95 relative ${
                          isBillRequestActive(t.bill_requested_at)  ? 'border-purple-400 bg-purple-50' :
                          isWaiterCallActive(t.waiter_called_at)    ? 'border-amber-400 bg-amber-50' :
                          t.magic_tables_customer                   ? 'border-indigo-400 bg-indigo-50' :
                          t.status === 'occupied'                   ? 'border-orange-400 bg-orange-50' : 'border-green-300 bg-green-50'
                        }`}
                      >
                        {isBillRequestActive(t.bill_requested_at) && (
                          <span className="absolute -top-1.5 -right-1.5 bg-purple-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">BILL</span>
                        )}
                        {isWaiterCallActive(t.waiter_called_at) && !isBillRequestActive(t.bill_requested_at) && (
                          <span className="absolute -top-1.5 -right-1.5 bg-amber-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">CALL</span>
                        )}
                        {t.magic_tables_customer && !isBillRequestActive(t.bill_requested_at) && !isWaiterCallActive(t.waiter_called_at) && (
                          <span className="absolute -top-1.5 -left-1.5 bg-indigo-500 text-white text-[9px] font-bold px-1 py-0.5 rounded-full leading-none">MT</span>
                        )}
                        <div className="text-base font-bold text-gray-900">{t.number}</div>
                        <div className={`text-xs font-medium mt-0.5 ${
                          isBillRequestActive(t.bill_requested_at)  ? 'text-purple-600' :
                          isWaiterCallActive(t.waiter_called_at)    ? 'text-amber-600' :
                          t.magic_tables_customer                   ? 'text-indigo-600' :
                          t.status === 'free'                       ? 'text-green-600' : 'text-orange-600'
                        }`}>
                          {isBillRequestActive(t.bill_requested_at) ? '🧾 Bill req.' : isWaiterCallActive(t.waiter_called_at) ? '🔔 Called' : t.status === 'free' ? 'Free' : (t.occupied_label ?? formatOccupied(t.occupied_minutes ?? 0))}
                        </div>
                        {t.magic_tables_customer && !isBillRequestActive(t.bill_requested_at) && !isWaiterCallActive(t.waiter_called_at) && (
                          <div className="text-[10px] text-indigo-500 mt-0.5 truncate leading-tight">
                            {t.magic_tables_customer.customer_name}
                          </div>
                        )}
                        {t.active_order && !t.magic_tables_customer && !isBillRequestActive(t.bill_requested_at) && !isWaiterCallActive(t.waiter_called_at) && (
                          <div className={`text-xs mt-0.5 font-medium ${
                            t.active_order.status === 'ready' ? 'text-green-600' :
                            t.active_order.status === 'preparing' ? 'text-blue-500' : 'text-yellow-600'
                          } capitalize`}>{t.active_order.status}</div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {tab === 'rooms' && hasHotel && (
          <BillingRoomsTab onSelectBooking={openBooking} />
        )}

      </div>

      {selectedTable && (
        <TablePanel
          table={selectedTable}
          onClose={() => { setSelectedTable(null); qc.invalidateQueries({ queryKey: ['billing-tables'] }) }}
          onInvoiceDone={handleInvoiceDone}
        />
      )}

      {selectedBooking && hasRestaurant && (
        <BillingRoomOrdersPanel
          booking={selectedBooking}
          onClose={() => { setSelectedBooking(null); setPlacingOrderFor(null); qc.invalidateQueries({ queryKey: ['billing-rooms-list'] }) }}
          onPlaceOrder={() => setPlacingOrderFor(selectedBooking)}
        />
      )}

      {selectedBooking && !hasRestaurant && (
        <BillingBookingPanel
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
        />
      )}

      {hasRestaurant && placingOrderFor && (
        <BillingRoomServicePanel
          booking={placingOrderFor}
          onClose={() => setPlacingOrderFor(null)}
        />
      )}

      {channelPanel && (
        <TakeawayPanel
          platform={channelPanel === 'takeaway' ? null : channelPanel}
          onClose={() => setChannelPanel(null)}
          onDone={() => qc.invalidateQueries({ queryKey: ['billing-active-orders'] })}
        />
      )}

      {selectedTakeawayOrder && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
          <div className="bg-white w-full sm:rounded-2xl sm:max-w-md max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
              <div>
                <h2 className="font-bold text-gray-900">🛍️ Takeaway — {selectedTakeawayOrder.order_number}</h2>
                {selectedTakeawayOrder.customer_name && (
                  <p className="text-xs text-gray-400 mt-0.5">{selectedTakeawayOrder.customer_name}{selectedTakeawayOrder.customer_phone ? ` · ${selectedTakeawayOrder.customer_phone}` : ''}</p>
                )}
              </div>
              <button onClick={() => setSelectedTakeawayOrder(null)} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-5">
              <div className="space-y-2 mb-4">
                {selectedTakeawayOrder.items?.map((item, i) => (
                  <div key={i} className="flex justify-between text-sm">
                    <span className="text-gray-700">{item.quantity}× {item.item_name}</span>
                    <span className="text-gray-900 font-medium">₹{item.subtotal}</span>
                  </div>
                ))}
              </div>
              <InvoiceForm
                order={selectedTakeawayOrder}
                onClose={() => setSelectedTakeawayOrder(null)}
                onDone={(ids) => {
                  handleInvoiceDone(ids)
                  setSelectedTakeawayOrder(null)
                  qc.invalidateQueries({ queryKey: ['billing-active-orders'] })
                }}
              />
            </div>
          </div>
        </div>
      )}

      {lastInvoiceIds && (
        <DownloadBar invoiceIds={lastInvoiceIds} upiId={tenantUpiId} onDismiss={() => setLastInvoiceIds(null)} />
      )}

      {showRecentBills && (
        <RecentBillsDrawer onClose={() => setShowRecentBills(false)} />
      )}
    </div>
  )
}

const BILLING_HOTEL_SERVICES = {
  _prefix:                    'billing',
  getBookings:                getBillingBookings,
  createBooking:              createBillingBooking,
  checkInBooking:             checkInBillingBooking,
  checkOutBooking:            checkOutBillingBooking,
  cancelBooking:              cancelBillingBooking,
  getBooking:                 getBillingBooking,
  getBookingCheckoutSummary:  getBillingBookingCheckoutSummary,
  extendBookingStay:          extendBillingBookingStay,
  getRooms:                   getBillingRooms,
  searchGuests:               searchBillingGuests,
  createGuest:                createBillingGuest,
}

// ─── Billing Booking Panel (hotel-only — no food orders) ─────────────────────
function BillingBookingPanel({ booking, onClose }) {
  const qc = useQueryClient()
  const [view, setView] = useState('detail') // 'detail' | 'checkout'

  const svc = BILLING_HOTEL_SERVICES

  const handleCheckoutDone = () => {
    qc.invalidateQueries({ queryKey: ['billing-rooms-list'] })
    qc.invalidateQueries({ queryKey: ['active-rooms-billing'] })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Room {booking.room?.number}</h2>
            <p className="text-xs text-gray-400">{booking.guest?.name} · {booking.booking_number}</p>
          </div>
          <div className="flex items-center gap-2">
            {booking.status === 'checked_in' && view === 'detail' && (
              <button
                onClick={() => setView('checkout')}
                className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
              >
                Check Out
              </button>
            )}
            {view === 'checkout' && (
              <button onClick={() => setView('detail')} className="text-sm text-gray-500 hover:text-gray-700">
                ← Back
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto p-5">
          {view === 'detail' && (
            <BookingDetail booking={booking} svc={svc} />
          )}
          {view === 'checkout' && (
            <CheckOutModal
              booking={booking}
              svc={svc}
              onSuccess={handleCheckoutDone}
              onClose={() => setView('detail')}
            />
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Billing Room Orders Panel ────────────────────────────────────────────────
function BillingRoomOrdersPanel({ booking, onClose, onPlaceOrder }) {
  const qc = useQueryClient()
  const [invoiceOrder, setInvoiceOrder] = useState(null)

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['billing-booking-orders', booking.id],
    queryFn: () => getBillingBookingOrders(booking.id).then(r => r.data.data),
    refetchInterval: 8000,
  })

  const markServed = useMutation({
    mutationFn: billingMarkServedRoom,
    onSuccess: () => {
      refetch()
      qc.invalidateQueries({ queryKey: ['billing-active-orders'] })
    },
  })

  const advanceStatus = useMutation({
    mutationFn: ({ orderId, status }) => billingUpdateStatus(orderId, status),
    onSuccess: () => {
      refetch()
      qc.invalidateQueries({ queryKey: ['billing-active-orders'] })
    },
  })

  const orders  = data?.orders ?? []
  const unbilled = orders.filter(o => !o.invoice && o.status !== 'cancelled')
  const inKitchenCount = orders.filter(o => ['pending','preparing'].includes(o.status)).length
  const readyCount = orders.filter(o => o.status === 'ready').length

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Room {booking.room?.number}</h2>
            <p className="text-xs text-gray-400">{booking.guest?.name} · {orders.length} order{orders.length !== 1 ? 's' : ''}</p>
          </div>
          <div className="flex items-center gap-2">
            {onPlaceOrder && (
              <button
                onClick={onPlaceOrder}
                className="bg-orange-500 text-white text-sm px-3 py-1.5 rounded-lg font-medium"
              >
                + New Order
              </button>
            )}
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
          </div>
        </div>

        {readyCount > 0 && (
          <div className="px-5 py-2.5 bg-green-50 border-b border-green-200 text-sm text-green-700 font-semibold flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse inline-block" />
            {readyCount} order{readyCount > 1 ? 's' : ''} ready to serve
          </div>
        )}
        {inKitchenCount > 0 && (
          <div className="px-5 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-yellow-700 font-medium">
            {inKitchenCount} order{inKitchenCount > 1 ? 's' : ''} still in kitchen
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {isLoading ? (
            <div className="space-y-3">
              {[1,2].map(i => (
                <div key={i} className="bg-gray-50 rounded-xl p-4 animate-pulse">
                  <div className="flex items-center justify-between mb-3">
                    <div className="h-4 w-28 bg-gray-200 rounded" />
                    <div className="h-5 w-16 bg-gray-200 rounded-full" />
                  </div>
                  <div className="space-y-1.5">
                    <div className="h-3 w-full bg-gray-200 rounded" />
                    <div className="h-3 w-3/4 bg-gray-200 rounded" />
                  </div>
                </div>
              ))}
            </div>
          ) : !orders.length ? (
            <div className="text-center py-12 text-gray-400">
              <p>No room service orders yet.</p>
              {onPlaceOrder && (
                <button onClick={onPlaceOrder} className="mt-3 bg-orange-500 text-white px-5 py-2 rounded-xl text-sm font-semibold">
                  + Place Order
                </button>
              )}
            </div>
          ) : orders.map(order => (
            <div key={order.id} className={`bg-gray-50 rounded-xl p-4 border-l-4 ${
              order.status === 'pending'   ? 'border-yellow-400' :
              order.status === 'preparing' ? 'border-blue-400' :
              order.status === 'ready'     ? 'border-green-500' :
              order.status === 'served'    ? 'border-gray-300' : 'border-gray-200'
            }`}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-gray-800">{order.order_number}</span>
                <div className="flex items-center gap-2">
                  {order.invoice && <span className="text-xs text-green-600 font-medium">Billed ₹{order.invoice.total}</span>}
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                    order.status === 'pending'   ? 'bg-yellow-100 text-yellow-700' :
                    order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                    order.status === 'ready'     ? 'bg-green-100 text-green-700' :
                    'bg-gray-100 text-gray-500'
                  }`}>{order.status}</span>
                </div>
              </div>
              <div className="text-xs text-gray-600 space-y-0.5 mb-3">
                {order.items?.map((item, i) => (
                  <div key={i} className="flex justify-between">
                    <span>{item.quantity}× {item.item_name}</span>
                    <span className="text-gray-400">₹{item.subtotal}</span>
                  </div>
                ))}
                <div className="flex justify-between font-semibold text-gray-800 border-t pt-1 mt-1">
                  <span>Total</span><span>₹{order.total}</span>
                </div>
              </div>
              <div className="flex gap-2 flex-wrap">
                {order.status === 'pending' && (
                  <button
                    onClick={() => advanceStatus.mutate({ orderId: order.id, status: 'preparing' })}
                    disabled={advanceStatus.isPending}
                    className="flex-1 text-xs bg-blue-500 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50"
                  >
                    → Preparing
                  </button>
                )}
                {order.status === 'preparing' && (
                  <button
                    onClick={() => advanceStatus.mutate({ orderId: order.id, status: 'ready' })}
                    disabled={advanceStatus.isPending}
                    className="flex-1 text-xs bg-green-500 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50"
                  >
                    → Mark Ready
                  </button>
                )}
                {order.status === 'ready' && (
                  <button
                    onClick={() => markServed.mutate(order.id)}
                    disabled={markServed.isPending}
                    className="flex-1 text-xs bg-green-600 text-white py-1.5 rounded-lg font-semibold disabled:opacity-50"
                  >
                    Mark Served
                  </button>
                )}
                {order.status === 'served' && !order.invoice && (
                  <button
                    onClick={() => setInvoiceOrder({ ...order, table: null })}
                    className="flex-1 text-xs bg-orange-500 text-white py-1.5 rounded-lg font-semibold"
                  >
                    Bill
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>

      {invoiceOrder && (
        <InvoiceForm
          order={invoiceOrder}
          isLastBatch={unbilled.length === 1}
          onClose={() => setInvoiceOrder(null)}
          onDone={() => {
            setInvoiceOrder(null)
            refetch()
            qc.invalidateQueries({ queryKey: ['active-rooms-billing'] })
          }}
        />
      )}
    </div>
  )
}

// ─── Billing Rooms Tab ────────────────────────────────────────────────────────
function BillingRoomsTab({ onSelectBooking }) {
  const [subtab, setSubtab] = useState('status')

  return (
    <div>
      <div className="flex gap-2 mb-6">
        {[['status', 'Room Status'], ['bookings', 'Bookings']].map(([key, label]) => (
          <button key={key} onClick={() => setSubtab(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium ${subtab === key ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {label}
          </button>
        ))}
      </div>
      {subtab === 'status' && (
        <BillingRoomStatus onSelectRoom={onSelectBooking} />
      )}
      {subtab === 'bookings' && <HotelBookings services={BILLING_HOTEL_SERVICES} queryKeyPrefix="billing" />}
    </div>
  )
}

function BillingRoomStatus({ onSelectRoom }) {
  const { data: rooms, isLoading } = useQuery({
    queryKey: ['billing-rooms-list'],
    queryFn: () => getBillingRooms().then(r => r.data.data),
    refetchInterval: 15000,
  })
  const { data: activeBookings } = useQuery({
    queryKey: ['active-rooms-billing'],
    queryFn: () => getBillingActiveRooms().then(r => r.data.data),
    refetchInterval: 15000,
  })

  const bookingByRoom = (activeBookings ?? []).reduce((acc, b) => { acc[b.room_id] = b; return acc }, {})

  if (isLoading) return (
    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-10 gap-2">
      {[1,2,3,4,5,6,7,8].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
    </div>
  )

  const roomList = Array.isArray(rooms) ? rooms : []
  const byFloor = roomList.reduce((acc, r) => {
    const f = `Floor ${r.floor ?? 1}`
    if (!acc[f]) acc[f] = []
    acc[f].push(r)
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {roomList.length === 0 && <div className="text-gray-400 text-sm">No rooms found.</div>}
      {Object.entries(byFloor).map(([floor, floorRooms]) => (
        <div key={floor}>
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{floor}</h3>
          <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
            {floorRooms.map(room => {
              const booking = bookingByRoom[room.id]
              const isOccupied = room.status === 'occupied'
              return (
                <button
                  key={room.id}
                  onClick={() => booking && onSelectRoom(booking)}
                  disabled={!isOccupied}
                  className={`rounded-xl border-2 p-3 text-center transition-all ${
                    isOccupied
                      ? 'border-blue-400 bg-blue-50 hover:shadow-md active:scale-95 cursor-pointer'
                      : 'border-green-300 bg-green-50 cursor-default opacity-70'
                  }`}
                >
                  <div className="text-base font-bold text-gray-900">{room.number}</div>
                  <div className={`text-xs font-medium mt-0.5 ${isOccupied ? 'text-blue-600' : 'text-green-600'}`}>
                    {isOccupied ? (booking?.guest?.name?.split(' ')[0] ?? 'Occupied') : 'Free'}
                  </div>
                  {isOccupied && <div className="text-xs text-blue-400 mt-0.5">Tap to manage</div>}
                </button>
              )
            })}
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Billing Room Service Panel ───────────────────────────────────────────────
function BillingRoomServicePanel({ booking, onClose }) {
  const qc = useQueryClient()
  const [cart, setCart] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [waiterId, setWaiterId] = useState('')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 250)
    return () => clearTimeout(t)
  }, [search])

  const { data: menu } = useQuery({ queryKey: ['billing-menu'], queryFn: () => getBillingMenu().then(r => r.data.data) })
  const { data: waiters } = useQuery({ queryKey: ['billing-waiters'], queryFn: () => getBillingWaiters().then(r => r.data.data) })
  const cats = menu ?? []
  const [activeSubBRS, setActiveSubBRS] = useState(null)
  const activeCatId = activeCat ?? cats[0]?.id
  const allItems3 = cats.flatMap(c => [...(c.items ?? []), ...(c.subcategories ?? []).flatMap(s => s.items ?? [])])
  const activeCatObj3 = cats.find(c => c.id === activeCatId)
  const subcatsOfActiveBRS = activeCatObj3?.subcategories ?? []
  const visibleItems = debouncedSearch.trim()
    ? allItems3.filter(i => i.name.toLowerCase().includes(debouncedSearch.toLowerCase()))
    : activeSubBRS
      ? (activeCatObj3?.subcategories?.find(s => s.id === activeSubBRS)?.items ?? [])
      : [...(activeCatObj3?.items ?? []), ...(activeCatObj3?.subcategories ?? []).flatMap(s => s.items ?? [])]

  const create = useMutation({
    mutationFn: billingPlaceRoomService,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-rooms-billing'] })
      qc.invalidateQueries({ queryKey: ['billing-booking-orders', booking.id] })
      onClose()
    },
  })

  const cartKeyBRS = (itemId, variantId, addonIds) =>
    `${itemId}:${variantId ?? ''}:${[...(addonIds ?? [])].sort().join(',')}`
  const [customizeItemBRS, setCustomizeItemBRS] = useState(null)

  const addToCart = (line) => {
    const key = cartKeyBRS(line.menu_item_id, line.variant_id, line.addon_ids)
    setCart(c => {
      const idx = c.findIndex(x => x._key === key)
      if (idx >= 0) return c.map((x, i) => i === idx ? { ...x, quantity: x.quantity + line.quantity } : x)
      return [...c, { ...line, _key: key }]
    })
    setCustomizeItemBRS(null)
  }
  const directAddBRS = (item) => addToCart({ menu_item_id: item.id, variant_id: null, addon_ids: [], quantity: 1, name: item.name, variant_name: null, addon_labels: [], price: item.price })
  const updateQty = (key, delta) =>
    setCart(c => c.map(x => x._key === key ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)

  return (
    <>
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Room {booking.room?.number} — Room Service</h2>
            <p className="text-xs text-gray-400">{booking.guest?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="px-4 pt-3 pb-2 border-b bg-gray-50">
          <div className="relative">
            <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="search"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Search items…"
              className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border border-gray-200 bg-white focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          {!debouncedSearch.trim() && (
            <div>
              <div className="flex gap-0 overflow-x-auto border-b border-gray-100 scrollbar-hide -mx-1 px-1">
                {cats.map(c => (
                  <button key={c.id} onClick={() => { setActiveCat(c.id); setActiveSubBRS(null) }}
                    className={`shrink-0 px-3 py-2 text-xs font-semibold whitespace-nowrap border-b-2 transition-colors -mb-px ${activeCatId === c.id ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                    {c.name}
                  </button>
                ))}
              </div>
              {subcatsOfActiveBRS.length > 0 && (
                <div className="flex gap-2 pt-2 pb-0.5 overflow-x-auto scrollbar-hide">
                  <button onClick={() => setActiveSubBRS(null)}
                    className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSubBRS === null ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                    All
                  </button>
                  {subcatsOfActiveBRS.map(s => (
                    <button key={s.id} onClick={() => setActiveSubBRS(s.id)}
                      className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSubBRS === s.id ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200'}`}>
                      {s.name}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {visibleItems.length === 0 && debouncedSearch.trim() && (
            <p className="text-center text-sm text-gray-400 py-10">No items match "{debouncedSearch}"</p>
          )}
          {visibleItems.map(item => {
            const hasCustom  = item.variants?.length > 0 || item.addon_groups?.length > 0
            const totalQty   = cart.filter(x => x.menu_item_id === item.id).reduce((s, x) => s + x.quantity, 0)
            const simpleCart = !hasCustom ? cart.find(x => x.menu_item_id === item.id && !x.variant_id && !x.addon_ids?.length) : null
            const displayPrice = item.variants?.length > 0 ? `from ₹${Math.min(...item.variants.map(v => v.price))}` : `₹${item.price}`
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">{displayPrice}{hasCustom ? ' · customize' : ''}</div>
                </div>
                {!hasCustom && simpleCart ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(simpleCart._key, -1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><MinusIcon className="w-3.5 h-3.5" /></button>
                    <span className="w-5 text-center font-semibold text-sm">{simpleCart.quantity}</span>
                    <button onClick={() => updateQty(simpleCart._key, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center"><PlusIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => hasCustom ? setCustomizeItemBRS(item) : directAddBRS(item)}
                    className={`text-xs px-4 py-1.5 rounded-full font-medium ${totalQty > 0 ? 'bg-orange-100 text-orange-700' : 'bg-orange-500 text-white'}`}>
                    {totalQty > 0 ? `${totalQty} added` : hasCustom ? 'Customize' : 'Add'}
                  </button>
                )}
              </div>
            )
          })}
        </div>
        {cart.length > 0 && (
          <div className="border-t px-5 py-4 bg-gray-50">
            {cart.map(item => (
              <div key={item._key} className="mb-1">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-700">{item.quantity}× {item.name}{item.variant_name ? ` (${item.variant_name})` : ''}</span>
                  <span className="text-gray-600">₹{(item.price * item.quantity).toFixed(0)}</span>
                </div>
                {item.addon_labels?.length > 0 && <div className="text-xs text-gray-400 ml-4">{item.addon_labels.join(', ')}</div>}
              </div>
            ))}
            <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
              <label className="block text-xs font-semibold text-blue-700 mb-1.5">👤 Assign Waiter</label>
              <select value={waiterId} onChange={e => setWaiterId(e.target.value)}
                className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-800">
                <option value="">— Unassigned —</option>
                {(waiters ?? []).map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </div>
            <div className="flex items-center justify-between mt-3">
              <span className="font-bold text-gray-900">₹{total.toFixed(0)}</span>
              <button
                onClick={() => create.mutate({ booking_id: booking.id, waiter_id: waiterId || undefined, items: cart.map(({ menu_item_id, variant_id, addon_ids, quantity }) => ({ menu_item_id, ...(variant_id ? { variant_id } : {}), ...(addon_ids?.length ? { addon_ids } : {}), quantity })) })}
                disabled={create.isPending}
                className="bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                {create.isPending ? 'Sending…' : 'Send to Kitchen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
    {customizeItemBRS && (
      <ItemCustomizeSheet item={customizeItemBRS} onAdd={addToCart} onClose={() => setCustomizeItemBRS(null)} />
    )}
    </>
  )
}

