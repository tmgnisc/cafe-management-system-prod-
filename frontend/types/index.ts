// Shared API types — mirror the PHP API JSON payloads.

export type Role = "SUPERADMIN" | "STAFF";
export type UserStatus = "ACTIVE" | "INACTIVE";

export interface User {
  id: number;
  name: string;
  email: string;
  phone: string | null;
  role: Role;
  status: UserStatus;
  last_login: string | null;
  created_at: string;
  updated_at: string;
}

export interface Pagination {
  page: number;
  per_page: number;
  total: number;
  total_pages: number;
}

export interface Paginated<T> {
  items: T[];
  pagination: Pagination;
}

export type TableStatus = "AVAILABLE" | "OCCUPIED" | "RESERVED" | "CLEANING" | "INACTIVE";

export interface CafeTable {
  id: number;
  table_number: string;
  name: string;
  capacity: number;
  section: string;
  status: TableStatus;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  current_order_id: number | null;
  current_order_number: string | null;
  current_order_status: OrderStatus | null;
  current_order_total: number | null;
  current_order_started_at: string | null;
  current_order_item_count: number | null;
}

export interface Category {
  id: number;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  item_count: number;
  created_at: string;
  updated_at: string;
}

export interface MenuItem {
  id: number;
  category_id: number;
  category_name: string;
  name: string;
  sku: string;
  description: string | null;
  image: string | null;
  selling_price: number;
  cost_price: number;
  is_available: boolean;
  track_inventory: boolean;
  is_active: boolean;
  recipe_item_count: number;
  created_at: string;
  updated_at: string;
  recipe?: Recipe;
}

export type InventoryUnit = "kg" | "g" | "liter" | "ml" | "pcs" | "packet" | "bottle" | "box";
export const INVENTORY_UNITS: InventoryUnit[] = ["kg", "g", "liter", "ml", "pcs", "packet", "bottle", "box"];

export interface RecipeItem {
  id?: number;
  inventory_item_id: number;
  inventory_item_name?: string;
  inventory_item_sku?: string;
  inventory_unit?: InventoryUnit;
  inventory_current_quantity?: number;
  cost_per_unit?: number;
  quantity: number;
  unit: InventoryUnit;
}

export interface Recipe {
  id: number | null;
  menu_item_id: number;
  items: RecipeItem[];
  updated_at: string | null;
  menu_item?: MenuItem;
}

export interface RecipeSummary {
  menu_item_id: number;
  menu_item_name: string;
  menu_item_sku: string;
  category_name: string;
  track_inventory: boolean;
  recipe_id: number | null;
  items: { inventory_item_id: number; inventory_item_name: string; quantity: number; unit: InventoryUnit }[];
}

export type StockStatus = "IN_STOCK" | "LOW_STOCK" | "OUT_OF_STOCK";

export interface InventoryItem {
  id: number;
  name: string;
  sku: string;
  unit: InventoryUnit;
  current_quantity: number;
  minimum_quantity: number;
  cost_per_unit: number;
  supplier: string | null;
  is_active: boolean;
  stock_status: StockStatus;
  created_at: string;
  updated_at: string;
}

export interface InventoryOption {
  id: number;
  name: string;
  sku: string;
  unit: InventoryUnit;
  current_quantity: number;
  cost_per_unit: number;
}

export type MovementType = "INITIAL_STOCK" | "PURCHASE" | "SALE" | "ADJUSTMENT" | "WASTE" | "RETURN";
export type AdjustmentType = "PURCHASE" | "ADJUSTMENT" | "WASTE" | "RETURN";

export interface StockMovement {
  id: number;
  inventory_item_id: number;
  inventory_item_name: string;
  unit: InventoryUnit;
  type: MovementType;
  quantity: number;
  previous_quantity: number;
  new_quantity: number;
  reference_type: string | null;
  reference_id: number | null;
  reference_label?: string | null;
  reason: string | null;
  created_by: number | null;
  created_by_name: string | null;
  created_at: string;
}

export type OrderStatus =
  | "DRAFT"
  | "PENDING"
  | "CONFIRMED"
  | "PREPARING"
  | "READY"
  | "SERVED"
  | "COMPLETED"
  | "CANCELLED";

export const KITCHEN_STATUSES: OrderStatus[] = ["PENDING", "CONFIRMED", "PREPARING", "READY", "SERVED"];

export type PaymentMethod = "CASH" | "CARD" | "ESEWA" | "KHALTI" | "BANK_TRANSFER" | "OTHER";
export const PAYMENT_METHODS: PaymentMethod[] = ["CASH", "CARD", "ESEWA", "KHALTI", "BANK_TRANSFER", "OTHER"];

export type DiscountType = "PERCENTAGE" | "FIXED";

export interface OrderItem {
  id: number;
  order_id: number;
  menu_item_id: number;
  item_name_snapshot: string;
  category_snapshot: string | null;
  unit_price: number;
  quantity: number;
  line_total: number;
  notes: string | null;
  sent_at: string | null;
  created_at: string;
}

