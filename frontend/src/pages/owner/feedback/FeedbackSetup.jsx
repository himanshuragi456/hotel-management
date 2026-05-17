import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircleIcon, ExclamationTriangleIcon, ArrowTopRightOnSquareIcon,
  QrCodeIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon,
  BuildingStorefrontIcon,
} from '@heroicons/react/24/outline'
import {
  getFeedbackQrCodes, createFeedbackQrCode, updateFeedbackQrCode,
  deleteFeedbackQrCode, downloadFeedbackQr, getReviewConfig, updateReviewConfig,
} from '@/services/restaurantService'

const PLACEMENTS = ['reception', 'entrance', 'counter', 'table', 'room', 'other']
const BUSINESS_DOMAINS = [
  { value: 'restaurant', label: 'Restaurant' },
  { value: 'hotel', label: 'Hotel' },
  { value: 'cafe', label: 'Café' },
  { value: 'bar', label: 'Bar' },
  { value: 'bakery', label: 'Bakery' },
  { value: 'dentist', label: 'Dentist' },
  { value: 'clinic', label: 'Clinic / Hospital' },
  { value: 'salon', label: 'Salon / Spa' },
  { value: 'barber', label: 'Barber Shop' },
  { value: 'gym', label: 'Gym / Fitness' },
  { value: 'retail', label: 'Retail Shop' },
  { value: 'other', label: 'Other (type below)' },
]

function extractPlaceId(input) {
  input = input.trim()
  if (/^[A-Za-z0-9_\-]+$/.test(input) && input.length > 10) return input
  let m = input.match(/[?&]placeid=([^&]+)/)
  if (m) return m[1]
  m = input.match(/ChIJ[A-Za-z0-9_\-]+/)
  if (m) return m[0]
  return null
}

function ReviewConfig({ onSaved }) {
  const qc = useQueryClient()
  const { data: config, isLoading } = useQuery({
    queryKey: ['review-config'],
    queryFn: () => getReviewConfig().then(r => r.data.data),
  })

  const [domain, setDomain] = useState('')
  const [customDomain, setCustomDomain] = useState('')
  const [mapsInput, setMapsInput] = useState('')
  const [saved, setSaved] = useState(false)

  const effectiveDomain = domain === 'other' ? customDomain.trim() : domain
  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50'

  const placeId = extractPlaceId(mapsInput)
  const reviewUrl = placeId ? `https://search.google.com/local/writereview?placeid=${placeId}` : null

  const save = useMutation({
    mutationFn: (payload) => updateReviewConfig(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-config'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
      onSaved?.()
    },
  })

  const handleSave = () => save.mutate({
    business_domain:   effectiveDomain,
    google_place_id:   placeId,
    google_review_url: reviewUrl,
  })

  const isConfigured = !!(config?.google_review_url && config?.business_domain)
  const canSave = !!(placeId && effectiveDomain)

  if (isLoading) return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse h-48" />

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Google Review Setup</h3>
          <p className="text-xs text-gray-400 mt-0.5">Configure first — QR codes unlock once setup is complete.</p>
        </div>
        {isConfigured && (
          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">
            <CheckCircleIcon className="w-3.5 h-3.5" />Configured
          </span>
        )}
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Business Type *</label>
          <select value={domain} onChange={e => setDomain(e.target.value)} className={inp}>
            <option value="">Select your business type…</option>
            {BUSINESS_DOMAINS.map(d => <option key={d.value} value={d.value}>{d.label}</option>)}
          </select>
          {domain === 'other' && (
            <input
              value={customDomain}
              onChange={e => setCustomDomain(e.target.value)}
              placeholder="e.g. zoo, aquarium, escape room…"
              className={`${inp} mt-2`}
              autoFocus
            />
          )}
        </div>

        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">
            Google Maps URL or Place ID *
          </label>
          <input
            value={mapsInput}
            onChange={e => setMapsInput(e.target.value)}
            placeholder="Paste your Google Maps business URL or Place ID"
            className={inp}
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className="text-xs text-gray-400">Search your business on Google Maps and paste the URL here.</p>
            <a
              href="https://www.google.com/maps/search/?q=my+business"
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-500 hover:underline flex items-center gap-0.5 shrink-0 ml-2"
            >
              Find on Maps <ArrowTopRightOnSquareIcon className="w-3 h-3" />
            </a>
          </div>
        </div>

        {/* Parsed result */}
        {mapsInput && (
          placeId ? (
            <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 space-y-1.5">
              <div className="flex items-center gap-1.5">
                <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-xs text-green-700 font-semibold">Place ID found</span>
                <a href={reviewUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline ml-auto flex items-center gap-0.5">
                  Test link <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              </div>
              <p className="text-xs text-gray-500 font-mono break-all">{placeId}</p>
            </div>
          ) : (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center gap-2">
              <ExclamationTriangleIcon className="w-4 h-4 text-amber-500 shrink-0" />
              <p className="text-xs text-amber-700">Couldn't extract a Place ID. Try pasting the full Google Maps URL.</p>
            </div>
          )
        )}

        {/* Currently configured */}
        {isConfigured && !mapsInput && (
          <div className="border border-gray-200 rounded-xl p-3.5 bg-gray-50 space-y-1">
            <p className="text-xs font-medium text-gray-500">Currently configured</p>
            <a href={config.google_review_url} target="_blank" rel="noopener noreferrer"
               className="text-xs text-blue-500 hover:underline block truncate flex items-center gap-1">
              {config.google_review_url} <ArrowTopRightOnSquareIcon className="w-3 h-3 shrink-0" />
            </a>
          </div>
        )}

        {config?.has_suggestions && (
          <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
            <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />
            <p className="text-xs text-green-700 font-medium">{config.suggestions_count} AI review suggestions ready</p>
          </div>
        )}

        <button
          onClick={handleSave}
          disabled={save.isPending || !canSave}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-3 rounded-xl text-sm font-semibold disabled:opacity-40 flex items-center justify-center gap-2 hover:shadow-md transition-shadow"
        >
          {save.isPending ? (
            <>
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z"/>
              </svg>
              Saving & generating suggestions…
            </>
          ) : saved ? (
            <><CheckCircleIcon className="w-4 h-4" /> Saved</>
          ) : 'Save Configuration'}
        </button>
      </div>
    </div>
  )
}

