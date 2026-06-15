import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  KeyIcon, PrinterIcon, CheckCircleIcon, ExclamationCircleIcon,
  QrCodeIcon, CreditCardIcon, PhoneIcon, PlusIcon, TrashIcon,
  PowerIcon, ClockIcon, QuestionMarkCircleIcon, BuildingStorefrontIcon,
  SpeakerWaveIcon,
} from '@heroicons/react/24/outline'
import { getOwnerSettings, updateOwnerSettings, changeOwnPassword, getFeedbackQrCodes, getOutlet, toggleOutletChannel, setOutletHours } from '@/services/restaurantService'
import { validate, validateField, required, isStrongPassword } from '@/utils/validate'
import useAuthStore from '@/store/authStore'
import Spinner from '@/components/shared/Spinner'

function Toggle({ label, description, checked, onChange, disabled }) {
  return (
    <div className="flex items-center justify-between py-3">
      <div className="flex-1 min-w-0 pr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onChange}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${checked ? 'bg-orange-500' : 'bg-gray-200'}`}
      >
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function CustomerOrderingCard({ settings, onUpdate, isPending }) {
  const isOpen      = settings?.is_open                       ?? true
  const qrEnabled   = settings?.qr_ordering_enabled          ?? true
  const billEnabled = settings?.customer_bill_request_enabled ?? true

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-xl bg-indigo-50 flex items-center justify-center shrink-0">
          <QrCodeIcon className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Customer QR Ordering</h3>
          <p className="text-xs text-gray-400">Control what customers can do from the QR menu</p>
        </div>
      </div>
      <div className="divide-y divide-gray-50 mt-3">
        <Toggle
          label="Restaurant Open"
          description="Mark your restaurant as open or closed. When closed, Magic Tables shows a 'We're closed' screen and blocks new orders."
          checked={isOpen}
          disabled={isPending}
          onChange={() => onUpdate({ is_open: !isOpen })}
        />
        <Toggle
          label="QR Menu Ordering"
          description="Customers can browse and place orders from their phone. Disable to make the QR menu view-only."
          checked={qrEnabled}
          disabled={isPending}
          onChange={() => onUpdate({ qr_ordering_enabled: !qrEnabled })}
        />
        <Toggle
          label="Customer Bill Request"
          description='Customers can tap "Request Bill" from the QR menu — billing counter and waiter are notified.'
          checked={billEnabled}
          disabled={isPending}
          onChange={() => onUpdate({ customer_bill_request_enabled: !billEnabled })}
        />
      </div>
    </div>
  )
}

function KotSettingsCard({ settings, onUpdate, isPending, hasFeedback, feedbackReady }) {
  const kotEnabled      = settings?.kot_enabled      ?? false
  const autoPrint       = settings?.kot_auto_print   ?? false
  const kotPrinter      = settings?.kot_printer      ?? 'kitchen'
  const billAutoPrint   = settings?.bill_auto_print  ?? false
  const feedbackOnBill  = settings?.feedback_on_bill ?? false

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
          <PrinterIcon className="w-4 h-4 text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Printing</h3>
          <p className="text-xs text-gray-400">KOT and bill auto-print settings</p>
        </div>
      </div>

      <div className="divide-y divide-gray-50 mt-3">
        <Toggle
          label="Auto-print bill on close table"
          description="Automatically opens the print dialog when a table is billed and closed"
          checked={billAutoPrint}
          disabled={isPending}
          onChange={() => onUpdate({ bill_auto_print: !billAutoPrint })}
        />

        {hasFeedback && (
          <div>
            <Toggle
              label="Show feedback QR on bill"
              description={feedbackReady
                ? "Prints a 'Leave us your feedback' QR code at the top of every bill"
                : "Set up at least one active feedback QR in the Feedback section first"}
              checked={feedbackOnBill}
              disabled={isPending || !feedbackReady}
              onChange={() => feedbackReady && onUpdate({ feedback_on_bill: !feedbackOnBill })}
            />
            {!feedbackReady && (
              <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5 mt-1">
                No active feedback QR found. Go to <strong>Feedback → QR Codes</strong> and create one first.
              </p>
            )}
          </div>
        )}

        <Toggle
          label="Enable KOT printing"
          description="When on, KOT can be printed for every new kitchen order"
          checked={kotEnabled}
          disabled={isPending}
          onChange={() => onUpdate({ kot_enabled: !kotEnabled })}
        />

        {kotEnabled && (
          <>
            <Toggle
              label="Auto-print KOT on new order"
              description="Automatically triggers print when a new order arrives at the kitchen"
              checked={autoPrint}
              disabled={isPending}
              onChange={() => onUpdate({ kot_auto_print: !autoPrint })}
            />

            <div className="py-3">
              <p className="text-sm font-medium text-gray-800 mb-2">Print KOT from</p>
              <div className="flex gap-2">
                {[
                  { value: 'kitchen', label: 'Kitchen screen', desc: "Chef's display prints the KOT" },
                  { value: 'billing', label: 'Billing counter', desc: "Billing counter screen prints the KOT" },
                ].map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    disabled={isPending}
                    onClick={() => onUpdate({ kot_printer: opt.value })}
                    className={`flex-1 rounded-xl border-2 px-3 py-2.5 text-left transition-colors ${kotPrinter === opt.value ? 'border-orange-400 bg-orange-50' : 'border-gray-200 bg-white hover:bg-gray-50'}`}
                  >
                    <p className={`text-xs font-semibold ${kotPrinter === opt.value ? 'text-orange-700' : 'text-gray-700'}`}>{opt.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5">{opt.desc}</p>
                  </button>
                ))}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

function BusinessDetailsCard({ settings, onUpdate, isPending }) {
  const [form, setForm]   = useState({ name: '', address: '', city: '', state: '', gstin: '' })
  const [saved, setSaved] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings) {
      setForm({
        name:    settings.name    ?? '',
        address: settings.address ?? '',
        city:    settings.city    ?? '',
        state:   settings.state   ?? '',
        gstin:   settings.gstin   ?? '',
      })
    }
  }, [settings?.name, settings?.address, settings?.city, settings?.state, settings?.gstin])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = () => {
    onUpdate({
      name:    form.name.trim(),
      address: form.address.trim(),
      city:    form.city.trim(),
      state:   form.state.trim(),
      gstin:   form.gstin.trim(),
    })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
          <BuildingStorefrontIcon className="w-4 h-4 text-orange-500" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Business Details</h3>
          <p className="text-xs text-gray-400">Name, address &amp; GSTIN — printed on the bill header</p>
        </div>
      </div>

      <div className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Business Name</label>
          <input value={form.name} onChange={e => { setForm(f => ({ ...f, name: e.target.value })); setSaved(false) }}
            placeholder="e.g. Spice Garden Restaurant" className={inp}/>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">Address</label>
          <input value={form.address} onChange={e => { setForm(f => ({ ...f, address: e.target.value })); setSaved(false) }}
            placeholder="Street, area, landmark" className={inp}/>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">City</label>
            <input value={form.city} onChange={e => { setForm(f => ({ ...f, city: e.target.value })); setSaved(false) }}
              placeholder="City" className={inp}/>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">State</label>
            <input value={form.state} onChange={e => { setForm(f => ({ ...f, state: e.target.value })); setSaved(false) }}
              placeholder="State" className={inp}/>
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1.5">GSTIN</label>
          <input value={form.gstin} onChange={e => { setForm(f => ({ ...f, gstin: e.target.value.toUpperCase() })); setSaved(false) }}
            placeholder="15-digit GST number (optional)" maxLength={20} className={inp}/>
        </div>
        <button onClick={handleSave} disabled={isPending}
          className={`w-full px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'} disabled:opacity-50`}>
          {saved ? 'Saved!' : 'Save Business Details'}
        </button>
        <p className="text-xs text-gray-400">
          Shown as <span className="font-medium">Name → Address, City → GSTIN</span> at the top of every printed bill.
        </p>
      </div>
    </div>
  )
}

