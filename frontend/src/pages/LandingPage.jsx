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
  table:       ['M3 3h18v18H3z','M3 9h18','M3 15h18','M9 3v18','M15 3v18'],
  waiter:      ['M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2','M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z'],
  kitchen:     ['M15 11h.01','M11 15h.01','M16 16h.01','M2 12h20','M12 2v4','M12 18v4','M4.93 4.93l2.83 2.83','M16.24 16.24l2.83 2.83'],
  kot:         ['M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z','M14 2v6h6','M16 13H8','M16 17H8','M10 9H8'],
  billing:     ['M12 1v22','M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6'],
  upi:         ['M3 3h6v6H3z','M15 3h6v6h-6z','M3 15h6v6H3z','M15 15h2v2h-2z','M19 15v2','M15 19h2','M19 19h2v2h-2z'],
  whatsapp:    ['M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z'],
  print:       ['M6 9V2h12v7','M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2','M6 14h12v8H6z'],
  menu:        ['M3 12h18','M3 6h18','M3 18h18'],
  check:       'M20 6L9 17l-5-5',
  star:        'M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z',
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
  split:       ['M16 3h5v5','M21 3l-7 7','M8 21H3v-5','M3 21l7-7','M21 21l-5-5','M3 3l5 5'],
  clock:       ['M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20z','M12 6v6l4 2'],
  analytics:   ['M18 20V10','M12 20V4','M6 20v-6'],
  shield:      'M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z',
  qr:          ['M3 3h6v6H3z','M15 3h6v6h-6z','M3 15h6v6H3z','M15 15h2v2h-2z','M19 15v2','M15 19h2','M19 19h2v2h-2z'],
}

/* ─── Shared components ─────────────────────────────────── */
function StarRating({ count = 5 }) {
  return (
    <div className="flex gap-0.5" aria-label={`${count} out of 5 stars`}>
      {Array.from({ length: count }).map((_, i) => (
        <svg key={i} width="15" height="15" viewBox="0 0 24 24" fill="#FBBF24" aria-hidden="true">
          <path d={icons.star} />
        </svg>
      ))}
    </div>
  )
}

/* ─── Feature sections ──────────────────────────────────── */
const coreFeatures = [
  {
    icon: 'table',
    color: 'from-blue-500 to-blue-600',
    bg: 'bg-blue-50',
    ic: 'text-blue-600',
    title: 'Live Table Management',
    desc: 'Visual floor map showing every table — free, occupied (with time elapsed), or flagged. Tap to open, assign, or clear in one move.',
    points: ['Real-time occupancy status', 'Time-since-seated counter', 'Floor/section grouping', 'One-click table assignment'],
  },
  {
    icon: 'waiter',
    color: 'from-violet-500 to-purple-600',
    bg: 'bg-violet-50',
    ic: 'text-violet-600',
    title: 'Waiter Order Flow',
    desc: 'Waiters browse the digital menu by category, add items with quantities and notes, and fire orders to the kitchen in seconds — no paper, no shouting.',
    points: ['Category-filtered menu browse', 'Item notes & special requests', 'One-tap order submission', 'Live order status per table'],
  },
  {
    icon: 'kitchen',
    color: 'from-orange-500 to-amber-500',
    bg: 'bg-orange-50',
    ic: 'text-orange-600',
    title: 'Kitchen Display System',
    desc: 'The chef\'s screen updates in real time the moment a waiter fires an order. Sound alert, colour-coded urgency, and one-tap status updates.',
    points: ['WebSocket real-time feed', 'Sound alert on new order', 'Colour urgency coding', 'Pending → Preparing → Ready'],
  },
  {
    icon: 'kot',
    color: 'from-rose-500 to-pink-600',
    bg: 'bg-rose-50',
    ic: 'text-rose-600',
    title: 'KOT Printing',
    desc: 'Kitchen Order Tickets print automatically the moment an order is placed. Never lose a verbal order again — every item is on paper and on screen.',
    points: ['Auto-print on order fire', 'Table number & time on ticket', 'Item-wise notes included', 'Works with any thermal printer'],
  },
  {
    icon: 'billing',
    color: 'from-emerald-500 to-teal-500',
    bg: 'bg-emerald-50',
    ic: 'text-emerald-600',
    title: 'Smart Billing Counter',
    desc: 'One screen for the full bill — items, GST, discounts, and total. Accept cash, card, UPI, or split payment across methods without switching apps.',
    points: ['Auto GST calculation', 'Discount & coupon support', 'Cash / Card / UPI / Split', 'PDF invoice in one click'],
  },
  {
    icon: 'upi',
    color: 'from-indigo-500 to-blue-600',
    bg: 'bg-indigo-50',
    ic: 'text-indigo-600',
    title: 'UPI QR on Printed Bills',
    desc: 'Every printed bill carries a dynamic UPI QR code. Customers scan and pay instantly — no cash handling, no POS machine needed.',
    points: ['Dynamic UPI QR per bill', 'Configurable UPI handle per outlet', 'Works with any UPI app', 'Instant payment confirmation'],
  },
  {
    icon: 'whatsapp',
    color: 'from-green-500 to-emerald-600',
    bg: 'bg-green-50',
    ic: 'text-green-600',
    title: 'WhatsApp Bills',
    desc: 'Send the invoice straight to the customer\'s WhatsApp in one tap. No printing costs, no lost bills — digital receipt delivered before they leave the table.',
    points: ['One-tap WhatsApp share', 'PDF bill in the chat', 'Customer phone optional', 'Works offline with saved link'],
  },
  {
    icon: 'print',
    color: 'from-slate-500 to-gray-600',
    bg: 'bg-slate-50',
    ic: 'text-slate-600',
    title: 'Auto-Print Billing',
    desc: 'Configure the system to print the bill automatically as soon as it\'s generated — zero extra clicks for your billing staff at peak hours.',
    points: ['Auto-print on bill confirm', 'Thermal printer compatible', 'Print + WhatsApp simultaneously', 'Configurable per outlet'],
  },
]

