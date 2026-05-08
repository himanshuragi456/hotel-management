import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getFeedbackQrCodes, createFeedbackQrCode, updateFeedbackQrCode,
  deleteFeedbackQrCode, downloadFeedbackQr, getReviewConfig, updateReviewConfig,
} from '@/services/restaurantService'

const PLACEMENTS = ['reception', 'table', 'room', 'other']
const PLACEMENT_ICONS = { reception: '🏨', table: '🪑', room: '🛏', other: '📍' }

function QrCard({ qr, onDelete, onDownload, onToggle }) {
  return (
    <div className={`bg-white rounded-xl border-2 p-4 ${qr.is_active ? 'border-gray-200' : 'border-gray-100 opacity-60'}`}>
      <div className="flex items-start justify-between mb-2">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg">{PLACEMENT_ICONS[qr.placement]}</span>
            <span className="font-semibold text-gray-900">{qr.label}</span>
          </div>
          <div className="text-xs text-gray-400 capitalize mt-0.5">{qr.placement}</div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => onToggle(qr)}
            className={`text-xs px-2 py-0.5 rounded-full font-medium ${qr.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
          >
            {qr.is_active ? 'Active' : 'Inactive'}
          </button>
        </div>
      </div>
      <div className="text-xs text-gray-500 mb-3 font-mono truncate">{qr.submissions_count ?? 0} submissions</div>
      <div className="flex gap-2">
        <button
          onClick={() => onDownload(qr)}
          className="flex-1 bg-orange-500 text-white text-xs py-1.5 rounded-lg font-medium hover:bg-orange-600"
        >
          Download QR
        </button>
        <button
          onClick={() => onDelete(qr)}
          className="text-red-400 text-xs hover:text-red-600 px-2"
        >
          Del
        </button>
      </div>
    </div>
  )
}

function ReviewConfig() {
  const qc = useQueryClient()
  const { data: config } = useQuery({
    queryKey: ['review-config'],
    queryFn: () => getReviewConfig().then(r => r.data.data),
  })
  const [form, setForm] = useState({ google_place_id: '', google_review_url: '' })
  const [saved, setSaved] = useState(false)

  const save = useMutation({
    mutationFn: updateReviewConfig,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['review-config'] }); setSaved(true); setTimeout(() => setSaved(false), 2000) },
  })

  const currentPlaceId = form.google_place_id || config?.google_place_id || ''
  const currentUrl     = form.google_review_url || config?.google_review_url || ''

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <h3 className="font-semibold text-gray-900 mb-1">Google Review Config</h3>
      <p className="text-xs text-gray-400 mb-4">Customers with rating &gt; 3 will be directed to your Google review page.</p>
      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Google Place ID</label>
          <input
            value={currentPlaceId}
            onChange={e => setForm(f => ({ ...f, google_place_id: e.target.value }))}
            placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
            className={inp}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Google Review URL</label>
          <input
            value={currentUrl}
            onChange={e => setForm(f => ({ ...f, google_review_url: e.target.value }))}
            placeholder="https://g.page/r/…/review"
            className={inp}
          />
          {currentUrl && (
            <a href={currentUrl} target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-500 hover:underline mt-1 inline-block">
              Test link ↗
            </a>
          )}
        </div>
        <button
          onClick={() => save.mutate({ google_place_id: currentPlaceId, google_review_url: currentUrl })}
          disabled={save.isPending}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
        >
          {saved ? '✓ Saved' : save.isPending ? 'Saving…' : 'Save Config'}
        </button>
      </div>
    </div>
  )
}

export default function FeedbackSetup() {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [placement, setPlacement] = useState('reception')
  const [error, setError] = useState('')

  const { data: qrCodes } = useQuery({
    queryKey: ['feedback-qr-codes'],
    queryFn: () => getFeedbackQrCodes().then(r => r.data.data),
  })

  const create = useMutation({
    mutationFn: createFeedbackQrCode,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['feedback-qr-codes'] }); setLabel('') },
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const del = useMutation({
    mutationFn: (qr) => deleteFeedbackQrCode(qr.id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback-qr-codes'] }),
  })

  const toggle = useMutation({
    mutationFn: (qr) => updateFeedbackQrCode(qr.id, { is_active: !qr.is_active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['feedback-qr-codes'] }),
  })

  const handleDownload = async (qr) => {
    const res = await downloadFeedbackQr(qr.id)
    const url = URL.createObjectURL(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = `feedback-qr-${qr.label}.png`; a.click()
    URL.revokeObjectURL(url)
  }

  const inp = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="max-w-3xl space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Feedback QR Setup</h2>

      {/* Create QR */}
      <div className="bg-white rounded-xl border border-gray-200 p-5">
        <h3 className="font-semibold text-gray-900 mb-3">Create New Feedback QR</h3>
        {error && <div className="text-red-600 text-sm mb-2 bg-red-50 px-3 py-2 rounded">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate({ label, placement }) }}
              className="flex gap-3 items-end flex-wrap">
          <div className="flex-1 min-w-40">
            <label className="block text-xs font-medium text-gray-600 mb-1">Label</label>
            <input required value={label} onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Front Desk" className={`${inp} w-full`} />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Placement</label>
            <select value={placement} onChange={e => setPlacement(e.target.value)} className={inp}>
              {PLACEMENTS.map(p => <option key={p} value={p} className="capitalize">{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <button type="submit" disabled={create.isPending}
            className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {create.isPending ? 'Creating…' : '+ Create QR'}
          </button>
        </form>
      </div>

      {/* QR grid */}
      {qrCodes?.length > 0 && (
        <div>
          <h3 className="font-medium text-gray-800 mb-3 text-sm">Your Feedback QR Codes ({qrCodes.length})</h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {qrCodes.map(qr => (
              <QrCard
                key={qr.id}
                qr={qr}
                onDelete={(q) => confirm(`Delete "${q.label}" QR?`) && del.mutate(q)}
                onDownload={handleDownload}
                onToggle={(q) => toggle.mutate(q)}
              />
            ))}
          </div>
        </div>
      )}

      <ReviewConfig />
    </div>
  )
}
