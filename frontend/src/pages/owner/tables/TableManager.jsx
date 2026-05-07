import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getTables, createTable, updateTable, deleteTable, getTableQr } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import useAuthStore from '@/store/authStore'

function TableCard({ table, onEdit, onDelete, onQr }) {
  const mins = table.occupied_minutes
  const urgency = mins > 60 ? 'border-red-400 bg-red-50' : mins > 30 ? 'border-yellow-400 bg-yellow-50' : 'border-green-300 bg-green-50'

  return (
    <div className={`rounded-xl border-2 p-4 relative ${table.status === 'occupied' ? urgency : 'border-gray-200 bg-white'}`}>
      <div className="text-2xl font-bold text-gray-900 mb-1">T{table.number}</div>
      {table.section && <div className="text-xs text-gray-500 mb-2">{table.section}</div>}
      <div className={`text-xs font-medium mb-1 ${table.status === 'free' ? 'text-green-600' : 'text-orange-600'}`}>
        {table.status === 'free' ? '✓ Free' : `🕐 ${mins}m occupied`}
      </div>
      <div className="text-xs text-gray-400">{table.capacity} seats</div>
      {table.status === 'occupied' && table.active_order && (
        <div className="mt-2 text-xs text-gray-600">
          {table.active_order.items?.length} items · ₹{table.active_order.total}
        </div>
      )}
      <div className="absolute top-2 right-2 flex gap-1">
        <button onClick={() => onQr(table)} className="text-gray-400 hover:text-gray-600 text-xs">QR</button>
        <button onClick={() => onEdit(table)} className="text-blue-400 hover:text-blue-600 text-xs">✎</button>
        <button onClick={() => onDelete(table)} className="text-red-400 hover:text-red-500 text-xs">✕</button>
      </div>
    </div>
  )
}

function TableForm({ table, onSuccess }) {
  const isEdit = !!table
  const [form, setForm] = useState({ number: table?.number ?? '', capacity: table?.capacity ?? 4, section: table?.section ?? '' })
  const [error, setError] = useState('')
  const mutation = useMutation({
    mutationFn: isEdit ? (d) => updateTable(table.id, d) : createTable,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })
  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'
  return (
    <form onSubmit={(e) => { e.preventDefault(); setError(''); mutation.mutate(form) }} className="space-y-3">
      {error && <div className="text-red-600 text-sm">{error}</div>}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Table Number *</label>
        <input required value={form.number} onChange={e => setForm(f => ({ ...f, number: e.target.value }))} className={inp} placeholder="e.g. 1, A1, T-12" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Capacity</label>
          <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Section</label>
          <input value={form.section} onChange={e => setForm(f => ({ ...f, section: e.target.value }))} className={inp} placeholder="e.g. Ground Floor" />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={mutation.isPending} className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Add Table'}
        </button>
      </div>
    </form>
  )
}

export default function TableManager() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [qrUrl, setQrUrl] = useState(null)

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => getTables().then(r => r.data.data),
    refetchInterval: 15000,
  })

  const delTable = useMutation({
    mutationFn: deleteTable,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tables'] }),
  })

  const handleQr = async (table) => {
    const blob = await getTableQr(table.id).then(r => r.data)
    setQrUrl(URL.createObjectURL(blob))
  }

  const free = tables?.filter(t => t.status === 'free').length ?? 0
  const occupied = tables?.filter(t => t.status === 'occupied').length ?? 0

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tables</h2>
          <p className="text-sm text-gray-400">{free} free · {occupied} occupied</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
          + Add Table
        </button>
      </div>

      {isLoading ? <div className="text-gray-400">Loading…</div> : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {tables?.map(table => (
            <TableCard key={table.id} table={table}
              onEdit={(t) => { setEditing(t); setShowForm(true) }}
              onDelete={(t) => confirm(`Delete table ${t.number}?`) && delTable.mutate(t.id)}
              onQr={handleQr} />
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Table' : 'Add Table'} size="sm">
        <TableForm table={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['tables'] }) }} />
      </Modal>

      <Modal open={!!qrUrl} onClose={() => setQrUrl(null)} title="Table QR Code" size="sm">
        {qrUrl && (
          <div className="text-center">
            <img src={qrUrl} className="mx-auto mb-4 w-48 h-48" />
            <p className="text-xs text-gray-500 mb-3">Customers scan this to view menu and place orders</p>
            <a href={qrUrl} download="table-qr.png" className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium inline-block">
              Download PNG
            </a>
          </div>
        )}
      </Modal>
    </div>
  )
}
