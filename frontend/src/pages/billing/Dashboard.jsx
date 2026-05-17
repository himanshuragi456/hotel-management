import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Pusher from 'pusher-js'
import {
  XMarkIcon, PlusIcon, MinusIcon, PrinterIcon, ArrowDownTrayIcon,
  CheckCircleIcon, ArrowRightOnRectangleIcon, UserIcon, PhoneIcon,
  FireIcon, BanknotesIcon,
} from '@heroicons/react/24/outline'
import {
  getBillingTables, getBillingTableOrders, getBillingTableHistory, closeBillingTable, billAllOrders,
  getBillingMenu, billingAddItems, billingNewOrder, billingMarkServed,
  createInvoice, downloadInvoicePdf,
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
} from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'
import { useNavigate } from 'react-router-dom'
import HotelBookings, { CheckOutModal, BookingDetail } from '@/pages/owner/hotel/Bookings'
import { formatOccupied } from '@/utils/time'

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'split']

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
    paid_amount: '',
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
  const paid = parseFloat(form.paid_amount) || total
  const balance = paid - total

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
      amount_paid: paid,
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
              <div key={i} className="flex justify-between text-gray-600 text-xs mb-1">
                <span>{item.quantity}× {item.item_name}</span>
                <span>₹{(item.item_price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
            <div className="flex justify-between text-gray-700 font-medium border-t mt-2 pt-2">
              <span>Subtotal</span><span>₹{order.subtotal}</span>
            </div>
          </div>

          {error && <div className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-lg">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name (opt.)" className={inp} />
              <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="Phone (opt.)" className={inp} />
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
              <div className="grid grid-cols-4 gap-2">
                {PAYMENT_METHODS.map(m => (
                  <button type="button" key={m} onClick={() => setForm(f => ({ ...f, payment_method: m }))}
                    className={`py-2 rounded-lg text-xs font-medium capitalize ${form.payment_method === m ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                    {m}
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
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Amount Received</label>
              <input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))}
                placeholder={`₹${total.toFixed(0)}`} className={inp} />
              {form.paid_amount && (
                <div className={`text-xs mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {balance >= 0 ? `Change: ₹${balance.toFixed(2)}` : `Balance due: ₹${Math.abs(balance).toFixed(2)}`}
                </div>
              )}
            </div>
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
  const qc = useQueryClient()

  const { data: menu } = useQuery({ queryKey: ['billing-menu'], queryFn: () => getBillingMenu().then(r => r.data.data) })
  const cats = menu ?? []
  const activeCatId = activeCat ?? cats[0]?.id
  const visibleItems = cats.find(c => c.id === activeCatId)?.items ?? []

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

  const addToCart = (item) => setCart(c => {
    const ex = c.find(x => x.menu_item_id === item.id)
    if (ex) return c.map(x => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x)
    return [...c, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }]
  })
  const updateQty = (id, delta) =>
    setCart(c => c.map(x => x.menu_item_id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h2 className="font-semibold text-gray-900">{orderId ? 'Add Items' : 'New Order'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>

        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b bg-gray-50">
          {cats.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${activeCatId === c.id ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border hover:bg-gray-100'}`}>
              {c.name}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {visibleItems.map(item => {
            const inCart = cart.find(x => x.menu_item_id === item.id)
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">₹{item.price}</div>
                </div>
                {inCart ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><MinusIcon className="w-3.5 h-3.5" /></button>
                    <span className="w-5 text-center font-semibold text-sm">{inCart.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center"><PlusIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(item)} className="bg-orange-500 text-white text-xs px-4 py-1.5 rounded-full font-medium">Add</button>
                )}
              </div>
            )
          })}
        </div>

        {cart.length > 0 && (
          <div className="border-t px-5 py-4 bg-gray-50">
            {cart.map(item => (
              <div key={item.menu_item_id} className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{item.quantity}× {item.name}</span>
                <span className="text-gray-600">₹{(item.price * item.quantity).toFixed(0)}</span>
              </div>
            ))}
            {!orderId && (
              <div className="mt-3 bg-blue-50 border border-blue-200 rounded-xl px-4 py-3">
                <label className="block text-xs font-semibold text-blue-700 mb-1.5 flex items-center gap-1.5"><UserIcon className="w-3.5 h-3.5" />Assign Waiter</label>
                <select
                  value={waiterId}
                  onChange={e => setWaiterId(e.target.value)}
                  className="w-full border border-blue-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 bg-white text-gray-800"
                >
                  <option value="">— Unassigned —</option>
                  {(waiters ?? []).map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>
            )}
            <button
              onClick={() => addItems.mutate(cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })))}
              disabled={addItems.isPending}
              className="w-full mt-3 bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
            >
              {addItems.isPending ? 'Sending…' : 'Send to Kitchen'}
            </button>
          </div>
        )}
      </div>
    </div>
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

  const allServed      = orders?.length > 0 && orders.every(o => o.status === 'served')
  const hasOpenOrders  = orders?.some(o => !['served', 'cancelled'].includes(o.status))
  const unbilledOrders = orders?.filter(o => o.status !== 'cancelled' && !o.invoice) ?? []
  const unbilledTotal  = unbilledOrders.reduce((s, o) => s + parseFloat(o.total ?? 0), 0)
  const [billAllForm, setBillAllForm] = useState(false)
  const [showHistory, setShowHistory] = useState(false)

  const { data: history } = useQuery({
    queryKey: ['billing-table-history', table.id],
    queryFn: () => getBillingTableHistory(table.id).then(r => r.data.data),
    enabled: showHistory,
  })

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-2xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Table {table.number}</h2>
            <p className="text-xs text-gray-400">
              {table.section} · {table.status === 'occupied' ? `Occupied ${table.occupied_label ?? ''}` : 'Free'}
            </p>
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
            {hasOpenOrders && unbilledOrders.length === 0 && (
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
            !history ? (
              <div className="text-gray-400 text-sm">Loading history…</div>
            ) : !history.length ? (
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
                    <div key={i} className="flex justify-between">
                      <span>{item.quantity}× {item.item_name}</span>
                      <span>₹{item.subtotal}</span>
                    </div>
                  ))}
                  <div className="flex justify-between font-medium text-gray-700 border-t pt-1 mt-1">
                    <span>Total</span><span>₹{order.total}</span>
                  </div>
                </div>
              </div>
            ))
          ) : isLoading ? (
            <div className="text-gray-400 text-sm">Loading orders…</div>
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
                    <button
                      onClick={() => setAddingTo(order.id)}
                      className="flex-1 text-xs border border-orange-300 text-orange-600 py-1.5 rounded-lg font-medium hover:bg-orange-50"
                    >
                      + Add Items
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
                  {['ready', 'served'].includes(order.status) && !order.invoice && (
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
  const [form, setForm] = useState({ payment_method: 'cash', paid_amount: '', customer_name: '', customer_phone: '' })
  const [error, setError] = useState('')

  const paid    = parseFloat(form.paid_amount) || total
  const balance = paid - total

  const submit = useMutation({
    mutationFn: () => billAllOrders(table.id, {
      payment_method: form.payment_method,
      amount_paid:    paid,
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
            <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="Phone (opt.)" className={inp} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
            <div className="grid grid-cols-4 gap-2">
              {['cash','card','upi','split'].map(m => (
                <button type="button" key={m} onClick={() => setForm(f => ({ ...f, payment_method: m }))}
                  className={`py-2 rounded-lg text-xs font-medium capitalize ${form.payment_method === m ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {m}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Amount Received</label>
            <input type="number" step="0.01" value={form.paid_amount} onChange={e => setForm(f => ({ ...f, paid_amount: e.target.value }))}
              placeholder={`₹${total.toFixed(0)}`} className={inp} />
            {form.paid_amount && (
              <div className={`text-xs mt-1 ${balance >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {balance >= 0 ? `Change: ₹${balance.toFixed(2)}` : `Balance due: ₹${Math.abs(balance).toFixed(2)}`}
              </div>
            )}
          </div>
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
async function fetchPdfBlob(invoiceId) {
  const res = await downloadInvoicePdf(invoiceId)
  return URL.createObjectURL(res.data)
}

function DownloadBar({ invoiceIds, onDismiss }) {
  const ids = Array.isArray(invoiceIds) ? invoiceIds : [invoiceIds]
  const [loading, setLoading] = useState(null) // 'download' | 'print' | null

  const handleDownload = async () => {
    setLoading('download')
    try {
      for (const id of ids) {
        const url = await fetchPdfBlob(id)
        const a = document.createElement('a')
        a.href = url
        a.download = `invoice-${id}.pdf`
        a.click()
        URL.revokeObjectURL(url)
      }
    } finally { setLoading(null) }
  }

  const handlePrint = async () => {
    setLoading('print')
    try {
      for (const id of ids) {
        const url = await fetchPdfBlob(id)
        const iframe = document.createElement('iframe')
        iframe.style.display = 'none'
        iframe.src = url
        document.body.appendChild(iframe)
        iframe.onload = () => {
          iframe.contentWindow.print()
          setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url) }, 2000)
        }
      }
    } finally { setLoading(null) }
  }

  return (
    <div className="fixed bottom-4 right-4 bg-green-600 text-white rounded-2xl shadow-lg px-5 py-3 flex items-center gap-3 z-[70]">
      <span className="text-sm font-medium">{ids.length > 1 ? `${ids.length} invoices created!` : 'Invoice created!'}</span>
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
function ActiveOrdersBar({ onSelectTable, onSelectBooking, tables = [] }) {
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

  const orderLabel = (o) => o.type === 'room-service'
    ? `Room ${o.booking?.room?.number ?? o.room_id}`
    : `Table ${o.table?.number ?? '?'}`

  const handleOrderClick = (o) => {
    if (o.type === 'room-service' && o.booking) {
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
              <button
                key={o.id}
                onClick={() => handleOrderClick(o)}
                className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg font-medium transition-opacity hover:opacity-80 ${statusColor(o.status)}`}
              >
                <span className="font-bold">{orderLabel(o)}</span>
                <span className="opacity-60">#{o.order_number}</span>
                <span className="capitalize opacity-80">· {o.status}</span>
                <span className="opacity-50">· {o.elapsed_label}</span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default function BillingDashboard() {
  const { user, logout: clearAuth } = useAuthStore()
  const modules = user?.modules
  const hasRestaurant = !!modules?.restaurant
  const hasHotel      = !!modules?.hotel
  const navigate = useNavigate()
  const [selectedTable, setSelectedTable] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [placingOrderFor, setPlacingOrderFor] = useState(null)
  const [lastInvoiceIds, setLastInvoiceIds] = useState(null)

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
    <div className="min-h-screen bg-gray-50">
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
        <button onClick={handleLogout}
          className="inline-flex items-center gap-1.5 text-sm text-red-600 hover:bg-red-50 px-3 py-1.5 rounded-xl transition-colors">
          <ArrowRightOnRectangleIcon className="w-4 h-4" />
          Logout
        </button>
      </header>

      <ActiveOrdersBar
        onSelectTable={(tableObj) => setSelectedTable(tableObj)}
        onSelectBooking={(bookingObj) => setSelectedBooking(bookingObj)}
        tables={tables ?? []}
      />

      {availableTabs.length > 1 && (
        <div className="flex gap-2 px-6 pt-4 overflow-x-auto">
          {availableTabs.map(([key, label]) => (
            <button key={key} onClick={() => setTab(key)}
              className={`shrink-0 px-4 py-1.5 rounded-full text-sm font-medium ${tab === key ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
      )}

      <div className="p-6">
        {tab === 'tables' && hasRestaurant && (
          isLoading ? (
            <div className="text-gray-400 text-sm">Loading tables…</div>
          ) : (
            <div className="space-y-6">
              {Object.entries(sections).map(([section, rows]) => (
                <div key={section}>
                  <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{section}</h3>
                  <div className="grid grid-cols-3 sm:grid-cols-5 md:grid-cols-8 gap-2">
                    {rows.map(t => (
                      <button
                        key={t.id}
                        onClick={() => setSelectedTable(t)}
                        className={`rounded-xl border-2 p-3 text-center transition-all hover:shadow-md active:scale-95 ${
                          t.status === 'occupied' ? 'border-orange-400 bg-orange-50' : 'border-green-300 bg-green-50'
                        }`}
                      >
                        <div className="text-base font-bold text-gray-900">{t.number}</div>
                        <div className={`text-xs font-medium mt-0.5 ${t.status === 'free' ? 'text-green-600' : 'text-orange-600'}`}>
                          {t.status === 'free' ? 'Free' : (t.occupied_label ?? formatOccupied(t.occupied_minutes ?? 0))}
                        </div>
                        {t.active_order && (
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
          <BillingRoomsTab onSelectBooking={setSelectedBooking} />
        )}

      </div>

      {selectedTable && (
        <TablePanel
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onInvoiceDone={(ids) => setLastInvoiceIds(ids)}
        />
      )}

      {selectedBooking && hasRestaurant && (
        <BillingRoomOrdersPanel
          booking={selectedBooking}
          onClose={() => { setSelectedBooking(null); setPlacingOrderFor(null) }}
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

      {lastInvoiceIds && (
        <DownloadBar invoiceIds={lastInvoiceIds} onDismiss={() => setLastInvoiceIds(null)} />
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
            <div className="text-gray-400 text-sm">Loading orders…</div>
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
              <div className="flex gap-2">
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

  if (isLoading) return <div className="text-gray-400 text-sm">Loading rooms…</div>

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

  const { data: menu } = useQuery({ queryKey: ['billing-menu'], queryFn: () => getBillingMenu().then(r => r.data.data) })
  const { data: waiters } = useQuery({ queryKey: ['billing-waiters'], queryFn: () => getBillingWaiters().then(r => r.data.data) })
  const cats = menu ?? []
  const activeCatId = activeCat ?? cats[0]?.id
  const visibleItems = cats.find(c => c.id === activeCatId)?.items ?? []

  const create = useMutation({
    mutationFn: billingPlaceRoomService,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['active-rooms-billing'] })
      qc.invalidateQueries({ queryKey: ['billing-booking-orders', booking.id] })
      onClose()
    },
  })

  const addToCart = (item) => setCart(c => {
    const ex = c.find(x => x.menu_item_id === item.id)
    if (ex) return c.map(x => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x)
    return [...c, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }]
  })
  const updateQty = (id, delta) =>
    setCart(c => c.map(x => x.menu_item_id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-lg max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-bold text-gray-900">Room {booking.room?.number} — Room Service</h2>
            <p className="text-xs text-gray-400">{booking.guest?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>
        <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b bg-gray-50">
          {cats.map(c => (
            <button key={c.id} onClick={() => setActiveCat(c.id)}
              className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${activeCatId === c.id ? 'bg-orange-500 text-white' : 'bg-white text-gray-600 border hover:bg-gray-100'}`}>
              {c.name}
            </button>
          ))}
        </div>
        <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
          {visibleItems.map(item => {
            const inCart = cart.find(x => x.menu_item_id === item.id)
            return (
              <div key={item.id} className="flex items-center justify-between px-5 py-3">
                <div>
                  <div className="text-sm font-medium text-gray-900">{item.name}</div>
                  <div className="text-xs text-gray-400">₹{item.price}</div>
                </div>
                {inCart ? (
                  <div className="flex items-center gap-2">
                    <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center"><MinusIcon className="w-3.5 h-3.5" /></button>
                    <span className="w-5 text-center font-semibold text-sm">{inCart.quantity}</span>
                    <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white flex items-center justify-center"><PlusIcon className="w-3.5 h-3.5" /></button>
                  </div>
                ) : (
                  <button onClick={() => addToCart(item)} className="bg-orange-500 text-white text-xs px-4 py-1.5 rounded-full font-medium">Add</button>
                )}
              </div>
            )
          })}
        </div>
        {cart.length > 0 && (
          <div className="border-t px-5 py-4 bg-gray-50">
            {cart.map(item => (
              <div key={item.menu_item_id} className="flex justify-between text-sm mb-1">
                <span className="text-gray-700">{item.quantity}× {item.name}</span>
                <span className="text-gray-600">₹{(item.price * item.quantity).toFixed(0)}</span>
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
                onClick={() => create.mutate({ booking_id: booking.id, waiter_id: waiterId || undefined, items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })) })}
                disabled={create.isPending}
                className="bg-orange-500 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50"
              >
                {create.isPending ? 'Sending…' : 'Send to Kitchen'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

