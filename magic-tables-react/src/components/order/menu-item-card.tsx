"use client";

import { useState } from "react";
import { Plus, Minus, Clock, Zap, Sparkles } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import type { MenuItem, Tenant, Table } from "@/types";
import { cn } from "@/lib/utils";
import { ItemDetailSheet } from "./item-detail-sheet";

interface MenuItemCardProps {
  item: MenuItem;
  restaurant: Tenant;
  table: Table;
}

export function MenuItemCard({ item, restaurant, table }: MenuItemCardProps) {
  const { items, addItem, updateQuantity } = useCartStore();
  const cartEntry = items.find((i) => i.menuItem.id === item.id);
  const qty = cartEntry?.quantity ?? 0;
  const [showDetail, setShowDetail] = useState(false);

  const hasMedia = !!item.image_url || !!item.video_url;
  const hasVideo = !!item.video_url;

  return (
    <>
      <div
        onClick={() => setShowDetail(true)}
        className={cn(
          "flex rounded-2xl bg-white border border-stone-100 overflow-hidden transition-all duration-150 cursor-pointer active:scale-[0.99]",
          !item.is_available && "opacity-50"
        )}
      >
        {/* Media — fixed width, height tracks the content row (no fixed-square gap) */}
        {hasMedia && (
          <div className="relative w-28 self-stretch shrink-0 overflow-hidden bg-stone-100 min-h-[7rem]">
            {item.image_url ? (
              // Optimizer disabled globally; plain img is correct for backend-served media.
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={item.image_url}
                alt={item.name}
                className="absolute inset-0 w-full h-full object-cover"
              />
            ) : (
              // Video-only item — show a play affordance over a dark shimmer.
              <div className="absolute inset-0 flex items-center justify-center bg-stone-900">
                <div className="w-10 h-10 rounded-full bg-white/15 border border-white/30 flex items-center justify-center">
                  <span className="text-white text-base ml-0.5">▶</span>
                </div>
              </div>
            )}
            {hasVideo && (
              <span className="absolute bottom-2 right-2 inline-flex items-center gap-0.5 text-[10px] font-bold px-2 py-0.5 rounded-full bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-md shadow-purple-500/40 tracking-wide uppercase">
                <Sparkles className="w-2.5 h-2.5" aria-hidden="true" /> Video
              </span>
            )}
          </div>
        )}

        {/* Content — top-aligned, consistent left rhythm */}
        <div className="flex-1 p-4 flex flex-col min-w-0 min-h-[7rem]">
          <div>
            <div className="flex items-start gap-2 mb-1">
              {item.is_veg && (
                <span
                  className="flex-shrink-0 mt-0.5 w-4 h-4 rounded border-2 border-emerald-600 flex items-center justify-center"
                  aria-label="Vegetarian"
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                </span>
              )}
              <h4 className="font-medium text-stone-900 text-sm leading-snug">{item.name}</h4>
            </div>

            {item.description && (
              <p className={cn("text-xs text-stone-500 leading-relaxed line-clamp-2 mb-2", item.is_veg && "ml-6")}>
                {item.description}
              </p>
            )}

            {/* Prep time / instant badge */}
            {item.is_ready_made ? (
              <div className={cn("inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mb-2", item.is_veg && "ml-6")}>
                <Zap className="w-3 h-3" aria-hidden="true" />
                Instant
              </div>
            ) : item.prep_time_minutes ? (
              <div className={cn("inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mb-2", item.is_veg && "ml-6")}>
                <Clock className="w-3 h-3" aria-hidden="true" />
                ~{item.prep_time_minutes} min
              </div>
            ) : null}
          </div>

          {/* Price + add — aligned to the name's left edge */}
          <div className={cn("flex items-center justify-between gap-3 mt-auto pt-1", item.is_veg && "ml-6")}>
            <p className="font-semibold text-stone-900 text-sm tabular-nums">{formatCurrency(item.price)}</p>

            {item.is_available ? (
              qty === 0 ? (
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    addItem(item, restaurant, table);
                  }}
                  className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-300 text-rose-600 text-sm font-medium hover:bg-rose-50 active:bg-rose-100 transition-all duration-150 cursor-pointer"
                  aria-label={`Add ${item.name} to cart`}
                >
                  <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  Add
                </button>
              ) : (
                <div
                  className="flex items-center gap-2"
                  role="group"
                  aria-label={`${item.name} quantity`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() => updateQuantity(item.id, qty - 1)}
                    className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 active:bg-rose-800 transition-colors duration-150 cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                  <span className="w-4 text-center font-semibold text-stone-900 text-sm tabular-nums">{qty}</span>
                  <button
                    onClick={() => addItem(item, restaurant, table)}
                    className="w-7 h-7 rounded-lg bg-rose-600 text-white flex items-center justify-center hover:bg-rose-700 active:bg-rose-800 transition-colors duration-150 cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                  </button>
                </div>
              )
            ) : (
              <span className="text-xs text-stone-400">Unavailable</span>
            )}
          </div>
        </div>
      </div>

      {showDetail && (
        <ItemDetailSheet item={item} restaurant={restaurant} table={table} onClose={() => setShowDetail(false)} />
      )}
    </>
  );
}
