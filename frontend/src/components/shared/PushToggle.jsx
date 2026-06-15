import { usePushNotifications } from '@/hooks/usePushNotifications'
import { BellAlertIcon, BellSlashIcon } from '@heroicons/react/24/outline'

/**
 * Per-device "enable phone alerts" control. Wakes a sleeping/backgrounded phone
 * via OS push. Mount in a staff dashboard header.
 *
 * - Hidden entirely where push can't work (desktop without support, etc).
 * - On iOS Safari (not yet installed), shows an "Add to Home Screen" hint
 *   instead of a button, since Apple blocks push until the PWA is installed.
 *
 * `dark` styles for the dark chef/waiter headers; light otherwise.
 */
export default function PushToggle({ dark = false }) {
  const { supported, needsInstall, status, subscribed, busy, enable, disable } = usePushNotifications()

  if (!supported) return null

  if (needsInstall) {
    return (
      <span
        title="On iPhone: tap Share → Add to Home Screen, then open the app from there to enable phone alerts"
        className={`hidden sm:inline text-[11px] font-medium px-2.5 py-1.5 rounded-lg ${
          dark ? 'text-slate-400 ring-1 ring-slate-700' : 'text-gray-500 ring-1 ring-gray-200'
        }`}
      >
        Add to Home Screen for phone alerts
      </span>
    )
  }

  if (status === 'denied') {
    return (
      <span
        title="Notifications are blocked in your browser settings. Re-enable them for this site to get phone alerts."
        className={`text-[11px] font-medium px-2.5 py-1.5 rounded-lg ${
          dark ? 'text-red-300 ring-1 ring-red-900/50' : 'text-red-500 ring-1 ring-red-200'
        }`}
      >
        Alerts blocked
      </span>
    )
  }

  const base = 'flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition-colors'

  if (subscribed) {
    return (
      <button
        onClick={disable}
        title="Phone alerts on (this device) — tap to turn off"
        className={`${base} ${dark ? 'text-green-300 ring-1 ring-green-700/50 hover:bg-slate-800' : 'text-green-700 ring-1 ring-green-200 hover:bg-green-50'}`}
      >
        <BellAlertIcon className="w-4 h-4" />
        <span className="hidden sm:inline">Phone alerts on</span>
      </button>
    )
  }

  return (
    <button
      onClick={enable}
      disabled={busy}
      title="Get alerts on this phone even when the screen is off"
      className={`${base} disabled:opacity-50 ${dark ? 'text-orange-300 ring-1 ring-orange-500/40 bg-orange-500/10 hover:bg-orange-500/20' : 'text-orange-600 ring-1 ring-orange-200 bg-orange-50 hover:bg-orange-100'}`}
    >
      <BellSlashIcon className="w-4 h-4" />
      <span className="hidden sm:inline">{busy ? 'Enabling…' : 'Enable phone alerts'}</span>
    </button>
  )
}
