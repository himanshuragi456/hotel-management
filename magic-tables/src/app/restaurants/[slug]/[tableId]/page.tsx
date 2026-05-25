"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Tag, AlertCircle, Clock, CheckCircle2, ChefHat, Hash, Bell, Receipt } from "lucide-react";
import { MenuItemCard } from "@/components/order/menu-item-card";
import { CartBar } from "@/components/order/cart-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useMenu, useTables, useMyOrders } from "@/hooks/useRestaurants";
import { useCartStore } from "@/store/cart";
import { tableApi } from "@/services/api";
import { formatCurrency } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function MenuPage() {
  const { slug, tableId } = useParams<{ slug: string; tableId: string }>();
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [waiterCalled, setWaiterCalled] = useState(false);
  const [waiterCalling, setWaiterCalling] = useState(false);
  const [billRequested, setBillRequested] = useState(false);
  const [billRequesting, setBillRequesting] = useState(false);
  const { clearCart, _hasHydrated, tableId: cartTableId, customerPhone, sessionStartedAt } = useCartStore();
  const { data: myOrders = [] } = useMyOrders(slug, cartTableId, customerPhone);

  const { data: menuData, isLoading: loadingMenu, isError: menuError } = useMenu(slug);
  const { data: tables = [], isLoading: loadingTables, dataUpdatedAt: tablesUpdatedAt } = useTables(slug);

  const restaurant = menuData?.tenant ?? null;
  const categories = menuData?.categories ?? [];
  const table = tables.find((t) => t.id === Number(tableId)) ?? null;

  const displayCategories = activeCategory
    ? categories.filter((c) => c.id === activeCategory)
    : categories;

  const isLoading = loadingMenu || loadingTables;

  const allServed = myOrders.length > 0 && myOrders.every((o) => o.status === "served" || o.status === "cancelled");
  const unpaidTotal = myOrders.filter((o) => o.payment_status !== "paid" && o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);

  const handleCallWaiter = useCallback(async () => {
    if (!cartTableId || waiterCalled || waiterCalling) return;
    setWaiterCalling(true);
    try {
      await tableApi.callWaiter(slug, cartTableId);
      setWaiterCalled(true);
      setTimeout(() => setWaiterCalled(false), 60_000);
    } finally {
      setWaiterCalling(false);
    }
  }, [slug, cartTableId, waiterCalled, waiterCalling]);

  const handleRequestBill = useCallback(async () => {
    if (!cartTableId || billRequested || billRequesting) return;
    setBillRequesting(true);
    try {
      await tableApi.requestBill(slug, cartTableId);
      setBillRequested(true);
    } finally {
      setBillRequesting(false);
    }
  }, [slug, cartTableId, billRequested, billRequesting]);

  useEffect(() => {
    if (!_hasHydrated || loadingTables) return;
    if (!customerPhone || cartTableId !== Number(tableId)) return;

    const currentTable = tables.find((t) => t.id === Number(tableId));
    if (!currentTable) return;

    // Only act on tables data that was fetched AFTER the session began.
    // This prevents stale pre-payment poll data from triggering a false redirect.
    if (sessionStartedAt && tablesUpdatedAt < sessionStartedAt) return;

    // Only redirect when the table is explicitly freed by billing.
    // reserved_by_phone becomes null once all orders are served (activeOrder
    // excludes served), so we can't rely on it alone — table.status === 'free'
    // is the definitive signal that billing has closed the table.
    if (currentTable.status === "free") {
      clearCart();
      router.replace("/goodbye");
    }
  }, [tables, loadingTables, tablesUpdatedAt, _hasHydrated, customerPhone, cartTableId, tableId, sessionStartedAt, clearCart, router]);

  if (!isLoading && (!restaurant || !table)) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-500 mb-4">Table or restaurant not found.</p>
        <button onClick={() => router.back()} className="text-rose-600 text-sm underline cursor-pointer">
          Go back
        </button>
      </div>
    );
  }

  return (
    <main className="pb-40">
      {/* Sticky header */}
      <div className="sticky top-16 z-30 bg-white/95 backdrop-blur-md border-b border-stone-100 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center gap-4 py-3">
            <button
              onClick={() => router.back()}
              className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-all duration-150 cursor-pointer"
              aria-label="Go back"
            >
              <ArrowLeft className="w-5 h-5" />
            </button>
            <div className="flex-1 min-w-0">
              {isLoading ? (
                <Skeleton className="h-5 w-40" />
              ) : (
                <>
                  <h1 className="font-semibold text-stone-900 truncate">{restaurant?.name}</h1>
                  <p className="text-xs text-stone-500">
                    Table {table?.table_number} · {table?.capacity} seats · {table?.floor}
                  </p>
                </>
              )}
            </div>
          </div>

          {/* Category tabs */}
          {!isLoading && categories.length > 0 && (
            <div className="flex gap-2 overflow-x-auto pb-3 scrollbar-none" role="tablist" aria-label="Menu categories">
              <button
                role="tab"
                aria-selected={activeCategory === null}
                onClick={() => setActiveCategory(null)}
                className={cn(
                  "flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer",
                  activeCategory === null ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                )}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={activeCategory === cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex-shrink-0 px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-150 cursor-pointer",
                    activeCategory === cat.id ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-10">
        {/* Closed banner */}
        {!isLoading && restaurant && !restaurant.is_open && (
          <div className="flex items-center gap-3 bg-stone-900 rounded-2xl px-4 py-4">
            <div className="w-9 h-9 rounded-xl bg-stone-700 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="w-4 h-4 text-stone-300" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-semibold text-white">We're currently closed</p>
              <p className="text-xs text-stone-400">New orders are not being accepted right now. Check back soon!</p>
            </div>
          </div>
        )}

        {/* Table info banner */}
        {!isLoading && table && (
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <Tag className="w-4 h-4 text-rose-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">
                Ordering for Table {table.table_number}
              </p>
              <p className="text-xs text-stone-500">
                Payment is required to confirm your order — it goes to the kitchen after payment
              </p>
            </div>
          </div>
        )}

        {/* Active orders */}
        {myOrders.length > 0 && (() => {
          const paidTotal    = myOrders.filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.total), 0);
          const unpaidTotal  = myOrders.filter(o => o.payment_status !== "paid").reduce((s, o) => s + Number(o.total), 0);
          return (
            <section aria-labelledby="my-orders-heading">
              <h2 id="my-orders-heading" className="text-base font-bold text-stone-900 mb-3">Your Orders</h2>
              <div className="space-y-3">
                {myOrders.map((order) => {
                  const isPaid = order.payment_status === "paid";
                  const statusConfig = {
                    pending:   { label: "Waiting",   icon: Clock,         color: "text-amber-600",   bg: "bg-amber-50  border-amber-200"   },
                    preparing: { label: "Preparing",  icon: ChefHat,       color: "text-blue-600",    bg: "bg-blue-50   border-blue-200"    },
                    ready:     { label: "Ready!",     icon: CheckCircle2,  color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
                    served:    { label: "Served",     icon: CheckCircle2,  color: "text-stone-400",   bg: "bg-stone-50  border-stone-200"   },
                    cancelled: { label: "Cancelled",  icon: AlertCircle,   color: "text-red-500",     bg: "bg-red-50    border-red-200"     },
                  }[order.status] ?? { label: order.status, icon: Clock, color: "text-stone-500", bg: "bg-stone-50 border-stone-200" };
                  const StatusIcon = statusConfig.icon;
                  return (
                    <div key={order.id} className={`rounded-2xl border p-4 ${statusConfig.bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1.5 text-xs text-stone-400 font-mono">
                            <Hash className="w-3 h-3" />{order.order_number}
                          </span>
                          {order.source !== "magic_tables" && (
                            <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">
                              Added by staff
                            </span>
                          )}
                          {isPaid ? (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">
                              Paid
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200">
                              Unpaid
                            </span>
                          )}
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-semibold ${statusConfig.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />
                          {statusConfig.label}
                        </span>
                      </div>

                      {/* Queue position — only for pending/preparing */}
                      {order.queue_position != null && (
                        <div className={cn(
                          "flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-xs font-medium",
                          order.status === "preparing"
                            ? "bg-blue-100 text-blue-700"
                            : order.queue_position === 1
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700"
                        )}>
                          <ChefHat className="w-3.5 h-3.5 shrink-0" />
                          {order.status === "preparing"
                            ? "Being prepared in the kitchen"
                            : order.queue_position === 1
                            ? "Your order is next in the kitchen!"
                            : `#${order.queue_position} in the kitchen queue`}
                        </div>
                      )}

                      <div className="space-y-0.5 text-xs text-stone-600">
                        {order.items.map((item, i) => (
                          <div key={i} className="flex justify-between">
                            <span>{item.quantity}× {item.name}</span>
                            <span className="tabular-nums">{formatCurrency(item.subtotal)}</span>
                          </div>
                        ))}
                      </div>
                      <div className="flex justify-between text-xs font-semibold text-stone-800 border-t border-stone-200 mt-2 pt-2">
                        <span>{isPaid ? "Paid online" : "To be paid at counter"}</span>
                        <span className="tabular-nums">{formatCurrency(order.total)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Visit summary */}
              <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                <div className="flex justify-between text-xs text-stone-500">
                  <span>Paid online</span>
                  <span className="tabular-nums text-emerald-600 font-medium">{formatCurrency(paidTotal)}</span>
                </div>
                {unpaidTotal > 0 && (
                  <div className="flex justify-between text-xs text-stone-500">
                    <span>To pay at counter</span>
                    <span className="tabular-nums text-rose-600 font-medium">{formatCurrency(unpaidTotal)}</span>
                  </div>
                )}
                <div className="flex justify-between text-sm font-bold text-stone-900 border-t border-stone-100 pt-2">
                  <span>Total this visit</span>
                  <span className="tabular-nums">{formatCurrency(paidTotal + unpaidTotal)}</span>
                </div>
              </div>

              {/* Action buttons */}
              <div className="mt-3 flex gap-2">
                {/* Call Waiter — always available during session */}
                <button
                  onClick={handleCallWaiter}
                  disabled={waiterCalled || waiterCalling}
                  className={cn(
                    "flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all",
                    waiterCalled
                      ? "bg-amber-50 border border-amber-200 text-amber-700 cursor-default"
                      : "bg-stone-100 text-stone-700 hover:bg-stone-200"
                  )}
                >
                  <Bell className="w-4 h-4" />
                  {waiterCalled ? "Waiter called!" : waiterCalling ? "Calling…" : "Call Waiter"}
                </button>

                {/* Request Bill — only when all served AND unpaid balance > 0 */}
                {allServed && unpaidTotal > 0 && (
                  <button
                    onClick={handleRequestBill}
                    disabled={billRequested || billRequesting}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all",
                      billRequested
                        ? "bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default"
                        : "bg-stone-900 text-white hover:bg-stone-800"
                    )}
                  >
                    <Receipt className="w-4 h-4" />
                    {billRequested ? "Bill requested!" : billRequesting ? "Requesting…" : "Request Bill"}
                  </button>
                )}
              </div>
            </section>
          );
        })()}

        {menuError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            Could not load the menu. Please try again.
          </div>
        )}

        {/* Skeleton loading */}
        {isLoading && (
          <div className="space-y-8">
            {Array.from({ length: 2 }).map((_, si) => (
              <div key={si} className="space-y-3">
                <Skeleton className="h-6 w-32" />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28" />)}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Menu categories */}
        {!isLoading && restaurant && table && displayCategories.map((category) => (
          <section key={category.id} aria-labelledby={`cat-${category.id}`}>
            <h2
              id={`cat-${category.id}`}
              className="text-lg font-bold text-stone-900 mb-4 flex items-center gap-2"
            >
              {category.name}
              <Badge variant="outline" className="text-xs font-normal">
                {category.items.filter((i) => i.is_available).length} items
              </Badge>
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {category.items.map((item) => (
                <MenuItemCard
                  key={item.id}
                  item={item}
                  restaurant={restaurant}
                  table={table}
                />
              ))}
            </div>
          </section>
        ))}
      </div>

      <CartBar isOpen={restaurant?.is_open ?? true} />
    </main>
  );
}
