import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { createPlan, updatePlan } from '@/services/superadminService'

export default function PlanForm({ plan, onSuccess }) {
  const isEdit = !!plan
  const [form, setForm] = useState({
    name:               plan?.name               ?? '',
    description:        plan?.description        ?? '',
    price_monthly:      plan?.price_monthly      ?? '',
    price_yearly:       plan?.price_yearly       ?? '',
    module_restaurant:  plan?.module_restaurant  ?? false,
    module_hotel:       plan?.module_hotel       ?? false,
    module_feedback:    plan?.module_feedback     ?? false,
    max_users:          plan?.max_users          ?? 10,
    max_tables:         plan?.max_tables         ?? 0,
    max_rooms:          plan?.max_rooms          ?? 0,
    is_active:          plan?.is_active          ?? true,
    features:           plan?.features?.join('\n') ?? '',
  })
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: isEdit
      ? (data) => updatePlan(plan.id, data)
      : createPlan,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Failed to save'),
  })

  const set = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const handleSubmit = (e) => {
    e.preventDefault()
    setError('')
    const data = {
      ...form,
      features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
    }
    mutation.mutate(data)
  }

  const inputCls = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Plan Name *</label>
          <input required value={form.name} onChange={e => set('name', e.target.value)} className={inputCls} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input value={form.description} onChange={e => set('description', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Price (₹) *</label>
          <input required type="number" value={form.price_monthly} onChange={e => set('price_monthly', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Yearly Price (₹) *</label>
          <input required type="number" value={form.price_yearly} onChange={e => set('price_yearly', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-2">Included Modules</p>
        <div className="flex gap-4">
          {[['module_restaurant', '🍽 Restaurant'], ['module_hotel', '🏨 Hotel'], ['module_feedback', '⭐ Feedback']].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={form[key]} onChange={e => set(key, e.target.checked)} className="rounded" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Users</label>
          <input type="number" value={form.max_users} onChange={e => set('max_users', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Tables</label>
          <input type="number" value={form.max_tables} onChange={e => set('max_tables', e.target.value)} className={inputCls} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Rooms</label>
          <input type="number" value={form.max_rooms} onChange={e => set('max_rooms', e.target.value)} className={inputCls} />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Features (one per line)</label>
        <textarea rows={4} value={form.features} onChange={e => set('features', e.target.value)}
          className={inputCls} placeholder="PDF bills&#10;GST invoices&#10;Kitchen dashboard" />
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
          <span className="text-sm">Active (visible to users)</span>
        </label>
      )}

      <div className="flex justify-end pt-2">
        <button type="submit" disabled={mutation.isPending}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
        </button>
      </div>
    </form>
  )
}
