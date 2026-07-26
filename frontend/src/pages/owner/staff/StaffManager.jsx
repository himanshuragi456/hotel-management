import { useState } from 'react'
import Spinner from '@/components/shared/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon, XMarkIcon, UserGroupIcon,
} from '@heroicons/react/24/outline'
import { getStaff, createStaff, updateStaff, deleteStaff, toggleStaffActive } from '@/services/restaurantService'
import useAuthStore from '@/store/authStore'
import { validate, validateField, required, isEmail, isPhone, isStrongPassword } from '@/utils/validate'

const ALL_ROLES = ['waiter', 'chef', 'billing']
const ROLE_META = {
  waiter:  { label: 'Waiter',          color: 'bg-blue-100 text-blue-700',    module: 'restaurant' },
  chef:    { label: 'Chef',            color: 'bg-orange-100 text-orange-700', module: 'restaurant' },
  billing: { label: 'Billing Counter', color: 'bg-purple-100 text-purple-700', module: null },
}
const getRolesForModules = (modules) =>
  ALL_ROLES.filter(r => ROLE_META[r].module === null || modules?.[ROLE_META[r].module])

function buildRules(isEdit, hasNewPassword) {
  return {
    name:     [required('Name')],
    email:    [required('Email'), isEmail()],
    phone:    [isPhone()],
    ...(!isEdit || hasNewPassword ? { password: [required('Password'), isStrongPassword()] } : {}),
  }
}

