export type Variant = {
  id: string;
  product_id: string;
  sku: string;
  color: string;
  color_hex: string;
  size: string;
  price: number;
  compare_price: number | null;
  stock: number;
  reserved: number;
  weight_grams?: number | null;
};
export type Product = {
  id: string;
  slug: string;
  title: string;
  description: string;
  category: string;
  material: string;
  care: string;
  image: string;
  images: string[];
  featured: boolean;
  is_new: boolean;
  published: boolean;
  sales: number;
  created_at: string;
  variants: Variant[];
  tax_class_id?: string | null;
  return_window_days?: number | null;
  sealed_return_required?: boolean;
};
export type User = { id: string; email: string; name: string; role: string };
export type Address = {
  name: string;
  phone: string;
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  state: string;
  postal: string;
  country?: "IN";
};
export type SavedAddress = {
  id: string;
  content: Address;
  label: string;
  kind: "shipping" | "billing" | "both";
  default_shipping: boolean;
  default_billing: boolean;
  created_at: string;
  updated_at: string;
};
export type CartItem = {
  variant_id: string;
  quantity: number;
  title: string;
  image: string;
  color: string;
  size: string;
  price: number;
  stock: number;
};
export type Order = {
  id: string;
  user_id: string;
  status: string;
  order_state: string;
  payment_state: string;
  payment_attempt_state?: string | null;
  fulfillment_state: string;
  refund_state: string;
  delivered_at: string | null;
  total: number;
  subtotal: number;
  shipping: number;
  discount: number;
  address: Record<string, string>;
  billing_address: Record<string, string> | null;
  provider_id: string | null;
  idempotency_key: string;
  payment_method: "prepaid" | "cod";
  cod_fee: number;
  tax_snapshot?: {
    taxable_paise: number;
    tax_paise: number;
    cgst_paise: number;
    sgst_paise: number;
    igst_paise: number;
  } | null;
  created_at: string;
  events?: {
    id: string;
    order_state: string;
    payment_state: string;
    fulfillment_state: string;
    refund_state: string;
    source: string;
    created_at: string;
  }[];
  shipment?: { carrier: string; tracking: string; created_at: string } | null;
  courier_managed?: boolean;
  tracking_events?: {
    id: string;
    status_code: number;
    label: string;
    occurred_at: string;
    scans: { date: string; activity: string; location?: string }[];
  }[];
  items: {
    id: string;
    variant_id: string;
    pricing_snapshot?: {
      return_window_days?: number | null;
      sealed_return_required?: boolean;
    } | null;
    title: string;
    size: string;
    color: string;
    quantity: number;
    price: number;
  }[];
};
export const money = (n: number) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n / 100);
