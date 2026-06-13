import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { useScrollToFirstError, scrollToEl } from '@/hooks/useScrollToFirstError'
import {
  getBookings, createBooking, updateBooking, checkInBooking, checkOutBooking, cancelBooking, getBooking,
  getRooms, searchGuests, createGuest, getBookingCheckoutSummary, extendBookingStay, getOwnerSettings,
  downloadBookingBill,
} from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import {
  PlusIcon, CalendarDaysIcon, ExclamationTriangleIcon, ChatBubbleBottomCenterTextIcon,
} from '@heroicons/react/24/outline'
import { validate, validateField, required, isEmail, isPhone, dateAfter, dateNotPast, minValue, isInteger } from '@/utils/validate'

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
  const [guestQuery, setGuestQuery] = useState('')
  const debouncedGuestQuery = useDebounce(guestQuery, 350)
  const [guest, setGuest] = useState(null)
  const [newGuest, setNewGuest] = useState({ name: '', phone: '', email: '' })
  const [isNewGuest, setIsNewGuest] = useState(false)
  const [form, setForm] = useState(() => ({
    room_id: '',
    check_in_date: new Date().toISOString().split('T')[0],
    check_out_date: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    adults: 1, children: 0,
    advance_paid: '', advance_payment_method: 'cash',
    decided_amount: '',
    notes: '',
  }))
  const [decidedAmountTouched, setDecidedAmountTouched] = useState(false)
  const [error, setError] = useState('')
  const [submitCount, setSubmitCount] = useState(0)
  const errorRef = useRef(null)
  const qc = useQueryClient()

  useEffect(() => {
    if (error && errorRef.current) requestAnimationFrame(() => scrollToEl(errorRef.current))
  }, [submitCount])

  const { data: guestResults } = useQuery({
    queryKey: ['guest-search', svc._prefix ?? 'owner', debouncedGuestQuery],
    queryFn: () => svc.searchGuests(debouncedGuestQuery).then(r => r.data.data),
    enabled: debouncedGuestQuery.length >= 2,
  })

  const { data: rooms } = useQuery({
    queryKey: ['rooms-available', svc._prefix ?? 'owner'],
    queryFn: () => svc.getRooms().then(r => r.data.data),
  })

  const { data: ownerSettings } = useQuery({
    queryKey: ['owner-settings'],
    queryFn: () => getOwnerSettings().then(r => r.data.data),
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
  const roomCharges   = (selectedRoom?.price_per_night ?? 0) * nights
  const hotelGstRate  = ownerSettings?.hotel_gst_rate ?? 0
  const hotelGstIncl  = ownerSettings?.hotel_gst_inclusive ?? false
  // Auto-fill decided_amount with base room charges (before GST) unless user has edited it
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!decidedAmountTouched && roomCharges > 0) {
      setForm(f => ({ ...f, decided_amount: roomCharges.toFixed(2) }))
    }
  }, [roomCharges, decidedAmountTouched])
  /* eslint-enable react-hooks/set-state-in-effect */

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  const fail = (msg) => { setError(msg); setSubmitCount(c => c + 1) }

  const handleSubmit = async () => {
    setError('')

    if (isNewGuest) {
      const guestErrs = validate({
        name:  [required('Guest name')],
        phone: [required('Phone'), isPhone()],
        email: [isEmail()],
      }, newGuest)
      if (Object.keys(guestErrs).length) {
        fail(Object.values(guestErrs)[0])
        return
      }
    }

    if (!guest && !isNewGuest) { fail('Please select or add a guest'); return }
    if (!form.room_id) { fail('Please select a room'); return }

    const bookingErrs = validate({
      check_in_date:  [required('Check-in date'), dateNotPast('Check-in date')],
      check_out_date: [required('Check-out date'), dateAfter('check_in_date', 'check-in', 'Check-out date')],
      adults:         [required('Adults'), minValue(1, 'Adults'), isInteger('Adults')],
    }, form)
    if (Object.keys(bookingErrs).length) { fail(Object.values(bookingErrs)[0]); return }

    let guestId = guest?.id
    if (isNewGuest) {
      const res = await makeGuest.mutateAsync({ ...newGuest })
      guestId = res.data.data?.id
    }
    if (!guestId) { fail('Failed to create guest'); return }

    book.mutate({
      ...form,
      guest_id:       guestId,
      adults:         parseInt(form.adults),
      children:       parseInt(form.children),
      decided_amount: form.decided_amount !== '' ? parseFloat(form.decided_amount) : null,
    })
  }

  return (
    <div className="space-y-4">
      {error && <div ref={errorRef} className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}

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
        </div>
      </div>

      {/* Step 3 — Payment */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-gray-800 mb-1 text-sm">3. Payment</h3>

        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            Decided Amount (₹)
            {decidedAmountTouched && roomCharges > 0 && (
              <button
                type="button"
                onClick={() => { setDecidedAmountTouched(false); setForm(f => ({ ...f, decided_amount: roomCharges.toFixed(2) })) }}
                className="ml-2 text-orange-500 hover:underline text-xs font-normal"
              >Reset to calculated</button>
            )}
          </label>
          <input
            type="number" step="0.01" min="0"
            value={form.decided_amount}
            onChange={e => { setDecidedAmountTouched(true); setForm(f => ({ ...f, decided_amount: e.target.value })) }}
            placeholder="Base room amount (before GST)"
            className={inp}
          />
          <p className="text-xs text-gray-400 mt-0.5">Pre-filled from base room charges. Edit to negotiate a different rate.</p>
          {nights > 0 && form.decided_amount !== '' && (() => {
            const dBase = parseFloat(form.decided_amount || 0)
            const dPerNight = nights > 0 ? dBase / nights : 0
            const dGst = hotelGstRate > 0
              ? (hotelGstIncl ? dBase * hotelGstRate / (100 + hotelGstRate) : dBase * hotelGstRate / 100)
              : 0
            const dTotal = hotelGstIncl ? dBase : dBase + dGst
            return (
              <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-blue-800 space-y-1">
                <div className="flex justify-between">
                  <span>{nights} night{nights > 1 ? 's' : ''} × ₹{dPerNight.toFixed(2)}</span>
                  <span>₹{dBase.toFixed(2)}</span>
                </div>
                {hotelGstRate > 0 && (
                  <div className="flex justify-between text-blue-600">
                    <span>GST ({hotelGstRate}%){hotelGstIncl ? ' incl.' : ''}</span>
                    <span>{hotelGstIncl ? '−' : '+'}₹{dGst.toFixed(2)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold border-t border-blue-200 pt-1">
                  <span>Total room charges</span>
                  <span>₹{dTotal.toFixed(2)}</span>
                </div>
              </div>
            )
          })()}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Advance Paid (₹)</label>
            <input type="number" step="0.01" min="0" value={form.advance_paid}
              onChange={e => {
                const dBase = parseFloat(form.decided_amount || 0)
                const dGst  = hotelGstRate > 0 && !hotelGstIncl ? dBase * hotelGstRate / 100 : 0
                const max   = dBase + dGst
                const val   = e.target.value
                if (max > 0 && parseFloat(val) > max) return
                setForm(f => ({ ...f, advance_paid: val }))
              }}
              placeholder="0" className={inp} />
            {(() => {
              const dBase = parseFloat(form.decided_amount || 0)
              const dGst  = hotelGstRate > 0 && !hotelGstIncl ? dBase * hotelGstRate / 100 : 0
              const max   = dBase + dGst
              return max > 0 ? <p className="text-xs text-gray-400 mt-0.5">Max ₹{max.toFixed(2)}</p> : null
            })()}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
            <select value={form.advance_payment_method} onChange={e => setForm(f => ({ ...f, advance_payment_method: e.target.value }))} className={inp}>
              <option value="cash">Cash</option>
              <option value="upi">UPI</option>
              <option value="card">Card</option>
            </select>
          </div>
        </div>

        {form.decided_amount && parseFloat(form.decided_amount) > 0 && (() => {
          const dBase2 = parseFloat(form.decided_amount)
          const dGst2 = hotelGstRate > 0 && !hotelGstIncl ? dBase2 * hotelGstRate / 100 : 0
          const dTotal2 = dBase2 + dGst2
          const balance = Math.max(0, dTotal2 - parseFloat(form.advance_paid || 0))
          return (
            <div className="bg-white border border-gray-200 rounded-lg px-3 py-2 text-xs text-gray-600 flex justify-between">
              <span>Balance due at check-out</span>
              <span className="font-semibold text-gray-900">₹{balance.toFixed(2)}</span>
            </div>
          )
        })()}

        <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} placeholder="Notes (optional)" className={inp} />
      </div>

      <button onClick={handleSubmit} disabled={book.isPending || makeGuest.isPending}
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
        {book.isPending ? 'Creating Booking…' : 'Create Booking'}
      </button>
    </div>
  )
}

export function CheckOutModal({ booking, onSuccess, svc }) {
  const qc = useQueryClient()
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [error, setError] = useState('')
  const [showExtend, setShowExtend] = useState(false)
  const [newCheckOut, setNewCheckOut] = useState('')
  const [showFoodDetail, setShowFoodDetail] = useState(false)
  const [checkedOut, setCheckedOut] = useState(false)
  const [printing, setPrinting] = useState(false)

  const { data: summary, isLoading: summaryLoading, refetch } = useQuery({
    queryKey: ['checkout-summary', booking.id],
    queryFn: () => (svc.getBookingCheckoutSummary ?? getBookingCheckoutSummary)(booking.id).then(r => r.data.data),
  })

  const checkout = useMutation({
    mutationFn: () => svc.checkOutBooking(booking.id, { payment_method: paymentMethod, extra_paid: Math.max(0, totalAmount - advancePaid) }),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => q.queryKey.includes('bookings') })
      qc.invalidateQueries({ predicate: q => q.queryKey.includes('rooms') })
      setCheckedOut(true)
    },
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const handlePrintBill = async () => {
    setPrinting(true)
    try {
      const billFn = svc.downloadBookingBill ?? downloadBookingBill
      const res = await billFn(booking.id, paymentMethod)
      const url = URL.createObjectURL(res.data)
      const win = window.open(url, '_blank', 'width=800,height=600')
      if (win) win.addEventListener('load', () => { try { win.focus(); win.print() } catch { /* ignore */ } })
    } finally {
      setPrinting(false)
    }
  }

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
  const byDate         = summary?.unbilled_orders_by_date ?? []
  const foodTotal      = parseFloat(summary?.unbilled_food_total ?? 0)
  const overdue        = isOverdue(b)

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
        <label className="block text-xs font-medium text-gray-600 mb-1">Payment Method</label>
        <div className="grid grid-cols-2 gap-2">
          {['cash', 'upi'].map(m => (
            <button key={m} type="button" onClick={() => setPaymentMethod(m)}
              className={`py-2 rounded-lg text-xs font-medium capitalize ${paymentMethod === m ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'}`}>
              {m === 'cash' ? '💵 Cash' : '📱 UPI'}
            </button>
          ))}
        </div>
      </div>
      {Math.max(0, totalAmount - advancePaid) > 0.01 && (
        paymentMethod === 'cash' ? (
          <div className="bg-green-50 border border-green-200 rounded-xl p-3 text-center">
            <p className="text-xs font-semibold text-green-700">Collect <span className="text-base">₹{Math.max(0, totalAmount - advancePaid).toFixed(0)}</span> in cash from guest</p>
          </div>
        ) : (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-3 text-center">
            <p className="text-xs font-semibold text-blue-700 mb-1">Show QR to guest for payment</p>
            <span className="font-mono bg-white border border-blue-200 px-3 py-1.5 rounded-lg text-sm text-blue-800">₹{Math.max(0, totalAmount - advancePaid).toFixed(0)}</span>
          </div>
        )
      )}
      {checkedOut ? (
        <div className="space-y-3">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <p className="text-base font-semibold text-green-700">✓ Checked out successfully</p>
            <p className="text-xs text-gray-500 mt-1">Room {booking.room?.number} is now available</p>
          </div>
          <div className="flex gap-2">
            <button onClick={handlePrintBill} disabled={printing}
              className="flex-1 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
              {printing ? 'Preparing…' : '🖨 Print Bill'}
            </button>
            <button onClick={() => onSuccess?.()}
              className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm">
              Close
            </button>
          </div>
        </div>
      ) : (
        <div className="flex gap-2">
          <button onClick={handlePrintBill} disabled={printing || summaryLoading}
            className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
            {printing ? 'Preparing…' : '🖨 Print Bill'}
          </button>
          <button onClick={() => checkout.mutate()} disabled={checkout.isPending || summaryLoading}
            className="flex-1 bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
            {checkout.isPending ? 'Processing…' : 'Confirm Check-out'}
          </button>
        </div>
      )}
    </div>
  )
}

