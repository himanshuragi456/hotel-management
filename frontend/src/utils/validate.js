// Returns an object of field → first error string. Empty object means valid.
export function validate(rules, values) {
  const errors = {}
  for (const [field, checks] of Object.entries(rules)) {
    for (const check of checks) {
      const msg = check(values[field], values)
      if (msg) { errors[field] = msg; break }
    }
  }
  return errors
}

// Validate a single field and return error string or undefined.
export function validateField(rules, field, value, allValues = {}) {
  const checks = rules[field]
  if (!checks) return undefined
  for (const check of checks) {
    const msg = check(value, allValues)
    if (msg) return msg
  }
  return undefined
}

// ── Rule factories ──────────────────────────────────────────────────────────

export const required = (label = 'This field') =>
  (v) => {
    if (v === undefined || v === null || v === '') return `${label} is required`
    if (typeof v === 'string' && !v.trim()) return `${label} is required`
    return undefined
  }

export const minLen = (n, label = 'This field') =>
  (v) => (v && v.length < n ? `${label} must be at least ${n} characters` : undefined)

export const maxLen = (n, label = 'This field') =>
  (v) => (v && v.length > n ? `${label} must be at most ${n} characters` : undefined)

export const isEmail = (label = 'Email') =>
  (v) => (v && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim()) ? `${label} is not a valid email` : undefined)

export const isPhone = (label = 'Phone') =>
  (v) => (v && !/^[+\d\s\-()]{7,16}$/.test(v.trim()) ? `${label} is not a valid number` : undefined)

export const isGstin = () =>
  (v) => (v && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/.test(v.trim().toUpperCase())
    ? 'GSTIN format is invalid (e.g. 29ABCDE1234F1Z5)' : undefined)

export const isPositive = (label = 'Value') =>
  (v) => (v !== '' && v !== undefined && v !== null && Number(v) <= 0
    ? `${label} must be greater than 0` : undefined)

export const isNonNeg = (label = 'Value') =>
  (v) => (v !== '' && v !== undefined && v !== null && Number(v) < 0
    ? `${label} cannot be negative` : undefined)

export const minValue = (min, label = 'Value') =>
  (v) => (v !== '' && v !== undefined && v !== null && Number(v) < min
    ? `${label} must be at least ${min}` : undefined)

export const maxValue = (max, label = 'Value') =>
  (v) => (v !== '' && v !== undefined && v !== null && Number(v) > max
    ? `${label} must be at most ${max}` : undefined)

export const isInteger = (label = 'Value') =>
  (v) => (v !== '' && v !== undefined && !Number.isInteger(Number(v))
    ? `${label} must be a whole number` : undefined)

// Date must be today or later
export const dateNotPast = (label = 'Date') =>
  (v) => {
    if (!v) return undefined
    const today = new Date().toISOString().split('T')[0]
    return v < today ? `${label} cannot be in the past` : undefined
  }

// Date must be strictly after another field's date
export const dateAfter = (otherField, otherLabel, selfLabel = 'Date') =>
  (v, all) => (v && all[otherField] && v <= all[otherField]
    ? `${selfLabel} must be after ${otherLabel}` : undefined)

// At least one key in an object must be true (for checkbox groups)
export const atLeastOne = (label = 'At least one option') =>
  (v) => {
    if (!v || typeof v !== 'object') return `${label} must be selected`
    const anyTrue = Object.values(v).some(Boolean)
    return anyTrue ? undefined : `${label} must be selected`
  }

// Require id_proof_number when id_proof_type is set
export const requiredIfOtherSet = (otherField, label = 'This field') =>
  (v, all) => (all[otherField] && !v ? `${label} is required when ID type is selected` : undefined)
