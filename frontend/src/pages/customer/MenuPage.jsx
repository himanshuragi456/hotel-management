import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getCustomerMenu, customerPlaceOrder } from '@/services/restaurantService'

const typeIcon = { veg: '🟢', 'non-veg': '🔴', vegan: '🌱' }

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
          <button onClick={onClose} className="text-gray-400 text-xl">✕</button>
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
                  className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center">−</button>
                <span className="font-semibold w-5 text-center">{item.quantity}</span>
                <button onClick={() => onUpdateQty(item.menu_item_id, 1)}
                  className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">+</button>
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

function OrderConfirmed({ orderNumber, onBack }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="text-7xl mb-6">🎉</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Order Placed!</h1>
      <p className="text-gray-500 mb-2">Your order is being prepared in the kitchen.</p>
      <p className="text-sm text-gray-400 mb-8 font-mono">{orderNumber}</p>
      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-6 py-4 max-w-xs">
        <p className="text-sm text-orange-800">Please wait at your table. Your waiter will serve you shortly.</p>
      </div>
      <button onClick={onBack} className="mt-8 text-sm text-gray-400 hover:text-gray-600 underline">Order more items</button>
    </div>
  )
}

export default function CustomerMenuPage() {
  const { slug, token } = useParams()
  const [cart, setCart] = useState([])
  const [showCart, setShowCart] = useState(false)
  const [activeCat, setActiveCat] = useState(null)
  const [confirmed, setConfirmed] = useState(null)

  const { data, isLoading, error } = useQuery({
    queryKey: ['customer-menu', slug, token],
    queryFn: () => getCustomerMenu(slug, token).then(r => r.data.data),
  })

  const placeOrder = useMutation({
    mutationFn: ({ slug, token, items }) => customerPlaceOrder(slug, token, { items }),
    onSuccess: (res) => {
      setConfirmed(res.data.data?.order_number)
      setCart([])
      setShowCart(false)
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

  if (confirmed) return <OrderConfirmed orderNumber={confirmed} onBack={() => setConfirmed(null)} />

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

  return (
    <div className="min-h-screen bg-gray-50 pb-24">
      {/* Header */}
      <div className="bg-white px-5 pt-6 pb-4 shadow-sm">
        <h1 className="text-xl font-bold text-gray-900">{tenant?.name}</h1>
        <p className="text-sm text-gray-500">Table {table?.number}{table?.section ? ` · ${table.section}` : ''}</p>
      </div>

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
              {item.image && (
                <img src={`/storage/${item.image}`} className="w-24 h-24 object-cover shrink-0" />
              )}
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
                  {inCart ? (
                    <div className="flex items-center gap-2">
                      <button onClick={() => updateQty(item.id, -1)} className="w-8 h-8 rounded-full bg-orange-100 text-orange-600 font-bold flex items-center justify-center">−</button>
                      <span className="font-semibold w-4 text-center">{inCart.quantity}</span>
                      <button onClick={() => updateQty(item.id, 1)} className="w-8 h-8 rounded-full bg-orange-500 text-white font-bold flex items-center justify-center">+</button>
                    </div>
                  ) : (
                    <button onClick={() => addToCart(item)}
                      className="bg-orange-500 text-white text-sm font-semibold px-4 py-1.5 rounded-full">
                      Add
                    </button>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      <CartBar cart={cart} onOpen={() => setShowCart(true)} />

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