const moreFeatures = [
  { icon: 'analytics', title: 'Revenue Dashboard', desc: 'Daily, weekly, and monthly revenue charts. Top-selling items, peak hours heatmap, and table turnover rate — all in one view.' },
  { icon: 'menu', title: 'Digital Menu Management', desc: 'Add categories, items, prices, images, and dietary tags. Enable/disable items in bulk. Customers see changes instantly.' },
  { icon: 'split', title: 'Split Payments', desc: 'Split a bill across cash, card, and UPI in any proportion. Handles corporate accounts and room-charge splits.' },
  { icon: 'clock', title: 'Order History & Logs', desc: 'Full audit trail of every order, edit, and cancellation with timestamps and staff attribution.' },
  { icon: 'shield', title: 'Role-Based Access', desc: 'Owner, Waiter, Chef, and Billing Counter each see only their screen. No accidental order cancellations.' },
  { icon: 'analytics', title: 'Expense Tracking', desc: 'Log daily expenses by category, compare against revenue, and export full reports for your accountant.' },
]

const reviews = [
  { name: 'Vikram Nair', role: 'Owner, Coastal Bites (12 tables)', rating: 5, text: 'KOT printing alone saved us from daily argument between waiters and the kitchen. Now everything is on paper and on screen simultaneously.' },
  { name: 'Sunita Rao', role: 'F&B Manager, Spice Route Restaurant', rating: 5, text: 'The UPI QR on bills changed everything. Cash collection time dropped by 60% and we\'ve had zero billing disputes this quarter.' },
  { name: 'Anil Kumar', role: 'Owner, The Dhaba (3 outlets)', rating: 5, text: 'WhatsApp bills sound like a small thing but customers love it. They screenshot the receipt and we get zero "I didn\'t get my bill" calls.' },
  { name: 'Priya Shah', role: 'Restaurant Manager, Flavours Cafe', rating: 5, text: 'The kitchen display with sound alerts means our chef never misses an order even during the lunch rush. Table turnover improved 30%.' },
]

const faqs = [
  { q: 'Do I need to replace my existing billing hardware?', a: 'No. MagicServe by Magic Management works on any tablet, laptop, or phone. It connects to standard thermal printers via USB or Bluetooth. No proprietary hardware needed.' },
  { q: 'How does the UPI QR on bills work?', a: 'When you generate a bill, a dynamic UPI QR is auto-embedded in the printout. Your customer scans it with any UPI app (PhonePe, GPay, Paytm) and the payment goes directly to your configured UPI handle.' },
  { q: 'Can waiters and kitchen staff use it simultaneously?', a: 'Yes, that\'s the point. Waiters, chefs, and billing staff all work on their own role-scoped screens in real time via WebSockets — changes appear instantly across all devices.' },
  { q: 'What if the internet goes down during service?', a: 'Orders already placed stay on-screen. KOT tickets already printed remain valid. We recommend having a mobile hotspot as backup — service should never stop for a connectivity blip.' },
  { q: 'Is there a per-table or per-order pricing model?', a: 'No. It\'s a flat monthly subscription per outlet — unlimited tables, unlimited orders, unlimited staff accounts. Pricing is shared during your free demo call.' },
]

