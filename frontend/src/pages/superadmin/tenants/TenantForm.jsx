import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createTenant, updateTenant } from '@/services/superadminService'

export default function TenantForm({ tenant, onSuccess }) {
  const isEdit = !!tenant
  const [form, setForm] = useState({
    name:     tenant?.name     ?? '',
    email:    tenant?.email    ?? '',
    phone:    tenant?.phone    ?? '',
    city:     tenant?.city     ?? '',
    state:    tenant?.state    ?? '',
    gstin:    tenant?.gstin    ?? '',
    gst_rate: tenant?.gst_rate ?? 5,
    status:   tenant?.status   ?? 'trial',
    modules: {
      restaurant: tenant?.modules?.restaurant ?? false,
      hotel:      tenant?.modules?.hotel      ?? false,
      feedback:   tenant?.modules?.feedback   ?? false,
    },
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: isEdit
      ? (data) => updateTenant(tenant.id, data)
      : createTenant,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Failed to save'),
  })

  const set = (field, value) => setForm(f => ({ ...f, [field]: value }))
  const setModule = (mod, val) => setForm(f => ({ ...f, modules: { ...f.modules, [mod]: val } }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    mutation.mutate(form)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Restaurant Name *</label>
          <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
          <input required type="email" value={form.email} onChange={e => set('email', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
          <input value={form.city} onChange={e => set('city', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
          <input value={form.state} onChange={e => set('state', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">GSTIN</label>
          <input value={form.gstin} onChange={e => set('gstin', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">GST Rate (%)</label>
          <input type="number" step="0.5" value={form.gst_rate} onChange={e => set('gst_rate', e.target.value)} className={inputCls} />
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inputCls}>
              <option value="trial">Trial</option>
              <option value="active">Active</option>
              <option value="suspended">Suspended</option>
            </select>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Modules</p>
        <div className="flex gap-4">
          {[['restaurant', '🍽 Restaurant'], ['hotel', '🏨 Hotel'], ['feedback', '⭐ Feedback']].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.modules[key]}
                onChange={e => setModule(key, e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="flex justify-end gap-3 pt-2">
        <button type="submit" disabled={mutation.isPending} className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Tenant'}
        </button>
      </div>
    </form>
  )
}
