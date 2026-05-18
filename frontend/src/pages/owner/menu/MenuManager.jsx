import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon, MagnifyingGlassIcon, TrashIcon, PencilSquareIcon,
  TagIcon, PhotoIcon, BoltIcon, CheckCircleIcon,
} from '@heroicons/react/24/outline'
import { getCategories, createCategory, updateCategory, deleteCategory, getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, bulkToggleItems, getOwnerSettings, updateOwnerSettings } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'

function VegDot({ type }) {
  const cfg = {
    veg:     { outer: 'border-green-600', inner: 'bg-green-500' },
    'non-veg': { outer: 'border-red-600',   inner: 'bg-red-500'   },
    vegan:   { outer: 'border-green-700', inner: 'bg-green-600' },
  }[type] ?? { outer: 'border-gray-400', inner: 'bg-gray-400' }
  return (
    <div className={`w-3.5 h-3.5 border-2 ${cfg.outer} flex items-center justify-center rounded-sm flex-shrink-0`}>
      <div className={`w-1.5 h-1.5 rounded-full ${cfg.inner}`} />
    </div>
  )
}

function CategoryPanel() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const { data: cats, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
  const create = useMutation({ mutationFn: createCategory, onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setName('') } })
  const del = useMutation({ mutationFn: deleteCategory, onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }) })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-fit">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
          <TagIcon className="w-4 h-4 text-orange-500" />
        </div>
        Categories
      </h3>
      <form onSubmit={(e) => { e.preventDefault(); create.mutate({ name }) }} className="flex gap-2 mb-4">
        <input value={name} onChange={e => setName(e.target.value)} placeholder="New category…" required
          className="flex-1 border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50" />
        <button type="submit" disabled={create.isPending} className="w-9 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50">
          {create.isPending ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <PlusIcon className="w-4 h-4" />}
        </button>
      </form>
      <div className="space-y-1">
        {isLoading && [1,2,3].map(i => (
          <div key={i} className="h-8 bg-gray-100 rounded-xl animate-pulse" />
        ))}
        {!isLoading && cats?.map(cat => (
          <div key={cat.id} className="flex items-center justify-between px-3 py-2 hover:bg-gray-50 rounded-xl group text-sm">
            <span className={cat.is_active ? 'text-gray-800 font-medium' : 'text-gray-400 line-through'}>{cat.name}</span>
            <button onClick={() => del.mutate(cat.id)} disabled={del.isPending} className="opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30">
              <TrashIcon className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
            </button>
          </div>
        ))}
        {!isLoading && !cats?.length && (
          <p className="text-xs text-gray-400 text-center py-4">No categories yet</p>
        )}
      </div>
    </div>
  )
}