function ContactForm() {
  const [form, setForm] = useState({ name: '', email: '', phone: '', outlets: '', message: '' })
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
        body: JSON.stringify(form),
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
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <Icon d={icons.check} size={32} className="text-emerald-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-800 mb-2">We'll be in touch!</h3>
        <p className="text-slate-500">Our team will reach out within 24 hours to schedule your live walkthrough.</p>
      </div>
    )
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="c-name" className="block text-sm font-medium text-slate-700 mb-1.5">Full Name <span className="text-rose-500">*</span></label>
        <input id="c-name" type="text" required autoComplete="name"
          placeholder="Rahul Sharma"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
          value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="c-outlets" className="block text-sm font-medium text-slate-700 mb-1.5">Number of outlets</label>
        <select id="c-outlets"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm cursor-pointer"
          value={form.outlets} onChange={e => setForm(f => ({ ...f, outlets: e.target.value }))}>
          <option value="">Select…</option>
          <option>1 outlet</option>
          <option>2–5 outlets</option>
          <option>6–20 outlets</option>
          <option>20+ outlets</option>
        </select>
      </div>
      <div>
        <label htmlFor="c-email" className="block text-sm font-medium text-slate-700 mb-1.5">
          Email <span className="text-slate-400 font-normal text-xs">(or phone)</span>
        </label>
        <input id="c-email" type="email" autoComplete="email"
          placeholder="rahul@myrestaurant.com"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
          value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="c-phone" className="block text-sm font-medium text-slate-700 mb-1.5">
          Phone <span className="text-slate-400 font-normal text-xs">(or email)</span>
        </label>
        <input id="c-phone" type="tel" autoComplete="tel"
          placeholder="+91 93014 20919"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm"
          value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} />
      </div>
      <div>
        <label htmlFor="c-message" className="block text-sm font-medium text-slate-700 mb-1.5">Anything specific you want to see?</label>
        <textarea id="c-message" rows="3"
          placeholder="E.g. how KOT printing works, split billing, WhatsApp bills…"
          className="w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent transition-all text-sm resize-none"
          value={form.message} onChange={e => setForm(f => ({ ...f, message: e.target.value }))} />
      </div>
      {error && <p className="text-rose-500 text-sm">{error}</p>}
      <button type="submit" disabled={loading}
        className="w-full py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-2 focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 disabled:opacity-60 cursor-pointer shadow-lg shadow-orange-500/25 text-sm">
        {loading
          ? <><span className="w-5 h-5 border-2 border-white/40 border-t-white rounded-full animate-spin" />Sending…</>
          : <><Icon d={icons.mail} size={18} />Book My Free Demo</>}
      </button>
    </form>
  )
}

