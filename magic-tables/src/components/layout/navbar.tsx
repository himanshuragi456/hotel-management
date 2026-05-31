"use client";

import Link from "next/link";
import Image from "next/image";
import { ShoppingCart, MapPin } from "lucide-react";
import { useCartStore } from "@/store/cart";
import { cn } from "@/lib/utils";

export function Navbar() {
  const itemCount            = useCartStore((s) => s.itemCount());
  const pendingOrder         = useCartStore((s) => s.pendingOrder);
  const billAwaitingConfirm  = useCartStore((s) => s.billAwaitingConfirm);
  const tenantSlug           = useCartStore((s) => s.tenantSlug);
  const tableId              = useCartStore((s) => s.tableId);

  // Lock all nav links to the relevant waiting screen
  const guardedHref = (dest: string) => {
    if (pendingOrder) return "/checkout";
    if (billAwaitingConfirm && tenantSlug && tableId) return `/restaurants/${tenantSlug}/${tableId}`;
    return dest;
  };

  return (
    <header className="sticky top-0 z-50 bg-white/90 backdrop-blur-md border-b border-stone-100 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          <Link
            href={guardedHref("/")}
            className="flex items-center gap-2.5 font-bold text-xl text-stone-900 hover:opacity-80 transition-opacity"
          >
            <Image src="/logo-icon.svg" alt="Magic Tables" width={36} height={36} className="flex-shrink-0" />
            <span className="hidden sm:block">Magic Tables</span>
          </Link>

          <nav className="flex items-center gap-1">
            <Link
              href={guardedHref("/")}
              className="hidden sm:flex items-center gap-1.5 px-3 py-2 text-sm text-stone-600 hover:text-stone-900 hover:bg-stone-100 rounded-lg transition-all duration-150"
            >
              <MapPin className="w-4 h-4" />
              Explore
            </Link>

            <Link
              href="/checkout"
              className={cn(
                "relative flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-150 cursor-pointer",
                itemCount > 0
                  ? "bg-rose-600 text-white hover:bg-rose-700 shadow-sm"
                  : "text-stone-500 hover:bg-stone-100"
              )}
              aria-label={`Cart with ${itemCount} items`}
            >
              <ShoppingCart className="w-4 h-4" />
              <span className="hidden sm:block">Cart</span>
              {itemCount > 0 && (
                <span className="flex items-center justify-center w-5 h-5 text-xs font-bold bg-white text-rose-600 rounded-full">
                  {itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>
      </div>
    </header>
  );
}