function QrCard({ qr, onDelete, onDownload, onToggle }) {
  return (
    <div className={`bg-white rounded-2xl border-2 p-4 transition-all hover:shadow-md ${qr.is_active ? 'border-gray-100 shadow-sm' : 'border-dashed border-gray-200 opacity-60'}`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="font-semibold text-gray-900 text-sm">{qr.label}</p>
          <p className="text-xs text-gray-400 capitalize mt-0.5">{qr.placement}</p>
        </div>
        <button
          onClick={() => onToggle(qr)}
          className={`text-xs px-2.5 py-0.5 rounded-full font-semibold shrink-0 transition-colors ${qr.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}
        >
          {qr.is_active ? 'Active' : 'Inactive'}
        </button>
      </div>

      <div className="flex items-center gap-1.5 text-xs text-gray-400 mb-4">
        <QrCodeIcon className="w-3.5 h-3.5" />
        {qr.submissions_count ?? 0} submissions
      </div>

      <div className="flex gap-2">
        <button
          onClick={() => onDownload(qr)}
          className="flex-1 inline-flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs py-2 rounded-xl font-semibold hover:shadow-md transition-shadow"
        >
          <ArrowDownTrayIcon className="w-3.5 h-3.5" />Download
        </button>
        <button
          onClick={() => onDelete(qr)}
          className="w-8 h-8 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
        >
          <TrashIcon className="w-3.5 h-3.5 text-red-400" />
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

  const { data: config } = useQuery({
    queryKey: ['review-config'],
    queryFn: () => getReviewConfig().then(r => r.data.data),
  })

  const { data: qrCodes } = useQuery({
    queryKey: ['feedback-qr-codes'],
    queryFn: () => getFeedbackQrCodes().then(r => r.data.data),
  })

  const isConfigured = !!(config?.google_review_url && config?.business_domain)

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
    const url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(res.data)
    const a = document.createElement('a')
    a.href = url; a.download = `feedback-qr-${qr.label}.svg`; a.click()
  }

  const inp = 'border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50'

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Feedback Setup</h2>
        <p className="text-sm text-gray-400 mt-0.5">Configure Google Reviews and manage your feedback QR codes</p>
      </div>

      <ReviewConfig onSaved={() => qc.invalidateQueries({ queryKey: ['review-config'] })} />

      {/* QR codes section */}
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-opacity ${isConfigured ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-gray-900">Your QR Codes</h3>
            {!isConfigured ? (
              <p className="text-xs text-amber-600 mt-0.5">Complete setup above to enable QR creation.</p>
            ) : (
              <p className="text-xs text-gray-400 mt-0.5">Print and place these at your premises</p>
            )}
          </div>
          {qrCodes?.length > 0 && (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">{qrCodes.length} code{qrCodes.length !== 1 ? 's' : ''}</span>
          )}
        </div>

        {error && <div className="text-red-600 text-sm mb-4 bg-red-50 px-4 py-3 rounded-xl">{error}</div>}

        <form
          onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate({ label, placement }) }}
          className="flex gap-2 items-end flex-wrap mb-5 bg-gray-50 rounded-xl p-4 border border-gray-100"
        >
          <div className="flex-1 min-w-36">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Label</label>
            <input
              required
              value={label}
              onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Front Desk"
              className={`${inp} w-full`}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Placement</label>
            <select value={placement} onChange={e => setPlacement(e.target.value)} className={inp}>
              {PLACEMENTS.map(p => (
                <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={create.isPending}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow whitespace-nowrap"
          >
            <PlusIcon className="w-4 h-4" />
            {create.isPending ? 'Creating…' : 'Create QR'}
          </button>
        </form>

        {qrCodes?.length > 0 ? (
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
        ) : isConfigured ? (
          <div className="py-10 text-center border-2 border-dashed border-gray-200 rounded-2xl">
            <QrCodeIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-sm text-gray-400 font-medium">No QR codes yet</p>
            <p className="text-xs text-gray-400 mt-0.5">Create one above and place it at your reception</p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
