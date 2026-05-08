export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse bg-gray-200 rounded ${className}`} />
}

export function SkeletonCard({ lines = 3 }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 space-y-3">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-7 w-32" />
      {lines > 2 && <Skeleton className="h-2 w-20" />}
    </div>
  )
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="bg-white rounded-xl border overflow-hidden">
      <div className="bg-gray-50 border-b px-4 py-3 flex gap-6">
        {[...Array(cols)].map((_, i) => <Skeleton key={i} className="h-3 w-20" />)}
      </div>
      <div className="divide-y divide-gray-100">
        {[...Array(rows)].map((_, r) => (
          <div key={r} className="px-4 py-3 flex gap-6">
            {[...Array(cols)].map((_, c) => <Skeleton key={c} className={`h-3 ${c === 0 ? 'w-24' : 'w-16'}`} />)}
          </div>
        ))}
      </div>
    </div>
  )
}
