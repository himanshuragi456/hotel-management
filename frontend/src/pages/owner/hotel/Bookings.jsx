import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getBookings, createBooking, checkInBooking, checkOutBooking, cancelBooking, getBooking,
  getRooms, searchGuests, createGuest,
} from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'

const STATUS_BADGE = {
  upcoming:    'bg-blue-100 text-blue-700',
  checked_in:  'bg-green-100 text-green-700',
  checked_out: 'bg-gray-100 text-gray-600',
  cancelled:   'bg-red-100 text-red-600',
}

function NewBookingForm({ onSuccess }) {
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
    queryKey: ['guest-search', guestQuery],
    queryFn: () => searchGuests(guestQuery).then(r => r.data.data),
    enabled: guestQuery.length >= 2,
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms-available'],
    queryFn: () => getRooms().then(r => r.data.data),
  })

  const makeGuest = useMutation({ mutationFn: createGuest })
  const book = useMutation({
    mutationFn: createBooking,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['rooms'] }); onSuccess?.() },
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
    let guestId = guest?.id
    if (isNewGuest) {
      if (!newGuest.name || !newGuest.phone) { setError('Guest name and phone required'); return }
      const res = await makeGuest.mutateAsync({ ...newGuest })
      guestId = res.data.data?.id
    }
    if (!guestId) { setError('Please select or add a guest'); return }
    if (!form.room_id) { setError('Please select a room'); return }

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
              <input required value={newGuest.phone} onChange={e => setNewGuest(g => ({ ...g, phone: e.target.value }))} placeholder="Phone *" className={inp} />
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