function GstSettingsCard({ settings, onUpdate, isPending }) {
  const [rate, setRate]         = useState('')
  const [saved, setSaved]       = useState(false)
  const inclusive               = settings?.gst_inclusive ?? false

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings?.gst_rate != null) setRate(String(settings.gst_rate))
  }, [settings?.gst_rate])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = () => {
    const parsed = parseFloat(rate)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return
    onUpdate({ gst_rate: parsed })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-violet-50 flex items-center justify-center shrink-0">
          <span className="text-violet-500 font-bold text-sm">%</span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">GST / Tax Settings</h3>
          <p className="text-xs text-gray-400">Configure how GST is applied to your menu prices</p>
        </div>
      </div>

      {/* Inclusive toggle */}
      <div className="flex items-center justify-between py-3 border-b border-gray-50 mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-medium text-gray-800">Prices include GST</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {inclusive
              ? 'Menu prices already include tax. Bills show "incl. GST" and extract the tax component.'
              : 'GST is added on top of menu prices at checkout. Bills show subtotal + GST = total.'}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={inclusive} disabled={isPending}
          onClick={() => onUpdate({ gst_inclusive: !inclusive })}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${inclusive ? 'bg-orange-500' : 'bg-gray-200'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${inclusive ? 'translate-x-6' : 'translate-x-1'}`}/>
        </button>
      </div>

      {/* Rate input */}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Default GST Rate (%)</label>
        <div className="flex gap-2">
          <input type="number" min="0" max="100" step="0.5" value={rate}
            onChange={e => { setRate(e.target.value); setSaved(false) }}
            placeholder="e.g. 5"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"/>
          <button onClick={handleSave} disabled={isPending}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'} disabled:opacity-50`}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">
          Individual items can override this rate in the menu editor (Advanced section).
        </p>
      </div>

      {/* GST mode explanation */}
      <div className={`mt-3 rounded-xl px-4 py-3 text-xs ${inclusive ? 'bg-violet-50 text-violet-700' : 'bg-blue-50 text-blue-700'}`}>
        {inclusive
          ? <>📌 <strong>Inclusive mode:</strong> ₹100 item with 5% GST → customer pays ₹100. Tax collected = ₹4.76 (extracted from price).</>
          : <>📌 <strong>Exclusive mode:</strong> ₹100 item with 5% GST → customer pays ₹105. Tax collected = ₹5 (added on top).</>
        }
      </div>
    </div>
  )
}

