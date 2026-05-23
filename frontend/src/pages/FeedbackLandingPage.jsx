import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const Icon = ({ d, size = 20, className = '' }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none"
    stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
    className={className} aria-hidden="true">
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
)

const icons = {
  qr:          ['M3 3h6v6H3z','M15 3h6v6h-6z','M3 15h6v6H3z','M15 15h2v2h-2z','M19 15v2','M15 19h2','M19 19h2v2h-2z'],
  star:        'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
  check:       'M20 6L9 17l-5-5',
  zap:         ['M13 2L3 14h9l-1 8 10-12h-9l1-8z'],
  arrowRight:  'M5 12h14M12 5l7 7-7 7',
  close:       'M18 6L6 18M6 6l12 12',
  hamMenu:     'M3 12h18M3 6h18M3 18h18',
  chevronDown: 'M6 9l6 6 6-6',
  chevronUp:   'M18 15l-6-6-6 6',
  mail:        ['M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z','M22 6l-10 7L2 6'],
  phone:       'M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z',
  map:         ['M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z','M12 7a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'],
  calendar:    ['M8 2v4','M16 2v4','M3 10h18','M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6z'],
  google:      ['M21.805 10.023H12v3.955h5.585c-.24 1.3-.964 2.4-2.054 3.136v2.608h3.32c1.942-1.788 3.063-4.424 3.063-7.56 0-.538-.05-1.066-.11-1.589z','M12 22c2.7 0 4.964-.895 6.618-2.427l-3.32-2.609c-.91.61-2.074.97-3.298.97-2.536 0-4.687-1.713-5.455-4.013H3.12v2.692A10 10 0 0 0 12 22z','M6.545 13.921A5.98 5.98 0 0 1 6.23 12c0-.673.115-1.326.315-1.921V7.387H3.12A10 10 0 0 0 2 12c0 1.614.387 3.14 1.12 4.613l3.425-2.692z','M12 6.058c1.43 0 2.715.493 3.726 1.46l2.797-2.797C16.96 3.144 14.695 2.2 12 2.2A10 10 0 0 0 3.12 7.387l3.425 2.692C7.313 7.77 9.464 6.058 12 6.058z'],
  ai:          ['M12 2a2 2 0 0 1 2 2v2h2a2 2 0 0 1 0 4h-2v2a2 2 0 0 1-4 0v-2H8a2 2 0 0 1 0-4h2V4a2 2 0 0 1 2-2z','M4 14a2 2 0 0 0 0 4h16a2 2 0 0 0 0-4'],
  shield:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  analytics:   ['M18 20V10','M12 20V4','M6 20v-6'],
  globe:       ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z','M2 12h20','M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z'],
  table:       ['M3 3h18v18H3z','M3 9h18','M3 15h18','M9 3v18','M15 3v18'],
  download:    ['M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4','M7 10l5 5 5-5','M12 15V3'],
  copy:        ['M20 9H11a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2v-9a2 2 0 0 0-2-2z','M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 0 2 2v1'],
  route:       ['M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z','M13 13l6 6'],
  heart:       'M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z',
  lock:        ['M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z','M7 11V7a5 5 0 0 1 10 0v4'],
  whatsapp:    ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'],
}

function StarRating({ count = 5, size = 16 }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: 5 }).map((_, i) => (
        <svg key={i} width={size} height={size} viewBox="0 0 24 24"
          fill={i < count ? '#FBBF24' : '#E2E8F0'} aria-hidden="true">
          <path d={icons.star} />
        </svg>
      ))}
    </div>
  )
}

/* ─── How it works steps ─── */
const steps = [
  {
    step: '01',
    title: 'Place the QR',
    desc: 'Print your unique Magic QR and place it on tables, at reception, or in rooms. One QR per location, downloadable as a high-res PNG.',
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    ic: 'text-violet-600',
    icon: 'qr',
  },
  {
    step: '02',
    title: 'Guest scans & rates',
    desc: 'Customer scans with their phone camera. A beautiful, mobile-optimised page loads instantly — no app, no login. They tap 1–5 stars and optionally leave a comment.',
    color: 'from-blue-500 to-indigo-600',
    bg: 'bg-blue-50',
    ic: 'text-blue-600',
    icon: 'star',
  },
  {
    step: '03',
    title: 'Smart routing kicks in',
    desc: '4★ or 5★? They\'re shown AI-generated compliment suggestions and a button that opens your Google Reviews page. 3★ or below? Feedback stays internal so you can act on it privately.',
    color: 'from-orange-500 to-rose-500',
    bg: 'bg-orange-50',
    ic: 'text-orange-600',
    icon: 'route',
  },
  {
    step: '04',
    title: 'Your rating climbs',
    desc: 'Happy guests post real Google Reviews. Unhappy ones get a personal apology from your team. Your public rating improves while your private reputation stays protected.',
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
    ic: 'text-emerald-600',
    icon: 'google',
  },
]

