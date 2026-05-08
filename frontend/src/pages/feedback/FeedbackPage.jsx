import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { useQuery, useMutation } from '@tanstack/react-query'
import { getFeedbackPage, submitFeedback, getAiSuggestions } from '@/services/restaurantService'

function StarRating({ value, onChange }) {
  const [hovered, setHovered] = useState(0)
  return (
    <div className="flex gap-2 justify-center">
      {[1, 2, 3, 4, 5].map(star => (
        <button
          key={star}
          type="button"
          onClick={() => onChange(star)}
          onMouseEnter={() => setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          className="text-5xl transition-transform hover:scale-110 active:scale-95"
        >
          <span className={(hovered || value) >= star ? 'text-yellow-400' : 'text-gray-200'}>★</span>
        </button>
      ))}
    </div>
  )
}

const RATING_LABELS = {
  1: 'Very Poor',
  2: 'Poor',
  3: 'Average',
  4: 'Good',
  5: 'Excellent!',
}

function AiSuggestionsPanel({ token, rating, comment, googleReviewUrl }) {
  const [copied, setCopied] = useState(null)
  const { data, isLoading, error } = useQuery({
    queryKey: ['ai-suggestions', token, rating],
    queryFn: () => getAiSuggestions(token, { rating, comment }).then(r => r.data.data.suggestions),
    enabled: rating >= 4,
    retry: 1,
  })

  const copyAndOpen = (text, idx) => {
    navigator.clipboard?.writeText(text).catch(() => {})
    setCopied(idx)
    setTimeout(() => setCopied(null), 2000)
    if (googleReviewUrl) {
      setTimeout(() => window.open(googleReviewUrl, '_blank'), 400)
    }
  }

  return (
    <div className="mt-4">
      <p className="text-sm font-medium text-gray-700 mb-3 text-center">
        Tap a suggestion to copy it, then paste it in your Google review:
      </p>
      {isLoading ? (
        <div className="flex justify-center py-4">
          <div className="text-gray-400 text-sm animate-pulse">Generating suggestions…</div>
        </div>
      ) : error ? null : (
        <div className="space-y-3">
          {data?.map((suggestion, idx) => (
            <button
              key={idx}
              onClick={() => copyAndOpen(suggestion, idx)}
              className={`w-full text-left px-4 py-3 rounded-2xl border-2 text-sm transition-all ${
                copied === idx
                  ? 'border-green-400 bg-green-50 text-green-800'
                  : 'border-gray-200 bg-white hover:border-orange-300 hover:bg-orange-50 text-gray-700'
              }`}
            >
              {copied === idx ? '✓ Copied! Opening Google Reviews…' : `"${suggestion}"`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function ThankYouHigh({ tenantName, googleReviewUrl, rating, comment, token }) {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex flex-col items-center justify-center p-6 text-center">
      <div className="text-7xl mb-4">🎉</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank you!</h1>
      <p className="text-gray-500 mb-1">We're thrilled you had a great experience at</p>
      <p className="font-semibold text-gray-900 text-lg mb-6">{tenantName}</p>

      {googleReviewUrl && (
        <div className="w-full max-w-sm">
          <div className="bg-white rounded-2xl border border-yellow-200 p-5 mb-4">
            <div className="flex justify-center mb-3">
              {[1,2,3,4,5].map(s => <span key={s} className={`text-2xl ${s <= rating ? 'text-yellow-400' : 'text-gray-200'}`}>★</span>)}
            </div>
            <p className="text-sm text-gray-600 mb-4">Would you mind sharing your experience on Google? It helps us a lot!</p>
            <a
              href={googleReviewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="block w-full bg-blue-600 text-white py-3 rounded-xl font-semibold text-sm text-center hover:bg-blue-700"
            >
              Write a Google Review →
            </a>
          </div>

          <AiSuggestionsPanel
            token={token}
            rating={rating}
            comment={comment}
            googleReviewUrl={googleReviewUrl}
          />
        </div>
      )}

      {!googleReviewUrl && (
        <div className="text-sm text-gray-400">Your feedback has been recorded. Thank you!</div>
      )}
    </div>
  )
}

function ThankYouLow({ tenantName }) {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 text-center">
      <div className="text-7xl mb-4">🙏</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Thank you for your feedback</h1>
      <p className="text-gray-500 mb-6">We're sorry your experience wasn't perfect at <span className="font-semibold text-gray-700">{tenantName}</span>.</p>
      <div className="bg-orange-50 border border-orange-200 rounded-2xl px-6 py-4 max-w-xs">
        <p className="text-sm text-orange-800">
          Your feedback has been shared with our management team. We'll work hard to improve.
        </p>
      </div>
    </div>
  )
}

export default function FeedbackPage() {
  const { token } = useParams()
  const [rating, setRating]   = useState(0)
  const [comment, setComment] = useState('')
  const [name, setName]       = useState('')
  const [submitted, setSubmitted] = useState(null)

  const { data: page, isLoading, error } = useQuery({
    queryKey: ['feedback-page', token],
    queryFn: () => getFeedbackPage(token).then(r => r.data.data),
  })

  const submit = useMutation({
    mutationFn: () => submitFeedback(token, { rating, comment, submitter_name: name || undefined }),
    onSuccess: (res) => setSubmitted(res.data.data),
  })

  if (isLoading) return (
    <div className="min-h-screen bg-white flex items-center justify-center">
      <div className="text-4xl animate-bounce">⭐</div>
    </div>
  )

  if (error) return (
    <div className="min-h-screen bg-white flex items-center justify-center p-6 text-center">
      <div>
        <div className="text-5xl mb-4">😕</div>
        <p className="font-semibold text-gray-800">This feedback link is no longer active.</p>
      </div>
    </div>
  )

  if (submitted) {
    return submitted.is_internal
      ? <ThankYouLow tenantName={page?.tenant_name} />
      : <ThankYouHigh
          tenantName={page?.tenant_name}
          googleReviewUrl={submitted.google_review_url}
          rating={submitted.rating}
          comment={comment}
          token={token}
        />
  }

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* Header */}
      <div className="bg-gradient-to-b from-orange-50 to-white px-6 pt-10 pb-6 text-center">
        <div className="text-4xl mb-3">⭐</div>
        <h1 className="text-xl font-bold text-gray-900">{page?.tenant_name}</h1>
        <p className="text-sm text-gray-500 mt-1">How was your experience?</p>
        {page?.label && <p className="text-xs text-gray-400 mt-0.5 capitalize">{page.placement} · {page.label}</p>}
      </div>

      <div className="flex-1 px-6 pb-10 max-w-md mx-auto w-full">
        {/* Star rating */}
        <div className="mb-6 text-center">
          <StarRating value={rating} onChange={setRating} />
          {rating > 0 && (
            <p className={`mt-3 text-sm font-semibold ${rating >= 4 ? 'text-green-600' : rating === 3 ? 'text-yellow-600' : 'text-red-500'}`}>
              {RATING_LABELS[rating]}
            </p>
          )}
        </div>

        {rating > 0 && (
          <div className="space-y-4">
            {/* Comment */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                {rating >= 4 ? 'Tell us what you loved (optional)' : 'What could we do better? (optional)'}
              </label>
              <textarea
                value={comment}
                onChange={e => setComment(e.target.value)}
                rows={3}
                placeholder="Your feedback helps us improve…"
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
              />
            </div>

            {/* Name (optional) */}
            <div>
              <input
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Your name (optional)"
                className="w-full border border-gray-300 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            <button
              onClick={() => submit.mutate()}
              disabled={submit.isPending}
              className="w-full bg-orange-500 text-white py-4 rounded-2xl font-bold text-base disabled:opacity-50 hover:bg-orange-600 active:scale-95 transition-transform"
            >
              {submit.isPending ? 'Submitting…' : 'Submit Feedback'}
            </button>
          </div>
        )}

        {rating === 0 && (
          <p className="text-center text-gray-400 text-sm mt-2">Tap a star to rate your experience</p>
        )}
      </div>
    </div>
  )
}