function HotelGstSettingsCard({ settings, onUpdate, isPending }) {
  const [rate, setRate]   = useState('')
  const [saved, setSaved] = useState(false)
  const inclusive         = settings?.hotel_gst_inclusive ?? false

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings?.hotel_gst_rate != null) setRate(String(settings.hotel_gst_rate))
  }, [settings?.hotel_gst_rate])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = () => {
    const parsed = parseFloat(rate)
    if (isNaN(parsed) || parsed < 0 || parsed > 100) return
    onUpdate({ hotel_gst_rate: parsed })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <span className="text-blue-500 font-bold text-sm">%</span>
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Hotel GST / Tax Settings</h3>
          <p className="text-xs text-gray-400">Configure GST applied to room charges on bookings</p>
        </div>
      </div>

      <div className="flex items-center justify-between py-3 border-b border-gray-50 mb-3">
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-medium text-gray-800">Room prices include GST</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {inclusive
              ? 'Room price already includes tax. Bills extract the GST component.'
              : 'GST is added on top of room price. Bills show subtotal + GST = total.'}
          </p>
        </div>
        <button type="button" role="switch" aria-checked={inclusive} disabled={isPending}
          onClick={() => onUpdate({ hotel_gst_inclusive: !inclusive })}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-40 ${inclusive ? 'bg-orange-500' : 'bg-gray-200'}`}>
          <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${inclusive ? 'translate-x-6' : 'translate-x-1'}`} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1.5">Hotel GST Rate (%)</label>
        <div className="flex gap-2">
          <input type="number" min="0" max="100" step="0.5" value={rate}
            onChange={e => { setRate(e.target.value); setSaved(false) }}
            placeholder="e.g. 12"
            className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400" />
          <button onClick={handleSave} disabled={isPending}
            className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'} disabled:opacity-50`}>
            {saved ? 'Saved!' : 'Save'}
          </button>
        </div>
        <p className="text-xs text-gray-400 mt-1.5">Common rates: 12% (tariff ₹2500–₹7499), 18% (tariff ≥₹7500), 0% (budget hotels).</p>
      </div>

      <div className={`mt-3 rounded-xl px-4 py-3 text-xs ${inclusive ? 'bg-blue-50 text-blue-700' : 'bg-indigo-50 text-indigo-700'}`}>
        {inclusive
          ? <>📌 <strong>Inclusive:</strong> ₹1000/night with 12% GST → guest pays ₹1000. GST extracted = ₹107.14.</>
          : <>📌 <strong>Exclusive:</strong> ₹1000/night with 12% GST → guest pays ₹1120. GST added = ₹120.</>
        }
      </div>
    </div>
  )
}

