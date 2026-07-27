import { useState, useEffect } from 'react'
import Spinner from '@/components/shared/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  CheckCircleIcon, ArrowTopRightOnSquareIcon,
  QrCodeIcon, PlusIcon, TrashIcon, ArrowDownTrayIcon, LinkIcon,
  ArrowPathIcon, XMarkIcon, BuildingStorefrontIcon,
} from '@heroicons/react/24/outline'
import {
  getFeedbackQrCodes, createFeedbackQrCode, updateFeedbackQrCode,
  deleteFeedbackQrCode, downloadFeedbackQr,
  getGmbStatus, getGmbConnectUrl, disconnectGmb, updateGmbSettings,
  getGmbAccounts, getGmbLocations, selectGmbLocation,
  getReviewConfig, updateReviewConfig,
} from '@/services/restaurantService'

const PLACEMENTS = ['reception', 'entrance', 'counter', 'table', 'room', 'other']

// ─── Google Connect Panel ──────────────────────────────────────────────────────

function ManualPlaceIdPanel() {
  const qc = useQueryClient()
  const [placeId, setPlaceId] = useState('')
  const [saved, setSaved] = useState(false)

  const { data: config } = useQuery({
    queryKey: ['review-config'],
    queryFn: () => getReviewConfig().then(r => r.data.data),
  })

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (config?.google_place_id) setPlaceId(config.google_place_id)
  }, [config])
  /* eslint-enable react-hooks/set-state-in-effect */

  const save = useMutation({
    mutationFn: () => updateReviewConfig({
      google_place_id: placeId.trim(),
      google_review_url: placeId.trim()
        ? `https://search.google.com/local/writereview?placeid=${placeId.trim()}`
        : null,
    }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['review-config'] })
      qc.invalidateQueries({ queryKey: ['gmb-status'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const reviewUrl = placeId.trim()
    ? `https://search.google.com/local/writereview?placeid=${placeId.trim()}`
    : null

  return (
    <div className="border-t border-gray-100 pt-4 mt-4">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
        Or enter Place ID manually
      </p>
      <p className="text-xs text-gray-400 mb-3">
        Find your Place ID at{' '}
        <a href="https://developers.google.com/maps/documentation/places/web-service/place-id" target="_blank" rel="noopener noreferrer" className="text-blue-500 hover:underline">
          Google Place ID Finder
        </a>
        . This enables the feedback redirect without connecting Google OAuth.
      </p>
      <div className="flex gap-2 items-end">
        <div className="flex-1">
          <input
            id="feedback-setup-place-id"
            name="place_id"
            aria-label="Google Place ID"
            type="text"
            value={placeId}
            onChange={e => setPlaceId(e.target.value)}
            placeholder="e.g. ChIJN1t_tDeuEmsRUsoyG83frY4"
            className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50"
          />
        </div>
        <button
          onClick={() => save.mutate()}
          disabled={save.isPending || !placeId.trim()}
          className="inline-flex items-center gap-1.5 bg-gray-800 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:bg-gray-700 transition-colors whitespace-nowrap"
        >
          {saved ? <><CheckCircleIcon className="w-4 h-4 text-green-400" />Saved</> : save.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {reviewUrl && (
        <a href={reviewUrl} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-xs text-blue-500 hover:underline mt-2">
          Test review link <ArrowTopRightOnSquareIcon className="w-3 h-3" />
        </a>
      )}
    </div>
  )
}

function GoogleConnectPanel() {
  const qc = useQueryClient()
  const [step, setStep] = useState('idle') // idle | picking_account | picking_location
  const [selectedAccount, setSelectedAccount] = useState(null)
  const [connectError, setConnectError] = useState('')

  const { data: status, isLoading: statusLoading } = useQuery({
    queryKey: ['gmb-status'],
    queryFn: () => getGmbStatus().then(r => r.data.data),
    refetchOnWindowFocus: true,
  })

  // Handle OAuth callback redirect params
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    if (params.get('gmb_connected') === '1') {
      qc.invalidateQueries({ queryKey: ['gmb-status'] })
      setStep('picking_account')
      window.history.replaceState({}, '', window.location.pathname)
    }
    if (params.get('gmb_error')) {
      setConnectError('Google connection failed. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [qc])
  /* eslint-enable react-hooks/set-state-in-effect */

  const { data: accounts, isLoading: accountsLoading } = useQuery({
    queryKey: ['gmb-accounts'],
    queryFn: () => getGmbAccounts().then(r => r.data.data),
    enabled: step === 'picking_account',
  })

  const { data: locations, isLoading: locationsLoading } = useQuery({
    queryKey: ['gmb-locations', selectedAccount],
    queryFn: () => getGmbLocations(selectedAccount).then(r => r.data.data),
    enabled: step === 'picking_location' && !!selectedAccount,
  })

  const connect = useMutation({
    mutationFn: () => getGmbConnectUrl().then(r => r.data.data),
    onSuccess: ({ url }) => { window.location.href = url },
    onError: () => setConnectError('Could not start Google connection. Please try again.'),
  })

  const disconnect = useMutation({
    mutationFn: disconnectGmb,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmb-status'] })
      setStep('idle')
    },
  })

  const selectLocation = useMutation({
    mutationFn: selectGmbLocation,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmb-status'] })
      qc.invalidateQueries({ queryKey: ['review-config'] })
      setStep('idle')
    },
    onError: () => setConnectError('Failed to connect location. Please try again.'),
  })

  const autoReply = useMutation({
    mutationFn: (data) => updateGmbSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmb-status'] }),
  })

  if (statusLoading) return <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 animate-pulse h-40" />

  const connected = status?.connected
  const hasLocation = !!status?.location_name

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900 flex items-center gap-2">
            <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            Google Business Profile
          </h3>
          <p className="text-xs text-gray-400 mt-0.5">
            {connected && hasLocation ? status.location_name : 'Connect to enable AI features'}
          </p>
        </div>
        {connected && hasLocation && (
          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full">
            <CheckCircleIcon className="w-3.5 h-3.5" />Connected
          </span>
        )}
      </div>

      {connectError && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-xl px-4 py-3 flex items-center justify-between">
          <p className="text-xs text-red-600">{connectError}</p>
          <button onClick={() => setConnectError('')}><XMarkIcon className="w-4 h-4 text-red-400" /></button>
        </div>
      )}

      {/* Not connected at all */}
      {!connected && step === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            Connect your Google Business account so we can automatically fetch your location,
            sync reviews, auto-reply with AI, and post weekly updates — all without manually
            entering a Place ID.
          </p>
          <button
            onClick={() => connect.mutate()}
            disabled={connect.isPending}
            className="w-full flex items-center justify-center gap-2 border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {connect.isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : (
              <svg className="w-4 h-4" viewBox="0 0 24 24"><path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/><path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/><path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/><path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/></svg>
            )}
            Sign in with Google
          </button>
        </div>
      )}

      {/* Connected — pick account */}
      {connected && step === 'picking_account' && (
        <div className="space-y-3">
          <p className="text-sm font-medium text-gray-700">Select your Google Business account:</p>
          {accountsLoading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-12 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : accounts?.length > 0 ? (
            <div className="space-y-2">
              {accounts.map(acc => (
                <button
                  key={acc.id}
                  onClick={() => { setSelectedAccount(acc.id); setStep('picking_location') }}
                  className="w-full text-left flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:border-orange-400 hover:bg-orange-50 transition-colors"
                >
                  <BuildingStorefrontIcon className="w-5 h-5 text-gray-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{acc.name}</p>
                    <p className="text-xs text-gray-400 capitalize">{acc.type?.toLowerCase().replace('_', ' ')}</p>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No Google Business accounts found. Make sure you have a GMB profile.</p>
          )}
        </div>
      )}

      {/* Pick location */}
      {connected && step === 'picking_location' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <button onClick={() => setStep('picking_account')} className="text-xs text-gray-400 hover:text-gray-600">← Back</button>
            <p className="text-sm font-medium text-gray-700">Select your business location:</p>
          </div>
          {locationsLoading ? (
            <div className="space-y-2">{[1,2].map(i => <div key={i} className="h-14 bg-gray-100 rounded-xl animate-pulse" />)}</div>
          ) : locations?.length > 0 ? (
            <div className="space-y-2">
              {locations.map(loc => (
                <button
                  key={loc.id}
                  onClick={() => selectLocation.mutate({
                    account_id: selectedAccount,
                    location_id: loc.id,
                    location_name: loc.title,
                    place_id: loc.place_id,
                  })}
                  disabled={selectLocation.isPending}
                  className="w-full text-left flex items-center gap-3 border border-gray-200 rounded-xl px-4 py-3 hover:border-orange-400 hover:bg-orange-50 transition-colors disabled:opacity-50"
                >
                  <CheckCircleIcon className="w-5 h-5 text-gray-300 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-gray-800">{loc.title}</p>
                    {loc.address && <p className="text-xs text-gray-400">{loc.address}</p>}
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">No locations found for this account.</p>
          )}
        </div>
      )}

      {/* Connected with location */}
      {connected && hasLocation && step === 'idle' && (
        <div className="space-y-4">
          <div className="bg-gray-50 rounded-xl px-4 py-3 space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-xs text-gray-500 font-medium">Location</span>
              <span className="text-xs font-semibold text-gray-800">{status.location_name}</span>
            </div>
            {status.google_review_url && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-500 font-medium">Review link</span>
                <a href={status.google_review_url} target="_blank" rel="noopener noreferrer"
                  className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
                  Test link <ArrowTopRightOnSquareIcon className="w-3 h-3" />
                </a>
              </div>
            )}
          </div>

          {/* Auto-reply toggle */}
          <div className="flex items-center justify-between border border-gray-200 rounded-xl px-4 py-3">
            <div>
              <p className="text-sm font-medium text-gray-800">Auto AI Reply</p>
              <p className="text-xs text-gray-400">Automatically reply to new reviews with AI</p>
            </div>
            <button
              onClick={() => autoReply.mutate({ auto_reply_enabled: !status.auto_reply_enabled })}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${status.auto_reply_enabled ? 'bg-orange-500' : 'bg-gray-200'}`}
            >
              <span className={`inline-block h-4 w-4 rounded-full bg-white shadow transition-transform ${status.auto_reply_enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {/* Tone selector */}
          <div>
            <label htmlFor="feedback-setup-reply-tone" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Reply tone</label>
            <select
              id="feedback-setup-reply-tone"
              name="auto_reply_tone"
              value={status.auto_reply_tone}
              onChange={e => autoReply.mutate({ auto_reply_tone: e.target.value })}
              className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
            >
              <option value="professional">Professional</option>
              <option value="friendly">Friendly</option>
              <option value="formal">Formal</option>
              <option value="enthusiastic">Enthusiastic</option>
            </select>
          </div>

          <div className="flex gap-2">
            <button
              onClick={() => setStep('picking_account')}
              className="flex-1 text-xs text-gray-500 border border-gray-200 rounded-xl py-2 hover:bg-gray-50 transition-colors"
            >
              Change location
            </button>
            <button
              onClick={() => disconnect.mutate()}
              disabled={disconnect.isPending}
              className="text-xs text-red-500 border border-red-200 rounded-xl px-4 py-2 hover:bg-red-50 transition-colors"
            >
              Disconnect
            </button>
          </div>
        </div>
      )}

      {/* Connected but no location chosen yet */}
      {connected && !hasLocation && step === 'idle' && (
        <div className="space-y-3">
          <p className="text-sm text-gray-500">Google account connected. Now select your business location.</p>
          <button
            onClick={() => setStep('picking_account')}
            className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-3 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow"
          >
            Select Location
          </button>
        </div>
      )}

      <ManualPlaceIdPanel />
    </div>
  )
}

// ─── QR Card ──────────────────────────────────────────────────────────────────

function QrCard({ qr, onDelete, onDownload, onToggle }) {
  const feedbackUrl = `${window.location.origin}/feedback/${qr.qr_token}`

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
        <a
          href={feedbackUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-8 h-8 rounded-xl bg-blue-50 hover:bg-blue-100 flex items-center justify-center transition-colors"
        >
          <LinkIcon className="w-3.5 h-3.5 text-blue-500" />
        </a>
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

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function FeedbackSetup() {
  const qc = useQueryClient()
  const [label, setLabel] = useState('')
  const [placement, setPlacement] = useState('reception')
  const [error, setError] = useState('')

  const { data: status } = useQuery({
    queryKey: ['gmb-status'],
    queryFn: () => getGmbStatus().then(r => r.data.data),
  })

  const { data: qrCodes, isLoading: qrLoading } = useQuery({
    queryKey: ['feedback-qr-codes'],
    queryFn: () => getFeedbackQrCodes().then(r => r.data.data),
  })

  const isConfigured = !!(status?.google_review_url)

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
        <p className="text-sm text-gray-400 mt-0.5">Connect Google, manage QR codes, and enable AI features</p>
      </div>

      <GoogleConnectPanel />

      {/* QR codes section — unlocked once location is configured */}
      <div className={`bg-white rounded-2xl border border-gray-100 shadow-sm p-5 transition-opacity ${isConfigured ? '' : 'opacity-50 pointer-events-none'}`}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h3 className="font-semibold text-gray-900">Your QR Codes</h3>
            {!isConfigured ? (
              <p className="text-xs text-amber-600 mt-0.5">Connect Google above to enable QR creation.</p>
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
            <label htmlFor="feedback-qr-label" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Label</label>
            <input
              id="feedback-qr-label"
              name="label"
              required value={label} onChange={e => setLabel(e.target.value)}
              placeholder="e.g. Front Desk"
              className={`${inp} w-full`}
            />
          </div>
          <div>
            <label htmlFor="feedback-qr-placement" className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Placement</label>
            <select id="feedback-qr-placement" name="placement" value={placement} onChange={e => setPlacement(e.target.value)} className={inp}>
              {PLACEMENTS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
          </div>
          <button
            type="submit" disabled={create.isPending}
            className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow whitespace-nowrap"
          >
            {create.isPending ? <Spinner size="w-4 h-4" /> : <PlusIcon className="w-4 h-4" />}
            {create.isPending ? 'Creating…' : 'Create QR'}
          </button>
        </form>

        {qrLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {[1,2,3].map(i => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
          </div>
        ) : qrCodes?.length > 0 ? (
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {qrCodes.map(qr => (
              <QrCard key={qr.id} qr={qr}
                onDelete={(q) => del.mutate(q)}
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
