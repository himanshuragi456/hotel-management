import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import Spinner from '@/components/shared/Spinner'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import { createPlan, updatePlan } from '@/services/superadminService'
import { validate, validateField, required, isPositive, isNonNeg } from '@/utils/validate'

// At least one of the three module keys must be true
const atLeastOneModule = () => (v, all) => {
  const any = all.module_restaurant || all.module_hotel || all.module_feedback
  return any ? undefined : 'At least one module must be included'
}

const RULES = {
  name:          [required('Plan name')],
  price_monthly: [required('Monthly price'), isPositive('Monthly price')],
  price_yearly:  [required('Yearly price'), isPositive('Yearly price')],
  max_users:     [required('Max users'), isNonNeg('Max users')],
  max_tables:    [isNonNeg('Max tables')],
  max_rooms:     [isNonNeg('Max rooms')],
  module_restaurant: [atLeastOneModule()],
}

export default function PlanForm({ plan, onSuccess }) {
  const isEdit = !!plan
  const [form, setForm] = useState({
    name:               plan?.name               ?? '',
    description:        plan?.description        ?? '',
    price_monthly:      plan?.price_monthly      ?? '',
    price_yearly:       plan?.price_yearly       ?? '',
    module_restaurant:  plan?.module_restaurant  ?? false,
    module_hotel:       plan?.module_hotel       ?? false,
    module_feedback:    plan?.module_feedback    ?? false,
    max_users:          plan?.max_users          ?? 10,
    max_tables:         plan?.max_tables         ?? 0,
    max_rooms:          plan?.max_rooms          ?? 0,
    is_active:          plan?.is_active          ?? true,
    features:           plan?.features?.join('\n') ?? '',
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const formRef = useScrollToFirstError(fieldErrors)

  const mutation = useMutation({
    mutationFn: isEdit ? (data) => updatePlan(plan.id, data) : createPlan,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Failed to save'),
  })

  const set = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    const err = validateField(RULES, k, v, next)
    setFieldErrors(f => ({ ...f, [k]: err }))
    // Re-check module error whenever any module checkbox changes
    if (['module_restaurant', 'module_hotel', 'module_feedback'].includes(k)) {
      const modErr = validateField(RULES, 'module_restaurant', next.module_restaurant, next)
      setFieldErrors(f => ({ ...f, module_restaurant: modErr }))
    }
  }

  const blur = (field) => {
    const err = validateField(RULES, field, form[field], form)
    if (err !== undefined) setFieldErrors(f => ({ ...f, [field]: err }))
  }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate(RULES, form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setError('')
    setFieldErrors({})
    mutation.mutate({
      ...form,
      features: form.features.split('\n').map(s => s.trim()).filter(Boolean),
    })
  }

  const inp = (field) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${fieldErrors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`

  const Err = (field) => fieldErrors[field]
    ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[field]}</p>
    : null

  const moduleError = fieldErrors.module_restaurant

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Plan Name *</label>
          <input
            value={form.name}
            onChange={e => set('name', e.target.value)}
            onBlur={() => blur('name')}
            className={inp('name')}
            placeholder="e.g. Starter, Professional, Enterprise"
          />
          {Err('name')}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-700 mb-1">Description</label>
          <input
            value={form.description}
            onChange={e => set('description', e.target.value)}
            className={inp('description')}
            placeholder="Short description for this plan"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Monthly Price (₹) *</label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.price_monthly}
            onChange={e => set('price_monthly', e.target.value)}
            onBlur={() => blur('price_monthly')}
            className={inp('price_monthly')}
            placeholder="999"
          />
          {Err('price_monthly')}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Yearly Price (₹) *</label>
          <input
            type="number"
            min="1"
            step="1"
            value={form.price_yearly}
            onChange={e => set('price_yearly', e.target.value)}
            onBlur={() => blur('price_yearly')}
            className={inp('price_yearly')}
            placeholder="9999"
          />
          {Err('price_yearly')}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-1">Included Modules *</p>
        <p className="text-xs text-gray-400 mb-2">Select at least one module to include in this plan</p>
        <div className={`flex gap-4 p-3 rounded-lg border ${moduleError ? 'border-red-400 bg-red-50/30' : 'border-gray-200 bg-gray-50'}`}>
          {[['module_restaurant', 'Restaurant'], ['module_hotel', 'Hotel'], ['module_feedback', 'Feedback']].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={form[key]}
                onChange={e => set(key, e.target.checked)}
                className="rounded"
              />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
        {moduleError && <p className="text-xs text-red-500 mt-0.5">{moduleError}</p>}
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Users *</label>
          <input
            type="number"
            min="1"
            value={form.max_users}
            onChange={e => set('max_users', e.target.value)}
            onBlur={() => blur('max_users')}
            className={inp('max_users')}
          />
          {Err('max_users')}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Tables</label>
          <input
            type="number"
            min="0"
            value={form.max_tables}
            onChange={e => set('max_tables', e.target.value)}
            onBlur={() => blur('max_tables')}
            className={inp('max_tables')}
          />
          {Err('max_tables')}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Max Rooms</label>
          <input
            type="number"
            min="0"
            value={form.max_rooms}
            onChange={e => set('max_rooms', e.target.value)}
            onBlur={() => blur('max_rooms')}
            className={inp('max_rooms')}
          />
          {Err('max_rooms')}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-700 mb-1">Features (one per line)</label>
        <textarea
          rows={4}
          value={form.features}
          onChange={e => set('features', e.target.value)}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder={'PDF bills\nGST invoices\nKitchen dashboard'}
        />
      </div>

      {isEdit && (
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} className="rounded" />
          <span className="text-sm">Active (visible to users)</span>
        </label>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow disabled:opacity-50"
        >
          {mutation.isPending && <Spinner size="w-4 h-4" />}
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Plan'}
        </button>
      </div>
    </form>
  )
}
