import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useDebounce } from '@/hooks/useDebounce'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
  PlusIcon, MagnifyingGlassIcon, PencilSquareIcon, UsersIcon,
} from '@heroicons/react/24/outline'
import { getGuests, createGuest, updateGuest, getGuest } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import Spinner from '@/components/shared/Spinner'
import { validate, validateField, required, isEmail, isPhone, requiredIfOtherSet } from '@/utils/validate'

const ID_TYPES = ['aadhaar', 'passport', 'driving_license', 'voter_id', 'pan']

const RULES = {
  name:            [required('Full name')],
  phone:           [required('Phone'), isPhone()],
  email:           [isEmail()],
  id_proof_number: [requiredIfOtherSet('id_proof_type', 'ID number')],
}

function GuestForm({ guest, onSuccess }) {
  const isEdit = !!guest
  const [form, setForm] = useState({
    name:            guest?.name            ?? '',
    phone:           guest?.phone           ?? '',
    email:           guest?.email           ?? '',
    id_proof_type:   guest?.id_proof_type   ?? '',
    id_proof_number: guest?.id_proof_number ?? '',
    company:         guest?.company         ?? '',
    address:         guest?.address         ?? '',
    notes:           guest?.notes           ?? '',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const formRef = useScrollToFirstError(fieldErrors)

  const set = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    const err = validateField(RULES, k, v, next)
    setFieldErrors(e => ({ ...e, [k]: err }))
    // Re-check id_proof_number when id_proof_type changes
    if (k === 'id_proof_type') {
      const numErr = validateField(RULES, 'id_proof_number', next.id_proof_number, next)
      setFieldErrors(e => ({ ...e, id_proof_number: numErr }))
    }
  }

  const blur = (field) => {
    const err = validateField(RULES, field, form[field], form)
    if (err !== undefined) setFieldErrors(e => ({ ...e, [field]: err }))
  }

  const mutation = useMutation({
    mutationFn: isEdit ? (d) => updateGuest(guest.id, d) : createGuest,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate(RULES, form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setError('')
    setFieldErrors({})
    mutation.mutate({ ...form, name: form.name.trim(), phone: form.phone.trim() })
  }

  const inp = (field) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${fieldErrors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`

  const Err = (field) => fieldErrors[field]
    ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[field]}</p>
    : null

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Full Name *</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            onBlur={() => blur('name')}
            className={inp('name')}
            placeholder="e.g. Rahul Sharma"
          />
          {Err('name')}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Phone *</label>
          <input
            type="tel"
            inputMode="numeric"
            maxLength={10}
            value={form.phone}
            onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
            onBlur={() => blur('phone')}
            className={inp('phone')}
            placeholder="10-digit mobile number"
          />
          {Err('phone')}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Email</label>
          <input
            type="email"
            value={form.email}
            onChange={e => set('email', e.target.value)}
            onBlur={() => blur('email')}
            className={inp('email')}
            placeholder="guest@example.com"
          />
          {Err('email')}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">ID Type</label>
          <select
            value={form.id_proof_type}
            onChange={e => set('id_proof_type', e.target.value)}
            className={inp('id_proof_type')}
          >
            <option value="">Select…</option>
            {ID_TYPES.map(t => (
              <option key={t} value={t} className="capitalize">
                {t.replace(/_/g, ' ')}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">
            ID Number {form.id_proof_type && <span className="text-red-500">*</span>}
          </label>
          <input
            value={form.id_proof_number}
            onChange={e => set('id_proof_number', e.target.value)}
            onBlur={() => blur('id_proof_number')}
            className={inp('id_proof_number')}
            placeholder={form.id_proof_type ? 'Enter ID number' : '—'}
            disabled={!form.id_proof_type}
          />
          {Err('id_proof_number')}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Company / Sponsor</label>
          <input value={form.company} onChange={e => set('company', e.target.value)} className={inp('company')} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Address</label>
          <input value={form.address} onChange={e => set('address', e.target.value)} className={inp('address')} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
          <input value={form.notes} onChange={e => set('notes', e.target.value)} className={inp('notes')} />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={mutation.isPending} className="inline-flex items-center justify-center gap-2 bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {mutation.isPending && <Spinner size="w-4 h-4" />}
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

  if (isLoading) return (
    <div className="p-1 space-y-3 animate-pulse">
      <div className="h-6 w-40 bg-gray-100 rounded" />
      <div className="h-4 w-56 bg-gray-100 rounded" />
      <div className="h-4 w-32 bg-gray-100 rounded mt-4" />
      {[1,2].map(i => <div key={i} className="h-10 bg-gray-100 rounded-lg" />)}
    </div>
  )

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
      {guest.id_proof_type && <p className="text-sm text-gray-600 mb-3"><span className="font-medium capitalize">{guest.id_proof_type.replace(/_/g, ' ')}:</span> {guest.id_proof_number}</p>}

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
                b.status === 'checked_in'  ? 'bg-green-100 text-green-700' :
                b.status === 'checked_out' ? 'bg-gray-100 text-gray-600' :
                b.status === 'cancelled'   ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-700'
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
  const debouncedQ = useDebounce(q, 350)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [viewGuest, setViewGuest] = useState(null)

  const { data: guestsPage, isLoading } = useQuery({
    queryKey: ['guests', debouncedQ],
    queryFn: () => getGuests({ q: debouncedQ }).then(r => r.data.data),
  })

  const guests = guestsPage?.data ?? guestsPage ?? []

  return (
    <div className="max-w-4xl">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Guests</h2>
          <p className="text-sm text-gray-400 mt-0.5">{guests.length} registered guests</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow self-start sm:self-auto">
          <PlusIcon className="w-4 h-4" />Add Guest
        </button>
      </div>

      <div className="relative mb-5">
        <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search by name or phone…"
          className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white" />
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[560px]">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60">
                {['Name', 'Phone', 'ID Proof', 'Company', 'Stays', ''].map(h => (
                  <th key={h} className={`${h === 'Stays' ? 'text-right' : 'text-left'} px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {isLoading && [1,2,3,4].map(i => (
                <tr key={i}>
                  <td className="px-5 py-4"><div className="flex items-center gap-2.5"><div className="w-8 h-8 bg-gray-100 rounded-xl animate-pulse shrink-0" /><div className="w-28 h-4 bg-gray-100 rounded animate-pulse" /></div></td>
                  <td className="px-5 py-4"><div className="w-24 h-4 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="w-20 h-4 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-5 py-4"><div className="w-24 h-4 bg-gray-100 rounded animate-pulse" /></td>
                  <td className="px-5 py-4 text-right"><div className="w-8 h-5 bg-gray-100 rounded-full animate-pulse ml-auto" /></td>
                  <td className="px-5 py-4"><div className="w-14 h-7 bg-gray-100 rounded-lg animate-pulse" /></td>
                </tr>
              ))}
              {!isLoading && guests.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-center py-16">
                    <UsersIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-gray-400 font-medium">No guests found</p>
                  </td>
                </tr>
              ) : guests.map(g => (
                <tr key={g.id} className="hover:bg-gray-50/80 transition-colors cursor-pointer" onClick={() => setViewGuest(g.id)}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center font-bold text-white text-xs shrink-0">
                        {g.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-gray-900">{g.name}</span>
                    </div>
                  </td>
                  <td className="px-5 py-4 text-gray-600 text-sm">{g.phone}</td>
                  <td className="px-5 py-4 text-gray-500 text-xs capitalize">{g.id_proof_type?.replace(/_/g, ' ') ?? '—'}</td>
                  <td className="px-5 py-4 text-gray-500 text-sm">{g.company ?? '—'}</td>
                  <td className="px-5 py-4 text-right">
                    <span className="text-xs font-bold bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">{g.bookings_count ?? 0}</span>
                  </td>
                  <td className="px-5 py-4" onClick={e => e.stopPropagation()}>
                    <button onClick={() => { setEditing(g); setShowForm(true) }}
                      className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                      <PencilSquareIcon className="w-3.5 h-3.5" />Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
