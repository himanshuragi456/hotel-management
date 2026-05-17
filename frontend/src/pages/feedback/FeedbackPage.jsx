import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import {
  ArrowPathIcon, CheckCircleIcon, ExclamationCircleIcon, SparklesIcon,
} from '@heroicons/react/24/outline'
import { HeartIcon as HeartSolid } from '@heroicons/react/24/solid'
import { getFeedbackPage, submitFeedback, getAiSuggestions } from '@/services/restaurantService'
import PoweredByBanner from '@/components/shared/PoweredByBanner'

// Bluish palette — low ratings use cool-warm contrast, high = blue-indigo
const RATING_META = {
  1: { label: "That was rough — we're sorry",  emoji: '😟', color: 'text-rose-500',   bg: 'bg-rose-50',   ring: 'ring-rose-200'   },
  2: { label: 'We could have done better',      emoji: '😕', color: 'text-orange-500', bg: 'bg-orange-50', ring: 'ring-orange-200' },
  3: { label: 'Room for improvement',           emoji: '😐', color: 'text-amber-600',  bg: 'bg-amber-50',  ring: 'ring-amber-200'  },
  4: { label: 'Glad you enjoyed it!',           emoji: '😊', color: 'text-blue-600',   bg: 'bg-blue-50',   ring: 'ring-blue-200'   },
  5: { label: 'You made our day!',              emoji: '🤩', color: 'text-indigo-600', bg: 'bg-indigo-50', ring: 'ring-indigo-200' },
}

// ── Star rating ───────────────────────────────────────────────────────────────

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  const active = hovered || value
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="transition-all duration-150 focus:outline-none hover:scale-125 active:scale-95"
          style={{ fontSize: 52, lineHeight: 1 }}
          aria-label={`${star} star`}
        >
          <span className={`transition-colors duration-100 ${active >= star ? 'text-amber-400' : 'text-slate-200'}`}>
            ★
          </span>
        </button>
      ))}
    </div>
  )
}

// ── AI suggestions ────────────────────────────────────────────────────────────
// onPick fires AFTER copy+redirect — this is the actual submission trigger

// refreshKey increments on "Different suggestions" → forces a new API call → new OpenAI completion
function AiSuggestions({ token, rating, googleReviewUrl, refreshKey, onRefresh, onPick }) {
  const [copied, setCopied] = useState(null)
  const { data: resp, isLoading, isFetching } = useQuery({
    queryKey: ['ai-suggestions', token, refreshKey],
    queryFn: () => getAiSuggestions(token, { rating }).then(r => r.data.data),
    enabled: rating >= 4,
    staleTime: 0,
    gcTime: 0,
    retry: 1,
  })

  const suggestions = resp?.suggestions ?? []
  const isAi        = resp?.ai_enabled === true

  const handlePick = (text, idx) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(idx)
    onPick(text)
    setTimeout(() => {
      if (googleReviewUrl) window.open(googleReviewUrl, '_blank')
    }, 900)
  }

  return (
    <div className="space-y-2.5">
      {/* AI badge header */}
      {!isLoading && isAi && (
        <div className="flex items-center gap-1.5 mb-1">
          <SparklesIcon className="w-3.5 h-3.5 text-violet-500" />
          <span className="text-xs font-semibold text-violet-500 uppercase tracking-wider">AI Generated</span>
          <span className="text-xs text-slate-300">· fresh just for you</span>
        </div>
      )}

      {isLoading
        ? [1, 2, 3].map(i => (
            <div key={i} className="h-[76px] rounded-2xl bg-slate-100 animate-pulse" style={{ animationDelay: `${i * 0.12}s` }} />
          ))
        : suggestions.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => !isFetching && copied === null && handlePick(suggestion, idx)}
              disabled={copied !== null || isFetching}
              className={`w-full text-left px-4 py-4 rounded-2xl border-2 text-sm leading-relaxed transition-all duration-200 active:scale-[0.98] ${
                isFetching
                  ? 'border-slate-100 bg-slate-50/80 text-slate-300 cursor-wait'
                  : copied === idx
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : copied !== null
                  ? 'border-slate-100 bg-white/60 text-slate-400 cursor-not-allowed'
                  : isAi
                  ? 'border-violet-100 bg-white hover:border-violet-300 hover:bg-violet-50/60 text-slate-600 shadow-sm hover:shadow-md'
                  : 'border-slate-100 bg-white hover:border-blue-300 hover:bg-blue-50/60 text-slate-600 shadow-sm hover:shadow-md'
              }`}
            >
              {copied === idx ? (
                <span className="flex items-center gap-2 font-semibold text-green-700">
                  <CheckCircleIcon className="w-4 h-4 shrink-0" />
                  Copied — opening Google Reviews…
                </span>
              ) : (
                <span className={`italic ${isFetching ? 'blur-[2px]' : ''} transition-all duration-300`}>{suggestion}</span>
              )}
            </button>
          ))
      }
      {!isLoading && suggestions.length > 0 && copied === null && (
        <button onClick={onRefresh} disabled={isFetching}
          className="w-full flex items-center justify-center gap-1.5 text-xs text-slate-400 hover:text-slate-600 py-1.5 transition-colors disabled:opacity-50 disabled:cursor-wait">
          <ArrowPathIcon className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin' : ''}`} />
          {isFetching ? 'Loading…' : 'Different suggestions'}
        </button>
      )}
    </div>
  )
}

