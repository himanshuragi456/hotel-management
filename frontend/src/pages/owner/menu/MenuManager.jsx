import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  PlusIcon, MagnifyingGlassIcon, TrashIcon, PencilSquareIcon,
  TagIcon, PhotoIcon, BoltIcon, ClockIcon,
} from '@heroicons/react/24/outline'
import { getCategories, createCategory, updateCategory, deleteCategory, getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, bulkToggleItems } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { validate, validateField, required, isPositive } from '@/utils/validate'

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
  const [catError, setCatError] = useState('')
  const { data: cats, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
  const create = useMutation({ mutationFn: createCategory, onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setName(''); setCatError('') } })
  const del = useMutation({
    mutationFn: deleteCategory,
    onSuccess: (_, id) => {
      qc.setQueryData(['categories'], (old) => old ? old.filter(c => c.id !== id) : old)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-fit">
      <h3 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
          <TagIcon className="w-4 h-4 text-orange-500" />
        </div>
        Categories
      </h3>
      <form onSubmit={(e) => {
        e.preventDefault()
        if (!name.trim()) { setCatError('Category name is required'); return }
        setCatError('')
        create.mutate({ name: name.trim() })
      }} className="flex gap-2 mb-4">
        <div className="flex-1">
          <input
            value={name}
            onChange={e => { setName(e.target.value); setCatError('') }}
            onBlur={() => { if (!name.trim()) setCatError('Category name is required') }}
            placeholder="New category…"
            className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 ${catError ? 'border-red-400' : 'border-gray-200'}`}
          />
          {catError && <p className="text-xs text-red-500 mt-0.5">{catError}</p>}
        </div>
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
    menu_category_id:  item?.menu_category_id  ?? '',
    name:              item?.name              ?? '',
    description:       item?.description       ?? '',
    price:             item?.price             ?? '',
    type:              item?.type              ?? 'veg',
    is_ready_made:     item?.is_ready_made     ?? false,
    prep_time_minutes: item?.prep_time_minutes ?? '',
  })
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(item?.image_url ?? null)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  const ITEM_RULES = {
    menu_category_id: [required('Category')],
    name:             [required('Item name')],
    price:            [required('Price'), isPositive('Price')],
  }

  const setField = (k, v) => {
    const next = { ...form, [k]: v }
    setForm(next)
    const err = validateField(ITEM_RULES, k, v, next)
    setFieldErrors(e => ({ ...e, [k]: err }))
  }

  const blur = (field) => {
    const err = validateField(ITEM_RULES, field, form[field], form)
    if (err !== undefined) setFieldErrors(e => ({ ...e, [field]: err }))
  }

  const mutation = useMutation({
    mutationFn: (fd) => isEdit ? updateMenuItem(item.id, fd) : createMenuItem(fd),
    onSuccess: () => onSuccess?.(),
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate(ITEM_RULES, form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setError('')
    setFieldErrors({})
    const fd = new FormData()
    Object.entries(form).forEach(([k, v]) => fd.append(k, v === true ? 1 : v === false ? 0 : v))
    if (imageFile) fd.append('image', imageFile)
    mutation.mutate(fd)
  }

  const inp = (field) =>
    `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 transition-colors ${fieldErrors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="text-red-600 text-sm bg-red-50 px-3 py-2 rounded-xl">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Category *</label>
          <select
            value={form.menu_category_id}
            onChange={e => setField('menu_category_id', e.target.value)}
            onBlur={() => blur('menu_category_id')}
            className={inp('menu_category_id')}
          >
            <option value="">Select category</option>
            {categories?.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          {fieldErrors.menu_category_id && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.menu_category_id}</p>}
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Item Name *</label>
          <input
            value={form.name}
            onChange={e => setField('name', e.target.value)}
            onBlur={() => blur('name')}
            className={inp('name')}
            placeholder="e.g. Paneer Butter Masala"
          />
          {fieldErrors.name && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.name}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Price (₹) *</label>
          <input
            type="number"
            step="0.5"
            min="0.5"
            value={form.price}
            onChange={e => setField('price', e.target.value)}
            onBlur={() => blur('price')}
            className={inp('price')}
            placeholder="0.00"
          />
          {fieldErrors.price && <p className="text-xs text-red-500 mt-0.5">{fieldErrors.price}</p>}
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Type</label>
          <select value={form.type} onChange={e => setField('type', e.target.value)} className={inp('type')}>
            <option value="veg">Veg</option>
            <option value="non-veg">Non-Veg</option>
            <option value="vegan">Vegan</option>
          </select>
        </div>
        <div className="col-span-2">
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Description</label>
          <input value={form.description} onChange={e => setField('description', e.target.value)} className={inp('description')} placeholder="Short description (optional)" />
        </div>
        <div className="col-span-2">
          <label className="flex items-center gap-3 cursor-pointer select-none p-3 rounded-xl bg-gray-50 border border-gray-200 hover:bg-gray-100 transition-colors">
            <div className="relative">
              <input type="checkbox" className="sr-only" checked={form.is_ready_made}
                onChange={e => setField('is_ready_made', e.target.checked)} />
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
        {!form.is_ready_made && (
          <div className="col-span-2">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5 flex items-center gap-1.5">
              <ClockIcon className="w-3.5 h-3.5" />
              Estimated Prep Time (minutes)
            </label>
            <div className="relative">
              <input
                type="number"
                min="1"
                max="300"
                step="1"
                value={form.prep_time_minutes}
                onChange={e => setField('prep_time_minutes', e.target.value)}
                className={`${inp('prep_time_minutes')} pr-16`}
                placeholder="e.g. 15"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none">min</span>
            </div>
            <p className="text-xs text-gray-400 mt-1">Shown to customers before they place an order so they know when food will be ready.</p>
          </div>
        )}
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
  const [deleteItemTarget, setDeleteItemTarget] = useState(null)

  const { data: cats, isLoading: catsLoading }  = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
  const { data: items, isLoading: itemsLoading } = useQuery({ queryKey: ['menu-items'], queryFn: () => getMenuItems().then(r => r.data.data) })

  const delItem = useMutation({
    mutationFn: deleteMenuItem,
    onSuccess: (_, id) => {
      qc.setQueryData(['menu-items'], (old) => old ? old.filter(i => i.id !== id) : old)
      qc.invalidateQueries({ queryKey: ['menu-items'] })
      setDeleteItemTarget(null)
    },
  })
  const bulkToggle = useMutation({
    mutationFn: ({ ids, val }) => bulkToggleItems(ids, val),
    onSuccess: (_, { ids, val }) => {
      qc.setQueryData(['menu-items'], (old) => old
        ? old.map(i => ids.includes(i.id) ? { ...i, is_available: val } : i)
        : old
      )
      qc.invalidateQueries({ queryKey: ['menu-items'] })
      setSelected([])
    },
  })

  const toggleSelect = (id) => setSelected(s => s.includes(id) ? s.filter(x => x !== id) : [...s, id])

  const filteredItems = items?.filter(item => {
    const matchCat = activeCat === 'all' || String(item.menu_category_id) === String(activeCat)
    const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase())
    return matchCat && matchSearch
  })

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Menu Management</h2>
          <p className="text-sm text-gray-400 mt-0.5">{items?.length ?? 0} items across {cats?.length ?? 0} categories</p>
        </div>
        <button onClick={() => { setEditing(null); setShowForm(true) }}
          className="inline-flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-4 py-2 rounded-xl text-sm font-semibold hover:shadow-md transition-shadow self-start sm:self-auto">
          <PlusIcon className="w-4 h-4" />
          Add Item
        </button>
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
                        {item.image_url
                          ? <img src={item.image_url} className="w-9 h-9 rounded-lg object-cover shadow-sm" onError={e => { e.target.style.display='none'; e.target.nextSibling.style.display='flex' }} />
                          : null}
                        <div className="w-9 h-9 bg-gray-100 rounded-lg items-center justify-center" style={{display: item.image_url ? 'none' : 'flex'}}>
                          <VegDot type={item.type} />
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            {item.image_url && <VegDot type={item.type} />}
                            <p className="font-semibold text-gray-900">{item.name}</p>
                          </div>
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
                        {item.is_ready_made ? (
                          <span className="text-xs px-2.5 py-0.5 rounded-full w-fit bg-blue-100 text-blue-700 font-medium flex items-center gap-1">
                            <BoltIcon className="w-3 h-3" />Instant
                          </span>
                        ) : item.prep_time_minutes ? (
                          <span className="text-xs px-2.5 py-0.5 rounded-full w-fit bg-amber-100 text-amber-700 font-medium flex items-center gap-1">
                            <ClockIcon className="w-3 h-3" />{item.prep_time_minutes} min
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex gap-2 justify-end">
                        <button onClick={() => { setEditing(item); setShowForm(true) }}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 bg-blue-50 hover:bg-blue-100 px-2.5 py-1.5 rounded-lg font-medium transition-colors">
                          <PencilSquareIcon className="w-3.5 h-3.5" />Edit
                        </button>
                        <button onClick={() => setDeleteItemTarget(item)}
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

      <ConfirmDialog
        open={!!deleteItemTarget}
        title={`Delete "${deleteItemTarget?.name}"?`}
        message="This will permanently remove this menu item."
        confirmLabel={delItem.isPending ? 'Deleting…' : 'Delete'}
        confirmClass="bg-red-500 hover:bg-red-600 text-white"
        onConfirm={() => delItem.mutate(deleteItemTarget?.id)}
        onCancel={() => setDeleteItemTarget(null)}
      />
    </div>
  )
}
