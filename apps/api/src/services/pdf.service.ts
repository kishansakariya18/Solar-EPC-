import { D, computeTax, estimateSavings, stateName, type SupplyType } from '@solar-epc/core';
import { renderInvoiceHtml, renderQuotationHtml, type InvoiceDoc, type QuotationDoc } from '@solar-epc/pdf';
import { chromium, type Browser } from 'playwright-core';
import QRCode from 'qrcode';
import { prisma } from '../db';
import { env } from '../env';
import { notFound, type Ctx } from '../lib/http';
import type { BuyerSnapshot, SellerSnapshot, TaxSnapshot } from '../lib/snapshots';

const pct = (v: string | number) => String(Number(D(v).times(100).toFixed(2)));
const rate = (v: string) => String(Number(v));

/** Documents are always built from the frozen snapshots, never from live company or customer rows. */
export async function quotationDoc(ctx: Ctx, quotationId: string, versionNo: number): Promise<QuotationDoc> {
  const v = await prisma.quotationVersion.findFirst({
    where: { quotationId, version: versionNo, quotation: { companyId: ctx.companyId } },
    include: {
      quotation: true,
      lines: { orderBy: { sortOrder: 'asc' }, include: { product: { select: { category: true } } } },
      milestones: { orderBy: { sortOrder: 'asc' } },
    },
  });
  if (!v) throw notFound('Quotation version');
  const seller = v.sellerSnapshot as unknown as SellerSnapshot;
  const buyer = v.buyerSnapshot as unknown as BuyerSnapshot;
  const snap = v.taxSnapshot as unknown as TaxSnapshot;
  const site = buyer.site;

  const tax = computeTax({
    contractValue: v.contractValue.toString(), supplyType: v.supplyType as SupplyType,
    sellerStateCode: seller.stateCode, buyerStateCode: v.placeOfSupplyStateCode, config: snap,
  });
  const share = pct(snap.epcGoodsShare);
  const taxRows = tax.lines.map((l) => {
    const amount = l.cgst.plus(l.sgst).plus(l.igst).toFixed(2);
    const r = `GST @ ${rate(l.gstRate.toString())}%`;
    if (v.supplyType !== 'EPC_COMPOSITE') return { label: r, amount };
    return l.kind === 'GOODS' ? { label: `${r} on ${share}% (goods)`, amount } : { label: `${r} on ${100 - Number(share)}% (services)`, amount };
  });

  const moduleLine = v.lines.find((l) => l.product?.category === 'MODULE');
  const inverterLine = v.lines.find((l) => l.product?.category === 'INVERTER');
  const details = [
    moduleLine ? `Modules: ${Number(moduleLine.quantity)} × ${moduleLine.specification ?? moduleLine.name}` : '',
    inverterLine ? `Inverter: ${inverterLine.specification ?? inverterLine.name}` : '',
    site?.roofType ? `Roof: ${site.roofType}` : '',
    snap.subsidySchemeName && Number(v.subsidyAmount) > 0 ? `Scheme: ${snap.subsidySchemeName}` : '',
  ].filter(Boolean);

  const addr = site ?? buyer;
  const savings = v.annualGenerationKwh && v.annualSavings && v.tariffPerUnit && snap.unitsPerKwDay
    ? estimateSavings({ systemSizeKw: v.systemSizeKw.toString(), unitsPerKwDay: snap.unitsPerKwDay, tariffPerUnit: v.tariffPerUnit.toString(), netCost: v.netCostToCustomer.toString() })
    : null;

  return {
    seller, number: v.quotation.number, version: v.version, date: v.createdAt, validUntil: v.quotation.validUntil,
    buyer: {
      name: buyer.name, phone: buyer.phone,
      addressLines: [[addr.addressLine1, addr.addressLine2].filter(Boolean).join(', '), `${addr.city} – ${addr.pincode}`],
      discomName: site?.discomName, consumerNumber: site?.consumerNumber, sanctionedLoadKw: site?.sanctionedLoadKw, phase: site?.phase,
    },
    system: { title: `${Number(v.systemSizeKw)} kW On-Grid Rooftop Solar`, details },
    lines: v.lines.map((l) => ({ name: l.name, specification: l.specification, quantity: l.quantity.toString(), unit: l.unit, amount: l.showPrice ? l.amount.toFixed(2) : null })),
    showLinePrices: v.lines.some((l) => l.showPrice),
    priceLabel: v.supplyType === 'EPC_COMPOSITE' ? 'System price (supply + installation)' : v.supplyType === 'SUPPLY_ONLY' ? 'System price (supply only)' : 'Service charges',
    contractValue: v.contractValue.toFixed(2), taxRows, roundOff: v.roundOff.toFixed(2), total: v.total.toFixed(2),
    subsidyName: snap.subsidySchemeName, subsidyAmount: v.subsidyAmount.toFixed(2), netCost: v.netCostToCustomer.toFixed(2),
    savings: savings && {
      annualGenerationKwh: v.annualGenerationKwh!.toFixed(2), annualSavings: v.annualSavings!.toFixed(2),
      paybackYears: v.paybackYears?.toString() ?? null, savings25Years: savings.savings25Years.toFixed(2), unitsPerKwDay: snap.unitsPerKwDay,
    },
    milestones: v.milestones.map((x) => ({ label: x.label, percent: x.percent.toString(), amount: x.amount.toFixed(2) })),
    warranty: seller.warranty ?? [], scopeIncluded: seller.scopeIncluded ?? [], scopeExcluded: seller.scopeExcluded ?? [],
    documentsRequired: seller.documentsRequired ?? [],
    terms: (v.terms ?? '').split('\n').map((t) => t.trim()).filter(Boolean), notes: v.notes,
    upiQrDataUrl: seller.upiId ? await QRCode.toDataURL(`upi://pay?pa=${encodeURIComponent(seller.upiId)}&pn=${encodeURIComponent(seller.name)}&cu=INR`, { margin: 0, width: 240 }) : null,
  };
}