function CalendarBooking({ accentClass = 'orange', page = 'MagicServe' }) {
  const today = new Date()
  const [currentMonth, setCurrentMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [selectedDate, setSelectedDate] = useState(null)
  const [selectedSlot, setSelectedSlot] = useState(null)
  // step: 'calendar' | 'userinfo' | 'booked'
  const [step, setStep] = useState('calendar')
  const [userInfo, setUserInfo] = useState({ name: '', email: '', phone: '' })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const ac = accentClass // 'orange' or 'violet'
  const ring   = ac === 'violet' ? 'focus:ring-violet-500' : 'focus:ring-orange-500'
  const btnBg  = ac === 'violet'
    ? 'bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700 shadow-violet-500/25'
    : 'bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-500/25'
  const selBg  = ac === 'violet' ? 'bg-violet-600 text-white border-violet-600 shadow-violet-400/25' : 'bg-orange-500 text-white border-orange-500 shadow-orange-400/25'
  const selDay = ac === 'violet' ? 'bg-violet-600 text-white shadow-violet-400/30' : 'bg-orange-500 text-white shadow-orange-400/30'
  const hover  = ac === 'violet' ? 'hover:bg-violet-50 hover:border-violet-300 hover:text-violet-600' : 'hover:bg-orange-50 hover:border-orange-300 hover:text-orange-600'
  const dayHov = ac === 'violet' ? 'hover:bg-violet-50' : 'hover:bg-orange-50'

  const slots = ['10:00 AM', '11:00 AM', '2:00 PM', '3:00 PM', '4:30 PM']
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
        body: JSON.stringify({ ...userInfo, date: dateLabel, slot: selectedSlot, page }),
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
        <div className="flex items-center gap-2 mb-1">
          <button onClick={() => setStep('calendar')} className={`text-xs ${ac === 'violet' ? 'text-violet-600' : 'text-orange-500'} hover:underline cursor-pointer focus:outline-none`}>
            ← {dateLabel} · {selectedSlot}
          </button>
        </div>
        <p className="text-sm font-semibold text-slate-700">Your details</p>
        <div>
          <label htmlFor="cb-userinfo-name" className="block text-xs font-medium text-slate-600 mb-1">Full Name <span className="text-rose-500">*</span></label>
          <input id="cb-userinfo-name" name="name" type="text" autoComplete="name" placeholder="Rahul Sharma"
            className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ${ring} focus:border-transparent transition-all text-sm`}
            value={userInfo.name} onChange={e => setUserInfo(u => ({ ...u, name: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="cb-userinfo-email" className="block text-xs font-medium text-slate-600 mb-1">Email <span className="text-slate-400 font-normal">(or phone)</span></label>
          <input id="cb-userinfo-email" name="email" type="email" autoComplete="email" placeholder="rahul@myrestaurant.com"
            className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ${ring} focus:border-transparent transition-all text-sm`}
            value={userInfo.email} onChange={e => setUserInfo(u => ({ ...u, email: e.target.value }))} />
        </div>
        <div>
          <label htmlFor="cb-userinfo-phone" className="block text-xs font-medium text-slate-600 mb-1">Phone <span className="text-slate-400 font-normal">(or email)</span></label>
          <input id="cb-userinfo-phone" name="phone" type="tel" autoComplete="tel" placeholder="+91 93014 20919"
            className={`w-full px-4 py-3 rounded-xl border border-slate-200 bg-white text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 ${ring} focus:border-transparent transition-all text-sm`}
            value={userInfo.phone} onChange={e => setUserInfo(u => ({ ...u, phone: e.target.value }))} />
        </div>
        {error && <p className="text-rose-500 text-xs">{error}</p>}
        <button onClick={handleConfirm} disabled={loading}
          className={`w-full py-3.5 ${btnBg} text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 ${ring} focus:ring-offset-2 disabled:opacity-60 shadow-lg text-sm`}>
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
          className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 ${ring}`}>
          <Icon d="M15 18l-6-6 6-6" size={15} className="text-slate-500" />
        </button>
        <span className="text-sm font-semibold text-slate-700">{monthName}</span>
        <button onClick={() => setCurrentMonth(m => new Date(m.getFullYear(), m.getMonth() + 1, 1))}
          aria-label="Next month"
          className={`w-8 h-8 flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 ${ring}`}>
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
              className={`aspect-square flex items-center justify-center rounded-lg text-xs font-medium transition-all duration-150 focus:outline-none focus:ring-2 ${ring} focus:ring-offset-1
                ${disabled ? 'text-slate-300 cursor-not-allowed' : `cursor-pointer ${dayHov}`}
                ${isSelected ? `${selDay}` : ''}
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
                className={`py-2 px-2 rounded-lg text-xs font-semibold border transition-all cursor-pointer focus:outline-none focus:ring-2 ${ring}
                  ${selectedSlot === slot ? selBg : `border-slate-200 text-slate-600 ${hover}`}`}>
                {slot}
              </button>
            ))}
          </div>
        </div>
      )}
      {selectedDate && selectedSlot && (
        <button onClick={() => setStep('userinfo')}
          className={`w-full py-3.5 ${btnBg} text-white font-semibold rounded-xl transition-all flex items-center justify-center gap-2 cursor-pointer focus:outline-none focus:ring-2 ${ring} focus:ring-offset-2 shadow-lg text-sm`}>
          <Icon d={icons.calendar} size={16} />Next — Your Details
        </button>
      )}
    </div>
  )
}

/* ─── Packages ──────────────────────────────────────────── */
const packages = [
  {
    name: 'Starter',
    subtitle: 'Small restaurants, cafes',
    highlight: false,
    features: [
      'Up to 20 tables',
      'Waiter & Kitchen dashboards',
      'KOT auto-printing',
      'Basic billing with GST',
      'UPI QR on printed bills',
      'WhatsApp bill sharing',
      'PDF invoice download',
    ],
  },
  {
    name: 'Pro',
    subtitle: 'Growing restaurants & multi-staff',
    highlight: true,
    badge: 'Most Popular',
    features: [
      'Everything in Starter',
      'Unlimited tables',
      'Auto-print billing',
      'Split payments',
      'Revenue & analytics dashboard',
      'Expense tracking',
      'Magic QR Feedback System',
      'AI-powered Google Review routing',
      'Priority support',
    ],
  },
  {
    name: 'Enterprise',
    subtitle: 'Chains, hotels & large properties',
    highlight: false,
    features: [
      'Everything in Pro',
      'Hotel & room management',
      'Multi-outlet management',
      'Room service order billing',
      'Full audit logs',
      'Custom branding',
      'Dedicated account manager',
      'On-site onboarding',
    ],
  },
]