export interface Payment {
  id: number;
  order_id: number;
  amount: number;
  tendered_amount: number;
  change_amount: number;
  method: PaymentMethod;
  status: "PAID" | "REFUNDED" | "FAILED";
  reference: string | null;
  received_by: number;
  received_by_name: string;
  paid_at: string;
  created_at: string;
}

export interface OrderSummary {
  id: number;
  order_number: string;
  table_id: number;
  table_number: string;
  table_name: string;
  status: OrderStatus;
  payment_status: "UNPAID" | "PAID";
  subtotal: number;
  discount_amount: number;
  tax_amount: number;
  service_charge_amount: number;
  grand_total: number;
  created_by: number;
  created_by_name: string;
  created_at: string;
  completed_at: string | null;
  cancelled_at: string | null;
  payment_method: PaymentMethod | null;
  item_count: number;
}

export interface Order {
  id: number;
  order_number: string;
  table_id: number;
  table_number: string;
  table_name: string;
  status: OrderStatus;
  payment_status: "UNPAID" | "PAID";
  notes: string | null;
  subtotal: number;
  discount_type: DiscountType | null;
  discount_value: number;
  discount_amount: number;
  discount_applied_by: number | null;
  discount_applied_by_name: string | null;
  tax_rate: number;
  tax_amount: number;
  service_charge_rate: number;
  service_charge_amount: number;
  grand_total: number;
  inventory_deducted_at: string | null;
  created_by: number;
  created_by_name: string;
  completed_by: number | null;
  completed_by_name: string | null;
  cancelled_by: number | null;
  cancelled_by_name: string | null;
  cancel_reason: string | null;
  sent_at: string | null;
  served_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
  items: OrderItem[];
  payment: Payment | null;
  stock_movements: StockMovement[];
  unsent_item_count: number;
  is_editable: boolean;
  change_amount?: number;
}

export interface OrderLineInput {
  id?: number | null;
  menu_item_id: number;
  quantity: number;
  notes?: string | null;
}

export interface Settings {
  cafe_name: string;
  address: string;
  phone: string;
  email: string;
  logo: string;
  pan_number: string;
  currency: string;
  currency_symbol: string;
  tax_label: string;
  tax_rate: number;
  service_charge_rate: number;
  tax_on_service_charge: boolean;
  staff_discount_enabled: boolean;
  max_staff_discount_percent: number;
  allow_negative_stock: boolean;
  table_status_after_payment: "AVAILABLE" | "CLEANING";
  receipt_footer: string;
}

export interface ReceiptData {
  order: Order;
  cafe: {
    name: string;
    address: string;
    phone: string;
    email: string;
    logo: string;
    pan_number: string;
    currency_symbol: string;
    tax_label: string;
    receipt_footer: string;
  };
}

export interface AuditLog {
  id: number;
  user_id: number | null;
  user_name: string | null;
  user_role: Role | null;
  action: string;
  entity_type: string | null;
  entity_id: number | null;
  description: string;
  old_values: Record<string, unknown> | null;
  new_values: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

// ---------------------------------------------------------------- Reports

export interface SalesSummary {
  orders: number;
  items_sold: number;
  cancelled_orders: number;
  gross_sales: number;
  discount: number;
  net_sales: number;
  service_charge: number;
  tax: number;
  total_collected: number;
  cost_of_goods: number;
  gross_profit: number;
  average_order_value: number;
}

export interface SeriesPoint {
  key: string;
  label: string;
  orders: number;
  sales: number;
}

export interface Series {
  granularity: "hour" | "day";
  points: SeriesPoint[];
}

export interface PaymentBreakdown {
  method: PaymentMethod;
  count: number;
  amount: number;
}

export interface TopItem {
  menu_item_id: number;
  name: string;
  category: string | null;
  quantity: number;
  revenue: number;
}

export interface TopCategory {
  name: string;
  quantity: number;
  revenue: number;
}

export interface StaffPerformance {
  user_id: number;
  name: string;
  role: Role;
  orders: number;
  sales: number;
  discounts: number;
  average_order_value: number;
}

export interface TablePerformance {
  table_id: number;
  name: string;
  section: string;
  capacity: number;
  orders: number;
  sales: number;
  average_order_value: number;
  average_minutes: number;
}

export type ReportPreset = "today" | "yesterday" | "week" | "month" | "custom";

export interface ReportRange {
  preset: ReportPreset;
  from: string;
  to: string;
}

export interface SalesReport {
  range: ReportRange;
  summary: SalesSummary;
  payment_methods: PaymentBreakdown[];
  top_items: TopItem[];
  top_categories: TopCategory[];
  staff_performance: StaffPerformance[];
  table_performance: TablePerformance[];
  series: Series;
}

export interface Dashboard {
  today: SalesSummary;
  yesterday: SalesSummary;
  tables: { total: number; available: number; occupied: number; reserved: number; cleaning: number };
  open_orders: { count: number; value: number };
  low_stock_count: number;
  low_stock_items: InventoryItem[];
  sales_today: Series;
  sales_week: Series;
  sales_month: Series;
  month_summary: SalesSummary;
  top_items: TopItem[];
  top_categories: TopCategory[];
  payment_methods: PaymentBreakdown[];
  recent_orders: OrderSummary[];
}
