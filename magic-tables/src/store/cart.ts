import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, MenuItem, Table, Tenant } from "@/types";
import type { SubmitUpiOrderResponse } from "@/services/api";

interface CartState {
  items: CartItem[];
  tenantId: number | null;
  tenantSlug: string | null;
  tenantName: string | null;
  activeContactPhone: string | null;
  tableId: number | null;
  tableNumber: string | null;
  qrToken: string | null;
  gstRate: number;
  customerName: string;
  customerPhone: string;
  sessionStartedAt: number | null; // ms timestamp when session began (after first payment)
  // Persisted so the UPI waiting screen survives a page refresh
  pendingOrder: SubmitUpiOrderResponse | null;
  // True while customer has notified counter and is waiting for billing to confirm
  billAwaitingConfirm: boolean;
  _hasHydrated: boolean;
  // true once an order is confirmed — table + restaurant are locked
  isTableLocked: () => boolean;
  setCustomer: (name: string, phone: string) => void;
  setPendingOrder: (order: SubmitUpiOrderResponse | null) => void;
  setBillAwaitingConfirm: (val: boolean) => void;
  addItem: (item: MenuItem, restaurant: Tenant, table: Table) => void;
  removeItem: (menuItemId: number) => void;
  updateQuantity: (menuItemId: number, qty: number) => void;
  clearCart: () => void;
  clearItems: () => void;
  subtotal: () => number;
  itemCount: () => number;
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items: [],
      tenantId: null,
      tenantSlug: null,
      tenantName: null,
      activeContactPhone: null,
      tableId: null,
      tableNumber: null,
      qrToken: null,
      gstRate: 5,
      customerName: "",
      customerPhone: "",
      sessionStartedAt: null,
      pendingOrder: null,
      billAwaitingConfirm: false,
      _hasHydrated: false,

      // Locked once the customer has confirmed an order (sessionStartedAt is set)
      isTableLocked: () => !!get().sessionStartedAt,

      setCustomer: (name, phone) => set({ customerName: name, customerPhone: phone, sessionStartedAt: Date.now() }),
      setPendingOrder: (order) => set({ pendingOrder: order }),
      setBillAwaitingConfirm: (val) => set({ billAwaitingConfirm: val }),

      addItem: (menuItem, restaurant, table) => {
        const { items, tenantId, tableId: currentTableId } = get();

        // Refuse silently if locked to a different restaurant or table
        if (get().isTableLocked()) {
          if (tenantId !== restaurant.id || currentTableId !== table.id) return;
        }

        // Clear cart if switching restaurant (only allowed when not locked)
        if (tenantId && tenantId !== restaurant.id) {
          set({
            items: [],
            tenantId: restaurant.id,
            tenantSlug: restaurant.slug,
            tenantName: restaurant.name,
            activeContactPhone: restaurant.active_contact_phone ?? null,
            tableId: table.id,
            tableNumber: table.table_number,
            qrToken: table.qr_token,
            gstRate: restaurant.gst_rate ?? 5,
          });
        } else if (!tenantId) {
          set({
            tenantId: restaurant.id,
            tenantSlug: restaurant.slug,
            tenantName: restaurant.name,
            activeContactPhone: restaurant.active_contact_phone ?? null,
            tableId: table.id,
            tableNumber: table.table_number,
            qrToken: table.qr_token,
            gstRate: restaurant.gst_rate ?? 5,
          });
        }

        const existing = get().items.find((i) => i.menuItem.id === menuItem.id);
        if (existing) {
          set({
            items: get().items.map((i) =>
              i.menuItem.id === menuItem.id ? { ...i, quantity: i.quantity + 1 } : i
            ),
          });
        } else {
          set({ items: [...get().items, { menuItem, quantity: 1, notes: "" }] });
        }
      },

      removeItem: (menuItemId) =>
        set({ items: get().items.filter((i) => i.menuItem.id !== menuItemId) }),

      updateQuantity: (menuItemId, qty) => {
        if (qty <= 0) {
          get().removeItem(menuItemId);
          return;
        }
        set({
          items: get().items.map((i) =>
            i.menuItem.id === menuItemId ? { ...i, quantity: qty } : i
          ),
        });
      },

      // Clears only the cart items — keeps the table session alive for more batches
      clearItems: () => set({ items: [] }),

      // Full reset — called when the table session ends (table freed by staff)
      clearCart: () => {
        set({
          items: [],
          tenantId: null,
          tenantSlug: null,
          tenantName: null,
          activeContactPhone: null,
          tableId: null,
          tableNumber: null,
          qrToken: null,
          gstRate: 5,
          customerName: "",
          customerPhone: "",
          sessionStartedAt: null,
          pendingOrder: null,
          billAwaitingConfirm: false,
        });
      },

      subtotal: () =>
        get().items.reduce((sum, i) => sum + i.menuItem.price * i.quantity, 0),

      itemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    {
      name: "magic-tables-cart",
      onRehydrateStorage: () => (state) => {
        if (state) state._hasHydrated = true;
      },
    }
  )
);
