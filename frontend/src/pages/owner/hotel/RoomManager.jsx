import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, BuildingOfficeIcon,
  UserGroupIcon, BanknotesIcon, WrenchScrewdriverIcon,
} from '@heroicons/react/24/outline'
import { getRooms, createRoom, updateRoom, deleteRoom } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import { formatOccupied } from '@/utils/time'

const ROOM_TYPES = ['single', 'double', 'triple', 'suite', 'deluxe']

const STATUS_CONFIG = {
  available:   { border: 'border-green-300',  bg: 'bg-green-50',   dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700',   label: 'Available'   },
  occupied:    { border: 'border-blue-400',   bg: 'bg-blue-50',    dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',     label: 'Occupied'    },
  cleaning:    { border: 'border-yellow-400', bg: 'bg-yellow-50',  dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700', label: 'Cleaning'    },
  maintenance: { border: 'border-red-400',    bg: 'bg-red-50',     dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Maintenance' },
}

function RoomCard({ room, onEdit, onDelete }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.available

  return (
    <div className={`rounded-2xl border-2 p-4 relative transition-all hover:shadow-md ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-2xl font-bold text-gray-900">{room.number}</div>
          <div className="text-xs text-gray-500 capitalize">{room.type} · Floor {room.floor}</div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onEdit(room)}
            className="w-7 h-7 rounded-lg hover:bg-white/60 flex items-center justify-center transition-colors">
            <PencilSquareIcon className="w-4 h-4 text-blue-500" />
          </button>
          <button onClick={() => onDelete(room)}
            className="w-7 h-7 rounded-lg hover:bg-white/60 flex items-center justify-center transition-colors">
            <TrashIcon className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      <div className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2 py-0.5 rounded-full mb-2 ${cfg.badge}`}>
        <div className={`w-1.5 h-1.5 rounded-full ${cfg.dot} ${room.status === 'occupied' ? 'animate-pulse' : ''}`} />
        {cfg.label}
        {room.status === 'occupied' && room.occupied_minutes ? ` · ${formatOccupied(room.occupied_minutes)}` : ''}
      </div>

      {room.status === 'occupied' && room.active_booking && (
        <div className="text-xs text-gray-600 mb-2 font-medium">
          {room.active_booking.guest?.name}
          {room.active_booking.check_out_date && (
            <span className="text-gray-400 font-normal"> · out {new Date(room.active_booking.check_out_date).toLocaleDateString()}</span>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mt-1">
        <div className="flex items-center gap-1 text-xs text-gray-500">
          <UserGroupIcon className="w-3.5 h-3.5" />
          {room.capacity} guests
        </div>
        <div className="flex items-center gap-1 text-sm font-bold text-gray-900">
          <BanknotesIcon className="w-3.5 h-3.5 text-gray-400" />
          ₹{room.price_per_night}/night
        </div>
      </div>

      {room.amenities?.length > 0 && (
        <div className="text-xs text-gray-400 mt-1.5 truncate">{room.amenities.join(', ')}</div>
      )}
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
  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50'

  const handleSubmit = (e) => {
    e.preventDefault(); setError('')
    mutation.mutate({
      ...form,
      amenities: form.amenities ? form.amenities.split(',').map(a => a.trim()).filter(Boolean) : [],
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Room Number *</label>
          <input required value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} className={inp} placeholder="101, A-202…" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Floor</label>
          <input type="number" min="0" value={form.floor} onChange={e => setForm(f => ({ ...f, floor: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type *</label>
          <select required value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
            {ROOM_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Capacity</label>
          <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Price / Night (₹) *</label>
          <input required type="number" step="0.01" min="0" value={form.price_per_night} onChange={e => setForm(f => ({ ...f, price_per_night: e.target.value }))} className={inp} />
        </div>
        {isEdit && (
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            <select value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className={inp}>
              <option value="available">Available</option>
              <option value="cleaning">Cleaning</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amenities (comma-separated)</label>
          <input value={form.amenities} onChange={e => setForm(f => ({ ...f, amenities: e.target.value }))} className={inp} placeholder="AC, TV, WiFi, Bathtub…" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} placeholder="Optional room description" />
        </div>
      </div>
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={mutation.isPending}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow">
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

  const STAT_CHIPS = [
    { key: 'available',   label: 'Available',   color: 'bg-green-100 text-green-700'   },
    { key: 'occupied',    label: 'Occupied',    color: 'bg-blue-100 text-blue-700'     },
    { key: 'cleaning',    label: 'Cleaning',    color: 'bg-yellow-100 text-yellow-700' },
    { key: 'maintenance', label: 'Maintenance', color: 'bg-red-100 text-red-700'       },
  ]

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Rooms</h2>
          <p className="text-sm text-gray-400 mt-0.5">{rooms?.length ?? 0} rooms total</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow">
          <PlusIcon className="w-4 h-4" />
          Add Room
        </button>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
        {STAT_CHIPS.map(({ key, label, color }) => (
          <div key={key} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
            <p className="text-2xl font-bold text-gray-900">{counts[key] ?? 0}</p>
            <p className={`text-xs font-semibold mt-1 px-2 py-0.5 rounded-full inline-block ${color}`}>{label}</p>
          </div>
        ))}
      </div>

      {/* Status filter */}
      <div className="flex gap-2 mb-5 overflow-x-auto pb-1">
        {['', 'available', 'occupied', 'cleaning', 'maintenance'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)}
            className={`shrink-0 px-3 py-1.5 rounded-xl text-xs font-semibold capitalize transition-colors ${filterStatus === s ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
            {s || 'All'} {s && counts[s] !== undefined ? `(${counts[s]})` : ''}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="h-36 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : !filtered?.length ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200">
          <BuildingOfficeIcon className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium mb-1">No rooms found</p>
          {!filterStatus && (
            <button onClick={() => setShowForm(true)} className="mt-3 bg-orange-500 text-white px-5 py-2 rounded-xl text-sm font-semibold">
              Add Room
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {filtered.map(room => (
            <RoomCard key={room.id} room={room}
              onEdit={(r) => { setEditing(r); setShowForm(true) }}
              onDelete={(r) => confirm(`Delete room ${r.number}?`) && del.mutate(r.id)} />
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Room' : 'Add Room'} size="sm">
        <RoomForm room={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['rooms'] }) }} />
      </Modal>
    </div>
  )
}
