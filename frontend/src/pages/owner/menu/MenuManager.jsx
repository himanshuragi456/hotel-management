import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCategories, createCategory, updateCategory, deleteCategory, getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, bulkToggleItems } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'

function CategoryPanel({ tenantId }) {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data: cats } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
  const create = useMutation({ mutationFn: createCategory, onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setName('') } })
  const del = useMutation({ mutationFn: deleteCategory, onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }) })

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 h-fit">
      <h3 className="font-medium text-gray-900 mb-3">Categories</h3>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate({ name }) }} className="flex gap-2 mb-3">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Category name" required
          className="flex-1 border border-gray-300 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400" />
        <button type="submit" className="bg-orange-500 text-white px-3 py-1.5 rounded-lg text-sm">+</button>
      </form>
      <div className="space-y-1">
        {cats?.map(cat => (
          <div key={cat.id} className="flex items-center justify-between px-2 py-1.5 hover:bg-gray-50 rounded-lg text-sm">
            <span className={cat.is_active ? 'text-gray-800' : 'text-gray-400 line-through'}>{cat.name}</span>
            <div className="flex gap-2">
              <button onClick={() => del.mutate(cat.id)} className="text-red-400 text-xs hover:underline">del</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ItemForm({ item, categories, onSuccess }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    menu_category_id: item?.menu_category_id ?? '',
    name:        item?.name        ?? '',
    description: item?.description ?? '',
    price:       item?.price       ?? '',
    type:        item?.type        ?? 'veg',
  })
  const [imageFile, setImageFile] = useState(null)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (fd) => isEdit ? updateMenuItem(item.id, fd) : createMenuItem(fd),
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const handleSubmit = (e) => {
    e.preventDefault(); setError('')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v))
    if (imageFile) fd.append('image', imageFile)
    mutation.mutate(fd)
  }

  const inp = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400'

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="text-red-600 text-sm bg-red-50 p-2 rounded">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Category *</label>
          <select required value={form.menu_category_id} onChange={e => setForm(f => ({ ...f, menu_category_id: e.target.value }))} className={inp}>
            <option value="">Select category</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Item Name *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Price (₹) *</label>
          <input required type="number" step="0.5" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inp} />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
            <option value="veg">🟢 Veg</option>
            <option value="non-veg">🔴 Non-Veg</option>
            <option value="vegan">🌱 Vegan</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} />
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-medium text-gray-600 mb-1">Image</label>
          <input type="file" accept="image/*" onChange={e => setImageFile(e.target.files[0])} className="text-sm text-gray-500" />
        </div>
      </div>
      <div className="flex justify-end pt-2">
        <button type="submit" disabled={mutation.isPending} className="bg-orange-500 text-white px-5 py-2 rounded-lg text-sm font-medium disabled:opacity-50">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

const typeIcon = { veg: '🟢', 'non-veg': '🔴', vegan: '🌱' }

export default function MenuManager() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState([])

  const { data: cats }  = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
  const { data: items } = useQuery({ queryKey: ['menu-items'], queryFn: () => getMenuItems().then(r => r.data.data) })

  const delItem = useMutation({ mutationFn: deleteMenuItem, onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }) })
  const bulkToggle = useMutation({
    mutationFn: ({ ids, val }) => bulkToggleItems(ids, val),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-items'] }); setSelected([]) },
  })

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Menu Management</h2>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-orange-600">
          + Add Item
        </button>
      </div>

      <div className="grid grid-cols-4 gap-6">
        <CategoryPanel />

        <div className="col-span-3">
          {selected.length > 0 && (
            <div className="flex gap-2 mb-3">
              <span className="text-sm text-gray-600">{selected.length} selected</span>
              <button onClick={() => bulkToggle.mutate({ ids: selected, val: true })}  className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">Enable</button>
              <button onClick={() => bulkToggle.mutate({ ids: selected, val: false })} className="text-xs bg-red-100 text-red-600 px-3 py-1 rounded-full">Disable</button>
            </div>
          )}

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b">
                <tr>
                  <th className="w-8 px-4 py-3"></th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Item</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Category</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Price</th>
                  <th className="text-left px-4 py-3 text-gray-600 font-medium">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items?.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)} />
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {item.image
                          ? <img src={`/storage/${item.image}`} className="w-8 h-8 rounded object-cover" />
                          : <div className="w-8 h-8 bg-gray-100 rounded flex items-center justify-center text-xs">{typeIcon[item.type]}</div>}
                        <span className="font-medium text-gray-900">{item.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-gray-500">{item.category?.name}</td>
                    <td className="px-4 py-3 font-medium">₹{item.price}</td>
                    <td className="px-4 py-3">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                        {item.is_available ? 'Available' : 'Unavailable'}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditing(item); setShowForm(true) }} className="text-blue-600 text-xs hover:underline">Edit</button>
                        <button onClick={() => confirm(`Delete "${item.name}"?`) && delItem.mutate(item.id)} className="text-red-500 text-xs hover:underline">Del</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Item' : 'Add Menu Item'}>
        <ItemForm item={editing} categories={cats} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['menu-items'] }) }} />
      </Modal>
    </div>
  )
}
