import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftEllipsisIcon,
  LockClosedIcon,
  ExclamationTriangleIcon,
  ExclamationCircleIcon,
  ArrowRightOnRectangleIcon,
} from '@heroicons/react/24/outline'
import useAuthStore from '@/store/authStore'
import { SUBSCRIPTION_EXPIRED_EVENT } from '@/services/api'

export const AUTH_EXPIRED_EVENT = 'app:auth-expired'
export const API_ERROR_EVENT = 'app:api-error'

export default function GlobalErrorModal() {
  const [sessionExpired, setSessionExpired] = useState(false)
  const [apiError, setApiError] = useState(null)
  const [subExpired, setSubExpired] = useState(null)
  const logout = useAuthStore((s) => s.logout)
  const navigate = useNavigate()

  useEffect(() => {
    const onAuthExpired = () => setSessionExpired(true)
    const onApiError = (e) => setApiError({ message: e.detail?.message })
    const onSubExpired = (e) => setSubExpired(e.detail?.branding ?? {})

    window.addEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
    window.addEventListener(API_ERROR_EVENT, onApiError)
    window.addEventListener(SUBSCRIPTION_EXPIRED_EVENT, onSubExpired)
    return () => {
      window.removeEventListener(AUTH_EXPIRED_EVENT, onAuthExpired)
      window.removeEventListener(API_ERROR_EVENT, onApiError)
      window.removeEventListener(SUBSCRIPTION_EXPIRED_EVENT, onSubExpired)
    }
  }, [])

  function handleLogBackIn() {
    logout()
    setSessionExpired(false)
    navigate('/login')
  }

  if (!sessionExpired && !apiError && subExpired === null) return null

  // ── Subscription expired — full-screen takeover ──────────────────────────
  if (subExpired !== null) {
    const {
      brand_name = 'Magic Management',
      brand_logo_url,
      contact_phone,
      contact_whatsapp,
      contact_email,
      sales_tagline = 'Your subscription has ended. Contact our sales team to reactivate your account.',
    } = subExpired

    const waLink = contact_whatsapp
      ? `https://wa.me/${contact_whatsapp.replace(/\D/g, '')}?text=${encodeURIComponent('Hi, I need to renew my hotel management subscription.')}`
      : null

    const hasContact = contact_phone || contact_whatsapp || contact_email

    return (
      <div className="fixed inset-0 z-[200] bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-lg border border-gray-200 w-full max-w-md overflow-hidden">
          {/* Top accent bar */}
          <div className="h-1 bg-gradient-to-r from-orange-400 to-red-500" />

          <div className="p-8">
            {/* Logo / Icon */}
            <div className="flex justify-center mb-6">
              {brand_logo_url ? (
                <img src={brand_logo_url} alt={brand_name} className="h-12 object-contain" />
              ) : (
                <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center ring-1 ring-red-100">
                  <LockClosedIcon className="w-7 h-7 text-red-500" />
                </div>
              )}
            </div>

            {/* Headline */}
            <div className="text-center mb-6">
              <h1 className="text-xl font-semibold text-gray-900 mb-2">Subscription Expired</h1>
              <p className="text-sm text-gray-500 leading-relaxed">{sales_tagline}</p>
            </div>

            {/* Contact card */}
            {hasContact && (
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 mb-6 space-y-1">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                  Contact Sales · {brand_name}
                </p>
                {contact_phone && (
                  <a href={`tel:${contact_phone}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all group">
                    <span className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center group-hover:bg-orange-100 transition-colors flex-shrink-0">
                      <PhoneIcon className="w-4 h-4 text-orange-500" />
                    </span>
                    <span>{contact_phone}</span>
                  </a>
                )}
                {waLink && (
                  <a href={waLink} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all group">
                    <span className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center group-hover:bg-emerald-100 transition-colors flex-shrink-0">
                      <ChatBubbleLeftEllipsisIcon className="w-4 h-4 text-emerald-500" />
                    </span>
                    <span>WhatsApp · {contact_whatsapp}</span>
                  </a>
                )}
                {contact_email && (
                  <a href={`mailto:${contact_email}`}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-gray-700 hover:bg-white hover:shadow-sm transition-all group">
                    <span className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center group-hover:bg-blue-100 transition-colors flex-shrink-0">
                      <EnvelopeIcon className="w-4 h-4 text-blue-500" />
                    </span>
                    <span>{contact_email}</span>
                  </a>
                )}
              </div>
            )}

            {/* Sign out */}
            <button
              onClick={() => { logout(); setSubExpired(null); navigate('/login') }}
              className="w-full flex items-center justify-center gap-2 py-2.5 text-sm text-gray-400 hover:text-gray-600 transition-colors rounded-lg hover:bg-gray-50">
              <ArrowRightOnRectangleIcon className="w-4 h-4" />
              Sign out
            </button>
          </div>

          <div className="px-8 pb-5 text-center">
            <p className="text-xs text-gray-300">
              Powered by <span className="text-gray-400 font-medium">{brand_name}</span>
            </p>
          </div>
        </div>
      </div>
    )
  }

  // ── Session / API error modals ────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-sm p-6 flex flex-col items-center gap-4 text-center">
        {sessionExpired ? (
          <>
            <div className="w-14 h-14 rounded-2xl bg-amber-50 flex items-center justify-center ring-1 ring-amber-100">
              <ExclamationTriangleIcon className="w-7 h-7 text-amber-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Session Expired</h2>
              <p className="text-sm text-gray-500">Your session has timed out. Please sign in again to continue.</p>
            </div>
            <button onClick={handleLogBackIn}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              Sign In Again
            </button>
          </>
        ) : (
          <>
            <div className="w-14 h-14 rounded-2xl bg-red-50 flex items-center justify-center ring-1 ring-red-100">
              <ExclamationCircleIcon className="w-7 h-7 text-red-500" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-gray-900 mb-1">Something Went Wrong</h2>
              <p className="text-sm text-gray-500">{apiError?.message || 'An unexpected server error occurred.'}</p>
            </div>
            <button onClick={() => setApiError(null)}
              className="w-full bg-gray-900 hover:bg-gray-800 text-white text-sm font-medium py-2.5 rounded-xl transition-colors">
              Dismiss
            </button>
          </>
        )}
      </div>
    </div>
  )
}
