import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useScrollToFirstError } from '@/hooks/useScrollToFirstError'
import {
  PlusIcon, MagnifyingGlassIcon, TrashIcon, PencilSquareIcon,
  TagIcon, PhotoIcon, BoltIcon, ClockIcon, Bars3Icon,
} from '@heroicons/react/24/outline'
import { getCategories, createCategory, updateCategory, deleteCategory, reorderCategories, getMenuItems, createMenuItem, updateMenuItem, deleteMenuItem, bulkToggleItems, setCategorySchedules } from '@/services/restaurantService'
import Modal from '@/components/shared/Modal'
import Spinner from '@/components/shared/Spinner'
import ConfirmDialog from '@/components/shared/ConfirmDialog'
import { validate, validateField, required, isPositive } from '@/utils/validate'
import VariantsAddonsManager from './VariantsAddonsManager'

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

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function ScheduleEditor({ category, onClose }) {
  const qc = useQueryClient()
  const [rows, setRows] = useState(
    category.schedules?.length
      ? category.schedules.map(s => ({ day_of_week: s.day_of_week, start_time: s.start_time?.slice(0, 5) ?? '09:00', end_time: s.end_time?.slice(0, 5) ?? '22:00' }))
      : []
  )
  const save = useMutation({
    mutationFn: () => setCategorySchedules(category.id, rows),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); onClose() },
  })

  const addRow = () => setRows(r => [...r, { day_of_week: 1, start_time: '09:00', end_time: '22:00' }])
  const upd = (i, k, v) => setRows(r => r.map((row, idx) => idx === i ? { ...row, [k]: v } : row))
  const remove = (i) => setRows(r => r.filter((_, idx) => idx !== i))

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-500">
        Set the days and times <b>{category.name}</b> is available for ordering. No rows = always available.
      </p>
      <div className="space-y-2">
        {rows.map((row, i) => (
          <div key={i} className="flex items-center gap-2">
            <select value={row.day_of_week} onChange={e => upd(i, 'day_of_week', Number(e.target.value))}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50">
              {DAYS.map((d, idx) => <option key={idx} value={idx}>{d}</option>)}
            </select>
            <input type="time" value={row.start_time} onChange={e => upd(i, 'start_time', e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
            <span className="text-gray-400 text-sm">to</span>
            <input type="time" value={row.end_time} onChange={e => upd(i, 'end_time', e.target.value)}
              className="border border-gray-200 rounded-lg px-2 py-1.5 text-sm bg-gray-50" />
            <button onClick={() => remove(i)} className="text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
          </div>
        ))}
        {!rows.length && <p className="text-xs text-gray-400">Always available (no schedule).</p>}
      </div>
      <button onClick={addRow} className="text-sm text-orange-600 font-medium hover:text-orange-700 flex items-center gap-1">
        <PlusIcon className="w-4 h-4" /> Add time slot
      </button>
      <div className="flex justify-end gap-2 pt-2">
        <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-xl">Cancel</button>
        <button onClick={() => save.mutate()} disabled={save.isPending}
          className="inline-flex items-center justify-center gap-2 px-5 py-2 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl disabled:opacity-50">
          {save.isPending && <Spinner size="w-4 h-4" />}
          {save.isPending ? 'Saving…' : 'Save Schedule'}
        </button>
      </div>
    </div>
  )
}

