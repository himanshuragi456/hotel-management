import { apiClient } from "@/lib/axios";
import type { MenuCategory, MenuPageData, Table, Tenant } from "@/types";

export const restaurantApi = {
  list: (params?: { location_id?: number; search?: string }) =>
    apiClient
      .get<{ status: boolean; data: Tenant[] }>("/magic-tables/restaurants", { params })
      .then((r) => r.data.data),

  get: (slug: string) =>
    apiClient
      .get<{ status: boolean; data: Tenant }>(`/magic-tables/restaurants/${slug}`)
      .then((r) => r.data.data),

  tables: (slug: string) =>
    apiClient
      .get<{ status: boolean; data: Table[] }>(`/magic-tables/restaurants/${slug}/tables`)
      .then((r) => r.data.data),

  menu: (slug: string) =>
    apiClient
      .get<{ status: boolean; data: MenuPageData }>(`/magic-tables/restaurants/${slug}/menu`)
      .then((r) => r.data.data),

  cities: () =>
    apiClient
      .get<{ status: boolean; data: string[] }>("/magic-tables/cities")
      .then((r) => r.data.data),

  locations: () =>
    apiClient
      .get<{ status: boolean; data: { id: number; name: string; city: string | null; state: string | null }[] }>("/magic-tables/locations")
      .then((r) => r.data.data),
};

export interface OrderItem {
  menu_item_id: number;
  quantity: number;
  notes: string;
}

export interface CreateOrderPayload {
  table_id: number;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
}

export interface CreateOrderResponse {
  razorpay_order_id: string | null;
  razorpay_key: string | null;
  amount: number;
  currency: string;
  prefill: { name: string; contact: string };
}

export interface VerifyPaymentPayload {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
  // Full cart resent so the backend can create the order after verification
  table_id: number;
  customer_name: string;
  customer_phone: string;
  items: OrderItem[];
}

export interface VerifyPaymentResponse {
  order_number: string;
  order_numbers: string;
  total: number;
  status: string;
}

export const orderApi = {
  create: (slug: string, payload: CreateOrderPayload) =>
    apiClient
      .post<{ status: boolean; data: CreateOrderResponse }>(
        `/magic-tables/restaurants/${slug}/orders`,
        payload
      )
      .then((r) => r.data.data),

  verifyPayment: (slug: string, payload: VerifyPaymentPayload) =>
    apiClient
      .post<{ status: boolean; data: VerifyPaymentResponse }>(
        `/magic-tables/restaurants/${slug}/orders/verify-payment`,
        payload
      )
      .then((r) => r.data.data),

  myOrders: (slug: string, tableId: number, customerPhone: string) =>
    apiClient
      .get<{ status: boolean; data: MyOrder[] }>(
        `/magic-tables/restaurants/${slug}/my-orders`,
        { params: { table_id: tableId, customer_phone: customerPhone } }
      )
      .then((r) => r.data.data),
};

export const tableApi = {
  callWaiter: (slug: string, tableId: number) =>
    apiClient
      .post<{ status: boolean; message: string }>(
        `/magic-tables/restaurants/${slug}/call-waiter`,
        { table_id: tableId }
      )
      .then((r) => r.data),

  requestBill: (slug: string, tableId: number) =>
    apiClient
      .post<{ status: boolean; message: string }>(
        `/magic-tables/restaurants/${slug}/request-bill`,
        { table_id: tableId }
      )
      .then((r) => r.data),
};

export interface MyOrder {
  id: number;
  order_number: string;
  status: "pending" | "preparing" | "ready" | "served" | "cancelled";
  source: string;
  payment_status: "not_applicable" | "paid";
  total: number;
  created_at: string;
  queue_position: number | null;
  items: { name: string; quantity: number; subtotal: number }[];
}
