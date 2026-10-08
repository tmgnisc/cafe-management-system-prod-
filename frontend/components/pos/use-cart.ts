"use client";

import { useCallback, useMemo, useState } from "react";
import type { MenuItem, Order, OrderLineInput } from "@/types";

/** A line in the POS cart. `id` is set for lines already saved on the server. */
export interface CartLine {
  key: string;
  id: number | null;
  menu_item_id: number;
  name: string;
  unit_price: number;
  quantity: number;
  notes: string;
  sent: boolean;
}

let seq = 0;
const newKey = () => `new-${Date.now()}-${++seq}`;

export function linesFromOrder(order: Order | null | undefined): CartLine[] {
  if (!order) return [];
  return order.items.map((i) => ({
    key: `srv-${i.id}`,
    id: i.id,
    menu_item_id: i.menu_item_id,
    name: i.item_name_snapshot,
    unit_price: i.unit_price,
    quantity: i.quantity,
    notes: i.notes ?? "",
    sent: i.sent_at !== null,
  }));
}

const versionOf = (order: Order | null | undefined) =>
  order ? `${order.id}|` + order.items.map((i) => `${i.id}:${i.quantity}:${i.notes ?? ""}:${i.sent_at ? 1 : 0}`).join(",") : null;

function signature(lines: CartLine[]) {
  return JSON.stringify(lines.map((l) => [l.id, l.menu_item_id, l.quantity, l.notes.trim()]));
}

/**
 * Local, optimistic cart for the POS. The server copy (order.items) is the
 * baseline; `dirty` tells the UI there are unsaved changes.
 */
export function useCart(order: Order | null | undefined) {
  const [lines, setLines] = useState<CartLine[]>(() => linesFromOrder(order));
  const [baseline, setBaseline] = useState<string>(() => signature(linesFromOrder(order)));
  const [syncedOrderVersion, setSyncedOrderVersion] = useState<string | null>(() => versionOf(order));

  // Re-sync when a different/newer server order arrives (render-phase state adjustment).
  const version = versionOf(order);
  if (version !== syncedOrderVersion) {
    const fresh = linesFromOrder(order);
    setSyncedOrderVersion(version);
    setLines(fresh);
    setBaseline(signature(fresh));
  }

  const add = useCallback((item: MenuItem) => {
    setLines((prev) => {
      // Merge into an existing unsent line without a note; otherwise start a new line.
      const idx = prev.findIndex((l) => l.menu_item_id === item.id && !l.sent && l.notes.trim() === "");
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = { ...next[idx]!, quantity: Math.min(999, next[idx]!.quantity + 1) };
        return next;
      }
      return [
        ...prev,
        { key: newKey(), id: null, menu_item_id: item.id, name: item.name, unit_price: item.selling_price, quantity: 1, notes: "", sent: false },
      ];
    });
  }, []);

  const setQuantity = useCallback((key: string, quantity: number) => {
    setLines((prev) =>
      quantity <= 0 ? prev.filter((l) => l.key !== key) : prev.map((l) => (l.key === key ? { ...l, quantity: Math.min(999, quantity) } : l)),
    );
  }, []);

  const setNotes = useCallback((key: string, notes: string) => {
    setLines((prev) => prev.map((l) => (l.key === key ? { ...l, notes: notes.slice(0, 255) } : l)));
  }, []);

  const remove = useCallback((key: string) => setLines((prev) => prev.filter((l) => l.key !== key)), []);

  const reset = useCallback(() => {
    const fresh = linesFromOrder(order);
    setLines(fresh);
    setBaseline(signature(fresh));
  }, [order]);

  const subtotal = useMemo(() => Math.round(lines.reduce((s, l) => s + Math.round(l.unit_price * 100) * l.quantity, 0)) / 100, [lines]);
  const itemCount = useMemo(() => lines.reduce((s, l) => s + l.quantity, 0), [lines]);
  const dirty = signature(lines) !== baseline;

  const payload = useCallback(
    (): OrderLineInput[] => lines.map((l) => ({ id: l.id, menu_item_id: l.menu_item_id, quantity: l.quantity, notes: l.notes.trim() || null })),
    [lines],
  );

  return { lines, add, setQuantity, setNotes, remove, reset, subtotal, itemCount, dirty, payload, unsentCount: lines.filter((l) => !l.sent).length };
}
