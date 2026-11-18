import { D, Decimal, Num, round2 } from './money';
import type { LineKind } from './tax';

export type KitQtyMode = 'FIXED' | 'PER_PANEL' | 'PER_KW';

export interface CatalogueProduct {
  id: string;
  name: string;
  category: string;
  specification?: string | null;
  unit: string;
  hsnSac: string;
  price: Num;
}

export interface KitItemInput {
  product: CatalogueProduct;
  qtyMode: KitQtyMode;
  quantity: Num;
  sortOrder?: number;
}

export interface BomLine {
  productId: string | null;
  kind: LineKind;
  name: string;
  specification: string;
  hsnSac: string;
  unit: string;
  quantity: Decimal;
  unitPrice: Decimal;
  amount: Decimal;
}

/** Panels needed for a system size: 3.3 kW with 550 Wp modules → 6. */
export function panelCount(systemSizeKw: Num, wattPeak: Num): number {
  const wp = D(wattPeak);
  if (wp.lte(0)) return 0;
  return D(systemSizeKw).times(1000).div(wp).ceil().toNumber();
}

export const lineAmount = (quantity: Num, unitPrice: Num): Decimal => round2(D(quantity).times(unitPrice));

function toLine(p: CatalogueProduct, quantity: Decimal): BomLine {
  return {
    productId: p.id,
    kind: p.category === 'SERVICE' ? 'SERVICE' : 'GOODS',
    name: p.name,
    specification: p.specification ?? '',
    hsnSac: p.hsnSac,
    unit: p.unit,
    quantity,
    unitPrice: D(p.price),
    amount: lineAmount(quantity, p.price),
  };
}

const WHOLE_UNITS = new Set(['NOS', 'SET', 'M']);

/** Kit quantity for a job. Scaled quantities of countable units (Nos, Set, m) round up to whole units. */
export function kitQuantity(mode: KitQtyMode, quantity: Num, systemSizeKw: Num, panels: number, unit = 'NOS'): Decimal {
  const q = D(quantity);
  if (mode === 'FIXED') return q;
  const scaled = mode === 'PER_PANEL' ? q.times(panels) : q.times(systemSizeKw);
  return WHOLE_UNITS.has(unit) ? scaled.ceil() : scaled.toDecimalPlaces(3);
}

/** Module + inverter + kit → the full bill of materials. */
export function expandKit(input: {
  systemSizeKw: Num;
  module?: (CatalogueProduct & { wattPeak?: number | null }) | null;
  inverter?: CatalogueProduct | null;
  kitItems: KitItemInput[];
}): { panelCount: number; lines: BomLine[] } {
  const panels = input.module?.wattPeak ? panelCount(input.systemSizeKw, input.module.wattPeak) : 0;
  const lines: BomLine[] = [];
  if (input.module) lines.push(toLine(input.module, D(panels)));
  if (input.inverter) lines.push(toLine(input.inverter, D(1)));
  const items = [...input.kitItems].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
  for (const it of items) {
    lines.push(toLine(it.product, kitQuantity(it.qtyMode, it.quantity, input.systemSizeKw, panels, it.product.unit)));
  }
  return { panelCount: panels, lines };
}