// ── Low rating form ───────────────────────────────────────────────────────────

function LowRatingForm({ tenantName, rating, onSubmit, isPending }) {
  const [comment, setComment] = useState('')
  const meta = RATING_META[rating]

  return (
    <div className="space-y-4">
      {/* Empathy strip */}
      <div className={`flex items-start gap-3 rounded-2xl px-4 py-3.5 ${meta.bg} ring-1 ${meta.ring}`}>
        <span className="text-2xl shrink-0 leading-none mt-0.5">{meta.emoji}</span>
        <div>
          <p className="text-sm font-semibold text-slate-800 mb-0.5">We're sorry to hear that.</p>
          <p className="text-xs text-slate-500 leading-relaxed">
            Your feedback goes directly to the team at{' '}
            <span className="font-semibold text-slate-700">{tenantName}</span>.
          </p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-semibold text-slate-700 mb-2">
          What could we do better?
          <span className="ml-1.5 text-xs font-normal text-slate-400">Optional</span>
        </label>
        <textarea
          value={comment}
          onChange={e => setComment(e.target.value)}
          rows={4}
          placeholder="Tell us what happened…"
          className="w-full border border-slate-200 rounded-2xl px-4 py-3.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-400 focus:border-transparent resize-none bg-slate-50 placeholder:text-slate-300 text-slate-700 leading-relaxed transition"
        />
      </div>

      <button
        onClick={() => onSubmit(comment)}
        disabled={isPending}
        className="w-full py-4 rounded-2xl font-bold text-sm text-white disabled:opacity-50 active:scale-[0.98] transition-all shadow-lg shadow-blue-900/10"
        style={{ background: 'linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)' }}
      >
        {isPending ? 'Sending…' : 'Send Feedback'}
      </button>
    </div>
  )
}

// ── High rating panel ─────────────────────────────────────────────────────────

function HighRatingPanel({ token, rating, tenantName, googleReviewUrl, onSubmit }) {
  const [refreshKey, setRefreshKey] = useState(0)

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <div className="inline-flex items-center justify-center w-10 h-10 shrink-0 rounded-xl shadow-md shadow-blue-400/30"
          style={{ background: 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)' }}>
          <SparklesIcon className="w-5 h-5 text-white" />
        </div>
        <div>
          <h2 className="text-base font-bold text-slate-900 leading-tight">Share it on Google?</h2>
          <p className="text-xs text-slate-500 leading-snug mt-0.5">Tap a suggestion — we'll copy it &amp; open Google Reviews.</p>
        </div>
      </div>

      <AiSuggestions
        token={token}
        rating={rating}
        googleReviewUrl={googleReviewUrl}
        refreshKey={refreshKey}
        onRefresh={() => setRefreshKey(k => k + 1)}
        onPick={(text) => onSubmit('', text)}
      />

      {/* Skip — write your own */}
      {googleReviewUrl && (
        <a
          href={googleReviewUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => onSubmit('', '')}
          className="flex items-center justify-center gap-2 w-full py-3.5 rounded-2xl font-bold text-sm text-white active:scale-[0.98] transition-all"
          style={{ background: 'linear-gradient(135deg, #4285F4 0%, #1a73e8 100%)', boxShadow: '0 8px 24px rgba(66,133,244,0.28)' }}
        >
          <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#fff"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff"/>
          </svg>
          Write your own review
        </a>
      )}
    </div>
  )
}

