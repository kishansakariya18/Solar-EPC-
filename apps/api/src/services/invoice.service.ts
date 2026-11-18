import type { InvoiceStatus, InvoiceType, Prisma } from '@prisma/client';
import { D, amountInWords, computeTax, type SupplyType, type TaxResult } from '@solar-epc/core';
import type { z } from 'zod';
import { prisma, type Tx } from '../db';
import { audit } from '../lib/audit';
import { badRequest, conflict, notFound, type Ctx } from '../lib/http';
import { nextDocNumber } from '../lib/numbering';
import { buyerSnapshot, sellerSnapshot, taxSnapshot, type TaxSnapshot } from '../lib/snapshots';
import type { creditNoteSchema, invoiceCreateSchema, invoiceUpdateSchema, paymentSchema } from '../schemas';
import { activeTaxConfig } from './settings.service';

const m = (d: { toFixed(n: number): string }) => d.toFixed(2);

const detailInclude = {
  customer: true,
  lines: { orderBy: { sortOrder: 'asc' as const } },
  payments: { orderBy: { receivedOn: 'asc' as const } },
  creditNotes: { orderBy: { issueDate: 'asc' as const } },
  quotationVersion: { select: { id: true, version: true, quotation: { select: { id: true, number: true } } } },
};

export function listInvoices(ctx: Ctx, opts: { status?: InvoiceStatus; type?: InvoiceType }) {
  return prisma.invoice.findMany({
    where: { companyId: ctx.companyId, ...(opts.status ? { status: opts.status } : {}), ...(opts.type ? { type: opts.type } : {}) },
    orderBy: { createdAt: 'desc' }, take: 200,
    include: { customer: { select: { name: true, phone: true } }, creditNotes: { select: { total: true } } },
  });
}

export async function getInvoice(ctx: Ctx, id: string) {
  const inv = await prisma.invoice.findFirst({ where: { id, companyId: ctx.companyId }, include: detailInclude });
  if (!inv) throw notFound('Invoice');
  return inv;
}

function taxFor(snapshot: TaxSnapshot, contractValue: string, sellerState: string, placeOfSupply: string): TaxResult {
  return computeTax({
    contractValue, supplyType: (snapshot.supplyType ?? 'EPC_COMPOSITE') as SupplyType,
    sellerStateCode: sellerState, buyerStateCode: placeOfSupply, config: snapshot, systemSizeKw: snapshot.systemSizeKw,
  });
}

function lineRows(tax: TaxResult): Prisma.InvoiceLineCreateWithoutInvoiceInput[] {
  return tax.lines.map((l, i) => ({
    sortOrder: i, kind: l.kind, description: l.description, detail: l.detail, hsnSac: l.hsnSac,
    unit: l.kind === 'GOODS' ? 'SET' : 'JOB', quantity: '1', unitPrice: m(l.taxableValue), taxableValue: m(l.taxableValue),
    gstRate: l.gstRate.toFixed(2), cgst: m(l.cgst), sgst: m(l.sgst), igst: m(l.igst), total: m(l.total),
  }));
}

const totals = (tax: TaxResult) => ({
  taxableValue: m(tax.taxableValue), cgst: m(tax.cgst), sgst: m(tax.sgst), igst: m(tax.igst),
  roundOff: m(tax.roundOff), total: m(tax.total), amountInWords: tax.amountInWords, isInterState: tax.isInterState,
});

/**
 * Draft invoice from an accepted quotation version. Lines and tax are computed from the
 * tax settings in force today, and seller, buyer and tax details are frozen on the invoice.
 */
export async function createFromQuotation(ctx: Ctx, input: z.infer<typeof invoiceCreateSchema>) {
  const q = await prisma.quotation.findFirst({
    where: { id: input.quotationId, companyId: ctx.companyId },
    include: { customer: true, site: true, versions: { orderBy: { version: 'desc' } } },
  });
  if (!q) throw notFound('Quotation');
  if (q.status !== 'ACCEPTED' && q.status !== 'CONVERTED') throw conflict('Only an accepted quotation can be invoiced');
  const version = input.version ? q.versions.find((v) => v.version === input.version) : q.versions[0];
  if (!version) throw notFound('Quotation version');

  const [company, cfg] = await Promise.all([
    prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } }),
    activeTaxConfig(ctx.companyId),
  ]);
  const snapshot: TaxSnapshot = {
    ...taxSnapshot(cfg), supplyType: version.supplyType, systemSizeKw: version.systemSizeKw.toString(),
    contractValue: version.contractValue.toFixed(2), quotationNumber: q.number, quotationVersion: version.version,
  };
  const placeOfSupply = q.site?.stateCode ?? q.customer.stateCode;
  const tax = taxFor(snapshot, snapshot.contractValue!, company.stateCode, placeOfSupply);

  return prisma.$transaction(async (tx: Tx) => {
    const inv = await tx.invoice.create({
      data: {
        companyId: ctx.companyId, customerId: q.customerId, quotationVersionId: version.id, type: input.type,
        milestoneLabel: input.milestoneLabel, dueDate: input.dueDate ?? null,
        placeOfSupplyStateCode: placeOfSupply,
        sellerSnapshot: { ...sellerSnapshot(company) }, buyerSnapshot: { ...buyerSnapshot(q.customer, q.site) }, taxSnapshot: { ...snapshot },
        ...totals(tax), lines: { create: lineRows(tax) },
      },
    });
    if (input.type === 'TAX_INVOICE' && q.status !== 'CONVERTED') {
      await tx.quotation.update({ where: { id: q.id }, data: { status: 'CONVERTED' } });
    }
    await audit(tx, ctx, 'Invoice', inv.id, 'CREATE', { type: input.type, quotation: q.number, version: version.version });
    return inv;
  });
}

