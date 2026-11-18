import { describe, expect, it } from 'vitest';
import {
  amountInWords, computeSubsidy, computeTax, estimateSavings, expandKit, financialYear, formatDocNumber,
  formatINR, panelCount, roundTotal, splitMilestones, type TaxConfigInput,
} from '../src';

const config: TaxConfigInput = { epcGoodsShare: '0.70', goodsRate: '5', serviceRate: '18', goodsHsn: '8541', serviceSac: '9954' };
const s = (d: { toFixed(n: number): string }) => d.toFixed(2);

describe('tax engine', () => {
  it('EPC composite, intra-state: ₹10,00,000 → ₹89,000 GST, ₹10,89,000 total', () => {
    const r = computeTax({ contractValue: '1000000', supplyType: 'EPC_COMPOSITE', sellerStateCode: '24', buyerStateCode: '24', config });
    expect(r.isInterState).toBe(false);
    expect(s(r.goodsValue)).toBe('700000.00');
    expect(s(r.serviceValue)).toBe('300000.00');
    expect(r.lines.map((l) => [s(l.cgst), s(l.sgst), s(l.total)])).toEqual([
      ['17500.00', '17500.00', '735000.00'],
      ['27000.00', '27000.00', '354000.00'],
    ]);
    expect(s(r.cgst)).toBe('44500.00');
    expect(s(r.sgst)).toBe('44500.00');
    expect(s(r.igst)).toBe('0.00');
    expect(s(r.totalTax)).toBe('89000.00');
    expect(s(r.roundOff)).toBe('0.00');
    expect(s(r.total)).toBe('1089000.00');
    expect(r.amountInWords).toBe('Rupees Ten Lakh Eighty-Nine Thousand Only');
  });

  it('inter-state uses IGST at the full rate', () => {
    const r = computeTax({ contractValue: '1000000', supplyType: 'EPC_COMPOSITE', sellerStateCode: '24', buyerStateCode: '27', config });
    expect(r.isInterState).toBe(true);
    expect(s(r.cgst)).toBe('0.00');
    expect(s(r.igst)).toBe('89000.00');
    expect(r.lines.map((l) => s(l.igst))).toEqual(['35000.00', '54000.00']);
    expect(s(r.total)).toBe('1089000.00');
  });

  it('supply-only: one goods line at the goods rate', () => {
    const r = computeTax({ contractValue: '200000', supplyType: 'SUPPLY_ONLY', sellerStateCode: '24', buyerStateCode: '24', config });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].kind).toBe('GOODS');
    expect(s(r.totalTax)).toBe('10000.00');
    expect(s(r.total)).toBe('210000.00');
  });

  it('service-only: one service line at the service rate', () => {
    const r = computeTax({ contractValue: '50000', supplyType: 'SERVICE_ONLY', sellerStateCode: '24', buyerStateCode: '24', config });
    expect(r.lines).toHaveLength(1);
    expect(r.lines[0].kind).toBe('SERVICE');
    expect(s(r.totalTax)).toBe('9000.00');
    expect(s(r.total)).toBe('59000.00');
  });

  it('goods and service values always add back to the contract value', () => {
    const r = computeTax({ contractValue: '185333.33', supplyType: 'EPC_COMPOSITE', sellerStateCode: '24', buyerStateCode: '24', config });
    expect(s(r.goodsValue.plus(r.serviceValue))).toBe('185333.33');
    expect(s(r.total.minus(r.roundOff))).toBe(s(r.grossTotal));
  });

  it('round-off: .49 rounds down, .50 rounds up', () => {
    expect(roundTotal('10.49')).toMatchObject({});
    expect(s(roundTotal('10.49').total)).toBe('10.00');
    expect(s(roundTotal('10.49').roundOff)).toBe('-0.49');
    expect(s(roundTotal('544.50').total)).toBe('545.00');
    expect(s(roundTotal('544.50').roundOff)).toBe('0.50');
    const r = computeTax({ contractValue: '500', supplyType: 'EPC_COMPOSITE', sellerStateCode: '24', buyerStateCode: '24', config });
    expect(s(r.grossTotal)).toBe('544.50');
    expect(s(r.total)).toBe('545.00');
    expect(s(r.roundOff)).toBe('0.50');
  });
});