/* ─── Feature cards ─── */
const features = [
  {
    icon: 'qr', color: 'from-violet-500 to-purple-600', bg: 'bg-violet-50', ic: 'text-violet-600',
    title: 'Unique QR per Location',
    desc: 'Generate a separate QR for each table, room, or counter. Know exactly which location feedback came from.',
  },
  {
    icon: 'route', color: 'from-orange-500 to-rose-500', bg: 'bg-orange-50', ic: 'text-orange-600',
    title: 'Automatic Review Routing',
    desc: 'Ratings above 3 go to Google. Ratings 3 and below stay internal. Zero manual effort — it\'s all automatic.',
  },
  {
    icon: 'ai', color: 'from-blue-500 to-indigo-600', bg: 'bg-blue-50', ic: 'text-blue-600',
    title: 'AI Review Suggestions',
    desc: 'When a guest rates 4★+, GPT generates 3 personalised compliment suggestions they can copy and post with one tap.',
  },
  {
    icon: 'google', color: 'from-emerald-500 to-teal-500', bg: 'bg-emerald-50', ic: 'text-emerald-600',
    title: 'Google Place Integration',
    desc: 'Plug in your Google Place ID. The "Open Google Reviews" button links directly to your review page — no redirects.',
  },
  {
    icon: 'analytics', color: 'from-rose-500 to-pink-600', bg: 'bg-rose-50', ic: 'text-rose-600',
    title: 'Feedback Analytics Dashboard',
    desc: 'Average rating widget, breakdown by star, rating trend over time, and internal vs public split — all filterable by date.',
  },
  {
    icon: 'shield', color: 'from-slate-500 to-gray-600', bg: 'bg-slate-50', ic: 'text-slate-600',
    title: 'Private Bad Feedback',
    desc: 'Low ratings never appear on Google. They surface only in your internal dashboard so you can personally reach out and resolve.',
  },
  {
    icon: 'download', color: 'from-violet-500 to-blue-600', bg: 'bg-violet-50', ic: 'text-violet-600',
    title: 'Print-Ready QR Download',
    desc: 'Download your QR as a high-resolution PNG ready for printing on table cards, tent cards, or reception stands.',
  },
  {
    icon: 'lock', color: 'from-slate-600 to-slate-800', bg: 'bg-slate-50', ic: 'text-slate-600',
    title: 'No Login for Guests',
    desc: 'Zero friction. Customers scan and leave feedback in under 30 seconds. No account, no app, no registration.',
  },
]

const reviews = [
  { name: 'Rahul Desai', role: 'Owner, Flavours Cafe', before: '3.8', after: '4.6', rating: 5, text: 'Our Google rating went from 3.8 to 4.6 in just 3 months. Every happy customer now goes straight to Google Reviews. We didn\'t change a thing about our food — just made it easy to leave a review.' },
  { name: 'Meera Joshi', role: 'GM, The Heritage Hotel', before: '4.1', after: '4.7', rating: 5, text: 'The best part is the private feedback. We caught a recurring complaint about room service delays before it became a public 1-star review. That\'s worth more than the subscription.' },
  { name: 'Sanjay Pillai', role: 'Owner, Coastline Diner (3 outlets)', before: '4.0', after: '4.8', rating: 5, text: 'I put the QR at the payment counter. While they\'re waiting for the bill, they scan and rate. The AI suggestions make it so easy for them — most people just tap "Copy" and post.' },
  { name: 'Priya Anand', role: 'F&B Head, The Grand Residency', before: '3.9', after: '4.5', rating: 5, text: 'We generate 20–30 new Google reviews every week now with zero manual effort. Our competitor down the road is still asking guests verbally. The gap is visible.' },
]

const faqs = [
  { q: 'Does the guest need to have a Google account to leave a review?', a: 'The AI suggestions and feedback page work without any Google account. To actually post on Google Reviews, the guest needs to be signed into Google — which most people already are on their phone.' },
  { q: 'What exactly is the threshold for routing to Google?', a: 'Any rating of 4 stars or above is routed to Google Reviews. Ratings of 1, 2, or 3 stars are captured internally only. You can see all internal feedback in your dashboard and respond privately.' },
  { q: 'Can I have multiple QR codes for different locations?', a: 'Yes. You can generate a unique QR for each table, room, or floor. Each QR tracks feedback separately so you know exactly which location is performing well (or poorly).' },
  { q: 'What do the AI-generated review suggestions look like?', a: 'They\'re short, natural-sounding review texts based on the rating context — for example, "Great food and friendly service, will definitely come back!" The guest can copy one in one tap, or write their own.' },
  { q: 'Is this a standalone product or does it require other Magic Management modules?', a: 'The Magic QR Feedback System is a standalone module. You don\'t need the billing or table management system to use it. It works for any restaurant, hotel, or café independently.' },
]

