import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, BuildingOfficeIcon,
  UserGroupIcon, BanknotesIcon, QrCodeIcon,
  ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import { getRooms, createRoom, updateRoom, deleteRoom, getRoomQr } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import { formatOccupied } from '@/utils/time'
import { validate, validateField, required, isPositive, isNonNeg, minValue, isInteger } from '@/utils/validate'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const ROOM_TYPES = ['single', 'double', 'triple', 'suite', 'deluxe']

const STATUS_CONFIG = {
  available:   { border: 'border-green-300',  bg: 'bg-green-50',   dot: 'bg-green-500',  badge: 'bg-green-100 text-green-700',   label: 'Available'   },
  occupied:    { border: 'border-blue-400',   bg: 'bg-blue-50',    dot: 'bg-blue-500',   badge: 'bg-blue-100 text-blue-700',     label: 'Occupied'    },
  cleaning:    { border: 'border-yellow-400', bg: 'bg-yellow-50',  dot: 'bg-yellow-500', badge: 'bg-yellow-100 text-yellow-700', label: 'Cleaning'    },
  maintenance: { border: 'border-red-400',    bg: 'bg-red-50',     dot: 'bg-red-500',    badge: 'bg-red-100 text-red-700',       label: 'Maintenance' },
}

function RoomCard({ room, onEdit, onDelete, onQr }) {
  const cfg = STATUS_CONFIG[room.status] ?? STATUS_CONFIG.available

  return (
    <div className={`rounded-2xl border-2 p-4 relative transition-all hover:shadow-md ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-2xl font-bold text-gray-900">{room.number}</div>
          <div className="text-xs text-gray-500 capitalize">{room.type} · Floor {room.floor}</div>
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onQr(room)} title="Room Service QR"
            className="w-7 h-7 rounded-lg hover:bg-white/60 flex items-center justify-center transition-colors">
            <QrCodeIcon className="w-4 h-4 text-gray-500" />
          </button>
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

const ROOM_RULES = {
  number:          [required('Room number')],
  type:            [required('Room type')],
  floor:           [isNonNeg('Floor'), isInteger('Floor')],
  capacity:        [required('Capacity'), minValue(1, 'Capacity'), isInteger('Capacity')],
  price_per_night: [required('Price per night'), isPositive('Price per night')],
}

function RoomForm({ room, onSuccess }) {
  const isEdit = !!room
  const [form, setForm] = useState({
    number:          room?.number          ?? '',
    type:            room?.type            ?? 'single',
    floor:           room?.floor           ?? 1,
    capacity:        room?.capacity        ?? 1,
    price_per_night: room?.price_per_night ?? '',
    amenities:       room?.amenities?.join(', ') ?? '',
    description:     room?.description    ?? '',
    status:          room?.status         ?? 'available',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const formRef = useScrollToFirstError(fieldErrors)

  const set = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    const err = validateField(ROOM_RULES, k, v, next)
    setFieldErrors(e => ({ ...e, [k]: err }))
  }

  const blur = (field) => {
    const err = validateField(ROOM_RULES, field, form[field], form)
    if (err !== undefined) setFieldErrors(e => ({ ...e, [field]: err }))
  }

  const mutation = useMutation({
    mutationFn: isEdit ? (d) => updateRoom(room.id, d) : createRoom,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const inp = (field) =>
    `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 transition-colors ${fieldErrors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`

  const Err = (field) => fieldErrors[field]
    ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[field]}</p>
    : null

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate(ROOM_RULES, form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setError('')
    setFieldErrors({})
    mutation.mutate({
      ...form,
      amenities: form.amenities ? form.amenities.split(',').map(a => a.trim()).filter(Boolean) : [],
    })
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Room Number *</label>
          <input
            value={form.number}
            onChange={e => set('number', e.target.value)}
            onBlur={() => blur('number')}
            className={inp('number')}
            placeholder="101, A-202…"
          />
          {Err('number')}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Floor</label>
          <input
            type="number"
            min="0"
            value={form.floor}
            onChange={e => set('floor', e.target.value)}
            onBlur={() => blur('floor')}
            className={inp('floor')}
          />
          {Err('floor')}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type *</label>
          <select value={form.type} onChange={e => set('type', e.target.value)} className={inp('type')}>
            {ROOM_TYPES.map(t => <option key={t} value={t} className="capitalize">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
          </select>
          {Err('type')}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Capacity *</label>
          <input
            type="number"
            min="1"
            value={form.capacity}
            onChange={e => set('capacity', e.target.value)}
            onBlur={() => blur('capacity')}
            className={inp('capacity')}
          />
          {Err('capacity')}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Price / Night (₹) *</label>
          <input
            type="number"
            step="0.01"
            min="0.01"
            value={form.price_per_night}
            onChange={e => set('price_per_night', e.target.value)}
            onBlur={() => blur('price_per_night')}
            className={inp('price_per_night')}
            placeholder="0.00"
          />
          {Err('price_per_night')}
        </div>
        {isEdit && (
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inp('status')}>
              <option value="available">Available</option>
              <option value="cleaning">Cleaning</option>
              <option value="maintenance">Maintenance</option>
            </select>
          </div>
        )}
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Amenities <span className="text-gray-400 font-normal normal-case">(comma-separated)</span></label>
          <input value={form.amenities} onChange={e => set('amenities', e.target.value)} className={inp('amenities')} placeholder="AC, TV, WiFi, Bathtub…" />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} className={inp('description')} placeholder="Optional room description" />
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
  const [deleteTarget, setDeleteTarget] = useState(null)
  const [qrData, setQrData] = useState(null) // { svgUrl, room }

  const handleQr = async (room) => {
    const res = await getRoomQr(room.id)
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(res.data)
    setQrData({ svgUrl, room })
  }

  const { data: rooms, isLoading } = useQuery({
    queryKey: ['rooms'],
    queryFn: () => getRooms().then(r => r.data.data),
    refetchInterval: 20000,
  })

  const del = useMutation({
    mutationFn: deleteRoom,
    onSuccess: (_, id) => {
      qc.setQueryData(['rooms'], (old) => old ? old.filter(r => r.id !== id) : old)
      qc.invalidateQueries({ queryKey: ['rooms'] })
      setDeleteTarget(null)
    },
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Rooms</h2>
          <p className="text-sm text-gray-400 mt-0.5">{rooms?.length ?? 0} rooms total</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow self-start sm:self-auto">
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
              onDelete={(r) => setDeleteTarget(r)}
              onQr={handleQr} />
          ))}
        </div>
      )}

      <Modal open={!!qrData} onClose={() => setQrData(null)} title={`Room ${qrData?.room?.number} — QR Code`} size="sm">
        {qrData && (
          <div className="text-center">
            <div className="bg-gray-50 rounded-2xl p-6 mb-4 inline-block">
              <img src={qrData.svgUrl} className="mx-auto w-48 h-48" />
            </div>
            <p className="text-xs text-gray-500 mb-4">Guests scan this to order room service from their room</p>
            <div className="flex gap-2 justify-center">
              <a href={qrData.svgUrl} download={`room-${qrData.room.number}-qr.svg`}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow">
                <QrCodeIcon className="w-4 h-4" />
                Download QR
              </a>
              {qrData.room.menu_url && (
                <a href={qrData.room.menu_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  Open Menu
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Room' : 'Add Room'} size="sm">
        <RoomForm room={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['rooms'] }) }} />
      </Modal>

      {deleteTarget?.status === 'occupied' ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm p-6">
            <h2 className="text-sm font-semibold text-gray-900 mb-2">Room is Occupied</h2>
            <p className="text-sm text-gray-500 mb-4">Room {deleteTarget?.number} is currently occupied. Check out the guest before deleting.</p>
            <button onClick={() => setDeleteTarget(null)} className="w-full px-4 py-2 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-xl">
              OK
            </button>
          </div>
        </div>
      ) : (
        <ConfirmDialog
          open={!!deleteTarget}
          title={`Delete Room ${deleteTarget?.number}?`}
          message="This will permanently delete the room. This cannot be undone."
          confirmLabel={del.isPending ? 'Deleting…' : 'Delete'}
          confirmClass="bg-red-500 hover:bg-red-600 text-white"
          onConfirm={() => del.mutate(deleteTarget?.id)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  )
}
