export interface Tenant {
  id: number;
  name: string;
  slug: string;
  description: string | null;
  address: string | null;
  city: string;
  cuisine_type: string | null;   // maps to business_domain
  logo_url: string | null;
  cover_image_url: string | null;
  avg_rating: number;
  review_count: number;
  price_range: 1 | 2 | 3 | 4;
  is_open: boolean;              // true when qr_ordering_enabled
  opens_at: string | null;
  closes_at: string | null;
  phone: string | null;
  currency: string;
  gst_rate: number;
  qr_ordering_enabled: boolean;
}

export interface Table {
  id: number;
  table_number: string;
  capacity: number;
  floor: string | null;
  status: "free" | "occupied" | "reserved";
  occupied_since: string | null;
  qr_token: string;
  // Present when status === 'reserved' (Magic Tables pre-reservation)
  reserved_by_name: string | null;
  reserved_by_phone: string | null;
}

export interface MenuCategory {
  id: number;
  name: string;
  items: MenuItem[];
}

export interface MenuItem {
  id: number;
  category_id: number;
  name: string;
  description: string | null;
  price: number;
  image_url: string | null;
  is_available: boolean;
  is_veg: boolean;
  is_ready_made: boolean;
}

export interface MenuPageData {
  tenant: Tenant;
  categories: MenuCategory[];
}

export interface CartItem {
  menuItem: MenuItem;
  quantity: number;
  notes: string;
}

export type CuisineFilter =
  | "All"
  | "Restaurant"
  | "Cafe"
  | "Bakery"
  | "Fast Food"
  | "Desserts"
  | "Bar & Grill";

export const PRICE_LABELS: Record<number, string> = {
  1: "₹",
  2: "₹₹",
  3: "₹₹₹",
  4: "₹₹₹₹",
};