// ── Thank you screen ──────────────────────────────────────────────────────────

function ThankYouScreen({ tenantName, wasHigh }) {
  return (
    <div className="flex flex-col items-center justify-center text-center px-8 py-20">
      <div className="relative mb-6">
        <div
          className="w-20 h-20 rounded-3xl flex items-center justify-center shadow-xl"
          style={{
            background: wasHigh
              ? 'linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)'
              : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)',
            boxShadow: wasHigh ? '0 16px 40px rgba(99,102,241,0.35)' : '0 16px 40px rgba(37,99,235,0.30)',
          }}
        >
          <HeartSolid className="w-10 h-10 text-white" />
        </div>
        <div className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-green-500 border-2 border-white flex items-center justify-center shadow-sm">
          <CheckCircleIcon className="w-4 h-4 text-white" />
        </div>
      </div>

      <h2 className="text-2xl font-extrabold text-slate-900 mb-2">
        {wasHigh ? 'Thank you! 🌟' : 'Thank you'}
      </h2>
      <p className="text-sm text-slate-500 leading-relaxed max-w-xs">
        {wasHigh
          ? <>Your kind words mean the world to <span className="font-semibold text-slate-700">{tenantName}</span>.</>
          : <>We're sorry it wasn't perfect. Your feedback goes straight to the team at <span className="font-semibold text-slate-700">{tenantName}</span>.</>
        }
      </p>

      <div className="mt-10 w-48 h-px bg-gradient-to-r from-transparent via-slate-200 to-transparent" />
      <p className="text-xs text-slate-300 mt-4">You can close this page now.</p>
    </div>
  )
}

// ── Loading ───────────────────────────────────────────────────────────────────

function LoadingScreen() {
  return (
    <div className="min-h-dvh flex items-center justify-center"
      style={{ background: 'linear-gradient(145deg, #eff6ff 0%, #f8faff 50%, #eef2ff 100%)' }}>
      <div className="flex gap-1.5">
        {[0, 1, 2].map(i => (
          <div key={i} className="w-2.5 h-2.5 rounded-full bg-blue-400"
            style={{ animation: `bounce 1s ease-in-out infinite`, animationDelay: `${i * 0.15}s` }} />
        ))}
      </div>
    </div>
  )
}

// ── Error ─────────────────────────────────────────────────────────────────────