export async function invoiceDoc(ctx: Ctx, id: string): Promise<InvoiceDoc> {
  const inv = await prisma.invoice.findFirst({
    where: { id, companyId: ctx.companyId },
    include: { lines: { orderBy: { sortOrder: 'asc' } }, creditNotes: true },
  });
  if (!inv) throw notFound('Invoice');
  const seller = inv.sellerSnapshot as unknown as SellerSnapshot;
  const buyer = inv.buyerSnapshot as unknown as BuyerSnapshot;
  const snap = inv.taxSnapshot as unknown as TaxSnapshot;
  const site = buyer.site;
  const credited = inv.creditNotes.reduce((a, c) => a.plus(c.total.toString()), D(0));
  const balance = D(inv.total.toString()).minus(inv.amountPaid.toString()).minus(credited);
  const share = pct(snap.epcGoodsShare);
  const split = inv.isInterState
    ? `Inter-state supply to ${stateName(inv.placeOfSupplyStateCode)}, so IGST applies.`
    : 'Intra-state supply, so tax is split as CGST + SGST.';
  const note = snap.supplyType === 'EPC_COMPOSITE'
    ? `Composite solar EPC supply: GST computed on the ${share}:${100 - Number(share)} valuation (${share}% goods @ ${rate(snap.goodsRate)}%, ${100 - Number(share)}% services @ ${rate(snap.serviceRate)}%). ${split}`
    : split;
  const isDraft = inv.status === 'DRAFT';
  const isTax = inv.type === 'TAX_INVOICE';
  return {
    seller, title: isTax ? 'TAX INVOICE' : 'PROFORMA INVOICE', copyLabel: isTax && !isDraft ? 'ORIGINAL FOR RECIPIENT' : null, isDraft,
    number: inv.number, issueDate: inv.issueDate, dueDate: inv.dueDate, placeOfSupplyStateCode: inv.placeOfSupplyStateCode,
    quotationNumber: snap.quotationNumber, milestoneLabel: inv.milestoneLabel, reverseCharge: inv.reverseCharge,
    buyer: {
      name: buyer.name, gstin: buyer.gstin, stateCode: buyer.stateCode, phone: buyer.phone,
      addressLine: `${[buyer.addressLine1, buyer.addressLine2].filter(Boolean).join(', ')}, ${buyer.city} – ${buyer.pincode}`,
    },
    site: site && {
      title: snap.systemSizeKw ? `${Number(snap.systemSizeKw)} kW On-Grid Rooftop Solar` : (site.label ?? 'Installation site'),
      addressLine: `${[site.addressLine1, site.addressLine2].filter(Boolean).join(', ')}, ${site.city} – ${site.pincode}`,
      discomName: site.discomName, consumerNumber: site.consumerNumber,
    },
    isInterState: inv.isInterState,
    lines: inv.lines.map((l) => ({
      description: l.description, detail: l.detail, hsnSac: l.hsnSac, taxableValue: l.taxableValue.toFixed(2), gstRate: l.gstRate.toString(),
      cgst: l.cgst.toFixed(2), sgst: l.sgst.toFixed(2), igst: l.igst.toFixed(2), total: l.total.toFixed(2),
    })),
    taxableValue: inv.taxableValue.toFixed(2), cgst: inv.cgst.toFixed(2), sgst: inv.sgst.toFixed(2), igst: inv.igst.toFixed(2),
    roundOff: inv.roundOff.toFixed(2), total: inv.total.toFixed(2), amountInWords: inv.amountInWords ?? '', note,
    showPayments: !isDraft, amountPaid: inv.amountPaid.toFixed(2), credited: credited.toFixed(2), balanceDue: balance.toFixed(2),
    irn: inv.irn,
  };
}

export const quotationHtml = async (ctx: Ctx, id: string, version: number) => renderQuotationHtml(await quotationDoc(ctx, id, version));
export const invoiceHtml = async (ctx: Ctx, id: string) => renderInvoiceHtml(await invoiceDoc(ctx, id));

let browser: Promise<Browser> | null = null;
function getBrowser(): Promise<Browser> {
  if (!browser) {
    browser = chromium.launch({ channel: env.pdfBrowserChannel }).catch((e) => {
      browser = null;
      throw e;
    });
  }
  return browser;
}

/** Renders in headless Chrome. Runs in the request for now; the plan moves this to a BullMQ job with S3 storage. */
export async function htmlToPdf(html: string): Promise<Buffer> {
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setContent(html, { waitUntil: 'networkidle', timeout: 15000 });
    await page.evaluate(() => document.fonts.ready.then(() => undefined));
    return await page.pdf({ format: 'A4', printBackground: true, preferCSSPageSize: true });
  } finally {
    await page.close();
  }
}

export async function closeBrowser() {
  if (browser) await (await browser).close().catch(() => undefined);
  browser = null;
}
