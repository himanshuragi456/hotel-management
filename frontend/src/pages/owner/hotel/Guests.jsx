import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getGuests, createGuest, updateGuest, getGuest } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'

const ID_TYPES = ['aadhaar', 'passport', 'driving_license', 'voter_id', 'pan']

function GuestForm({ guest, onSuccess }) {
  const isEdit = !!guest
  const [form, setForm] = useState({
    name: guest?.name ?? '',
    phone: guest?.phone ?? '',
    email: guest?.email ?? '',
    id_proof_type: guest?.id_proof_type ?? '',
    id_proof_number: guest?.id_proof_number ?? '',
    company: guest?.company ?? '',
    address: guest?.address ?? '',
    notes: guest?.notes ?? '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: isEdit ? (d) => updateGuest(guest.id, d) : createGuest,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); mutation.mutate(form) }} className="space-y-3">
      {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
          <input required value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ID Type</label>
          <select value={form.id_proof_type} onChange={e => setForm(f => ({ ...f, id_proof_type: e.target.value }))} className={inp}>
            <option value="">Select…</option>
            {ID_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.replace('_', ' ')}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ID Number</label>
          <input value={form.id_proof_number} onChange={e => setForm(f => ({ ...f, id_proof_number: e.target.value }))} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Company / Sponsor</label>
          <input value={form.company} onChange={e => setForm(f => ({ ...f, company: e.target.value }))} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
          <input value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} className={inp} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={mutation.isPending} className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Add Guest'}
        </button>
      </div>
    </form>
  )
}

function GuestDetail({ guestId, onNewBooking }) {
  const { data: guest, isLoading } = useQuery({
    queryKey: ['guest', guestId],
    queryFn: () => getGuest(guestId).then(r => r.data.data),
  })

  if (isLoading) return <div className="text-gray-400 text-sm p-4">Loading…</div>

  return (
    <div className="p-1">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 text-lg">{guest.name}</h3>
          <p className="text-sm text-gray-500">{guest.phone}{guest.email ? ` · ${guest.email}` : ''}</p>
        </div>
        <button onClick={onNewBooking} className="bg-orange-500 text-white text-sm px-4 py-1.5 rounded-lg font-medium">
          + New Booking
        </button>
      </div>
      {guest.company && <p className="text-sm text-gray-600 mb-1"><span className="font-medium">Company:</span> {guest.company}</p>}
      {guest.id_proof_type && <p className="text-sm text-gray-600 mb-3"><span className="font-medium capitalize">{guest.id_proof_type.replace('_', ' ')}:</span> {guest.id_proof_number}</p>}

      <h4 className="font-medium text-gray-800 mb-2 text-sm">Booking History</h4>
      {guest.bookings?.length === 0 ? (
        <p className="text-sm text-gray-400">No bookings yet</p>
      ) : (
        <div className="space-y-2">
          {guest.bookings?.map(b => (
            <div key={b.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2 text-sm">
              <span className="font-mono text-xs text-gray-500">{b.booking_number}</span>
              <span className="text-gray-700">Room {b.room?.number}</span>
              <span className="text-gray-500">{new Date(b.check_in_date).toLocaleDateString()}</span>
              <span className={`text-xs px-2 py-0.5 rounded-full capitalize ${
                b.status === 'checked_in' ? 'bg-green-100 text-green-700' :
                b.status === 'checked_out' ? 'bg-gray-100 text-gray-600' :
                b.status === 'cancelled' ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'
              }`}>{b.status.replace('_', ' ')}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

export default function Guests() {
  const qc = useQueryClient()
  const [q, setQ] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewGuest, setViewGuest] = useState(null)

  const { data: guestsPage } = useQuery({
    queryKey: ['guests', q],
    queryFn: () => getGuests({ q }).then(r => r.data.data),
  })

  const guests = guestsPage?.data ?? guestsPage ?? []

  return (
    <div className="max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Guests</h2>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
          + Add Guest
        </button>
      </div>

      <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or phone…"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm mb-4 focus:outline-none focus:ring-2 focus:ring-orange-400" />

      <div className="bg-white rounded-xl border overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Name</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Phone</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">ID Proof</th>
              <th className="text-left px-4 py-3 font-medium text-gray-600">Company</th>
              <th className="text-right px-4 py-3 font-medium text-gray-600">Stays</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {guests.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-10 text-gray-400">No guests found</td></tr>
            ) : guests.map(g => (
              <tr key={g.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => setViewGuest(g.id)}>
                <td className="px-4 py-3 font-medium text-gray-900">{g.name}</td>
                <td className="px-4 py-3 text-gray-600">{g.phone}</td>
                <td className="px-4 py-3 text-gray-500 capitalize">{g.id_proof_type?.replace('_', ' ') ?? '—'}</td>
                <td className="px-4 py-3 text-gray-500">{g.company ?? '—'}</td>
                <td className="px-4 py-3 text-right text-gray-600">{g.bookings_count ?? 0}</td>
                <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { setEditing(g); setShowForm(true) }} className="text-blue-500 text-xs hover:underline">Edit</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Guest' : 'Add Guest'}>
        <GuestForm guest={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['guests'] }) }} />
      </Modal>

      <Modal open={!!viewGuest} onClose={() => setViewGuest(null)} title="Guest Profile" size="md">
        {viewGuest && <GuestDetail guestId={viewGuest} onNewBooking={() => { setViewGuest(null) }} />}
      </Modal>
    </div>
  )
}
