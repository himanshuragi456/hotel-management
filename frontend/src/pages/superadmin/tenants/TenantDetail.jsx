import { useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTenant, updateTenantModules, assignPlan, exportTenantData } from '@/services/superadminService'
import { getPlans } from '@/services/superadminService'
import Badge from '@/components/shared/Badge'
import Modal from '@/components/shared/Modal'
import TenantForm from './TenantForm'

export default function TenantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [showEdit, setShowEdit] = useState(false)
  const [showAssign, setShowAssign] = useState(false)
  const [assignForm, setAssignForm] = useState({ subscription_plan_id: '', billing_cycle: 'monthly', payment_gateway: 'manual' })

  const { data: res, isLoading } = useQuery({
    queryKey: ['tenant', id],
    queryFn: () => getTenant(id).then(r => r.data.data),
  })

  const { data: plans } = useQuery({
    queryKey: ['plans'],
    queryFn: () => getPlans().then(r => r.data.data),
  })

  const modulesMutation = useMutation({
    mutationFn: (data) => updateTenantModules(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenant', id] }),
  })

  const assignMutation = useMutation({
    mutationFn: (data) => assignPlan(id, data),
    onSuccess: () => { setShowAssign(false); qc.invalidateQueries({ queryKey: ['tenant', id] }) },
  })

  const handleExport = async () => {
    const res = await exportTenantData(id)
    const blob = new Blob([JSON.stringify(res.data.data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `tenant-${id}-export.json`; a.click()
    URL.revokeObjectURL(url)
  }

  if (isLoading) return <div className="text-gray-400">Loading…</div>

  const { tenant, stats } = res
  const modules = tenant.modules ?? { restaurant: false, hotel: false, feedback: false }

  const toggleModule = (mod) => {
    modulesMutation.mutate({ ...modules, [mod]: !modules[mod] })
  }

  return (
    <div className="max-w-4xl">
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/superadmin/tenants')} className="text-gray-400 hover:text-gray-600 text-sm">← Back</button>
        <h2 className="text-xl font-semibold text-gray-900">{tenant.name}</h2>
        <Badge value={tenant.status} />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Total Users</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total_users}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Active Users</p>
          <p className="text-2xl font-bold text-green-600">{stats.active_users}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <p className="text-xs text-gray-500 mb-1">Plan</p>
          <p className="text-sm font-medium text-gray-900">{tenant.subscription?.plan?.name ?? 'No plan'}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Info */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Details</h3>
            <button onClick={() => setShowEdit(true)} className="text-blue-600 text-sm hover:underline">Edit</button>
          </div>
          <dl className="space-y-2 text-sm">
            {[['Email', tenant.email], ['Phone', tenant.phone], ['City', tenant.city], ['State', tenant.state], ['GSTIN', tenant.gstin], ['GST Rate', tenant.gst_rate ? `${tenant.gst_rate}%` : null]].map(([k, v]) => v ? (
              <div key={k} className="flex gap-2">
                <dt className="text-gray-500 w-20 shrink-0">{k}</dt>
                <dd className="text-gray-900">{v}</dd>
              </div>
            ) : null)}
          </dl>
        </div>

        {/* Modules */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="font-medium text-gray-900 mb-4">Module Access</h3>
          <div className="space-y-3">
            {[['restaurant', '🍽', 'Restaurant & Order Management'], ['hotel', '🏨', 'Hotel & Room Management'], ['feedback', '⭐', 'Feedback & Review System']].map(([key, icon, label]) => (
              <div key={key} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{icon}</span>
                  <span className="text-sm text-gray-700">{label}</span>
                </div>
                <button
                  onClick={() => toggleModule(key)}
                  disabled={modulesMutation.isPending}
                  className={`relative w-10 h-5 rounded-full transition-colors ${modules[key] ? 'bg-blue-600' : 'bg-gray-300'}`}
                >
                  <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${modules[key] ? 'translate-x-5' : 'translate-x-0.5'}`} />
                </button>
              </div>
            ))}
          </div>
        </div>

        {/* Subscription */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Subscription</h3>
            <button onClick={() => setShowAssign(true)} className="text-blue-600 text-sm hover:underline">Assign Plan</button>
          </div>
          {tenant.subscription ? (
            <dl className="space-y-2 text-sm">
              <div className="flex gap-2"><dt className="text-gray-500 w-24">Plan</dt><dd className="font-medium">{tenant.subscription.plan?.name}</dd></div>
              <div className="flex gap-2"><dt className="text-gray-500 w-24">Status</dt><dd><Badge value={tenant.subscription.status} /></dd></div>
              <div className="flex gap-2"><dt className="text-gray-500 w-24">Billing</dt><dd><Badge value={tenant.subscription.billing_cycle} /></dd></div>
              <div className="flex gap-2"><dt className="text-gray-500 w-24">Gateway</dt><dd><Badge value={tenant.subscription.payment_gateway} /></dd></div>
              <div className="flex gap-2"><dt className="text-gray-500 w-24">Expires</dt><dd>{tenant.subscription.current_period_end ? new Date(tenant.subscription.current_period_end).toLocaleDateString() : '—'}</dd></div>
            </dl>
          ) : (
            <p className="text-sm text-gray-400">No active subscription</p>
          )}
        </div>

        {/* Users */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-medium text-gray-900">Staff Accounts</h3>
            <button onClick={handleExport} className="text-gray-500 text-sm hover:underline">Export JSON</button>
          </div>
          <div className="space-y-2">
            {tenant.users?.slice(0, 5).map(u => (
              <div key={u.id} className="flex items-center justify-between text-sm">
                <span className="text-gray-900">{u.name}</span>
                <div className="flex items-center gap-2">
                  <Badge value={u.role} />
                  {!u.is_active && <span className="text-xs text-red-500">Inactive</span>}
                </div>
              </div>
            ))}
            {(tenant.users?.length ?? 0) > 5 && <p className="text-xs text-gray-400">+{tenant.users.length - 5} more</p>}
          </div>
        </div>
      </div>

      <Modal open={showEdit} onClose={() => setShowEdit(false)} title="Edit Tenant" size="lg">
        <TenantForm tenant={tenant} onSuccess={() => { setShowEdit(false); qc.invalidateQueries({ queryKey: ['tenant', id] }) }} />
      </Modal>

      <Modal open={showAssign} onClose={() => setShowAssign(false)} title="Assign Subscription Plan">
        <form onSubmit={(e) => { e.preventDefault(); assignMutation.mutate(assignForm) }} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Plan *</label>
            <select required value={assignForm.subscription_plan_id} onChange={e => setAssignForm(f => ({ ...f, subscription_plan_id: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
              <option value="">Select a plan</option>
              {plans?.filter(p => p.is_active).map(p => (
                <option key={p.id} value={p.id}>{p.name} — ₹{p.price_monthly}/mo</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Billing Cycle</label>
              <select value={assignForm.billing_cycle} onChange={e => setAssignForm(f => ({ ...f, billing_cycle: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="monthly">Monthly</option>
                <option value="yearly">Yearly</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Payment Gateway</label>
              <select value={assignForm.payment_gateway} onChange={e => setAssignForm(f => ({ ...f, payment_gateway: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500">
                <option value="manual">Manual</option>
                <option value="stripe">Stripe</option>
                <option value="razorpay">Razorpay</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={assignMutation.isPending}
              className="bg-blue-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50">
              {assignMutation.isPending ? 'Assigning…' : 'Assign Plan'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  )
}