const toDateValue = (v) => v ? v.toString().slice(0, 10) : ''

const EDIT_RULES_BASE = {
  guest_name:  [required('Full name')],
  guest_phone: [required('Phone'), isPhone()],
}
const EDIT_RULES_UPCOMING = {
  ...EDIT_RULES_BASE,
  room_id:        [required('Room')],
  check_in_date:  [required('Check-in date')],
  check_out_date: [required('Check-out date'), dateAfter('check_in_date', 'check-in', 'Check-out date')],
  adults:         [required('Adults'), minValue(1, 'Adults'), isInteger('Adults')],
}

function EditBookingForm({ booking, onSuccess, svc }) {
  const qc = useQueryClient()
  const isUpcoming = booking.status === 'upcoming'
  const RULES = isUpcoming ? EDIT_RULES_UPCOMING : EDIT_RULES_BASE

  const [form, setForm] = useState({
    guest_name:     booking.guest?.name  ?? '',
    guest_phone:    booking.guest?.phone ?? '',
    room_id:        booking.room_id ?? booking.room?.id ?? '',
    check_in_date:  toDateValue(booking.check_in_date),
    check_out_date: toDateValue(booking.check_out_date),
    adults:         booking.adults   ?? 1,
    children:       booking.children ?? 0,
    decided_amount: booking.decided_amount != null
      ? String(booking.decided_amount)
      : booking.computed_room_total != null
        ? String(parseFloat(booking.computed_room_total).toFixed(2))
        : '',
    notes:          booking.notes    ?? '',
  })
  const [decidedTouched, setDecidedTouched] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const [touched, setTouched] = useState({})
  const [apiError, setApiError] = useState('')
  const [submitCount, setSubmitCount] = useState(0)
  const formRef = useScrollToFirstError(fieldErrors, submitCount)

  const set = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    if (touched[k]) {
      const err = validateField(RULES, k, v, next)
      setFieldErrors(e => ({ ...e, [k]: err }))
      // re-validate check_out_date when check_in_date changes
      if (k === 'check_in_date' && touched.check_out_date) {
        setFieldErrors(e => ({ ...e, check_out_date: validateField(RULES, 'check_out_date', next.check_out_date, next) }))
      }
    }
  }

  const touch = (k) => {
    setTouched(t => ({ ...t, [k]: true }))
    const err = validateField(RULES, k, form[k], form)
    setFieldErrors(e => ({ ...e, [k]: err }))
  }

  const { data: rooms } = useQuery({
    queryKey: ['rooms-available', svc._prefix ?? 'owner'],
    queryFn: () => svc.getRooms().then(r => r.data.data),
    enabled: isUpcoming,
  })

  const availableRooms = rooms?.filter(r => r.status === 'available' || r.id === (booking.room_id ?? booking.room?.id)) ?? []

  const { data: ownerSettings } = useQuery({
    queryKey: ['owner-settings'],
    queryFn: () => getOwnerSettings().then(r => r.data.data),
  })

  const nights = form.check_in_date && form.check_out_date
    ? Math.max(0, (new Date(form.check_out_date) - new Date(form.check_in_date)) / 86400000)
    : 0
  const selectedRoom   = availableRooms.find(r => r.id === parseInt(form.room_id))
  const roomCharges    = (selectedRoom?.price_per_night ?? 0) * nights
  const editGstRate    = ownerSettings?.hotel_gst_rate ?? booking.gst_rate ?? 0
  const editGstIncl    = ownerSettings?.hotel_gst_inclusive ?? booking.gst_inclusive ?? false
  // Auto-fill decided_amount with base room charges (before GST) unless user has edited it
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (!decidedTouched && roomCharges > 0) {
      setForm(f => ({ ...f, decided_amount: roomCharges.toFixed(2) }))
    }
  }, [roomCharges, decidedTouched])
  /* eslint-enable react-hooks/set-state-in-effect */

  const mutation = useMutation({
    mutationFn: (data) => (svc.updateBooking ?? updateBooking)(booking.id, data),
    onSuccess: () => {
      qc.invalidateQueries({ predicate: q => q.queryKey.includes('bookings') })
      qc.invalidateQueries({ queryKey: ['booking', booking.id] })
      onSuccess?.()
    },
    onError: (err) => setApiError(err.response?.data?.message ?? 'Update failed'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    setApiError('')
    const errs = validate(RULES, form)
    if (Object.keys(errs).length) {
      setFieldErrors(errs)
      setTouched(Object.fromEntries(Object.keys(RULES).map(k => [k, true])))
      setSubmitCount(c => c + 1)
      return
    }
    const decidedVal = form.decided_amount !== '' ? parseFloat(form.decided_amount) : null
    mutation.mutate(isUpcoming
      ? { ...form, adults: parseInt(form.adults), children: parseInt(form.children), decided_amount: decidedVal }
      : { notes: form.notes, guest_name: form.guest_name, guest_phone: form.guest_phone, decided_amount: decidedVal }
    )
  }

  const inpCls = (field) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${fieldErrors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`

  const Err = (field) => fieldErrors[field]
    ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[field]}</p>
    : null

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {apiError && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{apiError}</div>}

      {/* Guest */}
      <div className="bg-gray-50 rounded-xl p-4 space-y-3">
        <h3 className="font-medium text-gray-800 text-sm">Guest</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
            <input
              value={form.guest_name}
              onChange={e => set('guest_name', e.target.value)}
              onBlur={() => touch('guest_name')}
              className={inpCls('guest_name')}
              placeholder="Guest name"
            />
            {Err('guest_name')}
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
            <input
              value={form.guest_phone}
              onChange={e => set('guest_phone', e.target.value)}
              onBlur={() => touch('guest_phone')}
              className={inpCls('guest_phone')}
              placeholder="Phone number"
            />
            {Err('guest_phone')}
          </div>
        </div>
      </div>

      {/* Room & Dates — upcoming only */}
      {isUpcoming && (
        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <h3 className="font-medium text-gray-800 text-sm">Room & Dates</h3>
          <div>
            <select
              value={form.room_id}
              onChange={e => set('room_id', e.target.value)}
              onBlur={() => touch('room_id')}
              className={inpCls('room_id')}
            >
              <option value="">Select room…</option>
              {availableRooms.map(r => (
                <option key={r.id} value={r.id}>{r.number} — {r.type} (Floor {r.floor}) — ₹{r.price_per_night}/night</option>
              ))}
            </select>
            {Err('room_id')}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-in *</label>
              <input
                type="date"
                value={form.check_in_date}
                onChange={e => set('check_in_date', e.target.value)}
                onBlur={() => touch('check_in_date')}
                className={inpCls('check_in_date')}
              />
              {Err('check_in_date')}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Check-out *</label>
              <input
                type="date"
                value={form.check_out_date}
                onChange={e => set('check_out_date', e.target.value)}
                onBlur={() => touch('check_out_date')}
                className={inpCls('check_out_date')}
              />
              {Err('check_out_date')}
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Adults *</label>
              <input
                type="number" min="1"
                value={form.adults}
                onChange={e => set('adults', e.target.value)}
                onBlur={() => touch('adults')}
                className={inpCls('adults')}
              />
              {Err('adults')}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Children</label>
              <input
                type="number" min="0"
                value={form.children}
                onChange={e => set('children', e.target.value)}
                className={inpCls('children')}
              />
            </div>
          </div>
        </div>
      )}

      {/* Decided Amount */}
      <div className="bg-gray-50 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">
          Decided Amount (₹)
          {decidedTouched && roomCharges > 0 && (
            <button
              type="button"
              onClick={() => { setDecidedTouched(false); setForm(f => ({ ...f, decided_amount: roomCharges.toFixed(2) })) }}
              className="ml-2 text-orange-500 hover:underline text-xs font-normal"
            >Reset to calculated</button>
          )}
        </label>
        <input
          type="number" step="0.01" min="0"
          value={form.decided_amount}
          onChange={e => { setDecidedTouched(true); setForm(f => ({ ...f, decided_amount: e.target.value })) }}
          placeholder="Base room amount (before GST)"
          className={inpCls('decided_amount')}
        />
        <p className="text-xs text-gray-400 mt-0.5">Pre-filled from base room charges. Edit to negotiate a different rate.</p>
        {nights > 0 && form.decided_amount !== '' && (() => {
          const dBase = parseFloat(form.decided_amount || 0)
          const dPerNight = nights > 0 ? dBase / nights : 0
          const dGst = editGstRate > 0
            ? (editGstIncl ? dBase * editGstRate / (100 + editGstRate) : dBase * editGstRate / 100)
            : 0
          const dTotal = editGstIncl ? dBase : dBase + dGst
          return (
            <div className="mt-2 bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 text-sm text-blue-800 space-y-1">
              <div className="flex justify-between">
                <span>{nights} night{nights > 1 ? 's' : ''} × ₹{dPerNight.toFixed(2)}</span>
                <span>₹{dBase.toFixed(2)}</span>
              </div>
              {editGstRate > 0 && (
                <div className="flex justify-between text-blue-600">
                  <span>GST ({editGstRate}%){editGstIncl ? ' incl.' : ''}</span>
                  <span>{editGstIncl ? '−' : '+'}₹{dGst.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between font-bold border-t border-blue-200 pt-1">
                <span>Total room charges</span>
                <span>₹{dTotal.toFixed(2)}</span>
              </div>
            </div>
          )
        })()}
      </div>

      {/* Notes */}
      <div className="bg-gray-50 rounded-xl p-4">
        <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
        <input
          value={form.notes}
          onChange={e => set('notes', e.target.value)}
          placeholder="Optional notes…"
          className={inpCls('notes')}
        />
        {!isUpcoming && (
          <p className="text-xs text-gray-400 mt-2">Room and dates cannot be changed after check-in.</p>
        )}
      </div>

      <button type="submit" disabled={mutation.isPending}
        className="w-full bg-orange-500 text-white py-3 rounded-xl font-semibold text-sm disabled:opacity-50">
        {mutation.isPending ? 'Saving…' : 'Save Changes'}
      </button>
    </form>
  )
}

function BookingRow({ booking, onCheckIn, onCheckOut, onCancel, onEdit, onView, onPrintBill }) {
  const overdue = isOverdue(booking)
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const checkInDate = new Date(booking.check_in_date); checkInDate.setHours(0, 0, 0, 0)
  const checkInReady = checkInDate <= today
  const [notePos, setNotePos] = useState(null)
  const noteRef = useRef(null)

  const toggleNote = (e) => {
    e.stopPropagation()
    if (notePos) { setNotePos(null); return }
    const rect = noteRef.current.getBoundingClientRect()
    setNotePos({ top: rect.bottom + 6, left: rect.left })
  }

  return (
    <tr className={`cursor-pointer transition-colors ${overdue ? 'bg-red-50/60 hover:bg-red-100/60' : 'hover:bg-gray-50/80'}`} onClick={() => onView(booking)}>
      <td className="px-5 py-4">
        <span className="font-mono text-xs text-gray-500">{booking.booking_number}</span>
        {booking.notes && (
          <span className="inline-flex items-center ml-1.5 align-middle" onClick={e => e.stopPropagation()}>
            <button
              ref={noteRef}
              type="button"
              onClick={toggleNote}
              className="text-amber-400 hover:text-amber-500 transition-colors"
            >
              <ChatBubbleBottomCenterTextIcon className="w-3.5 h-3.5" />
            </button>
            {notePos && (
              <div
                style={{ position: 'fixed', top: notePos.top, left: notePos.left, zIndex: 9999 }}
                className="w-56 bg-gray-900 text-white text-xs rounded-lg px-3 py-2 shadow-xl"
                onClick={e => e.stopPropagation()}
              >
                <p className="font-semibold text-amber-300 mb-1">Note</p>
                <p className="leading-relaxed whitespace-pre-wrap">{booking.notes}</p>
                <button onClick={() => setNotePos(null)} className="mt-2 text-gray-400 hover:text-white text-xs underline">close</button>
              </div>
            )}
          </span>
        )}
      </td>
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
              <button
                onClick={() => onCheckIn(booking)}
                disabled={!checkInReady}
                title={!checkInReady ? `Check-in available on ${new Date(booking.check_in_date).toLocaleDateString()}` : undefined}
                className="text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-green-50 text-green-700 hover:bg-green-100 disabled:hover:bg-green-50"
              >Check-in</button>
              <button onClick={() => onEdit(booking)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">Edit</button>
              <button onClick={() => onCancel(booking)} className="text-xs bg-red-50 text-red-500 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">Cancel</button>
            </>
          )}
          {booking.status === 'checked_in' && (
            <>
              <button onClick={() => onCheckOut(booking)} className={`text-xs px-2.5 py-1.5 rounded-lg font-medium transition-colors ${overdue ? 'bg-red-100 text-red-700 hover:bg-red-200' : 'bg-orange-50 text-orange-700 hover:bg-orange-100'}`}>
                Check-out
              </button>
              <button onClick={() => onEdit(booking)} className="text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">Edit</button>
              <button onClick={() => onPrintBill?.(booking)} className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors">🖨 Bill</button>
            </>
          )}
          {booking.status === 'checked_out' && (
            <button onClick={() => onPrintBill?.(booking)} className="text-xs bg-gray-100 text-gray-600 hover:bg-gray-200 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
              🖨 Bill
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
    updateBooking:              updateBooking,
    checkInBooking:             checkInBooking,
    checkOutBooking:            checkOutBooking,
    cancelBooking:              cancelBooking,
    getBooking:                 getBooking,
    getBookingCheckoutSummary:  getBookingCheckoutSummary,
    downloadBookingBill:        downloadBookingBill,
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

  const handlePrintBill = async (booking) => {
    try {
      const billFn = svc.downloadBookingBill ?? downloadBookingBill
      const res = await billFn(booking.id, booking.payment_method ?? 'cash')
      const url = URL.createObjectURL(res.data)
      const win = window.open(url, '_blank', 'width=800,height=600')
      if (win) win.addEventListener('load', () => { try { win.focus(); win.print() } catch { /* ignore */ } })
    } catch { /* ignore */ }
  }
  const [editTarget, setEditTarget] = useState(null)

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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Bookings</h2>
          <p className="text-sm text-gray-400 mt-0.5">{bookings.length} booking{bookings.length !== 1 ? 's' : ''} {status ? `· ${status.replace('_', ' ')}` : ''}</p>
        </div>
        <button onClick={() => setShowNew(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow self-start sm:self-auto">
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
                  onEdit={(bk) => setEditTarget(bk)}
                  onView={setViewBooking}
                  onPrintBill={handlePrintBill}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={showNew} onClose={() => setShowNew(false)} title="New Booking" size="md">
        <NewBookingForm svc={svc} onSuccess={() => setShowNew(false)} />
      </Modal>

      <Modal open={!!editTarget} onClose={() => setEditTarget(null)} title={`Edit Booking · ${editTarget?.booking_number}`} size="md">
        {editTarget && <EditBookingForm svc={svc} booking={editTarget} onSuccess={() => setEditTarget(null)} />}
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
            <div key={o.id} className="py-1.5 border-b border-gray-50">
              <div className="flex justify-between text-xs text-gray-700 font-medium mb-0.5">
                <span>{o.items?.map(i => `${i.quantity}× ${i.item_name}`).join(', ') || o.order_number}</span>
                <span>₹{o.total}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
