/**
 * Centralised client for the PHP REST API.
 *
 * - Every request goes through `request()` — no component calls fetch() directly.
 * - Auth uses the PHP session cookie (credentials: "include"); no secrets live in the browser bundle.
 * - State-changing requests send the per-session CSRF token in `X-CSRF-Token`.
 * - Errors are thrown as `ApiError` with the HTTP status and field errors from the API envelope.
 */
import type {
  AdjustmentType,
  AuditLog,
  CafeTable,
  Category,
  Dashboard,
  DiscountType,
  InventoryItem,
  InventoryOption,
  MenuItem,
  Order,
  OrderLineInput,
  OrderStatus,
  OrderSummary,
  Paginated,
  PaymentMethod,
  ReceiptData,
  Recipe,
  RecipeItem,
  RecipeSummary,
  ReportPreset,
  SalesReport,
  Settings,
  StockMovement,
  TableStatus,
  TopItem,
  ReportRange,
  User,
} from "@/types";

/** "" means same origin (requests are proxied by Next.js rewrites — see next.config.ts). */
export const API_URL = (process.env.API_BASE_URL ?? "http://localhost:8000").replace(/\/$/, "");

export type FieldErrors = Record<string, string[]>;

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public errors: FieldErrors = {},
  ) {
    super(message);
    this.name = "ApiError";
  }

  /** First error message for a field (e.g. "email" or "items.0.quantity"). */
  field(name: string): string | undefined {
    return this.errors[name]?.[0];
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

interface RequestOptions {
  query?: Query;
  body?: unknown;
  formData?: FormData;
  /** Do not broadcast a session-expired event on 401 (used by login / me). */
  silent401?: boolean;
}

let csrfToken: string | null = null;

export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

/** Fired when the API says the session is gone; AuthProvider listens and redirects to /login. */
export const UNAUTHORIZED_EVENT = "cafe:unauthorized";

function buildUrl(path: string, query?: Query) {
  const url = new URL(API_URL + path, typeof window !== "undefined" ? window.location.origin : "http://localhost");
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== "") url.searchParams.set(k, String(v));
    }
  }
  return url.toString();
}

async function request<T>(method: string, path: string, opts: RequestOptions = {}, retried = false): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;

  if (opts.formData) {
    body = opts.formData;
  } else if (opts.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(opts.body);
  }
  if (method !== "GET" && csrfToken) {
    headers["X-CSRF-Token"] = csrfToken;
  }

  let res: Response;
  try {
    res = await fetch(buildUrl(path, opts.query), {
      method,
      headers,
      body,
      credentials: "include",
      cache: "no-store",
    });
  } catch {
    throw new ApiError("Unable to reach the server. Check your connection and that the API is running.", 0);
  }

  let json: { success?: boolean; message?: string; data?: unknown; errors?: FieldErrors } | null = null;
  try {
    json = await res.json();
  } catch {
    json = null;
  }

  if (res.ok && json?.success !== false) {
    return (json?.data ?? null) as T;
  }

  // CSRF token missing/rotated (e.g. after a reload): refresh it once and retry.
  if (res.status === 419 && !retried) {
    try {
      const me = await request<{ csrf_token: string }>("GET", "/api/auth/me", { silent401: true });
      setCsrfToken(me.csrf_token);
      return request<T>(method, path, opts, true);
    } catch {
      /* fall through */
    }
  }

  if (res.status === 401 && !opts.silent401 && typeof window !== "undefined") {
    window.dispatchEvent(new Event(UNAUTHORIZED_EVENT));
  }

  const errors = json?.errors && !Array.isArray(json.errors) ? json.errors : {};
  throw new ApiError(json?.message ?? `Request failed (${res.status})`, res.status, errors);
}

const get = <T>(path: string, query?: Query) => request<T>("GET", path, { query });
const post = <T>(path: string, body?: unknown) => request<T>("POST", path, { body: body ?? {} });
const put = <T>(path: string, body?: unknown) => request<T>("PUT", path, { body: body ?? {} });
const del = <T>(path: string) => request<T>("DELETE", path);

/** Resolve an uploaded image path (/uploads/…) to an absolute URL. */
export function assetUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  if (/^https?:\/\//.test(path)) return path;
  return API_URL + path;
}

// ---------------------------------------------------------------------------
// Typed endpoints
// ---------------------------------------------------------------------------

export interface AuthPayload {
  user: User;
  csrf_token: string;
}

