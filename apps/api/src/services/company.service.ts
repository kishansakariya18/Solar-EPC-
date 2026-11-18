import type { z } from 'zod';
import { prisma } from '../db';
import { audit } from '../lib/audit';
import type { Ctx } from '../lib/http';
import type { companySchema } from '../schemas';

export const getCompany = (ctx: Ctx) => prisma.company.findUniqueOrThrow({ where: { id: ctx.companyId } });

export function updateCompany(ctx: Ctx, data: z.infer<typeof companySchema>) {
  return prisma.$transaction(async (tx) => {
    const company = await tx.company.update({ where: { id: ctx.companyId }, data });
    await audit(tx, ctx, 'Company', company.id, 'UPDATE', data);
    return company;
  });
}

export async function dashboard(ctx: Ctx) {
  const companyId = ctx.companyId;
  const [customers, quotationsByStatus, invoices, recentQuotations] = await Promise.all([
    prisma.customer.count({ where: { companyId } }),
    prisma.quotation.groupBy({ by: ['status'], where: { companyId }, _count: true }),
    prisma.invoice.findMany({
      where: { companyId, type: 'TAX_INVOICE', status: { in: ['ISSUED', 'PARTIALLY_PAID', 'PAID'] } },
      select: { total: true, amountPaid: true, creditNotes: { select: { total: true } } },
    }),
    prisma.quotation.findMany({
      where: { companyId }, orderBy: { updatedAt: 'desc' }, take: 6,
      include: { customer: { select: { name: true } }, versions: { orderBy: { version: 'desc' }, take: 1, select: { version: true, total: true, systemSizeKw: true } } },
    }),
  ]);
  let billed = 0, received = 0, outstanding = 0;
  for (const i of invoices) {
    const credits = i.creditNotes.reduce((a, c) => a + Number(c.total), 0);
    billed += Number(i.total) - credits;
    received += Number(i.amountPaid);
    outstanding += Math.max(0, Number(i.total) - credits - Number(i.amountPaid));
  }
  return {
    customers,
    quotationsByStatus: Object.fromEntries(quotationsByStatus.map((q) => [q.status, q._count])),
    // Dashboard summary only; never used on documents.
    billed: billed.toFixed(2), received: received.toFixed(2), outstanding: outstanding.toFixed(2),
    recentQuotations,
  };
}

export const auditLogs = (ctx: Ctx) =>
  prisma.auditLog.findMany({ where: { companyId: ctx.companyId }, orderBy: { createdAt: 'desc' }, take: 100, include: { user: { select: { name: true } } } });
