import { useState, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Tag, AlertCircle, Clock, CheckCircle2, ChefHat, Hash, Bell, Receipt, CreditCard, Copy, X, RefreshCw } from "lucide-react";
import { MenuItemCard } from "@/components/order/menu-item-card";
import { CartBar } from "@/components/order/cart-bar";
import { Skeleton } from "@/components/ui/skeleton";
import { useMenu, useTables, useMyOrders } from "@/hooks/useRestaurants";
import { useCartStore } from "@/store/cart";
import { tableApi } from "@/services/api";
import { formatCurrency, cn } from "@/lib/utils";
import { QRCodeSVG } from "qrcode.react";

export default function MenuPage() {
  const { slug, tableId } = useParams<{ slug: string; tableId: string }>();
  const navigate = useNavigate();
  const [activeCategory, setActiveCategory] = useState<number | null>(null);
  const [activeSubcategory, setActiveSubcategory] = useState<number | null>(null);
  const [waiterCalling, setWaiterCalling] = useState(false);
  const [billRequesting, setBillRequesting] = useState(false);
  const [payBillStep, setPayBillStep] = useState<"closed" | "qr">("closed");
  const [notifying, setNotifying] = useState(false);
  const [notifyError, setNotifyError] = useState("");
  const [upiCopied, setUpiCopied] = useState(false);

  const { clearCart, _hasHydrated, tableId: cartTableId, customerPhone, sessionStartedAt, isTableLocked, tenantSlug: lockedSlug, setBillAwaitingConfirm } = useCartStore();
  const locked = _hasHydrated && isTableLocked();
  const { data: myOrders = [], isFetched: ordersFetched } = useMyOrders(slug!, cartTableId, customerPhone);

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isTableLocked()) return;
    if (lockedSlug !== slug || cartTableId !== Number(tableId)) {
      navigate(`/restaurants/${lockedSlug}/${cartTableId}`, { replace: true });
    }
  }, [_hasHydrated, isTableLocked, lockedSlug, slug, cartTableId, tableId, navigate]);

  const { data: menuData, isLoading: loadingMenu, isError: menuError } = useMenu(slug!);
  const { data: tables = [], isLoading: loadingTables, dataUpdatedAt: tablesUpdatedAt } = useTables(slug!, locked ? 8_000 : 30_000);

  const [hadOrders, setHadOrders] = useState(false);
  useEffect(() => { if (myOrders.length > 0) setHadOrders(true); }, [myOrders.length]);

  useEffect(() => {
    if (!locked || !ordersFetched || !hadOrders) return;
    if (myOrders.length === 0) { clearCart(); navigate("/goodbye", { replace: true }); }
  }, [locked, ordersFetched, hadOrders, myOrders.length, clearCart, navigate]);

  const restaurant = menuData?.tenant ?? null;
  const categories = menuData?.categories ?? [];
  const table = tables.find((t) => t.id === Number(tableId)) ?? null;
  const isLoading = loadingMenu || loadingTables;

  const activeCatId = activeCategory ?? categories[0]?.id ?? null;
  const activeCatData = categories.find((c) => c.id === activeCatId) ?? null;
  const activeSubData = activeSubcategory ? activeCatData?.subcategories?.find((s) => s.id === activeSubcategory) ?? null : null;

  // Items to show: if subcategory selected → that sub's items; else category direct items
  const displayedItems = activeSubData
    ? activeSubData.items
    : activeCatData?.items ?? [];

  const allServed = myOrders.length > 0 && myOrders.every((o) => o.status === "served" || o.status === "cancelled");
  const unpaidTotal = myOrders.filter((o) => o.payment_status !== "paid" && o.status !== "cancelled").reduce((s, o) => s + Number(o.total), 0);

  const now = Date.now();
  const waiterCalled  = !!table?.waiter_called_at  && (now - new Date(table.waiter_called_at).getTime())  < 20_000;
  const billRequested = !!table?.bill_requested_at && (now - new Date(table.bill_requested_at).getTime()) < 30_000;
  const awaitingBillConfirm = !!table?.bill_paid_at;

  const handleCallWaiter = useCallback(async () => {
    if (!cartTableId || waiterCalled || waiterCalling) return;
    setWaiterCalling(true);
    try { await tableApi.callWaiter(slug!, cartTableId); } finally { setWaiterCalling(false); }
  }, [slug, cartTableId, waiterCalled, waiterCalling]);

  const handleRequestBill = useCallback(async () => {
    if (!cartTableId || billRequested || billRequesting) return;
    setBillRequesting(true);
    try { await tableApi.requestBill(slug!, cartTableId); } finally { setBillRequesting(false); }
  }, [slug, cartTableId, billRequested, billRequesting]);

  const handleNotifyPaid = useCallback(async () => {
    if (!cartTableId || !customerPhone) return;
    setNotifying(true);
    setNotifyError("");
    try {
      await tableApi.notifyBillPaid(slug!, cartTableId, customerPhone, unpaidTotal);
      setPayBillStep("closed");
      setBillAwaitingConfirm(true);
    } catch (err: unknown) {
      setNotifyError((err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Could not notify counter. Please call the waiter.");
    } finally { setNotifying(false); }
  }, [slug, cartTableId, customerPhone, unpaidTotal, setBillAwaitingConfirm]);

  useEffect(() => {
    if (!_hasHydrated || loadingTables) return;
    if (!customerPhone || cartTableId !== Number(tableId)) return;
    const currentTable = tables.find((t) => t.id === Number(tableId));
    if (!currentTable) return;
    if (sessionStartedAt && tablesUpdatedAt < sessionStartedAt) return;
    if (currentTable.status === "free") { clearCart(); navigate("/goodbye", { replace: true }); }
  }, [tables, loadingTables, tablesUpdatedAt, _hasHydrated, customerPhone, cartTableId, tableId, sessionStartedAt, clearCart, navigate]);

  useEffect(() => {
    setBillAwaitingConfirm(awaitingBillConfirm);
    return () => setBillAwaitingConfirm(false);
  }, [awaitingBillConfirm, setBillAwaitingConfirm]);

  useEffect(() => {
    if (!awaitingBillConfirm) return;
    window.history.pushState({ awaitingBill: true }, "");
    const onPopState = () => window.history.pushState({ awaitingBill: true }, "");
    const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); };
    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => { window.removeEventListener("popstate", onPopState); window.removeEventListener("beforeunload", onBeforeUnload); };
  }, [awaitingBillConfirm]);

  if (!isLoading && (!restaurant || !table)) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <AlertCircle className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-500 mb-4">Table or restaurant not found.</p>
        <button onClick={() => navigate(-1)} className="text-rose-600 text-sm underline cursor-pointer">Go back</button>
      </div>
    );
  }

  if (awaitingBillConfirm) {
    return (
      <main className="min-h-[80dvh] flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 rounded-full bg-amber-100 flex items-center justify-center mb-6">
          <Clock className="w-10 h-10 text-amber-500 animate-pulse" aria-hidden="true" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Awaiting Payment Confirmation</h1>
        <p className="text-stone-500 text-sm mb-6 max-w-xs leading-relaxed">The billing counter is verifying your payment. Please wait — your table will be closed shortly.</p>
        <div className="w-full max-w-xs bg-amber-50 border border-amber-200 rounded-2xl px-5 py-4 mb-8">
          <p className="text-sm font-semibold text-amber-900 mb-1">Table {table?.table_number}</p>
          <p className="text-xs text-amber-700">Keep your UPI payment screenshot ready if the counter asks.</p>
        </div>
        <div className="flex items-center gap-2 text-xs text-stone-400">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Checking every 8 seconds…
        </div>
      </main>
    );
  }

  return (
    <main className="pb-40">
      <div className="sticky top-16 z-30 bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Restaurant + table info row */}
          <div className="flex items-center gap-3 py-3">
            {!(_hasHydrated && isTableLocked()) && (
              <button onClick={() => navigate(-1)} className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-all duration-150 cursor-pointer" aria-label="Go back">
                <ArrowLeft className="w-5 h-5" />
              </button>
            )}
            <div className="flex-1 min-w-0">
              {isLoading ? <Skeleton className="h-5 w-40" /> : (
                <>
                  <h1 className="font-semibold text-stone-900 truncate">{restaurant?.name}</h1>
                  <p className="text-xs text-stone-500">Table {table?.table_number} · {table?.capacity} seats{table?.floor ? ` · ${table.floor}` : ""}</p>
                </>
              )}
            </div>
          </div>

          {/* Category tabs — underline style, same as QR menu */}
          {!isLoading && categories.length > 0 && (
            <div className="flex gap-0 overflow-x-auto border-b border-stone-100 scrollbar-none -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8" role="tablist" aria-label="Menu categories">
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  role="tab"
                  aria-selected={activeCatId === cat.id}
                  onClick={() => { setActiveCategory(cat.id); setActiveSubcategory(null); }}
                  className={cn(
                    "flex-shrink-0 px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors cursor-pointer",
                    activeCatId === cat.id
                      ? "border-rose-500 text-rose-600 font-semibold"
                      : "border-transparent text-stone-500 hover:text-stone-800"
                  )}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          )}

          {/* Subcategory pills — shown when active category has subcategories */}
          {!isLoading && (activeCatData?.subcategories?.length ?? 0) > 0 && (
            <div className="flex gap-2 py-2.5 overflow-x-auto scrollbar-none -mx-4 sm:-mx-6 lg:-mx-8 px-4 sm:px-6 lg:px-8">
              <button
                onClick={() => setActiveSubcategory(null)}
                className={cn(
                  "flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-full border transition-colors cursor-pointer",
                  activeSubcategory === null
                    ? "bg-rose-500 text-white border-rose-500"
                    : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                )}
              >
                All
              </button>
              {activeCatData!.subcategories!.map((sub) => (
                <button
                  key={sub.id}
                  onClick={() => setActiveSubcategory(sub.id)}
                  className={cn(
                    "flex-shrink-0 px-4 py-1.5 text-sm font-medium rounded-full border transition-colors cursor-pointer",
                    activeSubcategory === sub.id
                      ? "bg-rose-500 text-white border-rose-500"
                      : "bg-white text-stone-600 border-stone-200 hover:border-stone-300"
                  )}
                >
                  {sub.name}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6 space-y-10">
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

        {!isLoading && table && (
          <div className="flex items-center gap-3 bg-rose-50 border border-rose-100 rounded-2xl px-4 py-3">
            <div className="w-9 h-9 rounded-xl bg-rose-100 flex items-center justify-center flex-shrink-0">
              <Tag className="w-4 h-4 text-rose-600" aria-hidden="true" />
            </div>
            <div>
              <p className="text-sm font-medium text-stone-900">Ordering for Table {table.table_number}</p>
              <p className="text-xs text-stone-500">Payment is required to confirm your order — it goes to the kitchen after payment</p>
            </div>
          </div>
        )}

        {myOrders.length > 0 && (() => {
          const paidTotal   = myOrders.filter(o => o.payment_status === "paid").reduce((s, o) => s + Number(o.total), 0);
          const unpaidTotal = myOrders.filter(o => o.payment_status !== "paid").reduce((s, o) => s + Number(o.total), 0);
          return (
            <section aria-labelledby="my-orders-heading">
              <h2 id="my-orders-heading" className="text-base font-bold text-stone-900 mb-3">Your Orders</h2>
              <div className="space-y-3">
                {myOrders.map((order) => {
                  const isPaid = order.payment_status === "paid";
                  const statusConfig = {
                    pending:   { label: "Waiting",   icon: Clock,        color: "text-amber-600",   bg: "bg-amber-50  border-amber-200"   },
                    preparing: { label: "Preparing", icon: ChefHat,      color: "text-blue-600",    bg: "bg-blue-50   border-blue-200"    },
                    ready:     { label: "Ready!",    icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50 border-emerald-200" },
                    served:    { label: "Served",    icon: CheckCircle2, color: "text-stone-400",   bg: "bg-stone-50  border-stone-200"   },
                    cancelled: { label: "Cancelled", icon: AlertCircle,  color: "text-red-500",     bg: "bg-red-50    border-red-200"     },
                  }[order.status] ?? { label: order.status, icon: Clock, color: "text-stone-500", bg: "bg-stone-50 border-stone-200" };
                  const StatusIcon = statusConfig.icon;
                  return (
                    <div key={order.id} className={`rounded-2xl border p-4 ${statusConfig.bg}`}>
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="flex items-center gap-1.5 text-xs text-stone-400 font-mono"><Hash className="w-3 h-3" />{order.order_number}</span>
                          {order.source !== "magic_tables" && <span className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-stone-100 text-stone-500 border border-stone-200">Added by staff</span>}
                          {isPaid
                            ? <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-100 text-emerald-700 border border-emerald-200">Paid</span>
                            : <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-rose-100 text-rose-600 border border-rose-200">Unpaid</span>}
                        </div>
                        <span className={`flex items-center gap-1 text-xs font-semibold ${statusConfig.color}`}>
                          <StatusIcon className="w-3.5 h-3.5" />{statusConfig.label}
                        </span>
                      </div>
                      {order.queue_position != null && (
                        <div className={cn("flex items-center gap-2 rounded-xl px-3 py-2 mb-3 text-xs font-medium",
                          order.status === "preparing" ? "bg-blue-100 text-blue-700"
                            : order.queue_position === 1 ? "bg-emerald-100 text-emerald-700"
                            : "bg-amber-100 text-amber-700")}>
                          <ChefHat className="w-3.5 h-3.5 shrink-0" />
                          {order.status === "preparing" ? "Being prepared in the kitchen"
                            : order.queue_position === 1 ? "Your order is next in the kitchen!"
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
              <div className="mt-4 rounded-2xl border border-stone-200 bg-white p-4 space-y-2">
                <div className="flex justify-between text-xs text-stone-500"><span>Paid online</span><span className="tabular-nums text-emerald-600 font-medium">{formatCurrency(paidTotal)}</span></div>
                {unpaidTotal > 0 && <div className="flex justify-between text-xs text-stone-500"><span>To pay at counter</span><span className="tabular-nums text-rose-600 font-medium">{formatCurrency(unpaidTotal)}</span></div>}
                <div className="flex justify-between text-sm font-bold text-stone-900 border-t border-stone-100 pt-2"><span>Total this visit</span><span className="tabular-nums">{formatCurrency(paidTotal + unpaidTotal)}</span></div>
              </div>
              <div className="mt-3 flex gap-2">
                <button onClick={handleCallWaiter} disabled={waiterCalled || waiterCalling}
                  className={cn("flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all",
                    waiterCalled ? "bg-amber-50 border border-amber-200 text-amber-700 cursor-default" : "bg-stone-100 text-stone-700 hover:bg-stone-200")}>
                  <Bell className="w-4 h-4" />
                  {waiterCalled ? "Waiter called!" : waiterCalling ? "Calling…" : "Call Waiter"}
                </button>
                {allServed && unpaidTotal > 0 && (
                  <>
                    {restaurant?.upi_id && (
                      awaitingBillConfirm ? (
                        <button disabled className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold bg-amber-50 border border-amber-200 text-amber-700 cursor-default">
                          <Clock className="w-4 h-4 animate-pulse" />Awaiting confirmation…
                        </button>
                      ) : (
                        <button onClick={() => { setPayBillStep("qr"); setNotifyError(""); }}
                          className="flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold bg-rose-600 text-white hover:bg-rose-700 transition-all">
                          <CreditCard className="w-4 h-4" />Pay Bill
                        </button>
                      )
                    )}
                    <button onClick={handleRequestBill} disabled={billRequested || billRequesting}
                      className={cn("flex-1 flex items-center justify-center gap-2 rounded-2xl py-3 text-sm font-semibold transition-all",
                        billRequested ? "bg-emerald-50 border border-emerald-200 text-emerald-700 cursor-default" : "bg-stone-100 text-stone-700 hover:bg-stone-200")}>
                      <Receipt className="w-4 h-4" />
                      {billRequested ? "Requested!" : billRequesting ? "Requesting…" : "Request Bill"}
                    </button>
                  </>
                )}
              </div>
            </section>
          );
        })()}

        {menuError && (
          <div className="flex items-center gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-700">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />Could not load the menu. Please try again.
          </div>
        )}

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

        {!isLoading && restaurant && table && (
          <>
            {/* Direct items in the active category (when no subcategory filter) */}
            {activeSubcategory === null && displayedItems.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayedItems.filter((i) => i.is_available || true).map((item) => (
                  <MenuItemCard key={item.id} item={item} restaurant={restaurant} table={table} />
                ))}
              </div>
            )}

            {/* Subcategory filter selected — show only that sub's items */}
            {activeSubcategory !== null && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {displayedItems.map((item) => (
                  <MenuItemCard key={item.id} item={item} restaurant={restaurant} table={table} />
                ))}
                {displayedItems.length === 0 && (
                  <p className="col-span-2 text-center text-stone-400 py-12">No items in this subcategory</p>
                )}
              </div>
            )}

            {/* When "All" subcategory selected, also render subcategory sections inline */}
            {activeSubcategory === null && (activeCatData?.subcategories?.length ?? 0) > 0 && (
              <div className="space-y-8 mt-6">
                {activeCatData!.subcategories!.filter((s) => s.items?.length > 0).map((sub) => (
                  <section key={sub.id}>
                    <h3 className="text-sm font-semibold text-stone-500 uppercase tracking-wide mb-3">{sub.name}</h3>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      {sub.items.map((item) => (
                        <MenuItemCard key={item.id} item={item} restaurant={restaurant} table={table} />
                      ))}
                    </div>
                  </section>
                ))}
              </div>
            )}

            {displayedItems.length === 0 && (activeCatData?.subcategories?.length ?? 0) === 0 && (
              <p className="text-center text-stone-400 py-12">No items in this category</p>
            )}
          </>
        )}
      </div>

      <CartBar isOpen={restaurant?.is_open ?? true} />

      {payBillStep !== "closed" && restaurant?.upi_id && (() => {
        const upiLink = `upi://pay?pa=${restaurant.upi_id}&am=${unpaidTotal}&cu=INR&tn=Table+${table?.table_number ?? ""}`;
        const deepLinks = {
          phonepe: upiLink.replace("upi://", "phonepe://"),
          gpay:    upiLink.replace("upi://pay", "tez://upi/pay"),
          paytm:   upiLink.replace("upi://", "paytmmp://"),
        };
        return (
          <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setPayBillStep("closed")} />
            <div className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-5 pb-10 shadow-2xl">
              <div className="w-10 h-1 rounded-full bg-stone-200 mx-auto mb-5" aria-hidden="true" />
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-bold text-stone-900">Pay Your Bill</h2>
                  <p className="text-xs text-stone-400 mt-0.5">Scan or open your UPI app to pay</p>
                </div>
                <button onClick={() => setPayBillStep("closed")} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200" aria-label="Close">
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="bg-stone-50 border border-stone-200 rounded-2xl px-5 py-3 flex items-center justify-between mb-5">
                <span className="text-sm text-stone-500">Amount to pay</span>
                <span className="text-xl font-bold text-stone-900">{formatCurrency(unpaidTotal)}</span>
              </div>
              <div className="flex items-start gap-2.5 bg-red-50 border border-red-200 rounded-2xl px-4 py-3 mb-4">
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <p className="text-sm text-red-700 leading-snug">After making payment, <span className="font-semibold">please come back here and tap "Done — Notify Counter"</span> so we can close your table.</p>
              </div>
              <div className="flex flex-col items-center bg-white border border-stone-200 rounded-2xl p-5 mb-4">
                <p className="text-xs text-stone-400 font-medium mb-3 uppercase tracking-wide">Scan to Pay · {restaurant.name}</p>
                <div className="p-3 rounded-xl border border-stone-100 shadow-sm mb-4">
                  <QRCodeSVG value={upiLink} size={180} level="M" includeMargin={false} />
                </div>
                <button
                  onClick={() => { navigator.clipboard.writeText(restaurant.upi_id!).then(() => { setUpiCopied(true); setTimeout(() => setUpiCopied(false), 2000); }); }}
                  className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm font-mono text-stone-700 hover:bg-stone-100 transition-colors"
                >
                  {restaurant.upi_id}
                  {upiCopied ? <CheckCircle2 className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-stone-400" />}
                </button>
              </div>
              <div className="grid grid-cols-3 gap-3 mb-5">
                <a href={deepLinks.phonepe} className="flex flex-col items-center gap-2 bg-white border border-stone-200 rounded-2xl px-3 py-3 hover:border-[#5f259f] hover:bg-purple-50 active:scale-95 transition-all shadow-sm">
                  <img src="/phonepelogo.png" alt="PhonePe" className="w-9 h-9 object-contain" />
                  <span className="text-xs font-semibold text-stone-700">PhonePe</span>
                </a>
                <a href={deepLinks.gpay} className="flex flex-col items-center gap-2 bg-white border border-stone-200 rounded-2xl px-3 py-3 hover:border-[#4285f4] hover:bg-blue-50 active:scale-95 transition-all shadow-sm">
                  <img src="/gpaylogo.svg" alt="Google Pay" className="w-9 h-9 object-contain" />
                  <span className="text-xs font-semibold text-stone-700">GPay</span>
                </a>
                <a href={deepLinks.paytm} className="flex flex-col items-center gap-2 bg-white border border-stone-200 rounded-2xl px-3 py-3 hover:border-[#00BAF2] hover:bg-sky-50 active:scale-95 transition-all shadow-sm">
                  <img src="/paytmlogo.webp" alt="Paytm" className="w-9 h-9 object-contain" />
                  <span className="text-xs font-semibold text-stone-700">Paytm</span>
                </a>
              </div>
              {notifyError && (
                <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4 text-sm text-red-700">
                  <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />{notifyError}
                </div>
              )}
              <button onClick={handleNotifyPaid} disabled={notifying} className="w-full bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white font-bold py-3.5 rounded-2xl text-sm transition-colors">
                {notifying ? "Notifying…" : "✓ Done — Notify Counter"}
              </button>
            </div>
          </div>
        );
      })()}
    </main>
  );
}