// Reuses CalendarBooking from LandingPage pattern — violet variant
function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', type: '', message: '' })
  const [submitted, setSubmitted] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const validateContact = (email, phone) => {
    if (!email.trim() && !phone.trim()) return 'Please provide at least an email or phone number.'
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.'
    if (phone.trim() && !/^[+]?[\d\s\-().]{7,15}$/.test(phone.trim())) return 'Please enter a valid phone number.'
    return null
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    const contactErr = validateContact(form.email, form.phone)
    if (contactErr) { setError(contactErr); return }
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/landing/contact', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...form, outlets: form.type }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Something went wrong')
      setSubmitted(true)
    } catch (err) {
      setError(err.message || 'Failed to send. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (submitted) {
    return (
      <div className="text-center py-10">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Icon d={icons.check} size={28} className="text-emerald-600" />
        </div>
        <h3 className="text-xl font-bold text-slate-800 mb-2">We'll be in touch!</h3>
        <p className="text-slate-500 text-sm">Our team will reach out within 24 hours to get you set up.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" noValidate>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="f-name" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-rose-500">*</span></label>
          <input id="f-name" type="text" required autoComplete="name"
            placeholder="Meera Joshi"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
            value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="f-email" className="block text-sm font-medium text-slate-700 mb-1.5">
            Email <span className="text-slate-400 font-normal text-xs">(or phone)</span>
          </label>
          <input id="f-email" type="email" autoComplete="email"
            placeholder="meera@myrestaurant.com"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
            value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="f-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
            Phone <span className="text-slate-400 font-normal text-xs">(or email)</span>
          </label>
          <input id="f-phone" type="tel" autoComplete="tel"
            placeholder="+91 93014 20919"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
            value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="f-type" className="block text-sm font-medium text-slate-700 mb-1.5">Property Type</label>
          <select id="f-type"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm cursor-pointer"
            value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>
            <option value="">Select…</option>
            <option>Restaurant</option>
            <option>Hotel</option>
            <option>Hotel + Restaurant</option>
            <option>Cafe / QSR</option>
            <option>Other</option>
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="f-message" className="block text-sm font-medium text-slate-700 mb-1.5">Current Google Rating (if known)</label>
        <textarea id="f-message" rows="3"
          placeholder="E.g. we're at 3.9 stars and want to reach 4.5+…"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm resize-none"
          value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
      </div>
      {error && <p className="text-rose-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60 shadow-lg shadow-violet-500/25 text-sm">
        {loading
          ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Sending…</>
          : <><Icon d={icons.mail} size={18} />Get Started — Free Setup</>}
      </button>
    </form>
  )
}

function CalendarBooking() {
  // Import the shared component logic, violet variant
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  const [step, setStep] = useState('calendar') // 'calendar' | 'userinfo' | 'booked'
  const [userInfo, setUserInfo] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const slots = ['10:00 AM', '11:00 AM', '2:00 PM', '3:30 PM', '4:30 PM']
  const monthName = currentMonth.toLocaleString('default', { month: 'long', year: 'numeric' })
  const firstDay = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1).getDay()
  const daysInMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0).getDate()
  const isDisabled = (day) => {
    const d = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
    return d < today || d.getDay() === 0
  }
  const dateLabel = selectedDate?.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })

  const validateContact = (email, phone) => {
    if (!email.trim() && !phone.trim()) return 'Please provide at least an email or phone number.'
    if (email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return 'Please enter a valid email address.'
    if (phone.trim() && !/^[+]?[\d\s\-().]{7,15}$/.test(phone.trim())) return 'Please enter a valid phone number.'
    return null
  }

  const handleConfirm = async () => {
    if (!userInfo.name.trim()) { setError('Please enter your name.'); return }
    const contactErr = validateContact(userInfo.email, userInfo.phone)
    if (contactErr) { setError(contactErr); return }
    setError('')
    setLoading(true)
    try {
      const res = await fetch('/api/landing/book-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ ...userInfo, date: dateLabel, slot: selectedSlot, page: 'Magic QR' }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Something went wrong')
      setStep('booked')
    } catch (err) {
      setError(err.message || 'Failed to book. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (step === 'booked') {
    return (
      <div className="text-center py-8">
        <div className="w-14 h-14 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
          <Icon d={icons.check} size={28} className="text-emerald-600" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 mb-1">Demo Booked!</h3>
        <p className="text-slate-600 text-sm font-medium">{dateLabel} · {selectedSlot}</p>
        <p className="text-slate-400 text-xs mt-1">A confirmation has been sent to {userInfo.email}</p>
      </div>
    )
  }

  if (step === 'userinfo') {
    return (
      <div className="space-y-4">
        <button onClick={() => setStep('calendar')} className="text-xs text-violet-600 hover:underline cursor-pointer focus:outline-none">
          ← {dateLabel} · {selectedSlot}
        </button>
        <p className="text-sm font-semibold text-slate-700">Your details</p>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-rose-500">*</span></label>
          <input type="text" autoComplete="name" placeholder="Meera Joshi"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
            value={userInfo.name} onChange={e => setUserInfo(u => ({ ...u, name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Email <span className="text-slate-400 font-normal">(or phone)</span></label>
          <input type="email" autoComplete="email" placeholder="meera@myrestaurant.com"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
            value={userInfo.email} onChange={e => setUserInfo(u => ({ ...u, email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-xs font-medium text-slate-600 mb-1">Phone <span className="text-slate-400 font-normal">(or email)</span></label>
          <input type="tel" autoComplete="tel" placeholder="+91 93014 20919"
            className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:border-transparent transition-all text-sm"
            value={userInfo.phone} onChange={e => setUserInfo(u => ({ ...u, phone: e.target.value }))} />
        </div>
        {error && <p className="text-rose-500 text-xs">{error}</p>}
        <button onClick={handleConfirm} disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 disabled:opacity-60 shadow-lg shadow-violet-500/25 text-sm">
          {loading
            ? <><span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />Booking…</>
            : <><Icon d={icons.calendar} size={16} />Confirm Demo</>}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-2">
        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() - 1, 1))}
          aria-label="Previous month"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500">
          <Icon d="M15 18l-6-6 6-6" size={15} className="text-slate-500" />
        </button>
        <span className="text-sm font-semibold text-slate-700">{monthName}</span>
        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label="Next month"
          className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500">
          <Icon d="M9 18l6-6-6-6" size={15} className="text-slate-500" />
        </button>
      </div>
      <div className="grid grid-cols-7">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => (
          <div key={d} className="text-center text-[11px] font-medium text-slate-400 pb-1">{d}</div>
        ))}
      </div>
      <div className="grid grid-cols-7 gap-0.5">
        {Array.from({ length: firstDay }).map((_, i) => <div key={`e${i}`} />)}
        {Array.from({ length: daysInMonth }).map((_, i) => {
          const day = i + 1
          const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day)
          const disabled = isDisabled(day)
          const isSelected = selectedDate?.toDateString() === date.toDateString()
          return (
            <button key={day} disabled={disabled}
              onClick={() => { if (!disabled) { setSelectedDate(date); setSelectedSlot(null) } }}
              aria-label={date.toLocaleDateString('en-IN', { day: 'numeric', month: 'long' })}
              aria-pressed={isSelected}
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-1
                ${disabled ? 'text-slate-300 cursor-not-allowed' : 'cursor-pointer hover:bg-violet-50'}
                ${isSelected ? 'bg-violet-600 text-white shadow-md shadow-violet-400/30' : ''}
                ${!disabled && !isSelected ? 'text-slate-700' : ''}`}>
              {day}
            </button>
          )
        })}
      </div>
      {selectedDate && (
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-2">
            {selectedDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} — pick a slot
          </p>
          <div className="grid grid-cols-3 gap-1.5">
            {slots.map(slot => (
              <button key={slot} onClick={() => setSelectedSlot(slot)} aria-pressed={selectedSlot === slot}
                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500
                  ${selectedSlot === slot
                    ? 'bg-violet-600 text-white border-violet-600 shadow-md shadow-violet-400/25'
                    : 'border-slate-200 text-slate-600 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50'}`}>
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}
      {selectedDate && selectedSlot && (
        <button onClick={() => setStep('userinfo')}
          className="w-full py-3.5 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 shadow-lg shadow-violet-500/25 text-sm">
          <Icon d={icons.calendar} size={16} />Next — Your Details
        </button>
      )}
    </div>
  )
}

/* ─── Animated rating demo ─── */
function FeedbackFlowDemo() {
  const [rating, setRating] = useState(0)
  const [hovered, setHovered] = useState(0)
  const [submitted, setSubmitted] = useState(false)

  const handleRate = (r) => {
    setRating(r)
    setTimeout(() => setSubmitted(true), 600)
  }

  const reset = () => { setRating(0); setHovered(0); setSubmitted(false) }

  return (
    <div className="bg-white rounded-2xl shadow-2xl shadow-violet-900/10 border border-violet-100 overflow-hidden max-w-xs mx-auto">
      {/* phone top bar */}
      <div className="bg-slate-50 px-4 pt-3 pb-2 flex items-center justify-center border-b border-slate-100">
        <div className="w-16 h-1.5 rounded-full bg-slate-300" aria-hidden="true" />
      </div>
      {!submitted ? (
        <div className="p-6 text-center">
          <div className="w-14 h-14 bg-gradient-to-br from-violet-500 to-purple-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-400/30">
            <Icon d={icons.qr} size={26} className="text-white" />
          </div>
          <h4 className="font-bold text-slate-800 text-base mb-1">How was your experience?</h4>
          <p className="text-slate-400 text-xs mb-5">Tap a star to rate us</p>
          <div className="flex gap-2 justify-center mb-5">
            {[1,2,3,4,5].map(n => (
              <button key={n}
                onMouseEnter={() => setHovered(n)}
                onMouseLeave={() => setHovered(0)}
                onClick={() => handleRate(n)}
                aria-label={`Rate ${n} stars`}
                className="cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 rounded-full transition-transform hover:scale-125 active:scale-95">
                <svg width="36" height="36" viewBox="0 0 24 24"
                  fill={(hovered || rating) >= n ? '#FBBF24' : '#E2E8F0'}>
                  <path d={icons.star} />
                </svg>
              </button>
            ))}
          </div>
          <textarea className="w-full text-xs text-slate-600 border border-slate-200 rounded-xl px-3 py-2.5 resize-none focus:outline-none focus:ring-2 focus:ring-violet-500" rows="2" placeholder="Optional: tell us more…" readOnly />
        </div>
      ) : rating >= 4 ? (
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icon d={icons.heart} size={22} className="text-emerald-600" />
          </div>
          <p className="font-bold text-slate-800 text-sm mb-1">Thank you so much! 🎉</p>
          <p className="text-slate-400 text-xs mb-4">Would you share your experience on Google? It helps us a lot.</p>
          <div className="space-y-2 mb-4">
            {['Great food and friendly service — will definitely come back!', 'Amazing ambiance and quick service. Highly recommend!', 'Best dining experience in town. The staff is wonderful.'].map((s, i) => (
              <div key={i} className="flex items-center gap-2 bg-slate-50 rounded-xl px-3 py-2 text-left">
                <Icon d={icons.copy} size={13} className="text-violet-400 flex-shrink-0" />
                <span className="text-xs text-slate-600 line-clamp-1">{s}</span>
              </div>
            ))}
          </div>
          <button className="w-full py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-xs font-semibold rounded-xl flex items-center justify-center gap-1.5 cursor-pointer">
            <Icon d={icons.google} size={14} className="text-white" />
            Open Google Reviews
          </button>
          <button onClick={reset} className="mt-2 text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer">Try again</button>
        </div>
      ) : (
        <div className="p-6 text-center">
          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <Icon d={icons.heart} size={22} className="text-rose-500" />
          </div>
          <p className="font-bold text-slate-800 text-sm mb-1">We're sorry to hear that</p>
          <p className="text-slate-500 text-xs mb-4">Your feedback is private. Our manager will personally reach out to make this right.</p>
          <div className="bg-rose-50 rounded-xl p-3 text-xs text-rose-700 mb-4">Your {rating}★ rating has been noted privately. We take this seriously.</div>
          <button onClick={reset} className="text-[11px] text-slate-400 hover:text-slate-600 cursor-pointer">Try again</button>
        </div>
      )}
    </div>
  )
}

export default function FeedbackLandingPage() {
  const [navOpen, setNavOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeFaq, setActiveFaq] = useState(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const scrollTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    setNavOpen(false)
  }

  return (
    <div className="min-h-screen bg-white" style={{ fontFamily: "'Open Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Open+Sans:wght@300;400;500;600;700&family=Poppins:wght@400;500;600;700;800&display=swap');
        .h { font-family: 'Poppins', sans-serif; }
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        .animate-float { animation: float 5s ease-in-out infinite; }
        @media(prefers-reduced-motion:reduce){ .animate-float{animation:none} }
        .glass { background:rgba(255,255,255,0.78); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border-bottom:1px solid rgba(255,255,255,0.5); }
        html { scroll-behavior:smooth; }
        .line-clamp-1 { overflow:hidden; display:-webkit-box; -webkit-line-clamp:1; -webkit-box-orient:vertical; }
      `}</style>

      {/* ── Navbar ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo-violet.svg" alt="Magic Management" className="h-9 w-auto" />
          </div>
          <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
            {[['how-it-works','How It Works'],['features','Features'],['reviews','Results'],['contact','Get Started']].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="text-sm font-medium text-slate-600 hover:text-violet-600 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                {label}
              </button>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/" className="text-sm font-medium text-slate-500 hover:text-slate-800 transition-colors px-2 py-1 focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
              ← Restaurant Suite
            </Link>
            <button onClick={() => scrollTo('contact')}
              className="px-5 py-2.5 bg-gradient-to-r from-violet-600 to-purple-600 text-white text-sm font-semibold rounded-xl hover:from-violet-700 hover:to-purple-700 transition-all shadow-md shadow-violet-400/25 cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2">
              Free Setup
            </button>
          </div>
          <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500"
            onClick={() => setNavOpen(o => !o)} aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen}>
            <Icon d={navOpen ? icons.close : icons.hamMenu} size={22} className="text-slate-700" />
          </button>
        </div>
        {navOpen && (
          <div className="md:hidden glass px-4 py-4 space-y-1">
            {[['how-it-works','How It Works'],['features','Features'],['reviews','Results'],['contact','Get Started']].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="w-full text-left px-4 py-3 text-slate-700 font-medium hover:bg-violet-50 hover:text-violet-600 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500">
                {label}
              </button>
            ))}
            <Link to="/" className="block px-4 py-3 text-slate-500 text-sm hover:text-slate-700 transition-colors">
              ← See Restaurant Suite
            </Link>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-28 pb-20 px-4 sm:px-6" style={{ background: 'linear-gradient(135deg,#F5F3FF 0%,#EDE9FE 40%,#FAF5FF 100%)' }}>
          <div className="absolute top-16 -left-24 w-80 h-80 rounded-full bg-violet-300/20 blur-3xl" aria-hidden="true" />
          <div className="absolute bottom-0 right-0 w-72 h-72 rounded-full bg-purple-300/15 blur-3xl" aria-hidden="true" />

          <div className="max-w-7xl mx-auto relative">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-violet-100 border border-violet-200 text-violet-700 text-sm font-semibold mb-8">
                  <Icon d={icons.zap} size={13} className="text-violet-500" />
                  Restaurants gaining 40+ Google Reviews per month
                </div>
                <h1 className="h text-4xl sm:text-5xl lg:text-5xl font-bold text-slate-900 leading-tight mb-6">
                  One QR code that fills your{' '}
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">
                    Google Reviews
                  </span>{' '}
                  automatically
                </h1>
                <p className="text-lg text-slate-600 leading-relaxed mb-4 max-w-xl">
                  Place the Magic QR at your table or reception. Guests scan, rate, and — if they're happy — get AI-crafted suggestions that make it effortless to post on Google. Bad feedback stays private.
                </p>
                <p className="text-sm text-slate-500 mb-10">Setup in under 5 minutes. No app. No hardware. No ongoing effort.</p>
                <div className="flex flex-col sm:flex-row gap-4">
                  <button onClick={() => scrollTo('contact')}
                    className="px-8 py-4 bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 text-white text-base font-semibold rounded-2xl shadow-xl shadow-violet-500/30 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-offset-2 flex items-center justify-center gap-2">
                    <Icon d={icons.calendar} size={18} />
                    Get Free Setup
                  </button>
                  <button onClick={() => scrollTo('how-it-works')}
                    className="px-8 py-4 bg-white/80 border border-slate-200 text-slate-700 text-base font-semibold rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 flex items-center justify-center gap-2">
                    See How It Works
                    <Icon d={icons.arrowRight} size={16} />
                  </button>
                </div>
              </div>
              {/* Interactive demo */}
              <div className="flex justify-center animate-float">
                <div>
                  <p className="text-center text-xs font-semibold text-violet-500 uppercase tracking-widest mb-4">Live Demo — Try It</p>
                  <FeedbackFlowDemo />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Social proof ── */}
        <section className="py-10 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { v: '1,00,000+', l: 'Properties Using Magic QR' },
                { v: '0.8 ★', l: 'Avg Rating Improvement' },
                { v: '40+', l: 'New Reviews per Month' },
                { v: '30s', l: 'Avg Time to Rate' },
              ].map(s => (
                <div key={s.l}>
                  <p className="h text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600 mb-1">{s.v}</p>
                  <p className="text-sm text-slate-500">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── How it works ── */}
        <section id="how-it-works" className="py-24 px-4 sm:px-6 bg-slate-50/60">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-violet-50 text-violet-700 text-sm font-semibold mb-4">Simple by Design</span>
              <h2 className="h text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Four steps. Zero ongoing effort.</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">After the initial 5-minute setup, the system works on its own. You just watch the reviews come in.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              {steps.map((s, i) => (
                <div key={s.step} className="relative">
                  {i < steps.length - 1 && (
                    <div className="hidden lg:block absolute top-10 left-full w-full h-px bg-gradient-to-r from-slate-200 to-transparent z-10" aria-hidden="true" />
                  )}
                  <div className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-200 h-full">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${s.color} flex items-center justify-center mb-4 shadow-md`}>
                      <Icon d={icons[s.icon]} size={22} className="text-white" />
                    </div>
                    <div className="text-xs font-bold text-slate-300 mb-1">{s.step}</div>
                    <h3 className="h text-base font-bold text-slate-900 mb-2">{s.title}</h3>
                    <p className="text-sm text-slate-500 leading-relaxed">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Features ── */}
        <section id="features" className="py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-violet-50 text-violet-700 text-sm font-semibold mb-4">Everything Included</span>
              <h2 className="h text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Built to be frictionless — for you and your guests</h2>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {features.map(f => (
                <div key={f.title}
                  className={`${f.bg} rounded-2xl p-5 border border-white hover:shadow-lg hover:shadow-slate-200/60 transition-all duration-200 group`}>
                  <div className="w-10 h-10 rounded-xl bg-white shadow-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-200">
                    <Icon d={icons[f.icon]} size={20} className={f.ic} />
                  </div>
                  <h4 className="h text-sm font-bold text-slate-800 mb-1.5 leading-snug">{f.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cross-link to main restaurant page ── */}
        <section className="py-12 px-4 sm:px-6 bg-gradient-to-r from-orange-500 to-rose-500">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-2">
                <Icon d={icons.table} size={17} className="text-orange-200" />
                <span className="text-orange-200 text-sm font-semibold uppercase tracking-wider">Also from Magic Management</span>
              </div>
              <h3 className="h text-xl sm:text-2xl font-bold mb-1">Restaurant & Billing Suite</h3>
              <p className="text-orange-100 text-sm leading-relaxed max-w-md">
                Table management, live kitchen display, KOT printing, UPI QR bills, and WhatsApp receipts — the full restaurant operations stack.
              </p>
            </div>
            <Link to="/"
              className="flex-shrink-0 px-6 py-3.5 bg-white text-orange-600 font-semibold rounded-xl hover:bg-orange-50 transition-colors text-sm flex items-center gap-2 shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-orange-500">
              See the Restaurant Suite
              <Icon d={icons.arrowRight} size={16} />
            </Link>
          </div>
        </section>

        {/* ── Results ── */}
        <section id="reviews" className="py-24 px-4 sm:px-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm font-semibold mb-4">Real Results</span>
              <h2 className="h text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Rating improvements you can see</h2>
              <p className="text-slate-500">Actual before/after from restaurants using Magic QR.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {reviews.map(r => (
                <div key={r.name} className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow">
                  {/* Before/after rating */}
                  <div className="flex items-center gap-4 mb-4 pb-4 border-b border-slate-100">
                    <div className="text-center">
                      <p className="text-xs text-slate-400 mb-1">Before</p>
                      <p className="h text-2xl font-bold text-slate-400">{r.before}★</p>
                    </div>
                    <Icon d={icons.arrowRight} size={20} className="text-emerald-500 flex-shrink-0" />
                    <div className="text-center">
                      <p className="text-xs text-violet-500 font-semibold mb-1">After Magic QR</p>
                      <p className="h text-2xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-purple-600">{r.after}★</p>
                    </div>
                    <div className="ml-auto"><StarRating count={r.rating} /></div>
                  </div>
                  <blockquote className="text-slate-700 leading-relaxed text-sm mb-4">"{r.text}"</blockquote>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center text-white font-bold text-sm flex-shrink-0" aria-hidden="true">
                      {r.name[0]}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{r.name}</p>
                      <p className="text-xs text-slate-400">{r.role}</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-20 px-4 sm:px-6 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="h text-3xl font-bold text-slate-900 mb-3">Questions answered</h2>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    aria-expanded={activeFaq === i}
                    className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 focus:ring-inset">
                    <span className="text-sm font-semibold text-slate-800 pr-4">{faq.q}</span>
                    <Icon d={activeFaq === i ? icons.chevronUp : icons.chevronDown} size={17} className="text-slate-400 flex-shrink-0" />
                  </button>
                  {activeFaq === i && (
                    <div className="px-5 pb-4 pt-3 text-sm text-slate-600 leading-relaxed border-t border-slate-100 bg-slate-50/50">{faq.a}</div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Contact ── */}
        <section id="contact" className="py-24 px-4 sm:px-6 bg-gradient-to-b from-slate-50 to-slate-100">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <span className="inline-block px-4 py-1.5 rounded-full bg-violet-50 text-violet-700 text-sm font-semibold mb-4">Get Started Today</span>
              <h2 className="h text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Your QR is ready in 5 minutes</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">Fill out the form or pick a time slot. We'll set up your Magic QR, configure Google Review routing, and hand you a print-ready QR — all in one call.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl p-7 shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="h text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Icon d={icons.mail} size={20} className="text-violet-600" /> Get Started
                </h3>
                <ContactForm />
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
                  <h3 className="h text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
                    <Icon d={icons.calendar} size={20} className="text-emerald-600" /> Pick a Setup Slot
                  </h3>
                  <CalendarBooking />
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-4">
                  {[
                    { icon: 'mail',  l: 'Email',    v: 'hello@magicmanagement.in' },
                    { icon: 'phone', l: 'Phone',    v: '+91 93014 20919' },
                    { icon: 'map',   l: 'Location', v: 'Indore, India (Remote-first)' },
                  ].map(item => (
                    <div key={item.l} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-violet-50 flex items-center justify-center flex-shrink-0">
                        <Icon d={icons[item.icon]} size={16} className="text-violet-600" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">{item.l}</p>
                        <p className="text-sm font-medium text-slate-700">{item.v}</p>
                      </div>
                    </div>
                  ))}
                  <a href="https://wa.me/919301420919?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Magic%20QR%20Feedback"
                    target="_blank" rel="noopener noreferrer"
                    className="flex items-center justify-center gap-2 w-full py-3 bg-[#25D366] hover:bg-[#20bd5c] text-white font-semibold rounded-xl transition-colors text-sm shadow-md shadow-green-500/20 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
                    <svg width="20" height="20" viewBox="0 0 48 48" fill="none" aria-hidden="true"><path fillRule="evenodd" clipRule="evenodd" d="M24 4C13 4 4 13 4 24c0 3.6 1 7 2.7 9.9L4 44l10.4-2.7C17.2 43 20.5 44 24 44c11 0 20-9 20-20S35 4 24 4z" fill="white"/><path fillRule="evenodd" clipRule="evenodd" d="M24 7.2c-9.3 0-16.8 7.5-16.8 16.8 0 3.2.9 6.2 2.5 8.8l.4.6-1.6 5.9 6.1-1.6.6.3c2.5 1.5 5.4 2.3 8.3 2.3 9.3 0 16.8-7.5 16.8-16.8S33.3 7.2 24 7.2zm9.9 23.4c-.4 1.1-2.3 2.1-3.2 2.2-.8.1-1.9.2-3-.2-1.7-.6-3.9-1.5-6.7-4.2-2.9-2.7-4-5.2-4.6-7-.3-1-.2-2.1.1-2.9.3-.8.8-1.4 1.4-1.9.5-.4 1-.6 1.5-.6h1c.4 0 .8.2 1.1.9.4.8 1.3 3.1 1.4 3.4.1.2.2.5 0 .8-.1.3-.3.5-.5.7l-.5.6c-.2.2-.4.4-.2.8.2.4.9 1.5 2 2.5 1.3 1.2 2.4 1.6 2.8 1.8.4.2.6.1.9-.1.2-.2.9-1 1.2-1.4.3-.4.5-.3.9-.2.4.1 2.5 1.2 2.9 1.4.4.2.7.3.8.5.1.3.1 1.4-.3 2.5z" fill="#25D366"/></svg>
                    Chat on WhatsApp
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* ── WhatsApp bubble ── */}
      <a href="https://wa.me/919301420919?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20Magic%20QR%20Feedback"
        target="_blank" rel="noopener noreferrer" aria-label="Chat on WhatsApp"
        className="fixed bottom-6 right-6 z-50 w-14 h-14 bg-[#25D366] hover:bg-[#20bd5c] text-white rounded-full shadow-lg shadow-green-500/40 flex items-center justify-center transition-all duration-200 hover:scale-110 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2">
        <svg width="30" height="30" viewBox="0 0 48 48" fill="none" aria-hidden="true">
          <path fillRule="evenodd" clipRule="evenodd" d="M24 4C13 4 4 13 4 24c0 3.6 1 7 2.7 9.9L4 44l10.4-2.7C17.2 43 20.5 44 24 44c11 0 20-9 20-20S35 4 24 4z" fill="white"/>
          <path fillRule="evenodd" clipRule="evenodd" d="M24 7.2c-9.3 0-16.8 7.5-16.8 16.8 0 3.2.9 6.2 2.5 8.8l.4.6-1.6 5.9 6.1-1.6.6.3c2.5 1.5 5.4 2.3 8.3 2.3 9.3 0 16.8-7.5 16.8-16.8S33.3 7.2 24 7.2zm9.9 23.4c-.4 1.1-2.3 2.1-3.2 2.2-.8.1-1.9.2-3-.2-1.7-.6-3.9-1.5-6.7-4.2-2.9-2.7-4-5.2-4.6-7-.3-1-.2-2.1.1-2.9.3-.8.8-1.4 1.4-1.9.5-.4 1-.6 1.5-.6h1c.4 0 .8.2 1.1.9.4.8 1.3 3.1 1.4 3.4.1.2.2.5 0 .8-.1.3-.3.5-.5.7l-.5.6c-.2.2-.4.4-.2.8.2.4.9 1.5 2 2.5 1.3 1.2 2.4 1.6 2.8 1.8.4.2.6.1.9-.1.2-.2.9-1 1.2-1.4.3-.4.5-.3.9-.2.4.1 2.5 1.2 2.9 1.4.4.2.7.3.8.5.1.3.1 1.4-.3 2.5z" fill="#25D366"/>
        </svg>
      </a>

      {/* ── Footer ── */}
      <footer className="bg-slate-900 text-slate-400 py-12 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Magic Management" className="h-8 w-auto brightness-0 invert" />
          </div>
          <nav className="flex flex-wrap gap-5 justify-center" aria-label="Footer navigation">
            {[['how-it-works','How It Works'],['features','Features'],['reviews','Results'],['contact','Get Started']].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="text-sm hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
                {label}
              </button>
            ))}
            <Link to="/" className="text-sm hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-violet-500 rounded">
              Restaurant Suite
            </Link>
          </nav>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Magic Management. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
