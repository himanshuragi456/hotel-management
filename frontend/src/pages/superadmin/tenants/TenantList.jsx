import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getTenants, deleteTenant } from '@/services/superadminService'
import Badge from '@/components/shared/Badge'
import Pagination from '@/components/shared/Pagination'
import TenantForm from './TenantForm'
import Modal from '@/components/shared/Modal'

export default function TenantList() {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [showCreate, setShowCreate] = useState(false)
  const navigate = useNavigate()
  const qc = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['tenants', { search, status, page }],
    queryFn: () => getTenants({ search, status, page }).then(r => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteTenant,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tenants'] }),
  })

  const handleDelete = (tenant) => {
    if (confirm(`Delete "${tenant.name}"? This cannot be undone.`)) {
      deleteMutation.mutate(tenant.id)
    }
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Tenants</h2>
        <button
          onClick={() => setShowCreate(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + New Tenant
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-3 mb-4">
        <input
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1) }}
          placeholder="Search name or email…"
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <select
          value={status}
          onChange={e => { setStatus(e.target.value); setPage(1) }}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="trial">Trial</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Name</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Email</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Modules</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Users</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">Loading…</td></tr>
            ) : data?.data?.length === 0 ? (
              <tr><td colSpan={6} className="text-center py-8 text-gray-400">No tenants found</td></tr>
            ) : data?.data?.map(tenant => (
              <tr key={tenant.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 font-medium text-gray-900">{tenant.name}</td>
                <td className="px-4 py-3 text-gray-600">{tenant.email}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-1 flex-wrap">
                    {tenant.modules?.restaurant && <span className="text-xs bg-orange-100 text-orange-700 px-2 py-0.5 rounded-full">🍽 Restaurant</span>}
                    {tenant.modules?.hotel      && <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">🏨 Hotel</span>}
                    {tenant.modules?.feedback   && <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">⭐ Feedback</span>}
                  </div>
                </td>
                <td className="px-4 py-3"><Badge value={tenant.status} /></td>
                <td className="px-4 py-3 text-gray-600">{tenant.users_count}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2 justify-end">
                    <button
                      onClick={() => navigate(`/superadmin/tenants/${tenant.id}`)}
                      className="text-blue-600 hover:underline text-xs"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleDelete(tenant)}
                      className="text-red-500 hover:underline text-xs"
                    >
                      Delete
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <Pagination meta={data} onPageChange={setPage} />

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Tenant">
        <TenantForm onSuccess={() => { setShowCreate(false); qc.invalidateQueries({ queryKey: ['tenants'] }) }} />
      </Modal>
    </div>
  )
}
