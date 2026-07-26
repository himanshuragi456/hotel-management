import { useState } from 'react'
import Spinner from '@/components/shared/Spinner'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { PlusIcon, TrashIcon, CheckIcon } from '@heroicons/react/24/outline'
import {
  createVariant, updateVariant, deleteVariant,
  createAddonGroup, updateAddonGroup, deleteAddonGroup,
  createAddon, updateAddon, deleteAddon,
} from '@/services/restaurantService'

// No width here — each usage sets its own (flex-1, w-24, …); a baked-in w-full would
// override those in a flex row and squash the siblings.
const inp = 'border border-gray-200 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 bg-gray-50'

// This whole manager is mounted inside the parent ItemForm's <form>. A bare <input>
// inside a form submits that form on Enter — which here would save the item and close
// the modal mid-edit. Swallow Enter on the inner inputs and run the local save instead.
const enterToSave = (fn) => (e) => { if (e.key === 'Enter') { e.preventDefault(); fn() } }

function Toggle({ checked, onChange }) {
  return (
    <button type="button" onClick={() => onChange(!checked)} className="relative shrink-0" style={{ minHeight: 0, minWidth: 0 }}>
      <div className={`w-9 h-5 rounded-full transition-colors ${checked ? 'bg-green-500' : 'bg-gray-300'}`} />
      <div className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
    </button>
  )
}

