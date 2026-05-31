import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  KeyIcon, PrinterIcon, CheckCircleIcon, ExclamationCircleIcon,
  QrCodeIcon, BellAlertIcon, CreditCardIcon, PhoneIcon, PlusIcon, TrashIcon,
} from '@heroicons/react/24/outline'
import { getOwnerSettings, updateOwnerSettings, changeOwnPassword, getFeedbackQrCodes } from '@/services/restaurantService'
import { validate, validateField, required, isStrongPassword } from '@/utils/validate'
import useAuthStore from '@/store/authStore'

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

function UpiSettingsCard({ settings, onUpdate, isPending }) {
  const [upiId, setUpiId] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (settings?.upi_id != null) setUpiId(settings.upi_id)
  }, [settings?.upi_id])

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

  useEffect(() => {
    if (settings?.contact_phones) setPhones(settings.contact_phones)
  }, [settings?.contact_phones])

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

  const Err = ({ field }) => errors[field]
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
          <Err field="current_password" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">New Password *</label>
          <input type="password" value={form.password} onChange={e => set('password', e.target.value)} className={inp('password')} placeholder="Min 8 chars, A-Z, 0-9, @$!%*#?&" />
          <Err field="password" />
          <p className="text-xs text-gray-400 mt-1">Must contain uppercase, number, and special character (@$!%*#?&)</p>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Confirm New Password *</label>
          <input type="password" value={form.password_confirmation} onChange={e => set('password_confirmation', e.target.value)} className={inp('password_confirmation')} placeholder="Repeat new password" />
          <Err field="password_confirmation" />
        </div>
        <button
          type="submit"
          disabled={mutation.isPending}
          className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow mt-1"
        >
          {mutation.isPending ? 'Changing…' : 'Change Password'}
        </button>
      </form>
    </div>
  )
}

export default function OwnerSettings() {
  const { user } = useAuthStore()
  const qc = useQueryClient()
  const hasRestaurant = !!user?.modules?.restaurant
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
        {hasRestaurant && (
          <>
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
          </>
        )}
        <ChangePasswordCard />
      </div>
    </div>
  )
}
