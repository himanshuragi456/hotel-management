import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTables, getCategories, getMenuItems, placeOrder, getWaiterOrders, getActiveRooms, placeRoomService } from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { logout as logoutApi } from '@/services/authService'
import { useNavigate } from 'react-router-dom'

function TableGrid({ onSelect }) {
  const { data: tables, isLoading } = useQuery({
    queryKey: ['waiter-tables'],
    queryFn: () => getTables().then(r => r.data.data),
    refetchInterval: 15000,
  })

  if (isLoading) return <div className="text-gray-400 text-sm">Loading tables…</div>

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {tables?.map(t => (
        <button
          key={t.id}
          onClick={() => onSelect(t)}
          className={`rounded-xl border-2 p-3 text-center transition-all hover:shadow-md ${
            t.status === 'occupied'
              ? 'border-orange-400 bg-orange-50 hover:bg-orange-100'
              : 'border-green-300 bg-green-50 hover:bg-green-100'
          }`}
        >
          <div className="text-xl font-bold text-gray-900">T{t.number}</div>
          {t.section && <div className="text-xs text-gray-400">{t.section}</div>}
          <div className={`text-xs font-medium mt-1 ${t.status === 'free' ? 'text-green-600' : 'text-orange-600'}`}>
            {t.status === 'free' ? 'Free' : `${t.occupied_minutes}m`}
          </div>
          <div className="text-xs text-gray-400">{t.capacity} seats</div>
        </button>
      ))}
    </div>
  )
}

