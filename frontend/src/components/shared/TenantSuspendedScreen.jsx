import {
  PhoneIcon, EnvelopeIcon, ChatBubbleLeftEllipsisIcon,
  BuildingStorefrontIcon, LockClosedIcon,
} from '@heroicons/react/24/outline'

export default function TenantSuspendedScreen({ tenantName, branding = {} }) {
  const {
    brand_name, brand_logo_url,
    contact_phone, contact_whatsapp, contact_email, sales_tagline,
  } = branding

  const waLink = contact_whatsapp
    ? `https://wa.me/${contact_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent(`Hi, I'm trying to access ${tenantName}'s service. Can you help?`)}`
    : null

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-5">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        <div className="h-1 bg-gradient-to-r from-orange-400 to-red-500" />

        <div className="p-7 text-center">
          {/* Lock icon */}
          <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center ring-1 ring-red-100 mx-auto mb-5">
            <LockClosedIcon className="w-7 h-7 text-red-400" />
          </div>

          {/* Message */}
          <h1 className="text-base font-semibold text-gray-900 mb-1">
            Service Unavailable
          </h1>
          <p className="text-sm text-gray-500 leading-relaxed">
            <span className="font-medium text-gray-700">{tenantName}</span>'s subscription has expired.
            This service is temporarily unavailable.
          </p>
        </div>

        {/* Contact card */}
        {(contact_phone || waLink || contact_email) && (
          <div className="mx-5 mb-5 bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-1">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2.5">
              Contact {brand_name ?? 'Support'}
            </p>
            {contact_phone && (
              <a href={`tel:${contact_phone}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all group">
                <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 shrink-0">
                  <PhoneIcon className="w-4 h-4 text-orange-500" />
                </span>
                {contact_phone}
              </a>
            )}
            {waLink && (
              <a href={waLink} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all group">
                <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 shrink-0">
                  <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-emerald-500" />
                </span>
                WhatsApp · {contact_whatsapp}
              </a>
            )}
            {contact_email && (
              <a href={`mailto:${contact_email}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all group">
                <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 shrink-0">
                  <EnvelopeIcon className="w-4 h-4 text-blue-500" />
                </span>
                {contact_email}
              </a>
            )}
          </div>
        )}

        {/* Powered by */}
        <div className="px-7 pb-6 text-center">
          <div className="flex items-center justify-center gap-2">
            {brand_logo_url ? (
              <img src={brand_logo_url} alt={brand_name} className="h-5 object-contain" />
            ) : (
              <div className="w-5 h-5 rounded bg-orange-500 flex items-center justify-center shrink-0">
                <BuildingStorefrontIcon className="w-3 h-3 text-white" />
              </div>
            )}
            <p className="text-xs text-gray-400">
              Powered by <span className="font-medium text-gray-500">{brand_name ?? 'Magic Management'}</span>
            </p>
          </div>
          {sales_tagline && (
            <p className="text-xs text-gray-400 mt-1">{sales_tagline}</p>
          )}
        </div>
      </div>
    </div>
  )
}
