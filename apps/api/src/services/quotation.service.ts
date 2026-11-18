import type { QuotationStatus } from '@prisma/client';
import { D, computeSubsidy, computeTax, estimateSavings, lineAmount, splitMilestones } from '@solar-epc/core';
import { prisma, type Tx } from '../db';
import { audit } from '../lib/audit';
import { badRequest, conflict, notFound, type Ctx } from '../lib/http';
import { nextDocNumber } from '../lib/numbering';
import { buyerSnapshot, sellerSnapshot, taxSnapshot } from '../lib/snapshots';
import type { QuotationCreateInput, QuotationVersionInput } from '../schemas';
import { activeSubsidyScheme, activeTaxConfig } from './settings.service';

const m = (d: { toFixed(n: number): string }) => d.toFixed(2);

const detailInclude = {
  customer: true,
  site: true,
  versions: {
    orderBy: { version: 'desc' as const },
    include: {
      lines: { orderBy: { sortOrder: 'asc' as const } },
      milestones: { orderBy: { sortOrder: 'asc' as const } },
      invoices: { select: { id: true, type: true, status: true, number: true, total: true } },
    },
  },
};

export function listQuotations(ctx: Ctx, opts: { q?: string; status?: QuotationStatus }) {
  const term = opts.q?.trim();
  return prisma.quotation.findMany({
    where: {
      companyId: ctx.companyId,
      ...(opts.status ? { status: opts.status } : {}),
      ...(term ? { OR: [{ number: { contains: term, mode: 'insensitive' } }, { customer: { name: { contains: term, mode: 'insensitive' } } }, { customer: { phone: { contains: term } } }] } : {}),
    },
    orderBy: { createdAt: 'desc' }, take: 200,
    include: {
      customer: { select: { name: true, phone: true } },
      versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, total: true, systemSizeKw: true, contractValue: true } },
    },
  });
}

export async function getQuotation(ctx: Ctx, id: string) {
  const q = await prisma.quotation.findFirst({ where: { id, companyId: ctx.companyId }, include: detailInclude });
  if (!q) throw notFound('Quotation');
  return q;
}

/**
 * Everything stored on a version is computed here from the lines and settings.
 * Totals sent by the browser are ignored: the server is the source of truth.
 */
