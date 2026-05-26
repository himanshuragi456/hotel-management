"use client";

import Image from "next/image";
import { Plus, Minus, Clock, Zap } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import type { MenuItem, Tenant, Table } from "@/types";
import { cn } from "@/lib/utils";

interface MenuItemCardProps {
  item: MenuItem;
  restaurant: Tenant;
  table: Table;
}

export function MenuItemCard({ item, restaurant, table }: MenuItemCardProps) {
  const { items, addItem, updateQuantity } = useCartStore();
  const cartEntry = items.find((i) => i.menuItem.id === item.id);
  const qty = cartEntry?.quantity ?? 0;

  return (
    <div className={cn(
      "flex gap-4 p-4 rounded-2xl bg-white border border-stone-100 transition-all duration-150",
      !item.is_available && "opacity-50"
    )}>
      {item.image_url && (
        <div className="relative w-24 h-24 flex-shrink-0 rounded-xl overflow-hidden bg-stone-100">
          <Image
            src={item.image_url}
            alt={item.name}
            fill
            className="object-cover"
            sizes="96px"
            loading="lazy"
          />
        </div>
      )}

      <div className="flex-1 min-w-0">
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
          <p className="text-xs text-stone-500 leading-relaxed line-clamp-2 mb-2">{item.description}</p>
        )}

        {/* Prep time / instant badge */}
        {item.is_ready_made ? (
          <div className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full mb-2">
            <Zap className="w-3 h-3" aria-hidden="true" />
            Instant
          </div>
        ) : item.prep_time_minutes ? (
          <div className="inline-flex items-center gap-1 text-xs font-medium text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full mb-2">
            <Clock className="w-3 h-3" aria-hidden="true" />
            ~{item.prep_time_minutes} min
          </div>
        ) : null}

        <div className="flex items-center justify-between">
          <p className="font-semibold text-stone-900 text-sm">{formatCurrency(item.price)}</p>

          {item.is_available ? (
            qty === 0 ? (
              <button
                onClick={() => addItem(item, restaurant, table)}
                className="flex items-center gap-1 px-3 py-1.5 rounded-xl border border-rose-300 text-rose-600 text-sm font-medium hover:bg-rose-50 active:bg-rose-100 transition-all duration-150 cursor-pointer"
                aria-label={`Add ${item.name} to cart`}
              >
                <Plus className="w-3.5 h-3.5" aria-hidden="true" />
                Add
              </button>
            ) : (
              <div className="flex items-center gap-2" role="group" aria-label={`${item.name} quantity`}>
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
  );
}
