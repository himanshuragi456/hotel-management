/**
 * Bottom-sheet: full item details + variant/add-on selection.
 * Sized for iPhone 13 (390px): 44pt+ touch targets, 16-17px text, full-width.
 */
import { useState, useEffect } from 'react'
import { XMarkIcon, PlusIcon, MinusIcon, BoltIcon, ClockIcon } from '@heroicons/react/24/outline'

const VEG_DOT    = <span className="w-4 h-4 rounded-sm border-2 border-green-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-green-600"/></span>
const NONVEG_DOT = <span className="w-4 h-4 rounded-sm border-2 border-red-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-red-600"/></span>
const VEGAN_DOT  = <span className="w-4 h-4 rounded-sm border-2 border-emerald-600 flex items-center justify-center shrink-0"><span className="w-2 h-2 rounded-full bg-emerald-600"/></span>
const typeIcon   = { veg: VEG_DOT, 'non-veg': NONVEG_DOT, vegan: VEGAN_DOT }

function fmt(p) { return `₹${Number(p).toLocaleString('en-IN')}` }

export default function ItemCustomizeSheet({ item, gstInclusive = false, onAdd, onClose, initialQty = 1 }) {
  const hasVariants = item.variants?.length > 0
  // Only groups that actually have selectable options. A group with no (available) add-ons
  // would otherwise render an empty "tap to select" block with nothing to tap.
  const addonGroups = (item.addon_groups ?? []).filter(g => g.addons?.length > 0)
  const hasAddons   = addonGroups.length > 0

  const [selectedVariant, setSelectedVariant] = useState(hasVariants ? item.variants[0] : null)
  const [selectedAddons,  setSelectedAddons]  = useState({})
  const [qty,   setQty]   = useState(initialQty)
  const [error, setError] = useState('')

  useEffect(() => {
    setSelectedVariant(hasVariants ? item.variants[0] : null)
    setSelectedAddons({})
    setQty(initialQty)
    setError('')
  }, [item.id])

  const basePrice   = selectedVariant ? selectedVariant.price : item.price
  const addonsTotal = Object.values(selectedAddons).flatMap(s => [...s])
    .reduce((sum, id) => {
      for (const g of (item.addon_groups ?? [])) {
        const a = g.addons?.find(a => a.id === id)
        if (a) return sum + a.price
      }
      return sum
    }, 0)
  const lineUnit  = basePrice + addonsTotal
  const lineTotal = lineUnit * qty

  const toggleAddon = (group, addonId) => {
    const gid  = group.id
    const prev = selectedAddons[gid] ? new Set(selectedAddons[gid]) : new Set()
    if (prev.has(addonId)) {
      prev.delete(addonId)
    } else {
      if (group.max_select && prev.size >= group.max_select) {
        if (group.max_select === 1) prev.clear()
        else return
      }
      prev.add(addonId)
    }
    setSelectedAddons(s => ({ ...s, [gid]: prev }))
    setError('')
  }

  const handleAdd = () => {
    for (const g of addonGroups) {
      const sel = selectedAddons[g.id]?.size ?? 0
      if (g.min_select > 0 && sel < g.min_select) {
        setError(`Please select at least ${g.min_select} option${g.min_select > 1 ? 's' : ''} for "${g.name}"`)
        return
      }
    }
    const addonIds    = Object.values(selectedAddons).flatMap(s => [...s])
    const addonLabels = addonIds.map(id => {
      for (const g of (item.addon_groups ?? [])) {
        const a = g.addons?.find(a => a.id === id)
        if (a) return a.name
      }
      return ''
    }).filter(Boolean)

    onAdd({
      menu_item_id:  item.id,
      variant_id:    selectedVariant?.id ?? null,
      addon_ids:     addonIds,
      quantity:      qty,
      name:          item.name,
      variant_name:  selectedVariant?.name ?? null,
      addon_labels:  addonLabels,
      price:         lineUnit,
      unit_price:    basePrice,
      addons_total:  addonsTotal,
      type:          item.type,
      is_ready_made: item.is_ready_made,
    })
  }

  const displayGstRate = item.gst_slab ?? null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Cap at phone width + center so the popup (and its full-width video) never spills on big screens */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[94dvh]">

        {/* Fixed header — drag handle + close button, never scrolls */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-1">
          <div className="w-9" />{/* spacer */}
          <div className="w-10 h-1 rounded-full bg-gray-200" />
          <button onClick={onClose}
            className="w-9 h-9 rounded-full bg-gray-100 hover:bg-gray-200 flex items-center justify-center text-gray-600 transition-colors">
            <XMarkIcon className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">

          {/* Media block — video takes priority in popup; fall back to image */}
          {(item.video_url || item.image_url) ? (
            <div className="w-full px-4 pt-2 pb-0">
              {item.video_url ? (
                <video src={item.video_url} className="w-full aspect-video object-cover rounded-2xl" autoPlay muted loop playsInline />
              ) : (
                <img src={item.image_url} alt={item.name} className="w-full aspect-[4/3] object-cover rounded-2xl"
                  onError={e => { e.target.parentElement.style.display = 'none' }} />
              )}
            </div>
          ) : null}

          <div className="px-5 pt-5 pb-3 space-y-5">

            {/* Title */}
            <div>
              <div className="flex items-start gap-2.5 mb-2">
                <span className="mt-1 shrink-0">{typeIcon[item.type]}</span>
                <h2 className="text-xl font-bold text-gray-900 leading-snug">{item.name}</h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 ml-7">
                {item.is_ready_made && (
                  <span className="inline-flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2.5 py-1 rounded-full font-semibold">
                    <BoltIcon className="w-3.5 h-3.5" /> Instant
                  </span>
                )}
                {item.prep_time_minutes && !item.is_ready_made && (
                  <span className="inline-flex items-center gap-1 text-xs bg-amber-50 text-amber-700 px-2.5 py-1 rounded-full font-semibold">
                    <ClockIcon className="w-3.5 h-3.5" /> ~{item.prep_time_minutes} min
                  </span>
                )}
                {item.is_beverage && (
                  <span className="text-xs bg-cyan-50 text-cyan-700 px-2.5 py-1 rounded-full font-semibold">Beverage</span>
                )}
                {item.meat_type && (
                  <span className="text-xs bg-rose-50 text-rose-700 px-2.5 py-1 rounded-full font-semibold">{item.meat_type}</span>
                )}
                {displayGstRate != null && (
                  <span className="text-xs bg-gray-100 text-gray-500 px-2.5 py-1 rounded-full font-medium">
                    GST {displayGstRate}%{gstInclusive ? ' incl.' : ''}
                  </span>
                )}
              </div>
            </div>

            {/* Description */}
            {item.description && (
              <p className="text-base text-gray-500 leading-relaxed ml-7">{item.description}</p>
            )}

            {/* Serving + nutrition */}
            {(item.serving_info || item.nutritional_info?.calories || item.nutritional_info?.protein) && (
              <div className="ml-7 flex flex-wrap gap-4 text-sm text-gray-400">
                {item.serving_info && <span>🍽 {item.serving_info}</span>}
                {item.nutritional_info?.calories && <span>🔥 {item.nutritional_info.calories} kcal</span>}
                {item.nutritional_info?.protein  && <span>💪 {item.nutritional_info.protein}g protein</span>}
              </div>
            )}

            {item.packaging_charge > 0 && (
              <p className="ml-7 text-sm text-gray-400">+{fmt(item.packaging_charge)} packaging charge</p>
            )}

            {/* ── Variants ── */}
            {hasVariants && (
              <div>
                <div className="flex items-center justify-between mb-3">
                  <p className="text-sm font-semibold text-gray-700">Choose size / portion</p>
                  <span className="text-xs text-gray-400">Select one</span>
                </div>
                <div className="space-y-2">
                  {item.variants.map(v => {
                    const selected = selectedVariant?.id === v.id
                    return (
                      <button key={v.id} onClick={() => setSelectedVariant(v)}
                        className={`w-full flex items-center justify-between px-4 py-3 rounded-2xl border-2 transition-colors ${
                          selected ? 'border-orange-500 bg-orange-50' : 'border-gray-200 bg-white'
                        }`}>
                        <div className="flex items-center gap-3">
                          {/* radio dot */}
                          <div className={`w-5 h-5 rounded-full border-2 shrink-0 flex items-center justify-center transition-colors ${
                            selected ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'
                          }`}>
                            {selected && <span className="w-2 h-2 rounded-full bg-white" />}
                          </div>
                          <span className={`text-base font-semibold ${selected ? 'text-orange-700' : 'text-gray-800'}`}>{v.name}</span>
                        </div>
                        <span className={`text-base font-bold tabular-nums ${selected ? 'text-orange-600' : 'text-gray-600'}`}>{fmt(v.price)}</span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Addon Groups ── */}
            {hasAddons && addonGroups.map(group => {
              const selCount = selectedAddons[group.id]?.size ?? 0
              const isRequired = group.min_select > 0
              const isMulti = group.max_select !== 1
              return (
                <div key={group.id} className={`rounded-2xl border-2 overflow-hidden ${isRequired && selCount < group.min_select ? 'border-red-200' : 'border-gray-100'}`}>
                  {/* Group header */}
                  <div className={`px-4 py-3 flex items-center justify-between ${isRequired ? 'bg-orange-50' : 'bg-gray-50'}`}>
                    <div>
                      <p className="text-sm font-bold text-gray-800">{group.name}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {isMulti
                          ? `Pick up to ${group.max_select} · tap to select`
                          : 'Pick one · tap to select'}
                      </p>
                    </div>
                    {isRequired
                      ? <span className="text-[11px] font-bold text-red-500 bg-red-50 border border-red-200 px-2 py-0.5 rounded-full">Required</span>
                      : <span className="text-[11px] text-gray-400 bg-white border border-gray-200 px-2 py-0.5 rounded-full">Optional</span>
                    }
                  </div>
                  {/* Options */}
                  <div className="divide-y divide-gray-100">
                    {group.addons?.map(addon => {
                      const checked = selectedAddons[group.id]?.has(addon.id) ?? false
                      return (
                        <button key={addon.id} onClick={() => toggleAddon(group, addon.id)}
                          className={`w-full flex items-center justify-between px-4 py-3 transition-colors ${
                            checked ? 'bg-orange-50' : 'bg-white hover:bg-gray-50'
                          }`}>
                          <div className="flex items-center gap-3">
                            {/* checkbox or radio based on max_select */}
                            <div className={`w-5 h-5 shrink-0 flex items-center justify-center transition-colors ${
                              isMulti ? 'rounded-md' : 'rounded-full'
                            } border-2 ${checked ? 'border-orange-500 bg-orange-500' : 'border-gray-300 bg-white'}`}>
                              {checked && (
                                isMulti
                                  ? <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 12 12"><path d="M2 6l3 3 5-5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                                  : <span className="w-2 h-2 rounded-full bg-white" />
                              )}
                            </div>
                            <span className={`text-base font-medium ${checked ? 'text-orange-700' : 'text-gray-800'}`}>{addon.name}</span>
                            {addon.type && (
                              <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${addon.type === 'non-veg' ? 'bg-red-500' : 'bg-green-500'}`} />
                            )}
                          </div>
                          <span className={`text-sm font-semibold tabular-nums ${checked ? 'text-orange-600' : 'text-gray-500'}`}>
                            {addon.price > 0 ? `+${fmt(addon.price)}` : <span className="text-gray-300 text-xs">Free</span>}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-base px-4 py-3 rounded-2xl">{error}</div>
            )}
          </div>
        </div>

        {/* Footer — fixed, full-width, generous padding */}
        <div className="shrink-0 px-5 pt-4 pb-8 bg-white border-t border-gray-100 space-y-4">
          {/* Price summary */}
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-500 space-y-0.5">
              {selectedVariant && <p>{selectedVariant.name}</p>}
              {addonsTotal > 0 && <p>Add-ons +{fmt(addonsTotal)}</p>}
            </div>
            <div className="text-right">
              <p className="text-2xl font-black text-gray-900">{fmt(lineTotal)}</p>
              {gstInclusive
                ? <p className="text-xs text-gray-400">incl. GST</p>
                : displayGstRate != null
                  ? <p className="text-xs text-gray-400">+{displayGstRate}% GST extra</p>
                  : null
              }
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Qty stepper — 44pt touch targets */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-2xl px-2 py-2">
              <button onClick={() => setQty(q => Math.max(1, q - 1))}
                className="w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center text-gray-700 active:bg-orange-50">
                <MinusIcon className="w-5 h-5" />
              </button>
              <span className="font-bold text-gray-900 w-8 text-center text-lg">{qty}</span>
              <button onClick={() => setQty(q => q + 1)}
                className="w-11 h-11 rounded-xl bg-orange-500 flex items-center justify-center text-white active:bg-orange-600">
                <PlusIcon className="w-5 h-5" />
              </button>
            </div>

            {/* Add button */}
            <button onClick={handleAdd}
              className="flex-1 bg-orange-500 text-white font-bold py-4 rounded-2xl text-base transition-colors active:bg-orange-600 shadow-lg shadow-orange-200/60">
              Add  {fmt(lineTotal)}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
