import { useQuery } from '@tanstack/react-query'
import { PhoneIcon, EnvelopeIcon, ChatBubbleLeftEllipsisIcon, BuildingStorefrontIcon } from '@heroicons/react/24/outline'
import axios from 'axios'

const fetchBranding = () => axios.get('/api/public/branding').then(r => r.data.data)

export default function PoweredByBanner() {
  const { data: b } = useQuery({
    queryKey: ['public-branding'],
    queryFn: fetchBranding,
    staleTime: 10 * 60 * 1000,
    retry: 1,
  })

  if (!b?.brand_name) return null

  const waLink = b.contact_whatsapp
    ? `https://wa.me/${b.contact_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I want to get this hotel management system for my business.')}`
    : null

  const hasContacts = b.contact_phone || waLink || b.contact_email

  return (
    <div className="mt-8">
      <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl p-5 text-white shadow-lg">
        {/* Header */}
        <div className="flex items-center gap-3 mb-3">
          {b.brand_logo_url ? (
            <img src={b.brand_logo_url} alt={b.brand_name} className="h-8 w-8 object-contain rounded-lg bg-white/10 p-1" />
          ) : (
            <div className="h-8 w-8 rounded-lg bg-orange-500 flex items-center justify-center">
              <BuildingStorefrontIcon className="w-4 h-4 text-white" />
            </div>
          )}
          <div>
            <p className="text-xs font-semibold text-white/60 uppercase tracking-widest">Powered by</p>
            <p className="text-sm font-bold text-white leading-tight">{b.brand_name}</p>
          </div>
        </div>

        {b.sales_tagline && (
          <p className="text-xs text-white/60 leading-relaxed mb-3">{b.sales_tagline}</p>
        )}

        {hasContacts && (
          <div className="flex flex-wrap gap-3">
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