function UpiSettingsCard({ settings, onUpdate, isPending }) {
  const [upiId, setUpiId] = useState('')
  const [saved, setSaved] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings?.upi_id != null) setUpiId(settings.upi_id)
  }, [settings?.upi_id])
  /* eslint-enable react-hooks/set-state-in-effect */

  const handleSave = () => {
    onUpdate({ upi_id: upiId.trim() || null })
    setSaved(true)
    setTimeout(() => setSaved(false), 2500)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-green-50 flex items-center justify-center shrink-0">
          <CreditCardIcon className="w-4 h-4 text-green-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">UPI Payment</h3>
          <p className="text-xs text-gray-400">Your UPI ID will appear as a scannable QR on printed bills when payment method is UPI</p>
        </div>
      </div>
      <div className="flex gap-2">
        <input
          type="text"
          value={upiId}
          onChange={e => { setUpiId(e.target.value); setSaved(false) }}
          placeholder="yourname@upi or yourname@okaxis"
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
        <button
          onClick={handleSave}
          disabled={isPending}
          className={`px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'} disabled:opacity-50`}
        >
          {saved ? 'Saved!' : 'Save'}
        </button>
      </div>
      {upiId && (
        <p className="text-xs text-gray-400 mt-2">
          QR will encode: <span className="font-mono text-gray-600">upi://pay?pa={upiId}</span>
        </p>
      )}
    </div>
  )
}

function ContactPhonesCard({ settings, onUpdate, isPending }) {
  const [phones, setPhones] = useState([])
  const [input, setInput] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (settings?.contact_phones) setPhones(settings.contact_phones)
  }, [settings?.contact_phones])
  /* eslint-enable react-hooks/set-state-in-effect */

  const addPhone = () => {
    const cleaned = input.replace(/\D/g, '').slice(0, 10)
    if (!/^[6-9]\d{9}$/.test(cleaned)) {
      setError('Enter a valid 10-digit Indian mobile number')
      return
    }
    if (phones.includes(cleaned)) {
      setError('This number is already in the list')
      return
    }
    if (phones.length >= 5) {
      setError('Maximum 5 numbers allowed')
      return
    }
    const updated = [...phones, cleaned]
    setPhones(updated)
    setInput('')
    setError('')
    onUpdate({ contact_phones: updated })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const removePhone = (phone) => {
    const updated = phones.filter(p => p !== phone)
    setPhones(updated)
    const patch = { contact_phones: updated }
    if (settings?.active_contact_phone === phone) patch.active_contact_phone = null
    onUpdate(patch)
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
          <PhoneIcon className="w-4 h-4 text-rose-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Restaurant Contact Numbers</h3>
          <p className="text-xs text-gray-400">Add up to 5 phone numbers. The billing counter selects which one is shown to customers on the payment screen.</p>
        </div>
      </div>

      {phones.length > 0 && (
        <ul className="space-y-2 mb-4">
          {phones.map(phone => (
            <li key={phone} className="flex items-center justify-between bg-gray-50 rounded-xl px-3 py-2.5">
              <span className="text-sm font-mono text-gray-800">+91 {phone}</span>
              <button
                onClick={() => removePhone(phone)}
                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                aria-label={`Remove ${phone}`}
              >
                <TrashIcon className="w-4 h-4" />
              </button>
            </li>
          ))}
        </ul>
      )}

      {phones.length < 5 && (
        <div className="flex gap-2">
          <div className="relative flex-1">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-gray-400 font-medium pointer-events-none">+91</span>
            <input
              type="tel"
              value={input}
              onChange={e => { setInput(e.target.value.replace(/\D/g, '').slice(0, 10)); setError('') }}
              onKeyDown={e => e.key === 'Enter' && addPhone()}
              placeholder="98765 43210"
              inputMode="numeric"
              className="w-full border border-gray-200 rounded-xl pl-10 pr-3 py-2.5 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
          </div>
          <button
            onClick={addPhone}
            disabled={isPending}
            className={`flex items-center gap-1.5 px-4 py-2.5 rounded-xl text-sm font-semibold transition-colors ${saved ? 'bg-green-500 text-white' : 'bg-orange-500 text-white hover:bg-orange-600'} disabled:opacity-50`}
          >
            <PlusIcon className="w-4 h-4" />
            Add
          </button>
        </div>
      )}
      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}
      {phones.length === 0 && <p className="text-xs text-gray-400 mt-2">No numbers added yet. Customers won't see a call option.</p>}
    </div>
  )
}

