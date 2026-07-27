import { useState } from 'react'
import Spinner from '@/components/shared/Spinner'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
  PlusIcon, TrashIcon, BanknotesIcon, FunnelIcon, ReceiptPercentIcon,
} from '@heroicons/react/24/outline'
import { getExpenses, createExpense, deleteExpense } from '@/services/restaurantService'
import { validate, validateField, required, isPositive } from '@/utils/validate'

const CATEGORIES = ['Groceries', 'Utilities', 'Staff', 'Maintenance', 'Marketing', 'Equipment', 'Other']

const CAT_COLORS = {
  Groceries:   'bg-green-100 text-green-700',
  Utilities:   'bg-blue-100 text-blue-700',
  Staff:       'bg-purple-100 text-purple-700',
  Maintenance: 'bg-yellow-100 text-yellow-700',
  Marketing:   'bg-pink-100 text-pink-700',
  Equipment:   'bg-orange-100 text-orange-700',
  Other:       'bg-gray-100 text-gray-600',
}

export default function Expenses() {
  const qc = useQueryClient()
  const [from, setFrom] = useState('')
  const [to, setTo]   = useState('')
  const [form, setForm] = useState({ category: '', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0] })
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const formRef = useScrollToFirstError(fieldErrors)

  const EXPENSE_RULES = {
    category:     [required('Category')],
    amount:       [required('Amount'), isPositive('Amount')],
    expense_date: [required('Date')],
  }

  const setField = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    const err = validateField(EXPENSE_RULES, k, v, next)
    setFieldErrors(e => ({ ...e, [k]: err }))
  }

  const blur = (field) => {
    const err = validateField(EXPENSE_RULES, field, form[field], form)
    if (err !== undefined) setFieldErrors(e => ({ ...e, [field]: err }))
  }

  const { data: expenses, isLoading } = useQuery({
    queryKey: ['expenses', { from, to }],
    queryFn: () => getExpenses({ from, to }).then(r => r.data.data),
  })

  const create = useMutation({
    mutationFn: createExpense,
    onSuccess: (res) => {
      const newExpense = res.data?.data
      if (newExpense) {
        qc.setQueryData(['expenses', { from, to }], (old) => old ? [newExpense, ...old] : old)
      }
      qc.invalidateQueries({ queryKey: ['expenses'] })
      setForm(f => ({ ...f, amount: '', description: '' }))
      setFieldErrors({})
    },
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const del = useMutation({
    mutationFn: deleteExpense,
    onSuccess: (_, id) => {
      qc.setQueryData(['expenses', { from, to }], (old) => old ? old.filter(e => e.id !== id) : old)
      qc.invalidateQueries({ queryKey: ['expenses'] })
    },
  })

  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const inp = (field) =>
    `border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 w-full ${fieldErrors[field] ? 'border-red-400' : 'border-gray-200'}`

  return (
    <div className="max-w-3xl">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Expenses</h2>
        <p className="text-sm text-gray-400 mt-0.5">Track operational costs and spending</p>
      </div>

      {/* Add form */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="w-8 h-8 rounded-xl bg-red-50 flex items-center justify-center">
            <PlusIcon className="w-4 h-4 text-red-500" />
          </div>
          <h3 className="font-semibold text-gray-900 text-sm">Add Expense</h3>
        </div>
        {error && <div className="text-red-600 text-sm mb-3 bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
        <form ref={formRef} onSubmit={(e) => {
          e.preventDefault()
          const errs = validate(EXPENSE_RULES, form)
          if (Object.keys(errs).length) { setFieldErrors(errs); return }
          setError(''); create.mutate(form)
        }} className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          <div>
            <select
              id="expense-category"
              name="category"
              aria-label="Category"
              value={form.category}
              onChange={e => setField('category', e.target.value)}
              onBlur={() => blur('category')}
              className={inp('category')}
            >
              <option value="">Category *</option>
              {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            {fieldErrors.category && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.category}</p>}
          </div>
          <input id="expense-description" name="description" aria-label="Description" value={form.description} onChange={e => setField('description', e.target.value)} placeholder="Description (optional)" className={inp('description')} />
          <div>
            <input
              id="expense-amount"
              name="amount"
              aria-label="Amount"
              type="number"
              step="0.01"
              min="0.01"
              value={form.amount}
              onChange={e => setField('amount', e.target.value)}
              onBlur={() => blur('amount')}
              placeholder="Amount ₹ *"
              className={inp('amount')}
            />
            {fieldErrors.amount && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.amount}</p>}
          </div>
          <div>
            <input
              id="expense-date"
              name="expense_date"
              aria-label="Expense date"
              type="date"
              value={form.expense_date}
              onChange={e => setField('expense_date', e.target.value)}
              onBlur={() => blur('expense_date')}
              className={inp('expense_date')}
            />
            {fieldErrors.expense_date && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.expense_date}</p>}
          </div>
          <button type="submit" disabled={create.isPending}
            className="col-span-full md:col-span-1 inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow">
            <PlusIcon className="w-4 h-4" />
            {create.isPending && <Spinner size="w-4 h-4" />}
            {create.isPending ? 'Adding…' : 'Add Expense'}
          </button>
        </form>
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-4 mb-5">
        <div className="flex items-center gap-2 mb-3">
          <FunnelIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm font-semibold text-gray-600">Date Range</span>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 sm:items-center sm:flex-wrap">
          <div className="flex items-center gap-2">
            <label htmlFor="expense-filter-from" className="text-xs text-gray-500 whitespace-nowrap">From</label>
            <input id="expense-filter-from" name="from" type="date" value={from} onChange={e => setFrom(e.target.value)}
              className="flex-1 sm:flex-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
          </div>
          <div className="flex items-center gap-2">
            <label htmlFor="expense-filter-to" className="text-xs text-gray-500 whitespace-nowrap">To</label>
            <input id="expense-filter-to" name="to" type="date" value={to} onChange={e => setTo(e.target.value)}
              className="flex-1 sm:flex-none border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
          </div>
          {(from || to) && (
            <button onClick={() => { setFrom(''); setTo('') }} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-5 py-4 bg-gray-50/60 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BanknotesIcon className="w-4 h-4 text-red-500" />
            <span className="text-sm font-bold text-gray-900">₹{total.toLocaleString()}</span>
            <span className="text-xs text-gray-400">total</span>
          </div>
          <span className="text-xs font-medium text-gray-400 bg-white border border-gray-200 px-2.5 py-1 rounded-full">{expenses?.length ?? 0} entries</span>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[460px]">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Date</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Description</th>
              <th className="text-right px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Amount</th>
              <th className="px-5 py-3.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {isLoading && [1,2,3,4].map(i => (
              <tr key={i}>
                <td className="px-5 py-4"><div className="w-20 h-4 bg-gray-100 rounded animate-pulse" /></td>
                <td className="px-5 py-4"><div className="w-24 h-5 bg-gray-100 rounded-full animate-pulse" /></td>
                <td className="px-5 py-4"><div className="w-32 h-4 bg-gray-100 rounded animate-pulse" /></td>
                <td className="px-5 py-4 text-right"><div className="w-16 h-4 bg-gray-100 rounded animate-pulse ml-auto" /></td>
                <td className="px-5 py-4"><div className="w-8 h-8 bg-gray-100 rounded-xl animate-pulse" /></td>
              </tr>
            ))}
            {!isLoading && expenses?.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-16">
                  <ReceiptPercentIcon className="w-10 h-10 text-gray-200 mx-auto mb-3" />
                  <p className="text-gray-400 font-medium">No expenses found</p>
                </td>
              </tr>
            ) : expenses?.map(exp => (
              <tr key={exp.id} className="hover:bg-gray-50/80 transition-colors">
                <td className="px-5 py-4 text-gray-500 text-xs">{new Date(exp.expense_date).toLocaleDateString()}</td>
                <td className="px-5 py-4">
                  <span className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${CAT_COLORS[exp.category] ?? 'bg-gray-100 text-gray-600'}`}>
                    {exp.category}
                  </span>
                </td>
                <td className="px-5 py-4 text-gray-600 text-sm">{exp.description || '—'}</td>
                <td className="px-5 py-4 text-right font-bold text-gray-900">₹{exp.amount.toLocaleString()}</td>
                <td className="px-5 py-4">
                  <button onClick={() => del.mutate(exp.id)}
                    className="w-7 h-7 rounded-lg bg-red-50 hover:bg-red-100 flex items-center justify-center ml-auto transition-colors">
                    <TrashIcon className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>
    </div>
  )
}
