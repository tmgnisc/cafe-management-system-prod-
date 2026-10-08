import type { InventoryUnit } from "@/types";

const FAMILY: Partial<Record<InventoryUnit, [string, number]>> = {
  g: ["mass", 1],
  kg: ["mass", 1000],
  ml: ["volume", 1],
  liter: ["volume", 1000],
};

/** Units a recipe may use for an ingredient tracked in `unit` (mirrors the PHP InventoryService). */
export function compatibleUnits(unit: InventoryUnit): InventoryUnit[] {
  const fam = FAMILY[unit]?.[0];
  if (!fam) return [unit];
  return (Object.keys(FAMILY) as InventoryUnit[]).filter((u) => FAMILY[u]![0] === fam);
}

/** Smaller unit is the natural default for recipes (18 g rather than 0.018 kg). */
export function defaultRecipeUnit(unit: InventoryUnit): InventoryUnit {
  if (unit === "kg") return "g";
  if (unit === "liter") return "ml";
  return unit;
}

export function convertQty(qty: number, from: InventoryUnit, to: InventoryUnit): number {
  if (from === to) return qty;
  const a = FAMILY[from];
  const b = FAMILY[to];
  if (!a || !b || a[0] !== b[0]) return NaN;
  return (qty * a[1]) / b[1];
}
