import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBookings, createBooking, checkInBooking, checkOutBooking, cancelBooking, getBooking,
  getRooms, searchGuests, createGuest, getBookingCheckoutSummary, extendBookingStay,
} from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import {
  PlusIcon, CalendarDaysIcon, ExclamationTriangleIcon,
} from '@heroicons/react/24/outline'
import { validate, required, isEmail, isPhone, dateAfter, dateNotPast, minValue, isInteger } from '@/utils/validate'

const STATUS_BADGE = {
  upcoming:    'bg-blue-100 text-blue-700',
  checked_in:  'bg-green-100 text-green-700',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled:   'bg-red-100 text-red-600',
}

const isOverdue = (b) => b.is_overdue || (
  b.status === 'checked_in' && new Date(b.check_out_date) < new Date(new Date().toDateString())
)

function NewBookingForm({ onSuccess, svc }) {
  const [step, setStep] = useState(1)
  const [guestQuery, setGuestQuery] = useState('')
  const [guest, setGuest] = useState(null)
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', email: '' })
  const [isNewGuest, setIsNewGuest] = useState(false)
  const [form, setForm] = useState({
    room_id: '',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    adults: 1, children: 0,
    advance_paid: '', advance_payment_method: 'cash',
    notes: '',
  })
  const [error, setError] = useState('')
  const qc = useQueryClient()

  const { data: guestResults } = useQuery({
    queryKey: ['guest-search', svc._prefix ?? 'owner', guestQuery],
    queryFn: () => svc.searchGuests(guestQuery).then(r => r.data.data),
    enabled: guestQuery.length >= 2,
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms-available', svc._prefix ?? 'owner'],
    queryFn: () => svc.getRooms().then(r => r.data.data),
  })

  const makeGuest = useMutation({ mutationFn: svc.createGuest })
  const book = useMutation({
    mutationFn: svc.createBooking,
    onSuccess: () => { qc.invalidateQueries({ predicate: q => q.queryKey.includes('bookings') }); qc.invalidateQueries({ predicate: q => q.queryKey.includes('rooms') }); onSuccess?.() },
    onError: (err) => setError(err.response?.data?.message ?? 'Booking failed'),
  })

  const selectedRoom = rooms?.find(r => r.id === parseInt(form.room_id))
  const nights = form.check_in_date && form.check_out_date
    ? Math.max(0, (new Date(form.check_out_date) - new Date(form.check_in_date)) / 86400000)
    : 0
  const roomCharges = (selectedRoom?.price_per_night ?? 0) * nights

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  const handleSubmit = async () => {
    setError('')

    if (isNewGuest) {
      const guestErrs = validate({
        name:  [required('Guest name')],
        phone: [required('Phone'), isPhone()],
        email: [isEmail()],
      }, newGuest)
      if (Object.keys(guestErrs).length) {
        setError(Object.values(guestErrs)[0])
        return
      }
    }

    if (!guest && !isNewGuest) { setError('Please select or add a guest'); return }
    if (!form.room_id) { setError('Please select a room'); return }

    const bookingErrs = validate({
      check_in_date:  [required('Check-in date'), dateNotPast('Check-in date')],
      check_out_date: [required('Check-out date'), dateAfter('check_in_date', 'check-in', 'Check-out date')],
      adults:         [required('Adults'), minValue(1, 'Adults'), isInteger('Adults')],
    }, form)
    if (Object.keys(bookingErrs).length) { setError(Object.values(bookingErrs)[0]); return }

    let guestId = guest?.id
    if (isNewGuest) {
      const res = await makeGuest.mutateAsync({ ...newGuest })
      guestId = res.data.data?.id
    }
    if (!guestId) { setError('Failed to create guest'); return }

    book.mutate({ ...form, guest_id: guestId, adults: parseInt(form.adults), children: parseInt(form.children) })
  }

  return (
    <div className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

      {/* Step 1 — Guest */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-medium text-gray-800 mb-3 text-sm">1. Guest</h3>
        {guest && !isNewGuest ? (
          <div className="flex items-center justify-between bg-green-50 border border-green-200 rounded-lg px-3 py-2">
            <div>
              <span className="font-medium text-gray-900 text-sm">{guest.name}</span>
              <span className="text-xs text-gray-500 ml-2">{guest.phone}</span>
            </div>
            <button onClick={() => setGuest(null)} className="text-red-400 text-xs hover:underline">change</button>
          </div>
        ) : isNewGuest ? (
          <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2">
              <input required value={newGuest.name} onChange={e => setNewGuest(g => ({ ...g, name: e.target.value }))} placeholder="Full name *" className={inp} />
              <input type="tel" required value={newGuest.phone} onChange={e => setNewGuest(g => ({ ...g, phone: e.target.value }))} placeholder="Phone *" className={inp} />
            </div>
            <input type="email" value={newGuest.email} onChange={e => setNewGuest(g => ({ ...g, email: e.target.value }))} placeholder="Email (optional)" className={inp} />
            <button onClick={() => setIsNewGuest(false)} className="text-xs text-gray-400 hover:text-gray-600">← Search existing guest</button>
          </div>
        ) : (
          <div>
            <div className="relative mb-2">
              <input value={guestQuery} onChange={e => setGuestQuery(e.target.value)} placeholder="Search by name or phone…" className={inp} />
              {guestResults?.length > 0 && (
                <div className="absolute top-full left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 mt-1">
                  {guestResults.map(g => (
                    <button key={g.id} onClick={() => { setGuest(g); setGuestQuery('') }}
                      className="w-full text-left px-3 py-2.5 hover:bg-gray-50 text-sm">
                      <span className="font-medium text-gray-900">{g.name}</span>
                      <span className="text-gray-400 ml-2 text-xs">{g.phone}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
            <button onClick={() => setIsNewGuest(true)} className="text-xs text-orange-600 hover:underline font-medium">+ New guest</button>
          </div>
        )}
      </div>

      {/* Step 2 — Room & Dates */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-medium text-gray-800 mb-3 text-sm">2. Room & Dates</h3>
        <div className="space-y-3">
          <select required value={form.room_id} onChange={e => setForm(f => ({ ...f, room_id: e.target.value }))} className={inp}>
            <option value="">Select room…</option>
            {rooms?.filter(r => r.status === 'available').map(r => (
              <option key={r.id} value={r.id}>{r.number} — {r.type} (Floor {r.floor}) — ₹{r.price_per_night}/night</option>
            ))}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in</label>
              <input type="date" value={form.check_in_date} onChange={e => setForm(f => ({ ...f, check_in_date: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-out</label>
              <input type="date" value={form.check_out_date} onChange={e => setForm(f => ({ ...f, check_out_date: e.target.value }))} className={inp} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Adults</label>
              <input type="number" min="1" value={form.adults} onChange={e => setForm(f => ({ ...f, adults: e.target.value }))} className={inp} />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Children</label>
              <input type="number" min="0" value={form.children} onChange={e => setForm(f => ({ ...f, children: e.target.value }))} className={inp} />
            </div>
          </div>
          {nights > 0 && selectedRoom && (
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-blue-800">
              {nights} night{nights > 1 ? 's' : ''} × ₹{selectedRoom.price_per_night} = <strong>₹{roomCharges.toLocaleString()}</strong>
            </div>
          )}
        </div>
      </div>

      {/* Step 3 — Advance */}
      <div className="bg-gray-50 rounded-xl p-4">
        <h3 className="font-medium text-gray-800 mb-3 text-sm">3. Advance Payment (optional)</h3>
        <div className="grid grid-cols-2 gap-3">
          <input type="number" step="0.01" min="0" value={form.advance_paid} onChange={e => setForm(f => ({ ...f, advance_paid: e.target.value }))} placeholder="Amount ₹" className={inp} />
          <select value={form.advance_payment_method} onChange={e => setForm(f => ({ ...f, advance_payment_method: e.target.value }))} className={inp}>
            <option value="cash">Cash</option>
            <option value="upi">UPI</option>
            <option value="card">Card</option>
          </select>
        </div>
        <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className={`${inp} mt-2`} />
      </div>

      <button onClick={handleSubmit} disabled={book.isPending || makeGuest.isPending}
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
        {book.isPending ? 'Creating Booking…' : 'Create Booking'}
      </button>
    </div>
  )
}

export function CheckOutModal({ booking, onSuccess, onClose, svc }) {
  const qc = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [extraPaid, setExtraPaid] = useState('')
  const [error, setError] = useState('')
  const [showExtend, setShowExtend] = useState(false)
  const [newCheckOut, setNewCheckOut] = useState('')
  const [showFoodDetail, setShowFoodDetail] = useState(false)

  const { data: summary, isLoading: summaryLoading, refetch } = useQuery({
    queryKey: ['checkout-summary', booking.id],
    queryFn: () => (svc.getBookingCheckoutSummary ?? getBookingCheckoutSummary)(booking.id).then(r => r.data.data),
  })

  const checkout = useMutation({
    mutationFn: () => svc.checkOutBooking(booking.id, { payment_method: paymentMethod, extra_paid: parseFloat(extraPaid) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ predicate: q => q.queryKey.includes('bookings') }); qc.invalidateQueries({ predicate: q => q.queryKey.includes('rooms') }); onSuccess?.() },
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const extend = useMutation({
    mutationFn: () => (svc.extendBookingStay ?? extendBookingStay)(booking.id, { check_out_date: newCheckOut }),
    onSuccess: () => {
      setShowExtend(false)
      setNewCheckOut('')
      qc.invalidateQueries({ predicate: q => q.queryKey.includes('bookings') })
      refetch()
      onSuccess?.()
    },
    onError: (err) => setError(err.response?.data?.message ?? 'Error extending stay'),
  })

  const b = summary ?? booking
  const roomCharges    = parseFloat(b.room_charges    ?? 0)
  const serviceCharges = parseFloat(b.service_charges ?? 0)
  const totalAmount    = parseFloat(b.total_amount    ?? 0)
  const advancePaid    = parseFloat(b.advance_paid    ?? 0)
  const extra          = parseFloat(extraPaid) || 0
  const balanceDue     = Math.max(0, totalAmount - advancePaid - extra)
  const byDate         = summary?.unbilled_orders_by_date ?? []
  const foodTotal      = parseFloat(summary?.unbilled_food_total ?? 0)
  const overdue        = isOverdue(b)

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

      {/* Overdue warning + extend stay */}
      {overdue && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-red-700">⚠ Checkout date passed</p>
              <p className="text-xs text-red-500 mt-0.5">
                Was due {new Date(b.check_out_date).toLocaleDateString()}
              </p>
            </div>
            <button
              onClick={() => setShowExtend(s => !s)}
              className="text-xs font-semibold text-red-700 border border-red-300 px-3 py-1.5 rounded-lg hover:bg-red-100"
            >
              {showExtend ? 'Cancel' : 'Extend Stay'}
            </button>
          </div>
          {showExtend && (
            <div className="mt-3 flex gap-2 items-end">
              <div className="flex-1">
                <label className="block text-xs font-medium text-red-700 mb-1">New check-out date</label>
                <input type="date" value={newCheckOut} onChange={e => setNewCheckOut(e.target.value)}
                  min={[new Date().toISOString().split('T')[0], b.check_in_date].sort().pop()}
                  className="w-full border border-red-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-400" />
              </div>
              <button
                onClick={() => extend.mutate()}
                disabled={!newCheckOut || extend.isPending}
                className="bg-red-600 text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
              >
                {extend.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          )}
        </div>
      )}

      {summaryLoading ? (
        <div className="text-center py-6 text-gray-400 text-sm">Loading bill summary…</div>
      ) : (
        <>
          <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
            <div className="flex justify-between text-gray-600">
              <span>Room stay ({b.nights ?? 0} night{b.nights !== 1 ? 's' : ''} × ₹{parseFloat(b.price_per_night ?? 0).toLocaleString()})</span>
              <span>₹{roomCharges.toFixed(2)}</span>
            </div>
            {serviceCharges > 0 && (
              <div className="flex justify-between text-gray-600">
                <button
                  onClick={() => setShowFoodDetail(s => !s)}
                  className="text-left text-orange-600 hover:underline text-xs font-medium">
                  Room service ({byDate.length} day{byDate.length !== 1 ? 's' : ''}) {showFoodDetail ? '▲' : '▼'}
                </button>
                <span>₹{serviceCharges.toFixed(2)}</span>
              </div>
            )}
            <div className="flex justify-between font-semibold text-gray-900 border-t pt-2"><span>Total</span><span>₹{totalAmount.toFixed(2)}</span></div>
            <div className="flex justify-between text-green-600"><span>Advance paid</span><span>−₹{advancePaid.toFixed(2)}</span></div>
            <div className="flex justify-between font-bold text-gray-900 border-t pt-2 text-base"><span>Balance Due</span><span>₹{Math.max(0, totalAmount - advancePaid).toFixed(2)}</span></div>
          </div>

          {/* Per-day food breakdown */}
          {showFoodDetail && byDate.length > 0 && (
            <div className="border border-orange-200 rounded-xl overflow-hidden">
              {byDate.map((day) => (
                <div key={day.date} className="border-b border-orange-100 last:border-0">
                  <div className="flex justify-between items-center px-3 py-2 bg-orange-50">
                    <span className="text-xs font-semibold text-orange-800">
                      {new Date(day.date).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}
                    </span>
                    <span className="text-xs font-bold text-orange-700">₹{parseFloat(day.day_total).toFixed(2)}</span>
                  </div>
                  {day.orders.map(order => (
                    <div key={order.order_number} className="px-3 py-2 bg-white">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span className="font-mono">{order.order_number}</span>
                        <span className="capitalize text-gray-400">{order.status}</span>
                      </div>
                      {order.items.map((item, i) => (
                        <div key={i} className="flex justify-between text-xs text-gray-600 pl-2">
                          <span>{item.quantity}× {item.name}</span>
                          <span>₹{parseFloat(item.subtotal).toFixed(0)}</span>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))}
              {foodTotal > 0 && (
                <div className="flex justify-between px-3 py-2 bg-orange-50 text-xs font-bold text-orange-800 border-t border-orange-200">
                  <span>Food total</span><span>₹{foodTotal.toFixed(2)}</span>
                </div>
              )}
            </div>
          )}
        </>
      )}

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount received now</label>
        <input type="number" step="0.01" min="0" value={extraPaid} onChange={e => setExtraPaid(e.target.value)} placeholder="₹0" className={inp} />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
        <div className="grid grid-cols-3 gap-2">
          {['cash', 'upi', 'card'].map(m => (
            <button key={m} type="button" onClick={() => setPaymentMethod(m)}
              className={`py-2 rounded-lg text-xs font-medium capitalize ${paymentMethod === m ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {m}
            </button>
          ))}
        </div>
      </div>
      {balanceDue > 0.01 && <div className="text-yellow-600 text-xs bg-yellow-50 px-3 py-2 rounded-lg">Outstanding after this payment: ₹{balanceDue.toFixed(2)}</div>}
      <button onClick={() => checkout.mutate()} disabled={checkout.isPending || summaryLoading}
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
        {checkout.isPending ? 'Processing…' : 'Confirm Check-out'}
      </button>
    </div>
  )
}

function BookingRow({ booking, onCheckIn, onCheckOut, onCancel, onView }) {
  const overdue = isOverdue(booking)
  return (
    <tr className={`cursor-pointer transition-colors ${overdue ? 'bg-red-50/60 hover:bg-red-100/60' : 'hover:bg-gray-50/80'}`} onClick={() => onView(booking)}>
      <td className="px-5 py-4 font-mono text-xs text-gray-500">{booking.booking_number}</td>
      <td className="px-5 py-4">
        <div className="font-semibold text-gray-900 text-sm">{booking.guest?.name}</div>
        <div className="text-xs text-gray-400 mt-0.5">{booking.guest?.phone}</div>
      </td>
      <td className="px-5 py-4">
        <div className="font-semibold text-gray-800 text-sm">Room {booking.room?.number}</div>
        <div className="text-xs text-gray-400 capitalize mt-0.5">{booking.room?.type}</div>
      </td>
      <td className="px-5 py-4 text-sm text-gray-600">
        <span>{new Date(booking.check_in_date).toLocaleDateString()}</span>
        <span className="text-gray-300 mx-1.5">→</span>
        <span className={overdue ? 'text-red-600 font-semibold' : ''}>{new Date(booking.check_out_date).toLocaleDateString()}</span>
      </td>
      <td className="px-5 py-4 font-bold text-gray-900">₹{parseFloat(booking.total_amount ?? 0).toLocaleString()}</td>
      <td className="px-5 py-4">
        <div className="flex flex-col gap-1">
          <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium capitalize w-fit ${STATUS_BADGE[booking.status]}`}>
            {booking.status.replace('_', ' ')}
          </span>
          {overdue && (
            <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-semibold w-fit bg-red-100 text-red-700">
              <ExclamationTriangleIcon className="w-3 h-3" />Overdue
            </span>
          )}
        </div>
      </td>
      <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
        <div className="flex gap-1.5 flex-wrap">
          {booking.status === 'upcoming' && (
            <>
              <button onClick={() => onCheckIn(booking)} className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">Check-in</button>
              <button onClick={() => onCancel(booking)} className="text-xs bg-red-50 text-red-500 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">Cancel</button>
            </>
          )}
          {booking.status === 'checked_in' && (
            <button onClick={() => onCheckOut(booking)} className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${overdue ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
              Check-out
            </button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function Bookings({ services = {}, queryKeyPrefix = 'owner' }) {
  const svc = {
    _prefix:                    queryKeyPrefix,
    getBookings:                getBookings,
    createBooking:              createBooking,
    checkInBooking:             checkInBooking,
    checkOutBooking:            checkOutBooking,
    cancelBooking:              cancelBooking,
    getBooking:                 getBooking,
    getBookingCheckoutSummary:  getBookingCheckoutSummary,
    getRooms:                   getRooms,
    searchGuests:               searchGuests,
    createGuest:                createGuest,
    ...services,
  }

  const qk = queryKeyPrefix  // scopes query cache per caller
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [checkingOut, setCheckingOut] = useState(null)
  const [viewBooking, setViewBooking] = useState(null)
  const [checkInTarget, setCheckInTarget] = useState(null)
  const [cancelTarget, setCancelTarget] = useState(null)

  const { data: bookingPage, isLoading } = useQuery({
    queryKey: [qk, 'bookings', status],
    queryFn: () => svc.getBookings(status ? { status } : {}).then(r => r.data.data),
    refetchInterval: 30000,
  })

  const bookings = bookingPage?.data ?? bookingPage ?? []

  const checkIn = useMutation({
    mutationFn: (b) => svc.checkInBooking(b.id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: [qk, 'bookings'] })
      qc.invalidateQueries({ queryKey: [qk, 'rooms'] })
      setCheckInTarget(null)
    },
  })

  const cancel = useMutation({
    mutationFn: (b) => svc.cancelBooking(b.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: [qk, 'bookings'] }); setCancelTarget(null) },
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Bookings</h2>
          <p className="text-sm text-gray-400 mt-0.5">{bookings.length} booking{bookings.length !== 1 ? 's' : ''} {status ? `· ${status.replace('_', ' ')}` : ''}</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow">
          <PlusIcon className="w-4 h-4" />New Booking
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-5 flex-wrap">
        {['', 'upcoming', 'checked_in', 'checked_out', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium capitalize transition-colors ${status === s ? 'bg-orange-500 text-white shadow-sm' : 'bg-white border border-gray-200 text-gray-600 hover:border-orange-300 hover:text-orange-600'}`}>
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[700px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Booking #', 'Guest', 'Room', 'Dates', 'Total', 'Status', ''].map(h => (
                  <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && [1,2,3,4].map(i => (
                <tr key={i}>
                  {[140, 120, 80, 160, 80, 80, 60].map((w, j) => (
                    <td key={j} className="px-5 py-4"><div className={`h-4 bg-gray-100 rounded animate-pulse`} style={{width: w}} /></td>
                  ))}
                </tr>
              ))}
              {!isLoading && bookings.length === 0 ? (
                <tr>
                  <td colSpan={7} className="text-center py-16">
                    <CalendarDaysIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No bookings found</p>
                  </td>
                </tr>
              ) : bookings.map(b => (
                <BookingRow key={b.id} booking={b}
                  onCheckIn={(bk) => setCheckInTarget(bk)}
                  onCheckOut={(bk) => setCheckingOut(bk)}
                  onCancel={(bk) => setCancelTarget(bk)}
                  onView={setViewBooking}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Booking" size="md">
        <NewBookingForm svc={svc} onSuccess={() => setShowNew(false)} />
      </Modal>

      <Modal open={!!checkingOut} onClose={() => setCheckingOut(null)} title={`Check-out · Room ${checkingOut?.room?.number}`} size="sm">
        {checkingOut && <CheckOutModal svc={svc} booking={checkingOut} onSuccess={() => setCheckingOut(null)} onClose={() => setCheckingOut(null)} />}
      </Modal>

      <Modal open={!!viewBooking} onClose={() => setViewBooking(null)} title="Booking Details" size="md">
        {viewBooking && <BookingDetail svc={svc} booking={viewBooking} />}
      </Modal>

      <ConfirmDialog
        open={!!checkInTarget}
        title="Confirm Check-In"
        message={`Check in ${checkInTarget?.guest?.name} to Room ${checkInTarget?.room?.number}?`}
        confirmLabel={checkIn.isPending ? 'Checking in…' : 'Check In'}
        confirmClass="bg-green-600 hover:bg-green-700 text-white"
        onConfirm={() => checkIn.mutate(checkInTarget)}
        onCancel={() => setCheckInTarget(null)}
      />

      <ConfirmDialog
        open={!!cancelTarget}
        title="Cancel Booking?"
        message={`Cancel booking ${cancelTarget?.booking_number}? The room will be freed up.`}
        confirmLabel={cancel.isPending ? 'Cancelling…' : 'Cancel Booking'}
        confirmClass="bg-red-500 hover:bg-red-600 text-white"
        onConfirm={() => cancel.mutate(cancelTarget)}
        onCancel={() => setCancelTarget(null)}
      />
    </div>
  )
}

export function BookingDetail({ booking, svc }) {
  const { data: detail } = useQuery({
    queryKey: ['booking', booking.id],
    queryFn: () => svc.getBooking(booking.id).then(r => r.data.data),
  })
  const b = detail ?? booking
  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm">
        <div><span className="text-gray-500">Booking #</span><div className="font-mono font-medium">{b.booking_number}</div></div>
        <div><span className="text-gray-500">Status</span><div className={`inline-block mt-0.5 text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[b.status]}`}>{b.status?.replace('_', ' ')}</div></div>
        <div><span className="text-gray-500">Guest</span><div className="font-medium">{b.guest?.name}</div><div className="text-xs text-gray-400">{b.guest?.phone}</div></div>
        <div><span className="text-gray-500">Room</span><div className="font-medium">Room {b.room?.number} ({b.room?.type})</div></div>
        <div><span className="text-gray-500">Check-in</span><div>{b.check_in_date ? new Date(b.check_in_date).toLocaleDateString() : '—'}</div></div>
        <div><span className="text-gray-500">Check-out</span><div>{b.check_out_date ? new Date(b.check_out_date).toLocaleDateString() : '—'}</div></div>
        <div><span className="text-gray-500">Nights</span><div className="font-semibold">{b.nights ?? 0}</div></div>
        <div><span className="text-gray-500">Guests</span><div>{b.adults} adult{b.adults !== 1 ? 's' : ''}{b.children > 0 ? `, ${b.children} child` : ''}</div></div>
      </div>
      <div className="bg-gray-50 rounded-xl p-3 text-sm space-y-1.5">
        <div className="flex justify-between text-gray-600"><span>Room charges</span><span>₹{parseFloat(b.room_charges ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between text-gray-600"><span>Room service</span><span>₹{parseFloat(b.service_charges ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5"><span>Total</span><span>₹{parseFloat(b.total_amount ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between text-green-600"><span>Advance paid</span><span>₹{parseFloat(b.advance_paid ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold"><span>Balance due</span><span>₹{parseFloat(b.balance_due ?? 0).toFixed(2)}</span></div>
      </div>
      {b.orders?.length > 0 && (
        <div>
          <div className="font-medium text-gray-800 text-sm mb-2">Room Service Orders</div>
          {b.orders.map(o => (
            <div key={o.id} className="flex justify-between text-xs text-gray-600 py-1 border-b border-gray-50">
              <span>{o.order_number}</span>
              <span>{o.items?.length} items</span>
              <span>₹{o.total}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