function CategoryPanel() {
  const qc = useQueryClient()
  const [name, setName] = useState('')
  const [parentId, setParentId] = useState('')
  const [catError, setCatError] = useState('')
  const [scheduleFor, setScheduleFor] = useState(null)
  const [dragId, setDragId] = useState(null)
  const [dragOverId, setDragOverId] = useState(null)

  const { data: cats, isLoading } = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
  const create = useMutation({
    mutationFn: createCategory,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['categories'] }); setName(''); setParentId(''); setCatError('') },
    onError: (err) => setCatError(err.response?.data?.message ?? 'Error'),
  })
  const update = useMutation({ mutationFn: ({ id, data }) => updateCategory(id, data), onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }) })
  const del = useMutation({
    mutationFn: deleteCategory,
    onSuccess: (_, id) => {
      qc.setQueryData(['categories'], (old) => old ? old.filter(c => c.id !== id) : old)
      qc.invalidateQueries({ queryKey: ['categories'] })
    },
  })
  const reorder = useMutation({
    mutationFn: reorderCategories,
    onMutate: (ids) => {
      // Optimistically reorder in the cache
      qc.setQueryData(['categories'], (old) => {
        if (!old) return old
        const orderMap = Object.fromEntries(ids.map((id, i) => [id, i]))
        return [...old].sort((a, b) => {
          const aO = orderMap[a.id] ?? a.sort_order ?? 0
          const bO = orderMap[b.id] ?? b.sort_order ?? 0
          return aO - bO
        })
      })
    },
    onError: () => qc.invalidateQueries({ queryKey: ['categories'] }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['categories'] }),
  })

  const handleDrop = (targetCat) => {
    setDragOverId(null)
    if (!dragId || dragId === targetCat.id) { setDragId(null); return }
    const dragged = cats?.find(c => c.id === dragId)
    if (!dragged || dragged.parent_id !== targetCat.parent_id) { setDragId(null); return }

    // Get all cats at this level in current order
    const levelCats = (cats ?? []).filter(c => c.parent_id === dragged.parent_id)
    const fromIdx = levelCats.findIndex(c => c.id === dragId)
    const toIdx   = levelCats.findIndex(c => c.id === targetCat.id)
    if (fromIdx === -1 || toIdx === -1) { setDragId(null); return }

    const reordered = [...levelCats]
    const [moved] = reordered.splice(fromIdx, 1)
    reordered.splice(toIdx, 0, moved)

    reorder.mutate(reordered.map(c => c.id))
    setDragId(null)
  }

  // Top-level categories (no parent) are valid parents for new sub-categories.
  const parents = cats?.filter(c => !c.parent_id) ?? []

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
        create.mutate({ name: name.trim(), parent_id: parentId || null })
      }} className="space-y-2 mb-4">
        <div className="flex gap-2">
          <div className="flex-1">
            <input
              value={name}
              onChange={e => { setName(e.target.value); setCatError('') }}
              placeholder="New category…"
              className={`w-full border rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 ${catError ? 'border-red-400' : 'border-gray-200'}`}
            />
          </div>
          <button type="submit" disabled={create.isPending} className="w-9 h-9 bg-orange-500 hover:bg-orange-600 text-white rounded-xl flex items-center justify-center transition-colors disabled:opacity-50">
            {create.isPending ? <span className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <PlusIcon className="w-4 h-4" />}
          </button>
        </div>
        <select value={parentId} onChange={e => setParentId(e.target.value)}
          className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm bg-gray-50 focus:outline-none focus:ring-2 focus:ring-orange-400">
          <option value="">Top-level category</option>
          {parents.map(p => <option key={p.id} value={p.id}>↳ under "{p.name}"</option>)}
        </select>
        {catError && <p className="text-xs text-red-500">{catError}</p>}
      </form>
      <p className="text-[11px] text-gray-400 mb-2 flex items-center gap-1">
        <Bars3Icon className="w-3 h-3" /> Drag to reorder
      </p>
      <div className="space-y-1">
        {isLoading && [1,2,3].map(i => (
          <div key={i} className="h-8 bg-gray-100 rounded-xl animate-pulse" />
        ))}
        {!isLoading && (() => {
          // Render top-level cats, with subcats nested beneath each
          const topLevel = cats?.filter(c => !c.parent_id) ?? []
          const rows = []
          for (const cat of topLevel) {
            rows.push({ cat, isChild: false })
            const subs = cats?.filter(c => c.parent_id === cat.id) ?? []
            for (const sub of subs) rows.push({ cat: sub, isChild: true })
          }
          return rows.map(({ cat, isChild }) => {
            const isDragging = dragId === cat.id
            const isOver    = dragOverId === cat.id && dragId !== cat.id
            const draggedCat = cats?.find(c => c.id === dragId)
            const canDrop   = isOver && draggedCat?.parent_id === cat.parent_id
            return (
              <div
                key={cat.id}
                draggable
                onDragStart={() => setDragId(cat.id)}
                onDragEnd={() => { setDragId(null); setDragOverId(null) }}
                onDragOver={(e) => { e.preventDefault(); setDragOverId(cat.id) }}
                onDragLeave={() => setDragOverId(null)}
                onDrop={() => handleDrop(cat)}
                className={`flex items-center gap-2 px-2 py-2 rounded-xl group text-sm transition-colors select-none
                  ${isChild ? 'ml-4 border-l-2 border-gray-100 pl-3' : ''}
                  ${isDragging ? 'opacity-40' : ''}
                  ${canDrop ? 'bg-orange-50 ring-1 ring-orange-300' : 'hover:bg-gray-50'}
                `}
              >
                <Bars3Icon className="w-3.5 h-3.5 text-gray-300 cursor-grab shrink-0" />
                <span className={`flex-1 truncate ${cat.is_oos ? 'text-red-400' : cat.is_active ? 'text-gray-800 font-medium' : 'text-gray-400 line-through'}`}>
                  {isChild && <span className="text-gray-300 mr-1">↳</span>}
                  {cat.name}
                  {cat.schedules?.length > 0 && <ClockIcon className="w-3 h-3 inline ml-1 text-amber-500" title="Has schedule" />}
                </span>
                {/* OOS toggle */}
                <button title={cat.is_oos ? 'Mark in stock' : 'Mark out of stock'}
                  onClick={() => update.mutate({ id: cat.id, data: { is_oos: !cat.is_oos } })}
                  className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${cat.is_oos ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-400 opacity-0 group-hover:opacity-100'}`}>
                  OOS
                </button>
                <button title="Set schedule" onClick={() => setScheduleFor(cat)}
                  className="opacity-0 group-hover:opacity-100 transition-opacity">
                  <ClockIcon className="w-3.5 h-3.5 text-gray-400 hover:text-orange-500" />
                </button>
                <button onClick={() => del.mutate(cat.id)} disabled={del.isPending} className="opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-30">
                  <TrashIcon className="w-3.5 h-3.5 text-red-400 hover:text-red-600" />
                </button>
              </div>
            )
          })
        })()}
        {!isLoading && !cats?.length && (
          <p className="text-xs text-gray-400 text-center py-4">No categories yet</p>
        )}
      </div>

      <Modal open={!!scheduleFor} onClose={() => setScheduleFor(null)} title={`Schedule — ${scheduleFor?.name ?? ''}`}>
        {scheduleFor && <ScheduleEditor category={scheduleFor} onClose={() => setScheduleFor(null)} />}
      </Modal>
    </div>
  )
}

