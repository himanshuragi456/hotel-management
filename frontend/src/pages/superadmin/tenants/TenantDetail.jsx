import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTenant, updateTenantModules, exportTenantData, updateTenantAiSettings } from '@/services/superadminService'
import Badge from '@/components/shared/Badge'
import Modal from '@/components/shared/Modal'
import TenantForm from './TenantForm'
import {
  ArrowLeftIcon, PencilSquareIcon, ArrowDownTrayIcon, UsersIcon,
  ShoppingBagIcon, BuildingOfficeIcon, StarIcon, SparklesIcon,
  CheckCircleIcon, XCircleIcon,
} from '@heroicons/react/24/outline'

// ── AI Settings card ──────────────────────────────────────────────────────────

function AiSettingsCard({ tenant, mutation }) {
  const [quota, setQuota] = useState(tenant.ai_monthly_quota ?? 100)
  const enabled = tenant.ai_suggestions_enabled ?? false
  const used    = tenant.ai_usage_this_month ?? 0
  const pct     = quota > 0 ? Math.min(100, Math.round((used / quota) * 100)) : 0

  const save = () => mutation.mutate({ ai_suggestions_enabled: enabled, ai_monthly_quota: Number(quota) })
  const toggle = () => mutation.mutate({ ai_suggestions_enabled: !enabled, ai_monthly_quota: Number(quota) })

  return (
    <div className="mt-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center">
            <SparklesIcon className="w-4 h-4 text-violet-600" />
          </div>
          <div>
            <h3 className="font-semibold text-gray-900 text-sm">AI Review Suggestions</h3>
            <p className="text-xs text-gray-400">Live OpenAI reviews shown to customers on the feedback page</p>
          </div>
        </div>

        {/* Enable / disable toggle */}
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            className="sr-only peer"
            checked={enabled}
            disabled={mutation.isPending}
            onChange={toggle}
          />
          <div className="w-11 h-6 rounded-full bg-gray-200 peer-checked:bg-violet-600 peer-disabled:opacity-50 transition-colors" />
          <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
        </label>
      </div>

      {enabled ? (
        <div className="space-y-4">
          {/* Usage bar */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-500">This month's usage</span>
              <span className="text-xs font-bold text-gray-700">{used} / {quota} calls</span>
            </div>
            <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all ${pct >= 90 ? 'bg-red-500' : pct >= 70 ? 'bg-amber-500' : 'bg-violet-500'}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              {pct >= 100
                ? 'Quota exhausted — fallback suggestions showing to customers'
                : `${quota - used} calls remaining this month`}
            </p>
          </div>

          {/* Quota control */}
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-600 mb-1">Monthly quota (calls)</label>
              <input
                type="number" min="0" max="10000" value={quota}
                onChange={e => setQuota(e.target.value)}
                className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-violet-400"
              />
            </div>
            <div className="pt-5">
              <button
                onClick={save}
                disabled={mutation.isPending}
                className="bg-violet-600 hover:bg-violet-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50"
              >
                {mutation.isPending ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>

          <div className="flex items-start gap-2 bg-violet-50 rounded-xl px-3 py-2.5">
            <CheckCircleIcon className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" />
            <p className="text-xs text-violet-700 leading-relaxed">
              Each time a customer opens the feedback page and rates 4–5 stars, one call is consumed. Suggestions are generated fresh in Hindi/Hinglish/English.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex items-start gap-2 bg-gray-50 rounded-xl px-3 py-2.5">
          <XCircleIcon className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500 leading-relaxed">
            AI suggestions are disabled for this tenant. Enable the toggle to allow live OpenAI-generated review suggestions on their feedback page.
          </p>
        </div>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function TenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [feedbackDomain, setFeedbackDomain] = useState('')

  const { data: res, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => getTenant(id).then(r => r.data.data),
  })

  const modulesMutation = useMutation({
    mutationFn: (data) => updateTenantModules(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant', id] }),
  })

  const aiMutation = useMutation({
    mutationFn: (data) => updateTenantAiSettings(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant', id] }),
  })

  const handleExport = async () => {
    const res = await exportTenantData(id)
    const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `tenant-${id}-export.json`; a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return (
    <div className="max-w-4xl space-y-4">
      {[...Array(3)].map((_, i) => <div key={i} className="h-24 bg-gray-100 rounded-2xl animate-pulse" />)}
    </div>
  )

  const { tenant, stats } = res
  const modules = tenant.modules ?? { restaurant: false, hotel: false, feedback: false }
  const resolvedDomain = feedbackDomain || (tenant.business_domain ?? '')

  const DOMAIN_OPTIONS = [
    { value: 'restaurant', label: 'Restaurant' },
    { value: 'hotel',      label: 'Hotel' },
    { value: 'cafe',       label: 'Café' },
    { value: 'bar',        label: 'Bar' },
    { value: 'bakery',     label: 'Bakery' },
    { value: 'clinic',     label: 'Clinic' },
    { value: 'dentist',    label: 'Dentist' },
    { value: 'salon',      label: 'Salon' },
    { value: 'gym',        label: 'Gym' },
    { value: 'retail',     label: 'Retail Shop' },
    { value: 'other',      label: 'Other' },
  ]

  const toggleModule = (mod) => {
    const newModules = { ...modules, [mod]: !modules[mod] }
    const payload = { ...newModules }
    if (mod === 'feedback' && newModules.feedback && resolvedDomain) {
      payload.business_domain = resolvedDomain
    }
    modulesMutation.mutate(payload)
  }

  const saveDomain = () => {
    modulesMutation.mutate({ ...modules, business_domain: resolvedDomain })
  }

  const MODULE_ITEMS = [
    { key: 'restaurant', Icon: ShoppingBagIcon, label: 'Restaurant & Order Management', color: 'text-orange-600', bg: 'bg-orange-50' },
    { key: 'hotel',      Icon: BuildingOfficeIcon, label: 'Hotel & Room Management',    color: 'text-blue-600',   bg: 'bg-blue-50'   },
    { key: 'feedback',   Icon: StarIcon,           label: 'Feedback & Review System',   color: 'text-amber-600',  bg: 'bg-amber-50'  },
  ]

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/superadmin/tenants')}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <ArrowLeftIcon className="w-4 h-4" />
        </button>
        <div>
          <h2 className="text-xl font-semibold text-gray-900">{tenant.name}</h2>
          <div className="mt-0.5"><Badge value={tenant.status} /></div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-1">
            <UsersIcon className="w-4 h-4 text-gray-400" />
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider">Total Users</p>
          </div>
          <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
          <p className="text-xs text-gray-400 mt-0.5">{stats.active_users} active</p>
        </div>
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 col-span-2">
          <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">Current Plan</p>
          <p className="text-lg font-bold text-gray-900">{tenant.subscription?.plan?.name ?? 'No plan'}</p>
          {tenant.subscription?.current_period_end && (
            <p className="text-xs text-gray-400 mt-0.5">Expires {new Date(tenant.subscription.current_period_end).toLocaleDateString()}</p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Details</h3>
            <button onClick={() => setShowEdit(true)}
              className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
              <PencilSquareIcon className="w-3.5 h-3.5" />Edit
            </button>
          </div>
          <dl className="space-y-2.5 text-sm">
            {[['Email', tenant.email], ['Phone', tenant.phone], ['City', tenant.city], ['State', tenant.state], ['GSTIN', tenant.gstin], ['GST Rate', tenant.gst_rate ? `${tenant.gst_rate}%` : null]].map(([k, v]) => v ? (
              <div key={k} className="flex gap-2">
                <dt className="text-gray-400 w-20 shrink-0 text-xs font-medium uppercase tracking-wide">{k}</dt>
                <dd className="text-gray-800 font-medium">{v}</dd>
              </div>
            ) : null)}
          </dl>
        </div>

        {/* Modules */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <h3 className="font-semibold text-gray-900 mb-4">Module Access</h3>
          <div className="space-y-3">
            {MODULE_ITEMS.map(({ key, Icon, label, color, bg }) => (
              <div key={key}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className={`w-7 h-7 rounded-lg ${bg} flex items-center justify-center`}>
                      <Icon className={`w-3.5 h-3.5 ${color}`} />
                    </div>
                    <span className="text-sm text-gray-700 font-medium">{label}</span>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      className="sr-only peer"
                      checked={!!modules[key]}
                      disabled={modulesMutation.isPending}
                      onChange={() => toggleModule(key)}
                    />
                    <div className="w-11 h-6 rounded-full bg-gray-200 peer-checked:bg-blue-600 peer-disabled:opacity-50 transition-colors" />
                    <div className="absolute left-1 top-1 w-4 h-4 rounded-full bg-white shadow transition-transform peer-checked:translate-x-5" />
                  </label>
                </div>
                {key === 'feedback' && modules.feedback && (
                  <div className="mt-2 ml-9.5 pl-0.5">
                    <label className="block text-xs font-medium text-gray-500 mb-1">Business Domain</label>
                    <div className="flex gap-2">
                      <select
                        value={resolvedDomain}
                        onChange={e => setFeedbackDomain(e.target.value)}
                        className="flex-1 border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 bg-gray-50"
                      >
                        <option value="">Select domain…</option>
                        {DOMAIN_OPTIONS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
                      </select>
                      <button
                        onClick={saveDomain}
                        disabled={!resolvedDomain || modulesMutation.isPending}
                        className="px-2.5 py-1.5 bg-amber-500 hover:bg-amber-600 text-white text-xs font-semibold rounded-lg disabled:opacity-40 transition-colors"
                      >
                        {modulesMutation.isPending ? '…' : 'Save'}
                      </button>
                    </div>
                    {tenant.business_domain && (
                      <p className="text-xs text-gray-400 mt-1">Current: <span className="font-medium text-gray-600">{tenant.business_domain}</span></p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Subscription</h3>
            <button onClick={() => setShowEdit(true)}
              className="text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
              {tenant.subscription ? 'Manage' : 'Assign Plan'}
            </button>
          </div>
          {tenant.subscription ? (
            <dl className="space-y-2.5 text-sm">
              <div className="flex gap-2"><dt className="text-gray-400 w-20 shrink-0 text-xs font-medium uppercase">Plan</dt><dd className="font-semibold text-gray-800">{tenant.subscription.plan?.name}</dd></div>
              <div className="flex gap-2 items-center"><dt className="text-gray-400 w-20 shrink-0 text-xs font-medium uppercase">Status</dt><dd><Badge value={tenant.subscription.status} /></dd></div>
              <div className="flex gap-2 items-center"><dt className="text-gray-400 w-20 shrink-0 text-xs font-medium uppercase">Billing</dt><dd><Badge value={tenant.subscription.billing_cycle} /></dd></div>
              <div className="flex gap-2 items-center"><dt className="text-gray-400 w-20 shrink-0 text-xs font-medium uppercase">Gateway</dt><dd><Badge value={tenant.subscription.payment_gateway} /></dd></div>
              <div className="flex gap-2"><dt className="text-gray-400 w-20 shrink-0 text-xs font-medium uppercase">Expires</dt><dd className="text-gray-700">{tenant.subscription.current_period_end ? new Date(tenant.subscription.current_period_end).toLocaleDateString() : '—'}</dd></div>
            </dl>
          ) : (
            <div className="text-center py-6">
              <p className="text-sm text-gray-400">No active subscription — tenant is on free trial</p>
              <button onClick={() => setShowEdit(true)} className="mt-2 text-xs text-blue-600 hover:underline font-medium">Assign a plan →</button>
            </div>
          )}
        </div>

        {/* Users */}
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-gray-900">Staff Accounts</h3>
            <button onClick={handleExport}
              className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-50 hover:bg-gray-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
              <ArrowDownTrayIcon className="w-3.5 h-3.5" />Export
            </button>
          </div>
          <div className="space-y-2">
            {tenant.users?.slice(0, 5).map(u => (
              <div key={u.id} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center text-white text-xs font-bold shrink-0">
                    {u.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-gray-800 font-medium">{u.name}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge value={u.role} />
                  {!u.is_active && <span className="text-xs text-red-500">Inactive</span>}
                </div>
              </div>
            ))}
            {(tenant.users?.length ?? 0) > 5 && <p className="text-xs text-gray-400 pt-1">+{tenant.users.length - 5} more accounts</p>}
          </div>
        </div>
      </div>

      {/* AI Suggestions settings — full-width card below the grid */}
      <AiSettingsCard tenant={tenant} mutation={aiMutation} />

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Tenant" size="lg">
        <TenantForm tenant={tenant} onSuccess={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['tenant', id] }) }} />
      </Modal>
    </div>
  )
}
