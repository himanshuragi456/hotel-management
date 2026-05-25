"use client";

import { ShoppingCart, ArrowRight } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import { useRouter } from "next/navigation";

export function CartBar({ isOpen = true }: { isOpen?: boolean }) {
  const router = useRouter();
  const itemCount = useCartStore((s) => s.itemCount());
  const total = useCartStore((s) => s.subtotal());
  const hydrated = useCartStore((s) => s._hasHydrated);

  if (!hydrated || itemCount === 0) return null;

  return (
    <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
      <button
        onClick={() => isOpen && router.push("/checkout")}
        disabled={!isOpen}
        className={`pointer-events-auto flex items-center justify-between gap-6 rounded-2xl px-5 py-4 shadow-2xl transition-all duration-150 w-full max-w-md ${
          isOpen
            ? "bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950 cursor-pointer shadow-stone-900/30"
            : "bg-stone-300 text-stone-500 cursor-not-allowed shadow-stone-300/30"
        }`}
        aria-label={`View cart: ${itemCount} items, ${formatCurrency(total)}`}
      >
        <div className="flex items-center gap-3">
          <div className="relative">
            <ShoppingCart className="w-5 h-5" aria-hidden="true" />
            <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-xs font-bold bg-rose-500 rounded-full tabular-nums">
              {itemCount}
            </span>
          </div>
          <span className="font-medium text-sm">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
        </div>

        <div className="flex items-center gap-2">
          <span className="font-semibold tabular-nums">{formatCurrency(total)}</span>
          <ArrowRight className="w-4 h-4 opacity-70" aria-hidden="true" />
        </div>
      </button>
    </div>
  );
}
