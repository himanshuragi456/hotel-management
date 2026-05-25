import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  SparklesIcon, ArrowPathIcon, CheckCircleIcon, XMarkIcon,
  CalendarIcon, TagIcon, MegaphoneIcon, ExclamationCircleIcon,
  PencilSquareIcon,
} from '@heroicons/react/24/outline'
import {
  getGmbPosts, generateGmbPostSuggestions, publishGmbPost,
  dismissGmbPost, updateGmbPost, getGmbStatus,
} from '@/services/restaurantService'

const TYPE_META = {
  STANDARD: { label: 'Update',  icon: MegaphoneIcon,  cls: 'bg-blue-100 text-blue-700' },
  EVENT:    { label: 'Event',   icon: CalendarIcon,   cls: 'bg-purple-100 text-purple-700' },
  OFFER:    { label: 'Offer',   icon: TagIcon,        cls: 'bg-green-100 text-green-700' },
}

const CTA_LABELS = {
  LEARN_MORE: 'Learn More', ORDER: 'Order Now', BOOK: 'Book', CALL: 'Call Now', SHOP: 'Shop',
}

function PostCard({ post, onPublish, onDismiss }) {
  const qc = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(post.summary)

  const meta = TYPE_META[post.post_type] || TYPE_META.STANDARD
  const Icon = meta.icon

  const saveEdit = useMutation({
    mutationFn: () => updateGmbPost(post.id, { summary: draft }),
    onSuccess: () => {
      setEditing(false)
      qc.invalidateQueries({ queryKey: ['gmb-posts'] })
    },
  })

  const isPublished = post.status === 'published'
  const isDismissed = post.status === 'dismissed'

  return (
    <div className={`bg-white rounded-2xl border p-4 transition-all ${isPublished ? 'border-green-200 bg-green-50/30' : isDismissed ? 'border-dashed border-gray-200 opacity-50' : 'border-gray-100 shadow-sm hover:shadow-md'}`}>
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full ${meta.cls}`}>
            <Icon className="w-3.5 h-3.5" />{meta.label}
          </span>
          {post.topic && <span className="text-xs text-gray-500 font-medium">{post.topic}</span>}
        </div>
        {isPublished && (
          <span className="inline-flex items-center gap-1 text-xs bg-green-100 text-green-700 font-medium px-2.5 py-1 rounded-full shrink-0">
            <CheckCircleIcon className="w-3.5 h-3.5" />Published
          </span>
        )}
      </div>

      {/* Post body */}
      {editing ? (
        <div className="space-y-2 mb-3">
          <textarea
            value={draft}
            onChange={e => setDraft(e.target.value)}
            rows={5}
            className="w-full text-sm border border-gray-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 resize-none"
          />
          <div className="flex gap-2">
            <button
              onClick={() => saveEdit.mutate()}
              disabled={saveEdit.isPending}
              className="flex-1 bg-gray-800 text-white text-xs py-2 rounded-xl font-medium hover:bg-gray-700 transition-colors disabled:opacity-50"
            >
              {saveEdit.isPending ? 'Saving…' : 'Save'}
            </button>
            <button onClick={() => { setEditing(false); setDraft(post.summary) }}
              className="flex-1 border border-gray-200 text-xs py-2 rounded-xl text-gray-500 hover:bg-gray-50 transition-colors">
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-gray-700 mb-3 leading-relaxed">{post.summary}</p>
      )}

      {/* Event details */}
      {post.post_type === 'EVENT' && post.event_title && (
        <div className="bg-purple-50 rounded-xl px-3 py-2 mb-3 text-xs text-purple-700">
          <span className="font-semibold">{post.event_title}</span>
          {post.event_start_date && <span className="text-purple-500 ml-2">{post.event_start_date} → {post.event_end_date}</span>}
        </div>
      )}

      {/* Offer details */}
      {post.post_type === 'OFFER' && post.offer_coupon_code && (
        <div className="bg-green-50 rounded-xl px-3 py-2 mb-3 text-xs text-green-700">
          Coupon: <span className="font-mono font-bold">{post.offer_coupon_code}</span>
        </div>
      )}

      {/* CTA */}
      {post.call_to_action_type && (
        <div className="text-xs text-gray-400 mb-3">
          CTA: <span className="font-medium text-gray-600">{CTA_LABELS[post.call_to_action_type] || post.call_to_action_type}</span>
          {post.call_to_action_url && <span className="ml-1 text-blue-400 truncate"> → {post.call_to_action_url}</span>}
        </div>
      )}

      {/* Actions */}
      {!isPublished && !isDismissed && !editing && (
        <div className="flex gap-2">
          <button
            onClick={() => onPublish(post.id)}
            className="flex-1 flex items-center justify-center gap-1.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-xs py-2.5 rounded-xl font-semibold hover:shadow-md transition-shadow"
          >
            <CheckCircleIcon className="w-3.5 h-3.5" />Post to Google
          </button>
          <button
            onClick={() => setEditing(true)}
            className="w-9 h-9 rounded-xl bg-gray-100 hover:bg-gray-200 flex items-center justify-center transition-colors"
            title="Edit"
          >
            <PencilSquareIcon className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => onDismiss(post.id)}
            className="w-9 h-9 rounded-xl bg-red-50 hover:bg-red-100 flex items-center justify-center transition-colors"
            title="Dismiss"
          >
            <XMarkIcon className="w-4 h-4 text-red-400" />
          </button>
        </div>
      )}

      {isPublished && post.published_at && (
        <p className="text-xs text-green-600">
          Published {new Date(post.published_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
        </p>
      )}
    </div>
  )
}

export default function GmbPosts() {
  const qc = useQueryClient()
  const [filter, setFilter] = useState('suggested')

  const { data: status } = useQuery({
    queryKey: ['gmb-status'],
    queryFn: () => getGmbStatus().then(r => r.data.data),
  })

  const { data: posts, isLoading } = useQuery({
    queryKey: ['gmb-posts', filter],
    queryFn: () => getGmbPosts(filter !== 'all' ? { status: filter } : {}).then(r => r.data.data),
    enabled: !!status?.connected,
  })

  const generate = useMutation({
    mutationFn: generateGmbPostSuggestions,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['gmb-posts'] })
      setFilter('suggested')
    },
  })

  const publish = useMutation({
    mutationFn: (postId) => publishGmbPost(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmb-posts'] }),
  })

  const dismiss = useMutation({
    mutationFn: (postId) => dismissGmbPost(postId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['gmb-posts'] }),
  })

  if (!status?.connected || !status?.location_name) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <ExclamationCircleIcon className="w-12 h-12 text-gray-200 mb-4" />
        <p className="text-gray-500 font-medium">Google Business not connected</p>
        <p className="text-sm text-gray-400 mt-1">Connect your Google account in the Setup tab first.</p>
      </div>
    )
  }

  const suggestedCount = Array.isArray(posts) ? posts.filter(p => p.status === 'suggested').length : 0

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">GMB Post Suggestions</h2>
          <p className="text-sm text-gray-400 mt-0.5">AI-generated posts to boost your local SEO ranking</p>
        </div>
        <button
          onClick={() => generate.mutate()}
          disabled={generate.isPending}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow"
        >
          {generate.isPending ? <ArrowPathIcon className="w-4 h-4 animate-spin" /> : <SparklesIcon className="w-4 h-4" />}
          {generate.isPending ? 'Generating…' : 'Generate This Week\'s Posts'}
        </button>
      </div>

      {/* Info banner */}
      <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 flex items-start gap-3">
        <SparklesIcon className="w-4 h-4 text-orange-500 mt-0.5 shrink-0" />
        <p className="text-xs text-orange-700">
          AI generates 3 weekly posts (Update, Event, Offer) tailored to your business to help you rank higher on Google Maps.
          Review and publish with one click — new suggestions every Monday.
        </p>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        {[
          { key: 'suggested', label: `Pending${suggestedCount > 0 ? ` (${suggestedCount})` : ''}` },
          { key: 'published', label: 'Published' },
          { key: 'dismissed', label: 'Dismissed' },
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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1,2,3].map(i => <div key={i} className="h-52 bg-gray-100 rounded-2xl animate-pulse" />)}
        </div>
      ) : posts?.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {posts.map(p => (
            <PostCard
              key={p.id}
              post={p}
              onPublish={(id) => publish.mutate(id)}
              onDismiss={(id) => dismiss.mutate(id)}
            />
          ))}
        </div>
      ) : (
        <div className="py-16 text-center border-2 border-dashed border-gray-200 rounded-2xl">
          <SparklesIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
          <p className="text-sm text-gray-400 font-medium">
            {filter === 'suggested' ? 'No pending suggestions' : `No ${filter} posts yet`}
          </p>
          {filter === 'suggested' && (
            <p className="text-xs text-gray-400 mt-1">Click "Generate" above to create this week's posts.</p>
          )}
        </div>
      )}
    </div>
  )
}
