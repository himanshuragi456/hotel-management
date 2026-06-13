import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  StarIcon, ChatBubbleBottomCenterTextIcon, ArrowTrendingUpIcon,
  FunnelIcon,
} from '@heroicons/react/24/outline'
import { getFeedbackDashboard } from '@/services/restaurantService'

function StarDisplay({ rating, size = 'sm' }) {
  const sz = size === 'lg' ? 'text-2xl' : 'text-sm'
  return (
    <span className={sz}>
      {[1, 2, 3, 4, 5].map(i => (
        <span key={i} className={i <= rating ? 'text-yellow-400' : 'text-gray-200'}>★</span>
      ))}
    </span>
  )
}

function RatingBar({ star, count, total }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0
  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center gap-1 w-12 shrink-0">
        <span className="text-xs font-semibold text-gray-600">{star}</span>
        <span className="text-yellow-400 text-xs">★</span>
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full transition-all ${star >= 4 ? 'bg-green-400' : star === 3 ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-500 w-8 text-right">{count}</span>
      <span className="text-xs text-gray-400 w-8">{pct}%</span>
    </div>
  )
}

export default function FeedbackDashboard() {
  const [from, setFrom]   = useState(() => new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0])
  const [to, setTo]       = useState(() => new Date().toISOString().split('T')[0])
  const [rating, setRating] = useState('')
  const [view, setView]   = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['feedback-dashboard', from, to, rating, view],
    queryFn: () => getFeedbackDashboard({
      from, to,
      ...(rating ? { rating } : {}),
      ...(view   ? { view }   : {}),
    }).then(r => r.data.data),
  })

  const stats       = data?.stats ?? {}
  const submissions = data?.submissions?.data ?? []
  const inp = 'border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-white'

  const STAT_CARDS = [
    { label: 'Avg Rating', value: stats.average ?? '—', sub: stats.average ? <StarDisplay rating={Math.round(stats.average)} /> : null, color: 'from-yellow-500 to-orange-500', bg: 'bg-yellow-50', text: 'text-yellow-500' },
    { label: 'Total Reviews', value: stats.total ?? 0, color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', text: 'text-blue-600' },
    { label: 'Public (>3★)', value: stats.public ?? 0, color: 'from-emerald-500 to-teal-600', bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { label: 'Internal (≤3★)', value: stats.internal ?? 0, color: 'from-rose-500 to-red-600', bg: 'bg-rose-50', text: 'text-rose-600' },
  ]

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Feedback Dashboard</h2>
        <p className="text-sm text-gray-400 mt-0.5">Customer ratings and review analytics</p>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4">
        <div className="flex items-center gap-2 mb-3">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-700">Filters</span>
        </div>
        <div className="flex flex-wrap gap-3 items-center">
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-gray-500">From</label>
            <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} />
            <label className="text-xs font-medium text-gray-500">To</label>
            <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} />
          </div>
          <select value={rating} onChange={e => setRating(e.target.value)} className={inp}>
            <option value="">All ratings</option>
            {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} ★</option>)}
          </select>
          <div className="flex gap-1.5">
            {[['', 'All'], ['public', 'Public'], ['internal', 'Internal']].map(([val, label]) => (
              <button key={val} onClick={() => setView(val)}
                className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors ${view === val ? 'bg-orange-500 text-white shadow-sm' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {STAT_CARDS.map(({ label, value, sub, bg, text }) => (
          <div key={label} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
            <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <StarIcon className={`w-4.5 h-4.5 ${text}`} />
            </div>
            <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-3xl font-bold ${text}`}>{value}</p>
            {sub && <div className="mt-1">{sub}</div>}
          </div>
        ))}
      </div>

      {/* Rating breakdown */}
      {stats.breakdown && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          <div className="flex items-center gap-2 mb-5">
            <div className="w-8 h-8 rounded-xl bg-yellow-50 flex items-center justify-center">
              <ArrowTrendingUpIcon className="w-4 h-4 text-yellow-500" />
            </div>
            <h3 className="font-semibold text-gray-900 text-sm">Rating Breakdown</h3>
          </div>
          <div className="space-y-3">
            {[5, 4, 3, 2, 1].map(star => (
              <RatingBar key={star} star={star} count={stats.breakdown[star] ?? 0} total={stats.total ?? 0} />
            ))}
          </div>
        </div>
      )}

      {/* Submissions list */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 bg-gray-50/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ChatBubbleBottomCenterTextIcon className="w-4 h-4 text-gray-400" />
            <span className="font-semibold text-gray-800 text-sm">Submissions</span>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-white border border-gray-200 px-2.5 py-1 rounded-full">{data?.submissions?.total ?? 0} total</span>
        </div>
        {isLoading ? (
          <div className="space-y-px">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4">
                <div className="h-4 w-24 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 flex-1 bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
              </div>
            ))}
          </div>
        ) : submissions.length === 0 ? (
          <div className="py-16 text-center">
            <StarIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
            <p className="text-gray-400 font-medium">No feedback yet in this range</p>
            <p className="text-sm text-gray-400 mt-1">Adjust your date filters to see more</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {submissions.map(sub => (
              <div key={sub.id} className="px-5 py-4 hover:bg-gray-50/60 transition-colors">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1.5">
                      <StarDisplay rating={sub.rating} />
                      {sub.is_internal ? (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-medium">Internal</span>
                      ) : (
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full font-medium">Public</span>
                      )}
                      {sub.qr_code?.label && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{sub.qr_code.label}</span>
                      )}
                    </div>
                    {sub.comment && (
                      <p className="text-sm text-gray-700 leading-relaxed">"{sub.comment}"</p>
                    )}
                    {sub.submitter_name && (
                      <p className="text-xs text-gray-400 mt-1.5 font-medium">{sub.submitter_name}{sub.submitter_phone ? ` · ${sub.submitter_phone}` : ''}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0 mt-0.5">
                    {new Date(sub.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
