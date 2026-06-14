import { useState, useRef, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
  PhoneIcon,
  EnvelopeIcon,
  ChatBubbleLeftEllipsisIcon,
  PhotoIcon,
  CheckCircleIcon,
  BuildingStorefrontIcon,
  TagIcon,
  ArrowUpTrayIcon,
} from '@heroicons/react/24/outline'
import { getBranding, updateBranding } from '@/services/superadminService'
import { validate, required, isEmail, isPhone } from '@/utils/validate'

function Field({ label, icon: Icon, children, hint }) {
  return (
    <div>
      <label className="flex items-center gap-1.5 text-xs font-medium text-gray-600 mb-1.5">
        {Icon && <Icon className="w-3.5 h-3.5 text-gray-400" />}
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
    </div>
  )
}

function Input({ value, onChange, className, ...props }) {
  return (
    <input
      value={value ?? ''}
      onChange={onChange}
      className={`w-full px-3 py-2.5 text-sm bg-white border rounded-lg text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-shadow ${className ?? 'border-gray-200'}`}
      {...props}
    />
  )
}

export default function BrandingSettings() {
  const qc = useQueryClient()
  const fileRef = useRef()
  const [form, setForm] = useState(null)
  const [logoPreview, setLogoPreview] = useState(null)
  const [logoFile, setLogoFile] = useState(null)
  const [saved, setSaved] = useState(false)
  const [fieldErrors, setFieldErrors] = useState({})
  const formRef = useScrollToFirstError(fieldErrors)

  const { isLoading, data: brandingData } = useQuery({
    queryKey: ['branding'],
    queryFn: () => getBranding().then(r => r.data.data),
  })

  // Populate form on load and after successful save (re-sync fresh logo URL)
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    if (brandingData) {
      setForm(brandingData)
      setLogoPreview(null)
      setLogoFile(null)
    }
  }, [brandingData])
  /* eslint-enable react-hooks/set-state-in-effect */

  const mutation = useMutation({
    mutationFn: (fd) => updateBranding(fd),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['branding'] })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    },
  })

  const handleFile = (e) => {
    const file = e.target.files[0]
    if (!file) return
    if (file.size > 2 * 1024 * 1024) { setFieldErrors(f => ({ ...f, brand_logo: 'Logo must be under 2 MB' })); return }
    if (!['image/png', 'image/jpeg', 'image/jpg', 'image/webp'].includes(file.type)) {
      setFieldErrors(f => ({ ...f, brand_logo: 'Only PNG, JPG, or WebP images are allowed' })); return
    }
    setFieldErrors(f => ({ ...f, brand_logo: undefined }))
    setLogoFile(file)
    setLogoPreview(URL.createObjectURL(file))
  }

  const setField = (k, v) => { setForm(f => ({ ...f, [k]: v })); setFieldErrors(e => ({ ...e, [k]: undefined })) }

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate({
      brand_name:    [required('Brand name')],
      contact_email: [isEmail('Contact email')],
      contact_phone: [isPhone('Phone number')],
      contact_whatsapp: [isPhone('WhatsApp number')],
    }, form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setFieldErrors({})
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => {
      if (v !== null && v !== undefined && k !== 'brand_logo' && k !== 'brand_logo_url') {
        fd.append(k, v)
      }
    })
    if (logoFile) fd.append('brand_logo', logoFile)
    mutation.mutate(fd)
  }

  if (isLoading || !form) {
    return (
      <div className="max-w-2xl space-y-4">
        {[1, 2, 3].map(i => (
          <div key={i} className="bg-white rounded-xl border border-gray-200 p-5 animate-pulse h-32" />
        ))}
      </div>
    )
  }

  const logoSrc = logoPreview || form.brand_logo_url

  return (
    <div className="max-w-2xl">
      {/* Page header */}
      <div className="mb-7">
        <h2 className="text-xl font-semibold text-gray-900">Branding & Sales Contact</h2>
        <p className="text-sm text-gray-500 mt-1">
          Shown on the subscription-expired screen for every tenant, and in the footer of all customer-facing QR pages.
        </p>
      </div>

      <form ref={formRef} onSubmit={handleSubmit} className="space-y-5">

        {/* ── Logo ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-800 mb-4">Brand Logo</h3>
          <div className="flex items-start gap-5">
            {/* Preview */}
            <div
              onClick={() => fileRef.current?.click()}
              className="w-24 h-24 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex flex-col items-center justify-center cursor-pointer hover:border-blue-400 hover:bg-blue-50 transition-colors group flex-shrink-0 overflow-hidden">
              {logoSrc ? (
                <img src={logoSrc} alt="logo preview" className="w-full h-full object-contain p-2" />
              ) : (
                <>
                  <PhotoIcon className="w-6 h-6 text-gray-300 group-hover:text-blue-400 transition-colors mb-1" />
                  <span className="text-xs text-gray-400 group-hover:text-blue-500">Click to upload</span>
                </>
              )}
            </div>

            <div className="pt-1">
              <button type="button" onClick={() => fileRef.current?.click()}
                className="inline-flex items-center gap-2 px-3.5 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white hover:bg-gray-50 text-gray-700 transition-colors shadow-sm">
                <ArrowUpTrayIcon className="w-4 h-4 text-gray-500" />
                {logoSrc ? 'Replace Logo' : 'Upload Logo'}
              </button>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                PNG or JPG, max 2 MB.<br />Displayed at ~48 px height.
              </p>
              {fieldErrors.brand_logo && <p className="text-xs text-red-500 mt-1">{fieldErrors.brand_logo}</p>}
              <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
            </div>
          </div>
        </section>

        {/* ── Brand identity ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Brand Identity</h3>

          <Field label="Company / Brand Name *" icon={BuildingStorefrontIcon}>
            <Input
              value={form.brand_name}
              onChange={e => setField('brand_name', e.target.value)}
              placeholder="e.g. Magic Management"
              className={fieldErrors.brand_name ? 'border-red-400' : undefined}
            />
            {fieldErrors.brand_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.brand_name}</p>}
          </Field>

          <Field
            label="Sales Tagline"
            icon={TagIcon}
            hint="Shown as the sub-message on the expired plan screen.">
            <Input
              value={form.sales_tagline}
              onChange={e => setField('sales_tagline', e.target.value)}
              placeholder="e.g. Get in touch with our sales team to reactivate your account."
            />
          </Field>
        </section>

        {/* ── Contact details ── */}
        <section className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-800">Sales Contact</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Phone Number" icon={PhoneIcon}>
              <Input
                value={form.contact_phone}
                onChange={e => setField('contact_phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                type="tel"
                inputMode="numeric"
                maxLength={10}
              />
              {fieldErrors.contact_phone && <p className="text-xs text-red-500 mt-1">{fieldErrors.contact_phone}</p>}
            </Field>

            <Field
              label="WhatsApp Number"
              icon={ChatBubbleLeftEllipsisIcon}
              hint="Include country code, no spaces.">
              <Input
                value={form.contact_whatsapp}
                onChange={e => setField('contact_whatsapp', e.target.value.replace(/\D/g, '').slice(0, 10))}
                placeholder="10-digit mobile number"
                type="tel"
                inputMode="numeric"
                maxLength={10}
              />
              {fieldErrors.contact_whatsapp && <p className="text-xs text-red-500 mt-1">{fieldErrors.contact_whatsapp}</p>}
            </Field>
          </div>

          <Field label="Email Address" icon={EnvelopeIcon}>
            <Input
              value={form.contact_email}
              onChange={e => setField('contact_email', e.target.value)}
              placeholder="sales@yourcompany.com"
              type="email"
            />
            {fieldErrors.contact_email && <p className="text-xs text-red-500 mt-1">{fieldErrors.contact_email}</p>}
          </Field>
        </section>

        {/* ── Live preview ── */}
        {(form.brand_name || form.contact_phone || form.contact_whatsapp || form.contact_email) && (
          <section className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl border border-gray-200 p-5">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Preview — Expired Screen</p>
            <div className="bg-white rounded-lg border border-gray-200 p-5 max-w-xs mx-auto shadow-sm">
              <div className="text-center mb-3">
                {logoSrc
                  ? <img src={logoSrc} alt="brand" className="h-8 object-contain mx-auto mb-2" />
                  : <div className="w-10 h-10 rounded-xl bg-red-50 flex items-center justify-center mx-auto mb-2 ring-1 ring-red-100">
                      <span className="text-red-400 text-sm font-bold">?</span>
                    </div>
                }
                <p className="text-sm font-semibold text-gray-900">Subscription Expired</p>
                {form.sales_tagline && (
                  <p className="text-xs text-gray-400 mt-1 leading-relaxed">{form.sales_tagline}</p>
                )}
              </div>
              <div className="bg-gray-50 rounded-lg p-3 space-y-2">
                <p className="text-xs text-gray-400 font-medium uppercase tracking-wide">Contact Sales · {form.brand_name || '…'}</p>
                {form.contact_phone && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <PhoneIcon className="w-3.5 h-3.5 text-orange-400 flex-shrink-0" />
                    {form.contact_phone}
                  </div>
                )}
                {form.contact_whatsapp && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <ChatBubbleLeftEllipsisIcon className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
                    WhatsApp · {form.contact_whatsapp}
                  </div>
                )}
                {form.contact_email && (
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <EnvelopeIcon className="w-3.5 h-3.5 text-blue-400 flex-shrink-0" />
                    {form.contact_email}
                  </div>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ── Actions ── */}
        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 text-white text-sm font-medium rounded-lg transition-colors shadow-sm">
            {mutation.isPending ? (
              <>
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
                </svg>
                Saving…
              </>
            ) : 'Save Branding'}
          </button>

          {saved && (
            <span className="inline-flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
              <CheckCircleIcon className="w-4 h-4" />
              Saved successfully
            </span>
          )}
          {mutation.isError && (
            <span className="text-sm text-red-500">Failed to save. Please try again.</span>
          )}
        </div>
      </form>
    </div>
  )
}
