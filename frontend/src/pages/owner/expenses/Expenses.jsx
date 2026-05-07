import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getExpenses, createExpense, deleteExpense } from '@/services/restaurantService'

const CATEGORIES = ['Groceries', 'Utilities', 'Staff', 'Maintenance', 'Marketing', 'Equipment', 'Other']

export default function Expenses() {
  const qc = useQueryClient()
  const [from, setFrom] = useState('')
  const [to, setTo]   = useState('')
  const [form, setForm] = useState({ category: '', description: '', amount: '', expense_date: new Date().toISOString().split('T')[0] })
  const [error, setError] = useState('')

  const { data: expenses } = useQuery({
    queryKey: ['expenses', { from, to }],
    queryFn: () => getExpenses({ from, to }).then(r => r.data.data),
  })

  const create = useMutation({
    mutationFn: createExpense,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['expenses'] }); setForm(f => ({ ...f, amount: '', description: '' })) },
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const del = useMutation({ mutationFn: deleteExpense, onSuccess: () => qc.invalidateQueries({ queryKey: ['expenses'] }) })

  const total = expenses?.reduce((s, e) => s + e.amount, 0) ?? 0
  const inp = 'border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Expenses</h2>

      {/* Add form */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
        <h3 className="font-medium text-gray-800 mb-3">Add Expense</h3>
        {error && <div className="text-red-600 text-sm mb-2">{error}</div>}
        <form onSubmit={(e) => { e.preventDefault(); setError(''); create.mutate(form) }} className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <select required value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className={inp}>
            <option value="">Category</option>
            {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} placeholder="Description" className={inp} />
          <input required type="number" step="0.01" min="0" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} placeholder="Amount ₹" className={inp} />
          <input required type="date" value={form.expense_date} onChange={e => setForm(f => ({ ...f, expense_date: e.target.value }))} className={inp} />
          <button type="submit" disabled={create.isPending} className="col-span-full md:col-span-1 bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
            {create.isPending ? 'Adding…' : '+ Add'}
          </button>
        </form>
      </div>

      {/* Filter */}
      <div className="flex gap-3 mb-4">
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className={inp} />
        <input type="date" value={to}   onChange={e => setTo(e.target.value)}   className={inp} />
        {(from || to) && <button onClick={() => { setFrom(''); setTo('') }} className="text-sm text-gray-400 hover:text-gray-600">Clear</button>}
      </div>

      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 bg-gray-50 border-b flex items-center justify-between">
          <span className="text-sm font-medium text-gray-700">Total: ₹{total.toLocaleString()}</span>
          <span className="text-xs text-gray-400">{expenses?.length ?? 0} entries</span>
        </div>
        <table className="w-full text-sm">
          <thead className="border-b border-gray-100">
            <tr>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Date</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Category</th>
              <th className="text-left px-4 py-3 text-gray-600 font-medium">Description</th>
              <th className="text-right px-4 py-3 text-gray-600 font-medium">Amount</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expenses?.length === 0
              ? <tr><td colSpan={5} className="text-center py-8 text-gray-400">No expenses</td></tr>
              : expenses?.map(exp => (
              <tr key={exp.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-gray-500">{new Date(exp.expense_date).toLocaleDateString()}</td>
                <td className="px-4 py-3"><span className="bg-orange-50 text-orange-700 text-xs px-2 py-0.5 rounded-full">{exp.category}</span></td>
                <td className="px-4 py-3 text-gray-600">{exp.description || '—'}</td>
                <td className="px-4 py-3 text-right font-medium">₹{exp.amount.toLocaleString()}</td>
                <td className="px-4 py-3"><button onClick={() => del.mutate(exp.id)} className="text-red-400 text-xs hover:underline">del</button></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
