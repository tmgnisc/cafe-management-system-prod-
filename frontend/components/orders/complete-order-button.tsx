"use client";

import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { BillDialog } from "@/components/billing/bill-dialog";
import { useSettings } from "@/hooks/use-settings";
import { api, errorMessage } from "@/lib/api";
import { qk } from "@/lib/query-keys";
import type { Order } from "@/types";

/**
 * Settle an open order straight from the order list / detail page:
 * bill → optional discount → Cash or online payment → COMPLETED.
 * Uses the same server-side payment transaction as the POS.
 */
export function CompleteOrderButton({
  orderId,
  size = "sm",
  className,
  onCompleted,
}: {
  orderId: number;
  size?: "sm" | "default";
  className?: string;
  onCompleted?: (order: Order) => void;
}) {
  const queryClient = useQueryClient();
  const settings = useSettings().data;
  const [order, setOrder] = useState<Order | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  const start = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setLoading(true);
    try {
      const o = await api.getOrder(orderId);
      if (!o.is_editable) {
        toast.info(`Order ${o.order_number} is already ${o.status.toLowerCase()}`);
        void queryClient.invalidateQueries({ queryKey: qk.ordersAll });
        return;
      }
      setOrder(o);
      setOpen(true);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  const store = (o: Order) => {
    setOrder(o);
    queryClient.setQueryData(qk.order(o.id), o);
  };

  return (
    <>
      <Button size={size} className={className} onClick={start} disabled={loading}>
        {loading ? <Loader2 className="animate-spin" /> : <CheckCircle2 />} Complete
      </Button>
      {order && (
        // Stop clicks inside the (portalled) dialog from bubbling to clickable table rows.
        <div onClick={(e) => e.stopPropagation()} className="contents">
          <BillDialog
            open={open}
            onOpenChange={setOpen}
            order={order}
            settings={settings}
            doneLabel="Done"
            onOrderChange={store}
            onPaid={(o) => {
              store(o);
              for (const key of [qk.ordersAll, qk.tablesAll, qk.dashboard, qk.table(o.table_id), ["sales-report"]]) {
                void queryClient.invalidateQueries({ queryKey: key });
              }
              onCompleted?.(o);
            }}
          />
        </div>
      )}
    </>
  );
}