// ── Variants ──────────────────────────────────────────────────────────────
function VariantsSection({ item, invalidate }) {
  // pending rows not yet saved to API
  const [pending, setPending] = useState([])
  const [savingAll, setSavingAll] = useState(false)

  const toggle = useMutation({
    mutationFn: ({ id, is_available }) => updateVariant(id, { is_available }),
    onSuccess: invalidate,
  })
  const del = useMutation({ mutationFn: (id) => deleteVariant(id), onSuccess: invalidate })

  const addRow = () => setPending(p => [...p, { _id: Date.now(), name: '', price: '' }])
  const updRow = (id, k, v) => setPending(p => p.map(r => r._id === id ? { ...r, [k]: v } : r))
  const removeRow = (id) => setPending(p => p.filter(r => r._id !== id))

  const saveAll = async () => {
    const valid = pending.filter(r => r.name.trim() && r.price !== '')
    if (!valid.length) return
    setSavingAll(true)
    try {
      await Promise.all(valid.map(r => createVariant(item.id, { name: r.name.trim(), price: Number(r.price) })))
      setPending([])
      invalidate()
    } finally {
      setSavingAll(false)
    }
  }

  const hasPending = pending.some(r => r.name.trim() && r.price !== '')

  return (
    <div>
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Portion Sizes / Variants</h4>
        <div className="flex gap-2 shrink-0">
          {hasPending && (
            <button type="button" onClick={saveAll} disabled={savingAll}
              className="flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded-lg font-semibold disabled:opacity-50">
              <CheckIcon className="w-3.5 h-3.5" />{savingAll ? 'Saving…' : 'Save all'}
            </button>
          )}
          <button type="button" onClick={addRow}
            className="flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1 rounded-lg font-semibold">
            <PlusIcon className="w-3.5 h-3.5" /> Add
          </button>
        </div>
      </div>

      {/* Saved variants */}
      <div className="space-y-1.5 mb-2">
        {item.variants?.length
          ? item.variants.map(v => (
            <div key={v.id} className="flex items-center gap-2 bg-gray-50 rounded-lg px-2.5 py-1.5">
              <span className="flex-1 min-w-0 truncate text-sm text-gray-800 font-medium">{v.name}</span>
              <span className="shrink-0 text-sm font-semibold text-gray-900">₹{v.price}</span>
              <Toggle checked={v.is_available} onChange={(val) => toggle.mutate({ id: v.id, is_available: val })} />
              <button type="button" onClick={() => del.mutate(v.id)} className="shrink-0 text-red-400 hover:text-red-600"><TrashIcon className="w-4 h-4" /></button>
            </div>
          ))
          : pending.length === 0 && <p className="text-xs text-gray-400 mb-1">No variants — base item price used.</p>
        }
      </div>

      {/* Pending rows (not yet saved) */}
      {pending.map(row => (
        <div key={row._id} className="flex gap-2 mb-2">
          <input id={`variant-name-${row._id}`} name={`variant_name_${row._id}`} aria-label="Variant name" value={row.name} onChange={e => updRow(row._id, 'name', e.target.value)} onKeyDown={enterToSave(saveAll)}
            placeholder="e.g. Half / Full / Regular" className={`${inp} flex-1 min-w-0`} />
          <input id={`variant-price-${row._id}`} name={`variant_price_${row._id}`} aria-label="Variant price" value={row.price} onChange={e => updRow(row._id, 'price', e.target.value)} onKeyDown={enterToSave(saveAll)}
            type="number" step="0.5" min="0" placeholder="₹" className={`${inp} w-20 shrink-0`} />
          <button type="button" onClick={() => removeRow(row._id)}
            className="shrink-0 w-8 h-8 rounded-lg bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      ))}

      {pending.length > 0 && !hasPending && (
        <p className="text-xs text-amber-600">Fill in name and price above, then click Save all.</p>
      )}
    </div>
  )
}

// ── Add-on groups & add-ons ─────────────────────────────────────────────────
function AddonGroupCard({ group, invalidate, updGroup, delGroup }) {
  const [pending, setPending] = useState([])
  const [savingAll, setSavingAll] = useState(false)

  const toggleItem = useMutation({ mutationFn: ({ id, is_available }) => updateAddon(id, { is_available }), onSuccess: invalidate })
  const delItem = useMutation({ mutationFn: (id) => deleteAddon(id), onSuccess: invalidate })

  const addRow = () => setPending(p => [...p, { _id: Date.now(), name: '', price: '', type: 'veg' }])
  const updRow = (id, k, v) => setPending(p => p.map(r => r._id === id ? { ...r, [k]: v } : r))
  const removeRow = (id) => setPending(p => p.filter(r => r._id !== id))

  const saveAll = async () => {
    const valid = pending.filter(r => r.name.trim())
    if (!valid.length) return
    setSavingAll(true)
    try {
      await Promise.all(valid.map(r => createAddon(group.id, { name: r.name.trim(), price: Number(r.price || 0), type: r.type })))
      setPending([])
      invalidate()
    } finally {
      setSavingAll(false)
    }
  }

  const hasPending = pending.some(r => r.name.trim())

  return (
    <div className="border border-gray-200 rounded-xl p-3">
      <div className="flex items-center gap-2 flex-wrap mb-2">
        <span className="flex-1 min-w-[80px] truncate text-sm font-semibold text-gray-800">{group.name}</span>
        <div className="flex items-center gap-2 shrink-0">
          <label className="text-xs text-gray-500 flex items-center gap-1">
            min
            <input id={`addon-group-min-${group.id}`} name={`addon_group_min_${group.id}`} type="number" min="0" defaultValue={group.min_select}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } }}
              onBlur={e => updGroup.mutate({ id: group.id, data: { min_select: Number(e.target.value) } })}
              className="w-12 border border-gray-200 rounded px-1 py-0.5 text-center text-xs" />
          </label>
          <label className="text-xs text-gray-500 flex items-center gap-1">
            max
            <input id={`addon-group-max-${group.id}`} name={`addon_group_max_${group.id}`} type="number" min="1" defaultValue={group.max_select}
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); e.target.blur() } }}
              onBlur={e => updGroup.mutate({ id: group.id, data: { max_select: Number(e.target.value) } })}
              className="w-12 border border-gray-200 rounded px-1 py-0.5 text-center text-xs" />
          </label>
          <button type="button" onClick={() => delGroup.mutate(group.id)} className="shrink-0 text-red-400 hover:text-red-600">
            <TrashIcon className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Saved addons */}
      <div className="space-y-1 mb-2">
        {group.addons?.map(a => (
          <div key={a.id} className="flex items-center gap-2 text-sm pl-2">
            <span className={`w-2 h-2 rounded-full shrink-0 ${a.type === 'non-veg' ? 'bg-red-500' : 'bg-green-500'}`} />
            <span className="flex-1 min-w-0 truncate text-gray-700">{a.name}</span>
            {a.price > 0 && <span className="shrink-0 text-gray-500 text-xs">+₹{a.price}</span>}
            <Toggle checked={a.is_available} onChange={(val) => toggleItem.mutate({ id: a.id, is_available: val })} />
            <button type="button" onClick={() => delItem.mutate(a.id)} className="shrink-0 text-red-400 hover:text-red-600">
              <TrashIcon className="w-3.5 h-3.5" />
            </button>
          </div>
        ))}
        {!group.addons?.length && pending.length === 0 && (
          <p className="text-xs text-gray-400 pl-2">No options yet.</p>
        )}
      </div>

      {/* Pending rows */}
      {pending.map(row => (
        <div key={row._id} className="flex flex-wrap gap-1.5 mb-1.5">
          <input id={`addon-name-${row._id}`} name={`addon_name_${row._id}`} aria-label="Option name" value={row.name} onChange={e => updRow(row._id, 'name', e.target.value)} onKeyDown={enterToSave(saveAll)}
            placeholder="Option name" className={`${inp} flex-1 min-w-[100px] text-xs`} />
          <input id={`addon-price-${row._id}`} name={`addon_price_${row._id}`} aria-label="Option price" value={row.price} onChange={e => updRow(row._id, 'price', e.target.value)} onKeyDown={enterToSave(saveAll)}
            type="number" step="0.5" min="0" placeholder="₹0" className={`${inp} text-xs w-14 shrink-0`} />
          <select id={`addon-type-${row._id}`} name={`addon_type_${row._id}`} aria-label="Option type" value={row.type} onChange={e => updRow(row._id, 'type', e.target.value)}
            className={`${inp} text-xs w-[72px] shrink-0`}>
            <option value="veg">Veg</option>
            <option value="non-veg">Non-veg</option>
          </select>
          <button type="button" onClick={() => removeRow(row._id)}
            className="shrink-0 w-7 h-7 rounded bg-red-50 hover:bg-red-100 text-red-400 flex items-center justify-center">
            <TrashIcon className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}

      <div className="flex gap-2 flex-wrap mt-1.5">
        <button type="button" onClick={addRow}
          className="shrink-0 flex items-center gap-1 text-xs text-orange-600 hover:text-orange-700 font-semibold">
          <PlusIcon className="w-3.5 h-3.5" /> Add option
        </button>
        {hasPending && (
          <button type="button" onClick={saveAll} disabled={savingAll}
            className="shrink-0 flex items-center gap-1 text-xs bg-green-500 hover:bg-green-600 text-white px-2.5 py-1 rounded-lg font-semibold disabled:opacity-50 ml-auto">
            <CheckIcon className="w-3.5 h-3.5" />{savingAll ? 'Saving…' : 'Save options'}
          </button>
        )}
      </div>
    </div>
  )
}