function ItemForm({ item, categories, onSuccess }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    menu_category_id: item?.menu_category_id ?? '',
    name:             item?.name        ?? '',
    description:      item?.description ?? '',
    price:            item?.price       ?? '',
    type:             item?.type        ?? 'veg',
    is_ready_made:    item?.is_ready_made ?? false,
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(item?.image ? `/storage/${item.image}` : null)
  const [error, setError] = useState('')

  const mutation = useMutation({
    mutationFn: (fd) => isEdit ? updateMenuItem(item.id, fd) : createMenuItem(fd),
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const handleSubmit = (e) => {
    e.preventDefault(); setError('')
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v === true ? 1 : v === false ? 0 : v))
    if (imageFile) fd.append('image', imageFile)
    mutation.mutate(fd)
  }

  const inp = 'w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50'

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category *</label>
          <select required value={form.menu_category_id} onChange={e => setForm(f => ({ ...f, menu_category_id: e.target.value }))} className={inp}>
            <option value="">Select category</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Item Name *</label>
          <input required value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className={inp} placeholder="e.g. Paneer Butter Masala" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Price (₹) *</label>
          <input required type="number" step="0.5" value={form.price} onChange={e => setForm(f => ({ ...f, price: e.target.value }))} className={inp} placeholder="0.00" />
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
          <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))} className={inp}>
            <option value="veg">Veg</option>
            <option value="non-veg">Non-Veg</option>
            <option value="vegan">Vegan</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
          <input value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inp} placeholder="Short description (optional)" />
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.is_ready_made}
                onChange={e => setForm(f => ({ ...f, is_ready_made: e.target.checked }))} />
              <div className={`w-10 h-5 rounded-full transition-colors ${form.is_ready_made ? 'bg-orange-500' : 'bg-gray-300'}`} />
              <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${form.is_ready_made ? 'translate-x-5' : ''}`} />
            </div>
            <div>
              <span className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                <BoltIcon className="w-3.5 h-3.5 text-orange-500" />
                Ready-Made / Instant
              </span>
              <p className="text-xs text-gray-400 mt-0.5">Skips kitchen — served immediately</p>
            </div>
          </label>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Image</label>
          <label className="flex items-center gap-3 cursor-pointer border border-dashed border-gray-300 rounded-xl px-4 py-3 hover:border-orange-400 hover:bg-orange-50 transition-colors">
            {imagePreview
              ? <img src={imagePreview} className="w-14 h-14 rounded-lg object-cover shrink-0 shadow-sm" />
              : <PhotoIcon className="w-5 h-5 text-gray-400 shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-sm text-gray-700 font-medium truncate">{imageFile ? imageFile.name : imagePreview ? 'Current image (click to change)' : 'Click to upload image'}</p>
              <p className="text-xs text-gray-400 mt-0.5">JPG, PNG up to 2MB</p>
            </div>
            <input type="file" accept="image/*" onChange={e => {
              const file = e.target.files[0]
              if (!file) return
              setImageFile(file)
              setImagePreview(URL.createObjectURL(file))
            }} className="hidden" />
          </label>
        </div>
      </div>
      <div className="flex justify-end pt-1">
        <button type="submit" disabled={mutation.isPending}
          className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow">
          {mutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Add Item'}
        </button>
      </div>
    </form>
  )
}

export default function MenuManager() {
  const qc = useQueryClient()
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [selected, setSelected] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')

  const { data: settings } = useQuery({ queryKey: ['owner-settings'], queryFn: () => getOwnerSettings().then(r => r.data.data) })
  const updateSettings = useMutation({
    mutationFn: (data) => updateOwnerSettings(data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['owner-settings'] }),
  })

  const { data: cats, isLoading: catsLoading }  = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
  const { data: items, isLoading: itemsLoading } = useQuery({ queryKey: ['menu-items'], queryFn: () => getMenuItems().then(r => r.data.data) })

  const delItem = useMutation({ mutationFn: deleteMenuItem, onSuccess: () => qc.invalidateQueries({ queryKey: ['menu-items'] }) })
  const bulkToggle = useMutation({
    mutationFn: ({ ids, val }) => bulkToggleItems(ids, val),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['menu-items'] }); setSelected([]) },
  })

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const filteredItems = items?.filter(item => {
    const matchCat = activeCat === 'all' || String(item.menu_category_id) === String(activeCat)
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Menu Management</h2>
          <p className="text-sm text-gray-400 mt-0.5">{items?.length ?? 0} items across {cats?.length ?? 0} categories</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow">
          <PlusIcon className="w-4 h-4" />
          Add Item
        </button>
      </div>

      {/* Settings toggles */}
      <div className="space-y-3 mb-6">
        {/* QR ordering toggle */}
        <div className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${settings?.qr_ordering_enabled === false ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${settings?.qr_ordering_enabled === false ? 'bg-amber-100' : 'bg-green-100'}`}>
              {settings?.qr_ordering_enabled === false
                ? <span className="text-amber-600 text-lg">⊘</span>
                : <CheckCircleIcon className="w-5 h-5 text-green-600" />}
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">QR Menu Ordering</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {settings?.qr_ordering_enabled === false
                  ? 'Customers can browse only — orders disabled.'
                  : 'Customers can browse and place orders.'}
              </p>
            </div>
          </div>
          <button
            disabled={updateSettings.isPending || settings === undefined}
            onClick={() => updateSettings.mutate({ qr_ordering_enabled: !settings?.qr_ordering_enabled })}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-50"
            style={{ backgroundColor: settings?.qr_ordering_enabled ? '#22c55e' : '#d1d5db' }}>
            <span
              className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: settings?.qr_ordering_enabled ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>

        {/* Customer bill request toggle */}
        <div className={`flex items-center justify-between rounded-2xl border px-5 py-4 ${settings?.customer_bill_request_enabled === false ? 'bg-gray-50 border-gray-200' : 'bg-purple-50 border-purple-200'}`}>
          <div className="flex items-center gap-3">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center ${settings?.customer_bill_request_enabled === false ? 'bg-gray-100' : 'bg-purple-100'}`}>
              <span className="text-lg">🧾</span>
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Customer Bill Request</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {settings?.customer_bill_request_enabled === false
                  ? 'Customers cannot request the bill from their phone.'
                  : 'Customers can tap "Request Bill" from the menu — billing/waiter are notified.'}
              </p>
            </div>
          </div>
          <button
            disabled={updateSettings.isPending || settings === undefined}
            onClick={() => updateSettings.mutate({ customer_bill_request_enabled: !settings?.customer_bill_request_enabled })}
            className="relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full transition-colors focus:outline-none disabled:opacity-50"
            style={{ backgroundColor: settings?.customer_bill_request_enabled !== false ? '#a855f7' : '#d1d5db' }}>
            <span
              className="inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform"
              style={{ transform: settings?.customer_bill_request_enabled !== false ? 'translateX(22px)' : 'translateX(2px)' }}
            />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <CategoryPanel />

        <div className="lg:col-span-3">
          {/* Category filter tabs + search */}
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <button
              onClick={() => { setActiveCat('all'); setSelected([]) }}
              className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${activeCat === 'all' ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
              All
              <span className="ml-1.5 text-xs opacity-75">({items?.length ?? 0})</span>
            </button>
            {cats?.map(cat => {
              const count = items?.filter(i => String(i.menu_category_id) === String(cat.id)).length ?? 0
              return (
                <button key={cat.id} onClick={() => { setActiveCat(String(cat.id)); setSelected([]) }}
                  className={`px-3 py-1.5 rounded-xl text-sm font-medium transition-colors ${String(activeCat) === String(cat.id) ? 'bg-orange-500 text-white shadow-sm' : 'bg-white text-gray-600 border border-gray-200 hover:bg-gray-50'}`}>
                  {cat.name}
                  <span className="ml-1.5 text-xs opacity-75">({count})</span>
                </button>
              )
            })}
            <div className="ml-auto relative">
              <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search items…"
                className="border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-44 bg-white"
              />
            </div>
          </div>

          {selected.length > 0 && (
            <div className="flex items-center gap-3 mb-4 bg-orange-50 border border-orange-200 rounded-xl px-4 py-2.5">
              <span className="text-sm font-medium text-orange-800">{selected.length} selected</span>
              <button onClick={() => bulkToggle.mutate({ ids: selected, val: true })}
                className="text-xs bg-green-500 text-white px-3 py-1 rounded-lg font-medium">Enable</button>
              <button onClick={() => bulkToggle.mutate({ ids: selected, val: false })}
                className="text-xs bg-red-500 text-white px-3 py-1 rounded-lg font-medium">Disable</button>
              <button onClick={() => setSelected([])} className="text-xs text-orange-600 ml-auto hover:underline">Clear</button>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[520px]">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/60">
                  <th className="w-10 px-4 py-3.5"></th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Item</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Price</th>
                  <th className="text-left px-4 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-4 py-3.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {itemsLoading && [1,2,3,4,5].map(i => (
                  <tr key={i}>
                    <td className="px-4 py-3.5"><div className="w-4 h-4 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-4 py-3.5"><div className="flex items-center gap-3"><div className="w-9 h-9 bg-gray-100 rounded-lg animate-pulse shrink-0" /><div className="w-32 h-4 bg-gray-100 rounded animate-pulse" /></div></td>
                    <td className="px-4 py-3.5"><div className="w-20 h-4 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-4 py-3.5"><div className="w-14 h-4 bg-gray-100 rounded animate-pulse" /></td>
                    <td className="px-4 py-3.5"><div className="w-16 h-5 bg-gray-100 rounded-full animate-pulse" /></td>
                    <td className="px-4 py-3.5"><div className="w-16 h-7 bg-gray-100 rounded-lg animate-pulse" /></td>
                  </tr>
                ))}
                {!itemsLoading && filteredItems?.length === 0 && (
                  <tr><td colSpan={6} className="text-center py-14 text-gray-400">
                    <PhotoIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    No items found
                  </td></tr>
                )}
                {filteredItems?.map(item => (
                  <tr key={item.id} className="hover:bg-gray-50/80 transition-colors">
                    <td className="px-4 py-3.5">
                      <input type="checkbox" checked={selected.includes(item.id)} onChange={() => toggleSelect(item.id)}
                        className="rounded border-gray-300 text-orange-500 focus:ring-orange-400" />
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-3">
                        {item.image
                          ? <img src={item.image.startsWith('http') ? item.image : `/storage/${item.image}`} className="w-9 h-9 rounded-lg object-cover shadow-sm" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                          : null}
                        <div className="w-9 h-9 bg-gray-100 rounded-lg items-center justify-center" style={{display: item.image ? 'none' : 'flex'}}>
                          <VegDot type={item.type} />
                        </div>
                        <div>
                          <p className="font-semibold text-gray-900">{item.name}</p>
                          {item.description && <p className="text-xs text-gray-400 truncate max-w-[160px]">{item.description}</p>}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-gray-500 text-xs">{item.category?.name}</td>
                    <td className="px-4 py-3.5 font-semibold text-gray-900">₹{item.price}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-col gap-1.5">
                        <span className={`text-xs px-2.5 py-0.5 rounded-full w-fit font-medium ${item.is_available ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'}`}>
                          {item.is_available ? 'Available' : 'Unavailable'}
                        </span>
                        {item.is_ready_made && (
                          <span className="text-xs px-2.5 py-0.5 rounded-full w-fit bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                            <BoltIcon className="w-3 h-3" />Instant
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditing(item); setShowForm(true) }}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                          <PencilSquareIcon className="w-3.5 h-3.5" />Edit
                        </button>
                        <button onClick={() => confirm(`Delete "${item.name}"?`) && delItem.mutate(item.id)}
                          className="inline-flex items-center gap-1 text-xs text-red-500 bg-red-50 hover:bg-red-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                          <TrashIcon className="w-3.5 h-3.5" />Del
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      </div>

      <Modal open={showForm} onClose={() => { setShowForm(false); setEditing(null) }} title={editing ? 'Edit Item' : 'Add Menu Item'}>
        <ItemForm item={editing} categories={cats} onSuccess={() => { setShowForm(false); setEditing(null); qc.invalidateQueries({ queryKey: ['menu-items'] }) }} />
      </Modal>
    </div>
  )
}