function StaffForm({ initial, onClose, onSave, availableRoles }) {
  const defaultRole = availableRoles[0] ?? 'billing'
  const isEdit = !!initial
  const [form, setForm] = useState(initial ?? { name: '', email: '', phone: '', role: defaultRole, password: '' })
  const [errors, setErrors] = useState({})

  const set = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    const r = buildRules(isEdit, !!next.password)
    const err = validateField(r, k, v, next)
    setErrors(e => ({ ...e, [k]: err }))
  }

  const blur = (field) => {
    const r = buildRules(isEdit, !!form.password)
    const err = validateField(r, field, form[field], form)
    if (err !== undefined) setErrors(e => ({ ...e, [field]: err }))
  }

  const mutation = useMutation({
    mutationFn: isEdit
      ? (data) => updateStaff(initial.id, data)
      : (data) => createStaff(data),
    onSuccess: () => { onSave(); onClose() },
    onError: (err) => {
      const data = err.response?.data
      if (data?.errors) {
        // Normalize server errors (may be arrays)
        const normalized = {}
        for (const [k, v] of Object.entries(data.errors)) {
          normalized[k] = Array.isArray(v) ? v[0] : v
        }
        setErrors(normalized)
      } else {
        setErrors({ general: data?.message ?? 'Something went wrong' })
      }
    },
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const r = buildRules(isEdit, !!form.password)
    const errs = validate(r, form)
    if (Object.keys(errs).length) { setErrors(errs); return }
    setErrors({})
    const payload = { name: form.name.trim(), email: form.email.trim(), phone: form.phone || undefined, role: form.role }
    if (!isEdit || form.password) payload.password = form.password
    mutation.mutate(payload)
  }

  const inp = (field) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-colors ${errors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-300'}`

  const Err = (field) => errors[field]
    ? <p className="text-xs text-red-500 mt-0.5">{errors[field]}</p>
    : null

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl w-full max-w-md shadow-xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b shrink-0">
          <h2 className="font-semibold text-gray-900">{isEdit ? 'Edit Staff Member' : 'Add Staff Member'}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><XMarkIcon className="w-5 h-5" /></button>
        </div>
        <form onSubmit={handleSubmit} className="px-5 py-4 space-y-3 overflow-y-auto">
          {errors.general && (
            <div className="bg-red-50 text-red-600 text-sm px-3 py-2 rounded-lg">{errors.general}</div>
          )}

          <div>
            <label htmlFor="staff-name" className="block text-xs font-medium text-gray-600 mb-1">Name *</label>
            <input
              id="staff-name"
              name="name"
              value={form.name}
              onChange={e => set('name', e.target.value)}
              onBlur={() => blur('name')}
              placeholder="Full name"
              className={inp('name')}
            />
            {Err('name')}
          </div>

          <div>
            <label htmlFor="staff-email" className="block text-xs font-medium text-gray-600 mb-1">Email *</label>
            <input
              id="staff-email"
              name="email"
              type="email"
              value={form.email}
              onChange={e => set('email', e.target.value)}
              onBlur={() => blur('email')}
              placeholder="email@example.com"
              className={inp('email')}
            />
            {Err('email')}
          </div>

          <div>
            <label htmlFor="staff-phone" className="block text-xs font-medium text-gray-600 mb-1">Phone <span className="text-gray-400 font-normal">(optional)</span></label>
            <input
              id="staff-phone"
              name="phone"
              type="tel"
              inputMode="numeric"
              maxLength={10}
              value={form.phone}
              onChange={e => set('phone', e.target.value.replace(/\D/g, '').slice(0, 10))}
              onBlur={() => blur('phone')}
              placeholder="10-digit mobile number"
              className={inp('phone')}
            />
            {Err('phone')}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Role *</label>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${availableRoles.length}, minmax(0, 1fr))` }}>
              {availableRoles.map(r => (
                <button type="button" key={r} onClick={() => set('role', r)}
                  className={`py-2 rounded-lg text-xs font-medium capitalize ${form.role === r ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                  {ROLE_META[r].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="staff-password" className="block text-xs font-medium text-gray-600 mb-1">
              Password {isEdit && <span className="text-gray-400 font-normal">(leave blank to keep current)</span>}
              {!isEdit && <span className="text-red-500"> *</span>}
            </label>
            <input
              id="staff-password"
              name="password"
              autoComplete="new-password"
              type="password"
              value={form.password}
              onChange={e => set('password', e.target.value)}
              onBlur={() => blur('password')}
              placeholder={isEdit ? '••••••••' : 'Min 8 chars, A-Z, 0-9, @$!%*#?&'}
              className={inp('password')}
            />
            {Err('password')}
          </div>

          <button
            type="submit"
            disabled={mutation.isPending}
            className="inline-flex items-center justify-center gap-2 w-full bg-orange-500 text-white py-2.5 rounded-xl font-semibold text-sm disabled:opacity-50 mt-1"
          >
            {mutation.isPending && <Spinner size="w-4 h-4" />}
            {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Staff Member'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default function StaffManager() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  const availableRoles = getRolesForModules(user?.modules)
  const [formTarget, setFormTarget] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)

  const { data: staff, isLoading } = useQuery({
    queryKey: ['owner-staff'],
    queryFn: () => getStaff().then(r => r.data.data),
  })

  const deleteMutation = useMutation({
    mutationFn: deleteStaff,
    onSuccess: (_, id) => {
      qc.setQueryData(['owner-staff'], (old) => old ? old.filter(s => s.id !== id) : old)
      qc.invalidateQueries({ queryKey: ['owner-staff'] })
      setConfirmDelete(null)
    },
  })

  const toggleMutation = useMutation({
    mutationFn: toggleStaffActive,
    onSuccess: (res, id) => {
      qc.setQueryData(['owner-staff'], (old) => old
        ? old.map(s => s.id === id ? { ...s, is_active: res.data?.data?.is_active ?? !s.is_active } : s)
        : old
      )
      qc.invalidateQueries({ queryKey: ['owner-staff'] })
    },
  })

  const grouped = (staff ?? []).reduce((acc, s) => {
    if (!acc[s.role]) acc[s.role] = []
    acc[s.role].push(s)
    return acc
  }, {})

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Staff</h1>
          <p className="text-sm text-gray-400 mt-0.5">
            Manage your team — {availableRoles.map(r => ROLE_META[r].label).join(', ')}
          </p>
        </div>
        <button
          onClick={() => setFormTarget('new')}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow"
        >
          <PlusIcon className="w-4 h-4" />Add Staff
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-100 rounded-xl animate-pulse" />)}
        </div>
      ) : !staff?.length ? (
        <div className="text-center py-20 text-gray-400">
          <UserGroupIcon className="w-14 h-14 text-gray-200 mx-auto mb-4" />
          <p className="text-lg font-medium text-gray-500 mb-1">No staff yet</p>
          <p className="text-sm mb-6">Add your first team member to get started</p>
          <button onClick={() => setFormTarget('new')}
            className="bg-orange-500 text-white px-6 py-2.5 rounded-xl font-semibold text-sm">
            + Add Staff Member
          </button>
        </div>
      ) : (
        <div className="space-y-8">
          {availableRoles.filter(r => grouped[r]?.length).map(role => (
            <div key={role}>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                {ROLE_META[role].label}s · {grouped[role].length}
              </h3>
              <div className="space-y-2">
                {grouped[role].map(member => (
                  <div key={member.id}
                    className={`bg-white rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4 ${!member.is_active ? 'opacity-60' : ''}`}>
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center font-bold text-white text-sm shrink-0 shadow-sm">
                        {member.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-medium text-gray-900 text-sm truncate">{member.name}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium shrink-0 ${ROLE_META[member.role].color}`}>
                            {ROLE_META[member.role].label}
                          </span>
                          {!member.is_active && (
                            <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500 shrink-0">Inactive</span>
                          )}
                        </div>
                        <div className="text-xs text-gray-400 mt-0.5 truncate">
                          {member.email}{member.phone ? ` · ${member.phone}` : ''}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 flex-wrap sm:justify-end">
                      <button
                        onClick={() => toggleMutation.mutate(member.id)}
                        disabled={toggleMutation.isPending}
                        title={member.is_active ? 'Deactivate' : 'Activate'}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium ${member.is_active ? 'bg-gray-100 text-gray-600 hover:bg-gray-200' : 'bg-green-100 text-green-700 hover:bg-green-200'}`}>
                        {member.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                      <button onClick={() => setFormTarget(member)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-gray-100 text-gray-600 hover:bg-gray-200">
                        Edit
                      </button>
                      <button onClick={() => setConfirmDelete(member)}
                        className="px-3 py-1.5 rounded-lg text-xs font-medium bg-red-50 text-red-600 hover:bg-red-100">
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {formTarget && (
        <StaffForm
          initial={formTarget === 'new' ? null : formTarget}
          availableRoles={availableRoles}
          onClose={() => setFormTarget(null)}
          onSave={() => qc.invalidateQueries({ queryKey: ['owner-staff'] })}
        />
      )}

      {confirmDelete && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6">
            <h3 className="font-semibold text-gray-900 mb-1">Remove {confirmDelete.name}?</h3>
            <p className="text-sm text-gray-500 mb-5">
              This will permanently delete their account. They won't be able to log in anymore.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 border border-gray-300 text-gray-600 py-2 rounded-xl text-sm font-medium hover:bg-gray-50">
                Cancel
              </button>
              <button
                onClick={() => deleteMutation.mutate(confirmDelete.id)}
                disabled={deleteMutation.isPending}
                className="inline-flex items-center justify-center gap-2 flex-1 bg-red-500 text-white py-2 rounded-xl text-sm font-semibold disabled:opacity-50">
                {deleteMutation.isPending && <Spinner size="w-4 h-4" />}
                {deleteMutation.isPending ? 'Removing…' : 'Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