describe('amount in words', () => {
  it('handles 1, 1 lakh and 1 crore', () => {
    expect(amountInWords(1)).toBe('Rupees One Only');
    expect(amountInWords(100000)).toBe('Rupees One Lakh Only');
    expect(amountInWords(10000000)).toBe('Rupees One Crore Only');
  });
  it('handles mixed amounts and paise', () => {
    expect(amountInWords('254826')).toBe('Rupees Two Lakh Fifty-Four Thousand Eight Hundred Twenty-Six Only');
    expect(amountInWords('1250.50')).toBe('Rupees One Thousand Two Hundred Fifty and Paise Fifty Only');
    expect(amountInWords('1234567890')).toBe('Rupees One Hundred Twenty-Three Crore Forty-Five Lakh Sixty-Seven Thousand Eight Hundred Ninety Only');
  });
});

describe('formatting and numbering', () => {
  it('formats in lakh/crore grouping', () => {
    expect(formatINR('1089000')).toBe('10,89,000.00');
    expect(formatINR('999.5')).toBe('999.50');
    expect(formatINR('12345678.9', { symbol: true })).toBe('₹1,23,45,678.90');
    expect(formatINR('-78000', { decimals: 0 })).toBe('-78,000');
  });
  it('financial year runs April to March', () => {
    expect(financialYear(new Date('2026-11-14T06:00:00Z'))).toBe('26-27');
    expect(financialYear(new Date('2027-03-31T12:00:00Z'))).toBe('26-27');
    expect(financialYear(new Date('2027-03-31T19:00:00Z'))).toBe('27-28'); // already 1 April in IST
    expect(formatDocNumber('NSE/', '26-27', 1)).toBe('NSE/26-27/0001');
    expect(formatDocNumber('NSE/Q/', '26-27', 42)).toBe('NSE/Q/26-27/0042');
  });
});

describe('kits', () => {
  const p = (id: string, name: string, category: string, unit: string, price: string) =>
    ({ id, name, category, unit, hsnSac: '8541', price, specification: '' });
  it('panel count rounds up from wattage', () => {
    expect(panelCount('3.3', 550)).toBe(6);
    expect(panelCount('5', 550)).toBe(10);
    expect(panelCount('3', 545)).toBe(6);
  });
  it('fills the BOM from module, inverter and kit', () => {
    const r = expandKit({
      systemSizeKw: '3.3',
      module: { ...p('m', 'Solar PV modules', 'MODULE', 'NOS', '13750'), wattPeak: 550 },
      inverter: p('i', 'Grid-tie inverter', 'INVERTER', 'NOS', '28000'),
      kitItems: [
        { product: p('s', 'Mounting structure', 'STRUCTURE', 'KW', '6000'), qtyMode: 'PER_KW', quantity: '1', sortOrder: 1 },
        { product: p('c', 'DC cable', 'CABLE_DC', 'M', '60'), qtyMode: 'PER_PANEL', quantity: '5', sortOrder: 2 },
        { product: p('n', 'Installation & commissioning', 'SERVICE', 'JOB', '15000'), qtyMode: 'FIXED', quantity: '1', sortOrder: 3 },
      ],
    });
    expect(r.panelCount).toBe(6);
    expect(r.lines.map((l) => [l.name, l.quantity.toString(), s(l.amount), l.kind])).toEqual([
      ['Solar PV modules', '6', '82500.00', 'GOODS'],
      ['Grid-tie inverter', '1', '28000.00', 'GOODS'],
      ['Mounting structure', '3.3', '19800.00', 'GOODS'],
      ['DC cable', '30', '1800.00', 'GOODS'],
      ['Installation & commissioning', '1', '15000.00', 'SERVICE'],
    ]);
  });
});

describe('subsidy and savings', () => {
  const slabs = [
    { fromKw: '0', toKw: '2', amountPerKw: '30000' },
    { fromKw: '2', toKw: '3', amountPerKw: '18000' },
  ];
  it('applies slabs and the cap', () => {
    expect(s(computeSubsidy('1', slabs, '78000'))).toBe('30000.00');
    expect(s(computeSubsidy('2.5', slabs, '78000'))).toBe('69000.00');
    expect(s(computeSubsidy('3.3', slabs, '78000'))).toBe('78000.00');
    expect(s(computeSubsidy('10', slabs, '78000'))).toBe('78000.00');
  });
  it('estimates generation and payback', () => {
    const e = estimateSavings({ systemSizeKw: '3.3', unitsPerKwDay: '4', tariffPerUnit: '7', netCost: '121660' });
    expect(s(e.annualGenerationKwh)).toBe('4818.00');
    expect(s(e.annualSavings)).toBe('33726.00');
    expect(e.paybackYears?.toString()).toBe('3.6');
  });
  it('milestones add up to the total', () => {
    const m = splitMilestones('199667', ['30', '60', '10']);
    expect(m.map(s)).toEqual(['59900.10', '119800.20', '19966.70']);
    expect(s(m.reduce((a, b) => a.plus(b)))).toBe('199667.00');
  });
});
