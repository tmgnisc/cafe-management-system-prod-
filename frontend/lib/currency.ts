/** NPR formatting — always "Rs. 1,250" (2 decimals only when there are paisa). */
const whole = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });
const fraction = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatCurrency(amount: number | string | null | undefined, symbol = "Rs."): string {
  const n = Number(amount ?? 0);
  if (!Number.isFinite(n)) return `${symbol} 0`;
  const abs = Math.abs(n);
  const body = Math.round(abs * 100) % 100 === 0 ? whole.format(abs) : fraction.format(abs);
  return `${n < 0 ? "−" : ""}${symbol} ${body}`;
}

/** Compact axis labels: Rs. 12.5k */
export function formatCompactCurrency(amount: number, symbol = "Rs."): string {
  if (Math.abs(amount) >= 100000) return `${symbol} ${(amount / 100000).toFixed(1)}L`;
  if (Math.abs(amount) >= 1000) return `${symbol} ${(amount / 1000).toFixed(1)}k`;
  return `${symbol} ${Math.round(amount)}`;
}

/** Display-only bill preview. The PHP BillingService is authoritative. */
export function previewBill(
  subtotal: number,
  discount: { type: "PERCENTAGE" | "FIXED" | null; value: number },
  rates: { tax_rate: number; service_charge_rate: number; tax_on_service_charge: boolean },
) {
  const sub = Math.round(subtotal * 100);
  let disc = 0;
  if (discount.type === "PERCENTAGE") disc = Math.round((sub * discount.value) / 100);
  if (discount.type === "FIXED") disc = Math.round(discount.value * 100);
  disc = Math.max(0, Math.min(disc, sub));
  const after = sub - disc;
  const sc = Math.round((after * rates.service_charge_rate) / 100);
  const tax = Math.round(((after + (rates.tax_on_service_charge ? sc : 0)) * rates.tax_rate) / 100);
  return {
    subtotal: sub / 100,
    discount: disc / 100,
    serviceCharge: sc / 100,
    tax: tax / 100,
    total: (after + sc + tax) / 100,
  };
}