const PWD_RULES = {
  current_password: [required('Current password')],
  password:         [required('New password'), isStrongPassword()],
}

// Which alerts can ring, grouped by the staff screen that hears them. The key
// is "<role>.<kind>" — it must match the (role, kind) pairs in
// useNotificationCenter's ROLE_KINDS, and the backend NotificationService kinds.
const ALERT_GROUPS = [
  {
    role: 'Kitchen (Chef)',
    items: [
      { key: 'chef.new_kot', label: 'New kitchen order (KOT)', desc: 'A new ticket arrives in the kitchen' },
    ],
  },
  {
    role: 'Billing Counter',
    items: [
      { key: 'billing.new_order',       label: 'New order',          desc: 'A new order is placed' },
      { key: 'billing.order_ready',     label: 'Order ready to serve', desc: 'Kitchen marked an order ready' },
      { key: 'billing.bill_requested',  label: 'Bill requested',     desc: 'A table/customer requested the bill' },
      { key: 'billing.waiter_called',   label: 'Waiter called',      desc: 'A customer called for a waiter' },
      { key: 'billing.payment_claimed', label: 'Payment claimed',    desc: 'Customer says they paid via UPI' },
      { key: 'billing.mt_order',        label: 'Magic Tables order', desc: 'Order from the Magic Tables app' },
    ],
  },
  {
    role: 'Waiter',
    items: [
      { key: 'waiter.order_ready',    label: 'Order ready to serve', desc: 'Kitchen marked their order ready' },
      { key: 'waiter.bill_requested', label: 'Bill requested',       desc: "Their table requested the bill" },
      { key: 'waiter.waiter_called',  label: 'Waiter called',        desc: 'A customer called for a waiter' },
    ],
  },
]

