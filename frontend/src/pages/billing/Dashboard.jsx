import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getReadyOrders, createInvoice, downloadInvoicePdf } from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'
import { useNavigate } from 'react-router-dom'

const PAYMENT_METHODS = ['cash', 'card', 'upi', 'split']

function InvoiceForm({ order, onClose, onDone }) {
  const [form, setForm] = useState({
    discount_type: 'flat',
    discount_value: '',
    payment_method: 'cash',
    paid_amount: '',
    customer_name: '',
    customer_phone: '',
  })
  const [error, setError] = useState('')
  const [invoiceId, setInvoiceId] = useState(null)

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
    onSuccess: (res) => {
      setInvoiceId(res.data.data?.id)
      onDone?.()
    },
    onError: (err) => setError(err.response?.data?.message ?? 'Error creating invoice'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    create.mutate({
      order_id: order.id,
      discount_type: form.discount_type,
      discount_value: parseFloat(form.discount_value) || 0,
      payment_method: form.payment_method,
      paid_amount: paid,
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
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>

        <div className="px-5 py-4">
          {/* Order summary */}
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
            {/* Customer info */}
            <div className="grid grid-cols-2 gap-3">
              <input value={form.customer_name} onChange={e => setForm(f => ({ ...f, customer_name: e.target.value }))} placeholder="Customer name (opt.)" className={inp} />
              <input value={form.customer_phone} onChange={e => setForm(f => ({ ...f, customer_phone: e.target.value }))} placeholder="Phone (opt.)" className={inp} />
            </div>

            {/* Discount */}
            <div className="flex gap-2">
              <select value={form.discount_type} onChange={e => setForm(f => ({ ...f, discount_type: e.target.value }))} className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400">
                <option value="flat">₹ Flat</option>
                <option value="percent">% Percent</option>
              </select>
              <input type="number" min="0" step="0.01" value={form.discount_value}
                onChange={e => setForm(f => ({ ...f, discount_value: e.target.value }))}
                placeholder="Discount (0)" className={`${inp} flex-1`} />
            </div>

            {/* Payment method */}
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

            {/* Totals */}
            <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1">
              {discountAmt > 0 && <div className="flex justify-between text-green-600"><span>Discount</span><span>−₹{discountAmt.toFixed(2)}</span></div>}
              <div className="flex justify-between text-gray-600"><span>Tax</span><span>₹{taxAmt.toFixed(2)}</span></div>
              <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5">
                <span>Total</span><span>₹{total.toFixed(2)}</span>
              </div>
            </div>

            {/* Paid amount (for split/cash) */}
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
              {create.isPending ? 'Creating Invoice…' : 'Create Invoice & Close Table'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function DownloadBar({ invoiceId, onDismiss }) {
  const [loading, setLoading] = useState(false)

  const handleDownload = async () => {
    setLoading(true)
    try {
      const res = await downloadInvoicePdf(invoiceId)
      const url = URL.createObjectURL(res.data)
      const a = document.createElement('a')
      a.href = url
      a.download = `invoice-${invoiceId}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed bottom-4 right-4 bg-green-600 text-white rounded-2xl shadow-lg px-5 py-3 flex items-center gap-3 z-50">
      <span className="text-sm font-medium">Invoice created!</span>
      <button onClick={handleDownload} disabled={loading} className="bg-white text-green-700 text-xs font-semibold px-3 py-1.5 rounded-lg disabled:opacity-50">
        {loading ? 'Downloading…' : 'Download PDF'}
      </button>
      <button onClick={onDismiss} className="text-green-200 hover:text-white text-lg">✕</button>
    </div>
  )
}

export default function BillingDashboard() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [lastInvoiceId, setLastInvoiceId] = useState(null)

  const { data: orders, isLoading } = useQuery({
    queryKey: ['ready-orders'],
    queryFn: () => getReadyOrders().then(r => r.data.data),
    refetchInterval: 10000,
  })

  const handleLogout = async () => {
    try { await logoutApi() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  const handleDone = (invoiceId) => {
    setSelectedOrder(null)
    setLastInvoiceId(invoiceId)
    qc.invalidateQueries({ queryKey: ['ready-orders'] })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Billing Counter</h1>
          <p className="text-xs text-gray-400">{user?.name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
      </header>

      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-gray-900">Orders Ready for Billing</h2>
          <span className="text-sm text-gray-400">{orders?.length ?? 0} orders</span>
        </div>

        {isLoading ? (
          <div className="text-gray-400 text-sm">Loading…</div>
        ) : orders?.length === 0 ? (
          <div className="text-center py-16 text-gray-400">
            <div className="text-4xl mb-3">🧾</div>
            <p>No orders ready for billing</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {orders?.map(order => (
              <div key={order.id} className="bg-white rounded-xl border border-green-300 p-4 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-gray-900 text-lg">Table {order.table?.number}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Ready</span>
                </div>
                <div className="text-xs text-gray-400 mb-3">{order.order_number} · {order.elapsed_minutes}m</div>
                <div className="text-xs text-gray-600 space-y-0.5 mb-3">
                  {order.items?.map((item, i) => (
                    <div key={i}>{item.quantity}× {item.item_name}</div>
                  ))}
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-gray-900">₹{order.total}</span>
                  <button onClick={() => setSelectedOrder(order)}
                    className="bg-orange-500 text-white text-sm px-4 py-1.5 rounded-lg font-medium hover:bg-orange-600">
                    Bill
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {selectedOrder && (
        <InvoiceForm
          order={selectedOrder}
          onClose={() => setSelectedOrder(null)}
          onDone={(invId) => handleDone(invId)}
        />
      )}

      {lastInvoiceId && (
        <DownloadBar invoiceId={lastInvoiceId} onDismiss={() => setLastInvoiceId(null)} />
      )}
    </div>
  )
}
