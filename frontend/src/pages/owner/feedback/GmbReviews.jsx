import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  StarIcon, ArrowPathIcon, SparklesIcon, PaperAirplaneIcon,
  CheckCircleIcon, XMarkIcon, ExclamationCircleIcon,
} from '@heroicons/react/24/outline'
import { StarIcon as StarSolid } from '@heroicons/react/24/solid'
import {
  getGmbReviews, syncGmbReviews, generateAiReviewReply, postGmbReply, getGmbStatus,
} from '@/services/restaurantService'

const STAR_COLORS = { 5: 'text-green-600', 4: 'text-green-500', 3: 'text-yellow-500', 2: 'text-orange-500', 1: 'text-red-500' }
const STATUS_BADGE = {
  none:         { label: 'No reply',     cls: 'bg-gray-100 text-gray-500' },
  pending_ai:   { label: 'Processing',   cls: 'bg-yellow-100 text-yellow-700' },
  ai_generated: { label: 'Draft ready',  cls: 'bg-blue-100 text-blue-700' },
  posted:       { label: 'Replied',       cls: 'bg-green-100 text-green-700' },
  failed:       { label: 'Failed',        cls: 'bg-red-100 text-red-600' },
}

function Stars({ rating }) {
  return (
    <div className="flex items-center gap-0.5">
      {[1,2,3,4,5].map(i => (
        i <= rating
          ? <StarSolid key={i} className={`w-3.5 h-3.5 ${STAR_COLORS[rating] || 'text-yellow-400'}`} />
          : <StarIcon key={i} className="w-3.5 h-3.5 text-gray-300" />
      ))}
    </div>
  )
}

