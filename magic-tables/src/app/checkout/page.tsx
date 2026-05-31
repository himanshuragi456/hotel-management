"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Minus, Plus, Trash2, CreditCard,
  ShoppingBag, User, AlertCircle, Clock, CheckCircle2,
  Smartphone, RefreshCw, Copy, Phone, XCircle,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { orderApi, type SubmitUpiOrderResponse } from "@/services/api";

// ─── Types ─────────────────────────────────────────────────────────────────────

type Phase = "form" | "upi-waiting" | "confirmed";

// ─── UPI QR Screen ─────────────────────────────────────────────────────────────

// How many poll ticks before we surface the "billing seems busy" nudge (5 min = 60 × 5 s)
const SLOW_NUDGE_AFTER = 60;

function UpiWaitingScreen({
  order,
  customerPhone,
  tenantSlug,
  tableId,
  grandTotal,
  activeContactPhone,
  onConfirmed,
  onCancelled,
}: {
  order: SubmitUpiOrderResponse;
  customerPhone: string;
  tenantSlug: string;
  tableId: number;
  grandTotal: number;
  activeContactPhone: string | null;
  onConfirmed: (orderNumbers: string) => void;
  onCancelled: () => void;
}) {
  const [copied, setCopied] = useState(false);
  const [pollCount, setPollCount] = useState(0);
  const [showCancelSheet, setShowCancelSheet] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [cancelError, setCancelError] = useState("");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const copyUpiId = () => {
    if (!order.upi_id) return;
    navigator.clipboard.writeText(order.upi_id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const upiDeepLinks = order.upi_link
    ? {
        phonepe: order.upi_link.replace("upi://", "phonepe://"),
        gpay:    order.upi_link.replace("upi://pay", "tez://upi/pay"),
        paytm:   order.upi_link.replace("upi://", "paytmmp://"),
      }
    : null;

  const poll = useCallback(async () => {
    try {
      const orders = await orderApi.pollPaymentStatus(tenantSlug, tableId, customerPhone);
      const thisOrder = orders.find((o) => o.order_number === order.order_number);
      if (thisOrder?.payment_status === "paid") {
        onConfirmed(order.order_number);
      }
    } catch {
      // silent — keep polling
    }
    setPollCount((c) => c + 1);
  }, [tenantSlug, tableId, customerPhone, order.order_number, onConfirmed]);

  useEffect(() => {
    intervalRef.current = setInterval(poll, 5000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [poll]);

  // Lock the screen — prevent back-button and tab-close navigation while awaiting payment
  useEffect(() => {
    // Push a dummy entry so the back button hits it instead of leaving
    window.history.pushState({ awaitingPayment: true }, "");

    const onPopState = () => {
      // User pressed back — push the dummy entry again to stay on this screen
      window.history.pushState({ awaitingPayment: true }, "");
      setShowCancelSheet(true); // surface the cancel sheet so they have a clear exit path
    };

    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };

    window.addEventListener("popstate", onPopState);
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => {
      window.removeEventListener("popstate", onPopState);
      window.removeEventListener("beforeunload", onBeforeUnload);
    };
  }, []);

  const handleCancel = async () => {
    setIsCancelling(true);
    setCancelError("");
    try {
      await orderApi.cancelOrder(tenantSlug, order.order_id, customerPhone);
      // Stop polling and let parent clean up cart + navigate away
      if (intervalRef.current) clearInterval(intervalRef.current);
      onCancelled();
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Could not cancel. Please speak to the restaurant staff.";
      setCancelError(msg);
    } finally {
      setIsCancelling(false);
    }
  };

  const hasUpi = !!order.upi_id && !!order.upi_link;
  const isSlow = pollCount >= SLOW_NUDGE_AFTER;

  return (
    <>
      <main className="max-w-md mx-auto px-4 py-8 pb-20">
        {/* Header */}
        <div className="text-center mb-6">
          <div className={`inline-flex items-center gap-2 text-xs font-semibold px-4 py-2 rounded-full mb-4 border ${
            isSlow
              ? "bg-orange-50 border-orange-200 text-orange-800"
              : "bg-amber-50 border-amber-200 text-amber-800"
          }`}>
            <Clock className="w-3.5 h-3.5" aria-hidden="true" />
            {isSlow ? "Taking longer than usual…" : "Awaiting payment confirmation"}
          </div>
          <h1 className="text-2xl font-bold text-stone-900 mb-1">Complete Your Payment</h1>
          <p className="text-stone-500 text-sm">
            Pay via UPI, then the restaurant will confirm and start your order.
          </p>
        </div>

        {/* Order summary pill */}
        <div className="bg-stone-100 rounded-2xl px-5 py-3 flex items-center justify-between mb-6">
          <span className="text-sm text-stone-600">
            Order <span className="font-semibold text-stone-900">{order.order_number}</span>
          </span>
          <span className="text-lg font-bold text-stone-900">{formatCurrency(order.total)}</span>
        </div>

        {/* Billing busy nudge — surfaces after 8 min */}
        {isSlow && (
          <div className="flex items-start gap-3 bg-orange-50 border border-orange-200 rounded-2xl px-4 py-4 mb-5" role="status">
            <AlertCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-orange-900 mb-0.5">Billing counter seems busy</p>
              <p className="text-xs text-orange-700 leading-relaxed">
                Your order is placed and waiting. Call the restaurant or leave — you can cancel below if you no longer want the order.
              </p>
            </div>
          </div>
        )}

        {hasUpi ? (
          <>
            {/* QR Code */}
            <div className="bg-white rounded-2xl border border-stone-200 p-6 flex flex-col items-center mb-4">
              <p className="text-xs text-stone-500 font-medium mb-4 uppercase tracking-wide">
                Scan to Pay · {order.tenant_name}
              </p>
              <div className="p-3 bg-white rounded-xl border border-stone-100 shadow-sm mb-4">
                <QRCodeSVG value={order.upi_link!} size={200} level="M" includeMargin={false} />
              </div>
              <div className="text-center">
                <p className="text-xs text-stone-400 mb-1">Paying to</p>
                <button
                  onClick={copyUpiId}
                  className="flex items-center gap-2 bg-stone-50 border border-stone-200 rounded-xl px-4 py-2 text-sm font-mono font-medium text-stone-800 hover:bg-stone-100 transition-colors"
                >
                  {order.upi_id}
                  {copied
                    ? <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    : <Copy className="w-4 h-4 text-stone-400" />
                  }
                </button>
              </div>
            </div>

            {/* UPI App deep-link buttons */}
            {upiDeepLinks && (
              <div className="mb-6">
                <p className="text-xs text-stone-500 text-center font-medium mb-3">Pay directly with your UPI app</p>
                <div className="grid grid-cols-3 gap-3">
                  <a href={upiDeepLinks.phonepe} className="flex flex-col items-center gap-2 bg-white border border-stone-200 rounded-2xl px-3 py-4 hover:border-[#5f259f] hover:bg-purple-50 active:scale-95 transition-all shadow-sm" aria-label="Pay with PhonePe">
                    <img src="/phonepelogo.png" alt="PhonePe" className="w-10 h-10 object-contain" />
                    <span className="text-xs font-semibold text-stone-700">PhonePe</span>
                  </a>
                  <a href={upiDeepLinks.gpay} className="flex flex-col items-center gap-2 bg-white border border-stone-200 rounded-2xl px-3 py-4 hover:border-[#4285f4] hover:bg-blue-50 active:scale-95 transition-all shadow-sm" aria-label="Pay with Google Pay">
                    <img src="/gpaylogo.svg" alt="Google Pay" className="w-10 h-10 object-contain" />
                    <span className="text-xs font-semibold text-stone-700">GPay</span>
                  </a>
                  <a href={upiDeepLinks.paytm} className="flex flex-col items-center gap-2 bg-white border border-stone-200 rounded-2xl px-3 py-4 hover:border-[#00BAF2] hover:bg-sky-50 active:scale-95 transition-all shadow-sm" aria-label="Pay with Paytm">
                    <img src="/paytmlogo.webp" alt="Paytm" className="w-10 h-10 object-contain" />
                    <span className="text-xs font-semibold text-stone-700">Paytm</span>
                  </a>
                </div>
              </div>
            )}
          </>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 mb-6 text-center">
            <Smartphone className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-sm font-semibold text-amber-900 mb-1">Pay at the counter</p>
            <p className="text-sm text-amber-700">
              Show your order number <span className="font-bold">{order.order_number}</span> to the billing counter and complete payment.
            </p>
          </div>
        )}

        {/* Call restaurant */}
        {activeContactPhone && (
          <a
            href={`tel:+91${activeContactPhone}`}
            className="flex items-center justify-center gap-2.5 w-full border border-stone-200 bg-white hover:bg-stone-50 active:scale-95 transition-all rounded-2xl px-4 py-3 mb-4 text-sm font-medium text-stone-700 shadow-sm"
          >
            <span className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
              <Phone className="w-4 h-4 text-rose-600" />
            </span>
            <span>Having trouble? <span className="font-semibold text-stone-900">Call the restaurant</span></span>
          </a>
        )}

        {/* Leave & Cancel */}
        <button
          onClick={() => setShowCancelSheet(true)}
          className="flex items-center justify-center gap-2 w-full text-sm text-stone-400 hover:text-red-500 py-3 transition-colors"
        >
          <XCircle className="w-4 h-4" />
          Leave &amp; cancel this order
        </button>

        {/* Polling status */}
        <div className="flex items-center justify-center gap-2 text-xs text-stone-400 mt-2">
          <RefreshCw className="w-3.5 h-3.5 animate-spin" aria-hidden="true" />
          Checking for confirmation every 5 s
          {pollCount > 0 && <span>· {pollCount}×</span>}
        </div>
      </main>

      {/* Cancel confirmation bottom sheet */}
      {showCancelSheet && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center"
          role="dialog"
          aria-modal="true"
          aria-label="Cancel order"
        >
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm"
            onClick={() => !isCancelling && setShowCancelSheet(false)}
          />

          {/* Sheet */}
          <div className="relative w-full max-w-md bg-white rounded-t-3xl px-6 pt-6 pb-10 shadow-2xl">
            {/* Drag handle */}
            <div className="w-10 h-1 rounded-full bg-stone-200 mx-auto mb-6" aria-hidden="true" />

            <div className="text-center mb-6">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <XCircle className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-stone-900 mb-2">Cancel this order?</h2>
              <p className="text-stone-500 text-sm leading-relaxed">
                Order <span className="font-semibold text-stone-800">{order.order_number}</span> for{" "}
                <span className="font-semibold text-stone-800">{formatCurrency(order.total)}</span> will be cancelled.
                If you already paid, speak to the restaurant for a refund.
              </p>
            </div>

            {cancelError && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 mb-4 text-sm text-red-700">
                <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {cancelError}
              </div>
            )}

            <div className="space-y-3">
              <button
                onClick={handleCancel}
                disabled={isCancelling}
                className="w-full bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-semibold py-3.5 rounded-2xl text-sm transition-colors"
              >
                {isCancelling ? "Cancelling…" : "Yes, cancel my order"}
              </button>
              <button
                onClick={() => { setShowCancelSheet(false); setCancelError(""); }}
                disabled={isCancelling}
                className="w-full border border-stone-200 text-stone-700 font-semibold py-3.5 rounded-2xl text-sm hover:bg-stone-50 transition-colors"
              >
                Keep waiting
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

// ─── Main Checkout Page ─────────────────────────────────────────────────────────

export default function CheckoutPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const {
    items, updateQuantity, removeItem, clearItems, setCustomer, setPendingOrder,
    subtotal, tenantName, tenantSlug, tableNumber, tableId, gstRate,
    customerName, customerPhone, activeContactPhone, pendingOrder, _hasHydrated, isTableLocked,
  } = useCartStore();

  const sessionLocked = _hasHydrated && isTableLocked();

  // Restore waiting screen after a refresh if an order was pending
  const [phase, setPhase] = useState<Phase>(() =>
    typeof window === "undefined" ? "form" : "form" // resolved below after hydration
  );
  const [submittedOrder, setSubmittedOrder] = useState<SubmitUpiOrderResponse | null>(null);

  // After store hydrates, check if we should jump back to upi-waiting
  useEffect(() => {
    if (_hasHydrated && pendingOrder && phase === "form") {
      setSubmittedOrder(pendingOrder);
      setPhase("upi-waiting");
    }
  }, [_hasHydrated]); // eslint-disable-line react-hooks/exhaustive-deps

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (_hasHydrated) {
      if (customerName) setName(customerName);
      if (customerPhone) setPhone(customerPhone);
    }
  }, [_hasHydrated, customerName, customerPhone]);

  // When locked, always use the stored values — don't let local state drift
  const effectiveName  = sessionLocked ? customerName  : name;
  const effectivePhone = sessionLocked ? customerPhone : phone;

  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const sub = subtotal();
  const gst = Math.round(sub * (gstRate / 100));
  const grandTotal = sub + gst;

  const maxPrepTime = items.reduce((max, { menuItem }) => {
    if (menuItem.is_ready_made || !menuItem.prep_time_minutes) return max;
    return Math.max(max, menuItem.prep_time_minutes);
  }, 0);

  function validate() {
    if (sessionLocked) return true;
    let valid = true;
    if (!name.trim()) { setNameError("Name is required"); valid = false; } else setNameError("");
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      setPhoneError("Enter a valid 10-digit mobile number");
      valid = false;
    } else setPhoneError("");
    return valid;
  }

  async function handleSubmitOrder() {
    if (!validate()) return;
    if (!tenantSlug || !tableId) {
      setApiError("Cart session expired. Go back and select a table again.");
      return;
    }

    setIsSubmitting(true);
    setApiError("");

    try {
      const result = await orderApi.submitUpiOrder(tenantSlug, {
        table_id: tableId,
        customer_name: effectiveName.trim(),
        customer_phone: effectivePhone.trim(),
        items: items.map((i) => ({ menu_item_id: i.menuItem.id, quantity: i.quantity, notes: i.notes })),
      });

      setCustomer(effectiveName.trim(), effectivePhone.trim());
      clearItems();
      qc.invalidateQueries({ queryKey: ["my-orders"] });

      if (result.already_verified) {
        // Returning verified customer — no payment needed, go straight to menu
        router.push(`/restaurants/${tenantSlug}/${tableId}`);
        return;
      }

      setSubmittedOrder(result);
      setPendingOrder(result);
      setPhase("upi-waiting");
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Something went wrong. Please try again.";
      setApiError(msg);
    } finally {
      setIsSubmitting(false);
    }
  }

  function handlePaymentConfirmed(_orderNumbers: string) {
    setPendingOrder(null);
    router.push(`/restaurants/${tenantSlug}/${tableId}`);
  }

  function handleOrderCancelled() {
    // clearCart also clears pendingOrder — full session reset
    useCartStore.getState().clearCart();
    router.push("/");
  }

  if (!_hasHydrated) return null;

  // UPI waiting screen — shown after order is submitted
  if (phase === "upi-waiting" && submittedOrder) {
    return (
      <UpiWaitingScreen
        order={submittedOrder}
        customerPhone={phone || customerPhone || ""}
        tenantSlug={tenantSlug!}
        tableId={tableId!}
        grandTotal={grandTotal}
        activeContactPhone={activeContactPhone}
        onConfirmed={handlePaymentConfirmed}
        onCancelled={handleOrderCancelled}
      />
    );
  }

  if (items.length === 0 && phase === "form") {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <div className="text-6xl mb-4" aria-hidden="true">🛒</div>
        <h1 className="text-2xl font-bold text-stone-900 mb-2">Your cart is empty</h1>
        <p className="text-stone-500 mb-6">Add items from a restaurant to get started.</p>
        <Button onClick={() => router.push("/")} variant="secondary">
          <ArrowLeft className="w-4 h-4" />
          Explore Restaurants
        </Button>
      </div>
    );
  }

  return (
    <main className="max-w-3xl mx-auto px-4 sm:px-6 py-8 pb-20">
      <div className="flex items-center gap-3 mb-8">
        <button
          onClick={() => router.back()}
          className="p-2 rounded-xl hover:bg-stone-100 text-stone-500 hover:text-stone-800 transition-all duration-150 cursor-pointer"
          aria-label="Go back"
        >
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div>
          <h1 className="text-2xl font-bold text-stone-900">Your Order</h1>
          <p className="text-sm text-stone-500">
            {tenantName}{tableNumber && ` · Table ${tableNumber}`}
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Prep time warning */}
        {maxPrepTime > 0 && (
          <div className="flex items-start gap-3 bg-amber-50 border border-amber-200 rounded-2xl px-4 py-4" role="alert">
            <Clock className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
            <div>
              <p className="text-sm font-semibold text-amber-900 mb-1">
                Kitchen starts cooking after payment is confirmed
              </p>
              <p className="text-sm text-amber-800 leading-relaxed">
                Your order will take up to <span className="font-bold">{maxPrepTime} minutes</span> to prepare.
              </p>
            </div>
          </div>
        )}

        {/* Cart items */}
        <section aria-labelledby="cart-items-heading" className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <ShoppingBag className="w-4 h-4 text-rose-500" aria-hidden="true" />
            <h2 id="cart-items-heading" className="font-semibold text-stone-900">Order Items</h2>
          </div>
          <ul className="divide-y divide-stone-50">
            {items.map(({ menuItem, quantity }) => (
              <li key={menuItem.id} className="px-5 py-4 flex items-center gap-4">
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-stone-900 text-sm">{menuItem.name}</p>
                  <p className="text-sm text-stone-500 tabular-nums">{formatCurrency(menuItem.price)} each</p>
                </div>
                <div className="flex items-center gap-2" role="group" aria-label={`${menuItem.name} quantity`}>
                  <button
                    onClick={() => updateQuantity(menuItem.id, quantity - 1)}
                    className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:border-stone-300 hover:bg-stone-50 transition-all duration-150 cursor-pointer"
                    aria-label="Decrease quantity"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="w-5 text-center font-semibold text-stone-900 text-sm tabular-nums">{quantity}</span>
                  <button
                    onClick={() => updateQuantity(menuItem.id, quantity + 1)}
                    className="w-7 h-7 rounded-lg border border-stone-200 flex items-center justify-center text-stone-500 hover:border-stone-300 hover:bg-stone-50 transition-all duration-150 cursor-pointer"
                    aria-label="Increase quantity"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </div>
                <p className="w-16 text-right font-semibold text-stone-900 text-sm tabular-nums">
                  {formatCurrency(menuItem.price * quantity)}
                </p>
                <button
                  onClick={() => removeItem(menuItem.id)}
                  className="p-1.5 rounded-lg text-stone-300 hover:text-red-500 hover:bg-red-50 transition-all duration-150 cursor-pointer"
                  aria-label={`Remove ${menuItem.name}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </li>
            ))}
          </ul>
        </section>

        {/* Customer details */}
        <section aria-labelledby="customer-heading" className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <User className="w-4 h-4 text-rose-500" aria-hidden="true" />
            <h2 id="customer-heading" className="font-semibold text-stone-900">Your Details</h2>
          </div>
          {sessionLocked ? (
            <div className="px-5 py-4 flex items-center gap-4">
              <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center flex-shrink-0">
                <User className="w-5 h-5 text-rose-500" aria-hidden="true" />
              </div>
              <div>
                <p className="font-medium text-stone-900 text-sm">{effectiveName}</p>
                <p className="text-sm text-stone-500">+91 {effectivePhone}</p>
              </div>
            </div>
          ) : (
            <div className="px-5 py-5 space-y-4">
              <div>
                <label htmlFor="customer-name" className="block text-sm font-medium text-stone-700 mb-1.5">
                  Full Name <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <input
                  id="customer-name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Enter your name"
                  autoComplete="name"
                  className="w-full h-11 px-4 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                  aria-required="true"
                  aria-describedby={nameError ? "name-error" : undefined}
                  aria-invalid={!!nameError}
                />
                {nameError && <p id="name-error" role="alert" className="mt-1.5 text-xs text-red-600">{nameError}</p>}
              </div>
              <div>
                <label htmlFor="customer-phone" className="block text-sm font-medium text-stone-700 mb-1.5">
                  Mobile Number <span className="text-red-500" aria-hidden="true">*</span>
                </label>
                <div className="relative">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-stone-500 font-medium pointer-events-none">+91</span>
                  <input
                    id="customer-phone"
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    placeholder="98765 43210"
                    autoComplete="tel"
                    inputMode="numeric"
                    className="w-full h-11 pl-12 pr-4 rounded-xl border border-stone-200 text-stone-900 placeholder:text-stone-400 text-sm focus:outline-none focus:ring-2 focus:ring-rose-500 focus:border-transparent transition-all"
                    aria-required="true"
                    aria-describedby={phoneError ? "phone-error" : undefined}
                    aria-invalid={!!phoneError}
                  />
                </div>
                {phoneError && <p id="phone-error" role="alert" className="mt-1.5 text-xs text-red-600">{phoneError}</p>}
              </div>
              <p className="text-xs text-stone-400">
                Use the same mobile number if you want to add more items later.
              </p>
            </div>
          )}
        </section>

        {/* Bill summary */}
        <section aria-labelledby="bill-heading" className="bg-white rounded-2xl border border-stone-100 overflow-hidden">
          <div className="px-5 py-4 border-b border-stone-100 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-rose-500" aria-hidden="true" />
            <h2 id="bill-heading" className="font-semibold text-stone-900">Bill Summary</h2>
          </div>
          <div className="px-5 py-4 space-y-3 text-sm">
            <div className="flex justify-between text-stone-600">
              <span>Subtotal</span>
              <span className="tabular-nums">{formatCurrency(sub)}</span>
            </div>
            <div className="flex justify-between text-stone-600">
              <span>GST ({gstRate}%)</span>
              <span className="tabular-nums">{formatCurrency(gst)}</span>
            </div>
            <div className="h-px bg-stone-100" aria-hidden="true" />
            <div className="flex justify-between font-bold text-stone-900 text-base">
              <span>Total</span>
              <span className="tabular-nums">{formatCurrency(grandTotal)}</span>
            </div>
          </div>
        </section>

        {/* How it works */}
        <div className="bg-blue-50 border border-blue-100 rounded-2xl px-5 py-4 text-sm">
          <p className="font-semibold text-blue-900 mb-2">How it works</p>
          <ol className="space-y-1.5 text-blue-800 text-xs list-decimal list-inside leading-relaxed">
            <li>Place your order — you&apos;ll get a UPI QR to pay</li>
            <li>Pay via PhonePe, GPay, Paytm or any UPI app</li>
            <li>Show the staff your payment receipt</li>
            <li>Billing confirms and your food goes to the kitchen</li>
          </ol>
        </div>

        {apiError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-700" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {apiError}
          </div>
        )}

        <Button size="lg" className="w-full" loading={isSubmitting} onClick={handleSubmitOrder}>
          <Smartphone className="w-4 h-4" />
          Place Order &amp; Pay {formatCurrency(grandTotal)} via UPI
        </Button>
      </div>
    </main>
  );
}
