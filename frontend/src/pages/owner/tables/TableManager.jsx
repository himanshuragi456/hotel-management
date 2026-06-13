import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
  PlusIcon, PencilSquareIcon, TrashIcon, QrCodeIcon,
  CheckCircleIcon, ClockIcon, UserGroupIcon, ArrowTopRightOnSquareIcon,
} from '@heroicons/react/24/outline'
import { getTables, createTable, updateTable, deleteTable, getTableQr } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { formatOccupied } from '@/utils/time'
import { validate, validateField, required, minValue, isInteger } from '@/utils/validate'

const URGENCY_CONFIG = {
  high:   { border: 'border-red-400',    bg: 'bg-red-50',    dot: 'bg-red-500',    text: 'text-red-700'    },
  medium: { border: 'border-yellow-400', bg: 'bg-yellow-50', dot: 'bg-yellow-500', text: 'text-yellow-700' },
  low:    { border: 'border-orange-300', bg: 'bg-orange-50', dot: 'bg-orange-400', text: 'text-orange-700' },
  free:   { border: 'border-gray-200',   bg: 'bg-white',     dot: 'bg-green-500',  text: 'text-green-700'  },
}

function TableCard({ table, onEdit, onDelete, onQr }) {
  const mins = table.occupied_minutes ?? 0
  const urgencyKey = table.status !== 'occupied' ? 'free' : mins > 60 ? 'high' : mins > 30 ? 'medium' : 'low'
  const cfg = URGENCY_CONFIG[urgencyKey]

  return (
    <div className={`rounded-2xl border-2 p-4 relative transition-all hover:shadow-md ${cfg.border} ${cfg.bg}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="text-2xl font-bold text-gray-900">T{table.number}</div>
          {table.section && <div className="text-xs text-gray-500">{table.section}</div>}
        </div>
        <div className="flex items-center gap-0.5">
          <button onClick={() => onQr(table)}
            className="w-7 h-7 rounded-lg hover:bg-white/60 flex items-center justify-center transition-colors">
            <QrCodeIcon className="w-4 h-4 text-gray-500" />
          </button>
          <button onClick={() => onEdit(table)}
            className="w-7 h-7 rounded-lg hover:bg-white/60 flex items-center justify-center transition-colors">
            <PencilSquareIcon className="w-4 h-4 text-blue-500" />
          </button>
          <button onClick={() => onDelete(table)}
            className="w-7 h-7 rounded-lg hover:bg-white/60 flex items-center justify-center transition-colors">
            <TrashIcon className="w-4 h-4 text-red-400" />
          </button>
        </div>
      </div>

      <div className={`flex items-center gap-1.5 text-xs font-semibold mb-1 ${cfg.text}`}>
        <div className={`w-2 h-2 rounded-full ${cfg.dot} ${table.status === 'occupied' ? 'animate-pulse' : ''}`} />
        {table.status === 'free' ? 'Free' : formatOccupied(mins)}
      </div>

      <div className="flex items-center gap-1 text-xs text-gray-400">
        <UserGroupIcon className="w-3.5 h-3.5" />
        {table.capacity} seats
      </div>

      {table.status === 'occupied' && table.active_order && (
        <div className="mt-2 pt-2 border-t border-white/50 text-xs">
          <span className={`px-1.5 py-0.5 rounded-md font-medium capitalize ${
            table.active_order.status === 'ready' ? 'bg-green-100 text-green-700' :
            table.active_order.status === 'preparing' ? 'bg-blue-100 text-blue-700' :
            'bg-yellow-100 text-yellow-700'
          }`}>{table.active_order.status}</span>
          <span className="text-gray-500 ml-1">· {table.active_order.items?.length} items</span>
        </div>
      )}
    </div>
  )
}

const TABLE_RULES = {
  number:   [required('Table number')],
  capacity: [required('Capacity'), minValue(1, 'Capacity'), isInteger('Capacity')],
}

function TableForm({ table, onSuccess }) {
  const isEdit = !!table
  const [form, setForm] = useState({ number: table?.number ?? '', capacity: table?.capacity ?? 4, section: table?.section ?? '' })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const formRef = useScrollToFirstError(fieldErrors)

  const set = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    const err = validateField(TABLE_RULES, k, v, next)
    setFieldErrors(e => ({ ...e, [k]: err }))
  }

  const blur = (field) => {
    const err = validateField(TABLE_RULES, field, form[field], form)
    if (err !== undefined) setFieldErrors(e => ({ ...e, [field]: err }))
  }

  const mutation = useMutation({
    mutationFn: isEdit ? (d) => updateTable(table.id, d) : createTable,
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })
  const inp = (field) =>
    `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 transition-colors ${fieldErrors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`

  const Err = (field) => fieldErrors[field]
    ? <p className="text-xs text-red-500 mt-0.5">{fieldErrors[field]}</p>
    : null

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate(TABLE_RULES, form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setError('')
    mutation.mutate(form)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Table Number *</label>
        <input
          value={form.number}
          onChange={e => set('number', e.target.value)}
          onBlur={() => blur('number')}
          className={inp('number')}
          placeholder="e.g. 1, A1, T-12"
        />
        {Err('number')}
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Capacity *</label>
          <input
            type="number"
            min="1"
            value={form.capacity}
            onChange={e => set('capacity', e.target.value)}
            onBlur={() => blur('capacity')}
            className={inp('capacity')}
          />
          {Err('capacity')}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Section</label>
          <input value={form.section} onChange={e => set('section', e.target.value)} className={inp('section')} placeholder="Ground Floor, Terrace…" />
        </div>
      </div>
      <div className="flex justify-end">
        <button type="submit" disabled={mutation.isPending}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Table'}
        </button>
      </div>
    </form>
  )
}

export default function TableManager() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [qrData, setQrData] = useState(null) // { svgUrl, table }
  const [deleteTarget, setDeleteTarget] = useState(null)

  const { data: tables, isLoading } = useQuery({
    queryKey: ['tables'],
    queryFn: () => getTables().then(r => r.data.data),
    refetchInterval: 15000,
  })

  const delTable = useMutation({
    mutationFn: deleteTable,
    onSuccess: (_, id) => {
      qc.setQueryData(['tables'], (old) => old ? old.filter(t => t.id !== id) : old)
      qc.invalidateQueries({ queryKey: ['tables'] })
      setDeleteTarget(null)
    },
  })

  const handleQr = async (table) => {
    const res = await getTableQr(table.id)
    const svgUrl = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(res.data)
    setQrData({ svgUrl, table })
  }

  const free     = tables?.filter(t => t.status === 'free').length ?? 0
  const occupied = tables?.filter(t => t.status === 'occupied').length ?? 0

  const sections = tables?.reduce((acc, t) => {
    const s = t.section || 'Other'
    if (!acc[s]) acc[s] = []
    acc[s].push(t)
    return acc
  }, {}) ?? {}

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Tables</h2>
          <p className="text-sm text-gray-400 mt-0.5 flex items-center gap-3">
            <span className="flex items-center gap-1"><CheckCircleIcon className="w-3.5 h-3.5 text-green-500" />{free} free</span>
            <span className="flex items-center gap-1"><ClockIcon className="w-3.5 h-3.5 text-orange-500" />{occupied} occupied</span>
          </p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow self-start sm:self-auto">
          <PlusIcon className="w-4 h-4" />
          Add Table
        </button>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {Array.from({ length: 8 }).map((_, i) => (
            <div key={i} className="h-28 rounded-2xl bg-gray-100 animate-pulse" />
          ))}
        </div>
      ) : !tables?.length ? (
        <div className="flex flex-col items-center justify-center py-20 rounded-2xl border-2 border-dashed border-gray-200">
          <QrCodeIcon className="w-12 h-12 text-gray-200 mb-3" />
          <p className="text-gray-500 font-medium mb-1">No tables yet</p>
          <p className="text-sm text-gray-400 mb-4">Add your first table to get started</p>
          <button onClick={() => setShowForm(true)}
            className="bg-orange-500 text-white px-5 py-2 rounded-xl text-sm font-semibold">
            Add Table
          </button>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(sections).map(([section, rows]) => (
            <div key={section}>
              <div className="flex items-center gap-3 mb-3">
                <div className="h-px flex-1 bg-gray-100" />
                <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">{section}</p>
                <div className="h-px flex-1 bg-gray-100" />
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                {rows.map(table => (
                  <TableCard key={table.id} table={table}
                    onEdit={(t) => { setEditing(t); setShowForm(true) }}
                    onDelete={(t) => setDeleteTarget(t)}
                    onQr={handleQr} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Table' : 'Add Table'} size="sm">
        <TableForm table={editing} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['tables'] }) }} />
      </Modal>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget?.status === 'occupied' ? `Table ${deleteTarget?.number} is currently occupied` : `Delete Table ${deleteTarget?.number}?`}
        message={deleteTarget?.status === 'occupied'
          ? 'You cannot delete a table while it has active orders. Please close the table first.'
          : 'This will permanently remove the table and its QR code. This cannot be undone.'}
        confirmLabel={deleteTarget?.status === 'occupied' ? 'OK' : 'Delete'}
        confirmClass={deleteTarget?.status === 'occupied' ? 'bg-gray-700 hover:bg-gray-800 text-white' : 'bg-red-500 hover:bg-red-600 text-white'}
        onConfirm={() => {
          if (deleteTarget?.status === 'occupied') setDeleteTarget(null)
          else delTable.mutate(deleteTarget.id)
        }}
        onCancel={() => setDeleteTarget(null)}
      />

      <Modal open={!!qrData} onClose={() => setQrData(null)} title={`Table ${qrData?.table?.number} — QR Code`} size="sm">
        {qrData && (
          <div className="text-center">
            <div className="bg-gray-50 rounded-2xl p-6 mb-4 inline-block">
              <img src={qrData.svgUrl} className="mx-auto w-48 h-48" />
            </div>
            <p className="text-xs text-gray-500 mb-4">Customers scan this to view menu and place orders</p>
            <div className="flex gap-2 justify-center">
              <a href={qrData.svgUrl} download={`table-${qrData.table.number}-qr.svg`}
                className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-5 py-2.5 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow">
                <QrCodeIcon className="w-4 h-4" />
                Download QR
              </a>
              {qrData.table.menu_url && (
                <a href={qrData.table.menu_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 bg-gray-100 hover:bg-gray-200 text-gray-700 px-5 py-2.5 rounded-xl text-sm font-semibold transition-colors">
                  <ArrowTopRightOnSquareIcon className="w-4 h-4" />
                  Open Menu
                </a>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  )
}
