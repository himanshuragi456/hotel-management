import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { CartItem, MenuItem, Table, Tenant } from "@/types";

interface CartState {
  items: CartItem[];
  tenantId: number | null;
  tenantSlug: string | null;
  tenantName: string | null;
  tableId: number | null;
  tableNumber: string | null;
  qrToken: string | null;
  gstRate: number;
  customerName: string;
  customerPhone: string;
  sessionStartedAt: number | null; // ms timestamp when session began (after first payment)
  _hasHydrated: boolean;
  setCustomer: (name: string, phone: string) => void;
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
      tableId: null,
      tableNumber: null,
      qrToken: null,
      gstRate: 5,
      customerName: "",
      customerPhone: "",
      sessionStartedAt: null,
      _hasHydrated: false,

      setCustomer: (name, phone) => set({ customerName: name, customerPhone: phone, sessionStartedAt: Date.now() }),

      addItem: (menuItem, restaurant, table) => {
        const { items, tenantId } = get();

        // Clear cart if switching restaurant
        if (tenantId && tenantId !== restaurant.id) {
          set({
            items: [],
            tenantId: restaurant.id,
            tenantSlug: restaurant.slug,
            tenantName: restaurant.name,
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
          tableId: null,
          tableNumber: null,
          qrToken: null,
          gstRate: 5,
          customerName: "",
          customerPhone: "",
          sessionStartedAt: null,
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
