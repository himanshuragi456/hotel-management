import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import {
  MagnifyingGlassIcon, PlusIcon, ArrowRightOnRectangleIcon,
  TrashIcon, EyeIcon, BuildingStorefrontIcon, CalendarDaysIcon,
} from '@heroicons/react/24/outline'
import { getTenants, deleteTenant, loginAsTenant } from '@/services/superadminService'
import useAuthStore from '@/store/authStore'
import { ROLE_HOME } from '@/components/layouts/RoleGuard'
import Badge from '@/components/shared/Badge'
import Pagination from '@/components/shared/Pagination'
import TenantForm from './TenantForm'
import Modal from '@/components/shared/Modal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'

const MODULE_PILLS = [
  { key: 'restaurant', label: 'Restaurant', color: 'bg-orange-100 text-orange-700' },
  { key: 'hotel',      label: 'Hotel',      color: 'bg-indigo-100 text-indigo-700' },
  { key: 'feedback',   label: 'Feedback',   color: 'bg-green-100 text-green-700'  },
]

export default function TenantList() {
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const [loggingInAs, setLoggingInAs] = useState(null)
  const [loginError, setLoginError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState(null)
  const navigate = useNavigate()
  const qc = useQueryClient()
  const { setAuth } = useAuthStore()

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 350)
    return () => clearTimeout(t)
  }, [search])

  const handleLoginAs = async (tenant) => {
    setLoggingInAs(tenant.id)
    setLoginError('')
    try {
      const { data } = await loginAsTenant(tenant.id)
      const { access_token, user } = data.data
      setAuth(access_token, user)
      navigate(ROLE_HOME[user.role] ?? '/', { replace: true })
    } catch {
      setLoginError('Could not log in as this tenant — no owner account found.')
    } finally {
      setLoggingInAs(null)
    }
  }

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', { search: debouncedSearch, status, page }],
    queryFn: () => getTenants({ search: debouncedSearch, status, page }).then(r => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTenant,
    onSuccess: (_, id) => {
      qc.setQueryData(['tenants', { search: debouncedSearch, status, page }], (old) => {
        if (!old?.data) return old
        return { ...old, data: { ...old.data, data: old.data.data.filter(t => t.id !== id) } }
      })
      qc.invalidateQueries({ queryKey: ['tenants'] })
      setDeleteTarget(null)
    },
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-7">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tenants</h2>
          <p className="text-sm text-gray-400 mt-0.5">Manage all registered businesses</p>
        </div>
        <button onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow">
          <PlusIcon className="w-4 h-4" />
          New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-5">
        <div className="relative flex-1 sm:max-w-xs">
          <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={e => { setSearch(e.target.value); setPage(1) }}
            placeholder="Search name or email…"
            className="w-full border border-gray-200 rounded-xl pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
          />
        </div>
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[700px]">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/60">
              {['Name', 'Modules', 'Plan', 'Status', 'Expires', 'Users', ''].map(h => (
                <th key={h} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {Array.from({ length: 7 }).map((_, j) => (
                    <td key={j} className="px-5 py-4">
                      <div className="h-4 bg-gray-100 rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
                    </td>
                  ))}
                </tr>
              ))
            ) : data?.data?.length === 0 ? (
              <tr>
                <td colSpan={7} className="text-center py-16">
                  <BuildingStorefrontIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No tenants found</p>
                </td>
              </tr>
            ) : data?.data?.map(tenant => {
              const sub = tenant.subscription
              // For tenants in trial with no subscription, compute expiry from created_at + 7 days
              const trialExpiry = (!sub && tenant.status === 'trial' && tenant.created_at)
                ? new Date(new Date(tenant.created_at).getTime() + 7 * 86400000)
                : null
              const expDate = sub?.current_period_end ? new Date(sub.current_period_end) : trialExpiry
              const isExpired = expDate && expDate < new Date()
              const daysLeft = expDate && !isExpired ? Math.ceil((expDate - new Date()) / 86400000) : null
              return (
              <tr key={tenant.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-5 py-4">
                  <p className="font-semibold text-gray-900">{tenant.name}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{tenant.email}</p>
                </td>
                <td className="px-5 py-4">
                  <div className="flex gap-1 flex-wrap">
                    {MODULE_PILLS.map(({ key, label, color }) => (
                      tenant.modules?.[key] && (
                        <span key={key} className={`text-xs px-2 py-0.5 rounded-full font-medium ${color}`}>{label}</span>
                      )
                    ))}
                    {!tenant.modules?.restaurant && !tenant.modules?.hotel && !tenant.modules?.feedback && (
                      <span className="text-xs text-gray-400">None</span>
                    )}
                  </div>
                </td>
                <td className="px-5 py-4">
                  {sub?.plan?.name
                    ? <span className="text-sm font-medium text-gray-800">{sub.plan.name}</span>
                    : <span className="text-xs text-gray-400">No plan</span>}
                </td>
                <td className="px-5 py-4">
                  <Badge value={tenant.status} />
                </td>
                <td className="px-5 py-4">
                  {expDate ? (
                    <div className="flex items-center gap-1">
                      <CalendarDaysIcon className={`w-3.5 h-3.5 shrink-0 ${isExpired ? 'text-red-400' : daysLeft <= 14 ? 'text-amber-400' : 'text-gray-300'}`} />
                      <span className={`text-xs font-medium ${isExpired ? 'text-red-500' : daysLeft <= 14 ? 'text-amber-600' : 'text-gray-500'}`}>
                        {isExpired ? 'Expired' : daysLeft === 1 ? '1 day left' : `${daysLeft}d left`}
                      </span>
                    </div>
                  ) : <span className="text-xs text-gray-400">—</span>}
                </td>
                <td className="px-5 py-4 text-gray-600">{tenant.users_count}</td>
                <td className="px-5 py-4">
                  <div className="flex gap-1.5 justify-end items-center">
                    <button
                      onClick={() => handleLoginAs(tenant)}
                      disabled={loggingInAs === tenant.id}
                      className="inline-flex items-center gap-1 text-xs bg-orange-50 text-orange-600 hover:bg-orange-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors disabled:opacity-50"
                    >
                      <ArrowRightOnRectangleIcon className="w-3.5 h-3.5" />
                      {loggingInAs === tenant.id ? '…' : 'Login As'}
                    </button>
                    <button
                      onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                      className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-600 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      <EyeIcon className="w-3.5 h-3.5" />View
                    </button>
                    <button
                      onClick={() => setDeleteTarget(tenant)}
                      className="inline-flex items-center gap-1 text-xs bg-red-50 text-red-500 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors"
                    >
                      <TrashIcon className="w-3.5 h-3.5" />Delete
                    </button>
                  </div>
                </td>
              </tr>
            )})}
          </tbody>
        </table>
        </div>
      </div>

      <Pagination meta={data} onPageChange={setPage} />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Tenant">
        <TenantForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['tenants'] }) }} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={`Delete "${deleteTarget?.name}"?`}
        message="This will permanently remove the tenant and all associated data. This cannot be undone."
        confirmLabel={deleteMutation.isPending ? 'Deleting…' : 'Delete'}
        loading={deleteMutation.isPending}
        confirmClass="bg-red-500 hover:bg-red-600 text-white"
        onConfirm={() => deleteMutation.mutate(deleteTarget?.id)}
        onCancel={() => setDeleteTarget(null)}
      />

      {loginError && (
        <div className="fixed bottom-4 right-4 bg-red-600 text-white px-5 py-3 rounded-2xl shadow-lg text-sm z-50">
          {loginError}
          <button onClick={() => setLoginError('')} className="ml-3 text-red-200 hover:text-white">✕</button>
        </div>
      )}
    </div>
  )
}
