export default function Pagination({ meta, onPageChange }) {
  if (!meta || meta.last_page <= 1) return null

  return (
    <div className="flex items-center justify-between text-sm text-gray-600 mt-4">
      <span>Showing {meta.from}–{meta.to} of {meta.total}</span>
      <div className="flex gap-1">
        {Array.from({ length: meta.last_page }, (_, i) => i + 1).map((page) => (
          <button
            key={page}
            onClick={() => onPageChange(page)}
            className={`w-8 h-8 rounded text-sm ${
              page === meta.current_page
                ? 'bg-blue-600 text-white'
                : 'hover:bg-gray-100'
            }`}
          >
            {page}
          </button>
        ))}
      </div>
    </div>
  )
}
