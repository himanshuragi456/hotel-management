import { useState } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { createTenant, updateTenant, assignPlan, getPlans } from '@/services/superadminService'
import { validate, validateField, required, isEmail, isPhone, isGstin, isNonNeg, maxValue, atLeastOne } from '@/utils/validate'
import { CalendarDaysIcon, InformationCircleIcon } from '@heroicons/react/24/outline'

const DETAIL_RULES = {
  name:     [required('Business name')],
  email:    [required('Email'), isEmail()],
  phone:    [required('Phone'), isPhone()],
  gstin:    [isGstin()],
  gst_rate: [required('GST rate'), isNonNeg('GST rate'), maxValue(100, 'GST rate')],
  modules:  [atLeastOne('At least one module')],
}

function CredentialsModal({ email, password, onClose }) {
  const [copied, setCopied] = useState(false)
  const copyAll = () => {
    navigator.clipboard?.writeText(`Email: ${email}\nPassword: ${password}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }
  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
            <svg className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <div>
            <h3 className="font-semibold text-gray-900">Tenant Created</h3>
            <p className="text-xs text-gray-400">Share these credentials with the owner</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-4 space-y-3 mb-4">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Email</p>
            <p className="text-sm font-mono font-medium text-gray-900">{email}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">Password</p>
            <p className="text-sm font-mono font-medium text-gray-900 tracking-wider">{password}</p>
          </div>
        </div>
        <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">
          Save this password now — it won't be shown again.
        </p>
        <div className="flex gap-2">
          <button onClick={copyAll} className="flex-1 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
            {copied ? '✓ Copied' : 'Copy Credentials'}
          </button>
          <button onClick={onClose} className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-700 text-sm font-medium py-2.5 rounded-xl transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  )
}

function DetailsTab({ form, setForm, fieldErrors, setFieldErrors, isEdit }) {
  const set = (field, value) => {
    setForm(f => ({ ...f, [field]: value }))
    const err = validateField(DETAIL_RULES, field, value, { ...form, [field]: value })
    setFieldErrors(f => ({ ...f, [field]: err }))
  }
  const setModule = (mod, val) => {
    const newModules = { ...form.modules, [mod]: val }
    setForm(f => ({ ...f, modules: newModules }))
    const err = validateField(DETAIL_RULES, 'modules', newModules, form)
    setFieldErrors(f => ({ ...f, modules: err }))
  }
  const blur = (field) => {
    const err = validateField(DETAIL_RULES, field, form[field], form)
    if (err) setFieldErrors(f => ({ ...f, [field]: err }))
  }

  const inp = (field) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors ${fieldErrors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`
  const Err = ({ field }) => fieldErrors[field]
    ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[field]}</p>
    : null

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Business Name *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} onBlur={() => blur('name')} className={inp('name')} placeholder="Spice Garden Restaurant" />
          <Err field="name" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Email *</label>
          <input type="email" value={form.email} onChange={e => set('email', e.target.value)} onBlur={() => blur('email')} className={inp('email')} placeholder="owner@example.com" />
          <Err field="email" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Phone *</label>
          <input value={form.phone} onChange={e => set('phone', e.target.value)} onBlur={() => blur('phone')} className={inp('phone')} placeholder="+91 98765 43210" />
          <Err field="phone" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">City</label>
          <input value={form.city} onChange={e => set('city', e.target.value)} className={inp('city')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">State</label>
          <input value={form.state} onChange={e => set('state', e.target.value)} className={inp('state')} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">GSTIN</label>
          <input value={form.gstin} onChange={e => set('gstin', e.target.value)} onBlur={() => blur('gstin')} className={inp('gstin')} placeholder="29ABCDE1234F1Z5" />
          <Err field="gstin" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">GST Rate (%) *</label>
          <input type="number" step="0.5" min="0" max="100" value={form.gst_rate} onChange={e => set('gst_rate', e.target.value)} onBlur={() => blur('gst_rate')} className={inp('gst_rate')} />
          <Err field="gst_rate" />
        </div>
        {isEdit && (
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Status</label>
            <select value={form.status} onChange={e => set('status', e.target.value)} className={inp('status')}>
              <option value="trial">Trial</option>
              <option value="suspended">Suspended</option>
            </select>
            <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
              <InformationCircleIcon className="w-3.5 h-3.5 shrink-0" />
              To activate, assign a subscription in the Subscription tab.
            </p>
          </div>
        )}
      </div>

      <div>
        <p className="text-xs font-medium text-gray-700 mb-1">Modules *</p>
        <p className="text-xs text-gray-400 mb-2">Select at least one module for this tenant</p>
        <div className="flex gap-4">
          {[['restaurant', 'Restaurant'], ['hotel', 'Hotel'], ['feedback', 'Feedback']].map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 cursor-pointer select-none">
              <input type="checkbox" checked={form.modules[key]} onChange={e => setModule(key, e.target.checked)} className="rounded" />
              <span className="text-sm">{label}</span>
            </label>
          ))}
        </div>
        <Err field="modules" />
      </div>
    </div>
  )
}