function ItemForm({ item, categories, onSuccess, onCreated }) {
  const isEdit = !!item
  const [form, setForm] = useState({
    menu_category_id:  item?.menu_category_id  ?? '',
    name:              item?.name              ?? '',
    description:       item?.description       ?? '',
    price:             item?.price             ?? '',
    type:              item?.type              ?? 'veg',
    is_ready_made:     item?.is_ready_made     ?? false,
    prep_time_minutes: item?.prep_time_minutes ?? '',
    // Zomato fields
    gst_slab:          item?.gst_slab          ?? '',
    gst_cgst_sgst:     item?.gst_cgst_sgst     ?? false,
    packaging_charge:  item?.packaging_charge  ?? '',
    is_beverage:       item?.is_beverage       ?? false,
    meat_type:         item?.meat_type         ?? '',
    serving_info:      item?.serving_info      ?? '',
    nutri_calories:    item?.nutritional_info?.calories ?? '',
    nutri_protein:     item?.nutritional_info?.protein  ?? '',
  })
  const [showAdvanced, setShowAdvanced] = useState(false)
  const [imageFile, setImageFile] = useState(null)
  const [imagePreview, setImagePreview] = useState(item?.image_url ?? null)
  const [videoFile, setVideoFile] = useState(null)
  const [videoPreview, setVideoPreview] = useState(item?.video_url ?? null)
  const [removeVideo, setRemoveVideo] = useState(false)
  const [videoError, setVideoError] = useState('')
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})
  const formRef = useScrollToFirstError(fieldErrors)

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
    onSuccess: (res) => {
      if (!isEdit) {
        // After creating, switch to edit mode so variants/addons manager is available
        onCreated?.(res.data.data)
      } else {
        onSuccess?.()
      }
    },
    onError: (err) => setError(err.response?.data?.message ?? 'Error'),
  })

  const handleSubmit = (e) => {
    e.preventDefault()
    const errs = validate(ITEM_RULES, form)
    if (Object.keys(errs).length) { setFieldErrors(errs); return }
    setError('')
    setFieldErrors({})
    const fd = new FormData()
    const { nutri_calories, nutri_protein, gst_cgst_sgst, ...flat } = form
    const skipIfEmpty = new Set(['gst_slab', 'packaging_charge', 'meat_type', 'serving_info', 'prep_time_minutes'])
    Object.entries(flat).forEach(([k, v]) => {
      if (skipIfEmpty.has(k) && v === '') return
      fd.append(k, v === true ? 1 : v === false ? 0 : v)
    })
    // Only send gst_cgst_sgst when advanced section was opened (avoid overriding server default unnecessarily)
    if (showAdvanced) fd.append('gst_cgst_sgst', gst_cgst_sgst ? 1 : 0)
    if (nutri_calories !== '') fd.append('nutritional_info[calories]', nutri_calories)
    if (nutri_protein !== '')  fd.append('nutritional_info[protein]', nutri_protein)
    if (imageFile) fd.append('image', imageFile)
    if (videoFile) fd.append('video', videoFile)
    if (removeVideo && !videoFile) fd.append('remove_video', 1)
    mutation.mutate(fd)
  }

  const inp = (field) =>
    `w-full border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50 transition-colors ${fieldErrors[field] ? 'border-red-400 bg-red-50/30' : 'border-gray-200'}`

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
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
            {(() => {
              const tops = (categories ?? []).filter(c => !c.parent_id)
              const rows = []
              for (const top of tops) {
                rows.push(<option key={top.id} value={top.id}>{top.name}</option>)
                const subs = (categories ?? []).filter(c => c.parent_id === top.id)
                for (const sub of subs) {
                  rows.push(<option key={sub.id} value={sub.id}>&nbsp;&nbsp;&nbsp;↳ {sub.name}</option>)
                }
              }
              return rows
            })()}
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
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Photo</label>
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-xl px-3 py-2.5 hover:border-orange-400 hover:bg-orange-50 transition-colors">
            {imagePreview
              ? <img src={imagePreview} className="w-10 h-10 rounded-lg object-cover shrink-0 shadow-sm" />
              : <PhotoIcon className="w-4 h-4 text-gray-400 shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-xs text-gray-700 font-medium truncate">{imageFile ? imageFile.name : imagePreview ? 'Change photo' : 'Upload photo'}</p>
              <p className="text-[11px] text-gray-400">JPG, PNG · 2MB max</p>
            </div>
            {imagePreview && (
              <button type="button" onClick={e => { e.preventDefault(); setImageFile(null); setImagePreview(null) }}
                className="ml-auto text-gray-300 hover:text-red-400 shrink-0">✕</button>
            )}
            <input type="file" accept="image/*" onChange={e => {
              const file = e.target.files[0]
              if (!file) return
              setImageFile(file); setImagePreview(URL.createObjectURL(file))
            }} className="hidden" />
          </label>
        </div>
        <div>
          <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Video <span className="text-gray-400 normal-case font-normal">(shown in popup)</span></label>
          <label className="flex items-center gap-2 cursor-pointer border border-dashed border-gray-300 rounded-xl px-3 py-2.5 hover:border-orange-400 hover:bg-orange-50 transition-colors">
            {videoPreview
              ? <div className="w-10 h-10 rounded-lg bg-gray-800 flex items-center justify-center shrink-0"><span className="text-white text-sm">▶</span></div>
              : <PhotoIcon className="w-4 h-4 text-gray-400 shrink-0" />
            }
            <div className="min-w-0">
              <p className="text-xs text-gray-700 font-medium truncate">{videoFile ? videoFile.name : videoPreview ? 'Change video' : 'Upload video'}</p>
              <p className="text-[11px] text-gray-400">MP4, WebM · 20MB max</p>
            </div>
            {videoPreview && (
              <button type="button" onClick={e => { e.preventDefault(); e.stopPropagation(); setVideoFile(null); setVideoPreview(null); setRemoveVideo(true) }}
                className="ml-auto text-gray-300 hover:text-red-400 shrink-0">✕</button>
            )}
            <input type="file" accept="video/mp4,video/webm" onChange={e => {
              const file = e.target.files[0]
              if (!file) return
              if (file.size > 20 * 1024 * 1024) { setVideoError('Video must be 20 MB or smaller'); e.target.value = ''; return }
              setVideoError(''); setVideoFile(file); setVideoPreview(URL.createObjectURL(file)); setRemoveVideo(false)
            }} className="hidden" />
          </label>
          {videoError && <p className="text-xs text-red-500 mt-1">{videoError}</p>}
        </div>

        {/* Advanced / Zomato fields — collapsed by default */}
        <div className="col-span-2">
          <button type="button" onClick={() => setShowAdvanced(s => !s)}
            className="text-xs font-semibold text-orange-600 hover:text-orange-700">
            {showAdvanced ? '− Hide' : '+ Show'} advanced (tax, tags, nutrition — for Zomato/Swiggy)
          </button>
        </div>
        {showAdvanced && (
          <>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">GST Slab (%)</label>
              <input type="number" step="0.5" min="0" max="100" value={form.gst_slab}
                onChange={e => setField('gst_slab', e.target.value)} className={inp('gst_slab')} placeholder="default (tenant rate)" />
              <p className="text-[11px] text-gray-400 mt-0.5">Leave blank to use the restaurant default.</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Packaging Charge (₹)</label>
              <input type="number" step="0.5" min="0" value={form.packaging_charge}
                onChange={e => setField('packaging_charge', e.target.value)} className={inp('packaging_charge')} placeholder="0" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.gst_cgst_sgst} onChange={e => setField('gst_cgst_sgst', e.target.checked)}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-400" />
                Split GST into CGST + SGST (India GST 5(9) bifurcation)
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Meat Type</label>
              <input value={form.meat_type} onChange={e => setField('meat_type', e.target.value)} className={inp('meat_type')} placeholder="e.g. Chicken, Mutton, Fish" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Serving Info</label>
              <input value={form.serving_info} onChange={e => setField('serving_info', e.target.value)} className={inp('serving_info')} placeholder="e.g. Serves 2" />
            </div>
            <div className="col-span-2">
              <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={form.is_beverage} onChange={e => setField('is_beverage', e.target.checked)}
                  className="rounded border-gray-300 text-orange-500 focus:ring-orange-400" />
                This is a beverage (Pepsi, Coke, etc.)
              </label>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Calories (kcal)</label>
              <input type="number" min="0" value={form.nutri_calories} onChange={e => setField('nutri_calories', e.target.value)} className={inp('nutri_calories')} placeholder="optional" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Protein (g)</label>
              <input type="number" min="0" value={form.nutri_protein} onChange={e => setField('nutri_protein', e.target.value)} className={inp('nutri_protein')} placeholder="optional" />
            </div>
          </>
        )}
      </div>

      {/* Variants & add-ons — available after item is saved (has an id) */}
      {isEdit && <VariantsAddonsManager item={item} />}
      {!isEdit && (
        <p className="text-xs text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
          💡 After saving, you'll be able to add portion sizes (variants) and add-ons directly here.
        </p>
      )}

      <div className="flex justify-end pt-1">
        <button type="submit" disabled={mutation.isPending}
          className="inline-flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-2.5 rounded-xl text-sm font-semibold disabled:opacity-50 hover:shadow-md transition-shadow">
          {mutation.isPending && <Spinner size="w-4 h-4" />}
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
  // freshItem holds the direct API response after create, so VariantsAddonsManager
  // gets the correct object before the menu-items query re-fetches
  const [freshItem, setFreshItem] = useState(null)
  const [selected, setSelected] = useState([])
  const [activeCat, setActiveCat] = useState('all')
  const [search, setSearch] = useState('')
  const [deleteItemTarget, setDeleteItemTarget] = useState(null)

  const { data: cats }  = useQuery({ queryKey: ['categories'], queryFn: () => getCategories().then(r => r.data.data) })
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

  const [activeSub, setActiveSub] = useState(null)

  // When activeCat changes, reset subcategory selection
  const handleSetActiveCat = (id) => { setActiveCat(id); setActiveSub(null); setSelected([]) }

  // Build nested structure for tabs
  const topLevelCats = cats?.filter(c => !c.parent_id) ?? []
  const subcatsOfActive = cats?.filter(c => String(c.parent_id) === String(activeCat)) ?? []

  const filteredItems = items?.filter(item => {
    let matchCat
    if (activeCat === 'all') {
      matchCat = true
    } else if (activeSub) {
      matchCat = String(item.menu_category_id) === String(activeSub)
    } else {
      // Show items in active cat + all its subcats
      const subIds = (cats?.filter(c => String(c.parent_id) === String(activeCat)) ?? []).map(c => String(c.id))
      matchCat = String(item.menu_category_id) === String(activeCat) || subIds.includes(String(item.menu_category_id))
    }
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
          {/* Category filter — tab row + subcategory pills (mirrors customer QR menu) */}
          <div className="mb-4">
            <div className="flex items-center gap-2 mb-2">
              <div className="flex gap-0 flex-1 overflow-x-auto border-b border-gray-200 scrollbar-hide">
                <button
                  onClick={() => handleSetActiveCat('all')}
                  className={`shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${activeCat === 'all' ? 'border-orange-500 text-orange-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                  All
                  <span className="ml-1.5 text-xs opacity-60">({items?.length ?? 0})</span>
                </button>
                {topLevelCats.map(cat => {
                  const subIds = (cats?.filter(c => String(c.parent_id) === String(cat.id)) ?? []).map(c => String(c.id))
                  const count = items?.filter(i => String(i.menu_category_id) === String(cat.id) || subIds.includes(String(i.menu_category_id))).length ?? 0
                  return (
                    <button key={cat.id} onClick={() => handleSetActiveCat(String(cat.id))}
                      className={`shrink-0 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors -mb-px ${String(activeCat) === String(cat.id) ? 'border-orange-500 text-orange-600 font-semibold' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
                      {cat.name}
                      <span className="ml-1.5 text-xs opacity-60">({count})</span>
                    </button>
                  )
                })}
              </div>
              <div className="shrink-0 relative">
                <MagnifyingGlassIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  placeholder="Search…"
                  className="border border-gray-200 rounded-xl pl-9 pr-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 w-36 bg-white"
                />
              </div>
            </div>
            {/* Subcategory pills — only shown when a top-level cat is selected and has subcats */}
            {activeCat !== 'all' && subcatsOfActive.length > 0 && (
              <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                <button onClick={() => setActiveSub(null)}
                  className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSub === null ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                  All
                </button>
                {subcatsOfActive.map(sub => (
                  <button key={sub.id} onClick={() => setActiveSub(String(sub.id))}
                    className={`shrink-0 px-3 py-1 text-xs font-medium rounded-full border transition-colors ${activeSub === String(sub.id) ? 'bg-orange-500 text-white border-orange-500' : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
                    {sub.name}
                  </button>
                ))}
              </div>
            )}
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
                          ? <div className="relative shrink-0">
                              <img src={item.image_url} className="w-9 h-9 rounded-lg object-cover shadow-sm" onError={e => { e.target.style.display='none' }} />
                              {item.video_url && <span className="absolute -bottom-0.5 -right-0.5 text-[8px] bg-gray-800 text-white rounded px-0.5">▶</span>}
                            </div>
                          : <div className="w-9 h-9 bg-gray-100 rounded-lg flex items-center justify-center shrink-0">
                              <VegDot type={item.type} />
                            </div>
                        }
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

      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setEditing(null); setFreshItem(null) }}
        title={editing ? 'Edit Item' : 'Add Menu Item'}
      >
        <ItemForm
          item={editing
            ? (() => {
                // Prefer live query data (has up-to-date variants/addons after invalidate),
                // fall back to freshItem (direct API response right after create)
                const live = items?.find(i => i.id === editing.id)
                return live ?? freshItem ?? editing
              })()
            : null
          }
          categories={cats}
          onSuccess={() => {
            setShowForm(false); setEditing(null); setFreshItem(null)
            qc.invalidateQueries({ queryKey: ['menu-items'] })
          }}
          onCreated={(newItem) => {
            qc.invalidateQueries({ queryKey: ['menu-items'] })
            setFreshItem(newItem)
            setEditing(newItem)
          }}
        />
      </Modal>

      <ConfirmDialog
        open={!!deleteItemTarget}
        title={`Delete "${deleteItemTarget?.name}"?`}
        message="This will permanently remove this menu item."
        confirmLabel={delItem.isPending ? 'Deleting…' : 'Delete'}
        loading={delItem.isPending}
        confirmClass="bg-red-500 hover:bg-red-600 text-white"
        onConfirm={() => delItem.mutate(deleteItemTarget?.id)}
        onCancel={() => setDeleteItemTarget(null)}
      />
    </div>
  )
}