function AlertSoundsCard({ settings, onUpdate, isPending }) {
  const prefs = settings?.ring_prefs ?? {}
  // Absent key => rings (default true).
  const isOn = (key) => prefs[key] !== false

  const toggle = (key) => {
    onUpdate({ ring_prefs: { ...prefs, [key]: !isOn(key) } })
  }

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-1">
        <div className="w-8 h-8 rounded-xl bg-orange-50 flex items-center justify-center shrink-0">
          <SpeakerWaveIcon className="w-4 h-4 text-orange-500" />
        </div>
        <h3 className="font-semibold text-gray-900 text-sm">Alert Sounds</h3>
      </div>
      <p className="text-xs text-gray-400 mb-2">
        Choose which alerts ring on each screen. Turning one off stops the sound and phone push for that alert.
      </p>

      {ALERT_GROUPS.map((group) => (
        <div key={group.role} className="mt-3">
          <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{group.role}</p>
          <div className="divide-y divide-gray-50">
            {group.items.map((item) => (
              <Toggle
                key={item.key}
                label={item.label}
                description={item.desc}
                checked={isOn(item.key)}
                onChange={() => toggle(item.key)}
                disabled={isPending}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function ChangePasswordCard() {
  const [form, setForm] = useState({ current_password: '', password: '', password_confirmation: '' })
  const [errors, setErrors] = useState({})
  const [success, setSuccess] = useState('')

  const set = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    const err = validateField(PWD_RULES, k, v, next)
    setErrors(e => ({ ...e, [k]: err }))
  }

  const mutation = useMutation({
    mutationFn: changeOwnPassword,
    onSuccess: () => {
      setSuccess('Password changed successfully')
      setForm({ current_password: '', password: '', password_confirmation: '' })
      setErrors({})
      setTimeout(() => setSuccess(''), 4000)
    },
    onError: (err) => {
      const data = err.response?.data
      if (data?.errors) {
        const normalized = {}
        for (const [k, v] of Object.entries(data.errors)) normalized[k] = Array.isArray(v) ? v[0] : v
        setErrors(normalized)
      } else {
        setErrors({ general: data?.message ?? 'Failed to change password' })
      }
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate(PWD_RULES, form)
    if (form.password !== form.password_confirmation) errs.password_confirmation = 'Passwords do not match'
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    mutation.mutate(form)
  }

  const inp = (field) =>
    `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 transition-colors ${errors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`

  const Err = (field) => errors[field]
    ? <p className="text-xs text-red-500 mt-0.5">{errors[field]}</p>
    : null

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2.5 mb-4">
        <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center shrink-0">
          <KeyIcon className="w-4 h-4 text-blue-600" />
        </div>
        <div>
          <h3 className="font-semibold text-gray-900 text-sm">Change Password</h3>
          <p className="text-xs text-gray-400">Update your account password</p>
        </div>
      </div>

      {success && (
        <div className="flex items-center gap-2 bg-green-50 text-green-700 text-sm px-3 py-2 rounded-xl mb-4">
          <CheckCircleIcon className="w-4 h-4 shrink-0" />{success}
        </div>
      )}
      {errors.general && (
        <div className="flex items-center gap-2 bg-red-50 text-red-600 text-sm px-3 py-2 rounded-xl mb-4">
          <ExclamationCircleIcon className="w-4 h-4 shrink-0" />{errors.general}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-3">
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Current Password *</label>
          <input type="password" value={form.current_password} onChange={e => set('current_password', e.target.value)} className={inp('current_password')} placeholder="Enter current password" />
          {Err('current_password')}
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">New Password *</label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)} className={inp('password')} placeholder="Min 8 chars, A-Z, 0-9, @$!%*#?&" />
          {Err('password')}
          <p className="text-xs text-gray-400 mt-1">Must contain uppercase, number, and special character (@$!%*#?&)</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password *</label>
          <input type="password" value={form.password_confirmation} onChange={e => set('password_confirmation', e.target.value)} className={inp('password_confirmation')} placeholder="Repeat new password" />
          {Err('password_confirmation')}
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="inline-flex items-center justify-center gap-2 w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow mt-1"
        >
          {mutation.isPending && <Spinner size="w-4 h-4" />}
          {mutation.isPending ? 'Changing…' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}

const ZOMATO_HELP_URL = 'https://www.zomato.com/partners/onlineordering/help/'
const SWIGGY_HELP_URL = 'https://partner.swiggy.com/help'
const OUTLET_DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ChannelToggle({ label, online, onToggle, reasons, busy }) {
  const [showReason, setShowReason] = useState(false)
  const [reason, setReason] = useState('')

  if (showReason && online) {
    // about to go offline — ask for a reason
    return (
      <div className="py-3 border-t border-gray-50 first:border-0">
        <p className="text-sm font-medium text-gray-800 mb-2">Turn off {label} — why?</p>
        <select value={reason} onChange={e => setReason(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 mb-2 focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">Select a reason…</option>
          {reasons?.map(r => <option key={r.code} value={r.code}>{r.label}</option>)}
        </select>
        <div className="flex gap-2">
          <button disabled={busy} onClick={() => { onToggle(false, reason || undefined); setShowReason(false); setReason('') }}
            className="px-4 py-1.5 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl disabled:opacity-50">Turn Off</button>
          <button onClick={() => setShowReason(false)} className="px-4 py-1.5 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between py-3 border-t border-gray-50 first:border-0">
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />
        <span className="text-sm font-medium text-gray-800">{label}</span>
        <span className={`text-xs ${online ? 'text-emerald-600' : 'text-red-500'}`}>{online ? 'Online' : 'Offline'}</span>
      </div>
      <button type="button" role="switch" aria-checked={online} disabled={busy}
        onClick={() => online ? setShowReason(true) : onToggle(true)}
        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors disabled:opacity-40 ${online ? 'bg-orange-500' : 'bg-gray-200'}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${online ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </div>
  )
}

function OutletHoursEditor({ outlet, busy, onSave }) {
  const allHours = (outlet?.hours ?? []).filter(h => h.channel === 'all')
  const [rows, setRows] = useState(
    allHours.map(h => ({ day_of_week: h.day_of_week, open_time: h.open_time?.slice(0, 5) ?? '10:00', close_time: h.close_time?.slice(0, 5) ?? '23:00' }))
  )
  const addRow = () => setRows(r => [...r, { day_of_week: 1, open_time: '10:00', close_time: '23:00' }])
  const upd = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const remove = (i) => setRows(r => r.filter((_, idx) => idx !== i))

  return (
    <div className="mt-3 pt-3 border-t border-gray-50">
      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2 flex items-center gap-1.5">
        <ClockIcon className="w-3.5 h-3.5" /> Operational Hours
      </p>
      <div className="space-y-2 mb-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={row.day_of_week} onChange={e => upd(i, 'day_of_week', Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50">
              {OUTLET_DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
            </select>
            <input type="time" value={row.open_time} onChange={e => upd(i, 'open_time', e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="time" value={row.close_time} onChange={e => upd(i, 'close_time', e.target.value)} className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
          </div>
        ))}
        {!rows.length && <p className="text-xs text-gray-400">Open 24/7 (no hours set).</p>}
      </div>
      <div className="flex items-center justify-between">
        <button onClick={addRow} className="text-sm text-orange-600 font-medium hover:text-orange-700 flex items-center gap-1">
          <PlusIcon className="w-4 h-4" /> Add slot
        </button>
        <button disabled={busy} onClick={() => onSave({ channel: 'all', hours: rows })}
          className="px-4 py-1.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl disabled:opacity-50">
          Save Hours
        </button>
      </div>
    </div>
  )
}

function OutletCard() {
  const qc = useQueryClient()
  const { data: outlet } = useQuery({ queryKey: ['owner-outlet'], queryFn: () => getOutlet().then(r => r.data.data) })

  const toggle = useMutation({
    mutationFn: toggleOutletChannel,
    onSuccess: (res) => qc.setQueryData(['owner-outlet'], res.data.data),
  })
  const saveHours = useMutation({
    mutationFn: setOutletHours,
    onSuccess: (res) => qc.setQueryData(['owner-outlet'], res.data.data),
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
      <div className="flex items-center gap-2 mb-1">
        <PowerIcon className="w-5 h-5 text-orange-500" />
        <h3 className="font-semibold text-gray-900">Outlet Status</h3>
      </div>
      <p className="text-xs text-gray-400 mb-3">Turn ordering channels on or off and set operational hours.</p>

      <ChannelToggle label="Dine-in / QR" online={outlet?.is_open ?? true} busy={toggle.isPending}
        reasons={outlet?.offline_reasons}
        onToggle={(online, offline_reason) => toggle.mutate({ channel: 'dine_in', online, offline_reason })} />
      <ChannelToggle label="Zomato" online={outlet?.zomato_online ?? true} busy={toggle.isPending}
        reasons={outlet?.offline_reasons}
        onToggle={(online, offline_reason) => toggle.mutate({ channel: 'zomato', online, offline_reason })} />
      <ChannelToggle label="Swiggy" online={outlet?.swiggy_online ?? true} busy={toggle.isPending}
        reasons={outlet?.offline_reasons}
        onToggle={(online, offline_reason) => toggle.mutate({ channel: 'swiggy', online, offline_reason })} />

      {outlet?.offline_reason && (
        <p className="text-xs text-red-500 mt-2">
          Currently offline: {outlet.offline_reasons?.find(r => r.code === outlet.offline_reason)?.label ?? outlet.offline_reason}
        </p>
      )}

      <OutletHoursEditor outlet={outlet} busy={saveHours.isPending} onSave={(d) => saveHours.mutate(d)} />

      <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
        <a href={ZOMATO_HELP_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#e23744] hover:underline font-medium">
          <QuestionMarkCircleIcon className="w-4 h-4" /> Zomato Help Centre
        </a>
        <a href={SWIGGY_HELP_URL} target="_blank" rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 text-sm text-[#fc8019] hover:underline font-medium">
          <QuestionMarkCircleIcon className="w-4 h-4" /> Swiggy Partner Help
        </a>
      </div>
    </div>
  )
}

export default function OwnerSettings() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const hasRestaurant = !!user?.modules?.restaurant
  const hasHotel      = !!user?.modules?.hotel
  const hasFeedback   = !!user?.modules?.feedback

  const { data: settings } = useQuery({
    queryKey: ['owner-settings'],
    queryFn: () => getOwnerSettings().then(r => r.data.data),
  })

  const { data: feedbackQrCodes } = useQuery({
    queryKey: ['feedback-qr-codes'],
    queryFn: () => getFeedbackQrCodes().then(r => r.data.data),
    enabled: hasFeedback,
  })
  const feedbackReady = (feedbackQrCodes ?? []).some(q => q.is_active)

  const updateMutation = useMutation({
    mutationFn: updateOwnerSettings,
    onSuccess: (res) => {
      qc.setQueryData(['owner-settings'], res.data.data)
      qc.invalidateQueries({ queryKey: ['owner-settings'] })
    },
  })

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Settings</h2>
        <p className="text-sm text-gray-400 mt-0.5">Configure your business settings and account security</p>
      </div>

      <div className="space-y-4">
        <BusinessDetailsCard
          settings={settings}
          onUpdate={(patch) => updateMutation.mutate(patch)}
          isPending={updateMutation.isPending}
        />
        {hasRestaurant && (
          <>
            <OutletCard />
            <GstSettingsCard
              settings={settings}
              onUpdate={(patch) => updateMutation.mutate(patch)}
              isPending={updateMutation.isPending}
            />
            <CustomerOrderingCard
              settings={settings}
              onUpdate={(patch) => updateMutation.mutate(patch)}
              isPending={updateMutation.isPending}
            />
            <KotSettingsCard
              settings={settings}
              onUpdate={(patch) => updateMutation.mutate(patch)}
              isPending={updateMutation.isPending}
              hasFeedback={hasFeedback}
              feedbackReady={feedbackReady}
            />
            <UpiSettingsCard
              settings={settings}
              onUpdate={(patch) => updateMutation.mutate(patch)}
              isPending={updateMutation.isPending}
            />
            <ContactPhonesCard
              settings={settings}
              onUpdate={(patch) => updateMutation.mutate(patch)}
              isPending={updateMutation.isPending}
            />
            <AlertSoundsCard
              settings={settings}
              onUpdate={(patch) => updateMutation.mutate(patch)}
              isPending={updateMutation.isPending}
            />
          </>
        )}
        {hasHotel && (
          <HotelGstSettingsCard
            settings={settings}
            onUpdate={(patch) => updateMutation.mutate(patch)}
            isPending={updateMutation.isPending}
          />
        )}
        <ChangePasswordCard />
      </div>
    </div>
  )
}
