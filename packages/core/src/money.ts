import Decimal from 'decimal.js';

export type Num = Decimal.Value;
export { Decimal };

export const D = (v: Num): Decimal => new Decimal(v);

/** Round to paise, half up. The one rounding rule for tax and line amounts. */
export const round2 = (v: Num): Decimal => D(v).toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

/** Round to the whole rupee, half up. Used for document totals. */
export const roundRupee = (v: Num): Decimal => D(v).toDecimalPlaces(0, Decimal.ROUND_HALF_UP);

/** Indian digit grouping: 1089000 → "10,89,000.00". */
export function formatINR(v: Num, opts: { decimals?: number; symbol?: boolean } = {}): string {
  const decimals = opts.decimals ?? 2;
  const d = D(v);
  const neg = d.isNegative();
  const fixed = d.abs().toFixed(decimals, Decimal.ROUND_HALF_UP);
  const [intPart, frac] = fixed.split('.');
  let grouped = intPart;
  if (intPart.length > 3) {
    const last3 = intPart.slice(-3);
    const rest = intPart.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
    grouped = `${rest},${last3}`;
  }
  const body = frac ? `${grouped}.${frac}` : grouped;
  return `${neg ? '-' : ''}${opts.symbol ? '₹' : ''}${body}`;
}
