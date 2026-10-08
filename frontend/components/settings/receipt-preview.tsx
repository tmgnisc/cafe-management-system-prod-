import { assetUrl } from "@/lib/api";
import { formatCurrency, previewBill } from "@/lib/currency";

interface PreviewValues {
  cafe_name: string;
  address: string;
  phone: string;
  pan_number: string;
  logo: string;
  currency_symbol: string;
  tax_label: string;
  tax_rate: number;
  service_charge_rate: number;
  tax_on_service_charge: boolean;
  receipt_footer: string;
}

const SAMPLE = [
  { name: "Cappuccino", qty: 2, price: 180 },
  { name: "Chicken Sandwich", qty: 1, price: 320 },
  { name: "French Fries", qty: 1, price: 180 },
];

/** Live preview of how a receipt will look with the current (unsaved) settings. */
export function ReceiptPreview({ values }: { values: PreviewValues }) {
  const sym = values.currency_symbol || "Rs.";
  const subtotal = SAMPLE.reduce((s, i) => s + i.qty * i.price, 0);
  const bill = previewBill(subtotal, { type: "FIXED", value: 60 }, {
    tax_rate: Number(values.tax_rate) || 0,
    service_charge_rate: Number(values.service_charge_rate) || 0,
    tax_on_service_charge: values.tax_on_service_charge,
  });
  const logo = assetUrl(values.logo);
  const money = (n: number) => formatCurrency(n, sym);

  return (
    <div className="mx-auto w-full max-w-[300px] rounded-sm bg-white px-5 py-6 font-mono text-[11px] leading-relaxed text-neutral-800 shadow-[0_10px_30px_-12px_oklch(0.3_0.04_50/0.35)] ring-1 ring-black/5">
      <div className="text-center">
        {logo && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={logo} alt="" className="mx-auto mb-2 h-12 w-12 rounded-full object-cover" />
        )}
        <div className="text-sm font-bold tracking-wide uppercase">{values.cafe_name || "Cafe name"}</div>
        {values.address && <div>{values.address}</div>}
        {values.phone && <div>Tel: {values.phone}</div>}
        {values.pan_number && <div>PAN/VAT: {values.pan_number}</div>}
      </div>
      <div className="my-2 border-t border-dashed border-neutral-400" />
      <div className="flex justify-between">
        <span>ORD-20261008-001</span>
        <span>Table 05</span>
      </div>
      <div className="my-2 border-t border-dashed border-neutral-400" />
      {SAMPLE.map((i) => (
        <div key={i.name} className="flex justify-between gap-2">
          <span className="truncate">
            {i.name} ×{i.qty}
          </span>
          <span>{money(i.qty * i.price)}</span>
        </div>
      ))}
      <div className="my-2 border-t border-dashed border-neutral-400" />
      <Row label="Subtotal" value={money(bill.subtotal)} />
      <Row label="Discount" value={`−${money(bill.discount)}`} />
      {Number(values.service_charge_rate) > 0 && <Row label={`Service (${values.service_charge_rate}%)`} value={money(bill.serviceCharge)} />}
      <Row label={`${values.tax_label || "Tax"} (${Number(values.tax_rate) || 0}%)`} value={money(bill.tax)} />
      <div className="my-2 border-t border-dashed border-neutral-400" />
      <div className="flex justify-between text-sm font-bold">
        <span>TOTAL</span>
        <span>{money(bill.total)}</span>
      </div>
      <div className="my-2 border-t border-dashed border-neutral-400" />
      <div className="text-center whitespace-pre-line">{values.receipt_footer || "Thank you!"}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
