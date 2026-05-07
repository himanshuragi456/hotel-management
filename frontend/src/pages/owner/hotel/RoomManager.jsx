import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getRooms, createRoom, updateRoom, deleteRoom } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'

const ROOM_TYPES = ['single', 'double', 'triple', 'suite', 'deluxe']
const STATUS_COLORS = {
  available:   'border-green-400 bg-green-50',
  occupied:    'border-orange-400 bg-orange-50',
  cleaning:    'border-yellow-400 bg-yellow-50',
  maintenance: 'border-red-400 bg-red-50',
}
const STATUS_TEXT = {
  available:   'text-green-700',
  occupied:    'text-orange-700',
  cleaning:    'text-yellow-700',
  maintenance: 'text-red-700',
}
const TYPE_ICONS = { single: '🛏', double: '🛏🛏', triple: '🛏🛏🛏', suite: '🏨', deluxe: '✨' }

function RoomCard({ room, onEdit, onDelete }) {
  return (
    <div className={`rounded-xl border-2 p-4 relative ${STATUS_COLORS[room.status]}`}>
      <div className="flex items-start justify-between mb-1">
        <div>
          <span className="text-2xl font-bold text-gray-900">{room.number}</span>
          <span className="ml-2 text-sm text-gray-500">Floor {room.floor}</span>
        </div>
        <span className="text-lg">{TYPE_ICONS[room.type]}</span>
      </div>
      <div className="text-xs text-gray-500 capitalize mb-1">{room.type}</div>
      <div className={`text-xs font-semibold capitalize mb-2 ${STATUS_TEXT[room.status]}`}>
        {room.status}{room.status === 'occupied' && room.occupied_minutes ? ` · ${room.occupied_minutes}m` : ''}
      </div>
      {room.status === 'occupied' && room.active_booking && (
        <div className="text-xs text-gray-600 mb-2">
          {room.active_booking.guest?.name}
          {room.active_booking.check_out_date && ` · out ${new Date(room.active_booking.check_out_date).toLocaleDateString()}`}
        </div>
      )}
      <div className="text-sm font-semibold text-gray-900">₹{room.price_per_night}/night</div>
      {room.amenities?.length > 0 && (
        <div className="text-xs text-gray-400 mt-1 truncate">{room.amenities.join(', ')}</div>
      )}
      <div className="absolute top-2 right-2 flex gap-1">
        <button onClick={() => onEdit(room)} className="text-blue-400 hover:text-blue-600 text-xs">✎</button>
        <button onClick={() => onDelete(room)} className="text-red-400 hover:text-red-500 text-xs">✕</button>
      </div>
    </div>
  )
}

function RoomForm({ room, onSuccess }) {
  const isEdit = !!room
  const [form, setForm] = useState({
    number: room?.number ?? '',
    type: room?.type ?? 'single',
    floor: room?.floor ?? 1,
    capacity: room?.capacity ?? 1,
    price_per_night: room?.price_per_night ?? '',
    amenities: room?.amenities?.join(', ') ?? '',
    description: room?.description ?? '',
    status: room?.status ?? 'available',
  })
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: isEdit ? (d) => updateRoom(room.id, d) : createRoom,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  const handleSubmit = (e) => {
    e.preventDefault(); setError('')
    mutation.mutate({
      ...form,
      amenities: form.amenities ? form.amenities.split(',').map(a => a.trim()).filter(Boolean) : [],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Room Number *</label>
          <input required value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} className={inp} placeholder="101, A-202…" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Floor</label>
          <input type="number" min="0" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type *</label>
          <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
            {ROOM_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label>
          <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Price / Night (₹) *</label>
          <input required type="number" step="0.01" min="0" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))} className={inp} />
        </div>
        {isEdit && (
          <div className="col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
              <option value="available">Available</option>
              <option value="cleaning">Cleaning</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Amenities (comma-separated)</label>
          <input value={form.amenities} onChange={e => setForm(f => ({ ...f, amenities: e.target.value }))} className={inp} placeholder="AC, TV, WiFi, Bathtub…" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={mutation.isPending} className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Room'}
        </button>
      </div>
    </form>
  )
}

export default function RoomManager() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [filterStatus, setFilterStatus] = useState('')

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => getRooms().then(r => r.data.data),
    refetchInterval: 20000,
  })

  const del = useMutation({
    mutationFn: deleteRoom,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['rooms'] }),
  })

  const counts = rooms?.reduce((acc, r) => { acc[r.status] = (acc[r.status] || 0) + 1; return acc }, {}) ?? {}
  const filtered = filterStatus ? rooms?.filter(r => r.status === filterStatus) : rooms

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Rooms</h2>
          <p className="text-sm text-gray-400">
            {counts.available ?? 0} available · {counts.occupied ?? 0} occupied · {counts.cleaning ?? 0} cleaning · {counts.maintenance ?? 0} maintenance
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
          + Add Room
        </button>
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-4">
        {['', 'available', 'occupied', 'cleaning', 'maintenance'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium capitalize ${filterStatus === s ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            {s || 'All'} {s && counts[s] !== undefined ? `(${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? <div className="text-gray-400">Loading…</div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered?.map(room => (
            <RoomCard key={room.id} room={room}
              onEdit={(r) => { setEditing(r); setShowForm(true) }}
              onDelete={(r) => confirm(`Delete room ${r.number}?`) && del.mutate(r.id)} />
          ))}
          {filtered?.length === 0 && <div className="col-span-full text-center py-12 text-gray-400">No rooms found</div>}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Room' : 'Add Room'} size="sm">
        <RoomForm room={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['rooms'] }) }} />
      </Modal>
    </div>
  )
}
