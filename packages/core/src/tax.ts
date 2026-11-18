import { D, Decimal, Num, round2, roundRupee } from './money';
import { amountInWords } from './words';

export type SupplyType = 'EPC_COMPOSITE' | 'SUPPLY_ONLY' | 'SERVICE_ONLY';
export type LineKind = 'GOODS' | 'SERVICE';

/** Values come from the TaxConfig table — never hard-code rates here. */
export interface TaxConfigInput {
  epcGoodsShare: Num; // 0.70
  goodsRate: Num; // 5
  serviceRate: Num; // 18
  goodsHsn: string;
  serviceSac: string;
}

export interface TaxInput {
  contractValue: Num; // pre-GST
  supplyType: SupplyType;
  sellerStateCode: string;
  buyerStateCode: string; // place of supply
  config: TaxConfigInput;
  systemSizeKw?: Num; // only used for line descriptions
}

export interface TaxLine {
  kind: LineKind;
  description: string;
  detail: string;
  hsnSac: string;
  taxableValue: Decimal;
  gstRate: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  total: Decimal;
}

export interface TaxResult {
  isInterState: boolean;
  lines: TaxLine[];
  goodsValue: Decimal;
  serviceValue: Decimal;
  taxableValue: Decimal;
  cgst: Decimal;
  sgst: Decimal;
  igst: Decimal;
  totalTax: Decimal;
  grossTotal: Decimal; // before rounding to the rupee
  roundOff: Decimal;
  total: Decimal;
  amountInWords: string;
}

/** Tax on one line, rounded to paise. Intra-state splits the rate equally into CGST and SGST. */
export function lineTax(taxableValue: Num, gstRate: Num, isInterState: boolean) {
  const taxable = round2(taxableValue);
  const rate = D(gstRate);
  if (isInterState) {
    const igst = round2(taxable.times(rate).div(100));
    return { cgst: D(0), sgst: D(0), igst, total: taxable.plus(igst) };
  }
  const half = round2(taxable.times(rate).div(200));
  return { cgst: half, sgst: half, igst: D(0), total: taxable.plus(half).plus(half) };
}

/** Round a document total to the rupee and report the difference as round-off. */
export function roundTotal(gross: Num) {
  const g = round2(gross);
  const total = roundRupee(g);
  return { total, roundOff: total.minus(g) };
}

const pct = (share: Decimal) => share.times(100).toDecimalPlaces(2).toString();

/**
 * The one function behind every figure printed on a quote or invoice.
 * EPC composite: goods share of the contract at the goods rate, the rest at the service rate.
 * Supply-only / service-only: whole contract at the goods / service rate (pending CA confirmation).
 */
export function computeTax(input: TaxInput): TaxResult {
  const contract = round2(input.contractValue);
  if (contract.isNegative()) throw new Error('Contract value cannot be negative');
  const cfg = input.config;
  const isInterState = input.sellerStateCode !== input.buyerStateCode;
  const size = input.systemSizeKw != null ? `${D(input.systemSizeKw).toString()} kW on-grid, ` : '';
  const share = D(cfg.epcGoodsShare);

  let goodsValue = D(0);
  let serviceValue = D(0);
  let goodsNote = '';
  let serviceNote = '';
  if (input.supplyType === 'EPC_COMPOSITE') {
    goodsValue = round2(contract.times(share));
    serviceValue = contract.minus(goodsValue);
    goodsNote = ` (${pct(share)}% of contract value)`;
    serviceNote = ` (${pct(D(1).minus(share))}% of contract value)`;
  } else if (input.supplyType === 'SUPPLY_ONLY') {
    goodsValue = contract;
  } else {
    serviceValue = contract;
  }

  const lines: TaxLine[] = [];
  if (input.supplyType !== 'SERVICE_ONLY') {
    lines.push({
      kind: 'GOODS',
      description: 'Supply of Solar Power Generating System',
      detail: `${size}as per quotation BOM${goodsNote}`,
      hsnSac: cfg.goodsHsn,
      taxableValue: goodsValue,
      gstRate: D(cfg.goodsRate),
      ...lineTax(goodsValue, cfg.goodsRate, isInterState),
    });
  }
  if (input.supplyType !== 'SUPPLY_ONLY') {
    lines.push({
      kind: 'SERVICE',
      description: 'Installation & Commissioning Services',
      detail: `Erection, testing, commissioning${serviceNote}`,
      hsnSac: cfg.serviceSac,
      taxableValue: serviceValue,
      gstRate: D(cfg.serviceRate),
      ...lineTax(serviceValue, cfg.serviceRate, isInterState),
    });
  }

  const sum = (f: (l: TaxLine) => Decimal) => lines.reduce((a, l) => a.plus(f(l)), D(0));
  const cgst = sum((l) => l.cgst);
  const sgst = sum((l) => l.sgst);
  const igst = sum((l) => l.igst);
  const totalTax = cgst.plus(sgst).plus(igst);
  const grossTotal = contract.plus(totalTax);
  const { total, roundOff } = roundTotal(grossTotal);

  return {
    isInterState, lines, goodsValue, serviceValue, taxableValue: contract,
    cgst, sgst, igst, totalTax, grossTotal, roundOff, total,
    amountInWords: amountInWords(total),
  };
}
