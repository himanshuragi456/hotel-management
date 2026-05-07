const colors = {
  active:    'bg-green-100 text-green-700',
  trial:     'bg-blue-100 text-blue-700',
  suspended: 'bg-red-100 text-red-700',
  cancelled: 'bg-gray-100 text-gray-600',
  past_due:  'bg-yellow-100 text-yellow-700',
  expired:   'bg-orange-100 text-orange-700',
  monthly:   'bg-purple-100 text-purple-700',
  yearly:    'bg-indigo-100 text-indigo-700',
  manual:    'bg-gray-100 text-gray-600',
  stripe:    'bg-violet-100 text-violet-700',
  razorpay:  'bg-sky-100 text-sky-700',
}

export default function Badge({ value, label }) {
  const text = label ?? value
  const cls = colors[value] ?? 'bg-gray-100 text-gray-600'
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium capitalize ${cls}`}>
      {text}
    </span>
  )
}