function AddonsSection({ item, invalidate }) {
  const [groupName, setGroupName] = useState('')

  const addGroup = useMutation({
    mutationFn: () => createAddonGroup(item.id, { name: groupName.trim(), min_select: 0, max_select: 1 }),
    onSuccess: () => { setGroupName(''); invalidate() },
  })
  const updGroup = useMutation({ mutationFn: ({ id, data }) => updateAddonGroup(id, data), onSuccess: invalidate })
  const delGroup = useMutation({ mutationFn: (id) => deleteAddonGroup(id), onSuccess: invalidate })

  // NOTE: This UI is rendered INSIDE the parent ItemForm's <form>. HTML forbids nesting
  // a <form> in a <form> (the browser silently drops the inner one), which would make a
  // submit button bubble up and submit/close the whole item modal. So we use a plain div
  // + type="button" and handle Enter-to-add manually.
  const submitGroup = () => { if (groupName.trim() && !addGroup.isPending) addGroup.mutate() }

  return (
    <div>
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">Add-on Groups</h4>
      <div className="space-y-3 mb-3">
        {item.addon_groups?.length
          ? item.addon_groups.map(g => (
            <AddonGroupCard key={g.id} group={g} invalidate={invalidate} updGroup={updGroup} delGroup={delGroup} />
          ))
          : <p className="text-xs text-gray-400">No add-on groups yet.</p>
        }
      </div>
      <div className="flex gap-2 flex-wrap">
        <input id="addon-group-name" name="group_name" aria-label="Add-on group name" value={groupName} onChange={e => setGroupName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submitGroup() } }}
          placeholder='Group name (e.g. "Choose sauce")' className={`${inp} flex-1 min-w-[140px]`} />
        <button type="button" onClick={submitGroup} disabled={addGroup.isPending}
          className="shrink-0 flex items-center gap-1 text-xs bg-orange-500 hover:bg-orange-600 text-white px-3 py-1.5 rounded-lg font-semibold disabled:opacity-50 whitespace-nowrap">
          <PlusIcon className="w-3.5 h-3.5" /> Add group
        </button>
      </div>
    </div>
  )
}

export default function VariantsAddonsManager({ item }) {
  const qc = useQueryClient()
  const invalidate = () => qc.invalidateQueries({ queryKey: ['menu-items'] })

  return (
    <div className="space-y-5 pt-4 mt-4 border-t border-gray-100">
      <VariantsSection item={item} invalidate={invalidate} />
      <AddonsSection item={item} invalidate={invalidate} />
    </div>
  )
}
