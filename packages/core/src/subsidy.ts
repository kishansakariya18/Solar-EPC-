import { D, Decimal, Num, round2 } from './money';

export interface SubsidySlabInput {
  fromKw: Num;
  toKw: Num;
  amountPerKw: Num;
}

/**
 * Slab subsidy: each slab pays amountPerKw for the capacity that falls inside it.
 * PM Surya Ghar example: 0–2 kW at ₹30,000/kW, 2–3 kW at ₹18,000/kW, capped at ₹78,000.
 */
export function computeSubsidy(systemSizeKw: Num, slabs: SubsidySlabInput[], maxAmount?: Num | null): Decimal {
  const size = D(systemSizeKw);
  let total = D(0);
  for (const s of slabs) {
    const from = D(s.fromKw);
    if (size.lte(from)) continue;
    const covered = Decimal.min(size, D(s.toKw)).minus(from);
    if (covered.gt(0)) total = total.plus(covered.times(s.amountPerKw));
  }
  if (maxAmount != null && total.gt(maxAmount)) total = D(maxAmount);
  return round2(total);
}

export interface SavingsEstimate {
  annualGenerationKwh: Decimal;
  annualSavings: Decimal;
  paybackYears: Decimal | null;
  savings25Years: Decimal;
}

/** Simple estimate shown on the quotation; not a guarantee of output. */
export function estimateSavings(input: {
  systemSizeKw: Num;
  unitsPerKwDay: Num;
  tariffPerUnit: Num;
  netCost: Num;
}): SavingsEstimate {
  const annualGenerationKwh = round2(D(input.systemSizeKw).times(input.unitsPerKwDay).times(365));
  const annualSavings = round2(annualGenerationKwh.times(input.tariffPerUnit));
  const paybackYears = annualSavings.gt(0) ? D(input.netCost).div(annualSavings).toDecimalPlaces(1) : null;
  return { annualGenerationKwh, annualSavings, paybackYears, savings25Years: round2(annualSavings.times(25)) };
}

/** Split a total across milestone percentages; the last milestone absorbs rounding. */
export function splitMilestones(total: Num, percents: Num[]): Decimal[] {
  const t = D(total);
  const out: Decimal[] = [];
  let used = D(0);
  percents.forEach((p, i) => {
    const amt = i === percents.length - 1 && D(percents.reduce((a, b) => D(a).plus(b), D(0))).eq(100)
      ? t.minus(used)
      : round2(t.times(p).div(100));
    used = used.plus(amt);
    out.push(amt);
  });
  return out;
}