function SubscriptionTab({ tenant, plans, onSuccess }) {
  const [assignForm, setAssignForm] = useState({
    subscription_plan_id: '',
    billing_cycle: 'monthly',
    payment_gateway: 'manual',
    expiry_mode: 'preset',
    duration_months: 1,
    expires_at: '',
  })

  const assignMutation = useMutation({
    mutationFn: (data) => assignPlan(tenant.id, data),
    onSuccess,
  })

  const sub = tenant.subscription
  const expDate = sub?.current_period_end ? new Date(sub.current_period_end) : null
  const isExpired = expDate && expDate < new Date()

  const handleAssign = (e) => {
    e.preventDefault()
    const payload = {
      subscription_plan_id: assignForm.subscription_plan_id,
      billing_cycle: assignForm.expiry_mode === 'date' ? 'custom' : assignForm.billing_cycle,
      payment_gateway: assignForm.payment_gateway,
    }
    if (assignForm.expiry_mode === 'date' && assignForm.expires_at) {
      payload.expires_at = assignForm.expires_at
    } else {
      payload.duration_months = assignForm.duration_months
    }
    assignMutation.mutate(payload)
  }

  return (
    <div className="space-y-5">
      {/* Current subscription summary */}
      {sub ? (
        <div className={`rounded-xl p-4 border ${isExpired ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'}`}>
          <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Current Subscription</p>
          <div className="flex flex-wrap gap-x-6 gap-y-1 text-sm">
            <span><span className="text-gray-500">Plan:</span> <span className="font-semibold text-gray-800">{sub.plan?.name ?? '—'}</span></span>
            <span><span className="text-gray-500">Status:</span> <span className={`font-semibold ${isExpired ? 'text-red-600' : 'text-green-700'}`}>{sub.status}</span></span>
            {expDate && <span><span className="text-gray-500">Expires:</span> <span className={`font-semibold ${isExpired ? 'text-red-600' : 'text-gray-800'}`}>{expDate.toLocaleDateString()}{isExpired ? ' (expired)' : ''}</span></span>}
            <span><span className="text-gray-500">Gateway:</span> <span className="font-medium text-gray-700 capitalize">{sub.payment_gateway}</span></span>
          </div>
        </div>
      ) : (
        <div className="rounded-xl p-4 border border-amber-200 bg-amber-50 flex items-start gap-2">
          <InformationCircleIcon className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-700">No subscription assigned. Tenant is on a free trial. Assigning a plan will activate the account.</p>
        </div>
      )}

      {/* Assign / reassign form */}
      <form onSubmit={handleAssign} className="space-y-4">
        <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide">{sub ? 'Reassign Plan' : 'Assign Plan'}</p>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Plan *</label>
          <select required value={assignForm.subscription_plan_id} onChange={e => setAssignForm(f => ({ ...f, subscription_plan_id: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="">Select a plan</option>
            {plans?.filter(p => p.is_active).map(p => (
              <option key={p.id} value={p.id}>{p.name} — ₹{p.price_monthly}/mo</option>
            ))}
          </select>
        </div>

        <div className="bg-gray-50 rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-gray-700">Access Duration</p>
          <div className="flex gap-2">
            {[['preset', 'Duration'], ['date', 'Specific Date']].map(([mode, label]) => (
              <button key={mode} type="button"
                onClick={() => setAssignForm(f => ({ ...f, expiry_mode: mode }))}
                className={`flex-1 py-2 rounded-xl text-xs font-semibold border transition-colors ${assignForm.expiry_mode === mode ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-200'}`}>
                {label}
              </button>
            ))}
          </div>
          {assignForm.expiry_mode === 'preset' ? (
            <div>
              <label className="block text-xs text-gray-500 mb-1.5">Months</label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 6, 12, 24].map(m => (
                  <button key={m} type="button"
                    onClick={() => setAssignForm(f => ({ ...f, duration_months: m, billing_cycle: m >= 12 ? 'yearly' : 'monthly' }))}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${assignForm.duration_months === m ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-200 hover:bg-gray-50'}`}>
                    {m === 1 ? '1 month' : m === 12 ? '12 mo (1 yr)' : m === 24 ? '24 mo (2 yr)' : `${m} months`}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div>
              <label className="block text-xs text-gray-500 mb-1">Expires On</label>
              <input type="date" required={assignForm.expiry_mode === 'date'}
                min={new Date(Date.now() + 86400000).toISOString().split('T')[0]}
                value={assignForm.expires_at}
                onChange={e => setAssignForm(f => ({ ...f, expires_at: e.target.value }))}
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Payment Gateway</label>
          <select value={assignForm.payment_gateway} onChange={e => setAssignForm(f => ({ ...f, payment_gateway: e.target.value }))}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
            <option value="manual">Manual / Cash</option>
            <option value="stripe">Stripe</option>
            <option value="razorpay">Razorpay</option>
          </select>
        </div>

        {assignMutation.isError && (
          <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{assignMutation.error?.response?.data?.message || 'Failed to assign plan.'}</p>
        )}
        {assignMutation.isSuccess && (
          <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg flex items-center gap-1.5">
            <CalendarDaysIcon className="w-3.5 h-3.5" /> Plan assigned — tenant is now active.
          </p>
        )}

        <div className="flex justify-end">
          <button type="submit" disabled={assignMutation.isPending}
            className="bg-gradient-to-r from-blue-600 to-blue-700 text-white px-6 py-2.5 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow disabled:opacity-50">
            {assignMutation.isPending ? 'Assigning…' : sub ? 'Reassign Plan' : 'Assign Plan'}
          </button>
        </div>
      </form>
    </div>
  )
}

export default function TenantForm({ tenant, onSuccess }) {
  const isEdit = !!tenant
  const [tab, setTab] = useState('details')
  const [form, setForm] = useState({
    name:     tenant?.name     ?? '',
    email:    tenant?.email    ?? '',
    phone:    tenant?.phone    ?? '',
    city:     tenant?.city     ?? '',
    state:    tenant?.state    ?? '',
    gstin:    tenant?.gstin    ?? '',
    gst_rate: tenant?.gst_rate ?? 5,
    status:   tenant?.status === 'active' ? 'active' : (tenant?.status ?? 'trial'),
    modules: {
      restaurant: tenant?.modules?.restaurant ?? false,
      hotel:      tenant?.modules?.hotel      ?? false,
      feedback:   tenant?.modules?.feedback   ?? false,
    },
  })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const [credentials, setCredentials] = useState(null)

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => getPlans().then(r => r.data.data),
    enabled: isEdit,
  })

  const mutation = useMutation({
    mutationFn: isEdit ? (data) => updateTenant(tenant.id, data) : createTenant,
    onSuccess: (res) => {
      if (!isEdit && res.data?.data?.owner_password) {
        setCredentials({ email: res.data.data.owner_email, password: res.data.data.owner_password })
      } else {
        onSuccess?.()
      }
    },
    onError: (err) => setError(err.response?.data?.message ?? 'Failed to save'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate(DETAIL_RULES, form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setError('')
    setFieldErrors({})
    mutation.mutate(form)
  }

  const TABS = isEdit
    ? [{ key: 'details', label: 'Details' }, { key: 'subscription', label: 'Subscription' }]
    : [{ key: 'details', label: 'Details' }]

  return (
    <>
      {credentials && (
        <CredentialsModal
          email={credentials.email}
          password={credentials.password}
          onClose={() => { setCredentials(null); onSuccess?.() }}
        />
      )}

      {/* Tabs */}
      {isEdit && (
        <div className="flex border-b border-gray-200 mb-5 -mt-1">
          {TABS.map(t => (
            <button key={t.key} type="button" onClick={() => setTab(t.key)}
              className={`px-4 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {tab === 'details' && (
        <form onSubmit={handleSubmit} className="space-y-4">
          {error && <div className="text-red-600 text-sm bg-red-50 p-3 rounded-lg">{error}</div>}
          <DetailsTab form={form} setForm={setForm} fieldErrors={fieldErrors} setFieldErrors={setFieldErrors} isEdit={isEdit} />
          <div className="flex justify-end gap-3 pt-2">
            <button type="submit" disabled={mutation.isPending}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Tenant'}
            </button>
          </div>
        </form>
      )}

      {tab === 'subscription' && isEdit && (
        <SubscriptionTab tenant={tenant} plans={plans} onSuccess={onSuccess} />
      )}
    </>
  )
}