async function buildVersion(ctx: Ctx, input: QuotationVersionInput, customerId: string, siteId: string | null) {
  const [company, customer, site, cfg] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } }),
    prisma.customer.findFirst({ where: { id: customerId, companyId: ctx.companyId } }),
    siteId ? prisma.site.findFirst({ where: { id: siteId, customerId } }) : null,
    activeTaxConfig(ctx.companyId),
  ]);
  if (!customer) throw notFound('Customer');
  if (siteId && !site) throw notFound('Site');

  const lines = input.lines.map((l, i) => ({
    productId: l.productId ?? null, sortOrder: i, kind: l.kind, name: l.name, specification: l.specification,
    hsnSac: l.hsnSac, unit: l.unit, quantity: l.quantity, unitPrice: m(D(l.unitPrice)),
    amount: m(lineAmount(l.quantity, l.unitPrice)), showPrice: l.showPrice ?? false,
  }));
  const linesTotal = lines.reduce((a, l) => a.plus(l.amount), D(0));
  const contractValue = input.contractValue != null ? D(input.contractValue) : linesTotal;
  if (contractValue.lte(0)) throw badRequest('The contract value must be more than zero');

  const placeOfSupply = site?.stateCode ?? customer.stateCode;
  const tax = computeTax({
    contractValue, supplyType: input.supplyType, sellerStateCode: company.stateCode, buyerStateCode: placeOfSupply,
    config: cfg, systemSizeKw: input.systemSizeKw,
  });

  const scheme = input.includeSubsidy ? await activeSubsidyScheme(ctx.companyId) : null;
  const subsidy = scheme ? computeSubsidy(input.systemSizeKw, scheme.slabs, scheme.maxAmount) : D(0);
  const netCost = tax.total.minus(subsidy);

  const hasSavings = input.tariffPerUnit != null && input.unitsPerKwDay != null && D(input.tariffPerUnit).gt(0);
  const savings = hasSavings
    ? estimateSavings({ systemSizeKw: input.systemSizeKw, unitsPerKwDay: input.unitsPerKwDay!, tariffPerUnit: input.tariffPerUnit!, netCost })
    : null;

  const percentTotal = input.milestones.reduce((a, x) => a.plus(x.percent), D(0));
  if (input.milestones.length && !percentTotal.eq(100)) throw badRequest('Payment milestones must add up to 100%');
  const milestoneAmounts = splitMilestones(tax.total, input.milestones.map((x) => x.percent));

  return {
    data: {
      supplyType: input.supplyType, systemSizeKw: input.systemSizeKw, panelCount: input.panelCount ?? null, kitId: input.kitId ?? null,
      placeOfSupplyStateCode: placeOfSupply, isInterState: tax.isInterState,
      sellerSnapshot: { ...sellerSnapshot(company) },
      buyerSnapshot: { ...buyerSnapshot(customer, site) },
      taxSnapshot: { ...taxSnapshot(cfg), subsidySchemeName: scheme?.name ?? null, unitsPerKwDay: input.unitsPerKwDay ?? null },
      contractValue: m(contractValue), goodsValue: m(tax.goodsValue), serviceValue: m(tax.serviceValue),
      cgst: m(tax.cgst), sgst: m(tax.sgst), igst: m(tax.igst), roundOff: m(tax.roundOff), total: m(tax.total),
      subsidyAmount: m(subsidy), netCostToCustomer: m(netCost),
      annualGenerationKwh: savings ? m(savings.annualGenerationKwh) : null,
      annualSavings: savings ? m(savings.annualSavings) : null,
      paybackYears: savings?.paybackYears ? savings.paybackYears.toFixed(2) : null,
      tariffPerUnit: hasSavings ? input.tariffPerUnit : null,
      terms: input.terms ?? company.defaultTerms, notes: input.notes,
      createdById: ctx.userId,
      lines: { create: lines },
      milestones: { create: input.milestones.map((x, i) => ({ sortOrder: i, label: x.label, percent: x.percent, amount: m(milestoneAmounts[i]) })) },
    },
  };
}

export async function createQuotation(ctx: Ctx, input: QuotationCreateInput) {
  const { customerId, siteId, ...versionInput } = input;
  const { data } = await buildVersion(ctx, versionInput, customerId, siteId ?? null);
  return prisma.$transaction(async (tx: Tx) => {
    const number = await nextDocNumber(tx, ctx.companyId, 'QUOTATION');
    const q = await tx.quotation.create({
      data: {
        companyId: ctx.companyId, customerId, siteId: siteId ?? null, number, validUntil: input.validUntil ?? null,
        createdById: ctx.userId, versions: { create: { ...data, version: 1 } },
      },
    });
    await audit(tx, ctx, 'Quotation', q.id, 'CREATE', { number, version: 1, total: data.total });
    return q;
  });
}

/** A revision is always a new version; earlier versions are never touched. */
export async function reviseQuotation(ctx: Ctx, id: string, input: QuotationVersionInput) {
  const q = await getQuotation(ctx, id);
  if (q.status === 'CONVERTED') throw conflict('This quotation has been invoiced and can no longer be revised');
  const { data } = await buildVersion(ctx, input, q.customerId, q.siteId);
  return prisma.$transaction(async (tx: Tx) => {
    const last = await tx.quotationVersion.findFirst({ where: { quotationId: id }, orderBy: { version: 'desc' } });
    const version = (last?.version ?? 0) + 1;
    await tx.quotationVersion.create({ data: { ...data, quotationId: id, version } });
    const updated = await tx.quotation.update({ where: { id }, data: { status: 'DRAFT', validUntil: input.validUntil ?? q.validUntil } });
    await audit(tx, ctx, 'Quotation', id, 'UPDATE', { version, total: data.total });
    return updated;
  });
}

export async function setQuotationStatus(ctx: Ctx, id: string, status: QuotationStatus) {
  const q = await getQuotation(ctx, id);
  if (q.status === 'CONVERTED') throw conflict('This quotation has been invoiced; its status is fixed');
  return prisma.$transaction(async (tx: Tx) => {
    const updated = await tx.quotation.update({ where: { id }, data: { status } });
    await audit(tx, ctx, 'Quotation', id, 'STATUS', { from: q.status, to: status });
    return updated;
  });
}
