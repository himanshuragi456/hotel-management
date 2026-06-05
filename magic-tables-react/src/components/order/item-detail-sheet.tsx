"use client";

/**
 * Item detail bottom-sheet — big video/image, description, prep badge, qty + Add.
 * Mobile-first: capped at max-w-md and centered so media never spills on big screens.
 */
import { useState } from "react";
import { X, Plus, Minus, Clock, Zap } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import type { MenuItem, Tenant, Table } from "@/types";

interface ItemDetailSheetProps {
  item: MenuItem;
  restaurant: Tenant;
  table: Table;
  onClose: () => void;
}

export function ItemDetailSheet({ item, restaurant, table, onClose }: ItemDetailSheetProps) {
  const { items, addItem, updateQuantity } = useCartStore();
  const inCart = items.find((i) => i.menuItem.id === item.id)?.quantity ?? 0;

  // Local quantity the user is about to add (defaults to 1, or current cart qty if already added).
  // The sheet mounts fresh each time a card opens it, so the initializer is enough — no resync effect.
  const [qty, setQty] = useState(inCart > 0 ? inCart : 1);

  const lineTotal = item.price * qty;

  const handleAdd = () => {
    if (!item.is_available) return;
    if (inCart === 0) {
      // addItem inserts at qty 1; bump to the chosen quantity in one go.
      addItem(item, restaurant, table);
      if (qty > 1) updateQuantity(item.id, qty);
    } else {
      // Already in cart — treat the stepper as the new absolute quantity.
      updateQuantity(item.id, qty);
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" onClick={onClose} />

      {/* Phone-width panel, centered on big screens */}
      <div className="relative w-full max-w-md bg-white rounded-t-3xl shadow-2xl flex flex-col max-h-[92dvh]">
        {/* Header — drag handle + close */}
        <div className="shrink-0 flex items-center justify-between px-4 pt-3 pb-1">
          <div className="w-9" />
          <div className="w-10 h-1 rounded-full bg-stone-200" />
          <button
            onClick={onClose}
            className="w-9 h-9 rounded-full bg-stone-100 hover:bg-stone-200 flex items-center justify-center text-stone-600 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="flex-1 overflow-y-auto overscroll-contain">
          {/* Media — video takes priority, fall back to image */}
          {(item.video_url || item.image_url) && (
            <div className="w-full px-4 pt-2">
              {item.video_url ? (
                <video
                  src={item.video_url}
                  className="w-full aspect-video object-cover rounded-2xl bg-stone-100"
                  autoPlay
                  muted
                  loop
                  playsInline
                />
              ) : (
                // Backend image; optimizer is disabled globally so a plain img is correct here.
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.image_url!}
                  alt={item.name}
                  className="w-full aspect-[4/3] object-cover rounded-2xl bg-stone-100"
                  onError={(e) => {
                    (e.currentTarget.parentElement as HTMLElement).style.display = "none";
                  }}
                />
              )}
            </div>
          )}

          <div className="px-5 pt-5 pb-3 space-y-4">
            {/* Title + veg dot */}
            <div className="flex items-start gap-2.5">
              {item.is_veg && (
                <span
                  className="mt-1 shrink-0 w-4 h-4 rounded border-2 border-emerald-600 flex items-center justify-center"
                  aria-label="Vegetarian"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                </span>
              )}
              <h2 className="text-xl font-bold text-stone-900 leading-snug">{item.name}</h2>
            </div>

            {/* Prep / instant badge */}
            {item.is_ready_made ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full">
                <Zap className="w-3.5 h-3.5" aria-hidden="true" /> Instant
              </span>
            ) : item.prep_time_minutes ? (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700 bg-amber-50 px-2.5 py-1 rounded-full">
                <Clock className="w-3.5 h-3.5" aria-hidden="true" /> ~{item.prep_time_minutes} min
              </span>
            ) : null}

            {/* Description */}
            {item.description && (
              <p className="text-base text-stone-500 leading-relaxed">{item.description}</p>
            )}
          </div>
        </div>

        {/* Footer — price + qty + add */}
        <div className="shrink-0 px-5 pt-4 pb-8 bg-white border-t border-stone-100 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-stone-500">Price</span>
            <span className="text-2xl font-black text-stone-900 tabular-nums">{formatCurrency(lineTotal)}</span>
          </div>

          {item.is_available ? (
            <div className="flex items-center gap-3">
              {/* Qty stepper */}
              <div className="flex items-center gap-1 bg-stone-100 rounded-2xl px-2 py-2">
                <button
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="w-11 h-11 rounded-xl bg-white shadow-sm flex items-center justify-center text-stone-700 active:bg-rose-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="w-5 h-5" />
                </button>
                <span className="font-bold text-stone-900 w-8 text-center text-lg tabular-nums">{qty}</span>
                <button
                  onClick={() => setQty((q) => q + 1)}
                  className="w-11 h-11 rounded-xl bg-rose-600 flex items-center justify-center text-white active:bg-rose-700"
                  aria-label="Increase quantity"
                >
                  <Plus className="w-5 h-5" />
                </button>
              </div>

              <button
                onClick={handleAdd}
                className="flex-1 bg-rose-600 text-white font-bold py-4 rounded-2xl text-base transition-colors active:bg-rose-700 shadow-lg shadow-rose-200/60"
              >
                {inCart > 0 ? "Update" : "Add"} · {formatCurrency(lineTotal)}
              </button>
            </div>
          ) : (
            <div className="w-full text-center bg-stone-100 text-stone-400 font-semibold py-4 rounded-2xl text-sm">
              Currently unavailable
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
