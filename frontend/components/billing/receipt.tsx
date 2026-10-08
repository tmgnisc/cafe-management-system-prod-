/* eslint-disable @next/next/no-img-element -- logo is served by the PHP API host */
import { assetUrl } from "@/lib/api";
import { formatCurrency } from "@/lib/currency";
import { formatDateTime, humanize } from "@/lib/utils";
import type { ReceiptData } from "@/types";

/**
 * Thermal-receipt layout (≈72mm printable width). Wrap in `.print-area`
 * so the global print stylesheet prints only the receipt.
 */
export function Receipt({ data }: { data: ReceiptData }) {
  const { order, cafe } = data;
  const sym = cafe.currency_symbol || "Rs.";
  const money = (n: number) => formatCurrency(n, sym);
  const paid = order.payment_status === "PAID" && order.payment;
  const logo = assetUrl(cafe.logo);

  return (
    <div className="mx-auto w-[300px] bg-white px-4 py-5 font-mono text-[12px] leading-[1.45] text-black">
      <div className="text-center">
        {logo && <img src={logo} alt="" className="mx-auto mb-2 h-12 w-auto object-contain grayscale" />}
        <div className="font-display text-[17px] font-bold tracking-wide uppercase">{cafe.name}</div>
        {cafe.address && <div>{cafe.address}</div>}
        {cafe.phone && <div>Tel: {cafe.phone}</div>}
        {cafe.pan_number && <div>PAN/VAT: {cafe.pan_number}</div>}
      </div>

      <Rule />
      {!paid && <div className="mb-1 text-center font-bold">*** PRE-BILL — NOT PAID ***</div>}
      {order.status === "CANCELLED" && <div className="mb-1 text-center font-bold">*** CANCELLED ***</div>}
      <KV k="Order" v={order.order_number} />
      <KV k="Table" v={order.table_number} />
      <KV k="Staff" v={order.created_by_name} />
      <KV k="Date" v={formatDateTime(order.completed_at ?? order.created_at, "dd MMM yyyy, h:mm a")} />
      <Rule />

      <div className="flex font-bold">
        <span className="flex-1">Item</span>
        <span className="w-8 text-center">Qty</span>
        <span className="w-20 text-right">Amount</span>
      </div>
      <Rule dashed />
      {order.items.map((i) => (
        <div key={i.id} className="mb-0.5">
          <div className="flex">
            <span className="flex-1 pr-1 break-words">{i.item_name_snapshot}</span>
            <span className="w-8 text-center">{i.quantity}</span>
            <span className="w-20 text-right">{money(i.line_total)}</span>
          </div>
          {i.quantity > 1 && <div className="pl-2 text-[11px]">@ {money(i.unit_price)}</div>}
          {i.notes && <div className="pl-2 text-[11px] italic">* {i.notes}</div>}
        </div>
      ))}
      <Rule />

      <KV k="Subtotal" v={money(order.subtotal)} />
      <KV k={`Discount${order.discount_type === "PERCENTAGE" ? ` (${order.discount_value}%)` : ""}`} v={money(order.discount_amount)} />
      {order.service_charge_amount > 0 && <KV k={`Service Charge (${order.service_charge_rate}%)`} v={money(order.service_charge_amount)} />}
      <KV k={`${cafe.tax_label || "Tax"}${order.tax_rate > 0 ? ` (${order.tax_rate}%)` : ""}`} v={money(order.tax_amount)} />
      <Rule />
      <div className="flex justify-between text-[15px] font-bold">
        <span>TOTAL</span>
        <span>{money(order.grand_total)}</span>
      </div>
      <Rule />

      {paid && order.payment && (
        <>
          <KV k="Payment" v={humanize(order.payment.method)} />
          {order.payment.method === "CASH" && (
            <>
              <KV k="Received" v={money(order.payment.tendered_amount)} />
              <KV k="Change" v={money(order.payment.change_amount)} />
            </>
          )}
          {order.payment.reference && <KV k="Ref" v={order.payment.reference} />}
          <Rule />
        </>
      )}

      <div className="mt-2 text-center">
        {cafe.receipt_footer
          .split("\n")
          .filter(Boolean)
          .map((line, idx) => (
            <div key={idx}>{line}</div>
          ))}
      </div>
    </div>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex justify-between gap-2">
      <span>{k}</span>
      <span className="text-right">{v}</span>
    </div>
  );
}

function Rule({ dashed }: { dashed?: boolean }) {
  return <div className={`my-1.5 border-t ${dashed ? "border-dashed" : "border-solid"} border-black`} />;
}
