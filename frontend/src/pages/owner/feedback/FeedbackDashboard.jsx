import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
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
      <div className="flex items-center gap-0.5 w-20 shrink-0">
        <span className="text-xs text-gray-500 w-3">{star}</span>
        <span className="text-yellow-400 text-xs">★</span>
      </div>
      <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
        <div
          className={`h-2 rounded-full ${star >= 4 ? 'bg-green-400' : star === 3 ? 'bg-yellow-400' : 'bg-red-400'}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="text-xs text-gray-500 w-10 text-right">{count}</span>
    </div>
  )
}

export default function FeedbackDashboard() {
  const today         = new Date().toISOString().split('T')[0]
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0]
  const [from, setFrom]   = useState(thirtyDaysAgo)
  const [to, setTo]       = useState(today)
  const [rating, setRating] = useState('')
  const [view, setView]   = useState('')  // '' | 'public' | 'internal'

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
  const inp = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="max-w-4xl space-y-6">
      <h2 className="text-xl font-semibold text-gray-900">Feedback Dashboard</h2>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex items-center gap-2">
          <label className="text-sm text-gray-500">From</label>
          <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} />
          <label className="text-sm text-gray-500">To</label>
          <input type="date" value={to} onChange={e => setTo(e.target.value)} className={inp} />
        </div>
        <select value={rating} onChange={e => setRating(e.target.value)} className={inp}>
          <option value="">All ratings</option>
          {[5,4,3,2,1].map(r => <option key={r} value={r}>{r} ★</option>)}
        </select>
        <div className="flex gap-1">
          {[['', 'All'], ['public', 'Public (>3★)'], ['internal', 'Internal (≤3★)']].map(([val, label]) => (
            <button key={val} onClick={() => setView(val)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium ${view === val ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-yellow-500">{stats.average ?? '—'}</div>
          <div className="text-xs text-gray-500 mt-1">Avg Rating</div>
          {stats.average && <StarDisplay rating={Math.round(stats.average)} />}
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-gray-900">{stats.total ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Total Reviews</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-green-600">{stats.public ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Public (&gt;3★)</div>
        </div>
        <div className="bg-white rounded-xl border p-4 text-center">
          <div className="text-3xl font-bold text-red-500">{stats.internal ?? 0}</div>
          <div className="text-xs text-gray-500 mt-1">Internal (≤3★)</div>
        </div>
      </div>

      {/* Rating breakdown */}
      {stats.breakdown && (
        <div className="bg-white rounded-xl border p-5">
          <h3 className="font-medium text-gray-800 mb-4 text-sm">Rating Breakdown</h3>
          <div className="space-y-2">
            {[5, 4, 3, 2, 1].map(star => (
              <RatingBar key={star} star={star} count={stats.breakdown[star] ?? 0} total={stats.total ?? 0} />
            ))}
          </div>
        </div>
      )}

      {/* Submissions list */}
      <div className="bg-white rounded-xl border overflow-hidden">
        <div className="px-4 py-3 border-b bg-gray-50 flex items-center justify-between">
          <span className="font-medium text-gray-800 text-sm">Submissions</span>
          <span className="text-xs text-gray-400">{data?.submissions?.total ?? 0} total</span>
        </div>
        {isLoading ? (
          <div className="py-10 text-center text-gray-400 text-sm">Loading…</div>
        ) : submissions.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <div className="text-4xl mb-3">⭐</div>
            <p>No feedback yet in this range</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {submissions.map(sub => (
              <div key={sub.id} className="px-4 py-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <StarDisplay rating={sub.rating} />
                      {sub.is_internal && (
                        <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Internal</span>
                      )}
                      {!sub.is_internal && (
                        <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">Public</span>
                      )}
                      {sub.qr_code?.label && (
                        <span className="text-xs text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full capitalize">{sub.qr_code.label}</span>
                      )}
                    </div>
                    {sub.comment && (
                      <p className="text-sm text-gray-700 mt-1">{sub.comment}</p>
                    )}
                    {sub.submitter_name && (
                      <p className="text-xs text-gray-400 mt-1">{sub.submitter_name}{sub.submitter_phone ? ` · ${sub.submitter_phone}` : ''}</p>
                    )}
                  </div>
                  <div className="text-xs text-gray-400 shrink-0">
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