export interface ListParams extends Query {
  page?: number;
  per_page?: number;
  search?: string;
}

export interface TableInput {
  table_number: string;
  name?: string | null;
  capacity: number;
  section: string;
  status?: TableStatus;
  is_active?: boolean;
}

export interface CategoryInput {
  name: string;
  description?: string | null;
  sort_order?: number;
  is_active?: boolean;
}

export interface MenuItemInput {
  category_id: number;
  name: string;
  sku: string;
  description?: string | null;
  image?: string | null;
  selling_price: number;
  cost_price?: number | null;
  is_available?: boolean;
  track_inventory?: boolean;
  is_active?: boolean;
}

export interface InventoryInput {
  name: string;
  sku: string;
  unit: string;
  current_quantity?: number;
  minimum_quantity?: number;
  cost_per_unit?: number;
  supplier?: string | null;
  is_active?: boolean;
}

export interface StaffInput {
  name: string;
  email: string;
  phone?: string | null;
  role: "SUPERADMIN" | "STAFF";
  status?: "ACTIVE" | "INACTIVE";
  password?: string;
  password_confirmation?: string;
}

export interface PaymentInput {
  method: PaymentMethod;
  amount?: number;
  reference?: string | null;
  expected_total?: number;
}

export const api = {
  // Auth
  login: (email: string, password: string) =>
    request<AuthPayload>("POST", "/api/auth/login", { body: { email, password }, silent401: true }),
  logout: () => post<null>("/api/auth/logout"),
  me: () => request<AuthPayload>("GET", "/api/auth/me", { silent401: true }),
  changePassword: (body: { current_password: string; password: string; password_confirmation: string }) =>
    put<null>("/api/auth/password", body),
  updateProfile: (body: { name: string; phone?: string | null }) => put<User>("/api/auth/profile", body),

  // Tables
  getTables: (q?: { status?: TableStatus | ""; search?: string; section?: string; include_inactive?: boolean }) =>
    get<CafeTable[]>("/api/tables", q),
  getTable: (id: number) => get<CafeTable>(`/api/tables/${id}`),
  createTable: (body: TableInput) => post<CafeTable>("/api/tables", body),
  updateTable: (id: number, body: Partial<TableInput>) => put<CafeTable>(`/api/tables/${id}`, body),
  deleteTable: (id: number) => del<CafeTable | null>(`/api/tables/${id}`),
  setTableStatus: (id: number, status: "AVAILABLE" | "RESERVED" | "CLEANING") =>
    post<CafeTable>(`/api/tables/${id}/status`, { status }),

  // Categories
  getCategories: (q?: { include_inactive?: boolean; search?: string }) => get<Category[]>("/api/categories", q),
  createCategory: (body: CategoryInput) => post<Category>("/api/categories", body),
  updateCategory: (id: number, body: Partial<CategoryInput>) => put<Category>(`/api/categories/${id}`, body),
  deleteCategory: (id: number) => del<Category | null>(`/api/categories/${id}`),

  // Menu
  getMenuItems: (q?: ListParams & { category_id?: number; available?: boolean | ""; pos?: boolean; include_archived?: boolean }) =>
    get<Paginated<MenuItem>>("/api/menu", q),
  getMenuItem: (id: number) => get<MenuItem>(`/api/menu/${id}`),
  createMenuItem: (body: MenuItemInput) => post<MenuItem>("/api/menu", body),
  updateMenuItem: (id: number, body: Partial<MenuItemInput>) => put<MenuItem>(`/api/menu/${id}`, body),
  deleteMenuItem: (id: number) => del<MenuItem | null>(`/api/menu/${id}`),
  getRecipe: (menuItemId: number) => get<Recipe>(`/api/menu/${menuItemId}/recipe`),
  saveRecipe: (menuItemId: number, items: Pick<RecipeItem, "inventory_item_id" | "quantity" | "unit">[], trackInventory?: boolean) =>
    put<Recipe>(`/api/menu/${menuItemId}/recipe`, { items, track_inventory: trackInventory }),
  getRecipes: () => get<RecipeSummary[]>("/api/recipes"),

  // Orders
  getOrders: (q?: ListParams & {
    status?: string;
    open?: boolean;
    table_id?: number;
    payment_method?: PaymentMethod | "";
    from?: string;
    to?: string;
    created_by?: number;
  }) => get<Paginated<OrderSummary>>("/api/orders", q),
  getOrder: (id: number) => get<Order>(`/api/orders/${id}`),
  createOrder: (body: { table_id: number; items: OrderLineInput[]; notes?: string | null; send?: boolean }) =>
    post<Order>("/api/orders", body),
  updateOrder: (id: number, body: { items?: OrderLineInput[]; notes?: string | null }) => put<Order>(`/api/orders/${id}`, body),
  sendOrder: (id: number) => post<Order>(`/api/orders/${id}/send`),
  setOrderStatus: (id: number, status: OrderStatus) => post<Order>(`/api/orders/${id}/status`, { status }),
  applyDiscount: (id: number, discount_type: DiscountType | null, discount_value?: number) =>
    post<Order>(`/api/orders/${id}/discount`, { discount_type, discount_value }),
  cancelOrder: (id: number, reason: string) => post<Order>(`/api/orders/${id}/cancel`, { reason }),
  completePayment: (id: number, body: PaymentInput) => post<Order>(`/api/orders/${id}/payment`, body),
  getReceipt: (id: number) => get<ReceiptData>(`/api/orders/${id}/receipt`),

  // Inventory
  getInventory: (q?: ListParams & { status?: string; include_inactive?: boolean }) =>
    get<Paginated<InventoryItem>>("/api/inventory", q),
  getInventoryOptions: () => get<InventoryOption[]>("/api/inventory/options"),
  getInventoryItem: (id: number) => get<InventoryItem>(`/api/inventory/${id}`),
  createInventoryItem: (body: InventoryInput) => post<InventoryItem>("/api/inventory", body),
  updateInventoryItem: (id: number, body: Partial<Omit<InventoryInput, "current_quantity">>) =>
    put<InventoryItem>(`/api/inventory/${id}`, body),
  deleteInventoryItem: (id: number) => del<InventoryItem>(`/api/inventory/${id}`),
  adjustStock: (id: number, body: { type: AdjustmentType; quantity: number; reason?: string | null }) =>
    post<InventoryItem>(`/api/inventory/${id}/adjust`, body),
  getItemMovements: (id: number, q?: ListParams & { type?: string }) =>
    get<Paginated<StockMovement>>(`/api/inventory/${id}/movements`, q),
  getMovements: (q?: ListParams & { inventory_item_id?: number; type?: string; from?: string; to?: string }) =>
    get<Paginated<StockMovement>>("/api/inventory/movements", q),

  // Reports
  getDashboard: () => get<Dashboard>("/api/reports/dashboard"),
  getSalesReport: (q: { preset: ReportPreset; from?: string; to?: string }) => get<SalesReport>("/api/reports/sales", q),
  getTopItems: (q: { preset: ReportPreset; from?: string; to?: string; limit?: number }) =>
    get<{ range: ReportRange; items: TopItem[] }>("/api/reports/top-items", q),

  // Settings
  getSettings: () => get<Settings>("/api/settings"),
  updateSettings: (body: Partial<Settings>) => put<Settings>("/api/settings", body),

  // Staff
  getStaff: (q?: ListParams & { role?: string; status?: string }) => get<Paginated<User>>("/api/staff", q),
  getStaffMember: (id: number) => get<User>(`/api/staff/${id}`),
  createStaff: (body: StaffInput) => post<User>("/api/staff", body),
  updateStaff: (id: number, body: Partial<StaffInput>) => put<User>(`/api/staff/${id}`, body),
  deleteStaff: (id: number) => del<User | null>(`/api/staff/${id}`),
  resetStaffPassword: (id: number, password: string, password_confirmation: string) =>
    post<null>(`/api/staff/${id}/reset-password`, { password, password_confirmation }),

  // Audit logs
  getAuditLogs: (q?: ListParams & { user_id?: number; action?: string; entity_type?: string; from?: string; to?: string }) =>
    get<Paginated<AuditLog> & { actions: string[] }>("/api/audit-logs", q),

  // Uploads
  uploadImage: (file: File) => {
    const fd = new FormData();
    fd.append("file", file);
    return request<{ path: string; url: string }>("POST", "/api/uploads", { formData: fd });
  },
};

/** Human-friendly message for any thrown value. */
export function errorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (err instanceof ApiError) {
    const first = Object.values(err.errors)[0]?.[0];
    return err.status === 422 && first ? first : err.message;
  }
  if (err instanceof Error) return err.message;
  return fallback;
}