function ReviewCard({ review }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [replyText, setReplyText] = useState(review.ai_reply_draft || review.reply_text || '')
  const [expanded, setExpanded] = useState(false)

  const generateReply = useMutation({
    mutationFn: () => generateAiReviewReply(review.id),
    onSuccess: (res) => {
      setReplyText(res.data.data.draft)
      setEditing(true)
      qc.invalidateQueries({ queryKey: ['gmb-reviews'] })
    },
  })

  const postReply = useMutation({
    mutationFn: () => postGmbReply(review.id, { reply_text: replyText }),
    onSuccess: () => {
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['gmb-reviews'] })
    },
  })

  const badge = STATUS_BADGE[review.reply_status] || STATUS_BADGE.none
  const timeAgo = new Date(review.review_time).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-3">
          {review.reviewer_photo ? (
            <img src={review.reviewer_photo} alt="" className="w-9 h-9 rounded-full object-cover shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center shrink-0">
              <span className="text-sm font-semibold text-gray-400">{(review.reviewer_name || '?')[0].toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="text-sm font-semibold text-gray-900">{review.reviewer_name || 'Anonymous'}</p>
            <div className="flex items-center gap-2 mt-0.5">
              <Stars rating={review.star_rating} />
              <span className="text-xs text-gray-400">{timeAgo}</span>
            </div>
          </div>
        </div>
        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full shrink-0 ${badge.cls}`}>{badge.label}</span>
      </div>

      {review.comment && (
        <div className="mb-3">
          <p className={`text-sm text-gray-600 ${!expanded && review.comment.length > 160 ? 'line-clamp-3' : ''}`}>
            {review.comment}
          </p>
          {review.comment.length > 160 && (
            <button onClick={() => setExpanded(!expanded)} className="text-xs text-orange-500 mt-1 hover:underline">
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      )}

      {/* Existing posted reply */}
      {review.reply_status === 'posted' && review.reply_text && !editing && (
        <div className="bg-gray-50 rounded-xl p-3 mb-3 border-l-2 border-orange-300">
          <p className="text-xs text-gray-500 font-medium mb-1">Your reply</p>
          <p className="text-sm text-gray-600">{review.reply_text}</p>
        </div>
      )}

      {/* Draft editing area */}
      {(editing || review.reply_status === 'ai_generated') && (
        <div className="mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-500 font-medium">Reply draft</p>
            <button onClick={() => setEditing(false)}>
              <XMarkIcon className="w-4 h-4 text-gray-400 hover:text-gray-600" />
            </button>
          </div>
          <textarea
            value={replyText}
            onChange={e => setReplyText(e.target.value)}
            rows={4}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 resize-none"
            placeholder="Write your reply…"
          />
          <button
            onClick={() => postReply.mutate()}
            disabled={postReply.isPending || !replyText.trim()}
            className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-40 hover:shadow-md transition-shadow"
          >
            {postReply.isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <PaperAirplaneIcon className="w-4 h-4" />}
            {postReply.isPending ? 'Posting…' : 'Post Reply to Google'}
          </button>
        </div>
      )}

      {/* Action buttons */}
      {review.reply_status !== 'posted' && !editing && (
        <div className="flex gap-2">
          <button
            onClick={() => generateReply.mutate()}
            disabled={generateReply.isPending}
            className="flex-1 flex items-center justify-center gap-1.5 border border-orange-200 text-orange-600 text-xs py-2 rounded-xl font-medium hover:bg-orange-50 transition-colors disabled:opacity-50"
          >
            {generateReply.isPending ? <ArrowPathIcon className="w-3.5 h-3.5 animate-spin" /> : <SparklesIcon className="w-3.5 h-3.5" />}
            {generateReply.isPending ? 'Generating…' : 'AI Reply'}
          </button>
          <button
            onClick={() => setEditing(true)}
            className="flex-1 border border-gray-200 text-gray-600 text-xs py-2 rounded-xl font-medium hover:bg-gray-50 transition-colors"
          >
            Write manually
          </button>
        </div>
      )}

      {review.reply_status === 'posted' && !editing && (
        <button
          onClick={() => { setReplyText(review.reply_text || ''); setEditing(true) }}
          className="text-xs text-gray-400 hover:text-gray-600 hover:underline"
        >
          Edit reply
        </button>
      )}
    </div>
  )
}

export default function GmbReviews() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('all') // all | unreplied | replied

  const { data: status } = useQuery({
    queryKey: ['gmb-status'],
    queryFn: () => getGmbStatus().then(r => r.data.data),
  })

  const { data: reviewsData, isLoading } = useQuery({
    queryKey: ['gmb-reviews', filter],
    queryFn: () => {
      const params = {}
      if (filter === 'unreplied') params.reply_status = 'none'
      if (filter === 'replied')   params.reply_status = 'posted'
      return getGmbReviews(params).then(r => r.data.data)
    },
    enabled: !!status?.connected,
  })

  const sync = useMutation({
    mutationFn: syncGmbReviews,
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmb-reviews'] }),
  })

  const reviews = reviewsData?.data ?? []
  const total   = reviewsData?.total ?? 0

  if (!status?.connected || !status?.location_name) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ExclamationCircleIcon className="w-12 h-12 text-gray-200 mb-4" />
        <p className="text-gray-500 font-medium">Google Business not connected</p>
        <p className="text-sm text-gray-400 mt-1">Connect your Google account in the Setup tab first.</p>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Google Reviews</h2>
          <p className="text-sm text-gray-400 mt-0.5">{status.location_name}</p>
        </div>
        <button
          onClick={() => sync.mutate()}
          disabled={sync.isPending}
          className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <ArrowPathIcon className={`w-4 h-4 ${sync.isPending ? 'animate-spin' : ''}`} />
          {sync.isPending ? 'Syncing…' : 'Sync Reviews'}
        </button>
      </div>

      {status.auto_reply_enabled && (
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          <CheckCircleIcon className="w-4 h-4 text-green-500 shrink-0" />
          <p className="text-sm text-green-700">Auto AI Reply is <strong>on</strong> — new reviews will be replied to automatically.</p>
        </div>
      )}

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'all', label: 'All' },
          { key: 'unreplied', label: 'Needs reply' },
          { key: 'replied', label: 'Replied' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setFilter(tab.key)}
            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-colors ${filter === tab.key ? 'bg-white shadow-sm text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-36 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : reviews.length > 0 ? (
        <div className="space-y-3">
          {reviews.map(r => <ReviewCard key={r.id} review={r} />)}
        </div>
      ) : (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <StarIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">
            {filter === 'unreplied' ? 'All reviews have been replied to!' : 'No reviews yet'}
          </p>
          <p className="text-xs text-gray-400 mt-0.5">
            {filter === 'all' ? 'Sync to fetch your latest Google reviews.' : ''}
          </p>
        </div>
      )}
    </div>
  )
}