/** Only drafts can be edited. Changing the value recomputes every line and total. */
export async function updateDraft(ctx: Ctx, id: string, input: z.infer<typeof invoiceUpdateSchema>) {
  const inv = await getInvoice(ctx, id);
  if (inv.status !== 'DRAFT') throw conflict('An issued invoice cannot be edited. Use a credit note to correct it.');
  const snapshot = inv.taxSnapshot as unknown as TaxSnapshot;
  const seller = inv.sellerSnapshot as unknown as { stateCode: string };
  return prisma.$transaction(async (tx: Tx) => {
    const data: Prisma.InvoiceUpdateInput = {
      milestoneLabel: input.milestoneLabel, dueDate: input.dueDate, reverseCharge: input.reverseCharge,
    };
    if (input.contractValue !== undefined) {
      if (D(input.contractValue).lte(0)) throw badRequest('The taxable value must be more than zero');
      const next = { ...snapshot, contractValue: D(input.contractValue).toFixed(2) };
      const tax = taxFor(next, next.contractValue, seller.stateCode, inv.placeOfSupplyStateCode);
      await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
      Object.assign(data, totals(tax), { taxSnapshot: next, lines: { create: lineRows(tax) } });
    }
    // The status guard makes a concurrent issue win cleanly instead of being overwritten.
    const res = await tx.invoice.updateMany({ where: { id, status: 'DRAFT' }, data: { updatedAt: new Date() } });
    if (res.count !== 1) throw conflict('This invoice was issued a moment ago and can no longer be edited');
    const updated = await tx.invoice.update({ where: { id }, data });
    await audit(tx, ctx, 'Invoice', id, 'UPDATE', input);
    return updated;
  });
}

export async function deleteDraft(ctx: Ctx, id: string) {
  const inv = await getInvoice(ctx, id);
  if (inv.status !== 'DRAFT') throw conflict('Only a draft can be deleted. Cancel an issued invoice with a credit note.');
  return prisma.$transaction(async (tx: Tx) => {
    const res = await tx.invoice.deleteMany({ where: { id, status: 'DRAFT' } });
    if (res.count !== 1) throw conflict('This invoice is no longer a draft');
    await audit(tx, ctx, 'Invoice', id, 'DELETE');
  });
}

/** Issue: number assignment and the status change happen in one transaction, then the invoice is locked. */
export async function issueInvoice(ctx: Ctx, id: string) {
  const inv = await getInvoice(ctx, id);
  if (inv.status !== 'DRAFT') throw conflict('This invoice has already been issued');
  // The seller details are frozen at the moment of issue, so a draft picks up later company edits.
  const company = await prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } });
  if (inv.type === 'TAX_INVOICE' && !company.gstin) throw badRequest('Add the company GSTIN in Settings before issuing a tax invoice.');
  return prisma.$transaction(async (tx: Tx) => {
    const now = new Date();
    const claimed = await tx.invoice.updateMany({ where: { id, status: 'DRAFT' }, data: { status: 'ISSUED' } });
    if (claimed.count !== 1) throw conflict('This invoice has already been issued');
    const number = await nextDocNumber(tx, ctx.companyId, inv.type === 'PROFORMA' ? 'PROFORMA' : 'TAX_INVOICE', now);
    const issued = await tx.invoice.update({
      where: { id }, data: { number, issueDate: now, issuedAt: now, issuedById: ctx.userId, sellerSnapshot: { ...sellerSnapshot(company) }, amountInWords: amountInWords(inv.total.toString()) },
    });
    await audit(tx, ctx, 'Invoice', id, 'ISSUE', { number, total: inv.total.toString() });
    return issued;
  });
}