export default function LandingPage() {
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
        .glass { background:rgba(255,255,255,0.75); backdrop-filter:blur(14px); -webkit-backdrop-filter:blur(14px); border-bottom:1px solid rgba(255,255,255,0.5); }
        html { scroll-behavior:smooth; }
      `}</style>

      {/* ── Navbar ── */}
      <header className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${scrolled ? 'glass shadow-sm' : 'bg-transparent'}`}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center">
            <img src="/logo.svg" alt="Magic Management" className="h-9 w-auto" />
          </div>
          <nav className="hidden md:flex items-center gap-7" aria-label="Main navigation">
            {[['features','Features'],['pricing','Pricing'],['reviews','Reviews'],['contact','Contact']].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="text-sm font-medium text-slate-600 hover:text-orange-500 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">
                {label}
              </button>
            ))}
          </nav>
          <div className="hidden md:flex items-center gap-3">
            <Link to="/login" className="text-sm font-medium text-slate-600 hover:text-slate-800 transition-colors px-2 py-1 focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">Sign In</Link>
            <button onClick={() => scrollTo('contact')}
              className="px-5 py-2.5 bg-gradient-to-r from-orange-500 to-orange-600 text-white text-sm font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-md shadow-orange-400/25 cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2">
              Free Demo
            </button>
          </div>
          <button className="md:hidden p-2 rounded-lg hover:bg-slate-100 transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500"
            onClick={() => setNavOpen(o => !o)} aria-label={navOpen ? 'Close menu' : 'Open menu'} aria-expanded={navOpen}>
            <Icon d={navOpen ? icons.close : icons.menu} size={22} className="text-slate-700" />
          </button>
        </div>
        {navOpen && (
          <div className="md:hidden bg-white border-t border-slate-100 shadow-lg px-4 py-4 space-y-1">
            {[['features','Features'],['pricing','Pricing'],['reviews','Reviews'],['contact','Contact']].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="w-full text-left px-4 py-3 text-slate-700 font-medium hover:bg-orange-50 hover:text-orange-600 rounded-xl transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500">
                {label}
              </button>
            ))}
            <div className="pt-2 flex gap-3">
              <Link to="/login" className="flex-1 text-center py-3 border border-slate-200 rounded-xl text-sm font-medium text-slate-700">Sign In</Link>
              <button onClick={() => scrollTo('contact')}
                className="flex-1 py-3 bg-orange-500 text-white text-sm font-semibold rounded-xl cursor-pointer hover:bg-orange-600 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500">
                Free Demo
              </button>
            </div>
          </div>
        )}
      </header>

      <main>
        {/* ── Hero ── */}
        <section className="relative overflow-hidden pt-28 pb-20 px-4 sm:px-6" style={{ background: 'linear-gradient(135deg,#FFF7ED 0%,#FFF3E0 40%,#FEF3C7 100%)' }}>
          {/* decorative blobs */}
          <div className="absolute top-16 -left-20 w-72 h-72 rounded-full bg-orange-300/20 blur-3xl" aria-hidden="true" />
          <div className="absolute top-32 right-0 w-80 h-80 rounded-full bg-rose-300/15 blur-3xl" aria-hidden="true" />

          <div className="max-w-7xl mx-auto relative">
            <div className="max-w-3xl mx-auto text-center">
              <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-orange-100 border border-orange-200 text-orange-700 text-sm font-semibold mb-8 whitespace-nowrap">
                <Icon d={icons.zap} size={13} className="text-orange-500" />
                Trusted by 1,00,000+ restaurants in India
              </div>
              <h1 className="h text-4xl sm:text-5xl lg:text-6xl font-bold text-slate-900 leading-tight mb-6">
                From order to <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500">paid bill</span> — in seconds
              </h1>
              <p className="text-lg sm:text-xl text-slate-600 leading-relaxed mb-4 max-w-2xl mx-auto">
                Table management, waiter ordering, live kitchen display, KOT printing, UPI QR bills, and WhatsApp receipts — all in one system built for Indian restaurants.
              </p>
              <p className="text-sm text-slate-500 mb-10">No app download. No bulky hardware. Works on any phone, tablet, or laptop.</p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button onClick={() => scrollTo('contact')}
                  className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white text-base font-semibold rounded-2xl shadow-xl shadow-orange-500/30 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 flex items-center justify-center gap-2">
                  <Icon d={icons.calendar} size={18} />
                  Book a Free Demo
                </button>
                <button onClick={() => scrollTo('features')}
                  className="px-8 py-4 bg-white/80 border border-slate-200 text-slate-700 text-base font-semibold rounded-2xl hover:bg-white hover:shadow-md transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 flex items-center justify-center gap-2">
                  See How It Works
                  <Icon d={icons.arrowRight} size={16} />
                </button>
              </div>
            </div>

            {/* Mock dashboard */}
            <div className="mt-16 max-w-4xl mx-auto animate-float">
              <div className="rounded-2xl overflow-hidden shadow-2xl shadow-orange-900/10 border border-orange-100 bg-white">
                {/* browser chrome */}
                <div className="bg-slate-100 px-4 py-3 flex items-center gap-2 border-b border-slate-200">
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full bg-rose-400" aria-hidden="true" />
                    <div className="w-3 h-3 rounded-full bg-amber-400" aria-hidden="true" />
                    <div className="w-3 h-3 rounded-full bg-emerald-400" aria-hidden="true" />
                  </div>
                  <div className="flex-1 mx-4 bg-white rounded-md px-3 py-1 text-xs text-slate-400 font-mono">app.magicmanagement.in/billing</div>
                </div>
                {/* stat row */}
                <div className="bg-white p-4 grid grid-cols-2 sm:grid-cols-4 gap-3 border-b border-slate-100">
                  {[
                    { l: "Today's Revenue", v: '₹62,480', c: 'text-emerald-600', bg: 'bg-emerald-50' },
                    { l: 'Bills Generated', v: '47', c: 'text-blue-600', bg: 'bg-blue-50' },
                    { l: 'Tables Active', v: '14 / 24', c: 'text-orange-600', bg: 'bg-orange-50' },
                    { l: 'Pending KOTs', v: '3', c: 'text-rose-600', bg: 'bg-rose-50' },
                  ].map(s => (
                    <div key={s.l} className={`${s.bg} rounded-xl p-3`}>
                      <p className="text-xs text-slate-500 mb-1">{s.l}</p>
                      <p className={`h text-xl font-bold ${s.c}`}>{s.v}</p>
                    </div>
                  ))}
                </div>
                <div className="p-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* live orders */}
                  <div className="sm:col-span-2 bg-slate-50 rounded-xl p-3 space-y-2">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Live Kitchen Orders</p>
                    {[
                      { t: 'T-7',  i: 'Butter Chicken ×2, Naan ×3', s: 'Preparing', c: 'bg-amber-100 text-amber-700' },
                      { t: 'T-11', i: 'Paneer Tikka ×1, Dal Fry ×1', s: 'Ready ✓', c: 'bg-emerald-100 text-emerald-700' },
                      { t: 'T-3',  i: 'Veg Biryani ×2, Raita ×2', s: 'Pending', c: 'bg-blue-100 text-blue-700' },
                    ].map((o, i) => (
                      <div key={i} className="flex items-center gap-2 bg-white rounded-lg px-3 py-2">
                        <span className="text-xs font-bold text-slate-700 w-8">{o.t}</span>
                        <span className="text-xs text-slate-500 flex-1 truncate">{o.i}</span>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${o.c}`}>{o.s}</span>
                      </div>
                    ))}
                  </div>
                  {/* bill preview */}
                  <div className="bg-slate-50 rounded-xl p-3">
                    <p className="text-xs font-semibold text-slate-500 mb-2">Bill — Table 11</p>
                    <div className="space-y-1 text-xs text-slate-600 mb-3">
                      <div className="flex justify-between"><span>Paneer Tikka ×1</span><span>₹320</span></div>
                      <div className="flex justify-between"><span>Dal Fry ×1</span><span>₹180</span></div>
                      <div className="flex justify-between text-slate-400"><span>GST 5%</span><span>₹25</span></div>
                      <div className="flex justify-between font-bold text-slate-800 border-t border-slate-200 pt-1"><span>Total</span><span>₹525</span></div>
                    </div>
                    <div className="flex gap-1.5">
                      <div className="flex-1 bg-green-100 rounded-lg p-2 flex flex-col items-center">
                        <Icon d={icons.whatsapp} size={14} className="text-green-600 mb-0.5" />
                        <span className="text-[10px] text-green-700 font-semibold">WhatsApp</span>
                      </div>
                      <div className="flex-1 bg-blue-100 rounded-lg p-2 flex flex-col items-center">
                        <Icon d={icons.upi} size={14} className="text-blue-600 mb-0.5" />
                        <span className="text-[10px] text-blue-700 font-semibold">UPI QR</span>
                      </div>
                      <div className="flex-1 bg-slate-100 rounded-lg p-2 flex flex-col items-center">
                        <Icon d={icons.print} size={14} className="text-slate-600 mb-0.5" />
                        <span className="text-[10px] text-slate-600 font-semibold">Print</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Social proof bar ── */}
        <section className="py-10 bg-white border-y border-slate-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center">
              {[
                { v: '1,00,000+', l: 'Restaurants Served' },
                { v: '5 Cr+', l: 'Orders Processed' },
                { v: '₹500 Cr+', l: 'Bills Generated' },
                { v: '4.9 / 5', l: 'Avg Customer Rating' },
              ].map(s => (
                <div key={s.l}>
                  <p className="h text-3xl sm:text-4xl font-bold text-transparent bg-clip-text bg-gradient-to-r from-orange-500 to-rose-500 mb-1">{s.v}</p>
                  <p className="text-sm text-slate-500">{s.l}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Core features ── */}
        <section id="features" className="py-24 px-4 sm:px-6 bg-slate-50/60">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-orange-50 text-orange-700 text-sm font-semibold mb-4">Built for Every Role</span>
              <h2 className="h text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Everything from table to payment, sorted</h2>
              <p className="text-slate-500 text-lg max-w-2xl mx-auto">Each person in your team — waiter, chef, cashier, owner — gets their own purpose-built screen. No confusion, no missed orders.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
              {coreFeatures.map(f => (
                <div key={f.title}
                  className="bg-white rounded-2xl p-6 border border-slate-100 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-200 group">
                  <div className="flex items-start gap-4">
                    <div className={`w-12 h-12 rounded-2xl bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0 shadow-md group-hover:scale-110 transition-transform duration-200`}>
                      <Icon d={icons[f.icon]} size={22} className="text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="h text-base font-bold text-slate-900 mb-1">{f.title}</h3>
                      <p className="text-sm text-slate-500 leading-relaxed mb-3">{f.desc}</p>
                      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1">
                        {f.points.map(p => (
                          <li key={p} className="flex items-center gap-1.5 text-xs text-slate-600">
                            <span className={`w-3.5 h-3.5 rounded-full bg-gradient-to-br ${f.color} flex items-center justify-center flex-shrink-0`}>
                              <Icon d={icons.check} size={8} className="text-white" />
                            </span>
                            {p}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Additional features grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {moreFeatures.map(f => (
                <div key={f.title} className="bg-white rounded-2xl p-5 border border-slate-100 hover:shadow-md transition-all">
                  <Icon d={icons[f.icon]} size={22} className="text-orange-500 mb-3" />
                  <h4 className="h text-sm font-bold text-slate-800 mb-1">{f.title}</h4>
                  <p className="text-xs text-slate-500 leading-relaxed">{f.desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Cross-link to Feedback page ── */}
        <section className="py-12 px-4 sm:px-6 bg-gradient-to-r from-violet-600 to-purple-700">
          <div className="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
            <div className="text-white">
              <div className="flex items-center gap-2 mb-2">
                <Icon d={icons.star} size={18} className="text-violet-200" />
                <span className="text-violet-200 text-sm font-semibold uppercase tracking-wider">Also from Magic Management</span>
              </div>
              <h3 className="h text-xl sm:text-2xl font-bold mb-1">Magic QR Feedback System</h3>
              <p className="text-violet-200 text-sm leading-relaxed max-w-md">
                Turn every happy customer into a Google Review — automatically. Smart routing sends 4★+ guests to Google, keeps bad feedback internal.
              </p>
            </div>
            <Link to="/feedback-landing"
              className="flex-shrink-0 px-6 py-3.5 bg-white text-violet-700 font-semibold rounded-xl hover:bg-violet-50 transition-colors text-sm flex items-center gap-2 shadow-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-white focus:ring-offset-2 focus:ring-offset-violet-600">
              See the Feedback System
              <Icon d={icons.arrowRight} size={16} />
            </Link>
          </div>
        </section>

        {/* ── Reviews ── */}
        <section id="reviews" className="py-24 px-4 sm:px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-amber-50 text-amber-700 text-sm font-semibold mb-4">Real Results</span>
              <h2 className="h text-3xl sm:text-4xl font-bold text-slate-900 mb-4">What restaurant owners are saying</h2>
              <p className="text-slate-500">From QSRs to fine dining — teams across India run smoother with Magic Management.</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {reviews.map(r => (
                <div key={r.name} className="bg-slate-50 rounded-2xl p-6 border border-slate-100 hover:shadow-md transition-shadow">
                  <StarRating count={r.rating} />
                  <blockquote className="mt-4 text-slate-700 leading-relaxed text-sm">"{r.text}"</blockquote>
                  <div className="mt-4 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-rose-500 flex items-center justify-center text-white font-bold text-sm flex-shrink-0" aria-hidden="true">
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

        {/* ── Pricing ── */}
        <section id="pricing" className="py-24 px-4 sm:px-6 bg-slate-50">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="inline-block px-4 py-1.5 rounded-full bg-orange-50 text-orange-700 text-sm font-semibold mb-4">Transparent Pricing</span>
              <h2 className="h text-3xl sm:text-4xl font-bold text-slate-900 mb-4">Simple, flat monthly pricing</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">Unlimited orders. Unlimited staff. Unlimited tables. No per-order fees, ever. Exact pricing shared on your demo call.</p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
              {packages.map(pkg => (
                <div key={pkg.name}
                  className={`relative rounded-2xl p-7 transition-all
                    ${pkg.highlight
                      ? 'bg-gradient-to-b from-orange-500 to-orange-600 text-white shadow-2xl shadow-orange-500/30 scale-105'
                      : 'bg-white border border-slate-200 hover:shadow-xl hover:shadow-slate-200/60'}`}>
                  {pkg.badge && (
                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                      <span className="px-4 py-1 bg-amber-400 text-amber-900 text-xs font-bold rounded-full shadow-md whitespace-nowrap">{pkg.badge}</span>
                    </div>
                  )}
                  <h3 className={`h text-2xl font-bold mb-0.5 ${pkg.highlight ? 'text-white' : 'text-slate-900'}`}>{pkg.name}</h3>
                  <p className={`text-sm mb-6 ${pkg.highlight ? 'text-orange-100' : 'text-slate-500'}`}>{pkg.subtitle}</p>
                  <ul className="space-y-2.5 mb-8">
                    {pkg.features.map(f => (
                      <li key={f} className="flex items-start gap-2.5">
                        <div className={`mt-0.5 flex-shrink-0 w-4 h-4 rounded-full flex items-center justify-center
                          ${pkg.highlight ? 'bg-orange-400' : 'bg-emerald-100'}`}>
                          <Icon d={icons.check} size={9} className={pkg.highlight ? 'text-white' : 'text-emerald-600'} />
                        </div>
                        <span className={`text-sm leading-snug ${pkg.highlight ? 'text-orange-50' : 'text-slate-600'}`}>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <button onClick={() => scrollTo('contact')}
                    className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-offset-2
                      ${pkg.highlight
                        ? 'bg-white text-orange-600 hover:bg-orange-50 focus:ring-white'
                        : 'bg-orange-500 text-white hover:bg-orange-600 shadow-md shadow-orange-500/20 focus:ring-orange-500'}`}>
                    Get Started — Free Demo
                  </button>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="py-20 px-4 sm:px-6 bg-white">
          <div className="max-w-2xl mx-auto">
            <div className="text-center mb-12">
              <h2 className="h text-3xl font-bold text-slate-900 mb-3">Common questions</h2>
              <p className="text-slate-500">Still unsure? We'll answer everything on the demo call too.</p>
            </div>
            <div className="space-y-3">
              {faqs.map((faq, i) => (
                <div key={i} className="border border-slate-200 rounded-2xl overflow-hidden">
                  <button onClick={() => setActiveFaq(activeFaq === i ? null : i)}
                    aria-expanded={activeFaq === i}
                    className="w-full flex items-center justify-between px-5 py-4 text-left cursor-pointer hover:bg-slate-50 transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-inset">
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

        {/* ── Contact + Calendar ── */}
        <section id="contact" className="py-24 px-4 sm:px-6 bg-gradient-to-b from-slate-50 to-slate-100">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-14">
              <span className="inline-block px-4 py-1.5 rounded-full bg-orange-50 text-orange-700 text-sm font-semibold mb-4">Free Demo</span>
              <h2 className="h text-3xl sm:text-4xl font-bold text-slate-900 mb-4">See it live in your restaurant</h2>
              <p className="text-slate-500 text-lg max-w-xl mx-auto">30-minute walkthrough tailored to your setup — tables, kitchen, billing. No sales pitch. No commitment.</p>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">
              <div className="bg-white rounded-2xl p-7 shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="h text-xl font-bold text-slate-800 mb-6 flex items-center gap-2">
                  <Icon d={icons.mail} size={20} className="text-orange-500" /> Send a Message
                </h3>
                <ContactForm />
              </div>
              <div className="space-y-6">
                <div className="bg-white rounded-2xl p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
                  <h3 className="h text-xl font-bold text-slate-800 mb-5 flex items-center gap-2">
                    <Icon d={icons.calendar} size={20} className="text-emerald-600" /> Pick a Demo Slot
                  </h3>
                  <CalendarBooking accentClass="orange" page="MagicServe" />
                </div>
                <div className="bg-white rounded-2xl p-5 shadow-xl shadow-slate-200/50 border border-slate-100 space-y-4">
                  {[
                    { icon: 'mail',  l: 'Email',    v: 'hello@magicmanagement.in' },
                    { icon: 'phone', l: 'Phone',    v: '+91 93014 20919' },
                    { icon: 'map',   l: 'Location', v: 'Indore, India (Remote-first)' },
                  ].map(item => (
                    <div key={item.l} className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center flex-shrink-0">
                        <Icon d={icons[item.icon]} size={16} className="text-orange-500" />
                      </div>
                      <div>
                        <p className="text-xs text-slate-400">{item.l}</p>
                        <p className="text-sm font-medium text-slate-700">{item.v}</p>
                      </div>
                    </div>
                  ))}
                  <a href="https://wa.me/919301420919?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20MagicServe"
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
      <a href="https://wa.me/919301420919?text=Hi%2C%20I%27d%20like%20to%20know%20more%20about%20MagicServe"
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
            {[['features','Features'],['pricing','Pricing'],['reviews','Reviews'],['contact','Contact']].map(([id,label]) => (
              <button key={id} onClick={() => scrollTo(id)}
                className="text-sm hover:text-white transition-colors cursor-pointer focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">
                {label}
              </button>
            ))}
            <Link to="/feedback-landing" className="text-sm hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">
              Magic QR Feedback
            </Link>
            <Link to="/login" className="text-sm hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-orange-500 rounded">Sign In</Link>
          </nav>
          <p className="text-xs text-slate-500">© {new Date().getFullYear()} Magic Management. All rights reserved.</p>
        </div>
      </footer>
    </div>
  )
}