function CheckOutModal({ booking, onSuccess, onClose }) {
  const qc = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [extraPaid, setExtraPaid] = useState('')
  const [error, setError] = useState('')

  const checkout = useMutation({
    mutationFn: () => checkOutBooking(booking.id, { payment_method: paymentMethod, extra_paid: parseFloat(extraPaid) || 0 }),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['rooms'] }); onSuccess?.() },
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const totalAmount = booking.total_amount ?? 0
  const advancePaid = booking.advance_paid ?? 0
  const extra = parseFloat(extraPaid) || 0
  const balance = totalAmount - advancePaid - extra

  return (
    <div className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
      <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
        <div className="flex justify-between text-gray-600"><span>Room charges</span><span>₹{(booking.room_charges ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between text-gray-600"><span>Room service</span><span>₹{(booking.service_charges ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold text-gray-900 border-t pt-2"><span>Total</span><span>₹{totalAmount.toFixed(2)}</span></div>
        <div className="flex justify-between text-green-600"><span>Advance paid</span><span>−₹{advancePaid.toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-gray-900 border-t pt-2 text-base"><span>Balance Due</span><span>₹{Math.max(0, totalAmount - advancePaid).toFixed(2)}</span></div>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Amount received now</label>
        <input type="number" step="0.01" min="0" value={extraPaid} onChange={e => setExtraPaid(e.target.value)} placeholder="₹0" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
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
      {balance > 0.01 && <div className="text-yellow-600 text-xs bg-yellow-50 px-3 py-2 rounded-lg">Outstanding balance: ₹{balance.toFixed(2)}</div>}
      <button onClick={() => checkout.mutate()} disabled={checkout.isPending}
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold disabled:opacity-50">
        {checkout.isPending ? 'Processing…' : 'Confirm Check-out'}
      </button>
    </div>
  )
}

function BookingRow({ booking, onCheckIn, onCheckOut, onCancel, onView }) {
  return (
    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => onView(booking)}>
      <td className="px-4 py-3 font-mono text-xs text-gray-500">{booking.booking_number}</td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-900 text-sm">{booking.guest?.name}</div>
        <div className="text-xs text-gray-400">{booking.guest?.phone}</div>
      </td>
      <td className="px-4 py-3">
        <div className="font-medium text-gray-800 text-sm">Room {booking.room?.number}</div>
        <div className="text-xs text-gray-400 capitalize">{booking.room?.type}</div>
      </td>
      <td className="px-4 py-3 text-sm text-gray-600">
        {new Date(booking.check_in_date).toLocaleDateString()}
        <span className="text-gray-300 mx-1">→</span>
        {new Date(booking.check_out_date).toLocaleDateString()}
      </td>
      <td className="px-4 py-3 text-sm font-medium text-gray-900">₹{(booking.total_amount ?? 0).toLocaleString()}</td>
      <td className="px-4 py-3">
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${STATUS_BADGE[booking.status]}`}>
          {booking.status.replace('_', ' ')}
        </span>
      </td>
      <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
        <div className="flex gap-1">
          {booking.status === 'upcoming' && (
            <>
              <button onClick={() => onCheckIn(booking)} className="text-xs text-green-600 hover:underline font-medium">Check-in</button>
              <button onClick={() => onCancel(booking)} className="text-xs text-red-400 hover:underline ml-2">Cancel</button>
            </>
          )}
          {booking.status === 'checked_in' && (
            <button onClick={() => onCheckOut(booking)} className="text-xs text-orange-600 hover:underline font-medium">Check-out</button>
          )}
        </div>
      </td>
    </tr>
  )
}

export default function Bookings() {
  const qc = useQueryClient()
  const [status, setStatus] = useState('')
  const [showNew, setShowNew] = useState(false)
  const [checkingOut, setCheckingOut] = useState(null)
  const [viewBooking, setViewBooking] = useState(null)

  const { data: bookingPage } = useQuery({
    queryKey: ['bookings', status],
    queryFn: () => getBookings(status ? { status } : {}).then(r => r.data.data),
    refetchInterval: 30000,
  })

  const bookings = bookingPage?.data ?? bookingPage ?? []

  const checkIn = useMutation({
    mutationFn: (b) => checkInBooking(b.id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['bookings'] }); qc.invalidateQueries({ queryKey: ['rooms'] }) },
  })

  const cancel = useMutation({
    mutationFn: (b) => cancelBooking(b.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['bookings'] }),
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Bookings</h2>
        <button onClick={() => setShowNew(true)} className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
          + New Booking
        </button>
      </div>

      {/* Status filter tabs */}
      <div className="flex gap-2 mb-4">
        {['', 'upcoming', 'checked_in', 'checked_out', 'cancelled'].map(s => (
          <button key={s} onClick={() => setStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${status === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s ? s.replace('_', ' ') : 'All'}
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Booking #</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Guest</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Room</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Dates</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Total</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {bookings.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-10 text-gray-400">No bookings found</td></tr>
              ) : bookings.map(b => (
                <BookingRow key={b.id} booking={b}
                  onCheckIn={(bk) => confirm(`Check in ${bk.guest?.name} to Room ${bk.room?.number}?`) && checkIn.mutate(bk)}
                  onCheckOut={(bk) => setCheckingOut(bk)}
                  onCancel={(bk) => confirm(`Cancel booking ${bk.booking_number}?`) && cancel.mutate(bk)}
                  onView={setViewBooking}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Booking" size="md">
        <NewBookingForm onSuccess={() => setShowNew(false)} />
      </Modal>

      <Modal open={!!checkingOut} onClose={() => setCheckingOut(null)} title={`Check-out · Room ${checkingOut?.room?.number}`} size="sm">
        {checkingOut && <CheckOutModal booking={checkingOut} onSuccess={() => setCheckingOut(null)} onClose={() => setCheckingOut(null)} />}
      </Modal>

      <Modal open={!!viewBooking} onClose={() => setViewBooking(null)} title="Booking Details" size="md">
        {viewBooking && <BookingDetail booking={viewBooking} />}
      </Modal>
    </div>
  )
}

function BookingDetail({ booking }) {
  const { data: detail } = useQuery({
    queryKey: ['booking', booking.id],
    queryFn: () => getBooking(booking.id).then(r => r.data.data),
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
        <div className="flex justify-between text-gray-600"><span>Room charges</span><span>₹{(b.room_charges ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between text-gray-600"><span>Room service</span><span>₹{(b.service_charges ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between font-bold text-gray-900 border-t pt-1.5"><span>Total</span><span>₹{(b.total_amount ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between text-green-600"><span>Advance paid</span><span>₹{(b.advance_paid ?? 0).toFixed(2)}</span></div>
        <div className="flex justify-between font-semibold"><span>Balance due</span><span>₹{(b.balance_due ?? 0).toFixed(2)}</span></div>
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