function settledStatus(total: Prisma.Decimal, paid: { toString(): string }, credited: { toString(): string }, fullyCredited: boolean): InvoiceStatus {
  if (fullyCredited) return 'CANCELLED';
  const balance = D(total.toString()).minus(paid.toString()).minus(credited.toString());
  if (balance.lte(0)) return 'PAID';
  return D(paid.toString()).gt(0) ? 'PARTIALLY_PAID' : 'ISSUED';
}

export async function addPayment(ctx: Ctx, id: string, input: z.infer<typeof paymentSchema>) {
  return prisma.$transaction(async (tx: Tx) => {
    // Lock the invoice row so two payments recorded together cannot both pass the balance check.
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`;
    const inv = await tx.invoice.findFirst({ where: { id, companyId: ctx.companyId }, include: { creditNotes: true } });
    if (!inv) throw notFound('Invoice');
    if (inv.status !== 'ISSUED' && inv.status !== 'PARTIALLY_PAID') throw conflict('Payments can only be recorded on an issued invoice with a balance due');
    const credited = inv.creditNotes.reduce((a, c) => a.plus(c.total.toString()), D(0));
    const balance = D(inv.total.toString()).minus(inv.amountPaid.toString()).minus(credited);
    const amount = D(input.amount);
    if (amount.gt(balance)) throw badRequest(`The payment is more than the balance due (₹${balance.toFixed(2)})`);
    const payment = await tx.payment.create({ data: { ...input, amount: m(amount), invoiceId: id, recordedById: ctx.userId } });
    const paid = D(inv.amountPaid.toString()).plus(amount);
    await tx.invoice.update({ where: { id }, data: { amountPaid: m(paid), status: settledStatus(inv.total, paid, credited, false) } });
    await audit(tx, ctx, 'Invoice', id, 'PAYMENT', { amount: m(amount), mode: input.mode });
    return payment;
  });
}

/**
 * Credit note against an issued tax invoice. Tax is credited in the same proportion as the
 * invoice; crediting the whole remaining value cancels the invoice.
 */
export async function createCreditNote(ctx: Ctx, id: string, input: z.infer<typeof creditNoteSchema>) {
  return prisma.$transaction(async (tx: Tx) => {
    await tx.$queryRaw`SELECT "id" FROM "Invoice" WHERE "id" = ${id} FOR UPDATE`;
    const inv = await tx.invoice.findFirst({ where: { id, companyId: ctx.companyId }, include: { creditNotes: true } });
    if (!inv) throw notFound('Invoice');
    if (inv.type !== 'TAX_INVOICE') throw conflict('Credit notes apply to tax invoices only');
    if (!['ISSUED', 'PARTIALLY_PAID', 'PAID'].includes(inv.status)) throw conflict('Only an issued invoice can be credited');

    const notes = inv.creditNotes;
    const sum = (f: (c: (typeof notes)[number]) => Prisma.Decimal) => notes.reduce((a, c) => a.plus(f(c).toString()), D(0));
    const remaining = {
      taxable: D(inv.taxableValue.toString()).minus(sum((c) => c.taxableValue)),
      cgst: D(inv.cgst.toString()).minus(sum((c) => c.cgst)),
      sgst: D(inv.sgst.toString()).minus(sum((c) => c.sgst)),
      igst: D(inv.igst.toString()).minus(sum((c) => c.igst)),
      total: D(inv.total.toString()).minus(sum((c) => c.total)),
    };
    const taxable = D(input.taxableValue);
    if (taxable.gt(remaining.taxable)) throw badRequest(`Only ₹${remaining.taxable.toFixed(2)} of taxable value is left to credit`);
    const full = taxable.eq(remaining.taxable);
    const ratio = taxable.div(inv.taxableValue.toString());
    const part = (whole: Prisma.Decimal, left: typeof taxable) => (full ? left : D(whole.toString()).times(ratio).toDecimalPlaces(2));
    const cgst = part(inv.cgst, remaining.cgst);
    const sgst = part(inv.sgst, remaining.sgst);
    const igst = part(inv.igst, remaining.igst);
    const total = full ? remaining.total : taxable.plus(cgst).plus(sgst).plus(igst);

    const now = new Date();
    const number = await nextDocNumber(tx, ctx.companyId, 'CREDIT_NOTE', now);
    const cn = await tx.creditNote.create({
      data: { companyId: ctx.companyId, invoiceId: id, number, issueDate: now, reason: input.reason, taxableValue: m(taxable), cgst: m(cgst), sgst: m(sgst), igst: m(igst), total: m(total) },
    });
    const credited = D(inv.total.toString()).minus(remaining.total).plus(total);
    await tx.invoice.update({ where: { id }, data: { status: settledStatus(inv.total, inv.amountPaid, credited, full) } });
    await audit(tx, ctx, 'Invoice', id, full ? 'CANCEL' : 'UPDATE', { creditNote: number, total: m(total), reason: input.reason });
    return cn;
  });
}