function OrderForm({ table, onClose, onDone }) {
  const qc = useQueryClient()
  const [cart, setCart] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [orderNotes, setOrderNotes] = useState('')

  const { data: cats } = useQuery({
    queryKey: ['categories'],
    queryFn: () => getCategories().then(r => r.data.data),
  })
  const { data: items } = useQuery({
    queryKey: ['menu-items'],
    queryFn: () => getMenuItems().then(r => r.data.data),
  })

  const create = useMutation({
    mutationFn: placeOrder,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['waiter-tables'] })
      qc.invalidateQueries({ queryKey: ['waiter-orders'] })
      onDone?.()
    },
  })

  const addToCart = (item) => {
    setCart(c => {
      const ex = c.find(x => x.menu_item_id === item.id)
      if (ex) return c.map(x => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x)
      return [...c, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1, notes: '' }]
    })
  }

  const updateQty = (id, delta) =>
    setCart(c => c.map(x => x.menu_item_id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))

  const updateItemNote = (id, val) =>
    setCart(c => c.map(x => x.menu_item_id === id ? { ...x, notes: val } : x))

  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)

  const handleSubmit = () => {
    if (!cart.length) return
    create.mutate({
      table_id: table.id,
      notes: orderNotes,
      items: cart.map(({ menu_item_id, quantity, notes }) => ({ menu_item_id, quantity, notes })),
    })
  }

  const activeCatId = activeCat ?? cats?.[0]?.id
  const visibleItems = items?.filter(i => i.is_available && (!activeCatId || i.menu_category_id === activeCatId))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="bg-white w-full sm:rounded-2xl sm:max-w-3xl max-h-screen sm:max-h-[90vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Table {table.number}</h2>
            {table.section && <p className="text-xs text-gray-400">{table.section} · {table.capacity} seats</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">✕</button>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Menu panel */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b">
              {cats?.map(c => (
                <button key={c.id} onClick={() => setActiveCat(c.id)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap ${
                    activeCatId === c.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}>
                  {c.name}
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5">
              {visibleItems?.map(item => {
                const inCart = cart.find(x => x.menu_item_id === item.id)
                return (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div className="flex items-center gap-3">
                      {item.image
                        ? <img src={`/storage/${item.image}`} className="w-10 h-10 rounded-lg object-cover" />
                        : <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-sm">
                            {item.type === 'veg' ? '🟢' : item.type === 'vegan' ? '🌱' : '🔴'}
                          </div>}
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.name}</div>
                        <div className="text-xs text-gray-400">₹{item.price}</div>
                      </div>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center">−</button>
                        <span className="w-5 text-center font-semibold text-sm">{inCart.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)} className="bg-orange-500 text-white text-xs px-3 py-1.5 rounded-full font-medium">Add</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Cart panel */}
          {cart.length > 0 && (
            <div className="w-64 border-l flex flex-col overflow-hidden">
              <div className="px-4 py-3 border-b bg-gray-50">
                <h3 className="font-medium text-gray-900 text-sm">Order ({cart.length} items)</h3>
              </div>
              <div className="flex-1 overflow-y-auto px-4 py-2 space-y-3">
                {cart.map(item => (
                  <div key={item.menu_item_id}>
                    <div className="flex items-start justify-between gap-1">
                      <span className="text-xs font-medium text-gray-800 flex-1 leading-tight">{item.name}</span>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => updateQty(item.menu_item_id, -1)} className="w-5 h-5 rounded bg-gray-100 text-gray-600 text-xs flex items-center justify-center">−</button>
                        <span className="text-xs w-4 text-center">{item.quantity}</span>
                        <button onClick={() => updateQty(item.menu_item_id, 1)} className="w-5 h-5 rounded bg-orange-100 text-orange-600 text-xs flex items-center justify-center">+</button>
                      </div>
                    </div>
                    <div className="flex justify-between mt-0.5">
                      <input value={item.notes} onChange={e => updateItemNote(item.menu_item_id, e.target.value)}
                        placeholder="Notes…" className="text-xs text-gray-400 flex-1 outline-none bg-transparent placeholder:text-gray-300" />
                      <span className="text-xs text-gray-500 ml-2">₹{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className="px-4 py-3 border-t bg-gray-50">
                <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Order notes…"
                  className="w-full text-xs border border-gray-200 rounded-lg px-2 py-1.5 mb-3 bg-white focus:outline-none focus:ring-1 focus:ring-orange-400" />
                <div className="flex justify-between text-sm font-semibold mb-3">
                  <span className="text-gray-700">Total</span>
                  <span>₹{total.toFixed(0)}</span>
                </div>
                <button onClick={handleSubmit} disabled={create.isPending}
                  className="w-full bg-orange-500 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50">
                  {create.isPending ? 'Placing…' : 'Place Order'}
                </button>
              </div>
            </div>
          )}
        </div>

        {cart.length === 0 && (
          <div className="px-5 py-3 border-t text-sm text-gray-400 text-center">Tap items above to add to order</div>
        )}
      </div>
    </div>
  )
}

function MyOrders() {
  const { data: orders } = useQuery({
    queryKey: ['waiter-orders'],
    queryFn: () => getWaiterOrders().then(r => r.data.data),
    refetchInterval: 10000,
  })

  if (!orders?.length) return <p className="text-gray-400 text-sm">No active orders.</p>

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
      {orders.map(order => (
        <div key={order.id} className={`bg-white rounded-xl border-l-4 p-4 shadow-sm ${
          order.status === 'pending' ? 'border-yellow-400' :
          order.status === 'preparing' ? 'border-blue-400' :
          order.status === 'ready' ? 'border-green-500' : 'border-gray-200'
        }`}>
          <div className="flex items-center justify-between mb-2">
            <span className="font-semibold text-gray-900">Table {order.table?.number}</span>
            <div className="flex items-center gap-2">
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${
                order.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
                order.status === 'ready' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
              }`}>{order.status}</span>
              <span className={`text-xs ${order.elapsed_minutes > 30 ? 'text-red-500' : 'text-gray-400'}`}>{order.elapsed_minutes}m</span>
            </div>
          </div>
          <div className="text-xs text-gray-500 space-y-0.5 mb-2">
            {order.items?.map((item, i) => (
              <div key={i}>{item.quantity}× {item.item_name}{item.notes ? ` (${item.notes})` : ''}</div>
            ))}
          </div>
          <div className="text-sm font-medium text-gray-700">₹{order.total}</div>
        </div>
      ))}
    </div>
  )
}

function RoomServiceForm({ booking, onClose, onDone }) {
  const qc = useQueryClient()
  const [cart, setCart] = useState([])
  const [activeCat, setActiveCat] = useState(null)
  const [orderNotes, setOrderNotes] = useState('')

  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
  const { data: items } = useQuery({ queryKey: ['menu-items'], queryFn: () => getMenuItems().then(r => r.data.data) })

  const create = useMutation({
    mutationFn: placeRoomService,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['waiter-orders'] }); onDone?.() },
  })

  const addToCart = (item) => setCart(c => {
    const ex = c.find(x => x.menu_item_id === item.id)
    if (ex) return c.map(x => x.menu_item_id === item.id ? { ...x, quantity: x.quantity + 1 } : x)
    return [...c, { menu_item_id: item.id, name: item.name, price: item.price, quantity: 1 }]
  })
  const updateQty = (id, delta) => setCart(c => c.map(x => x.menu_item_id === id ? { ...x, quantity: Math.max(0, x.quantity + delta) } : x).filter(x => x.quantity > 0))
  const total = cart.reduce((s, x) => s + x.price * x.quantity, 0)
  const activeCatId = activeCat ?? cats?.[0]?.id
  const visibleItems = items?.filter(i => i.is_available && (!activeCatId || i.menu_category_id === activeCatId))

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <div>
            <h2 className="font-semibold text-gray-900">Room Service — Room {booking.room?.number}</h2>
            <p className="text-xs text-gray-400">{booking.guest?.name}</p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">✕</button>
        </div>
        <div className="flex flex-1 overflow-hidden">
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex gap-2 px-4 py-3 overflow-x-auto border-b">
              {cats?.map(c => <button key={c.id} onClick={() => setActiveCat(c.id)}
                className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium ${activeCatId === c.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>{c.name}</button>)}
            </div>
            <div className="flex-1 overflow-y-auto px-4 py-2 space-y-0.5">
              {visibleItems?.map(item => {
                const inCart = cart.find(x => x.menu_item_id === item.id)
                return (
                  <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                    <div>
                      <div className="text-sm font-medium text-gray-900">{item.name}</div>
                      <div className="text-xs text-gray-400">₹{item.price}</div>
                    </div>
                    {inCart ? (
                      <div className="flex items-center gap-2">
                        <button onClick={() => updateQty(item.id, -1)} className="w-7 h-7 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center">−</button>
                        <span className="w-5 text-center font-semibold text-sm">{inCart.quantity}</span>
                        <button onClick={() => updateQty(item.id, 1)} className="w-7 h-7 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">+</button>
                      </div>
                    ) : (
                      <button onClick={() => addToCart(item)} className="bg-orange-500 text-white text-xs px-3 py-1.5 rounded-full font-medium">Add</button>
                    )}
                  </div>
                )
              })}
            </div>
          </div>
          {cart.length > 0 && (
            <div className="w-56 border-l flex flex-col bg-gray-50">
              <div className="px-4 py-3 border-b font-medium text-gray-800 text-sm">Order</div>
              <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1.5">
                {cart.map(item => (
                  <div key={item.menu_item_id} className="flex items-center justify-between text-xs">
                    <span className="text-gray-800 flex-1">{item.name}</span>
                    <span className="text-gray-500 ml-1">×{item.quantity}</span>
                    <span className="text-gray-600 ml-2 font-medium">₹{(item.price * item.quantity).toFixed(0)}</span>
                  </div>
                ))}
              </div>
              <div className="px-3 py-3 border-t">
                <input value={orderNotes} onChange={e => setOrderNotes(e.target.value)} placeholder="Notes…"
                  className="w-full text-xs border border-gray-200 rounded px-2 py-1.5 mb-2 bg-white focus:outline-none" />
                <div className="flex justify-between text-sm font-semibold mb-2"><span>Total</span><span>₹{total.toFixed(0)}</span></div>
                <button onClick={() => create.mutate({ booking_id: booking.id, notes: orderNotes, items: cart.map(({ menu_item_id, quantity }) => ({ menu_item_id, quantity })) })}
                  disabled={create.isPending} className="w-full bg-orange-500 text-white py-2 rounded-lg text-xs font-semibold disabled:opacity-50">
                  {create.isPending ? 'Sending…' : 'Send to Kitchen'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function ActiveRooms({ onSelect }) {
  const { data: rooms } = useQuery({
    queryKey: ['active-rooms'],
    queryFn: () => getActiveRooms().then(r => r.data.data),
    refetchInterval: 30000,
  })

  if (!rooms?.length) return <p className="text-gray-400 text-sm">No guests currently checked in.</p>

  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-3">
      {rooms.map(b => (
        <button key={b.id} onClick={() => onSelect(b)}
          className="rounded-xl border-2 border-blue-300 bg-blue-50 hover:bg-blue-100 p-3 text-center transition-all">
          <div className="text-xl font-bold text-gray-900">{b.room?.number}</div>
          <div className="text-xs text-blue-600 font-medium">Room Service</div>
          <div className="text-xs text-gray-500 truncate mt-0.5">{b.guest?.name}</div>
        </button>
      ))}
    </div>
  )
}

export default function WaiterDashboard() {
  const { user, logout: clearAuth } = useAuthStore()
  const navigate = useNavigate()
  const [selectedTable, setSelectedTable] = useState(null)
  const [selectedBooking, setSelectedBooking] = useState(null)
  const [tab, setTab] = useState('tables')

  const handleLogout = async () => {
    try { await logoutApi() } catch (_) {}
    clearAuth()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">Waiter Dashboard</h1>
          <p className="text-xs text-gray-400">{user?.name}</p>
        </div>
        <button onClick={handleLogout} className="text-sm text-red-600 hover:underline">Logout</button>
      </header>

      <div className="flex gap-2 px-6 pt-4">
        {['tables', 'room service'].map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium capitalize ${tab === t ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
            {t}
          </button>
        ))}
      </div>

      <div className="p-6 space-y-8">
        {tab === 'tables' ? (
          <>
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Tables — tap to order</h2>
              <TableGrid onSelect={setSelectedTable} />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">My Active Orders</h2>
              <MyOrders />
            </div>
          </>
        ) : (
          <div>
            <h2 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">Checked-in Rooms — tap to place order</h2>
            <ActiveRooms onSelect={setSelectedBooking} />
          </div>
        )}
      </div>

      {selectedTable && (
        <OrderForm
          table={selectedTable}
          onClose={() => setSelectedTable(null)}
          onDone={() => setSelectedTable(null)}
        />
      )}

      {selectedBooking && (
        <RoomServiceForm
          booking={selectedBooking}
          onClose={() => setSelectedBooking(null)}
          onDone={() => setSelectedBooking(null)}
        />
      )}
    </div>
  )
}
