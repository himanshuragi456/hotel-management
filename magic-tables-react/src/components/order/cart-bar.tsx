import { useState } from "react";
import { ShoppingCart, ArrowRight, CheckCircle2, Loader2, X, Minus, Plus } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { useCartStore } from "@/store/cart";
import { formatCurrency } from "@/lib/utils";
import { orderApi } from "@/services/api";

function LockedCartSheet({ onClose }: { onClose: () => void }) {
  const [placing, setPlacing] = useState(false);
  const [placed, setPlaced] = useState(false);
  const qc = useQueryClient();

  const items          = useCartStore((s) => s.items);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const clearItems     = useCartStore((s) => s.clearItems);
  const setCustomer    = useCartStore((s) => s.setCustomer);
  const tenantSlug     = useCartStore((s) => s.tenantSlug);
  const tableId        = useCartStore((s) => s.tableId);
  const customerName   = useCartStore((s) => s.customerName);
  const customerPhone  = useCartStore((s) => s.customerPhone);
  const gstRate        = useCartStore((s) => s.gstRate);
  const sub            = useCartStore((s) => s.subtotal());

  const gst   = Math.round(sub * (gstRate / 100));
  const total = sub + gst;

  async function handlePlace() {
    if (!tenantSlug || !tableId || !customerName || !customerPhone) return;
    setPlacing(true);
    try {
      await orderApi.submitUpiOrder(tenantSlug, {
        table_id: tableId,
        customer_name: customerName,
        customer_phone: customerPhone,
        items: items.map((i) => ({ menu_item_id: i.menuItem.id, quantity: i.quantity, notes: i.notes })),
      });
      setCustomer(customerName, customerPhone);
      clearItems();
      qc.invalidateQueries({ queryKey: ["my-orders"] });
      setPlaced(true);
      setTimeout(() => { setPlaced(false); onClose(); }, 1500);
    } catch {
      setPlacing(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col">
      <div className="flex-1 bg-black/40" onClick={onClose} />
      <div className="bg-white rounded-t-3xl px-5 pt-5 pb-8 max-h-[80vh] flex flex-col">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold text-stone-900">Your Cart</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-stone-100 flex items-center justify-center text-stone-500 hover:bg-stone-200 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto space-y-3 mb-4">
          {items.map(({ menuItem, quantity }) => (
            <div key={menuItem.id} className="flex items-center gap-3">
              <div className="flex-1 min-w-0">
                <p className="font-medium text-stone-900 text-sm truncate">{menuItem.name}</p>
                <p className="text-xs text-stone-400">{formatCurrency(menuItem.price)} each</p>
              </div>
              <div className="flex items-center gap-2">
                <button onClick={() => updateQuantity(menuItem.id, quantity - 1)} className="w-8 h-8 rounded-full bg-rose-100 text-rose-600 flex items-center justify-center hover:bg-rose-200 transition-colors">
                  <Minus className="w-3.5 h-3.5" />
                </button>
                <span className="font-semibold w-5 text-center text-sm">{quantity}</span>
                <button onClick={() => updateQuantity(menuItem.id, quantity + 1)} className="w-8 h-8 rounded-full bg-rose-500 text-white flex items-center justify-center hover:bg-rose-600 transition-colors">
                  <Plus className="w-3.5 h-3.5" />
                </button>
              </div>
              <p className="text-sm font-semibold text-stone-900 w-14 text-right tabular-nums">{formatCurrency(menuItem.price * quantity)}</p>
            </div>
          ))}
        </div>
        <div className="border-t border-stone-100 pt-4">
          <div className="space-y-1.5 text-sm mb-4">
            <div className="flex justify-between text-stone-500"><span>Subtotal</span><span className="tabular-nums">{formatCurrency(sub)}</span></div>
            {gstRate > 0 && <div className="flex justify-between text-stone-500"><span>GST ({gstRate}%)</span><span className="tabular-nums">{formatCurrency(gst)}</span></div>}
            <div className="flex justify-between font-bold text-stone-900 text-base pt-1"><span>Total</span><span className="tabular-nums">{formatCurrency(total)}</span></div>
          </div>
          <button
            onClick={handlePlace}
            disabled={placing || placed || items.length === 0}
            className={`w-full py-4 rounded-2xl font-bold text-base transition-colors disabled:opacity-50 ${placed ? "bg-emerald-600 text-white" : "bg-rose-600 hover:bg-rose-700 text-white"}`}
          >
            {placed ? <span className="flex items-center justify-center gap-2"><CheckCircle2 className="w-5 h-5" /> Order Placed!</span>
              : placing ? <span className="flex items-center justify-center gap-2"><Loader2 className="w-5 h-5 animate-spin" /> Placing Order…</span>
              : "Place Order"}
          </button>
          <p className="text-xs text-stone-400 text-center mt-3">Your order goes directly to the kitchen</p>
        </div>
      </div>
    </div>
  );
}

export function CartBar({ isOpen = true }: { isOpen?: boolean }) {
  const navigate      = useNavigate();
  const [sheetOpen, setSheetOpen] = useState(false);

  const itemCount      = useCartStore((s) => s.itemCount());
  const subtotal       = useCartStore((s) => s.subtotal());
  const _hasHydrated   = useCartStore((s) => s._hasHydrated);
  const isTableLocked  = useCartStore((s) => s.isTableLocked);

  if (!_hasHydrated || itemCount === 0) return null;

  const locked = isTableLocked();

  const handleClick = () => {
    if (!isOpen) return;
    if (locked) setSheetOpen(true);
    else navigate("/checkout");
  };

  return (
    <>
      <div className="fixed bottom-6 left-0 right-0 z-40 flex justify-center px-4 pointer-events-none">
        <button
          onClick={handleClick}
          disabled={!isOpen}
          className={`pointer-events-auto flex items-center justify-between gap-6 rounded-2xl px-5 py-4 shadow-2xl transition-all duration-150 w-full max-w-md ${isOpen ? "bg-stone-900 text-white hover:bg-stone-800 active:bg-stone-950 cursor-pointer shadow-stone-900/30" : "bg-stone-300 text-stone-500 cursor-not-allowed shadow-stone-300/30"}`}
          aria-label={`${itemCount} items, ${formatCurrency(subtotal)}`}
        >
          <div className="flex items-center gap-3">
            <div className="relative">
              <ShoppingCart className="w-5 h-5" aria-hidden="true" />
              <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center w-4 h-4 text-xs font-bold bg-rose-500 rounded-full tabular-nums">{itemCount}</span>
            </div>
            <span className="font-medium text-sm">{itemCount} {itemCount === 1 ? "item" : "items"}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold tabular-nums">{formatCurrency(subtotal)}</span>
            <ArrowRight className="w-4 h-4 opacity-70" aria-hidden="true" />
          </div>
        </button>
      </div>
      {sheetOpen && locked && <LockedCartSheet onClose={() => setSheetOpen(false)} />}
    </>
  );
}
