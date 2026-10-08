import { format, formatDistanceToNowStrict, parseISO } from "date-fns";

export { cn } from "cn";

/** API timestamps are "YYYY-MM-DD HH:mm:ss" in cafe local time. */
export function parseApiDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const d = parseISO(value.replace(" ", "T"));
  return Number.isNaN(d.getTime()) ? null : d;
}

export function formatDateTime(value: string | null | undefined, pattern = "dd MMM yyyy, h:mm a"): string {
  const d = parseApiDate(value);
  return d ? format(d, pattern) : "—";
}

export function formatDate(value: string | null | undefined, pattern = "dd MMM yyyy"): string {
  return formatDateTime(value, pattern);
}

export function timeAgo(value: string | null | undefined): string {
  const d = parseApiDate(value);
  return d ? formatDistanceToNowStrict(d, { addSuffix: true }) : "—";
}

/** 0.036 → "0.036", 5 → "5" */
export function formatQty(n: number | null | undefined, maxDecimals = 3): string {
  const v = Number(n ?? 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(maxDecimals).replace(/\.?0+$/, "");
}

/** "BANK_TRANSFER" → "Bank Transfer", "ESEWA" → "eSewa" */
export function humanize(value: string | null | undefined): string {
  if (!value) return "";
  const special: Record<string, string> = { ESEWA: "eSewa", KHALTI: "Khalti", SUPERADMIN: "Super Admin" };
  if (special[value]) return special[value];
  return value
    .toLowerCase()
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join("");
}

export function todayISO(): string {
  return format(new Date(), "yyyy-MM-dd");
}
