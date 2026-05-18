import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  PhoneIcon, EnvelopeIcon, ChatBubbleLeftEllipsisIcon, BuildingStorefrontIcon,
  ChevronDownIcon, QrCodeIcon, DevicePhoneMobileIcon, CreditCardIcon,
  BuildingOfficeIcon, ShoppingBagIcon,
} from '@heroicons/react/24/outline'
import axios from 'axios'

const fetchBranding = () => axios.get('/api/public/branding').then(r => r.data.data)

const FEATURES = [
  {
    Icon: QrCodeIcon,
    color: 'text-amber-400',
    title: 'Google Review Magic QR',
    desc: 'Turns happy customers into Google reviews — automatically.',
  },
  {
    Icon: DevicePhoneMobileIcon,
    color: 'text-emerald-400',
    title: 'WhatsApp Digital Billing',
    desc: 'Send itemised bills to guests on WhatsApp instantly.',
  },
  {
    Icon: CreditCardIcon,
    color: 'text-blue-400',
    title: 'UPI Scanner on Every Bill',
    desc: 'Printed invoices include a live UPI QR for instant payment.',
  },
  {
    Icon: BuildingOfficeIcon,
    color: 'text-indigo-400',
    title: 'Hotel Management System',
    desc: 'Bookings, check-in/out, room service, and reports in one place.',
  },
  {
    Icon: ShoppingBagIcon,
    color: 'text-orange-400',
    title: 'Restaurant & Café Order Management',
    desc: 'Digital table menus via QR, live kitchen display, and billing.',
  },
]

export default function PoweredByBanner() {
  const [open, setOpen] = useState(false)

  const { data: b } = useQuery({
    queryKey: ['public-branding'],
    queryFn: fetchBranding,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  if (!b?.brand_name) return null

  const waLink = b.contact_whatsapp
    ? `https://wa.me/${b.contact_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I want to get this system for my business.')}`
    : null

  const hasContacts = b.contact_phone || waLink || b.contact_email

  return (
    <div className="mt-8">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl overflow-hidden text-white shadow-lg">

        {/* Header */}
        <div className="flex items-center gap-3 p-5 pb-3">
          {b.brand_logo_url ? (
            <img src={b.brand_logo_url} alt={b.brand_name} className="h-8 w-8 object-contain rounded-lg bg-white/10 p-1 shrink-0" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center shrink-0">
              <BuildingStorefrontIcon className="w-4 h-4 text-white" />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-white/50 uppercase tracking-widest">Powered by</p>
            <p className="text-sm font-bold text-white leading-tight">{b.brand_name}</p>
          </div>
        </div>

        {/* Features accordion */}
        <div className="mx-5 mb-4 rounded-xl overflow-hidden border border-white/10">
          <button
            type="button"
            onClick={() => setOpen(o => !o)}
            className="w-full flex items-center justify-between px-4 py-3 bg-white/5 hover:bg-white/10 transition-colors text-left"
          >
            <div>
              <p className="text-xs font-semibold text-white">Want this for your business?</p>
              <p className="text-[11px] text-white/50 mt-0.5">See what {b.brand_name} can do for you</p>
            </div>
            <ChevronDownIcon className={`w-4 h-4 text-white/40 transition-transform shrink-0 ml-3 ${open ? 'rotate-180' : ''}`} />
          </button>

          {open && (
            <div className="divide-y divide-white/5">
              {FEATURES.map(({ Icon, color, title, desc }) => (
                <div key={title} className="flex items-start gap-3 px-4 py-3 bg-white/[0.03]">
                  <Icon className={`w-4 h-4 ${color} shrink-0 mt-0.5`} />
                  <div>
                    <p className="text-xs font-semibold text-white">{title}</p>
                    <p className="text-[11px] text-white/50 mt-0.5 leading-relaxed">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Contact buttons */}
        {hasContacts && (
          <div className="flex flex-wrap gap-2 px-5 pb-5">
            {b.contact_phone && (
              <a href={`tel:${b.contact_phone}`}
                className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl transition-colors">
                <PhoneIcon className="w-3.5 h-3.5 text-orange-400" />
                {b.contact_phone}
              </a>
            )}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 px-3 py-1.5 rounded-xl transition-colors font-medium">
                <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5" />
                WhatsApp
              </a>
            )}
            {b.contact_email && (
              <a href={`mailto:${b.contact_email}`}
                className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-xl transition-colors">
                <EnvelopeIcon className="w-3.5 h-3.5 text-blue-400" />
                {b.contact_email}
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