function ErrorScreen() {
  return (
    <div className="min-h-dvh flex flex-col items-center justify-center p-8 text-center"
      style={{ background: 'linear-gradient(145deg, #eff6ff 0%, #f8faff 50%, #eef2ff 100%)' }}>
      <div className="w-16 h-16 rounded-2xl bg-white border border-slate-100 shadow-sm flex items-center justify-center mx-auto mb-5">
        <ExclamationCircleIcon className="w-8 h-8 text-slate-400" />
      </div>
      <h2 className="text-lg font-bold text-slate-800 mb-2">Link not found</h2>
      <p className="text-sm text-slate-400 leading-relaxed max-w-xs">
        This feedback link is inactive or has expired. Please scan the QR code again.
      </p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const { token } = useParams()
  const [rating, setRating] = useState(0)
  // null = not done, false = low-rating done, true = high-rating done
  const [submitted, setSubmitted] = useState(null)

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['feedback-page', token],
    queryFn: () => getFeedbackPage(token).then(r => r.data.data),
  })

  // Single submit fn used by both paths
  const submit = useMutation({
    mutationFn: ({ comment, suggestion }) =>
      submitFeedback(token, { rating, comment: comment || suggestion || '', submitter_name: undefined }),
    onSuccess: (_, vars) => setSubmitted(rating >= 4),
  })

  // Stars are always freely changeable until submission
  const handleRating = (star) => {
    if (submitted !== null) return  // locked after actual submission
    setRating(star)
  }

  // Called when user taps "Send Feedback" (low) or a suggestion/Google link (high)
  const handleSubmit = (comment = '', suggestion = '') => {
    if (submit.isPending || submitted !== null) return
    submit.mutate({ comment, suggestion })
  }

  if (isLoading) return <LoadingScreen />
  if (error) return <ErrorScreen />

  const bgStyle = { background: 'linear-gradient(145deg, #eff6ff 0%, #f8faff 40%, #eef2ff 100%)' }
  const meta = rating > 0 ? RATING_META[rating] : null
  const isHigh = rating >= 4

  // Thank you state
  if (submitted !== null) return (
    <div className="min-h-dvh flex flex-col" style={bgStyle}>
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1, #3b82f6)' }} />
      <div className="flex-1 flex flex-col">
        <ThankYouScreen tenantName={page?.tenant_name} wasHigh={submitted} />
      </div>
      <div className="px-5 pb-10 max-w-sm mx-auto w-full">
        <PoweredByBanner />
      </div>
    </div>
  )

  return (
    <div className="min-h-dvh flex flex-col" style={bgStyle}>

      {/* Top accent line */}
      <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #3b82f6, #6366f1, #3b82f6)' }} />

      {/* Header */}
      <div className="px-6 pt-10 pb-6 text-center">
        {/* Venue chip */}
        <div className="inline-flex items-center gap-2 bg-white/70 backdrop-blur-sm border border-blue-100 rounded-full px-4 py-1.5 mb-5 shadow-sm">
          <div className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-xs font-semibold text-blue-600 tracking-wide">{page?.tenant_name}</span>
        </div>

        <h1 className="text-3xl font-extrabold text-slate-900 leading-tight mb-2">
          How was your<br />
          <span className="text-transparent bg-clip-text" style={{ backgroundImage: 'linear-gradient(135deg, #3b82f6, #6366f1)' }}>
            experience?
          </span>
        </h1>
        <p className="text-sm text-slate-400">Your honest opinion helps us grow</p>
      </div>

      {/* Main card */}
      <div className="flex-1 px-5 pb-10 max-w-sm mx-auto w-full">
        <div
          className="rounded-3xl p-6 space-y-6"
          style={{
            background: 'rgba(255,255,255,0.75)',
            backdropFilter: 'blur(16px)',
            border: '1px solid rgba(255,255,255,0.9)',
            boxShadow: '0 20px 60px rgba(59,130,246,0.08), 0 4px 16px rgba(0,0,0,0.04)',
          }}
        >
          {/* Stars */}
          <div className="text-center space-y-4">
            <StarRating value={rating} onChange={handleRating} />

            {/* Label pill */}
            <div className="h-9 flex items-center justify-center">
              {rating === 0 ? (
                <p className="text-sm text-slate-300 select-none">Tap a star to begin</p>
              ) : (
                <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-sm font-semibold ${meta.bg} ${meta.color} ring-1 ${meta.ring}`}>
                  <span>{meta.emoji}</span>
                  <span>{meta.label}</span>
                </div>
              )}
            </div>
          </div>

          {/* Divider */}
          {rating > 0 && (
            <div className="h-px bg-gradient-to-r from-transparent via-slate-100 to-transparent" />
          )}

          {/* Low: textarea + submit */}
          {rating > 0 && !isHigh && (
            <LowRatingForm
              tenantName={page?.tenant_name}
              rating={rating}
              onSubmit={(comment) => handleSubmit(comment, '')}
              isPending={submit.isPending}
            />
          )}

          {/* High: AI suggestions + Google link */}
          {rating > 0 && isHigh && (
            <HighRatingPanel
              token={token}
              rating={rating}
              tenantName={page?.tenant_name}
              googleReviewUrl={page?.google_review_url}
              onSubmit={handleSubmit}
            />
          )}
        </div>

        <PoweredByBanner />
      </div>
    </div>
  )
}
