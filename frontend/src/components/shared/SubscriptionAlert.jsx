import { useState } from 'react'
import { ExclamationTriangleIcon, XMarkIcon, PhoneIcon, EnvelopeIcon } from '@heroicons/react/24/outline'
import useAuthStore from '@/store/authStore'

export default function SubscriptionAlert() {
  const alert = useAuthStore(s => s.getSubscriptionAlert())
  const [dismissed, setDismissed] = useState(false)

  if (!alert || dismissed) return null

  const { type, days_left, expires_at, branding } = alert
  const isUrgent = days_left <= 3
  const dateStr = new Date(expires_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
  const brandName = branding?.brand_name
  const phone = branding?.contact_whatsapp || branding?.contact_phone
  const email = branding?.contact_email

  const cta = type === 'trial' ? 'Subscribe to keep access' : 'Renew to avoid interruption'
  const mainMsg = type === 'trial'
    ? `Your free trial ends in ${days_left} day${days_left !== 1 ? 's' : ''} (${dateStr}).`
    : `Your subscription expires in ${days_left} day${days_left !== 1 ? 's' : ''} (${dateStr}).`

  return (
    <div className={`flex items-center gap-3 px-4 py-2 text-sm flex-wrap ${isUrgent ? 'bg-red-600 text-white' : 'bg-amber-500 text-white'}`}>
      <ExclamationTriangleIcon className="w-4 h-4 shrink-0" />
      <span className="font-medium">{mainMsg}</span>
      <span className="opacity-90">{cta}{brandName ? ` — contact ${brandName}` : '.'}</span>

      {phone && (
        <a href={`${branding?.contact_whatsapp ? 'https://wa.me/' : 'tel:'}${phone.replace(/\D/g, '')}`}
          target={branding?.contact_whatsapp ? '_blank' : undefined}
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity">
          <PhoneIcon className="w-3.5 h-3.5" />{phone}
        </a>
      )}

      {email && (
        <a href={`mailto:${email}`}
          className="inline-flex items-center gap-1 font-semibold underline underline-offset-2 hover:opacity-80 transition-opacity">
          <EnvelopeIcon className="w-3.5 h-3.5" />{email}
        </a>
      )}

      <button onClick={() => setDismissed(true)} className="ml-auto p-0.5 rounded hover:bg-white/20 transition-colors shrink-0">
        <XMarkIcon className="w-4 h-4" />
      </button>
    </div>
  )
}
