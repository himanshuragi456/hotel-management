import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import Spinner from '@/components/shared/Spinner'
import { getLocations, createLocation, updateLocation, deleteLocation } from '@/services/superadminService'
import { MapPinIcon, PlusIcon, PencilIcon, TrashIcon, CheckCircleIcon, XCircleIcon } from '@heroicons/react/24/outline'

function LocationModal({ location, onClose, onSaved }) {
  const isEdit = !!location
  const [form, setForm] = useState({
    name:      location?.name      ?? '',
    city:      location?.city      ?? '',
    state:     location?.state     ?? '',
    country:   location?.country   ?? 'India',
    is_active: location?.is_active ?? true,
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: isEdit
      ? (data) => updateLocation(location.id, data)
      : createLocation,
    onSuccess: () => onSaved(),
    onError: (err) => setError(err.response?.data?.message ?? 'Failed to save'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  const handleSubmit = (e) => {
    e.preventDefault()
    if (!form.name.trim()) { setError('Name is required'); return }
    setError('')
    mutation.mutate(form)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
        <h2 className="text-base font-semibold text-gray-900 mb-5">
          {isEdit ? 'Edit Location' : 'Add Location'}
        </h2>
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
            <input value={form.name} onChange={e => set('name', e.target.value)} className={inp} placeholder="e.g. Banjara Hills" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
              <input value={form.city} onChange={e => set('city', e.target.value)} className={inp} placeholder="Hyderabad" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
              <input value={form.state} onChange={e => set('state', e.target.value)} className={inp} placeholder="Telangana" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Country</label>
            <input value={form.country} onChange={e => set('country', e.target.value)} className={inp} />
          </div>
          <label className="flex items-center gap-2 cursor-pointer select-none">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
            <span className="text-sm text-gray-700">Active (visible in Magic Tables)</span>
          </label>
          <div className="flex justify-end gap-2 pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-gray-600 bg-gray-100 rounded-lg hover:bg-gray-200">
              Cancel
            </button>
            <button type="submit" disabled={mutation.isPending}
              className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending && <Spinner size="w-4 h-4" />}
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Add Location'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default function LocationList() {
  const qc = useQueryClient()
  const [modal, setModal] = useState(null) // null | 'new' | location-object
  const [deleting, setDeleting] = useState(null)

  const { data: locations = [], isLoading } = useQuery({
    queryKey: ['locations'],
    queryFn: () => getLocations().then(r => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteLocation,
    onSuccess: () => { setDeleting(null); qc.invalidateQueries(['locations']) },
  })

  const handleSaved = () => {
    setModal(null)
    qc.invalidateQueries(['locations'])
  }

  return (
    <div className="max-w-3xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Locations</h1>
          <p className="text-sm text-gray-500 mt-0.5">Manage areas for Magic Tables restaurant filtering</p>
        </div>
        <button onClick={() => setModal('new')}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-700">
          <PlusIcon className="w-4 h-4" />
          Add Location
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : locations.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200">
          <MapPinIcon className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">No locations yet</p>
          <p className="text-sm text-gray-400 mt-1">Add locations so tenants can be assigned to them</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Name</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">City / State</th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                <th className="px-5 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {locations.map(loc => (
                <tr key={loc.id} className="hover:bg-gray-50">
                  <td className="px-5 py-3.5 font-medium text-gray-900">{loc.name}</td>
                  <td className="px-5 py-3.5 text-gray-500">
                    {[loc.city, loc.state].filter(Boolean).join(', ') || '—'}
                  </td>
                  <td className="px-5 py-3.5">
                    {loc.is_active ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 px-2 py-0.5 rounded-full">
                        <CheckCircleIcon className="w-3.5 h-3.5" /> Active
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                        <XCircleIcon className="w-3.5 h-3.5" /> Inactive
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-3.5">
                    <div className="flex items-center justify-end gap-2">
                      <button onClick={() => setModal(loc)} className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50">
                        <PencilIcon className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleting(loc)} className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50">
                        <TrashIcon className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal && (
        <LocationModal
          location={modal === 'new' ? null : modal}
          onClose={() => setModal(null)}
          onSaved={handleSaved}
        />
      )}

      {deleting && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
            <h3 className="font-semibold text-gray-900 mb-2">Delete location?</h3>
            <p className="text-sm text-gray-500 mb-5">
              <span className="font-medium text-gray-800">{deleting.name}</span> will be removed from all tenants.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setDeleting(null)} className="flex-1 py-2.5 rounded-xl text-sm font-medium text-gray-700 bg-gray-100 hover:bg-gray-200">
                Cancel
              </button>
              <button onClick={() => deleteMutation.mutate(deleting.id)} disabled={deleteMutation.isPending}
                className="inline-flex items-center justify-center gap-2 flex-1 py-2.5 rounded-xl text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50">
                {deleteMutation.isPending && <Spinner size="w-4 h-4" />}
                {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
