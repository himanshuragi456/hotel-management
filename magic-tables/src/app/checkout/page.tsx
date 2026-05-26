"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft, Minus, Plus, Trash2, CreditCard,
  ShoppingBag, User, AlertCircle, Lock, CheckCircle2, Smartphone, Clock,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "@/store/cart";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils";
import { orderApi } from "@/services/api";
import { loadRazorpayScript, type RazorpayPaymentResponse } from "@/lib/razorpay";

export default function CheckoutPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const {
    items, updateQuantity, removeItem, clearCart, clearItems, setCustomer,
    subtotal, tenantName, tenantSlug, tableNumber, tableId, gstRate,
    customerName, customerPhone, _hasHydrated,
  } = useCartStore();

  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");

  useEffect(() => {
    if (_hasHydrated) {
      if (customerName) setName(customerName);
      if (customerPhone) setPhone(customerPhone);
    }
  }, [_hasHydrated, customerName, customerPhone]);
  const [nameError, setNameError] = useState("");
  const [phoneError, setPhoneError] = useState("");
  const [apiError, setApiError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [devPayment, setDevPayment] = useState<boolean>(false);
  const [devConfirming, setDevConfirming] = useState(false);

  const sub = subtotal();
  const gst = Math.round(sub * (gstRate / 100));
  const grandTotal = sub + gst;

  // Max prep time across cooked (non-ready-made) items in cart
  const maxPrepTime = items.reduce((max, { menuItem }) => {
    if (menuItem.is_ready_made || !menuItem.prep_time_minutes) return max;
    return Math.max(max, menuItem.prep_time_minutes);
  }, 0);

  function validate() {
    let valid = true;
    if (!name.trim()) { setNameError("Name is required"); valid = false; } else setNameError("");
    if (!phone.trim() || !/^[6-9]\d{9}$/.test(phone.trim())) {
      setPhoneError("Enter a valid 10-digit mobile number");
      valid = false;
    } else setPhoneError("");
    return valid;
  }

  const cartPayload = {
    table_id: tableId!,
    customer_name: name.trim(),
    customer_phone: phone.trim(),
    items: items.map((i) => ({ menu_item_id: i.menuItem.id, quantity: i.quantity, notes: i.notes })),
  };

  async function handlePay() {
    if (!validate()) return;
    if (!tenantSlug || !tableId) {
      setApiError("Cart session expired. Go back and select a table again.");
      return;
    }

    setIsSubmitting(true);
    setApiError("");

    try {
      // Step 1 — validate cart + get Razorpay order ID (nothing written to DB yet)
      const payData = await orderApi.create(tenantSlug, {
        ...cartPayload,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
      });

      // Step 2 — open Razorpay checkout
      if (!payData.razorpay_order_id || !payData.razorpay_key) {
        // Razorpay not configured — show test payment screen
        setDevPayment(true);
        setIsSubmitting(false);
        return;
      }

      await loadRazorpayScript();

      await new Promise<void>((resolve, reject) => {
        const rzp = new window.Razorpay({
          key: payData.razorpay_key!,
          amount: Math.round(payData.amount * 100),
          currency: payData.currency,
          name: tenantName ?? "Magic Tables",
          description: `Table ${tableNumber} order`,
          order_id: payData.razorpay_order_id!,
          prefill: payData.prefill,
          theme: { color: "#e11d48" },
          handler: async (response: RazorpayPaymentResponse) => {
            try {
              // Step 3 — verify payment; backend creates the order in DB only now
              const verified = await orderApi.verifyPayment(tenantSlug, {
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
                razorpay_signature: response.razorpay_signature,
                ...cartPayload,
                customer_name: name.trim(),
                customer_phone: phone.trim(),
              });
              setCustomer(name.trim(), phone.trim());
              clearItems();
              qc.invalidateQueries({ queryKey: ["my-orders"] });
              router.push(`/order-confirmed?orders=${verified.order_numbers}&total=${grandTotal}`);
              resolve();
            } catch (e) {
              reject(e);
            }
          },
          modal: {
            ondismiss: () => {
              setIsSubmitting(false);
              setApiError("Payment was cancelled. No order was placed.");
              resolve();
            },
          },
        });
        rzp.open();
      });
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "Something went wrong. Please try again.";
      setApiError(msg);
      setIsSubmitting(false);
    }
  }

  async function handleDevConfirm() {
    if (!tenantSlug) return;
    setDevConfirming(true);
    try {
      // In dev mode, backend skips signature check — order is created here
      const verified = await orderApi.verifyPayment(tenantSlug, {
        razorpay_order_id: "dev_bypass",
        razorpay_payment_id: "dev_bypass",
        razorpay_signature: "dev_bypass",
        ...cartPayload,
        customer_name: name.trim(),
        customer_phone: phone.trim(),
      });
      setCustomer(name.trim(), phone.trim());
      clearItems();
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      router.push(`/order-confirmed?orders=${verified.order_numbers}&total=${grandTotal}`);
    } catch {
      setApiError("Something went wrong confirming the test payment.");
      setDevConfirming(false);
      setDevPayment(false);
    }
  }

  if (!_hasHydrated) return null;

  if (items.length === 0) {
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
                Kitchen starts cooking immediately after you order
              </p>
              <p className="text-sm text-amber-800 leading-relaxed">
                Your order will take up to <span className="font-bold">{maxPrepTime} minutes</span> to prepare.
                Please only place this order if you can reach the restaurant within this time — otherwise your food may be cold when you arrive.
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

        {apiError && (
          <div className="flex items-start gap-3 bg-red-50 border border-red-100 rounded-2xl px-4 py-3 text-sm text-red-700" role="alert">
            <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
            {apiError}
          </div>
        )}

        <div className="flex items-center gap-2 justify-center text-xs text-stone-400">
          <Lock className="w-3.5 h-3.5" aria-hidden="true" />
          Order confirmed only after payment · Secure checkout via Razorpay
        </div>

        <Button size="lg" className="w-full" loading={isSubmitting} onClick={handlePay}>
          <CreditCard className="w-4 h-4" />
          Pay {formatCurrency(grandTotal)}
        </Button>
      </div>

      {/* Test payment modal — shown when Razorpay keys aren't configured */}
      {devPayment && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 backdrop-blur-sm px-4 pb-4 sm:pb-0"
          role="dialog"
          aria-modal="true"
          aria-labelledby="dev-payment-title"
        >
          <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl overflow-hidden">
            {/* Header */}
            <div className="bg-gradient-to-br from-violet-600 to-indigo-600 px-6 py-5 text-white">
              <div className="flex items-center gap-3 mb-1">
                <Smartphone className="w-5 h-5 opacity-80" aria-hidden="true" />
                <span className="text-xs font-medium tracking-wide uppercase opacity-80">Test Payment</span>
              </div>
              <p id="dev-payment-title" className="text-2xl font-bold">{formatCurrency(grandTotal)}</p>
              <p className="text-sm opacity-70 mt-0.5">{tenantName}{tableNumber && ` · Table ${tableNumber}`}</p>
            </div>

            <div className="px-6 py-5">
              <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 mb-5">
                <p className="text-xs font-semibold text-amber-800 mb-1">Dev / Test Mode</p>
                <p className="text-xs text-amber-700 leading-relaxed">
                  Razorpay is not configured. This simulates the payment step.
                  In production, the real Razorpay checkout would open here.
                </p>
              </div>

              <div className="space-y-2 mb-5 text-sm">
                <div className="flex justify-between text-stone-500">
                  <span>Customer</span>
                  <span className="text-stone-700">{name}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Mobile</span>
                  <span className="text-stone-700">+91 {phone}</span>
                </div>
                <div className="flex justify-between text-stone-500">
                  <span>Items</span>
                  <span className="text-stone-700">{items.length} item{items.length !== 1 ? "s" : ""}</span>
                </div>
              </div>

              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  className="flex-1"
                  disabled={devConfirming}
                  onClick={() => {
                    setDevPayment(false);
                    setApiError("Payment was cancelled. No order was placed.");
                  }}
                >
                  Cancel
                </Button>
                <Button
                  className="flex-1"
                  loading={devConfirming}
                  onClick={handleDevConfirm}
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Confirm Payment
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
